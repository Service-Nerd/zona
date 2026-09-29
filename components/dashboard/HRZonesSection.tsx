'use client'

// DASHBOARD-SCREEN-EXTRACT-02 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14k-line file, so it closed over nothing and this
// move changes no behaviour. What it changes is REACH: nothing could import it, so it
// could not be rendered by a harness or a mounting test.
//
// ⚠️ The body is UNCHANGED. Edit it in a separate commit so the move stays a move.

import { calculateZones } from '@/components/dashboard/dashboardHelpers'
import { TextField } from '@/components/shared/TextField'
import { HEART_RATE_SUB } from '@/components/shared/meDoors'
import Button from '@/components/ui/Button'
import ScreenHeader from '@/components/ui/ScreenHeader'
import { resolveMaxHr } from '@/lib/plan/maxHrGuard'
import { useIsNative } from '@/lib/useIsNative'
import { Capacitor } from '@capacitor/core'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

export const HR_CARD_ANCHOR_ID = 'me-hr-card'

/**
 * Apple Health one-tap prefill button — gated by Capacitor.isNativePlatform().
 * Renders only on iOS native shell (web/PWA users see nothing).
 *
 * The actual HealthKit plugin call lives in lib/health/clientSync.ts, which the
 * iOS native build wires up (Phase G). Until then the dynamic import fails
 * silently and the button is a no-op — no broken behaviour on PWA, no crash.
 */
function AppleHealthPrefillButton({ onPrefill }: { onPrefill: (rhr: number | null, mhr: number | null) => void }) {
  // P-10 — was a third hand-written copy of the platform check. `useIsNative`
  // is the single owner now; three copies of one predicate is the D-08 shape
  // this repo keeps paying for, and here the failure mode is a screen offering
  // a CTA the platform cannot honour.
  const isNative = useIsNative()
  const [busy, setBusy] = useState(false)
  const [err,  setErr]  = useState<string | null>(null)

  if (!isNative) return null

  async function handleClick() {
    setBusy(true)
    setErr(null)
    try {
      const { Health } = await import('@capgo/capacitor-health')
      // Check availability first so we can give a specific reason when the
      // plugin says no — the generic "unavailable" message left users
      // staring at a connected Apple Health row with no idea what to do.
      const availability = await Health.isAvailable().catch(() => ({ available: false }))
      if (!availability.available) {
        setErr('Apple Health isn’t available on this device.')
        return
      }
      const { fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
      const snapshot = await fetchAppleHealthHRSnapshot()
      if (!snapshot) {
        setErr('No data. Open Apple Health and let your Watch sync')
        return
      }
      onPrefill(snapshot.restingHR, snapshot.maxHR)
      // Soft-warn if we only got one of the two — pre-fill still happened, but
      // the user should know why the other field is still empty.
      if (snapshot.restingHR == null) {
        setErr('Got max HR, but no resting HR yet')
      } else if (snapshot.maxHR == null) {
        setErr('Got resting HR, but no max HR yet; a workout adds this')
      }
    } catch (e) {
      // Most common cause once availability passes: read permission was revoked
      // in iOS Settings. The Connections row above still shows "Connected"
      // because Supabase only tracks the first-grant moment — re-running the
      // connect flow re-prompts the system sheet and refreshes permission.
      // ⚠️ WAS "Reconnect in Connections below." — the SAME `below` that ME-DOORS-01 had
      // to fix on the HR nudge. Connections is a door now, and this error is raised from
      // behind a different door, so "below" pointed at nothing on screen.
      setErr('Couldn’t read from Apple Health. Reconnect it under Connections.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginBottom: 'var(--space-3)' }}>
      <Button variant="quiet" onClick={handleClick} disabled={busy}>
        {busy ? 'Reading Apple Health…' : 'Use your Apple Health values'}
      </Button>
      {err && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: 'var(--space-2)', textAlign: 'center' }}>
          {err}
        </div>
      )}
    </div>
  )
}

export default function HRZonesSection({ restingHR, maxHR, maxHrSource, birthYear, onSave, hrZoneMethod, hrAssumptionNote }: {
  restingHR: number | null
  maxHR: number | null
  /** §50 (HR-MAX-01) — provenance of the stored max, used to decide whether an
   *  unedited sub-estimate value is a device floor (guard) or user-confirmed. */
  maxHrSource?: 'observed' | 'user_confirmed' | null
  birthYear?: number | null
  onSave: (rhr: number, mhr: number) => void
  /** From plan.meta.hr_zone_method — which fallback level was used when the plan was generated. */
  hrZoneMethod?: string | null
  /** From plan.meta.hr_assumption_note — human-readable explanation of the fallback. */
  hrAssumptionNote?: string | null
  /** ZONES-SURFACE-01 — opens the Training Zones screen. */
  /* ⚠️ `onOpenZones` WAS HERE AND WAS DEAD (ZONES-HR-SHEET-01). It was declared, typed
     and passed by three call sites, and never referenced in this component's body: it went
     inert when `ZONES-SURFACE-01` moved the five zone rows and their chevron out to the
     Training Zones screen. Removed rather than left, because this card now renders INSIDE
     that screen's sheet, and a link from here to the screen it sits on is a loop. */
}) {
  // Smart default: most people have never tested their max HR, so a blank field
  // leaves zones unconfigured. Pre-fill an age estimate (Tanaka: 208 − 0.7×age —
  // exempt algorithm formula) and label it as an estimate, so zones work out of
  // the box and the number stays honest. Only used when no real max is saved.
  const estMaxHr = (() => {
    if (birthYear == null) return null
    const age = new Date().getFullYear() - birthYear
    if (age < 10 || age > 100) return null
    return Math.round(208 - 0.7 * age)
  })()

  const [rhr, setRhr] = useState(restingHR ? String(restingHR) : '')
  const [mhr, setMhr] = useState(maxHR ? String(maxHR) : (estMaxHr ? String(estMaxHr) : ''))

  useEffect(() => { setRhr(restingHR ? String(restingHR) : '') }, [restingHR])
  useEffect(() => { setMhr(maxHR ? String(maxHR) : (estMaxHr ? String(estMaxHr) : '')) }, [maxHR, estMaxHr])

  // Show the "estimated" hint while no real max is saved and the field still
  // holds the estimate (user hasn't typed their own tested value over it).
  const showEstHint = !maxHR && estMaxHr != null && parseInt(mhr) === estMaxHr
  const [saved, setSaved] = useState(false)
  const [openZone, setOpenZone] = useState<1 | 2 | 3 | 4 | 5 | null>(null)

  const rhrNum = parseInt(rhr)
  const mhrNum = parseInt(mhr)
  const valid = rhrNum > 0 && mhrNum > 0 && mhrNum > rhrNum

  // §50 asymmetry (HR-MAX-01) — the zones shown here must not contradict the
  // plan's guarded targets. A value the user has typed over the stored one is a
  // confirmation (trust it); an unedited stored value keeps its provenance, so a
  // device floor (observed / unattributed, below the age estimate) displays the
  // guarded estimate zones instead. resolveMaxHr is the same single owner the
  // engine and DashboardClient use.
  const age = birthYear ? new Date().getFullYear() - birthYear : null
  const editedMax = maxHR == null || mhrNum !== maxHR
  const displaySource: 'observed' | 'user_confirmed' | undefined =
    editedMax ? 'user_confirmed' : (maxHrSource ?? undefined)
  const guardedMax = (valid && age != null && age >= 10 && age <= 100)
    ? resolveMaxHr(mhrNum, age, displaySource).effectiveMax
    : mhrNum
  const maxIsFloored = valid && guardedMax !== mhrNum
  const zones = valid ? calculateZones(rhrNum, guardedMax) : []

  function handleSave() {
    if (!valid) return
    onSave(rhrNum, mhrNum)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '10px',
    color: 'var(--text-muted)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 'var(--space-2)', display: 'block',
  }

  return (
    <div id={HR_CARD_ANCHOR_ID} style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', overflow: 'hidden' }}>

      {/* ⚠️ THE CARD'S OWN HEADER IS GONE (ME-DOORS-01). Its comment read *"parallels Race
          benchmark row"* — correct while this card sat among other cards on the index, and a
          SECOND TITLE once the card became the whole screen behind a door titled `Heart rate`.
          The sublabel was not dropped: it is `HEART_RATE_SUB`, carried by the door's
          `ScreenHeader`, so the words a runner reads are unchanged and the title is said once. */}

      {/* Editable HR inputs */}
      <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border-col)' }}>
        <AppleHealthPrefillButton onPrefill={(r, m) => { if (r != null) setRhr(String(r)); if (m != null) setMhr(String(m)) }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div>
            <label style={labelStyle}>Resting HR</label>
            <TextField type="number" inputMode="numeric" placeholder="48" unit="bpm"
              value={rhr} onChange={setRhr} ariaLabel="Resting heart rate" />
          </div>
          <div>
            <label style={labelStyle}>Max HR</label>
            <TextField type="number" inputMode="numeric" placeholder="188" unit="bpm"
              value={mhr} onChange={setMhr} ariaLabel="Max heart rate" />
          </div>
        </div>
        {showEstHint && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 'var(--space-3)' }}>
            Max HR estimated from your age. Edit it if you&rsquo;ve tested your true max.
          </div>
        )}
        {maxIsFloored && !showEstHint && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--warn)', lineHeight: 1.5, marginBottom: 'var(--space-3)' }}>
            {mhrNum} bpm is below the age estimate ({guardedMax} bpm), usually the highest your device happened to record, not your true max. Zones use {guardedMax}. If {mhrNum} really is your max, tap Save to confirm it.
          </div>
        )}
        <Button variant="secondary" fullWidth  onClick={handleSave} disabled={!valid} style={{ padding: '11px', background: saved ? 'var(--teal-dim)' : valid ? 'var(--accent-soft)' : 'var(--bg)', border: `0.5px solid ${saved ? 'var(--moss-mid)' : valid ? 'var(--accent-mid)' : 'var(--border-col)'}`, borderRadius: '8px', cursor: valid ? 'pointer' : 'not-allowed', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: saved ? 'var(--teal)' : valid ? 'var(--accent)' : 'var(--text-muted)' }}>
          {saved ? 'Saved' : 'Save HR data'}
        </Button>
      </div>

      {/* ZONES-SURFACE-01 — the five zone rows and their per-zone sheet moved to the
          Training Zones screen. The ENTRY is the "Zones" row in "What Kit knows about
          you", near the top of Me, which already states the values; a second door here,
          five blocks down and nested under the HR inputs, was the first cut and nobody
          found it. What stays in this section is the INPUT, which is Me's job. */}

      {/* Prompt if incomplete */}
      {zones.length === 0 && (rhr || mhr) && (
        <div style={{ padding: '14px 16px', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
          Enter both values to calculate zones
        </div>
      )}
    </div>
  )
}
