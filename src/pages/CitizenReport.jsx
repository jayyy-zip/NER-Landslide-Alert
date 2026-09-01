import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  MapPin,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileText,
  Waves,
  AlertTriangle,
  HelpCircle,
  Send,
  Locate,
  Loader2,
  ShieldAlert
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { submitCitizenReport } from '@/lib/queries'
import { cn } from '@/lib/utils'

// ─── Supported Category Data (Task 8 / Bug 8) ───────────────────────────────────

const CATEGORIES = [
  {
    id: 'Road Crack',
    label: 'Road Crack',
    description: 'Visible fissures, structural splits, or road subsidence',
    icon: AlertTriangle,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-500',
    selectedBorder: 'border-orange-400',
    selectedBg: 'bg-orange-50',
  },
  {
    id: 'Landslide',
    label: 'Landslide',
    description: 'Active mudflow, major slope collapse, or hillside slip',
    icon: Waves,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-500',
    selectedBorder: 'border-red-400',
    selectedBg: 'bg-red-50',
  },
  {
    id: 'Road Blockage',
    label: 'Road Blockage',
    description: 'Highway lanes impassable or obstructed by earth',
    icon: ShieldAlert,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-500',
    selectedBorder: 'border-purple-400',
    selectedBg: 'bg-purple-50',
  },
  {
    id: 'Fallen debris',
    label: 'Fallen debris',
    description: 'Boulders, loose shale, or rockfall on highway shoulders',
    icon: FileText,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-500',
    selectedBorder: 'border-amber-400',
    selectedBg: 'bg-amber-50',
  },
  {
    id: 'Other',
    label: 'Other Hazard',
    description: 'Any other suspicious geological signs not listed above',
    icon: HelpCircle,
    iconBg: 'bg-slate-50',
    iconColor: 'text-slate-500',
    selectedBorder: 'border-slate-400',
    selectedBg: 'bg-slate-50',
  },
]

// ─── Location Button ──────────────────────────────────────────────────────────

function LocationButton({ location, coords, onFetch, isDetecting }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-text">Your Location</label>
      <button
        type="button"
        id="location-btn"
        onClick={onFetch}
        disabled={isDetecting}
        className={cn(
          'w-full flex items-center gap-4 p-4 min-h-14 rounded-lg border-2 transition-all duration-200 text-left',
          'active:scale-[0.98]',
          location
            ? 'border-brand bg-brand/5'
            : 'border-border bg-surface hover:border-brand/50 hover:bg-bg',
        )}
      >
        <div className={cn(
          'w-12 h-12 rounded-lg flex items-center justify-center shrink-0 transition-colors',
          location ? 'bg-brand text-white' : 'bg-brand/10 text-brand',
        )}>
          {isDetecting ? (
            <Loader2 size={22} className="animate-spin" />
          ) : location ? (
            <MapPin size={22} />
          ) : (
            <Locate size={22} />
          )}
        </div>
        <div className="flex-1 text-left min-w-0">
          {location ? (
            <>
              <p className="text-sm font-semibold text-text">GPS Coordinates Captured</p>
              <p className="text-brand text-xs mt-0.5 font-mono truncate">{location}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-text">Detect Current GPS Location</p>
              <p className="text-text-muted text-xs mt-0.5">Tap to acquire highway coordinates</p>
            </>
          )}
        </div>
        {location ? (
          <CheckCircle2 size={20} className="text-brand shrink-0" />
        ) : (
          <ChevronRight size={18} className="text-text-muted shrink-0" />
        )}
      </button>
    </div>
  )
}

// ─── Photo Upload ─────────────────────────────────────────────────────────────

function PhotoUpload({ photoFile, onPhotoChange }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-text">
        Photo Evidence <span className="text-text-muted font-normal">(optional)</span>
      </label>
      <label
        id="photo-upload-area"
        htmlFor="photo-input"
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 p-6 min-h-[120px]',
          'rounded-lg border-2 border-dashed cursor-pointer',
          'transition-all duration-200 active:scale-[0.99]',
          photoFile
            ? 'border-brand bg-brand/5'
            : 'border-border bg-surface hover:border-brand/50 hover:bg-bg',
        )}
      >
        <input
          id="photo-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            const file = e.target.files?.[0] || null
            onPhotoChange(file)
          }}
        />

        {photoFile ? (
          <>
            <div className="w-12 h-12 bg-brand/10 rounded-lg flex items-center justify-center text-brand">
              <CheckCircle2 size={26} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-text">Photo Attached</p>
              <p className="text-xs text-text-muted mt-0.5 max-w-[220px] truncate">{photoFile.name}</p>
            </div>
            <span className="text-xs text-brand font-semibold underline">Change photo</span>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-bg rounded-lg border-2 border-border flex items-center justify-center text-text-muted">
              <Camera size={24} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-text">Add Photo Evidence</p>
              <p className="text-xs text-text-muted mt-0.5">Tap to take photo or upload file</p>
            </div>
          </>
        )}
      </label>
    </div>
  )
}

// ─── Category Selector ────────────────────────────────────────────────────────

function CategorySelector({ selected, onSelect }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-text">Type of Hazard</label>
      <div className="space-y-2.5" role="radiogroup" aria-label="Landslide hazard category">
        {CATEGORIES.map(({ id, label, description, icon: Icon, iconBg, iconColor, selectedBorder, selectedBg }) => {
          const isSelected = selected === id
          return (
            <button
              key={id}
              type="button"
              id={`category-${id.replace(/\s+/g, '-').toLowerCase()}`}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(id)}
              className={cn(
                'w-full flex items-center gap-3.5 p-3.5 min-h-14 rounded-lg border-2 text-left',
                'transition-all duration-150 active:scale-[0.99]',
                isSelected
                  ? `${selectedBorder} ${selectedBg} shadow-sm`
                  : 'border-border bg-surface hover:border-brand/30 hover:bg-bg',
              )}
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
                <Icon size={18} className={iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-text">
                  {label}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{description}</p>
              </div>
              <div className={cn(
                'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors',
                isSelected ? 'border-brand bg-brand' : 'border-border',
              )}>
                {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main Citizen Report Form ─────────────────────────────────────────────────

export default function CitizenReport() {
  const navigate = useNavigate()
  const [coords, setCoords] = useState({ lat: 25.1839, lng: 93.0100 })
  const [locationText, setLocationText] = useState('25.1839° N, 93.0100° E (NH-27 Jatinga)')
  const [isDetectingGps, setIsDetectingGps] = useState(false)
  const [photoFile, setPhotoFile] = useState(null)
  const [category, setCategory] = useState(null)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedReport, setSubmittedReport] = useState(null)

  const handleGetLocation = () => {
    setIsDetectingGps(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude)
          const lng = Number(pos.coords.longitude)
          setCoords({ lat, lng })
          setLocationText(`${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E · NH-27`)
          setIsDetectingGps(false)
          toast.success('Live GPS coordinates acquired.')
        },
        () => {
          // Fallback to Jatinga corridor default
          setCoords({ lat: 25.1839, lng: 93.0100 })
          setLocationText('25.1839° N, 93.0100° E · NH-27 Corridor')
          setIsDetectingGps(false)
          toast.info('Set to Jatinga–Haflong corridor coordinates.')
        },
        { timeout: 8000, enableHighAccuracy: true }
      )
    } else {
      setIsDetectingGps(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!category) {
      toast.error('Please select a hazard category before submitting.')
      return
    }

    setIsSubmitting(true)
    try {
      const inserted = await submitCitizenReport({
        issueType: category,
        description: notes || null,
        lat: coords.lat,
        lng: coords.lng,
        photoFile: photoFile,
      })

      setIsSubmitting(false)
      setSubmittedReport(inserted)
      toast.success('Hazard report submitted to Supabase!')
    } catch (err) {
      console.error('Submission error:', err)
      setIsSubmitting(false)
      toast.error(`Submission failed: ${err.message}`)
    }
  }

  // ── Success Screen ────────────────────────────────────────────────────────
  if (submittedReport) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Toaster position="top-center" richColors />
        <div className="max-w-md w-full mx-auto text-center space-y-5 slide-in">
          <div className="w-20 h-20 bg-brand/10 rounded-full flex items-center justify-center mx-auto text-brand">
            <CheckCircle2 size={44} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text">Report Submitted!</h2>
            <p className="text-xs text-text-muted mt-2 leading-relaxed">
              Your report has been confirmed in the state disaster database and dispatched to the nearest highway patrol unit.
            </p>
          </div>

          <div className="bg-surface rounded-xl p-4 border border-border shadow-sm text-left space-y-2.5 text-xs">
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Report Summary</p>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Category:</span>
                <span className="font-bold text-text">{submittedReport.issue_type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Location:</span>
                <span className="font-mono text-text">{locationText}</span>
              </div>
              {submittedReport.photo_url && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Photo:</span>
                  <span className="text-brand font-semibold">Attached to DB</span>
                </div>
              )}
              {notes && (
                <div className="pt-1 border-t border-border">
                  <span className="text-text-muted block text-[10px]">Notes:</span>
                  <span className="text-text">{notes}</span>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-text-muted">
            Report Reference ID:{' '}
            <span className="font-mono font-bold text-text">LARS-{submittedReport.id}</span>
          </p>

          <div className="space-y-2 pt-2">
            <Button
              id="back-to-citizen"
              onClick={() => navigate('/citizen')}
              className="w-full py-3.5 min-h-12 bg-brand hover:bg-brand/90 text-white rounded-xl font-bold text-xs shadow-sm"
            >
              Back to Citizen Dashboard
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/officer')}
              className="w-full text-xs text-text-muted border-border"
            >
              View in Officer Console
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg">
      <Toaster position="top-center" richColors />

      <div className="max-w-md mx-auto min-h-screen bg-surface flex flex-col shadow-xl">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 pt-8 pb-4 border-b border-border sticky top-0 bg-surface z-10">
          <button
            type="button"
            id="back-btn"
            onClick={() => navigate('/citizen')}
            className="w-10 h-10 rounded-lg bg-bg flex items-center justify-center hover:bg-border/40 transition-all shrink-0"
            aria-label="Go back to citizen dashboard"
          >
            <ArrowLeft size={18} className="text-brand" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-text leading-tight">
              Report a Highway Hazard
            </h1>
            <p className="text-xs text-text-muted mt-0.5">Jatinga–Haflong NH-27 Sector</p>
          </div>
          <div className="w-8 h-8 bg-brand rounded-lg flex items-center justify-center text-white shrink-0">
            <AlertTriangle size={15} />
          </div>
        </header>

        {/* Form body */}
        <form
          id="report-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-4 py-5 space-y-5"
        >
          <LocationButton 
            location={locationText} 
            coords={coords} 
            onFetch={handleGetLocation} 
            isDetecting={isDetectingGps}
          />

          <PhotoUpload 
            photoFile={photoFile} 
            onPhotoChange={setPhotoFile} 
          />

          <CategorySelector 
            selected={category} 
            onSelect={setCategory} 
          />

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="report-notes" className="block text-sm font-semibold text-text">
              Additional Details <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <textarea
              id="report-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Describe road blockage extent, cracks, sounds, or vehicle transit issues..."
              className="w-full px-4 py-3 rounded-lg border-2 border-border bg-bg text-xs text-text placeholder-text-muted focus:outline-none focus:border-brand focus:bg-surface resize-none transition-colors"
            />
          </div>

          <div className="h-2" />
        </form>

        {/* Sticky Submit Footer */}
        <div className="px-4 pb-6 pt-3 bg-surface border-t border-border">
          {!category && (
            <p className="text-xs text-center text-text-muted mb-2 font-medium">
              Please select a hazard category to continue
            </p>
          )}
          <Button
            id="submit-report-btn"
            type="submit"
            form="report-form"
            disabled={!category || isSubmitting}
            className={cn(
              'w-full min-h-12 rounded-xl font-bold text-xs tracking-wide gap-2 shadow-sm',
              category
                ? 'bg-brand hover:bg-brand/90 active:scale-[0.98] text-white'
                : 'bg-bg text-text-muted/60 cursor-not-allowed border border-border',
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Uploading & Submitting to DB...</span>
              </>
            ) : (
              <>
                <Send size={15} />
                <span>Submit Report</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
