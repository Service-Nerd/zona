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
import type { SessionStructure } from '@/lib/plan/sessionComposer'
import type { DerivedSet } from '@/lib/plan/resolveMainSet'
import { buildStepGroups, type StepRow } from '@/lib/plan/sessionSteps'
import { formatDistance } from '@/lib/format'
import type { Zone } from '@/components/shared/ZoneBar'

/** Narrow the Session's `unknown` derived_set to a renderable v2 set. */
function isV2DerivedSet(ds: DerivedSet | null | undefined): ds is DerivedSet {
  return !!ds && (ds as { version?: number }).version === 2 && Array.isArray((ds as { blocks?: unknown }).blocks) && (ds as DerivedSet).blocks.length > 0
}

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

function metricStr(
  distanceKm: number | undefined,
  durationMins: number,
  metric: 'distance' | 'duration',
  units: 'km' | 'mi',
): string {
  const dist = distanceKm != null ? `~${formatDistance(distanceKm, units) ?? ''}` : null
  const dur = durationMins ? `${durationMins} min` : null
  return (metric === 'distance' ? (dist ?? dur) : (dur ?? dist)) ?? ''
}

// ── row + card primitives ────────────────────────────────────────────────────

function StepRowView({ num, dotColor, row }: { num: number | null; dotColor: string; row: StepRow }) {
  const isRest = row.kind === 'rest'
  return (
    <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', gap: '11px', padding: '11px 13px', borderTop: '1px solid var(--line)' }}>
      <span style={{ flex: 'none', width: '20px', textAlign: 'center', fontSize: '14px', fontWeight: 800, fontStyle: 'italic', color: 'var(--mute-2)', fontVariantNumeric: 'tabular-nums', background: 'var(--card)' }}>
        {num ?? ''}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '9px', paddingTop: '1px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', flex: 'none', background: isRest ? 'transparent' : dotColor, border: isRest ? '1.5px solid var(--mute-2)' : 'none' }} />
          <span style={{ fontSize: '13px', fontWeight: isRest ? 600 : 700, color: isRest ? 'var(--ink-2)' : 'var(--ink)' }}>{row.role}</span>
        </div>
        <div style={{ textAlign: 'right', flex: 'none' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: isRest ? 'var(--ink-2)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{row.amount}</div>
          {row.detail && <div style={{ fontSize: '11px', color: 'var(--mute)', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>{row.detail}</div>}
        </div>
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
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', marginTop: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 13px', background: tint(accent, tintPct) }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: FONT, fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: accent }}>
          {name}
          {info && (
            <button type="button" onClick={info} aria-label={`${name} — tap to learn`} style={{ all: 'unset', cursor: 'pointer', width: '15px', height: '15px', borderRadius: '50%', border: '1.2px solid currentColor', fontSize: '9.5px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', opacity: 0.75 }}>i</button>
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
  metric, preferredUnits, easyPaceStr, onInfo,
}: SessionStepsProps) {
  const peak = displayZones.length ? displayZones[displayZones.length - 1] : 3
  const mainAccent = peak >= 5 ? 'var(--s-inter)' : peak >= 4 ? 'var(--s-quality)' : 'var(--s-quality)'
  const workDot = mainAccent

  // Global numbering across the whole session; first row of each main-set block
  // carries the number, later rows in that block are blank (they are one step).
  let n = 0
  const nextNum = () => ++n

  const wuTotal = metricStr(structure.warmup.distance_km, structure.warmup.duration_mins, metric, preferredUnits)
  const mainTotal = metricStr(structure.main.distance_km, structure.main.duration_mins, metric, preferredUnits)
  const cdTotal = metricStr(structure.cooldown.distance_km, structure.cooldown.duration_mins, metric, preferredUnits)

  const groups = isV2DerivedSet(derivedSet)
    ? buildStepGroups(derivedSet, { metric, formatDist: (km) => formatDistance(km, preferredUnits, { exact: true }) ?? `${km}${preferredUnits}` })
    : null

  return (
    <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
      <div style={{ fontFamily: FONT, fontSize: '10px', color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>Session structure</div>

      {/* Warm-up */}
      <SectionCard name="Warm-up" accent="var(--moss)" tintPct={13} totalStr={wuTotal} zoneStr={structure.warmup.zone} paceStr={easyPaceStr}>
        <StepRowView num={nextNum()} dotColor="var(--moss)" row={{ kind: 'work', role: 'Easy run', amount: wuTotal, amountIsEstimate: true, detail: 'Final third in Z2' }} />
        {structure.strides && (
          <StepRowView num={nextNum()} dotColor="var(--moss)" row={{ kind: 'work', role: 'Strides', amount: `${structure.strides.count} × ${structure.strides.duration_secs}s`, amountIsEstimate: false, detail: 'fast & relaxed, full recovery' }} />
        )}
      </SectionCard>

      {/* Main set */}
      <SectionCard name="Main set" accent={mainAccent} tintPct={peak >= 5 ? 13 : 15} totalStr={mainTotal} zoneStr={zoneRangeLabel} info={onInfo}>
        {groups
          ? groups.map((g, gi) => (
              <React.Fragment key={gi}>
                {g.repeat > 1 && (
                  <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'baseline', gap: '9px', padding: '8px 13px 8px 44px', background: 'var(--bg-soft)' }}>
                    <span style={{ fontFamily: FONT, fontSize: '15px', fontWeight: 800, fontStyle: 'italic', color: mainAccent, fontVariantNumeric: 'tabular-nums' }}>{g.repeat}×</span>
                    <span style={{ fontFamily: FONT, fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>{g.repeatLabel}</span>
                  </div>
                )}
                {g.rows.map((row, ri) => (
                  <StepRowView key={ri} num={ri === 0 ? nextNum() : null} dotColor={workDot} row={row} />
                ))}
              </React.Fragment>
            ))
          : (
            <StepRowView num={nextNum()} dotColor={workDot} row={{ kind: 'work', role: 'Main set', amount: mainTotal, amountIsEstimate: true, detail: structure.main.description }} />
          )}
        {structure.race_pace_segment && (
          <StepRowView num={null} dotColor={workDot} row={{ kind: 'work', role: 'Race pace', amount: `${structure.race_pace_segment.duration_pct}%`, amountIsEstimate: false, detail: structure.race_pace_segment.pace_target }} />
        )}
      </SectionCard>

      {/* Cool-down */}
      <SectionCard name="Cool-down" accent="var(--s-strength)" tintPct={13} totalStr={cdTotal} zoneStr={structure.cooldown.zone} paceStr={easyPaceStr}>
        <StepRowView num={nextNum()} dotColor="var(--s-strength)" row={{ kind: 'rest', role: 'Easy jog / walk', amount: cdTotal, amountIsEstimate: true, detail: 'conversational or slower' }} />
      </SectionCard>
    </div>
  )
}
