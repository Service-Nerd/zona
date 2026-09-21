// PLAN-ARC-V2 — the four candidates, side by side, over REAL generated plans.
//
// The founder on the shipped arc: "the block somewhere where you're at looks
// a bit dated. It looks a bit flat." Both halves are literally true, and the
// second one is a defect rather than a taste call:
//
//   PlanArc draws every week at `height: 100%`. It is called an ARC and it
//   draws a straight line. The strip sets `align-items: flex-end` — a
//   property that can only matter if something is SHORTER than full height,
//   so it has never had any effect. `ui-patterns.md` § 12 records it too.
//   The shape was intended and never wired: the same "declared but inert"
//   class as `--s-long`, D9's `flexShrink`, and the decorative-config family.
//
// This page exists because this repo keeps relearning that a surface nobody
// can see does not get reviewed (`/me-preview`, `/coach-preview`, the guide
// preview — four times now). The SLT is being asked to choose between these,
// so these have to be lookable-at.
//
// Committed but unreachable in production, same as /coach-preview.

import { notFound } from 'next/navigation'
import PlanArc from '@/components/shared/PlanArc'
import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { trainingKm } from '@/lib/plan/weekVolume'
import type { Plan } from '@/types/plan'

type WeekBar = {
  n: number
  km: number
  phase: string | undefined
  isRace: boolean
  isDeload: boolean
}

function bars(plan: Plan): WeekBar[] {
  return plan.weeks.map((w, i) => ({
    n: w.n ?? i + 1,
    // `trainingKm`, not `weekly_km` — the single owner of "how much did this
    // week TRAIN", written for MKT-PLAN-SHAPE-01 today. It strips the race
    // out of race week, which is exactly the spike a height-encoded bar
    // would otherwise draw as the biggest week of the taper.
    km: trainingKm(w),
    phase: (w as unknown as { phase?: string }).phase,
    // Race week: a race session is actually placed on it. `weekVolume.raceKm`
    // asks the same question the same way.
    isRace: Object.values(w.sessions ?? {}).some(s => (s as { type?: string } | null)?.type === 'race'),
    // ⚠️ `week.type === 'deload' || week.badge === 'deload'` is how the APP
    // decides (DashboardClient's `deloadWeekNumbers`). My first cut here read
    // `is_recovery_week`, a field the engine does not stamp, so every deload
    // silently vanished and the preview rendered "deloads w" with nothing
    // after it. A second reader of the same question, disagreeing — the exact
    // shape DELOAD-OWNER-01 exists to prevent.
    isDeload: (w as unknown as { type?: string; badge?: string }).type === 'deload'
      || (w as unknown as { badge?: string }).badge === 'deload',
  }))
}

/** Shared label row — unchanged from the shipped component in all variants. */
function LabelRow({ totalWeeks, currentWeek, phaseLabel }: { totalWeeks: number; currentWeek: number; phaseLabel?: string }) {
  const s = {
    fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700,
    color: 'var(--mute)', textTransform: 'uppercase' as const,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
      <span style={{ ...s, letterSpacing: '0.08em', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {totalWeeks} weeks{phaseLabel ? ` · ${phaseLabel}` : ''}
      </span>
      <span style={{ ...s, letterSpacing: '0.04em', flexShrink: 0 }}>Wk {currentWeek} of {totalWeeks}</span>
    </div>
  )
}

/**
 * B — VOLUME RIDGE. One change of substance: bar height encodes the week's
 * training volume. Everything else (colours, opacities, states, the label
 * row) is the shipped component's, so this is a small diff and inherits the
 * existing contrast decisions rather than reopening them.
 */
function Ridge({ weeks, currentWeek, doneWeeks, phaseLabel, rail = false }: {
  weeks: WeekBar[]; currentWeek: number; doneWeeks: number; phaseLabel?: string; rail?: boolean
}) {
  const peak = Math.max(...weeks.map(w => w.km), 1)
  const PLOT = 40
  return (
    <div>
      <LabelRow totalWeeks={weeks.length} currentWeek={currentWeek} phaseLabel={phaseLabel} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: PLOT }}>
        {weeks.map(w => {
          const isCurrent = w.n === currentWeek
          const isDone = w.n < currentWeek && w.n <= doneWeeks
          let bg = 'var(--mute-2)', opacity = w.isDeload ? 0.15 : 0.35
          if (w.isRace) { bg = 'var(--s-race)'; opacity = 0.9 }
          else if (isCurrent) { bg = 'var(--moss)'; opacity = 1 }
          else if (isDone) { bg = 'var(--moss)'; opacity = w.isDeload ? 0.25 : 0.7 }
          return (
            <div key={w.n} style={{
              flex: 1,
              // A floor, so a very light week is still a mark and not a gap.
              height: `${Math.max(12, (w.km / peak) * 100)}%`,
              borderRadius: '2px 2px 0 0',
              background: bg, opacity,
              outline: isCurrent ? '2px solid var(--moss-mid)' : 'none',
              outlineOffset: isCurrent ? '1px' : 0,
            }} />
          )
        })}
      </div>
      {/* The baseline the ridge stands on. Without it the bars float. */}
      <div style={{ height: 1, background: 'var(--line)' }} />
      {rail && <PhaseRail weeks={weeks} currentWeek={currentWeek} />}
    </div>
  )
}

/** The phase blocks, as a 3px rail under the ridge. */
function PhaseRail({ weeks, currentWeek }: { weeks: WeekBar[]; currentWeek: number }) {
  const segs: { phase: string | undefined; n: number; from: number }[] = []
  weeks.forEach((w, i) => {
    const last = segs[segs.length - 1]
    if (last && last.phase === w.phase) last.n += 1
    else segs.push({ phase: w.phase, n: 1, from: i + 1 })
  })
  return (
    <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
      {segs.map(s => {
        const past = s.from + s.n - 1 < currentWeek
        return (
          <div key={s.from} style={{ flex: s.n, minWidth: 0 }}>
            <div style={{
              height: 3, borderRadius: 2,
              background: past ? 'var(--moss)' : 'var(--line-strong)',
              opacity: past ? 0.55 : 1,
            }} />
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
              color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em',
              marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{s.phase ?? ''}</div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * D — PHASE TRACK ONLY. No per-week marks at all: one rounded track split
 * into phase segments with a travelling marker. The calmest option and the
 * one most congruent with "restraint is the feature" — and the one that
 * throws away the most information.
 */
function PhaseTrack({ weeks, currentWeek, phaseLabel }: { weeks: WeekBar[]; currentWeek: number; phaseLabel?: string }) {
  const segs: { phase: string | undefined; n: number; from: number }[] = []
  weeks.forEach((w, i) => {
    const last = segs[segs.length - 1]
    if (last && last.phase === w.phase) last.n += 1
    else segs.push({ phase: w.phase, n: 1, from: i + 1 })
  })
  return (
    <div>
      <LabelRow totalWeeks={weeks.length} currentWeek={currentWeek} phaseLabel={phaseLabel} />
      <div style={{ position: 'relative', display: 'flex', gap: 3, height: 10, alignItems: 'center' }}>
        {segs.map(s => {
          const past = s.from + s.n - 1 < currentWeek
          const active = currentWeek >= s.from && currentWeek <= s.from + s.n - 1
          return (
            <div key={s.from} style={{
              flex: s.n, height: active ? 10 : 6, borderRadius: 5,
              background: past || active ? 'var(--moss)' : 'var(--line-strong)',
              opacity: past ? 0.45 : 1,
            }} />
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        {segs.map(s => (
          <div key={s.from} style={{
            flex: s.n, minWidth: 0,
            fontFamily: 'var(--font-ui)', fontSize: 9, fontWeight: 700,
            color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{s.phase ?? ''}</div>
        ))}
      </div>
    </div>
  )
}

// Longest and shortest the catalogue offers, plus a mid-length, because
// "does it scale" is the first thing anyone will ask: an 18-week plan gives
// each bar ~15px at the Plan screen's 320px content width, a 12-week one
// ~23px. Both have to read.
const SLUGS = [
  'sub-4-hour-marathon-plan',      // 18 weeks — the narrowest bars we ship
  'marathon-16-week',
  'sub-2-hour-half-marathon-plan', // 14 weeks
  'half-marathon-12-week',
  '5k-12-week',
] as const

export default function PlanArcPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  const cases = SLUGS.map(slug => {
    const src = MARKETING_PLANS.find(p => p.slug === slug)!
    const { planStart, raceDate } = planAnchor(src.dayOffset)
    const plan = generateRulePlan(src.input(raceDate), 'free', planStart)
    const w = bars(plan)
    const currentWeek = Math.min(6, w.length)
    return {
      slug, weeks: w, currentWeek,
      doneWeeks: currentWeek - 1,
      raceWeek: w.length,
      deloadWeeks: w.filter(x => x.isDeload).map(x => x.n),
      phaseLabel: Array.from(new Set(w.map(x => x.phase).filter(Boolean))).join(' → '),
      peak: Math.max(...w.map(x => x.km)),
    }
  })

  const VARIANTS = ['A — shipped (flat)', 'B — volume ridge', 'C — ridge + phase rail', 'D — phase track only'] as const

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '40px 24px 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: 28, fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>
          PlanArc — four candidates
        </h1>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 680, margin: '0 0 8px' }}>
          Real generated plans, at the Plan screen&rsquo;s own 320px content width. Bar
          heights in B and C are <strong>training</strong> volume (<code>trainingKm</code>),
          so race week is not drawn as the biggest week of the taper.
        </p>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--mute)', lineHeight: 1.6, maxWidth: 680, margin: '0 0 36px' }}>
          Variant A is what ships today: every bar is 100% tall, so the component
          called an arc draws a flat line.
        </p>

        {cases.map(c => (
          <section key={c.slug} style={{ marginBottom: 48 }}>
            <div style={{
              fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'var(--mute)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14,
            }}>
              {c.slug} · peak {c.peak}km · deloads w{c.deloadWeeks.join(', w')}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {VARIANTS.map(v => (
                <div key={v} style={{
                  width: 320, background: 'var(--card)', border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)', padding: 16,
                }}>
                  <div style={{
                    fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
                    color: 'var(--ink-2)', marginBottom: 12,
                  }}>{v}</div>
                  {v.startsWith('A') && (
                    <PlanArc
                      totalWeeks={c.weeks.length}
                      currentWeek={c.currentWeek}
                      doneWeeks={c.doneWeeks}
                      weekKm={c.weeks.map(x => x.km)}
                      raceWeek={c.raceWeek}
                      phaseLabel={c.phaseLabel}
                    />
                  )}
                  {v.startsWith('B') && <Ridge weeks={c.weeks} currentWeek={c.currentWeek} doneWeeks={c.doneWeeks} phaseLabel={c.phaseLabel} />}
                  {v.startsWith('C') && <Ridge weeks={c.weeks} currentWeek={c.currentWeek} doneWeeks={c.doneWeeks} phaseLabel={c.phaseLabel} rail />}
                  {v.startsWith('D') && <PhaseTrack weeks={c.weeks} currentWeek={c.currentWeek} phaseLabel={c.phaseLabel} />}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
