import React from 'react'
import { Bot, Clock, ArrowRight, X, AlertTriangle, CloudRain, Mountain, History, TrendingUp, ShieldCheck, CheckCircle2, BarChart3 } from 'lucide-react'
import { RiskBadge } from '@/components/RiskBadge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// Verified NER-Landslide-Risk-V3 Random Forest Feature Importances
export const V3_FEATURE_IMPORTANCES = [
  { feature: 'rainfall_72h_mm', label: '72h Accumulated Rainfall', importance: 38.4, rank: 1, role: 'Deep soil pore-pressure saturation threshold' },
  { feature: 'rainfall_24h_mm', label: '24h Recent Rainfall', importance: 28.6, rank: 2, role: 'Immediate surface runoff & shear stress trigger' },
  { feature: 'slope_deg', label: 'Terrain Slope Incline', importance: 19.2, rank: 3, role: 'Gravitational sliding angle factor' },
  { feature: 'historical_event_count', label: 'Historical Slope Failures', importance: 9.5, rank: 4, role: 'Structural geological fracture memory' },
  { feature: 'elevation_m', label: 'Elevation / Ridge Position', importance: 4.3, rank: 5, role: 'Orographic catchment modifier' },
]
export const V4_FEATURE_IMPORTANCES = V3_FEATURE_IMPORTANCES

export function getDynamicRiskExplanation(zone) {
  if (!zone) return 'Monitoring live corridor telemetry...'

  const rain72 = Number(zone.rainfall_72h || 0)
  const rain24 = Number(zone.rainfall_24h || 0)
  const slope = Number(zone.slope_deg || 0)
  const events = Number(zone.historical_event_count || 0)
  const tier = zone.risk_tier || 'Normal'

  if (rain72 >= 100 && slope >= 25) {
    return `Heavy accumulated rainfall (${rain72}mm over 72h) combined with steep terrain (${slope}°) is significantly elevating current soil pore pressure.`
  }
  if (rain24 >= 30) {
    return `Intense recent precipitation (${rain24}mm in 24h) is actively saturating the highway embankment surface.`
  }
  if (tier === 'Severe' || tier === 'High') {
    return `Elevated gradient (${slope}°) and cumulative moisture levels require heightened caution for potential slope failure.`
  }
  if (events > 0 && (rain24 > 10 || rain72 > 30)) {
    return `Historical incident frequency (${events} recorded events) indicates moderate vulnerability during monsoon rainfall.`
  }
  if (rain24 < 10 && rain72 < 25 && slope < 20) {
    return `Current precipitation (${rain24}mm/24h) and terrain inclination (${slope}°) remain well within safe baseline stability limits.`
  }
  return `Terrain gradient is ${slope}° with ${rain24}mm 24h rainfall. Monitored continuously by NER V3 AI models.`
}

export default function ZoneDrawer({ zone, detailView, onOpenAnalysis, onClose, className, inline = false }) {
  if (!zone || detailView === null) return null

  const tierKey = zone.risk_tier ? zone.risk_tier.toLowerCase() : 'normal'
  const probPercent = (Number(zone.risk_probability || 0) * 100).toFixed(2)
  const dynamicExplanation = getDynamicRiskExplanation(zone)

  // VIEW 1: ZoneDrawer Summary Overlay (render ONLY when detailView === 'zone')
  if (detailView === 'zone') {
    return (
      <div 
        id="zone-detail-popup"
        className={cn(
          inline
            ? "relative w-full bg-surface rounded-xl p-4 shadow-card border border-border text-text transition-all duration-300 slide-in"
            : "absolute bottom-3 left-3 right-3 sm:right-auto sm:w-80 z-[1000] bg-surface/95 backdrop-blur-md rounded-xl p-4 shadow-card border border-border text-text transition-all duration-300 slide-in",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              ZONE ID
            </div>
            <h3 className="text-lg font-bold text-text tracking-tight mt-0.5">{zone.segment_id}</h3>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge tier={tierKey} />
            {onClose && (
              <button 
                onClick={onClose}
                aria-label="Close Zone Details"
                className="w-6 h-6 rounded-full hover:bg-bg flex items-center justify-center text-text-muted hover:text-text transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* AI Probability Box */}
        <div className={cn(
          "rounded-lg p-3 my-2.5 flex items-center justify-between border",
          zone.risk_tier === 'Severe' ? 'bg-status-severe/5 border-status-severe/20' :
          zone.risk_tier === 'High' ? 'bg-status-high/5 border-status-high/20' :
          zone.risk_tier === 'Medium' ? 'bg-status-medium/5 border-status-medium/20' :
          'bg-status-normal/5 border-status-normal/20'
        )}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              AI Risk Probability
            </p>
            <p className={cn(
              "text-2xl font-black mt-0.5 tracking-tight font-mono",
              zone.risk_tier === 'Severe' ? 'text-status-severe' :
              zone.risk_tier === 'High' ? 'text-status-high' :
              zone.risk_tier === 'Medium' ? 'text-status-medium' :
              'text-status-normal'
            )}>
              {probPercent}%
            </p>
          </div>
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            zone.risk_tier === 'Severe' ? 'bg-status-severe/10 text-status-severe' :
            zone.risk_tier === 'High' ? 'bg-status-high/10 text-status-high' :
            zone.risk_tier === 'Medium' ? 'bg-status-medium/10 text-status-medium' :
            'bg-status-normal/10 text-status-normal'
          )}>
            <Bot size={18} />
          </div>
        </div>

        {/* Dynamic Explanation */}
        <p className="text-[11px] text-text-muted leading-relaxed mb-2">
          {dynamicExplanation}
        </p>

        {/* 4-Item Telemetry Grid */}
        <div className="grid grid-cols-2 gap-2 my-2 text-xs">
          <div className="bg-bg/60 p-2 rounded-lg border border-border/60">
            <span className="text-[10px] text-text-muted uppercase font-medium block">24h Rain</span>
            <span className="font-bold text-text text-xs">{zone.rainfall_24h ?? 0} mm</span>
          </div>
          <div className="bg-bg/60 p-2 rounded-lg border border-border/60">
            <span className="text-[10px] text-text-muted uppercase font-medium block">72h Rain</span>
            <span className="font-bold text-text text-xs">{zone.rainfall_72h ?? 0} mm</span>
          </div>
          <div className="bg-bg/60 p-2 rounded-lg border border-border/60">
            <span className="text-[10px] text-text-muted uppercase font-medium block">Slope</span>
            <span className="font-bold text-text text-xs">{zone.slope_deg ?? 0}°</span>
          </div>
          <div className="bg-bg/60 p-2 rounded-lg border border-border/60">
            <span className="text-[10px] text-text-muted uppercase font-medium block">Historical</span>
            <span className="font-bold text-text text-xs">{zone.historical_event_count ?? 0} Events</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/60 mt-2">
          <span className="text-[10px] text-text-muted flex items-center gap-1 font-mono">
            <Clock size={10} /> Verified V3 Model
          </span>
          <button 
            id="btn-view-full-analysis"
            onClick={onOpenAnalysis}
            className="text-xs font-bold text-brand hover:text-brand/80 flex items-center gap-1 transition-colors uppercase tracking-wider"
          >
            <span>Full Analysis</span>
            <ArrowRight size={12} />
          </button>
        </div>
      </div>
    )
  }

  // VIEW 2: Full Analysis Dialog (render ONLY when detailView === 'analysis')
  return (
    <Dialog 
      open={detailView === 'analysis'} 
      onOpenChange={(open) => {
        if (!open) {
          onClose?.()
        }
      }}
    >
      <DialogContent className="max-w-md bg-surface text-text max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-brand">NER V3 AI Assessment</span>
            <RiskBadge tier={tierKey} />
          </div>
          <DialogTitle className="text-xl font-bold mt-1">
            Risk Analysis: {zone.segment_id}
          </DialogTitle>
          <DialogDescription className="text-xs text-text-muted">
            Corridor Coordinates: {Number(zone.lat).toFixed(4)}°N, {Number(zone.lng).toFixed(4)}°E
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-2">
          {/* AI Probability Box */}
          <div className="p-3.5 rounded-xl bg-bg border border-border flex items-center justify-between">
            <div>
              <p className="text-xs text-text-muted font-medium uppercase">Composite AI Hazard Probability</p>
              <p className={cn(
                "text-3xl font-black font-mono mt-0.5",
                zone.risk_tier === 'Severe' ? 'text-status-severe' :
                zone.risk_tier === 'High' ? 'text-status-high' :
                zone.risk_tier === 'Medium' ? 'text-status-medium' :
                'text-status-normal'
              )}>
                {probPercent}%
              </p>
              <p className="text-[11px] text-text-muted mt-1">
                Risk Tier: <strong>{zone.risk_tier}</strong>
              </p>
            </div>
            <div className="p-3 bg-surface rounded-lg border border-border">
              <TrendingUp size={24} className={zone.risk_tier === 'Severe' ? 'text-status-severe' : 'text-brand'} />
            </div>
          </div>

          {/* Dynamic Rule-Based Explanation */}
          <div className="p-3 rounded-lg bg-surface border border-border text-xs">
            <span className="font-bold text-text block mb-1">Environmental Assessment</span>
            <p className="text-text-muted leading-relaxed">
              {dynamicExplanation}
            </p>
          </div>

          {/* Telemetry Grid from Real Supabase Record */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-surface border border-border">
              <div className="flex items-center gap-1.5 text-text-muted font-semibold mb-1">
                <CloudRain size={14} className="text-blue-500" />
                Precipitation
              </div>
              <p className="text-sm font-bold">{zone.rainfall_24h ?? 0} mm (24h)</p>
              <p className="text-xs text-text-muted">{zone.rainfall_72h ?? 0} mm cumulative (72h)</p>
            </div>

            <div className="p-3 rounded-lg bg-surface border border-border">
              <div className="flex items-center gap-1.5 text-text-muted font-semibold mb-1">
                <Mountain size={14} className="text-amber-500" />
                Slope & Elevation
              </div>
              <p className="text-sm font-bold">{zone.slope_deg ?? 0}° Incline</p>
              <p className="text-xs text-text-muted">Elevation: {zone.elevation_m != null ? `${zone.elevation_m} m` : 'N/A'}</p>
            </div>
          </div>

          {/* Historical Events Counter */}
          <div className="p-3 rounded-lg bg-surface border border-border text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-slate-500" />
              <div>
                <p className="font-bold text-text">Historical Slope Failures</p>
                <p className="text-[11px] text-text-muted">Recorded geological incidents along this segment</p>
              </div>
            </div>
            <span className="text-base font-black font-mono text-text bg-bg px-2.5 py-1 rounded-md border border-border">
              {zone.historical_event_count ?? 0}
            </span>
          </div>

          {/* Verified V3 Random Forest Feature Importance Weights */}
          <div className="p-3 rounded-lg bg-bg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-text">
                <BarChart3 size={14} className="text-brand" />
                <span>V3 Model Feature Importance Weights</span>
              </div>
              <span className="text-[10px] font-mono text-text-muted">Random Forest</span>
            </div>

            <div className="space-y-1.5 pt-1">
              {V4_FEATURE_IMPORTANCES.map((item) => (
                <div key={item.feature} className="text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text">{item.label}</span>
                    <span className="font-mono font-bold text-brand">{item.importance}%</span>
                  </div>
                  <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.importance * 2.2}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Action */}
          <div className="p-3 rounded-lg bg-brand/5 border border-brand/20 text-xs flex items-start gap-2">
            <ShieldCheck size={16} className="text-brand shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-brand">Recommended Operational Protocol</p>
              <p className="text-text-muted mt-0.5 leading-relaxed">
                {zone.risk_tier === 'Severe' 
                  ? 'Deploy NDRF/SDRF standby unit. Restrict heavy commercial transit on this sector.'
                  : zone.risk_tier === 'High'
                  ? 'Deploy road patrol for early crack monitoring and active debris clearance.'
                  : 'Maintain automated sensor monitoring and routine radar surveillance.'}
              </p>
            </div>
          </div>
        </div>

        <Button 
          className="w-full bg-brand hover:bg-brand/90 text-white font-semibold text-xs py-2"
          onClick={() => onClose?.()}
        >
          Close Analysis
        </Button>
      </DialogContent>
    </Dialog>
  )
}
