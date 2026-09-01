import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Users, AlertTriangle, Radio, Activity, ArrowRight, MapPin, Eye, FileText, Siren } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function RoleSelect() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between p-4 md:p-8">
      {/* Top Header */}
      <header className="max-w-4xl mx-auto w-full flex items-center justify-between py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-sm">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-text leading-tight">NER Response</h1>
            <p className="text-xs text-text-muted flex items-center gap-1">
              <MapPin size={11} className="text-brand" /> Jatinga – Haflong Corridor · NH-27
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 bg-surface px-3 py-1 rounded-full border border-border text-xs text-text-muted">
          <span className="w-2 h-2 rounded-full bg-status-normal animate-pulse" />
          AI Early Warning System Active
        </div>
      </header>

      {/* Main Role Selection Content */}
      <main className="max-w-4xl mx-auto w-full my-auto py-8">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-semibold uppercase tracking-wider mb-3">
            Role-Based Portal Access
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-text tracking-tight">
            Select Your Operating Console
          </h2>
          <p className="text-sm text-text-muted mt-2 max-w-lg mx-auto">
            Real-time AI landslide hazard intelligence and rapid response dispatch for the NH-27 mountain corridor.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Citizen Portal Card */}
          <Card 
            id="role-citizen-card"
            className="border-2 border-border hover:border-brand/60 transition-all duration-200 hover:shadow-card cursor-pointer group bg-surface relative overflow-hidden flex flex-col justify-between"
            onClick={() => navigate('/citizen')}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-brand/10 via-transparent to-transparent rounded-bl-full pointer-events-none" />
            <CardHeader className="p-6 pb-4">
              <div className="w-12 h-12 rounded-xl bg-brand/10 text-brand flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Users size={24} />
              </div>
              <CardTitle className="text-xl font-bold text-text flex items-center justify-between">
                <span>Citizen Portal</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-bg text-text-muted border border-border">Public</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-muted mt-1">
                For commuters, residents, and drivers travelling along NH-27.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <ul className="space-y-2 text-xs text-text">
                <li className="flex items-center gap-2">
                  <Activity size={14} className="text-brand shrink-0" />
                  <span>Monitor real-time landslide risk on the corridor</span>
                </li>
                <li className="flex items-center gap-2">
                  <Radio size={14} className="text-brand shrink-0" />
                  <span>View meteorological weather models & rainfall</span>
                </li>
                <li className="flex items-center gap-2">
                  <FileText size={14} className="text-brand shrink-0" />
                  <span>Report road cracks, mudflow & debris hazards</span>
                </li>
                <li className="flex items-center gap-2 text-status-severe font-medium">
                  <Siren size={14} className="shrink-0" />
                  <span>One-tap Emergency SOS broadcast with GPS</span>
                </li>
              </ul>
              <Button 
                id="btn-enter-citizen"
                className="w-full bg-brand hover:bg-brand/90 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 mt-4 shadow-sm"
                onClick={(e) => { e.stopPropagation(); navigate('/citizen'); }}
              >
                <span>Enter Citizen Dashboard</span>
                <ArrowRight size={14} />
              </Button>
            </CardContent>
          </Card>

          {/* Officer Dashboard Card */}
          <Card 
            id="role-officer-card"
            className="border-2 border-border hover:border-status-severe/50 transition-all duration-200 hover:shadow-card cursor-pointer group bg-surface relative overflow-hidden flex flex-col justify-between"
            onClick={() => navigate('/officer')}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-status-severe/10 via-transparent to-transparent rounded-bl-full pointer-events-none" />
            <CardHeader className="p-6 pb-4">
              <div className="w-12 h-12 rounded-xl bg-status-severe/10 text-status-severe flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Shield size={24} />
              </div>
              <CardTitle className="text-xl font-bold text-text flex items-center justify-between">
                <span>Officer Console</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-status-severe/10 text-status-severe border border-status-severe/20">Duty Officer</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-muted mt-1">
                For emergency response controllers, SDRF, and district officers.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <ul className="space-y-2 text-xs text-text">
                <li className="flex items-center gap-2">
                  <Eye size={14} className="text-status-severe shrink-0" />
                  <span>Full corridor surveillance & 25 AI risk segments</span>
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-status-high shrink-0" />
                  <span>Review & triage incoming citizen damage reports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Siren size={14} className="text-status-severe shrink-0" />
                  <span>Receive, locate & dispatch emergency SOS units</span>
                </li>
                <li className="flex items-center gap-2">
                  <Activity size={14} className="text-brand shrink-0" />
                  <span>System audit activity log & response history</span>
                </li>
              </ul>
              <Button 
                id="btn-enter-officer"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center gap-2 mt-4 shadow-sm"
                onClick={(e) => { e.stopPropagation(); navigate('/officer'); }}
              >
                <span>Enter Officer Dashboard</span>
                <ArrowRight size={14} />
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full text-center py-4 border-t border-border text-xs text-text-muted flex flex-col sm:flex-row items-center justify-between gap-2">
        <p>National Highway 27 Landslide Early Warning & Rapid Response System</p>
        <p className="font-mono text-[11px]">NER V3 AI Assessment Engine</p>
      </footer>
    </div>
  )
}
