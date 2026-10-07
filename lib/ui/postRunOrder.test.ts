import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// POSTRUN-JOURNEY-01 parts 1 & 2 — the signal leads, and the skeleton is the
// silhouette of what actually arrives.
//
// ⚠️ SOURCE-SHAPED BY NECESSITY. `RunFeedbackCard` and `PendingAnalysisCard` cannot
// be mounted here: `vitest.config.ts` is `environment: 'node'` with no jsdom. So
// these arms prove ORDER and ABSENCE in the source. They do not prove the rendered
// layout — `/post-run-preview` is where that is looked at, and it was.

/**
 * 🔴 STRIP COMMENTS BEFORE MATCHING. The first version of the skeleton arm asserted
 * the file did not contain "Efficiency" and went red on MY OWN COMMENT, which quotes
 * the founder saying "showing HR, distance, pace, efficiency". That is the THIRD time
 * in one day a check of mine matched its own explanatory prose — the pre-commit hook's
 * `HOOK-RGBA-COMMENTS-01` class. A comment is prose, not code. Line structure is kept
 * so any failure still points at the right place.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length))
}

const DC  = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
const PAC = stripComments(readFileSync('components/dashboard/PendingAnalysisCard.tsx', 'utf8'))

/** The body of RunFeedbackCard's return, bounded so we are not grepping the file. */
function runFeedbackCardReturn(): string {
  const fn = DC.indexOf('export function RunFeedbackCard(')
  expect(fn, 'RunFeedbackCard not found — this check has stopped looking').toBeGreaterThan(-1)
  const start = DC.indexOf('return (', fn)
  return DC.slice(start, DC.indexOf('\n}', start))
}

describe('POSTRUN-JOURNEY-01 — the signal leads, the read follows', () => {
  it('🔴 the verdict card renders BEFORE the Kit read', () => {
    // This REVERSES UX-POSTRUN-01's "Kit leads", on the founder's overrule of
    // 2026-10-07. If someone flips it back, that is a decision and should fail here
    // until this arm is changed deliberately.
    const body = runFeedbackCardReturn()
    const verdict = body.indexOf('in your prescribed zone')
    const read    = body.indexOf('Read of your run')
    expect(verdict).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(-1)
    expect(verdict, 'the Kit read is above the zone signal again').toBeLessThan(read)
  })

  it('the bar is SIGNED — above and below are separate segments', () => {
    const body = runFeedbackCardReturn()
    expect(body).toContain('aboveCeilingPct ?? 0')
    expect(body).toContain('belowFloorPct ?? 0')
    // Direction matters: §12 Am. 1. Below-floor must not be alarming.
    expect(body).toContain("background: 'var(--warn)'")
  })

  it('the directional fields are actually FETCHED, or the bar has nothing to split', () => {
    const fetcher = readFileSync('lib/coaching/fetchRunAnalysis.ts', 'utf8')
    // ⚠️ `toMatch` with word boundaries, not `toContain`: a bare substring also
    // passes against `hr_above_ceiling_pctX`. `hollowTestShapes.test.ts` caught this
    // one in my own gate, which is the PLANVERB-01 class doing its job.
    expect(fetcher).toMatch(/\bhr_above_ceiling_pct\b/)
    expect(fetcher).toMatch(/\bhr_below_floor_pct\b/)
  })

  it('🔴 the loading skeleton no longer advertises the four-column dashboard', () => {
    // Those four labels were NEVER data, and they are the ghost of the panel the
    // SLT deleted in UX-POSTRUN-01. Removing them is compliance with that ruling.
    expect(PAC).not.toContain("'HR', 'Distance', 'Pace', 'Efficiency'")
    expect(PAC).not.toContain('Efficiency')
  })

  it('and it still pulses — a loading state that stopped moving is a broken one', () => {
    expect(PAC).toContain('ai-mark-pulse')
  })

  it("today's two fixes on this screen have not regressed", () => {
    // POSTRUN-POLL-WEEK-BLIND-01 and POSTRUN-PACE-NULL-01 both live on this card.
    expect(DC).toContain('fetchRunAnalysis(supabase, user.id, weekN, sessionDay)')
    expect(DC).toContain('actualAvgSpeedMs={avgSpeedMs}')
  })
})
