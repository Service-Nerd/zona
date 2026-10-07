import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// POSTRUN-JOURNEY-01 parts 1, 2 & 4 — the signal leads, the skeleton is the
// silhouette of what actually arrives, and the question comes before the answer.
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

/**
 * The body of PostRunScreen's return, comments stripped. Bounded on BOTH ends, because
 * `DashboardClient.tsx` is ~7,400 lines and an unbounded `indexOf` on it would compare
 * two positions in unrelated screens and call the result an order.
 */
function postRunScreenReturn(): string {
  const fn = DC.indexOf('function PostRunScreen(')
  expect(fn, 'PostRunScreen not found \u2014 this check has stopped looking').toBeGreaterThan(-1)
  const start = DC.indexOf('return (', fn)
  expect(start, 'PostRunScreen has no return \u2014 this check has stopped looking').toBeGreaterThan(-1)
  const end = DC.indexOf('\n}', start)
  expect(end).toBeGreaterThan(start)
  return stripComments(DC.slice(start, end))
}

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

describe('POSTRUN-JOURNEY-01 part 4 \u2014 the question comes before the answer', () => {
  it('\U0001F534 "How did it feel?" renders BEFORE the AI read on PostRunScreen', () => {
    // Until 2026-10-07 the read came first, so the FIRST read a runner saw was written
    // with `RPE: not logged` \u2014 then saveRPEFatigue re-ran analyse-run and REPLACED the
    // card underneath them. The payoff was wired and unreachable in time.
    //
    // \u26A0\uFE0F Anchors are CODE, never comments: the block's own banner comment reads
    // "HOW DID IT FEEL?" in caps and stripComments() removes it, so this matches the
    // rendered JSX text and the two component tags.
    const body = postRunScreenReturn()
    const feel    = body.indexOf('How did it feel?')
    const pending = body.indexOf('<PendingAnalysisCard')
    const done    = body.indexOf('<RunFeedbackCard')
    expect(feel,    'the feel block is gone from PostRunScreen').toBeGreaterThan(-1)
    expect(pending, 'PendingAnalysisCard is gone from PostRunScreen').toBeGreaterThan(-1)
    expect(done,    'RunFeedbackCard is gone from PostRunScreen').toBeGreaterThan(-1)
    expect(feel).toBeLessThan(pending)
    expect(feel).toBeLessThan(done)
  })

  it('\U0001F534 and it stays OUTSIDE hasPaidAccess \u2014 RPE logging is FREE (DS-06)', () => {
    // THE REAL RISK OF THIS MOVE, and the LEDGER-01 class: a FREE block now sits
    // directly above a `hasPaidAccess &&` cluster. A move can cross a tier gate
    // without changing a line of logic, and nothing would error \u2014 the screen would
    // simply stop asking free runners how it felt. Assert UNGATED, not merely present:
    // the first version of LEDGER-01's test asserted presence and stayed green when
    // the gate was re-added.
    const body = postRunScreenReturn()
    const feel = body.indexOf('How did it feel?')
    expect(feel).toBeGreaterThan(-1)
    // Walk back to the nearest JSX child boundary and prove no tier gate opened in it.
    const blockStart = body.lastIndexOf('<div style={{', feel)
    expect(blockStart).toBeGreaterThan(-1)
    const preamble = body.slice(Math.max(0, blockStart - 400), feel)
    expect(preamble, 'the feel block has been wrapped in a tier gate').not.toContain('hasPaidAccess')
    // And the paid cluster it now sits above must still BE gated, or the arm above
    // would pass for the wrong reason (nothing gated anywhere).
    const pending = body.indexOf('<PendingAnalysisCard')
    expect(body.slice(feel, pending)).toContain('hasPaidAccess')
  })

  it('answering still PAYS \u2014 saveRPEFatigue re-runs the read', () => {
    // The move is only worth anything because this already existed. If the re-run is
    // removed, asking first becomes a question with no consequence.
    const code = stripComments(DC)
    expect(code, 'the re-run after saving RPE is gone').toContain("authedFetch('/api/analyse-run'")
    expect(code, 'the re-run no longer feeds its result back into the card').toContain('setAnalysis(reData.analysis)')
    // ...and the prompt must still READ it, or the re-run changes nothing.
    const prompt = readFileSync('lib/coaching/prompts/sessionFeedback.ts', 'utf8')
    expect(prompt, 'the prompt no longer states the RPE').toMatch(/RPE: \$\{rpe/)
  })

  it('the fatigue words come from FATIGUE_TAGS, not from a mockup', () => {
    // \u26A0\uFE0F MY OWN MOCKUP INVENTED "Easy / Steady / Hard / Wrecked". The live
    // vocabulary is Fresh / Fine / Heavy / Wrecked, it is consumed by the coaching
    // flag and reframeRiskGate, and changing the words is a VOICE decision that is
    // not this build's to make. Fixtures must use the product's values.
    const vocab = readFileSync('lib/coaching/completionVocab.ts', 'utf8')
    expect(vocab).toContain("['Fresh', 'Fine', 'Heavy', 'Wrecked']")
    const code = stripComments(DC)
    expect(code, 'the invented mockup vocabulary reached the product').not.toContain("'Steady'")
  })
})
