'use client'
// UNMEASURED-DISTANCE-01 (Design Board 6t-i). The one row that offers "Add the distance" on a run the device left without
// one: full width under the planned/actual block, never inside the half-width column (it wrapped at 375px). Shown only for
// an Apple Health run with no measured distance; after an entry it offers a change. Words: founder, 2026-10-22.
import { useState } from 'react'
import Button from '@/components/ui/Button'
import AddDistanceSheet from '@/components/shared/AddDistanceSheet'

export const ADD_DISTANCE_LABEL = 'Add the distance'
/** Where a run's device recorded no distance (never "0km"). */
export const DISTANCE_NOT_RECORDED = 'Distance not recorded'
/** Beside a distance the runner typed. */
export const DISTANCE_REPORTED_LABEL = 'you added this'
export const CHANGE_DISTANCE_LABEL = 'Change the distance'

export interface AddDistanceRowProps {
  appleHealthUuid: string
  /** What the runner already entered, km; null when nothing yet. */
  reportedKm: number | null
  plannedKm: number | null
  units: 'km' | 'mi'
  onSaved: (km: number) => void
}

export default function AddDistanceRow({ appleHealthUuid, reportedKm, plannedKm, units, onSaved }: AddDistanceRowProps) {
  const [open, setOpen] = useState(false)
  return (
    <div data-add-distance style={{ marginTop: 'var(--space-3)' }}>
      <Button variant="ghost" fullWidth className="btn--inline-target" onClick={() => setOpen(true)}>
        {reportedKm != null ? CHANGE_DISTANCE_LABEL : ADD_DISTANCE_LABEL}
      </Button>
      {open && (
        <AddDistanceSheet appleHealthUuid={appleHealthUuid} startKm={reportedKm ?? plannedKm} units={units}
          onClose={() => setOpen(false)} onSaved={onSaved} />
      )}
    </div>
  )
}
