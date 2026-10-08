// RESHAPE-MOMENT-02 — the adaptive engine, on the page, doing its actual job.
//
// 🧭 DESIGN BOARD 2026-10-08 (`RESHAPE-MOMENT-01`): SHIP. The founder asked for a list of
// the eight signals the engine watches. That was ruled **DON'T SHIP, PERMANENT** — it is the
// three-card proof band and W-03's commitments block in one artefact, and "a block of
// promises is the weakest instrument against an evidence question." Seven of the eight have
// never fired in production, so a list of eight would be a promise about a population we
// have not observed, which is precisely why the proof band died.
//
// 🎪 Collins, which is the argument for what IS here: "a competitor can write 'we adapt your
// plan' this afternoon. What they cannot do is run their own engine on the page and print the
// sentence it produces."
//
// ── 🏃 COACHING BOARD 2026-10-08 — CORRECT WITH AMENDMENT (3) ────────────────
// Routed under W-03: a claim about what we detect is a coaching question.
//
//   1. THE SCENARIO IS LABELLED ON THE SURFACE. Hutchinson's W-04 condition — "use real
//      generated plans, or do not build it; the outcome half is where you will be tempted to
//      invent numbers" — and `SameWeekTwice` discharges it in copy, on the page: "an
//      illustration of two ways to run the week, not a measurement of anyone." Same here.
//   2. NO CLAIM OF A STRUCTURAL CHANGE, BECAUSE THERE IS NOT ONE. Measured:
//      `computeSessionDiff` over this trigger's own before/after returns **no structural
//      change**. zone_drift reinforces the ceiling and writes a note; it does not move a
//      session. "We tightened an instruction. Say that." (Hutchinson)
//   3. NO COUNT ON THE PAGE. One signal, working. Never "eight things we watch for".
//
// ⚕️ Sims' §124 clause binds here as it does in the app: this may say what was MEASURED and
// what CHANGED, and may never state a CAUSE.
// 🩹 Willy: no injury claim is made and none may be added.
// 📊 Seiler: 38% above ceiling is a real §12 measurement. Do not write "polarised" near it.
//
// ── WHAT IS REAL AND WHAT IS ILLUSTRATIVE, stated because the distinction is the ruling ──
//   REAL: the four sessions, their distances and zones — read from `generateRulePlan` at
//         render time out of the published 12-week half marathon plan, the same call
//         `/plans/half-marathon-12-week` makes.
//   REAL: the verdict sentence and the coach note. They are `checkAdjustmentTriggers`'
//         own output, the same function the app runs. If the engine's wording changes,
//         this changes with it, because it IS the engine's wording.
//   ILLUSTRATIVE: that the runner went above their ceiling. Nobody's heart rate is being
//         reported. Labelled on the page.
//
// ⚠️ NOT `surface="card"`. W-08 permits ONE white spotlight on the homepage and
// `SameWeekTwice` spends it on the proof at 24%. A second would be a rhythm, not a
// spotlight, and is a documented-rule regression Silvanto's seat could veto.
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { checkAdjustmentTriggers } from '@/lib/coaching/planAdjustment'
import { orderedWeekSessions } from '@/lib/plan/weekSessions'
import { ZONE_DRIFT_ABOVE_CEILING_PCT } from '@/lib/coaching/constants'
import { Section } from '@/components/marketing/Section'
import type { Session } from '@/types/plan'

const SOURCE_SLUG = 'half-marathon-12-week'
const SOURCE_WEEK = 5

/**
 * The illustrated week: every easy run came back this far above its own ceiling.
 *
 * ⚠️ ONE number, derived from the engine's OWN threshold rather than typed, so the
 * illustration cannot drift below the line it is meant to cross. `+18` puts it clearly
 * inside the trigger rather than on its edge, which is what makes the example legible.
 */
const ILLUSTRATED_ABOVE_PCT = ZONE_DRIFT_ABOVE_CEILING_PCT + 18

export function WhenItNotices() {
  const plan = MARKETING_PLANS.find(p => p.slug === SOURCE_SLUG)
  if (!plan) return null
  const { planStart, raceDate } = planAnchor(plan.dayOffset)
  const week = generateRulePlan(plan.input(raceDate), 'free', planStart)
    .weeks.find(w => w.n === SOURCE_WEEK)
  if (!week) return null

  const ordered = orderedWeekSessions(week)
  const running = ordered.filter(s => s.type !== 'rest')
  const plannedKm = ordered.reduce((sum, s) => sum + (s.distance_km ?? 0), 0)

  // The engine, run on this week. Same function the app calls.
  const proposed = checkAdjustmentTriggers({
    currentWeekN: week.n,
    totalWeeks:   12,
    currentWeekSessions: ordered,
    linkedKm: plannedKm, offPlanKm: 0, plannedKm,
    priorWeeksKm: [plannedKm, plannedKm, plannedKm, plannedKm],
    hrInZoneData: running
      .filter(s => s.type === 'easy')
      .map(() => ({ hrInZonePct: 40, aboveCeilingPct: ILLUSTRATED_ABOVE_PCT, actualLoadKm: 8 })),
    efTrendPct: null,
    adjustmentsThisWeek: 0,
    currentPhase: week.phase as 'base' | 'build' | 'peak' | 'taper' | undefined,
  })
  // If the engine ever stops firing on this input the block removes itself rather than
  // printing a stale sentence. Same posture as SameWeekTwice returning null on a missing week.
  if (!proposed) return null

  // The note the engine writes onto the easy run. Read from its own output, never typed.
  const noted = (proposed.sessionsAfter as Session[])
    .find(s => s.type === 'easy' && (s.coach_notes?.[0] ?? '').includes('ceiling'))
  const coachNote = noted?.coach_notes?.[0] ?? null

  return (
    <Section width="full" rhythm="none" innerStyle={{ padding: 'var(--sect-y) 24px' }}>
      <div style={{ maxWidth: 'var(--measure-page)', margin: '0 auto' }}>
        <div style={{
          fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--moss-strong)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)',
        }}>
          Adaptive coaching
        </div>
        <h2 style={{
          fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h2)',
          fontWeight: 600, lineHeight: 1.2, color: 'var(--ink)', margin: 0, maxWidth: 'var(--measure-read)',
        }}>
          Run your easy days hard.<br />
          <span style={{ color: 'var(--moss-strong)' }}>It notices, and it says so.</span>
        </h2>

        <p style={{
          fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.6,
          maxWidth: 'var(--measure-read)', marginTop: 'var(--space-4)',
        }}>
          Week {week.n} of the twelve week half marathon plan, exactly as the engine builds it.
        </p>

        <ul style={{
          listStyle: 'none', margin: 'var(--space-5) 0 0', padding: 0,
          fontSize: 'var(--fs-body)',
        }}>
          {running.map((s, i) => (
            <li key={`${s.label}-${i}`} style={{
              display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)',
              padding: 'var(--space-3) 0', borderBottom: '1px solid var(--line)',
            }}>
              <span style={{ color: 'var(--ink)' }}>{s.label}</span>
              <span style={{ color: 'var(--mute)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                {s.distance_km ? `${s.distance_km}km` : ''}
              </span>
            </li>
          ))}
        </ul>

        <p style={{
          fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.6,
          maxWidth: 'var(--measure-read)', marginTop: 'var(--space-5)',
        }}>
          Now suppose the easy runs come back with the heart rate sitting above its ceiling.
          This is what the engine writes, in its own words:
        </p>

        <blockquote style={{
          margin: 'var(--space-4) 0 0', padding: 'var(--space-4) var(--space-5)',
          borderLeft: '3px solid var(--moss)', background: 'var(--bg-soft)',
          borderRadius: '0 12px 12px 0',
        }}>
          <p style={{
            fontSize: 'var(--fs-lead)', color: 'var(--ink)', lineHeight: 1.45,
            margin: 0, fontWeight: 500,
          }}>
            {proposed.summary}
          </p>
          {coachNote && (
            <p style={{
              fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.6,
              margin: 'var(--space-3) 0 0',
            }}>
              {coachNote}
            </p>
          )}
        </blockquote>

        {/* 🏃 AMENDMENT 2, and it is the honest half. `computeSessionDiff` over this
            trigger returns NO STRUCTURAL CHANGE: the ceiling is reinforced and a note is
            written. Nothing is moved. A block implying we reshuffled the week would be
            claiming something the engine did not do. */}
        <p style={{
          fontSize: 'var(--fs-body)', color: 'var(--ink-2)', lineHeight: 1.6,
          maxWidth: 'var(--measure-read)', marginTop: 'var(--space-5)',
        }}>
          No session was moved. The week is the same week: the ceiling on it just stopped
          being a suggestion. Where the signal is bigger, the sessions do change, and you are
          asked first.
        </p>

        {/* 🏃 AMENDMENT 1 — Hutchinson's W-04 condition, discharged in copy on the surface,
            the way SameWeekTwice discharges it. */}
        <p style={{
          fontSize: 'var(--fs-caption)', color: 'var(--mute)', lineHeight: 1.6,
          maxWidth: 'var(--measure-read)', marginTop: 'var(--space-4)',
        }}>
          The sessions and the wording above are generated by the app as you read this. The
          runner is an illustration: nobody&rsquo;s heart rate is being reported here.
        </p>
      </div>
    </Section>
  )
}
