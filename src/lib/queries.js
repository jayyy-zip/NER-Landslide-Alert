/**
 * @file lib/queries.js
 *
 * Unified query and sync layer for the NER Disaster Management System.
 *
 * Architecture:
 *   - `risk_zones`: 25 NH-27 segments with terrain & AI probability scores.
 *   - `citizen_reports`: Citizen hazard reports (Road Crack, Landslide, Road Blockage, Fallen debris, Other).
 *     Lifecycle: new -> acknowledged -> dispatched -> resolved.
 *   - `sos_alerts`: Emergency distress beacons (Single Source of Truth for SOS).
 *     Lifecycle: active -> acknowledged -> dispatched -> resolved.
 *   - `report-photos`: Supabase storage bucket for report evidence.
 */

import { supabase } from './supabase.js'

const REPORT_STATUS_KEY = 'ner_report_statuses_v1'
const SOS_ALERTS_KEY = 'ner_sos_alerts_v1'

function getStoredReportStatuses() {
  try {
    const raw = localStorage.getItem(REPORT_STATUS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveStoredReportStatus(id, status, resolvedAt = null) {
  try {
    const current = getStoredReportStatuses()
    current[id] = { status, resolvedAt, updatedAt: new Date().toISOString() }
    localStorage.setItem(REPORT_STATUS_KEY, JSON.stringify(current))
  } catch (e) {
    console.error('Failed to cache report status locally', e)
  }
}

function getStoredSosAlerts() {
  try {
    const raw = localStorage.getItem(SOS_ALERTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveStoredSosAlert(alert) {
  try {
    const list = getStoredSosAlerts()
    const index = list.findIndex(a => a.id === alert.id)
    if (index >= 0) {
      list[index] = { ...list[index], ...alert }
    } else {
      list.unshift(alert)
    }
    localStorage.setItem(SOS_ALERTS_KEY, JSON.stringify(list))
  } catch (e) {
    console.error('Failed to cache SOS alert locally', e)
  }
}

// ─── 1. fetchRiskZones ────────────────────────────────────────────────────────

/**
 * Fetch all 25 NH-27 segments from `risk_zones`, ordered by segment_id ascending.
 */
export async function fetchRiskZones() {
  const { data, error } = await supabase
    .from('risk_zones')
    .select(
      'id, segment_id, lat, lng, ' +
      'rainfall_24h, rainfall_72h, ' +
      'slope_deg, elevation_m, ' +
      'historical_event_count, risk_probability, ' +
      'risk_tier, updated_at'
    )
    .order('segment_id', { ascending: true })

  if (error) {
    throw new Error(`fetchRiskZones failed: ${error.message} (code: ${error.code})`)
  }

  return data || []
}

// ─── 2. Citizen Reports (Hazard Reports Only) ─────────────────────────────────

/**
 * Fetch citizen hazard reports, newest first.
 *
 * @param {number} [limit=50]
 */
export async function fetchCitizenReports(limit = 50) {
  const { data, error } = await supabase
    .from('citizen_reports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`fetchCitizenReports failed: ${error.message} (code: ${error.code})`)
  }

  const storedStatuses = getStoredReportStatuses()

  return (data || []).map(row => {
    const cached = storedStatuses[row.id]
    return {
      ...row,
      status: row.status || cached?.status || 'new',
      resolved_at: row.resolved_at || cached?.resolvedAt || null,
    }
  })
}

/**
 * Upload an optional photo to `report-photos` storage, then insert a row into `citizen_reports`.
 *
 * @param {{
 *   issueType: string,
 *   description?: string,
 *   lat?: number,
 *   lng?: number,
 *   photoFile?: File|null,
 * }} report
 */
export async function submitCitizenReport({ issueType, description, lat, lng, photoFile }) {
  let photoUrl = null

  // 1. Optional photo upload to storage bucket
  if (photoFile) {
    const fileExt = photoFile.name ? photoFile.name.split('.').pop() : 'jpg'
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`
    const filePath = `reports/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('report-photos')
      .upload(filePath, photoFile, {
        cacheControl: '3600',
        upsert: false,
        contentType: photoFile.type || `image/${fileExt}`,
      })

    if (uploadError) {
      throw new Error(`Photo upload failed: ${uploadError.message}`)
    }

    const { data: urlData } = supabase.storage
      .from('report-photos')
      .getPublicUrl(filePath)

    photoUrl = urlData?.publicUrl ?? null
  }

  // 2. Insert report row into citizen_reports
  const insertPayload = {
    issue_type: issueType,
    description: description || null,
    lat: lat != null ? Number(lat) : null,
    lng: lng != null ? Number(lng) : null,
    photo_url: photoUrl,
  }

  // Attempt insert with status if supported
  let resultRow = null
  const { data, error: insertError } = await supabase
    .from('citizen_reports')
    .insert(insertPayload)
    .select()
    .single()

  if (insertError) {
    throw new Error(`submitCitizenReport insert failed: ${insertError.message} (code: ${insertError.code})`)
  }

  resultRow = data
  saveStoredReportStatus(resultRow.id, 'new', null)

  return {
    ...resultRow,
    status: 'new',
    resolved_at: null,
  }
}

/**
 * Update the status of a citizen report (new -> acknowledged -> dispatched -> resolved).
 *
 * @param {number|string} reportId
 * @param {'new'|'acknowledged'|'dispatched'|'resolved'} newStatus
 */
export async function updateReportStatus(reportId, newStatus) {
  const resolvedAt = newStatus === 'resolved' ? new Date().toISOString() : null

  // Try updating the database row
  try {
    await supabase
      .from('citizen_reports')
      .update({ status: newStatus, resolved_at: resolvedAt })
      .eq('id', reportId)
  } catch {
    // Client fallback if columns are being provisioned
  }

  saveStoredReportStatus(reportId, newStatus, resolvedAt)

  return {
    id: reportId,
    status: newStatus,
    resolved_at: resolvedAt,
  }
}

// ─── 3. SOS Alerts (Single Source of Truth) ───────────────────────────────────

/**
 * Broadcast an Emergency SOS alert directly to `sos_alerts`.
 *
 * @param {{
 *   lat: number,
 *   lng: number,
 *   zone?: string,
 *   notes?: string,
 *   citizen_report_id?: number|null,
 * }} sos
 */
export async function submitSosAlert({
  lat,
  lng,
  zone = 'NH27-S08',
  notes = 'Citizen distress beacon triggered via mobile app',
  citizen_report_id = null,
}) {
  const sosId = `SOS-${Date.now().toString().slice(-4)}`
  const createdAt = new Date().toISOString()

  let confirmedSos = null

  // Direct insert to sos_alerts table in Supabase
  try {
    const { data, error } = await supabase
      .from('sos_alerts')
      .insert({
        lat: Number(lat),
        lng: Number(lng),
        notes: notes,
        status: 'active',
        citizen_report_id: citizen_report_id || null,
      })
      .select()
      .single()

    if (!error && data) {
      confirmedSos = {
        ...data,
        zone: zone,
      }
    }
  } catch (err) {
    console.warn('Supabase sos_alerts table query error:', err)
  }

  if (!confirmedSos) {
    // Create valid active SOS object with persistence fallback
    confirmedSos = {
      id: sosId,
      citizen_report_id: citizen_report_id || null,
      zone: zone,
      lat: Number(lat),
      lng: Number(lng),
      notes: notes,
      status: 'active',
      created_at: createdAt,
      resolved_at: null,
    }
  }

  saveStoredSosAlert(confirmedSos)
  return confirmedSos
}

/**
 * Fetch all emergency SOS alerts directly from `sos_alerts`.
 */
export async function fetchSosAlerts() {
  const stored = getStoredSosAlerts()
  const storedMap = Object.fromEntries(stored.map(s => [s.id, s]))

  try {
    const { data, error } = await supabase
      .from('sos_alerts')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data && data.length > 0) {
      return data.map(item => {
        const cached = storedMap[item.id]
        return {
          ...item,
          zone: item.zone || cached?.zone || 'NH27-S08',
          status: item.status || cached?.status || 'active',
          resolved_at: item.resolved_at || cached?.resolved_at || null,
        }
      })
    }
  } catch {
    // Fall back to local sync cache if table is not cached
  }

  return stored
}

/**
 * Update SOS status: active -> acknowledged -> dispatched -> resolved.
 *
 * @param {string|number} sosId
 * @param {'active'|'acknowledged'|'dispatched'|'resolved'} newStatus
 */
export async function updateSosStatus(sosId, newStatus) {
  const resolvedAt = newStatus === 'resolved' ? new Date().toISOString() : null

  // Direct update to sos_alerts table in Supabase
  try {
    await supabase
      .from('sos_alerts')
      .update({ status: newStatus, resolved_at: resolvedAt })
      .eq('id', sosId)
  } catch {
    // Handled via local sync state
  }

  const updated = {
    id: sosId,
    status: newStatus,
    resolved_at: resolvedAt,
    updated_at: new Date().toISOString(),
  }

  saveStoredSosAlert(updated)
  return updated
}

// ─── 4. V3 AI Inference (FastAPI Integration) ────────────────────────────────

const AI_API_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_API_URL) || 'http://localhost:8000'

/**
 * Run real-time V3 landslide risk inference via FastAPI inference service.
 *
 * @param {{
 *   rainfall_24h_mm: number,
 *   rainfall_72h_mm: number,
 *   slope_deg: number,
 *   elevation_m: number,
 *   historical_event_count: number
 * }} features
 * @returns {Promise<{ risk_probability: number, risk_tier: string, model: string }>}
 */
export async function predictRisk(features) {
  const response = await fetch(`${AI_API_URL}/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rainfall_24h_mm: Number(features.rainfall_24h_mm ?? 0),
      rainfall_72h_mm: Number(features.rainfall_72h_mm ?? 0),
      slope_deg: Number(features.slope_deg ?? 0),
      elevation_m: Number(features.elevation_m ?? 0),
      historical_event_count: Number(features.historical_event_count ?? 0),
    }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || `AI prediction failed with status ${response.status}`)
  }

  return await response.json()
}

/**
 * Persist updated risk prediction for a specific segment to Supabase risk_zones.
 * Updates only risk_probability, risk_tier, and updated_at.
 *
 * @param {string} segmentId
 * @param {number} probability
 * @param {'Normal'|'Medium'|'High'|'Severe'} tier
 */
export async function updateRiskZonePrediction(segmentId, probability, tier) {
  const now = new Date().toISOString()
  try {
    const { data, error } = await supabase
      .from('risk_zones')
      .update({
        risk_probability: Number(probability),
        risk_tier: tier,
        updated_at: now,
      })
      .eq('segment_id', segmentId)
      .select()
      .maybeSingle()

    if (error) {
      console.warn(`Could not update Supabase risk_zones for ${segmentId}:`, error.message)
    }
    return data
  } catch (e) {
    console.warn('Supabase updateRiskZonePrediction error:', e)
    return null
  }
}

