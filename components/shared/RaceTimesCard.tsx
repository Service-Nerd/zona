'use client'

// Race projections card. Same data, three surfaces:
//   - Coach screen (variant="status")  — canonical home; "Where you stand today".
//   - Benchmark entry (variant="anchor") — "Where you are now", anchor for the
//                                          recalibrate form rendered below it.
//   - Benchmark result (variant="result") — post-update confirmation.
//
// Fetches /api/race-times on mount. All copy lives in raceProjectionsCopy.ts —
// nothing user-facing is hardcoded in this component.
//
// R31 — target race shown at top with improvement delta vs plan-creation baseline.
// R32 — recalibration nudge shown at bottom when fitness has moved significantly.
//       Only rendered on variant="status" (the other variants ARE recalibration).
//
// TIER: server route gates by tier; on free this won't be rendered (the Coach
// screen swaps in CoachTeaser, and the benchmark flow is paid-only).

import { useEffect, useMemo, useState } from 'react'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { formatClockTime } from '@/lib/format'
import { buildRaceProgressArc } from '@/lib/coaching/raceProgressArc'
import { RaceProgressArcRow } from './RaceProgressArcRow'
import { RACE_PROJECTIONS_COPY, type RaceProjectionsVariant } from './raceProjectionsCopy'

type TargetRace = {
  distanceKm:      number
  raceName:        string
  ultraDistance:   boolean
  currentSeconds:  number | null
  baselineSeconds: number | null
  goalSeconds:     number | null
  /** The arc's own points. May sit at a DIFFERENT distance from the race when
   *  the race distance cannot be projected (ultra). */
  arc: {
    distanceKm:      number
    atLabel:         string | null
    baselineSeconds: number | null
    baselineLabel:   string
    currentSeconds:  number
    goalSeconds:     number | null
  } | null
  deltaSeconds:    number | null
  deltaFormatted:  string | null
  improved:        boolean | null
}

type RaceTimeData = {
  state:      1 | 2 | 3 | 4 | 5
  confidence: 'high' | 'moderate' | 'low' | null
  label:      string | null
  source:     'benchmark' | 'strava' | 'wizard' | 'none'
  vdot?:      number
  distances:  Array<{ distanceKm: number; label: string; timeSeconds: number; formattedTime: string }> | null
  target:     TargetRace | null
  recalibrationSuggested: boolean
  upgradeCtaType: 'benchmark' | 'strava' | 'both' | null
  stravaQualifyingRunCount?: number
}

export function RaceTimesCard({
  variant = 'status',
  stravaConnected,
  benchmarkRecalDismissedAt,
  onOpenBenchmark,
  onDismissRecal,
  previewData,
}: {
  /** Surface this card is rendered on — drives copy framing. Defaults to `status` (Coach screen). */
  variant?:                   RaceProjectionsVariant
  stravaConnected:           boolean
  benchmarkRecalDismissedAt?: string | null
  onOpenBenchmark?:          () => void
  onDismissRecal?:           () => void
  /** Fixture seam for `/coach-preview` ONLY. When set, the card renders this
   *  instead of fetching. This card is PAID and auth-gated, so every state of
   *  it was previously unviewable without being a user in that state — which
   *  is how the wizard-bracket state, the MAJORITY path at 58% of plans, went
   *  unexamined until the founder read it on a test account. Never passed from
   *  the app. */
  previewData?:              RaceTimeData
}) {
  const [data, setData]       = useState<RaceTimeData | null>(previewData ?? null)
  const [loading, setLoading] = useState(!previewData)
  const [error, setError]     = useState<string | null>(null)
  // Progressive disclosure (UX-COACH-01 polish): when the arc is the hero, the
  // per-distance reference table collapses behind a tap so the runner's own
  // race trajectory leads and the race-distance row isn't echoed. Default
  // closed — the founder's ask: "clickable / drops down when we click it".
  const [distancesOpen, setDistancesOpen] = useState(false)
  const copy = RACE_PROJECTIONS_COPY[variant]

  useEffect(() => {
    if (previewData) return
    authedFetch('/api/race-times')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed')
        setData(await res.json())
      })
      .catch(() => setError('Could not load race projections.'))
      .finally(() => setLoading(false))
  }, [previewData])

  // R32: recal nudge is visible when (a) variant supports it — only `status`
  // does, since `anchor`/`result` ARE the recalibrate flow — (b) the route
  // suggests it, and (c) the user hasn't dismissed recently (within 21 days).
  const showRecalNudge = (() => {
    if (!copy.recal) return false
    if (!data?.recalibrationSuggested || !onOpenBenchmark) return false
    if (!benchmarkRecalDismissedAt) return true
    const dismissedMs = new Date(benchmarkRecalDismissedAt).getTime()
    const daysSince   = (Date.now() - dismissedMs) / 86_400_000
    return daysSince > 21
  })()

  // ── The arc (UX-COACH-01) ───────────────────────────────────────────────
  // Shape is decided by the pure owner so it is testable; this component only
  // draws it. `arcCopy` is undefined on the anchor/result variants by design,
  // which is what suppresses the arc there rather than a variant check here.
  const arcCopy = copy.arc
  // ⚠️ NO LONGER SUPPRESSED FOR ULTRAS. Refusing a 100 km finish time and
  // refusing the runner's whole fitness trajectory are two different refusals,
  // and only the first is honest — the card already prints their marathon row.
  // The route drops the arc to the nearest projectable distance and labels it.
  const arc = useMemo(() => {
    if (!arcCopy || !data?.target?.arc) return null
    return buildRaceProgressArc({
      baselineSeconds: data.target.arc.baselineSeconds,
      currentSeconds:  data.target.arc.currentSeconds,
      goalSeconds:     data.target.arc.goalSeconds,
    })
  }, [arcCopy, data])

  /** Column labels, with the baseline's overridden by the route when it was
   *  derived from runs (a month) rather than stamped at plan creation. */
  const arcLabels = useMemo(() => {
    if (!arcCopy) return null
    return { ...arcCopy, was: data?.target?.arc?.baselineLabel || arcCopy.was }
  }, [arcCopy, data])

  function confidenceChipStyle(c: 'high' | 'moderate' | 'low') {
    const isHigh = c === 'high'
    return {
      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 600 as const,
      color:      isHigh ? 'var(--moss)' : 'var(--mute)',
      textTransform: 'uppercase' as const, letterSpacing: '0.06em',
      background: isHigh ? 'rgba(107,142,107,0.12)' : 'rgba(138,133,125,0.10)',
      borderRadius: '10px', padding: '2px 8px',
    }
  }

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '20px' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
        {copy.eyebrow}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[100, 75, 90, 80].map((w, i) => (
            <div key={i} style={{ height: '14px', background: 'var(--bg-soft)', borderRadius: '4px', width: `${w}%` }} />
          ))}
        </div>

      ) : error || !data || data.state === 5 ? (
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500, color: 'var(--ink-2)', marginBottom: '6px' }}>
            {copy.empty.heading}
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.6, margin: 0 }}>
            {stravaConnected ? copy.empty.bodyWithStrava : copy.empty.bodyWithoutStrava}
          </p>
        </div>

      ) : (
        <>
          {/* ── Source label + confidence chip ───────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.45, flex: 1 }}>
              {data.label}
            </span>
            {data.confidence && (
              <span style={confidenceChipStyle(data.confidence)}>
                {data.confidence}
              </span>
            )}
          </div>

          {/* ── THE ARC — where I was · where I am · what I'm aiming at ──
              UX-COACH-01 (2026-09-12). This replaces a single number plus a
              delta chip. `baselineSeconds` was already being sent by the route
              and typed by this component, and NOTHING DREW IT: the runner's
              starting point existed in the payload and never reached the
              screen. `goalSeconds` is new — the route had never read
              `meta.target_time` at all, so the third point did not exist.

              §109 bounds it: remember and compare, never predict. Every point
              is a fact the runner already owns. Shape decisions live in
              `lib/coaching/raceProgressArc.ts` and are unit-tested there. ── */}
          {data.target && (() => {
            // UX-COACH-01 polish (2026-09-13): an ultra's arc has dropped to the
            // nearest projectable distance (marathon), so the hero is NOT the
            // runner's race time — VDOT cannot stand behind a 100 km clock. Frame
            // it honestly as aerobic fitness; the race NAME moves into the caveat
            // rather than headlining a marathon time. Non-ultra is unchanged: the
            // arc genuinely is at the race distance, so "Your race" still holds.
            const isUltraArc = !!(arc && arcLabels && data.target.ultraDistance)
            const eyebrow = arcLabels
              ? (isUltraArc ? arcLabels.ultraEyebrow : arcLabels.raceEyebrow)
              : 'Your race'
            const subline = isUltraArc && arcLabels && data.target.arc?.atLabel
              ? arcLabels.ultraSubline.replace('{distance}', data.target.arc.atLabel)
              : data.target.raceName
            return (
            <div style={{
              background: 'var(--bg-soft)',
              borderRadius: '10px',
              borderLeft: '3px solid var(--s-race)',
              padding: '12px 14px',
              marginBottom: '14px',
            }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                {eyebrow}
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--ink-2)', marginBottom: arc ? '14px' : '8px' }}>
                {subline}
              </div>

              {arc && arcLabels ? (
                <>
                  <RaceProgressArcRow arc={arc} copy={arcLabels} />
                  {/* The honest caveat for an ultra: the race is too long to
                      project, so the numbers are aerobic fitness, not a finish
                      time. Below the arc, not above: the numbers are the point
                      and the caveat qualifies them. Names the race here so the
                      runner's own event still appears, just not as a headline
                      over a distance they are not racing. */}
                  {isUltraArc && (
                    <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11.5px', color: 'var(--mute)', lineHeight: 1.45, margin: '12px 0 0' }}>
                      {arcLabels.atDistance.replace('{race}', data.target.raceName)}
                    </p>
                  )}
                </>
              ) : data.target.ultraDistance ? (
                /* No arc to show either — the honest note stands alone. */
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55, margin: 0 }}>
                  Ultra finish times depend on terrain, conditions, and pacing, not pace-based formulas.
                  The projections below are still accurate for your training.
                </p>
              ) : (
                /* No measured present — the arc needs a "now" to be an arc.
                   Falls back to the plain current estimate rather than nothing. */
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.8px', lineHeight: 1 }}>
                  {formatClockTime(data.target.currentSeconds) ?? '—'}
                </div>
              )}
            </div>
            )
          })()}

          {/* ── RACE-PROJ-LEAD-01: the bracket estimate leads with the action ──
              State 4 only. The numbers below it are a lookup table indexed on
              two wizard answers, so the useful content on this state is not the
              figures — it is the one thing that replaces them with a
              measurement. Same pill CTA as the recalibration nudge below: one
              visual language for "do this thing" inside this card. ── */}
          {data.source === 'wizard' && copy.bracket && (
            <div style={{ marginBottom: '4px' }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 10px' }}>
                {copy.bracket.body}
              </p>
              {onOpenBenchmark && (
                <button
                  onClick={onOpenBenchmark}
                  style={{
                    fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                    color: 'var(--moss)', background: 'rgba(107,142,107,0.10)',
                    border: 'none', borderRadius: '20px', padding: '7px 14px',
                    minHeight: '36px', cursor: 'pointer',
                  }}
                >
                  {copy.bracket.cta}
                </button>
              )}
            </div>
          )}

          {/* ── Estimated times per distance ──────────────────────────────
              UX-COACH-01 polish (2026-09-13). Progressive disclosure: when the
              arc is the hero (the runner's OWN race trajectory), this reference
              table collapses behind a tap — it stops the screen reading as a
              calculator and removes the duplication where the race-distance row
              echoes the arc's "now". When there is no arc (benchmark/result
              variants, or no target race), the table IS the content and stays
              open. Chevron convention matches the readiness disclosure
              (▾ collapsed / ▴ expanded). ── */}
          {data.distances && data.distances.length > 0 && (() => {
            const arcShown = !!(arc && arcLabels)
            // RACE-PROJ-LEAD-01 (SLT 2026-09-17). The table also collapses when
            // the estimate is the WIZARD BRACKET (state 4) — the state with the
            // least evidence behind it was the one showing the most numbers,
            // full width, because the 2026-09-13 disclosure keyed on the ARC
            // and state 4 has none. `source` is the route's own structural
            // discriminator, so this is not inferred from confidence.
            const isBracket = data.source === 'wizard'
            const toggleLabel = isBracket
              ? (copy.bracket?.toggle ?? arcLabels?.distancesToggle ?? '')
              : (arcLabels?.distancesToggle ?? '')
            const rows = (
              <div style={{ marginTop: arcShown ? '4px' : 0 }}>
                {data.distances!.map((d, i) => (
                  <div
                    key={d.label}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '9px 0',
                      borderBottom: i < (data.distances?.length ?? 0) - 1 ? '1px solid var(--line)' : undefined,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>
                      {d.label}
                    </span>
                    <span style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: 600, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.2px' }}>
                      {d.formattedTime}
                    </span>
                  </div>
                ))}
              </div>
            )

            // The table is the primary content only when something the runner
            // actually ran is behind it.
            if (!arcShown && !isBracket) return rows

            return (
              <div>
                <button
                  type="button"
                  onClick={() => setDistancesOpen(o => !o)}
                  aria-expanded={distancesOpen}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', minHeight: '44px', padding: '4px 0',
                    background: 'none', border: 'none', cursor: 'pointer', font: 'inherit',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink-2)' }}>
                    {toggleLabel}
                  </span>
                  <span aria-hidden style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', marginLeft: '12px' }}>
                    {distancesOpen ? '▴' : '▾'}
                  </span>
                </button>
                {distancesOpen && rows}
              </div>
            )
          })()}

          {/* Low-confidence prompt */}
          {/* State 4 says this at the TOP now (RACE-PROJ-LEAD-01), so repeating
              it underneath would be the two-tiles-one-cause mistake one screen
              over. State 3 HAS a benchmark, so its prompt stays where it is. */}
          {(data.state === 3 || (data.state === 4 && !copy.bracket)) && (() => {
            const message = data.state === 3
              ? copy.lowConf.withBenchmark
              : stravaConnected
                ? copy.lowConf.withoutBenchmarkStrava
                : copy.lowConf.withoutBenchmarkNoStrava
            if (!message) return null
            return (
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.55, margin: '12px 0 0' }}>
                {message}
              </p>
            )
          })()}

          {/* ── R32: recalibration nudge ─────────────────────────────── */}
          {showRecalNudge && copy.recal && (
            <div style={{
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid var(--line)',
            }}>
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6, margin: '0 0 10px' }}>
                {copy.recal.body}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                  onClick={onOpenBenchmark}
                  style={{
                    fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600,
                    color: 'var(--moss)', background: 'rgba(107,142,107,0.10)',
                    border: 'none', borderRadius: '20px', padding: '7px 14px',
                    cursor: 'pointer',
                  }}
                >
                  {copy.recal.cta}
                </button>
                <button
                  onClick={onDismissRecal}
                  style={{
                    fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400,
                    color: 'var(--mute)', background: 'none', border: 'none',
                    padding: '0', cursor: 'pointer',
                  }}
                >
                  {copy.recal.dismiss}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
