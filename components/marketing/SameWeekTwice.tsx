// W-04 (SLT 2026-09-21) — the same week, run two ways.
//
// The homepage asserted "the plan adjusts" and "Kit reads what you actually
// did" in single clauses and never showed either. The competitor device this
// came from proves flexibility by drawing a disrupted week reflowing. Ours
// proves the thing we actually sell: that the difference between a week held
// and a week run in the grey middle is VISIBLE, and the app says so.
//
// ⚠️ HUTCHINSON'S BINDING CONDITION, AND HOW IT IS MET.
// "Use real generated plans, or do not build it. The outcome half is where you
// will be tempted to invent numbers."
//
//   THE PRESCRIPTION IS REAL. The four sessions, their distances, zones, heart
//   -rate ceilings and pace bands are read from `generateRulePlan` at render
//   time, out of the published 12-week half marathon plan. Not transcribed,
//   not drawn: the same call `/plans/half-marathon-12-week` makes, so this
//   block cannot drift from the plan it cites.
//
//   THE VERDICT IS REAL. The two lines at the bottom are not copy. They are
//   `zoneWeekStatement()` — the function that writes that sentence inside the
//   app — run over the two sets of outcomes. If the product's wording changes,
//   this changes with it, because it IS the product's wording.
//
//   ⚠️ THE EXECUTION IS AN ILLUSTRATION AND IS LABELLED AS ONE. The heart
//   rates in the two columns are two ways a runner might run this week, not a
//   measurement of anyone. We have roughly three users; there is no honest
//   aggregate to quote and inventing one is exactly what the condition
//   forbids.
//
// ⚠️ AND IT MAKES NO OUTCOME CLAIM. It does not say the held week produces
// adaptation or the grey week wastes it. That is a claim about physiology, it
// belongs to W-03, and W-03 is with the Coaching Board. What this shows is
// that the app can tell the difference, which is a claim about the product and
// is demonstrably true.

import Link from 'next/link'
import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { zoneWeekStatement, classifyRun } from '@/lib/coaching/zoneWeekStatement'
import { formatDistance } from '@/lib/format'
import type { Session } from '@/types/plan'

const SOURCE_SLUG = 'half-marathon-12-week'
const SOURCE_WEEK = 5

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

/** Two ways to run the same week, as percentage of the run spent above its own
 *  ceiling. Illustrative by construction and labelled as such on the page. */
const GREY_ABOVE_PCT = [55, 40, 62, 30]
const HELD_ABOVE_PCT = [4, 0, 6, 2]

export function SameWeekTwice() {
  const plan = MARKETING_PLANS.find(p => p.slug === SOURCE_SLUG)
  if (!plan) return null
  const { planStart, raceDate } = planAnchor(plan.dayOffset)
  const week = generateRulePlan(plan.input(raceDate), 'free', planStart)
    .weeks.find(w => w.n === SOURCE_WEEK)
  if (!week) return null

  const sessions = DAY_ORDER
    .map(d => ({ day: d as string, s: week.sessions[d] }))
    .filter((x): x is { day: string; s: Session } => x.s != null)
  // The illustration is written for a four-session week. If the engine ever
  // produces a different shape here, render nothing rather than pair the wrong
  // heart rate with the wrong run.
  if (sessions.length !== GREY_ABOVE_PCT.length) return null

  const grey = zoneWeekStatement(GREY_ABOVE_PCT.map(classifyRun))
  const held = zoneWeekStatement(HELD_ABOVE_PCT.map(classifyRun))

  const col = (title: string, note: string, tone: 'grey' | 'held', pcts: number[], verdict: string) => (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
      padding: '20px 20px 18px', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div>
        <div style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', marginTop: 3 }}>{note}</div>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 9 }}>
        {sessions.map((x, i) => {
          const above = pcts[i]
          const drifted = classifyRun(above) === 'drifted'
          return (
            <li key={x.day} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 'var(--fs-sm)' }}>
              <span style={{ width: 30, flexShrink: 0, color: 'var(--mute)', fontWeight: 600 }}>{DAY_LABEL[x.day]}</span>
              <span
                aria-hidden
                style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  background: drifted ? 'var(--warn)' : 'var(--moss)',
                }}
              />
              <span style={{ color: 'var(--ink-2)', minWidth: 0 }}>
                {drifted ? `${above}% above the ceiling` : 'held the ceiling'}
              </span>
            </li>
          )
        })}
      </ul>

      {/* The product's own sentence, not marketing copy. */}
      <p style={{
        fontSize: 'var(--fs-body)', lineHeight: 1.5, margin: 0, paddingTop: 12,
        borderTop: '1px solid var(--line)',
        color: tone === 'grey' ? 'var(--warn)' : 'var(--moss)', fontWeight: 600,
      }}>
        {verdict}
      </p>
    </div>
  )

  return (
    <section style={{ padding: 'var(--sect-y) 24px' }}>
      <div style={{ maxWidth: 'var(--measure-page)', margin: '0 auto' }}>
        <div style={{
          fontSize: 'var(--fs-caption)', fontWeight: 700, color: 'var(--moss)',
          textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px',
        }}>
          The same week, twice
        </div>
        <h2 style={{
          fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h2)',
          fontWeight: 600, lineHeight: 1.2, color: 'var(--ink)', margin: 0, maxWidth: '720px',
        }}>
          One week, run two ways.<br />
          <span style={{ color: 'var(--moss)' }}>The app can tell.</span>
        </h2>
        <p style={{ fontSize: 'var(--fs-lead)', lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: '620px', margin: '14px 0 0' }}>
          These four sessions are week {SOURCE_WEEK} of{' '}
          <Link href={`/plans/${SOURCE_SLUG}`} style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
            my free 12-week half marathon plan
          </Link>
          , exactly as the engine builds them. Same prescription in both columns. The only
          difference is how hard the easy days get run.
        </p>

        {/* The prescription, once, because it is the same week both times. */}
        <div style={{
          background: 'var(--bg-soft)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', padding: '16px 18px', margin: '28px 0 16px',
        }}>
          <div style={{
            fontSize: 'var(--fs-eyebrow)', fontWeight: 700, color: 'var(--mute)',
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10,
          }}>
            What the plan asks for
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
            {sessions.map(x => (
              <li key={x.day} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 'var(--fs-sm)', flexWrap: 'wrap' }}>
                <span style={{ width: 30, flexShrink: 0, color: 'var(--mute)', fontWeight: 600 }}>{DAY_LABEL[x.day]}</span>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{x.s.label}</span>
                <span style={{ color: 'var(--mute)' }}>
                  {/* ADR-015 — `lib/format.ts` is the sole owner of every
                      distance string. PREF-SWEEP-01 caught this welded as
                      `${km} km` on the first write; the identical pattern one
                      file over in `PlanPage` is registered debt, which is
                      exactly why the guard blocks NEW instances rather than
                      trusting the surrounding code as an example. */}
                  {formatDistance(x.s.distance_km, 'km')}
                  {x.s.zone ? ` · ${x.s.zone}` : null}
                  {x.s.hr_target ? ` · ${x.s.hr_target}` : null}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '16px',
        }}>
          {col('Run on feel', 'Every run a bit hard, because they all felt fine at the time.', 'grey', GREY_ABOVE_PCT, grey.line)}
          {col('Run to the ceiling', 'Easy days kept genuinely easy, so the hard day has somewhere to go.', 'held', HELD_ABOVE_PCT, held.line)}
        </div>

        {/* W-01a — the guide's inbound link, and it is contextual rather than a
            hub card on purpose. The guides hub stays shut until there are
            three (Wood), but an approved guide is live from the day it is
            approved (Fried), so it needs a link that is genuinely useful
            rather than a directory entry. A reader who has just seen a week
            drift above its ceiling is the exact reader with this question. */}
        <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: '20px 0 0', maxWidth: '620px' }}>
          Wondering whether your easy runs are supposed to feel this slow?{' '}
          <Link href="/guides/should-easy-runs-feel-this-slow" style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>
            That is the whole question, and it has an answer &rarr;
          </Link>
        </p>

        <p style={{ fontSize: 'var(--fs-caption)', lineHeight: 1.5, color: 'var(--mute)', margin: '14px 0 0', maxWidth: '620px' }}>
          The sessions and their ceilings come from the plan itself. The two sets of heart-rate
          readings are an illustration of two ways to run the week, not a measurement of anyone.
        </p>
      </div>
    </section>
  )
}
