'use client'
// UNMEASURED-DISTANCE-01 (Design Board 6t-i, 2026-10-22). "How far did you run?": the runner fills in a distance their
// device did not record. The ratified stepper (`DistanceStepper`), prefilled with what they already gave or the plan's
// distance; saved through `/api/health/ingest` (`source: 'report_distance'`), which refuses a run the device measured.
// Words: founder, 2026-10-22.
import { useState } from 'react'
import Sheet from '@/components/shared/Sheet'
import Button from '@/components/ui/Button'
import DistanceStepper from '@/components/shared/DistanceStepper'
import { InlineError } from '@/components/shared/InlineError'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { KM_PER_MI } from '@/lib/format'

export const ADD_DISTANCE_TITLE = 'How far did you run?'

export interface AddDistanceSheetProps {
  appleHealthUuid: string
  /** The runner's earlier entry, if any, else the planned distance: the starting value. */
  startKm: number | null
  units: 'km' | 'mi'
  onClose: () => void
  onSaved: (km: number) => void
}

export default function AddDistanceSheet({ appleHealthUuid, startKm, units, onClose, onSaved }: AddDistanceSheetProps) {
  const start = startKm != null && startKm > 0 ? (units === 'mi' ? startKm / KM_PER_MI : startKm) : 0
  const [whole, setWhole] = useState(Math.floor(start))
  const [decimal, setDecimal] = useState(Math.round((start - Math.floor(start)) * 10) % 10)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = whole + decimal / 10
  const km = units === 'mi' ? value * KM_PER_MI : value

  const save = async (close: () => void) => {
    setSaving(true); setError(null)
    try {
      const res = await authedFetch('/api/health/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'report_distance', appleHealthUuid, distanceMeters: Math.round(km * 1000) }),
      })
      if (!res.ok) {
        setError(res.status === 409 ? 'This run already has a distance from your device.' : "Couldn't save that. Try again.")
        return
      }
      onSaved(km); close()
    } catch {
      setError("Couldn't save that. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose} ariaLabel={ADD_DISTANCE_TITLE}>
      {(close) => (
        <div style={{ padding: '4px 20px var(--space-5)' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)', marginBottom: 'var(--space-4)' }}>
            {ADD_DISTANCE_TITLE}
          </div>
          <DistanceStepper whole={whole} decimal={decimal} onWhole={setWhole} onDecimal={setDecimal} units={units} />
          {error && <InlineError style={{ marginTop: 'var(--space-3)' }}>{error}</InlineError>}
          <Button variant="primary" fullWidth disabled={saving || value <= 0} onClick={() => save(close)} style={{ marginTop: 'var(--space-5)' }}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
