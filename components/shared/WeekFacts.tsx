// COACH-WEEK-FACTS-01 — the foot of Coach's "This week" card (Design Board 2026-10-31, option C, founder-approved).
//
// Runs and strength were two cards with two layouts, two number formats and one verdict between them, and the run card
// was called "Sessions" while counting runs only. They are this week's facts, so they sit under the week's load, under a
// hairline, in one treatment: the count in ink, the noun after it, and the runs verdict beside its own count. A5 holds:
// the count keeps its number, because "2 of 3" means something without a tap.
//
// Strength takes no verdict word (none was ruled). Its plan's next step, when there is one, is a quiet line beneath.

import { STRENGTH_COACH } from '@/lib/strength-bridge/display'
import type { StrengthWeekEvidence } from '@/lib/strength-bridge/coachEvidence'
import { hueText } from '@/lib/ui/hueText'

export interface WeekRuns { done: number; planned: number; verdict: { label: string; color: string } }

const runsNoun = (planned: number) => (planned === 1 ? 'run' : 'runs')

export default function WeekFacts({ runs, strength }: { runs: WeekRuns | null; strength: StrengthWeekEvidence | null }) {
  if (!runs && !strength) return null
  const count = { fontWeight: 800, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' as const }
  return (
    <div data-week-facts>
      <div aria-hidden="true" style={{ height: '1px', background: 'var(--line)', margin: 'var(--space-4) 0 var(--space-3)' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 'var(--space-5)', rowGap: 'var(--space-1)',
        fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', color: 'var(--ink-2)' }}>
        {runs && (
          <span data-fact="runs">
            <span style={count}>{runs.done} of {runs.planned}</span> {runsNoun(runs.planned)}{' '}
            <span style={{ fontSize: 'var(--fs-caption)', fontWeight: 600, color: hueText(runs.verdict.color) }}>{runs.verdict.label}</span>
          </span>
        )}
        {strength && (
          <span data-fact="strength">
            <span style={count}>{strength.done} of {strength.planned}</span> {STRENGTH_COACH.noun}
          </span>
        )}
      </div>
      {strength?.next && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--mute)', lineHeight: 1.3, marginTop: 'var(--space-1)' }}>
          {strength.next.kind === 'heavier' ? STRENGTH_COACH.heavier(strength.next.week) : STRENGTH_COACH.jumps(strength.next.week)}
        </div>
      )}
    </div>
  )
}
