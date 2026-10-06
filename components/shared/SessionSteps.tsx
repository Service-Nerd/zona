// SessionSteps — ui-patterns.md §"Session steps".
//
// The session-detail structure block, rebuilt (SESSION-STRUCTURE-REDESIGN,
// 2026-09-04) from a dense run-on sentence into scannable, per-phase cards:
// each phase (Warm-up / Main set / Cool-down) is its own card with a tinted
// (never flooded — ADR-007) header, and steps are numbered down a connector
// line. The main set renders one row per work / recovery step from the
// resolved `derived_set` (ADR-019), each with a plain-language role, a primary
// amount in the runner's chosen metric, and a secondary detail carrying the
// duration + pace target. Falls back to the composed one-line description when
// a session has no derived_set (v1 rows, easy runs).
//
// Runna-informed (chunked cards, numbered steps, conversational cues) but on
// Zonna terms: zones over pace-only targets, block totals, Warm Slate restraint.

import React from 'react'
import IconButton from '@/components/ui/IconButton'
import type { SessionStructure } from '@/lib/plan/sessionComposer'
import type { DerivedSet } from '@/lib/plan/resolveMainSet'
import { buildSessionRows, type SessionRow, buildStepGroups, resolveDisplayFigures, type StepRow } from '@/lib/plan/sessionSteps'
import { convertPaceString, formatDistance, formatDuration } from '@/lib/format'
import type { Zone } from '@/components/shared/ZoneBar'
import { MICRO_LABELS } from '@/components/shared/microLabels'

export interface SessionStepsProps {
  structure: SessionStructure
  /** Resolved v2 set (ADR-019). When present, the main set renders as steps. */
  derivedSet?: DerivedSet | null
  sessionType: string
  /** The main-set display zones (§84) — drives the header accent + range label. */
  displayZones: Zone[]
  /** e.g. "Zone 3–4" — the main-set zone range label the header shows. */
  zoneRangeLabel: string
  metric: 'distance' | 'duration'
  preferredUnits: 'km' | 'mi'
  /** The session's own total distance — the number at the top of the card. Part
   *  figures are apportioned to sum to it exactly (SESSION-RECONCILE-01). */
  sessionDistanceKm?: number | null
  /** Strava-derived easy band ("6:45/km") for warm-up / cool-down. Null → zone only. */
  easyPaceStr?: string | null
  /** Opens the zone-education sheet from the main-set ⓘ. */
  onInfo?: () => void
}

// ── small style helpers (tokens only — no hex, per the pre-commit hook) ──────

/** A low-opacity tint of a token colour for a section header — the restrained
 *  answer to Runna's solid colour bars (ADR-007 "type accent, not flood"). */
function tint(token: string, pct: number): string {
  return `color-mix(in srgb, ${token} ${pct}%, var(--card))`
}

const FONT = 'var(--font-ui)'

// ── row + card primitives ────────────────────────────────────────────────────

/**
 * One step of the session.
 *
 * ui-patterns.md § Session steps — SESSION-STEP-LEGIBILITY-01 (Design Board,
 * 2026-10-06). Two lines:
 *
 *   [n]  ● Hard                                              ~1.4km
 *        9:20 min · 5:53 /km or slower · Hold back. This is the part…
 *
 * 🔴 THE SECOND LINE IS NOT NEW — IT MOVED. `detail` already rendered under the
 * amount, inside the right-hand column. **Measured on `/copy-preview`: that
 * column is 127px at a 320px viewport, which made the cool-down row 82.5px tall
 * because a 24-character detail wrapped.** Full width gives it **230px at 320 and
 * 285px at 375**, so this costs ZERO lines and makes an existing wrap go away.
 *
 * ⚠️ WHICH IS WHY THE BOARD'S FIRST SHAPE COULD NOT BE BUILT. The ruling said
 * *"the note replaces the role word, zero added lines"* — but the role column
 * measures **53–72px at 320**, and the median authored note is **52 characters**,
 * needing ~290px. It would have wrapped to five lines. The board's own ruling
 * flagged that it had taken no rendered geometry; this is that measurement, and
 * the chair amended on it. **Arithmetic on character counts is not a layout.**
 *
 * ⚠️ NOTHING IS TRUNCATED (Wroblewski, binding). The longest authored note is 106
 * characters and takes three lines at 320px. Truncating a coaching instruction to
 * fit the card is the worst outcome available here.
 */
function StepRowView({ num, dotColor, row }: { num: number | null; dotColor: string; row: StepRow }) {
  const isRest = row.kind === 'rest'
  // The pace/zone clause and the instruction read as one sentence of guidance,
  // joined by the same middot the detail already used internally ("9:20 min · …").
  const guidance = [row.detail, row.note].filter(Boolean).join(' · ')
  return (
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: '11px 13px', borderTop: '1px solid var(--line)' }}>
      <span style={{ flex: 'none', width: '20px', textAlign: 'center', fontSize: '14px', fontWeight: 800, fontStyle: 'italic', color: 'var(--mute-2)', fontVariantNumeric: 'tabular-nums', background: 'var(--card)' }}>
        {num ?? ''}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', paddingTop: '1px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', flex: 'none', background: isRest ? 'transparent' : dotColor, border: isRest ? '1.5px solid var(--mute-2)' : 'none' }} />
            <span style={{ fontSize: '13px', fontWeight: isRest ? 600 : 700, color: isRest ? 'var(--ink-2)' : 'var(--ink)' }}>{row.role}</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: isRest ? 'var(--ink-2)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, flex: 'none', textAlign: 'right' }}>{row.amount}</div>
        </div>
        {guidance && (
          <div style={{ fontSize: '11px', color: 'var(--mute)', marginTop: '4px', fontVariantNumeric: 'tabular-nums', lineHeight: 1.45 }}>{guidance}</div>
        )}
      </div>
    </div>
  )
}

function SectionCard({
  name, accent, tintPct, totalStr, zoneStr, paceStr, info, children,
}: {
  name: string; accent: string; tintPct: number; totalStr: string
  zoneStr: string; paceStr?: string | null; info?: () => void; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', marginTop: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', padding: '8px 13px', background: tint(accent, tintPct) }}>
        <span style={{ ...MICRO_LABELS.sectionLabel, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: FONT, color: accent }}>
          {name}
          {info && (
            <IconButton
              onClick={info}
              ariaLabel={`${name} · tap to learn`}
              inlineMark
              /* 15px VISUAL, 44px TARGET. `inlineMark` grows the hit area with
                 padding plus a compensating negative margin, so the ringed "i"
                 stays an inline mark inside a 12px uppercase label instead of
                 becoming a button parked in a heading. Only sanctioned route
                 below 44px visually (ICON-BUTTON-01, amendment 3).

                 🔴 THE RING LIVES ON THE GLYPH, NOT THE BUTTON, AND IT DID NOT.
                 `width/height/border/borderRadius` were on the BUTTON, which is
                 the element carrying `padding: 16.5px` to make the 44px target —
                 and under `box-sizing: border-box` a border paints around the
                 PADDED box. So the ring was drawn around the 44px hit area, not
                 the 15px mark: a circle roughly 25pt across, overlapping the
                 label beside it. Founder: *"the I icon looks weird."*

                 ⚠️ SAME CLASS AS THE NAV PILL THE SAME MORNING — a visual
                 property set on the element that also carries the geometry.
                 **When the visual and the hit area are different sizes they must
                 be different elements.** The button is now invisible and the
                 glyph carries the ring. */
              style={{ opacity: 0.75, color: 'inherit' }}
              icon={
                <span aria-hidden style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: '15px', height: '15px', boxSizing: 'border-box',
                  border: '1.2px solid currentColor', borderRadius: '50%',
                  fontSize: '9.5px', fontWeight: 800, lineHeight: 1,
                }}>i</span>
              }
            />
          )}
        </span>
        <span style={{ fontFamily: FONT, fontSize: '11px', fontWeight: 700, color: accent, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {totalStr}{zoneStr ? ` · ${zoneStr}` : ''}
        </span>
      </div>
      {paceStr && (
        <div style={{ fontFamily: FONT, fontSize: '11px', color: 'var(--mute)', padding: '6px 13px 0', fontVariantNumeric: 'tabular-nums' }}>
          Conversational · {paceStr}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        {/* connector line through the number gutter */}
        <span aria-hidden style={{ position: 'absolute', left: '23px', top: '16px', bottom: '16px', width: '1.5px', background: 'var(--line)', zIndex: 0 }} />
        {children}
      </div>
    </div>
  )
}

// ── component ────────────────────────────────────────────────────────────────

export default function SessionSteps({
  structure, derivedSet, sessionType, displayZones, zoneRangeLabel,
  metric, preferredUnits, sessionDistanceKm, easyPaceStr, onInfo,
}: SessionStepsProps) {
  const peak = displayZones.length ? displayZones[displayZones.length - 1] : 3
  const mainAccent = peak >= 5 ? 'var(--s-inter)' : peak >= 4 ? 'var(--s-quality)' : 'var(--s-quality)'
  const workDot = mainAccent

  // Global numbering across the whole session; first row of each main-set block
  // carries the number, later rows in that block are blank (they are one step).
  let n = 0
  const nextNum = () => ++n

  // SESSION-RECONCILE-01 — reconciled per-phase figures. warm-up + main-set +
  // cool-down sum to the session total exactly, and (on an MP long run) the
  // main set's easy + race-pace rows sum to the main-set total. Single owner:
  // resolveDisplayFigures (pure, corpus-tested).
  const figures = resolveDisplayFigures(structure, {
    metric, units: preferredUnits, sessionDistanceKm,
  })
  const wuTotal = figures.warmup
  const mainTotal = figures.mainSet
  const cdTotal = figures.cooldown
  const seg = structure.race_pace_segment
  // PACE-UNITS-STEPS-01 — `seg.pace_target` is baked `/km` like every other
  // stored pace. The MP long run is the one row on this card that carries a
  // single goal pace rather than a band, so an unconverted one is the most
  // consequential number on the screen for a time-target runner.
  const racePacePace = (convertPaceString(seg?.pace_target, preferredUnits) ?? seg?.pace_target) ?? ''
  const racePaceDetail = seg
    ? (metric === 'distance' ? `${formatDuration(seg.duration_mins)} · ${racePacePace}` : racePacePace)
    : ''

  // 🔴 SESSION-DIST-UNITS-01 — the `??` fallback used to be `${km}${preferredUnits}`,
  // i.e. an UNCONVERTED km value wearing the reader's unit suffix. It only fires
  // when `formatDistance` returns null (null/NaN input), so it could never
  // render a useful number anyway — it would have printed "undefinedmi". A bare
  // em dash is the app's no-value placeholder and is exempt from the em-dash
  // rule as typography rather than prose.
  // ONE PRODUCER FOR THE ROWS (SESSION-STEP-LEGIBILITY-01 regression pass).
  // `buildSessionRows` returns every row this card renders, in order, and the
  // gate asserts over the SAME call. A test that rebuilt the composition would
  // be a second writer of the card's shape — the class this repo keeps paying
  // for — and it is what left 88.3% of sessions untested on the first pass.
  const rows = buildSessionRows(structure, derivedSet, {
    metric, units: preferredUnits,
    formatDist: (km) => formatDistance(km, preferredUnits, { exact: true }) ?? '—',
    figures, raceSegmentDetail: racePaceDetail,
  })
  const section = (name: SessionRow['section']) => rows.filter(r => r.section === name)

  return (
    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ ...MICRO_LABELS.eyebrow, fontFamily: FONT, color: 'var(--mute)', marginBottom: 'var(--space-3)' }}>Session structure</div>

      {/* Warm-up */}
      <SectionCard name="Warm-up" accent="var(--moss)" tintPct={13} totalStr={wuTotal} zoneStr={structure.warmup.zone} paceStr={easyPaceStr}>
        {section('warmup').map((r, i) => (
          <StepRowView key={i} num={nextNum()} dotColor="var(--moss)" row={r.row} />
        ))}
      </SectionCard>

      {/* Main set */}
      <SectionCard name="Main set" accent={mainAccent} tintPct={peak >= 5 ? 13 : 15} totalStr={mainTotal} zoneStr={zoneRangeLabel} info={onInfo}>
        {section('main').map((r, i) => (
          <React.Fragment key={i}>
            {r.startsGroup && r.repeat && r.repeat > 1 && (
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', padding: '8px 13px 8px 44px', background: 'var(--bg-soft)' }}>
                <span style={{ fontFamily: FONT, fontSize: '15px', fontWeight: 800, fontStyle: 'italic', color: mainAccent, fontVariantNumeric: 'tabular-nums' }}>{r.repeat}×</span>
                <span style={{ fontFamily: FONT, fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>{r.repeatLabel}</span>
              </div>
            )}
            {/* ✋ EVERY ROW OF A MULTI-STEP BLOCK IS NUMBERED, not only the first
                (Design Board re-sitting, 2026-10-06). The row's left edge lost its
                anchor when the role word went, and these steps are parts of ONE
                effort in sequence — the ordinal IS the information. Zero pixel
                cost: the 20px column already exists and was being blanked. */}
            <StepRowView num={nextNum()} dotColor={workDot} row={r.row} />
          </React.Fragment>
        ))}
      </SectionCard>

      {/* Cool-down */}
      <SectionCard name="Cool-down" accent="var(--s-strength)" tintPct={13} totalStr={cdTotal} zoneStr={structure.cooldown.zone} paceStr={easyPaceStr}>
        {section('cooldown').map((r, i) => (
          <StepRowView key={i} num={nextNum()} dotColor="var(--s-strength)" row={r.row} />
        ))}
      </SectionCard>
    </div>
  )
}
