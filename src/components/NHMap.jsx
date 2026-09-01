/**
 * NHMap — Interactive Leaflet Map for the Jatinga–Haflong NH-27 Corridor.
 *
 * Layers:
 *   Layer 1: Real NH-27 highway LineString geometry (road casing & highway line).
 *   Layer 2: 25 Risk Zone markers loaded dynamically from Supabase `risk_zones`.
 *   Layer 3: Citizen Reports (distinct report pins on map).
 *   Layer 4: Active SOS Alerts (distinct high-priority emergency beacon).
 *
 * Marker styles:
 *   - Normal: Green solid marker, no animation.
 *   - Medium: Yellow marker with subtle translucent halo.
 *   - High: Orange marker with subtle slow pulse.
 *   - Severe: Red marker with professional warning halo & pulse.
 */
import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { NH27_CORRIDOR_GEOJSON } from '@/lib/corridorGeoJson'
import ZoneDrawer from '@/components/ZoneDrawer'
import { cn } from '@/lib/utils'
import { Locate, ZoomIn, ZoomOut } from 'lucide-react'

const TIER_COLORS = {
  Normal: { bg: '#22C55E', border: '#15803D', halo: 'rgba(34, 197, 94, 0.15)' },
  Medium: { bg: '#F59E0B', border: '#B45309', halo: 'rgba(245, 158, 11, 0.25)' },
  High:   { bg: '#F97316', border: '#C2410C', halo: 'rgba(249, 115, 22, 0.35)' },
  Severe: { bg: '#DC2626', border: '#991B1B', halo: 'rgba(220, 38, 38, 0.45)' },
}

function getTierStyle(tier) {
  return TIER_COLORS[tier] || TIER_COLORS.Normal
}

function createRiskIcon(zone, isSelected = false) {
  const style = getTierStyle(zone.risk_tier)
  const isSevere = zone.risk_tier === 'Severe'
  const isHigh = zone.risk_tier === 'High'
  const isMedium = zone.risk_tier === 'Medium'

  let pulseClass = ''
  if (isSevere) pulseClass = 'marker-severe-pulse'
  else if (isHigh) pulseClass = 'marker-high-pulse'

  const size = isSelected ? 32 : 24
  const radius = isSelected ? 8.5 : 6
  const haloRadius = isSelected ? 14 : 10

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <!-- Outer Halo / Pulse Ring -->
      ${(isSevere || isHigh || isMedium || isSelected) ? `
        <circle 
          cx="${size/2}" 
          cy="${size/2}" 
          r="${haloRadius}" 
          fill="${isSelected ? 'rgba(15, 118, 110, 0.35)' : style.halo}" 
          class="${pulseClass}"
        />
      ` : ''}
      
      <!-- Base Outer Border -->
      <circle 
        cx="${size/2}" 
        cy="${size/2}" 
        r="${radius + 1.5}" 
        fill="#FFFFFF" 
        stroke="${isSelected ? '#0F766E' : style.border}" 
        stroke-width="${isSelected ? '2.5' : '1.5'}"
      />
      
      <!-- Core Risk Marker -->
      <circle 
        cx="${size/2}" 
        cy="${size/2}" 
        r="${radius}" 
        fill="${style.bg}"
      />
      
      <!-- Center High-Contrast Dot -->
      <circle 
        cx="${size/2}" 
        cy="${size/2}" 
        r="${radius * 0.38}" 
        fill="#FFFFFF"
      />
    </svg>
  `

  return L.divIcon({
    html: `<div class="cursor-pointer transition-transform hover:scale-125">${svg}</div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  })
}

function createReportIcon(report) {
  const isResolved = report.status === 'resolved'
  const bg = isResolved ? '#15803D' : '#D97706'
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 22 26">
      <path d="M11 0C4.92 0 0 4.92 0 11c0 7.7 11 15 11 15s11-7.3 11-15C22 4.92 17.08 0 11 0z" fill="${bg}" stroke="#FFFFFF" stroke-width="1.5"/>
      <circle cx="11" cy="10" r="4" fill="#FFFFFF"/>
    </svg>
  `
  return L.divIcon({
    html: `<div class="cursor-pointer hover:scale-125 transition-transform" title="Report: ${report.issue_type}">${svg}</div>`,
    className: '',
    iconSize: [22, 26],
    iconAnchor: [11, 26],
    popupAnchor: [0, -26],
  })
}

function createSosIcon(sos) {
  const isResolved = sos.status === 'resolved'
  if (isResolved) {
    return L.divIcon({
      html: `<div class="w-4 h-4 rounded-full bg-slate-600 border-2 border-white shadow-sm"></div>`,
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    })
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
      <circle cx="17" cy="17" r="16" fill="rgba(220, 38, 38, 0.3)" class="marker-severe-pulse"/>
      <circle cx="17" cy="17" r="10" fill="#DC2626" stroke="#FFFFFF" stroke-width="2"/>
      <polygon points="17,11 22,21 12,21" fill="#FFFFFF"/>
    </svg>
  `
  return L.divIcon({
    html: `<div class="cursor-pointer transition-transform hover:scale-125" title="EMERGENCY SOS: ${sos.id}">${svg}</div>`,
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  })
}

// Corridor center between Jatinga and Haflong
const CORRIDOR_CENTER = [25.215, 93.005]
const DEFAULT_ZOOM = 12

export default function NHMap({
  zones = [],
  reports = [],
  sosAlerts = [],
  selectedZone = null,
  onSelect = null,
  onSelectReport = null,
  onSelectSos = null,
  compact = false,
  className = '',
  showDrawer = true,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({})
  const reportMarkersRef = useRef({})
  const sosMarkersRef = useRef({})
  const highwayLayerRef = useRef(null)
  // A selected zone can show one detail surface at a time: none, summary, or analysis.
  const [detailView, setDetailView] = React.useState(null)

  const onSelectRef = useRef(onSelect)
  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // Selecting a zone always starts at its summary. Clearing it restores the map.
  useEffect(() => {
    setDetailView(selectedZone ? 'zone' : null)
  }, [selectedZone?.segment_id])

  const handleCloseDetail = () => {
    setDetailView(null)
    onSelect?.(null)
  }

  // Initialize Map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return

    const map = L.map(containerRef.current, {
      center: CORRIDOR_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: true,
      maxBounds: [
        [24.95, 92.80],
        [25.45, 93.20],
      ],
      minZoom: 10,
      maxZoom: 18,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(map)

    // Layer 1: Real NH-27 Corridor Geometry (Road Casing + Highway Line)
    const highwayCasing = L.geoJSON(NH27_CORRIDOR_GEOJSON, {
      style: {
        color: '#FFFFFF',
        weight: 6,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
      },
    }).addTo(map)

    const highwayCore = L.geoJSON(NH27_CORRIDOR_GEOJSON, {
      style: {
        color: '#0F766E',
        weight: 3.5,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      },
    }).addTo(map)

    // Clicking map background deselects active zone
    map.on('click', () => {
      onSelectRef.current?.(null)
    })

    highwayLayerRef.current = { casing: highwayCasing, core: highwayCore }
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Layer 2: Render & update risk markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    if (!zones || zones.length === 0) return

    zones.forEach(zone => {
      const isSelected = selectedZone?.segment_id === zone.segment_id
      const marker = L.marker([Number(zone.lat), Number(zone.lng)], {
        icon: createRiskIcon(zone, isSelected),
        zIndexOffset: isSelected ? 1000 : (zone.risk_tier === 'Severe' ? 500 : 100),
      }).addTo(map)

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelect?.(zone)
      })

      markersRef.current[zone.segment_id] = marker
    })
  }, [zones, selectedZone, onSelect])

  // Layer 3: Render Citizen Reports Markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    Object.values(reportMarkersRef.current).forEach(m => m.remove())
    reportMarkersRef.current = {}

    if (!reports || reports.length === 0) return

    reports.forEach(report => {
      if (!report.lat || !report.lng) return
      const marker = L.marker([Number(report.lat), Number(report.lng)], {
        icon: createReportIcon(report),
        zIndexOffset: 300,
      }).addTo(map)

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelectReport?.(report)
      })

      reportMarkersRef.current[report.id] = marker
    })
  }, [reports, onSelectReport])

  // Layer 4: Render SOS Alert Markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    Object.values(sosMarkersRef.current).forEach(m => m.remove())
    sosMarkersRef.current = {}

    if (!sosAlerts || sosAlerts.length === 0) return

    sosAlerts.forEach(sos => {
      if (!sos.lat || !sos.lng) return
      const marker = L.marker([Number(sos.lat), Number(sos.lng)], {
        icon: createSosIcon(sos),
        zIndexOffset: 999,
      }).addTo(map)

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        onSelectSos?.(sos)
      })

      sosMarkersRef.current[sos.id] = marker
    })
  }, [sosAlerts, onSelectSos])

  // Center on selected zone when selected
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedZone) return

    map.flyTo([Number(selectedZone.lat), Number(selectedZone.lng)], 14, {
      duration: 0.8,
      easeLinearity: 0.25,
    })
  }, [selectedZone])

  const handleRecenter = () => {
    if (!mapRef.current) return
    mapRef.current.flyTo(CORRIDOR_CENTER, DEFAULT_ZOOM, { duration: 0.8 })
  }

  const handleZoomIn = () => mapRef.current?.zoomIn()
  const handleZoomOut = () => mapRef.current?.zoomOut()

  return (
    <div className={cn("relative rounded-xl overflow-hidden border border-border w-full bg-slate-100", className)}>
      {/* Map Container */}
      <div 
        ref={containerRef} 
        style={{ height: compact ? '240px' : '420px', width: '100%' }}
        className="z-0"
      />

      {/* Floating Header Badges */}
      <div className="absolute top-3 left-3 z-[999] flex items-center gap-2 pointer-events-none">
        <div className="bg-surface/90 backdrop-blur-md px-3 py-1 rounded-full border border-border shadow-sm flex items-center gap-1.5 text-xs font-semibold text-text">
          <span className="w-2 h-2 rounded-full bg-brand" />
          <span>NH-27 Corridor</span>
          <span className="text-[10px] text-text-muted font-mono font-normal">Jatinga–Haflong</span>
        </div>
      </div>

      {/* Top Right Map Control Buttons */}
      <div className="absolute top-3 right-3 z-[999] flex flex-col gap-1.5">
        <button
          onClick={handleRecenter}
          aria-label="Recenter Corridor Map"
          title="Recenter Highway Corridor"
          className="w-8 h-8 rounded-lg bg-surface/95 backdrop-blur-md border border-border shadow-sm flex items-center justify-center text-text hover:text-brand hover:bg-surface transition-all active:scale-95"
        >
          <Locate size={15} />
        </button>
        <button
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className="w-8 h-8 rounded-lg bg-surface/95 backdrop-blur-md border border-border shadow-sm flex items-center justify-center text-text hover:text-brand hover:bg-surface transition-all active:scale-95"
        >
          <ZoomIn size={15} />
        </button>
        <button
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className="w-8 h-8 rounded-lg bg-surface/95 backdrop-blur-md border border-border shadow-sm flex items-center justify-center text-text hover:text-brand hover:bg-surface transition-all active:scale-95"
        >
          <ZoomOut size={15} />
        </button>
      </div>

      {/* Floating Risk Legend (Stitch Style Pill) */}
      {!selectedZone && (
        <div className="absolute bottom-3 left-3 z-[999] bg-surface/90 backdrop-blur-md rounded-full px-3 py-1.5 border border-border shadow-sm flex items-center gap-3 text-[11px] font-medium text-text">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-status-normal shadow-sm" />
            <span className="text-text-muted">Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-status-medium shadow-sm" />
            <span className="text-text-muted">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-status-high shadow-sm" />
            <span className="text-text-muted">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-status-severe shadow-sm" />
            <span className="text-status-severe font-semibold">Severe</span>
          </div>
        </div>
      )}

      {/* Interactive Zone Drawer Overlay */}
      {showDrawer && selectedZone && (
        <ZoneDrawer 
          zone={selectedZone} 
          detailView={detailView}
          onOpenAnalysis={() => setDetailView('analysis')}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}
