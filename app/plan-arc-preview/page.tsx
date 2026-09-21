// PLAN-ARC-V2 — `PlanArc` in every state, over REAL generated plans.
//
// Started life as the four-candidate comparison the SLT judged on
// 2026-09-21 (flat / ridge / ridge+rail / phase-track-only). The ruling is
// made — ridge plus rail, phase-track-only killed permanently — so the page
// is now what it should have been all along: the fixture for a component
// that otherwise only renders behind auth on the Plan screen.
//
// That is this repo's standing pattern and it has earned itself four times:
// `/coach-preview` exists because the race arc was documented, commented and
// never built, and nobody could SEE it; the guide preview found two defects
// no test could reach in one look. A surface nobody can look at does not get
// reviewed.
//
// Committed but unreachable in production, same as the others.

import { notFound } from 'next/navigation'
import PlanArc from '@/components/shared/PlanArc'
import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { planArcSeries } from '@/lib/plan/weekVolume'
import { phaseDisplayLabel } from '@/lib/coaching/weekVoice'
import { formatDistance } from '@/lib/format'

/** Longest and shortest we ship, plus two in between: "does it scale" is the
 *  first question, and an 18-week plan gives each bar ~14px at the Plan
 *  screen's 320px content width. */
const REAL = [
  'sub-4-hour-marathon-plan',      // 18 weeks
  'marathon-16-week',
  'sub-2-hour-half-marathon-plan', // 14 weeks
  '5k-12-week',
] as const

function build(slug: string) {
  const src = MARKETING_PLANS.find(p => p.slug === slug)
  if (!src) return null
  const { planStart, raceDate } = planAnchor(src.dayOffset)
  const plan = generateRulePlan(src.input(raceDate), 'free', planStart)
  const series = planArcSeries(plan.weeks)
  return {
    slug,
    km: series.km,
    phase: series.phase.map(phaseDisplayLabel),
    totalWeeks: plan.weeks.length,
    deloads: plan.weeks
      .map((w, i) => ({ n: w.n ?? i + 1, dl: (w as unknown as { type?: string }).type === 'deload' }))
      .filter(x => x.dl).map(x => x.n),
  }
}

function Frame({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: 320, background: 'var(--card)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)', padding: 16,
    }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 12 }}>
        {title}
      </div>
      {children}
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--mute)', lineHeight: 1.5, margin: '14px 0 0' }}>
        {note}
      </p>
    </div>
  )
}

export default function PlanArcPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const plans = REAL.map(build).filter((p): p is NonNullable<ReturnType<typeof build>> => p !== null)
  const base = plans.find(p => p.slug === 'marathon-16-week') ?? plans[0]

  /** Synthetic edge cases. Real plans cannot produce these, and a fixture
   *  that only shows the happy corpus is the sampling failure this repo has
   *  now recorded three times against the liveness harness. */
  const edges = [
    {
      title: 'Week 1 — nothing done yet',
      note: 'No moss except the current bar. The whole shape is ahead of the runner, which is the state the anticipation argument was made about.',
      props: { totalWeeks: base.totalWeeks, currentWeek: 1, doneWeeks: 0, weekKm: base.km, weekPhase: base.phase, raceWeek: base.totalWeeks },
    },
    {
      title: 'Race week — the last bar is current',
      note: 'The tick sits under the race bar. Race week is SHORT because trainingKm strips the race out: you barely train that week, and drawing the race in would make it the tallest bar of the taper.',
      props: { totalWeeks: base.totalWeeks, currentWeek: base.totalWeeks, doneWeeks: base.totalWeeks - 1, weekKm: base.km, weekPhase: base.phase, raceWeek: base.totalWeeks },
    },
    {
      title: 'No phases — rail hidden',
      note: 'A plan whose weeks carry no phase renders the ridge alone rather than an empty rail with blank labels.',
      props: { totalWeeks: 8, currentWeek: 3, doneWeeks: 2, weekKm: [30, 34, 37, 26, 38, 41, 30, 22], weekPhase: Array<string | null>(8).fill(null) },
    },
    {
      title: 'Maintenance — ADR-013 raw keys',
      note: 'phaseDisplayLabel turns maintenance_restoration into "Restoration". Without it CSS uppercases the raw key onto the rail, which is the defect the old joined chain was fixed for.',
      props: {
        totalWeeks: 6, currentWeek: 4, doneWeeks: 3,
        weekKm: [24, 26, 22, 28, 30, 27],
        weekPhase: (['maintenance_restoration', 'maintenance_restoration', 'maintenance_base', 'maintenance_base', 'maintenance_base', 'maintenance_base'] as string[]).map(phaseDisplayLabel),
      },
    },
    {
      title: 'One-week phase in a long plan — the narrowest a label ever gets',
      note: 'An 18-week plan with a single peak week gives that segment ~15px. The label ellipsises rather than overflowing into its neighbour. This is the worst case the rail can be asked to render.',
      props: {
        totalWeeks: 18, currentWeek: 12, doneWeeks: 11,
        weekKm: [30, 33, 36, 26, 37, 40, 43, 30, 44, 46, 48, 50, 38, 40, 34, 26, 19, 12],
        weekPhase: ([
          ...Array<string>(5).fill('foundation'),
          ...Array<string>(6).fill('base'),
          'peak',
          ...Array<string>(6).fill('taper'),
        ]).map(phaseDisplayLabel),
      },
    },
    {
      title: 'Flat plan — every week identical',
      note: 'The degenerate case the old component drew for EVERY plan. Here it is honest: a plan with no periodisation really does look like this.',
      props: { totalWeeks: 8, currentWeek: 4, doneWeeks: 3, weekKm: Array<number>(8).fill(30), weekPhase: Array<string | null>(8).fill('Base') },
    },
  ]

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '40px 24px 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 28, fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>
          PlanArc &mdash; states
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 680, margin: '0 0 36px' }}>
          Every card is 320px, the Plan screen&rsquo;s own content width. Bar height is
          <strong> training</strong> volume. The rail names the phases at the widths they
          actually occupy, which is why the label row no longer carries the chain.
        </p>

        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
          Real generated plans
        </h2>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 48 }}>
          {plans.map(p => (
            <Frame
              key={p.slug}
              title={`${p.slug} · ${p.totalWeeks} weeks`}
              // ADR-015: `lib/format.ts` owns every distance string, fixture
              // pages included. Welding `km` onto an interpolated value here
              // failed `hardcodedUnits.test.ts`, correctly — the rule is
              // absolute rather than scoped to runner-facing surfaces, which
              // is the only version of it that stays true.
              note={`Peak ${formatDistance(Math.max(...p.km), 'km')}. Deloads at w${p.deloads.join(', w')}${p.deloads[0] <= 2 ? ': note the week-2 notch, which is §119, a one-week opening loading block, visible here for the first time.' : '.'}`}
            >
              <PlanArc
                totalWeeks={p.totalWeeks}
                currentWeek={Math.min(6, p.totalWeeks)}
                doneWeeks={Math.min(5, p.totalWeeks - 1)}
                weekKm={p.km}
                weekPhase={p.phase}
                raceWeek={p.totalWeeks}
              />
            </Frame>
          ))}
        </div>

        <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 16px' }}>
          Edge cases
        </h2>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {edges.map(e => (
            <Frame key={e.title} title={e.title} note={e.note}>
              <PlanArc {...e.props} />
            </Frame>
          ))}
        </div>
      </div>
    </main>
  )
}
