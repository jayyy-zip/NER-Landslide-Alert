/**
 * useRiskZones — fetches risk_zones from Supabase once and caches in state.
 * Shared by both dashboards so they don't independently fetch the same data.
 */
import { useState, useEffect } from 'react'
import { fetchRiskZones } from '@/lib/queries'
import { alignRiskZonesToCorridor } from '@/lib/corridorGeoJson'

export function useRiskZones() {
  const [zones, setZones]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchRiskZones()
      .then(data => { if (!cancelled) { setZones(alignRiskZonesToCorridor(data)); setLoading(false) } })
      .catch(err  => { if (!cancelled) { setError(err.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  return { zones, loading, error }
}
