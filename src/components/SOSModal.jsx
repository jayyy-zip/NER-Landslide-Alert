import React, { useState } from 'react'
import { Siren, MapPin, CheckCircle, Radio, ShieldAlert } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { submitSosAlert } from '@/lib/queries'
import { toast } from 'sonner'

export default function SOSModal({ isOpen, onClose, zone = 'NH27-S08', lat = 25.1839, lng = 93.0100, onSosSent }) {
  const [step, setStep] = useState('confirm') // 'confirm' | 'sending' | 'sent'
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSendSOS = async () => {
    setStep('sending')
    setIsSubmitting(true)
    try {
      const result = await submitSosAlert({
        lat,
        lng,
        zone,
        notes: `Emergency SOS broadcasted from ${zone} (${lat}°N, ${lng}°E)`,
      })
      setStep('sent')
      setIsSubmitting(false)
      onSosSent?.(result)
    } catch (err) {
      console.error('Failed to submit SOS alert', err)
      toast.error(`SOS broadcast failed: ${err.message}`)
      setStep('confirm')
      setIsSubmitting(false)
    }
  }

  const handleReset = () => {
    setStep('confirm')
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleReset(); }}>
      <DialogContent className="max-w-sm bg-surface text-text p-6">
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-status-severe/10 border border-status-severe/20 flex items-center justify-center mx-auto text-status-severe">
              <ShieldAlert size={32} />
            </div>

            <div className="text-center">
              <span className="text-[10px] font-bold tracking-widest text-status-severe uppercase bg-status-severe/10 px-2.5 py-0.5 rounded-full">
                EMERGENCY SOS CONFIRMATION
              </span>
              <h3 className="text-lg font-bold text-text mt-2">
                Broadcast Emergency Distress Call?
              </h3>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                This will immediately broadcast a high-priority distress beacon to the Jatinga–Haflong Disaster Command Center and nearby SDRF response units.
              </p>
            </div>

            {/* GPS Location Preview */}
            <div className="bg-bg p-3 rounded-xl border border-border text-xs space-y-1">
              <div className="flex items-center justify-between text-text-muted">
                <span className="flex items-center gap-1 font-medium">
                  <MapPin size={12} className="text-brand" /> Highway Location
                </span>
                <span className="font-mono text-[11px] font-bold text-brand">{zone}</span>
              </div>
              <p className="font-mono text-xs font-semibold text-text">
                {Number(lat).toFixed(4)}° N, {Number(lng).toFixed(4)}° E · NH-27 Corridor
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                id="btn-confirm-send-sos"
                disabled={isSubmitting}
                className="w-full bg-status-severe hover:bg-red-700 text-white font-bold text-sm py-3 min-h-12 rounded-xl flex items-center justify-center gap-2 shadow-sm"
                onClick={handleSendSOS}
              >
                <Siren size={18} />
                <span>CONFIRM & BROADCAST SOS</span>
              </Button>
              <Button
                variant="outline"
                className="w-full text-text-muted hover:text-text border-border text-xs"
                onClick={handleReset}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 'sending' && (
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-status-severe/10 border-2 border-status-severe flex items-center justify-center mx-auto text-status-severe animate-spin">
              <Radio size={32} />
            </div>
            <div>
              <h3 className="text-base font-bold text-text">Transmitting Distress Signal...</h3>
              <p className="text-xs text-text-muted mt-1 font-mono">
                Connecting to NER Emergency Operations Center
              </p>
            </div>
          </div>
        )}

        {step === 'sent' && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-status-normal/10 border border-status-normal/30 flex items-center justify-center mx-auto text-status-normal">
              <CheckCircle size={36} />
            </div>

            <div>
              <span className="text-[10px] font-bold tracking-widest text-status-normal uppercase bg-status-normal/10 px-2.5 py-0.5 rounded-full">
                DISPATCH SIGNAL TRANSMITTED
              </span>
              <h3 className="text-xl font-bold text-text mt-2">
                SOS SENT
              </h3>
              <p className="text-sm font-semibold text-brand mt-1">
                Location shared with response officers.
              </p>
              <p className="text-xs text-text-muted mt-2 leading-relaxed">
                Emergency dispatch unit has received your alert near <strong>{zone}</strong>. Stay in a secure location away from active rockfall or unstable slopes.
              </p>
            </div>

            <div className="bg-bg p-3 rounded-xl border border-border text-xs text-left space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Emergency Helpline:</span>
                <span className="font-bold text-text">1077 / 112</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Control Room:</span>
                <span className="font-bold text-text">Haflong EOC Active</span>
              </div>
            </div>

            <Button
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-2.5 rounded-xl"
              onClick={handleReset}
            >
              Close Alert
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
