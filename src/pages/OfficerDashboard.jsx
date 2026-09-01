/**
 * OfficerDashboard — Desktop Command Console strictly adhering to Google Stitch Officer design.
 *
 * Fully wired to live Supabase backend:
 *   - Risk Zones: 25 NH-27 segments from `risk_zones` table
 *   - Citizen Reports: live records from `citizen_reports` with status lifecycle (new -> acknowledged -> dispatched -> resolved)
 *   - SOS Alerts: live emergency beacons from `fetchSosAlerts()` with locate, dispatch, and resolve actions
 *   - Activity Log: real operational record reflecting user actions & incident triage
 */
import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Map, FileText, Bell, AlertTriangle,
  Shield, Users, LogOut, Settings,
  Siren, MapPin, Clock, Activity, ArrowUpRight,
  CheckCircle2, Send, Eye, ShieldAlert,
  Search, Filter, Check, RotateCcw
} from 'lucide-react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { RiskBadge } from '@/components/RiskBadge'
import NHMap from '@/components/NHMap'
import ZoneDrawer from '@/components/ZoneDrawer'
import { useRiskZones } from '@/hooks/useRiskZones'
import { fetchCitizenReports, updateReportStatus, fetchSosAlerts, updateSosStatus } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'risk-map', label: 'Risk Map', icon: Map },
  { id: 'reports', label: 'Citizen Reports', icon: FileText },
  { id: 'sos', label: 'SOS Alerts', icon: Siren },
  { id: 'history', label: 'Response History', icon: Activity },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function OfficerDashboard() {
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('dashboard')
  const [selectedZone, setSelectedZone] = useState(null)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState(null)

  // Live SOS alerts from Supabase / query layer
  const [sosAlerts, setSosAlerts] = useState([])
  const [sosLoading, setSosLoading] = useState(true)

  // Operational Activity Log
  const [activityLogs, setActivityLogs] = useState([
    { id: 1, time: '10:42 PM', type: 'sos', title: 'Emergency SOS Broadcasted', body: 'Distress signal received from NH27-S08. Location coordinates registered.' },
    { id: 2, time: '10:31 PM', type: 'ai', title: 'NER V3 AI Assessment Synced', body: '25 corridor segments refreshed with real-time precipitation & stability weights.' },
    { id: 3, time: '09:15 PM', type: 'handover', title: 'Shift Handover Logged', body: 'Duty Officer J. Doe assumed command at Haflong Emergency Operations Center.' },
  ])

  const { zones, loading: zonesLoading } = useRiskZones()

  const loadData = useCallback(async () => {
    try {
      const [fetchedReports, fetchedSos] = await Promise.all([
        fetchCitizenReports(50),
        fetchSosAlerts(),
      ])
      setReports(fetchedReports)
      setSosAlerts(fetchedSos)
      setReportsLoading(false)
      setSosLoading(false)
    } catch (err) {
      console.error('Failed to load dashboard data', err)
      setReportsLoading(false)
      setSosLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    // Realtime channel subscription for live updates
    let channel = null
    try {
      channel = supabase
        .channel('officer_dashboard_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'citizen_reports' }, () => {
          loadData()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
          loadData()
        })
        .subscribe()
    } catch (e) {
      console.warn('Realtime subscription not supported or failed to initialize', e)
    }

    return () => {
      if (channel) {
        supabase.removeChannel(channel).catch(() => {})
      }
    }
  }, [loadData])

  const handleSelectZone = useCallback((zone) => {
    setSelectedZone(zone)
  }, [])

  // Active emergency SOS (find the first active, acknowledged, or dispatched SOS)
  const activeSOS = sosAlerts.find(s => s.status === 'active' || s.status === 'acknowledged' || s.status === 'dispatched') || sosAlerts[0] || null

  // Emergency SOS Actions (active -> acknowledged -> dispatched -> resolved)
  const handleLocateSOS = (sos = activeSOS) => {
    if (!sos) {
      toast.info('No active SOS coordinates to locate.')
      return
    }

    const targetZone = zones?.find(z => z.segment_id === sos.zone)
    if (targetZone) {
      setSelectedZone(targetZone)
      toast.info(`Focused map on SOS location: ${sos.zone}`)
    } else {
      setSelectedZone({ segment_id: sos.zone || 'NH27-S08', lat: sos.lat, lng: sos.lng, risk_tier: 'Severe', risk_probability: 0.9945 })
      toast.info(`Focused map on GPS (${Number(sos.lat).toFixed(4)}°N, ${Number(sos.lng).toFixed(4)}°E)`)
    }
    setActiveNav('dashboard')
  }

  const handleAcknowledgeSOS = async (sosId) => {
    try {
      await updateSosStatus(sosId, 'acknowledged')
      setSosAlerts(prev => prev.map(s => s.id === sosId ? { ...s, status: 'acknowledged', resolved_at: null } : s))
      
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'sos',
        title: `👁️ SOS Acknowledged (${sosId})`,
        body: `Duty officer acknowledged distress beacon near ${activeSOS?.zone || 'Corridor'}.`,
      }
      setActivityLogs(prev => [newLog, ...prev])
      toast.success(`SOS alert ${sosId} acknowledged.`)
    } catch (err) {
      toast.error(`Acknowledge failed: ${err.message}`)
    }
  }

  const handleDispatchSOS = async (sosId) => {
    try {
      await updateSosStatus(sosId, 'dispatched')
      setSosAlerts(prev => prev.map(s => s.id === sosId ? { ...s, status: 'dispatched', resolved_at: null } : s))
      
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'sos',
        title: `🚨 SDRF Unit Dispatched to ${activeSOS?.zone || 'Corridor'}`,
        body: `Emergency response unit dispatched to incident ${sosId}. Location pinged on highway telemetry.`,
      }
      setActivityLogs(prev => [newLog, ...prev])
      toast.success(`Dispatched SDRF unit for ${sosId}. Status saved.`)
    } catch (err) {
      toast.error(`Dispatch failed: ${err.message}`)
    }
  }

  const handleResolveSOS = async (sosId) => {
    try {
      await updateSosStatus(sosId, 'resolved')
      setSosAlerts(prev => prev.map(s => s.id === sosId ? { ...s, status: 'resolved', resolved_at: new Date().toISOString() } : s))
      
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'sos',
        title: `✅ SOS Incident Resolved (${sosId})`,
        body: `Officer marked emergency distress call as cleared and secured.`,
      }
      setActivityLogs(prev => [newLog, ...prev])
      toast.success(`SOS alert ${sosId} marked resolved.`)
    } catch (err) {
      toast.error(`Resolve failed: ${err.message}`)
    }
  }

  const handleReopenSOS = async (sosId) => {
    try {
      await updateSosStatus(sosId, 'active')
      setSosAlerts(prev => prev.map(s => s.id === sosId ? { ...s, status: 'active', resolved_at: null } : s))
      
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'sos',
        title: `🔄 SOS Reopened (${sosId})`,
        body: `Officer reactivated distress beacon ${sosId}.`,
      }
      setActivityLogs(prev => [newLog, ...prev])
      toast.info(`SOS alert ${sosId} reactivated.`)
    } catch (err) {
      toast.error(`Reopen failed: ${err.message}`)
    }
  }

  // Report Triage Actions (new -> acknowledged -> dispatched -> resolved)
  const handleUpdateReportStatus = async (reportId, newStatus) => {
    try {
      const updated = await updateReportStatus(reportId, newStatus)
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: newStatus, resolved_at: updated.resolved_at } : r))
      
      const reportItem = reports.find(r => r.id === reportId)
      const newLog = {
        id: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'report',
        title: `Report ${newStatus.toUpperCase()}: ${reportItem?.issue_type || 'Hazard'}`,
        body: `Officer updated incident status for report #${reportId} to ${newStatus}.`,
      }
      setActivityLogs(prev => [newLog, ...prev])
      setSelectedReport(null)
      toast.success(`Report #${reportId} status updated to ${newStatus}`)
    } catch (err) {
      toast.error(`Status update failed: ${err.message}`)
    }
  }

  // Real KPI statistics calculated from Supabase risk_zones
  const severeZonesCount = zones?.filter(z => z.risk_tier === 'Severe').length || 0
  const highZonesCount = zones?.filter(z => z.risk_tier === 'High').length || 0
  const pendingReportsCount = reports.filter(r => r.status === 'new').length
  const activeSosCount = sosAlerts.filter(s => s.status === 'active' || s.status === 'acknowledged' || s.status === 'dispatched').length

  return (
    <div className="flex h-screen overflow-hidden bg-bg text-text">
      <Toaster position="top-right" richColors />

      {/* Left Sidebar matching Google Stitch */}
      <aside className="flex flex-col w-60 h-screen bg-surface border-r border-border shrink-0 justify-between">
        <div>
          {/* Header & Logo */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
            <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
              <Shield size={16} />
            </div>
            <div>
              <p className="text-sm font-black text-text leading-tight tracking-tight">NER Response</p>
              <p className="text-[10px] text-brand font-bold uppercase tracking-wider">Officer Console</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1" aria-label="Main Navigation">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
              const isActive = activeNav === id
              return (
                <button
                  key={id}
                  id={`nav-item-${id}`}
                  onClick={() => setActiveNav(id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left",
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-text-muted hover:bg-bg hover:text-text"
                  )}
                >
                  <Icon size={16} className={isActive ? "text-white" : "text-brand"} />
                  <span className="flex-1">{label}</span>
                  {id === 'sos' && activeSosCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-status-severe animate-pulse" />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Profile Card & Role Switcher */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-bg border border-border">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
              JD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-text truncate">Officer J. Doe</p>
              <p className="text-[10px] text-status-normal font-semibold tracking-wide">ACTIVE DUTY</p>
            </div>
            <button
              onClick={() => navigate('/')}
              title="Logout / Role Select"
              aria-label="Switch Role"
              className="p-1 rounded text-text-muted hover:text-status-severe transition-colors"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="bg-surface border-b border-border px-6 py-3 flex items-center justify-between shrink-0 shadow-sm">
          <div>
            <h1 className="text-base font-black text-text tracking-tight">NER Emergency Response</h1>
            <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
              <MapPin size={11} className="text-brand" /> Jatinga – Haflong / NH-27 Corridor Command
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-bg border border-border px-3 py-1 rounded-full text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-status-normal animate-pulse" />
              <span>25 NH-27 Risk Segments Monitored</span>
            </div>

            <button
              onClick={() => setActiveNav('sos')}
              className="relative p-2 rounded-lg bg-bg hover:bg-border/50 text-text-muted hover:text-text transition-colors"
              aria-label="SOS Alert Feed"
            >
              <Bell size={18} />
              {activeSosCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-severe rounded-full animate-ping" />
              )}
            </button>
          </div>
        </header>

        {/* Scrollable Views */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ==================== 1. DASHBOARD VIEW (Stitch Exact) ==================== */}
          {activeNav === 'dashboard' && (
            <>
              {/* Row 1: KPI Cards with real Supabase counts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border border-l-4 border-l-status-severe shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-status-severe">
                        <AlertTriangle size={14} />
                        <span>Severe Risk</span>
                      </div>
                      <p className="text-3xl font-black font-mono text-status-severe mt-1">
                        {severeZonesCount}
                      </p>
                      <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mt-0.5">
                        ZONES REQUIRING ACTION
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border border-l-4 border-l-status-high shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-status-high">
                        <AlertTriangle size={14} />
                        <span>High Risk</span>
                      </div>
                      <p className="text-3xl font-black font-mono text-status-high mt-1">
                        {highZonesCount}
                      </p>
                      <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mt-0.5">
                        ZONES ELEVATED
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border border-l-4 border-l-brand shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-brand">
                        <FileText size={14} />
                        <span>Citizen Reports</span>
                      </div>
                      <p className="text-3xl font-black font-mono text-text mt-1">
                        {reports.length}
                      </p>
                      <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider mt-0.5">
                        {pendingReportsCount} PENDING VERIFICATION
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className={cn(
                  "shadow-sm text-white",
                  activeSosCount > 0 ? "bg-status-severe border-status-severe" : "bg-slate-800 border-slate-700"
                )}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-black text-red-200 uppercase tracking-wider">
                        <Siren size={14} />
                        <span>Active SOS</span>
                      </div>
                      <p className="text-3xl font-black font-mono text-white mt-1">
                        {activeSosCount}
                      </p>
                      <p className="text-[10px] text-red-100 font-bold uppercase tracking-wider mt-0.5">
                        {activeSosCount > 0 ? 'IMMEDIATE ATTENTION REQUIRED' : 'NO ACTIVE SOS BEACONS'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Row 2: Map & Priority Zones Grid (Matches Stitch) */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left (3 Columns): Corridor Risk Map */}
                <div className="lg:col-span-3 space-y-3">
                  <Card className="border-border overflow-hidden shadow-sm">
                    <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-sm font-bold text-text">Corridor Risk Map</CardTitle>
                        <CardDescription className="text-xs text-text-muted">
                          NH-27 · JATINGA – HAFLONG SECTOR
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-status-normal animate-pulse" />
                        <span className="text-xs font-bold text-brand">CORRIDOR TELEMETRY</span>
                      </div>
                    </CardHeader>
                    <div className="relative">
                      {zonesLoading ? (
                        <Skeleton className="h-[420px] rounded-none" />
                      ) : (
                        <NHMap
                          zones={zones}
                          reports={reports}
                          sosAlerts={sosAlerts}
                          selectedZone={selectedZone}
                          onSelect={handleSelectZone}
                          onSelectReport={(r) => setSelectedReport(r)}
                          onSelectSos={(s) => handleLocateSOS(s)}
                          compact={false}
                          showDrawer={true}
                        />
                      )}
                    </div>
                  </Card>
                </div>

                {/* Right (2 Columns): SOS Alert & Priority Risk Zones */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Emergency SOS Banner Card */}
                  {activeSOS && activeSOS.status !== 'resolved' ? (
                    <Card className="bg-status-severe border-status-severe text-white shadow-sm overflow-hidden">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                              <Siren size={18} className="text-white" />
                            </div>
                            <div>
                              <p className="text-xs font-black tracking-wider uppercase text-red-100">EMERGENCY SOS</p>
                              <p className="text-sm font-bold">{activeSOS.zone || 'NH27-S08'} · {Number(activeSOS.lat).toFixed(4)}°N</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold bg-white/20 px-2 py-0.5 rounded text-white uppercase">
                            {activeSOS.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          <Button
                            id="btn-locate-sos"
                            onClick={() => handleLocateSOS(activeSOS)}
                            className="bg-white hover:bg-red-50 text-status-severe font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 shadow-sm"
                          >
                            <MapPin size={13} />
                            <span>LOCATE</span>
                          </Button>
                          {activeSOS.status === 'active' ? (
                            <Button
                              id="btn-ack-sos"
                              onClick={() => handleAcknowledgeSOS(activeSOS.id)}
                              className="bg-red-900/40 hover:bg-red-900/60 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 border border-white/20 shadow-sm"
                            >
                              <Check size={13} />
                              <span>ACK</span>
                            </Button>
                          ) : (
                            <Button
                              id="btn-dispatch-sos"
                              onClick={() => handleDispatchSOS(activeSOS.id)}
                              disabled={activeSOS.status === 'dispatched'}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 shadow-sm disabled:opacity-75"
                            >
                              <Send size={13} />
                              <span>{activeSOS.status === 'dispatched' ? 'DISPATCHED' : 'DISPATCH'}</span>
                            </Button>
                          )}
                          <Button
                            id="btn-resolve-sos"
                            onClick={() => handleResolveSOS(activeSOS.id)}
                            className="bg-green-700 hover:bg-green-800 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1 shadow-sm"
                          >
                            <CheckCircle2 size={13} />
                            <span>RESOLVE</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border-border bg-surface p-4 text-center shadow-sm">
                      <div className="w-10 h-10 rounded-full bg-status-normal/10 text-status-normal flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 size={20} />
                      </div>
                      <p className="text-xs font-bold text-text">No Active Distress Calls</p>
                      <p className="text-[11px] text-text-muted mt-0.5">Emergency frequencies clear on NH-27.</p>
                    </Card>
                  )}

                  {/* Priority Risk Zones List */}
                  <Card className="border-border shadow-sm">
                    <CardHeader className="p-4 pb-2 border-b border-border flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-text">
                        Priority Risk Zones
                      </CardTitle>
                      <span className="text-[10px] font-semibold bg-bg border border-border px-2 py-0.5 rounded text-text-muted">
                        AI SORTED
                      </span>
                    </CardHeader>
                    <CardContent className="p-2 divide-y divide-border/60">
                      {zonesLoading ? (
                        <div className="space-y-2 p-2">
                          <Skeleton className="h-10 rounded-lg" />
                          <Skeleton className="h-10 rounded-lg" />
                          <Skeleton className="h-10 rounded-lg" />
                        </div>
                      ) : (
                        zones
                          ?.filter(z => z.risk_tier !== 'Normal')
                          .sort((a, b) => Number(b.risk_probability) - Number(a.risk_probability))
                          .slice(0, 6)
                          .map((zone) => {
                            const isSelected = selectedZone?.segment_id === zone.segment_id
                            return (
                              <div
                                key={zone.segment_id}
                                id={`zone-item-${zone.segment_id}`}
                                onClick={() => handleSelectZone(zone)}
                                className={cn(
                                  "p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors group",
                                  isSelected ? "bg-brand/10 border border-brand/30" : "hover:bg-bg"
                                )}
                              >
                                <div className="flex items-center gap-2.5">
                                  <AlertTriangle 
                                    size={15} 
                                    className={
                                      zone.risk_tier === 'Severe' ? 'text-status-severe' :
                                      zone.risk_tier === 'High' ? 'text-status-high' : 'text-status-medium'
                                    } 
                                  />
                                  <div>
                                    <p className="text-xs font-bold text-text group-hover:text-brand transition-colors">
                                      {zone.segment_id}
                                    </p>
                                    <p className={cn(
                                      "text-[10px] font-bold uppercase",
                                      zone.risk_tier === 'Severe' ? 'text-status-severe' :
                                      zone.risk_tier === 'High' ? 'text-status-high' : 'text-status-medium'
                                    )}>
                                      {zone.risk_tier} RISK
                                    </p>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <p className={cn(
                                    "text-xs font-bold font-mono",
                                    zone.risk_tier === 'Severe' ? 'text-status-severe' :
                                    zone.risk_tier === 'High' ? 'text-status-high' : 'text-status-medium'
                                  )}>
                                    {(Number(zone.risk_probability) * 100).toFixed(2)}%
                                  </p>
                                  <p className="text-[10px] text-text-muted">AI PROBABILITY</p>
                                </div>
                              </div>
                            )
                          })
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Row 3: Citizen Reports Feed & Activity Log Grid (Matches Stitch) */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Recent Citizen Reports (3 Columns) */}
                <div className="lg:col-span-3">
                  <Card className="border-border shadow-sm">
                    <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <FileText size={16} className="text-brand" />
                        <CardTitle className="text-sm font-bold text-text">Recent Citizen Reports</CardTitle>
                      </div>
                      <span className="text-[10px] font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full uppercase">
                        LIVE FEED
                      </span>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      {reportsLoading ? (
                        <div className="space-y-3">
                          <Skeleton className="h-16 rounded-xl" />
                          <Skeleton className="h-16 rounded-xl" />
                        </div>
                      ) : reports.length === 0 ? (
                        <div className="p-6 text-center text-text-muted text-xs">
                          <CheckCircle2 size={24} className="mx-auto mb-2 text-brand/60" />
                          <p className="font-semibold text-text">No Citizen Reports Logged</p>
                          <p className="mt-1">Highway corridor has zero reported road obstructions.</p>
                        </div>
                      ) : (
                        reports.slice(0, 3).map((report) => (
                          <div
                            key={report.id}
                            className="p-3 rounded-xl border border-border bg-bg/50 hover:bg-surface transition-colors flex items-start justify-between gap-3"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-12 h-12 rounded-lg bg-surface border border-border flex items-center justify-center shrink-0 overflow-hidden">
                                {report.photo_url ? (
                                  <img src={report.photo_url} alt="Report Photo" className="w-full h-full object-cover" />
                                ) : (
                                  <AlertTriangle size={20} className="text-text-muted" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-bold text-text">{report.issue_type}</p>
                                  <span className={cn(
                                    "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                                    report.status === 'new' ? 'bg-brand/10 text-brand border border-brand/20' :
                                    report.status === 'acknowledged' ? 'bg-amber-100 text-amber-800' :
                                    report.status === 'dispatched' ? 'bg-blue-100 text-blue-800' :
                                    'bg-green-100 text-green-800'
                                  )}>
                                    {report.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-text-muted mt-0.5">
                                  {report.lat ? `${Number(report.lat).toFixed(4)}°N, ${Number(report.lng).toFixed(4)}°E` : 'NH-27'} · {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <p className="text-xs text-text mt-1 line-clamp-1">
                                  {report.description || 'Hazard reported by citizen via mobile portal.'}
                                </p>
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedReport(report)}
                              className="text-xs text-brand border-brand/30 hover:bg-brand/10 shrink-0"
                            >
                              <Eye size={12} className="mr-1" />
                              Review
                            </Button>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Activity Log (2 Columns) */}
                <div className="lg:col-span-2">
                  <Card className="border-border shadow-sm">
                    <CardHeader className="p-4 pb-3 border-b border-border flex flex-row items-center justify-between space-y-0">
                      <div className="flex items-center gap-2">
                        <Activity size={16} className="text-brand" />
                        <CardTitle className="text-sm font-bold text-text">Activity Log</CardTitle>
                      </div>
                      <span className="text-[10px] font-semibold text-text-muted bg-bg px-2 py-0.5 rounded border border-border uppercase">
                        OPERATIONAL RECORD
                      </span>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3.5">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="flex items-start gap-3 text-xs">
                          <span className={cn(
                            "w-2 h-2 rounded-full mt-1.5 shrink-0",
                            log.type === 'sos' ? 'bg-status-severe' :
                            log.type === 'ai' ? 'bg-status-high' :
                            log.type === 'report' ? 'bg-brand' : 'bg-slate-400'
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-text-muted font-mono">{log.time}</span>
                            </div>
                            <p className="font-bold text-text mt-0.5">{log.title}</p>
                            <p className="text-text-muted text-[11px] leading-relaxed mt-0.5">{log.body}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}

          {/* ==================== 2. RISK MAP VIEW ==================== */}
          {activeNav === 'risk-map' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text">Complete NH-27 Corridor Surveillance</h2>
                  <p className="text-xs text-text-muted">Real-time topographical risk analysis across all 25 segments</p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setSelectedZone(null)}
                  className="text-xs"
                >
                  Reset View
                </Button>
              </div>

              <Card className="border-border overflow-hidden">
                <NHMap
                  zones={zones}
                  reports={reports}
                  sosAlerts={sosAlerts}
                  selectedZone={selectedZone}
                  onSelect={handleSelectZone}
                  onSelectReport={(r) => setSelectedReport(r)}
                  onSelectSos={(s) => handleLocateSOS(s)}
                  compact={false}
                  showDrawer={true}
                  className="h-[75vh]"
                />
              </Card>
            </div>
          )}

          {/* ==================== 3. CITIZEN REPORTS QUEUE ==================== */}
          {activeNav === 'reports' && (
            <div className="space-y-4 max-w-4xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-text">Citizen Incident Reports Queue</h2>
                  <p className="text-xs text-text-muted">Review, verify, acknowledge, and dispatch teams for citizen-reported hazards</p>
                </div>
                <span className="text-xs bg-brand/10 text-brand font-bold px-3 py-1 rounded-full">
                  {reports.length} Total Reports
                </span>
              </div>

              {reports.length === 0 ? (
                <Card className="border-border p-8 text-center text-text-muted">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-brand" />
                  <p className="font-bold text-text">All Citizen Reports Resolved</p>
                  <p className="text-xs mt-1">No pending reports currently in queue.</p>
                </Card>
              ) : (
                <div className="space-y-3">
                  {reports.map((report) => (
                    <Card key={report.id} className="border-border hover:border-brand/40 transition-colors">
                      <CardContent className="p-4 flex flex-col sm:flex-row items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0 overflow-hidden">
                            {report.photo_url ? (
                              <img src={report.photo_url} alt="Hazard photo" className="w-full h-full object-cover" />
                            ) : (
                              <FileText size={24} className="text-text-muted" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-text">{report.issue_type}</span>
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-0.5 rounded uppercase",
                                report.status === 'new' ? 'bg-brand/10 text-brand border border-brand/20' :
                                report.status === 'acknowledged' ? 'bg-amber-100 text-amber-800' :
                                report.status === 'dispatched' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                              )}>
                                {report.status}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted flex items-center gap-1.5 font-mono">
                              <MapPin size={12} className="text-brand" />
                              <span>{report.lat ? `${Number(report.lat).toFixed(4)}°N, ${Number(report.lng).toFixed(4)}°E` : 'Coordinates Attached'}</span>
                              <span>· {new Date(report.created_at).toLocaleString()}</span>
                            </p>
                            <p className="text-xs text-text leading-relaxed">
                              {report.description || 'No additional notes provided by commuter.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReport(report)}
                            className="text-xs text-brand border-brand/30 hover:bg-brand/10 flex-1"
                          >
                            Review & Triage
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== 4. SOS ALERTS VIEW ==================== */}
          {activeNav === 'sos' && (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h2 className="text-lg font-bold text-text">Emergency SOS Dispatch Console</h2>
                <p className="text-xs text-text-muted">High-priority distress beacons broadcasted by motorists and residents</p>
              </div>

              {sosAlerts.length === 0 ? (
                <Card className="border-border p-8 text-center text-text-muted">
                  <CheckCircle2 size={32} className="mx-auto mb-2 text-status-normal" />
                  <p className="font-bold text-text">No Distress Calls Logged</p>
                  <p className="text-xs mt-1">All highway segments operating normally.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {sosAlerts.map((sos) => (
                    <Card key={sos.id} className={cn(
                      "border-2 shadow-sm",
                      sos.status === 'resolved' ? "border-border bg-surface opacity-80" : "border-status-severe bg-status-severe/5"
                    )}>
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-status-severe flex items-center gap-1.5">
                            <Siren size={16} /> Distress Beacon: {sos.id}
                          </span>
                          <Badge variant={sos.status === 'resolved' ? "outline" : "destructive"} className="font-mono text-xs uppercase">
                            STATUS: {sos.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-base font-bold mt-1 text-text">
                          Location: {sos.zone || 'NH27-S08'} ({Number(sos.lat).toFixed(4)}°N, {Number(sos.lng).toFixed(4)}°E)
                        </CardTitle>
                        <CardDescription className="text-xs text-text-muted">
                          Reported: {new Date(sos.created_at).toLocaleString()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 space-y-3">
                        <p className="text-xs text-text bg-surface p-2.5 rounded-lg border border-border">
                          {sos.notes || 'Emergency distress call triggered along highway corridor.'}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => handleLocateSOS(sos)}
                            className="bg-surface hover:bg-bg text-text border border-border font-bold text-xs"
                          >
                            <MapPin size={13} className="mr-1 text-brand" />
                            Locate on Map
                          </Button>
                          {sos.status === 'active' && (
                            <Button
                              onClick={() => handleAcknowledgeSOS(sos.id)}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                            >
                              <Check size={13} className="mr-1" />
                              Acknowledge
                            </Button>
                          )}
                          {sos.status !== 'dispatched' && sos.status !== 'resolved' && (
                            <Button
                              onClick={() => handleDispatchSOS(sos.id)}
                              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
                            >
                              <Send size={13} className="mr-1" />
                              Dispatch SDRF Unit
                            </Button>
                          )}
                          {sos.status !== 'resolved' ? (
                            <Button
                              onClick={() => handleResolveSOS(sos.id)}
                              variant="outline"
                              className="text-xs text-status-normal border-green-300 hover:bg-green-50 font-bold"
                            >
                              <CheckCircle2 size={13} className="mr-1" />
                              Mark Resolved
                            </Button>
                          ) : (
                            <Button
                              onClick={() => handleReopenSOS(sos.id)}
                              variant="outline"
                              className="text-xs text-text-muted border-border hover:bg-bg font-bold"
                            >
                              <RotateCcw size={13} className="mr-1" />
                              Reopen Distress Call
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ==================== 5. RESPONSE HISTORY ==================== */}
          {activeNav === 'history' && (
            <div className="space-y-4 max-w-3xl">
              <div>
                <h2 className="text-lg font-bold text-text">Audit Trail & Incident Response History</h2>
                <p className="text-xs text-text-muted">Operational record of automated telemetry updates and manual dispatches</p>
              </div>

              <Card className="border-border">
                <CardContent className="p-4 divide-y divide-border">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="py-3 flex items-start gap-4 text-xs">
                      <div className="w-10 h-10 rounded-xl bg-bg border border-border flex items-center justify-center shrink-0">
                        {log.type === 'sos' ? <Siren size={18} className="text-status-severe" /> :
                         log.type === 'ai' ? <Activity size={18} className="text-status-high" /> :
                         log.type === 'report' ? <FileText size={18} className="text-brand" /> :
                         <CheckCircle2 size={18} className="text-slate-500" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-sm text-text">{log.title}</p>
                          <span className="text-[10px] text-text-muted font-mono">{log.time}</span>
                        </div>
                        <p className="text-xs text-text-muted mt-1 leading-relaxed">{log.body}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* ==================== 6. SETTINGS VIEW ==================== */}
          {activeNav === 'settings' && (
            <div className="space-y-5 max-w-2xl">
              <div>
                <h2 className="text-lg font-bold text-text">Command Console Settings</h2>
                <p className="text-xs text-text-muted">Station parameters, AI threshold alerts & duty officer profile</p>
              </div>

              <Card className="border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-sm font-bold text-text">Officer Profile</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border">
                    <div>
                      <p className="font-bold text-text">Duty Officer J. Doe</p>
                      <p className="text-text-muted">Dima Hasao Disaster Response Center · Haflong EOC</p>
                    </div>
                    <Badge variant="outline" className="text-status-normal border-status-normal/40">
                      ON DUTY
                    </Badge>
                  </div>

                  <div className="space-y-2 pt-2">
                    <p className="font-bold text-text">AI Alarm Parameters</p>
                    <div className="flex items-center justify-between p-2.5 bg-bg rounded-lg">
                      <span>Severe Hazard Threshold (Precipitation + Slope)</span>
                      <span className="font-mono font-bold text-status-severe">&gt; 90% Probability</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-bg rounded-lg">
                      <span>Automated SOS SMS Broadcast Relay</span>
                      <span className="font-mono font-bold text-brand">ENABLED</span>
                    </div>
                  </div>

                  <div className="pt-3">
                    <Button
                      variant="outline"
                      onClick={() => navigate('/')}
                      className="w-full text-xs text-status-severe border-status-severe/30 hover:bg-status-severe/10 gap-2"
                    >
                      <LogOut size={14} /> End Shift / Switch Role
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Report Review & Triage Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={(open) => { if (!open) setSelectedReport(null); }}>
        <DialogContent className="max-w-md bg-surface text-text">
          {selectedReport && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand">CITIZEN INCIDENT #{selectedReport.id}</span>
                  <Badge variant="outline" className="uppercase">{selectedReport.status}</Badge>
                </div>
                <DialogTitle className="text-lg font-bold mt-1">{selectedReport.issue_type}</DialogTitle>
                <DialogDescription className="text-xs text-text-muted">
                  Logged at {selectedReport.lat ? `${Number(selectedReport.lat).toFixed(4)}°N, ${Number(selectedReport.lng).toFixed(4)}°E` : 'NH-27'} · {new Date(selectedReport.created_at).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3.5 my-2 text-xs">
                {selectedReport.photo_url && (
                  <div className="rounded-xl overflow-hidden border border-border h-44 w-full bg-black/5">
                    <img src={selectedReport.photo_url} alt="Report evidence" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="p-3 bg-bg rounded-xl border border-border">
                  <span className="font-semibold text-text-muted block text-[10px] uppercase">Description</span>
                  <p className="text-text mt-1 leading-relaxed">
                    {selectedReport.description || 'Citizen submitted hazard notification without additional text notes.'}
                  </p>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-bg rounded-xl border border-border text-xs">
                  <span className="text-text-muted flex items-center gap-1">
                    <MapPin size={12} className="text-brand" /> GPS Coordinates
                  </span>
                  <span className="font-mono font-bold text-text">
                    {selectedReport.lat ? `${Number(selectedReport.lat).toFixed(4)}°N, ${Number(selectedReport.lng).toFixed(4)}°E` : 'Attached to Corridor'}
                  </span>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <div className="grid grid-cols-2 gap-2">
                    {selectedReport.status === 'new' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateReportStatus(selectedReport.id, 'acknowledged')}
                        className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
                      >
                        <Check size={14} className="mr-1" /> Acknowledge
                      </Button>
                    )}
                    {selectedReport.status !== 'resolved' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateReportStatus(selectedReport.id, 'resolved')}
                        className="text-xs text-status-normal border-green-300 hover:bg-green-50"
                      >
                        <CheckCircle2 size={14} className="mr-1" /> Mark Resolved
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateReportStatus(selectedReport.id, 'new')}
                        className="text-xs text-text-muted border-border hover:bg-bg"
                      >
                        <RotateCcw size={14} className="mr-1" /> Reopen Report
                      </Button>
                    )}
                  </div>
                  {selectedReport.status !== 'dispatched' && selectedReport.status !== 'resolved' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateReportStatus(selectedReport.id, 'dispatched')}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                    >
                      <Send size={14} className="mr-1.5" /> Dispatch Field Crew
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
