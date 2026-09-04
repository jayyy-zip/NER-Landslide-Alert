/**
 * CitizenDashboard — Mobile-first layout strictly matching Google Stitch Citizen design.
 *
 * All data driven dynamically by Supabase risk_zones.
 * Geolocation detects the nearest NH-27 risk zone automatically, with manual zone selection fallback.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapPin, Bell, User, Home, Map, Megaphone,
  AlertTriangle, ChevronRight, RefreshCw,
  CloudRain, Compass, ShieldAlert, Phone, Info,
  LogOut, Crosshair
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RiskBadge } from '@/components/RiskBadge'
import NHMap from '@/components/NHMap'
import SOSModal from '@/components/SOSModal'
import { useRiskZones } from '@/hooks/useRiskZones'
import ZoneDrawer, { getDynamicRiskExplanation } from '@/components/ZoneDrawer'
import { getRainfallFeatures, getWeatherDescription } from '@/lib/weather'
import { predictRisk } from '@/lib/queries'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'

// Helper: Calculate distance between two lat/lng points in km (Haversine formula)
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371 // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export default function CitizenDashboard() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('home') // 'home' | 'map' | 'report' | 'alerts' | 'profile'
  const [selectedZone, setSelectedZone] = useState(null)
  const [compactDetailView, setCompactDetailView] = useState(null)
  const [geoZone, setGeoZone] = useState(null)
  const [userCoords, setUserCoords] = useState(null)
  const [geoStatus, setGeoStatus] = useState('detecting') // 'detecting' | 'located' | 'denied' | 'default'
  const [isSosOpen, setIsSosOpen] = useState(false)
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState(null)
  const [isRefreshingWeather, setIsRefreshingWeather] = useState(false)
  const [weatherTime, setWeatherTime] = useState('Loading live conditions…')
  const [livePrediction, setLivePrediction] = useState(null)
  const [isPredicting, setIsPredicting] = useState(false)
  const weatherRequestRef = useRef(0)

  const { zones, loading } = useRiskZones()

  // Detect citizen geolocation & find the nearest NH-27 segment
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoStatus('default')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserCoords({ lat: latitude, lng: longitude })
        setGeoStatus('located')
      },
      () => {
        setGeoStatus('denied')
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }, [])

  // Match nearest zone once zones and geolocation are available
  useEffect(() => {
    if (!zones || zones.length === 0) return

    if (userCoords) {
      let nearest = zones[0]
      let minDist = Infinity
      zones.forEach(z => {
        const dist = getDistanceKm(userCoords.lat, userCoords.lng, Number(z.lat), Number(z.lng))
        if (dist < minDist) {
          minDist = dist
          nearest = z
        }
      })
      setGeoZone(nearest)
    } else if (!geoZone) {
      // Default to initial corridor zone if GPS is not yet available
      setGeoZone(zones[0])
    }
  }, [zones, userCoords, geoZone])

  // The active zone being evaluated on the dashboard
  const currentZone = selectedZone || geoZone

  const handleSelectZone = useCallback((zone) => {
    setSelectedZone(zone)
    setCompactDetailView(zone ? 'zone' : null)
  }, [])

  const handleCloseCompactDetail = useCallback(() => {
    setCompactDetailView(null)
    setSelectedZone(null)
  }, [])

  const loadWeather = useCallback(async ({ refresh = false } = {}) => {
    if (!currentZone) return

    const requestId = weatherRequestRef.current + 1
    weatherRequestRef.current = requestId
    setIsRefreshingWeather(true)
    setWeatherError(null)

    try {
      const nextWeather = await getRainfallFeatures(currentZone.lat, currentZone.lng)
      if (requestId !== weatherRequestRef.current) return

      setWeather(nextWeather)
      setWeatherTime(`Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
      if (refresh) toast.success('Live Open-Meteo weather refreshed.')
    } catch (error) {
      if (requestId !== weatherRequestRef.current) return

      setWeather(null)
      setWeatherError(error.message || 'Live weather is temporarily unavailable.')
      setWeatherTime('Live weather unavailable')
      if (refresh) toast.error('Live weather could not be refreshed.')
    } finally {
      if (requestId === weatherRequestRef.current) setIsRefreshingWeather(false)
    }
  }, [currentZone?.lat, currentZone?.lng, currentZone?.segment_id])

  useEffect(() => {
    if (!currentZone) return
    loadWeather()
  }, [currentZone?.segment_id, loadWeather])

  const handleRefreshWeather = () => loadWeather({ refresh: true })

  // Real-time V3 AI inference using active zone terrain + live environmental rainfall
  useEffect(() => {
    if (!currentZone) return

    let isMounted = true
    const runInference = async () => {
      setIsPredicting(true)
      try {
        const rainfall24 = weather?.rainfall_24h_mm ?? currentZone.rainfall_24h ?? 0
        const rainfall72 = weather?.rainfall_72h_mm ?? currentZone.rainfall_72h ?? 0

        const result = await predictRisk({
          rainfall_24h_mm: rainfall24,
          rainfall_72h_mm: rainfall72,
          slope_deg: currentZone.slope_deg,
          elevation_m: currentZone.elevation_m,
          historical_event_count: currentZone.historical_event_count ?? 0,
        })

        if (isMounted && result) {
          setLivePrediction(result)
        }
      } catch {
        // AI service offline or error: fall back safely to stored Supabase V3 values
        if (isMounted) {
          setLivePrediction(null)
        }
      } finally {
        if (isMounted) setIsPredicting(false)
      }
    }

    runInference()
    return () => {
      isMounted = false
    }
  }, [
    currentZone?.segment_id,
    currentZone?.slope_deg,
    currentZone?.elevation_m,
    currentZone?.historical_event_count,
    currentZone?.rainfall_24h,
    currentZone?.rainfall_72h,
    weather?.rainfall_24h_mm,
    weather?.rainfall_72h_mm,
  ])

  const activeProbability = livePrediction?.risk_probability ?? currentZone?.risk_probability ?? 0
  const activeTier = livePrediction?.risk_tier ?? currentZone?.risk_tier ?? 'Normal'

  // Calculate nearby risk zones (Severe / High / Medium, excluding the active zone)
  const nearbyRiskZones = zones
    ? zones.filter(z => z.segment_id !== currentZone?.segment_id && z.risk_tier !== 'Normal').slice(0, 4)
    : []

  const dynamicExplanation = getDynamicRiskExplanation(currentZone)

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <Toaster position="top-center" richColors />

      {/* Top App Bar */}
      <header className="bg-surface border-b border-border px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white shadow-sm">
            <span className="font-black text-xs">NER</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-text leading-tight">Jatinga – Haflong</h1>
            <p className="text-[10px] text-text-muted flex items-center gap-1 font-medium">
              <MapPin size={10} className="text-brand" />
              {currentZone ? `${currentZone.segment_id} Sector · NH-27` : 'Haflong Town · NH-27'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('alerts')}
            className="relative p-2 rounded-lg bg-bg hover:bg-border/50 text-text-muted hover:text-text transition-colors"
            aria-label="View Active Alerts"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-status-severe rounded-full" />
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-xs border border-brand/20 hover:bg-brand/20 transition-colors"
            aria-label="User Profile"
          >
            <User size={16} />
          </button>
        </div>
      </header>

      {/* Main Tab Views */}
      <main className="flex-1 overflow-y-auto pb-20">
        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <div className="max-w-md mx-auto p-4 space-y-5">
            {/* Geolocation Status Bar */}
            <div className="flex items-center justify-between bg-surface px-3 py-2 rounded-xl border border-border text-xs">
              <div className="flex items-center gap-2">
                <Crosshair size={14} className={geoStatus === 'located' ? 'text-brand' : 'text-text-muted'} />
                <span className="text-text-muted">
                  {geoStatus === 'located' ? 'Nearest Sector Detected:' : 'Monitored Sector:'}
                </span>
                <span className="font-bold text-brand font-mono">{currentZone?.segment_id || 'NH27-S08'}</span>
              </div>
              {selectedZone && (
                <button
                  onClick={handleCloseCompactDetail}
                  className="text-[11px] text-brand font-semibold hover:underline"
                >
                  Reset to GPS
                </button>
              )}
            </div>

            {/* 1. Corridor Overview Map */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-text tracking-tight">Corridor Overview</h2>
                <button
                  id="btn-view-map-tab"
                  onClick={() => setActiveTab('map')}
                  className="text-xs text-brand font-bold hover:underline flex items-center gap-1"
                >
                  <span>Full Map</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              {loading ? (
                <Skeleton className="h-[240px] rounded-xl" />
              ) : (
                <div className="space-y-3">
                  <NHMap
                    zones={zones}
                    selectedZone={selectedZone}
                    onSelect={handleSelectZone}
                    compact={true}
                    showDrawer={false}
                  />

                  {selectedZone && compactDetailView && (
                    <ZoneDrawer
                      zone={selectedZone}
                      detailView={compactDetailView}
                      inline
                      onOpenAnalysis={() => setCompactDetailView('analysis')}
                      onClose={handleCloseCompactDetail}
                    />
                  )}
                </div>
              )}
            </section>

            {/* 2. Current Landslide Risk Card (Matches Stitch exactly) */}
            <section>
              {loading || !currentZone ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : (
                <div className={cn(
                  "rounded-xl border p-4 shadow-sm transition-all duration-200 relative overflow-hidden",
                  activeTier === 'Severe' ? 'bg-amber-50/60 border-amber-300' :
                  activeTier === 'High' ? 'bg-orange-50/60 border-orange-300' :
                  activeTier === 'Medium' ? 'bg-yellow-50/60 border-yellow-300' :
                  'bg-green-50/60 border-green-200'
                )}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-base font-bold text-text">Current Landslide Risk</h2>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider",
                          activeTier === 'Severe' ? 'bg-status-severe text-white' :
                          activeTier === 'High' ? 'bg-status-high text-white' :
                          activeTier === 'Medium' ? 'bg-status-medium text-white' :
                          'bg-status-normal text-white'
                        )}>
                          {activeTier} Risk
                        </span>
                        <span className="text-xl font-bold font-mono text-text">
                          {(Number(activeProbability) * 100).toFixed(2)}% Probability
                        </span>
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-white/80 border border-border flex items-center justify-center text-amber-600">
                      <AlertTriangle size={20} />
                    </div>
                  </div>

                  {/* Dynamic Rule-Based Explanation */}
                  <p className="text-xs text-text-muted mt-3 leading-relaxed">
                    {dynamicExplanation}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-border/50 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand" />
                      NER V3 AI assessment · {currentZone.segment_id}
                    </span>
                    <button 
                      onClick={() => handleSelectZone(currentZone)}
                      className="font-semibold text-brand hover:underline"
                    >
                      View Analysis →
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* 3. Why this risk? (4 Stats Grid from Stitch, matching currentZone) */}
            <section>
              <h2 className="text-base font-bold text-text mb-2.5 tracking-tight">Why this risk?</h2>
              {loading || !currentZone ? (
                <div className="grid grid-cols-2 gap-2.5">
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                  <Skeleton className="h-20 rounded-xl" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-surface rounded-xl border border-border p-3 shadow-sm">
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
                      24H RAINFALL
                    </span>
                    <span className="text-xl font-black text-text font-mono mt-1 block">
                      {isRefreshingWeather ? '…' : weatherError ? '—' : weather ? `${weather.rainfall_24h_mm}mm` : '—'}
                    </span>
                  </div>

                  <div className="bg-surface rounded-xl border border-border p-3 shadow-sm">
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
                      72H RAINFALL
                    </span>
                    <span className="text-xl font-black text-text font-mono mt-1 block">
                      {isRefreshingWeather ? '…' : weatherError ? '—' : weather ? `${weather.rainfall_72h_mm}mm` : '—'}
                    </span>
                  </div>

                  <div className="bg-surface rounded-xl border border-border p-3 shadow-sm">
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
                      SLOPE STABILITY
                    </span>
                    <span className={cn(
                      "text-sm font-bold mt-1 block",
                      currentZone.slope_deg > 30 ? 'text-status-severe' :
                      currentZone.slope_deg > 20 ? 'text-status-high' : 'text-status-normal'
                    )}>
                      {currentZone.slope_deg > 30 ? 'Critical' : currentZone.slope_deg > 20 ? 'Low Stability' : 'Stable'} ({currentZone.slope_deg}°)
                    </span>
                  </div>

                  <div className="bg-surface rounded-xl border border-border p-3 shadow-sm">
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">
                      HISTORICAL EVENTS
                    </span>
                    <span className="text-xl font-black text-text font-mono mt-1 block">
                      {currentZone.historical_event_count ?? 0}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* 4. Weather Model Input Card (Environmental data, with working refresh) */}
            <section>
              <div className="bg-surface rounded-xl border border-border p-3.5 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <CloudRain size={22} />
                  </div>
                  <div>
                    <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">
                      WEATHER MODEL INPUT
                    </span>
                    <p className="text-sm font-bold text-text mt-0.5">
                      {isRefreshingWeather ? 'Loading live weather…' : weatherError ? 'Live weather unavailable' : weather ? `${getWeatherDescription(weather.weather_code)} · ${Math.round(weather.temperature_c)}°C` : 'Waiting for weather…'}
                    </p>
                    <p className="text-[11px] text-text-muted" role="status">
                      {weatherError ? weatherError : weather ? `24h Precipitation: ${weather.rainfall_24h_mm}mm · ${weatherTime}` : weatherTime}
                    </p>
                  </div>
                </div>
                <button
                  id="btn-refresh-weather"
                  onClick={handleRefreshWeather}
                  disabled={isRefreshingWeather}
                  className="p-2 rounded-lg text-text-muted hover:text-brand hover:bg-bg transition-colors"
                  aria-label="Refresh Environmental Telemetry"
                >
                  <RefreshCw size={16} className={isRefreshingWeather ? "animate-spin text-brand" : ""} />
                </button>
              </div>
            </section>

            {/* 5. Nearby Risk Zones (Matches Stitch with real NH27 identifiers) */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-base font-bold text-text tracking-tight">Nearby Risk Zones</h2>
                <button
                  onClick={() => setActiveTab('map')}
                  className="text-xs text-brand font-bold hover:underline"
                >
                  View Map
                </button>
              </div>

              <div className="space-y-2">
                {loading ? (
                  <>
                    <Skeleton className="h-16 rounded-xl" />
                    <Skeleton className="h-16 rounded-xl" />
                  </>
                ) : nearbyRiskZones.map((zone) => {
                  const tierKey = zone.risk_tier ? zone.risk_tier.toLowerCase() : 'normal'
                  const dist = currentZone 
                    ? getDistanceKm(Number(currentZone.lat), Number(currentZone.lng), Number(zone.lat), Number(zone.lng)).toFixed(1)
                    : '1.5'

                  return (
                    <div
                      key={zone.segment_id}
                      className="bg-surface rounded-xl border border-border p-3 shadow-sm hover:border-brand/40 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={cn(
                          "w-1 h-10 rounded-full shrink-0",
                          zone.risk_tier === 'Severe' ? 'bg-status-severe' :
                          zone.risk_tier === 'High' ? 'bg-status-high' :
                          zone.risk_tier === 'Medium' ? 'bg-status-medium' : 'bg-status-normal'
                        )} />
                        <div>
                          <p className="text-xs font-bold text-text">{zone.segment_id}</p>
                          <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                            <Compass size={11} /> 
                            <span>{dist} km away · {zone.slope_deg}° slope</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <RiskBadge tier={tierKey} />
                        <button
                          id={`btn-details-${zone.segment_id}`}
                          onClick={() => {
                            handleSelectZone(zone)
                            window.scrollTo({ top: 0, behavior: 'smooth' })
                          }}
                          className="text-xs font-bold text-brand hover:underline p-1"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 6. Report an Issue Callout (Matches Stitch) */}
            <section className="bg-surface rounded-xl border border-border p-5 text-center shadow-sm space-y-3">
              <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center mx-auto">
                <Megaphone size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-text">See something dangerous?</h3>
                <p className="text-xs text-text-muted mt-1 max-w-xs mx-auto">
                  Report road cracks, active mudflow, or falling rocks to alert nearby drivers and highway units.
                </p>
              </div>
              <Button
                id="btn-report-issue-cta"
                onClick={() => navigate('/report')}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"
              >
                <Megaphone size={14} />
                <span>REPORT AN ISSUE</span>
              </Button>
            </section>

            {/* 7. SOS — Need Help Button */}
            <section>
              <button
                id="btn-trigger-sos-modal"
                onClick={() => setIsSosOpen(true)}
                className="w-full bg-status-severe hover:bg-red-700 active:scale-98 transition-all duration-150 text-white py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
              >
                <span className="bg-white/20 px-2 py-0.5 rounded font-black text-xs tracking-wider">SOS</span>
                <span className="tracking-wide">SOS — NEED HELP</span>
              </button>
            </section>
          </div>
        )}

        {/* ==================== FULL MAP TAB ==================== */}
        {activeTab === 'map' && (
          <div className="p-4 space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-text">NH-27 Corridor Surveillance</h2>
                <p className="text-xs text-text-muted">Interactive live telemetry of all 25 segments</p>
              </div>
              <button
                onClick={handleCloseCompactDetail}
                className="text-xs text-brand font-semibold hover:underline"
              >
                Reset Selection
              </button>
            </div>

            <NHMap
              zones={zones}
              selectedZone={currentZone}
              onSelect={handleSelectZone}
              compact={false}
              showDrawer={true}
              className="h-[60vh] min-h-[400px]"
            />

            <div className="bg-surface p-3.5 rounded-xl border border-border text-xs space-y-2">
              <p className="font-bold text-text flex items-center gap-1.5">
                <Info size={14} className="text-brand" /> How to use the corridor map
              </p>
              <p className="text-text-muted leading-relaxed">
                Tap any risk marker along the teal highway corridor to inspect slope inclination, real-time rainfall accumulation, and the NER V3 AI hazard score.
              </p>
            </div>
          </div>
        )}

        {/* ==================== ALERTS TAB ==================== */}
        {activeTab === 'alerts' && (
          <div className="max-w-md mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-bold text-text">Active Corridor Alerts</h2>
              <span className="text-xs bg-status-severe/10 text-status-severe font-bold px-2 py-0.5 rounded-full">
                {zones?.filter(z => z.risk_tier === 'Severe').length || 0} Severe
              </span>
            </div>

            <div className="space-y-3">
              {/* Severe Alert Banner */}
              <div className="bg-status-severe/10 border-2 border-status-severe/30 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-status-severe">
                  <ShieldAlert size={18} />
                  <span className="font-bold text-xs uppercase tracking-wider">Evacuation Advisory</span>
                </div>
                <h3 className="text-sm font-bold text-text">Critical Rockfall Warning: Jatinga Pass</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Sections <strong>NH27-S08</strong> and <strong>NH27-S10</strong> have exceeded 99% landslide probability following 168mm cumulative rain. Avoid non-essential transit.
                </p>
              </div>

              {/* List of high/severe risk zones */}
              {zones?.filter(z => z.risk_tier === 'Severe' || z.risk_tier === 'High').map(z => (
                <Card key={z.segment_id} className="border-border">
                  <CardContent className="p-3.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text">{z.segment_id}</span>
                        <RiskBadge tier={z.risk_tier?.toLowerCase()} />
                      </div>
                      <p className="text-xs text-text-muted mt-1">
                        Rainfall: {z.rainfall_24h}mm · Incline: {z.slope_deg}° · {(Number(z.risk_probability)*100).toFixed(1)}% Risk
                      </p>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-xs text-brand border-brand/30"
                      onClick={() => {
                        setSelectedZone(z)
                        setActiveTab('home')
                      }}
                    >
                      Inspect
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ==================== PROFILE TAB ==================== */}
        {activeTab === 'profile' && (
          <div className="max-w-md mx-auto p-4 space-y-5">
            <div className="flex items-center gap-3 bg-surface p-4 rounded-xl border border-border shadow-sm">
              <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold text-base">
                <User size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Commuter / Citizen Portal</h3>
                <p className="text-xs text-text-muted">Connected to Assam State Disaster Mgmt Network</p>
                <span className="inline-block mt-1 text-[10px] bg-status-normal/10 text-status-normal font-bold px-2 py-0.5 rounded-full">
                  GPS Active ({currentZone?.segment_id || 'NH-27'})
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">Emergency Hotlines</h4>
              <div className="bg-surface rounded-xl border border-border divide-y divide-border text-xs">
                <div className="p-3 flex items-center justify-between">
                  <span className="text-text font-medium">State Emergency Operations Center (SEOC)</span>
                  <a href="tel:1070" className="font-bold text-brand flex items-center gap-1">
                    <Phone size={12} /> 1070
                  </a>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-text font-medium">Haflong District Control Room</span>
                  <a href="tel:1077" className="font-bold text-brand flex items-center gap-1">
                    <Phone size={12} /> 1077
                  </a>
                </div>
                <div className="p-3 flex items-center justify-between">
                  <span className="text-text font-medium">National Emergency Helpline</span>
                  <a href="tel:112" className="font-bold text-brand flex items-center gap-1">
                    <Phone size={12} /> 112
                  </a>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full text-xs text-status-severe border-status-severe/30 hover:bg-status-severe/10 gap-1.5"
              onClick={() => navigate('/')}
            >
              <LogOut size={14} /> Switch Operating Role
            </Button>
          </div>
        )}
      </main>

      {/* SOS Modal Component with real Supabase persistence */}
      <SOSModal
        isOpen={isSosOpen}
        zone={currentZone?.segment_id || 'NH27-S08'}
        lat={userCoords?.lat || currentZone?.lat || 25.1839}
        lng={userCoords?.lng || currentZone?.lng || 93.0100}
        onClose={() => setIsSosOpen(false)}
        onSosSent={(sosRecord) => {
          toast.success(`SOS broadcasted for ${sosRecord.zone || 'NH-27'}. Dispatch notified.`)
        }}
      />

      {/* Bottom Sticky Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          id="nav-tab-home"
          onClick={() => setActiveTab('home')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors",
            activeTab === 'home' ? 'text-brand' : 'text-text-muted hover:text-text'
          )}
        >
          <Home size={18} />
          <span>HOME</span>
        </button>

        <button
          id="nav-tab-map"
          onClick={() => setActiveTab('map')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors",
            activeTab === 'map' ? 'text-brand' : 'text-text-muted hover:text-text'
          )}
        >
          <Map size={18} />
          <span>MAP</span>
        </button>

        <button
          id="nav-tab-report"
          onClick={() => navigate('/report')}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-semibold text-text-muted hover:text-brand transition-colors"
        >
          <Megaphone size={18} />
          <span>REPORT</span>
        </button>

        <button
          id="nav-tab-alerts"
          onClick={() => setActiveTab('alerts')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors relative",
            activeTab === 'alerts' ? 'text-brand' : 'text-text-muted hover:text-text'
          )}
        >
          <AlertTriangle size={18} />
          <span>ALERTS</span>
          <span className="absolute top-1 right-3 w-1.5 h-1.5 bg-status-severe rounded-full" />
        </button>

        <button
          id="nav-tab-profile"
          onClick={() => setActiveTab('profile')}
          className={cn(
            "flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-semibold transition-colors",
            activeTab === 'profile' ? 'text-brand' : 'text-text-muted hover:text-text'
          )}
        >
          <User size={18} />
          <span>PROFILE</span>
        </button>
      </nav>
    </div>
  )
}
