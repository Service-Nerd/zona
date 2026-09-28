'use client'

// TrainingZonesScreen — ZONES-SURFACE-01 (Design Board, 2026-09-28, SHIP WITH AMENDMENT)
// + ZONES-BEGINNER-BANDS-01 (Coaching Board, CORRECT WITH AMENDMENT).
//
// The one place a runner can read what their zones actually are. Entered from Me by a row
// that REPLACES the zone rows that used to sit there — Collins counted FOURTEEN surfaces
// already rendering zone information and would not accept a fifteenth that explains the
// other fourteen. This consolidates; it does not add.
//
// ── 🔴 THE CEILING LEADS, AND IT HAS TWO EQUAL FORMS ────────────────────────
// "Not faster than 7:15 /km" and "Not above 145 bpm" are the SAME SENTENCE in two units,
// and the product's whole proposition is in it.
//
// ⚠️ THE HR FORM IS NOT A FALLBACK. Measured across all 21 stored plans: `meta.vdot` is
// present on 10 and absent on 11, tracking `meta.benchmark` exactly. **52% of runners have
// no pace ceiling at all**, so treating HR as the degraded case would degrade the majority.
//
// ── ⚠️ NEVER AN EMPTY TAB (Wroblewski, blocking) ────────────────────────────
// The toggle offers only what the runner's data supports, and renders no toggle at all
// when only one side exists — a two-option control with one option is noise.
//
// ── 🔴 THE LABELS ARE OURS. Z3 IS THE GREY ZONE ─────────────────────────────
// The competitor screen this was prompted by calls Z3 "Tempo": a zone you aim for.
// `CoachingPrinciples §1` is titled "Polarised training — protection from grey zone".
// Importing their taxonomy would invert what we sell, and Collins' argument for building
// this at all was that a reference table saying plainly WHERE NOT TO LIVE is the most
// on-brand object in the app — and one a competitor selling encouragement cannot ship.
//
// ── A beginner sees four bands and no apology ───────────────────────────────
// `marathonPaceStr` / `hmPaceStr` are null for beginners; that null is §24b's SEGMENT
// GATE, not a claim their marathon pace is unknowable (§24b Amendment, 2026-09-28). Rows
// with no band are not rendered and nothing is said about them: stating the pace is a soft
// prescription they will act on (Hutchinson), "not earned yet" is a judgement (Sims), and
// "not part of your plan" invites the question it answers. Four bands that are all real
// beat six where two are apologies (Seiler: "six bands is a menu").

import { useState } from 'react'
import type React from 'react'
import { convertPaceString } from '@/lib/format'
import { bandCeiling, type PaceGuide } from '@/lib/plan/paceBands'

export type ZoneRow = {
  zone: number
  name: string
  desc: string
  colour: string
  minHR: number
  maxHR: number
}

/** The 44pt tap-target floor, as a named constant so the check can read the same value
 *  the component uses rather than a literal typed twice. */
export const TAB_MIN_HEIGHT_PX = 44

/** The two tabs, named once so the label and the state cannot drift. */
export const ZONES_TAB_HR = 'Heart rate'
export const ZONES_TAB_PACE = 'Pace'

/** The ceiling's two forms. The same sentence in two units — never a fallback pair. */
export const CEILING_LABEL_HR = 'Not above'
export const CEILING_LABEL_PACE = 'Not faster than'

/**
 * The pace rows, in prescribed order.
 *
 * ⚠️ DERIVED FROM THE `PaceGuide` THE ENGINE BUILT, never re-computed from VDOT fractions
 * in this component. `ruleEngine.ts` records why beside `buildPaceFromVDOT`: reconstructing
 * the bands is "the second-copy-that-drifts class this repo has recorded FIVE times".
 */
function paceRows(p: PaceGuide): { name: string; desc: string; band: string }[] {
  const rows: { name: string; desc: string; band: string | null }[] = [
    { name: 'Easy',       desc: 'Where the aerobic work happens',        band: p.easyPaceStr },
    { name: 'Marathon',   desc: 'Steady, controlled, not strained',      band: p.marathonPaceStr },
    { name: 'Half',       desc: 'Sustained, still under threshold',      band: p.hmPaceStr },
    { name: 'Threshold',  desc: 'Comfortably hard, and honest about it', band: p.qualityPaceStr },
    { name: 'Interval',   desc: 'Short repeats with full recovery',      band: p.intervalPaceStr },
  ]
  // A null band renders NO ROW and no explanatory string — the Coaching Board's ruling.
  return rows.filter((r): r is { name: string; desc: string; band: string } => !!r.band)
}

export function TrainingZonesScreen({ zones, pace, units }: {
  /** HR zones, or null when resting/max HR are not both known. */
  zones: ZoneRow[] | null
  /** The guide the ENGINE built, or null when the runner has no benchmark. */
  pace: PaceGuide | null
  units: 'km' | 'mi'
}) {
  const hasHr = !!zones && zones.length > 0
  const hasPace = !!pace
  const [tab, setTab] = useState<string>(hasHr ? ZONES_TAB_HR : ZONES_TAB_PACE)

  // Neither side has data. Restraint doctrine: empty means calm, not broken.
  if (!hasHr && !hasPace) {
    return (
      <div style={{ padding: '24px 16px', fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--mute)', lineHeight: 1.55 }}>
        Your zones appear once we have your heart rate or a benchmark run.
      </div>
    )
  }

  const showing = hasHr && hasPace ? tab : hasHr ? ZONES_TAB_HR : ZONES_TAB_PACE
  const onHr = showing === ZONES_TAB_HR

  const z2 = zones?.find(z => z.zone === 2) ?? null
  const ceilingValue = onHr
    ? (z2 ? `${z2.maxHR}` : null)
    : bandCeiling(pace?.easyPaceStr ? convertPaceString(pace.easyPaceStr, units) ?? pace.easyPaceStr : null)
  const ceilingUnit = onHr ? 'bpm' : units === 'mi' ? '/mi' : '/km'

  const rowStyle: React.CSSProperties = {
    display: 'grid', gridTemplateColumns: '1fr 96px', gap: 'var(--space-3)',
    alignItems: 'baseline', padding: '13px 16px',
  }

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 'var(--space-7)' }}>

      {/* ⚠️ No toggle when only one side has data — a two-option control with one
          option is noise, and a tab full of estimates is worse than no tab. */}
      {hasHr && hasPace && (
        <div style={{ display: 'flex', background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
          {[ZONES_TAB_HR, ZONES_TAB_PACE].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                // ⚠️ `minHeight` IS LOAD-BEARING AND THE GATE CANNOT SEE IT.
                // `buttonGeometry.test.ts` measures `Button` COMPONENTS; these are
                // hand-rolled `<button>`s for a segmented control, so they are outside
                // its population entirely — the exact blind spot that let 18 hand-rolled
                // controls ship under the floor on 2026-09-25, the smallest at 18px.
                // 9px padding around 14px text is ~35px. Asserted in this component's
                // own markup test instead, because the gate will never fail on it.
                flex: 1, minHeight: TAB_MIN_HEIGHT_PX, padding: '9px',
                borderRadius: 'var(--radius-sm)', border: 'none',
                fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)',
                fontWeight: showing === t ? 600 : 500,
                background: showing === t ? 'var(--card)' : 'transparent',
                color: showing === t ? 'var(--ink)' : 'var(--mute)',
                cursor: 'pointer',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* 🔴 THE CEILING. One number, at display size, because it is the only one the
          runner needs to carry out of the door. */}
      {ceilingValue && (
        <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', padding: '20px 16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {onHr ? CEILING_LABEL_HR : CEILING_LABEL_PACE}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: '44px', fontWeight: 500, color: 'var(--ink)', letterSpacing: '-1px', lineHeight: 1 }}>
              {ceilingValue}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--mute)' }}>{ceilingUnit}</span>
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--mute)', lineHeight: 1.55, margin: 'var(--space-3) 0 0' }}>
            Your easy days sit under this. Going over is the thing that costs you.
          </p>
        </div>
      )}

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>
        {onHr
          ? zones!.map((z, i) => (
              <div key={z.zone} style={{ ...rowStyle, borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--ink)', fontWeight: 500 }}>
                    <span style={{ color: z.colour, fontWeight: 700 }}>Z{z.zone}</span> {z.name}
                  </div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--mute)', marginTop: '2px' }}>{z.desc}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--ink-2)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {z.minHR}–{z.maxHR}
                </div>
              </div>
            ))
          : paceRows(pace!).map((r, i) => (
              <div key={r.name} style={{ ...rowStyle, borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--ink)', fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--mute)', marginTop: '2px' }}>{r.desc}</div>
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--ink-2)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {convertPaceString(r.band, units) ?? r.band}
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}
