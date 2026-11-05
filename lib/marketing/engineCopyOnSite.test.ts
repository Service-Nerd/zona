// SITE-SESSION-STEPS-01 — engine-authored copy now reaches a MARKETING page,
// and the marketing copy gate cannot see it.
//
// 🔴 THIS HOLE WAS OPENED BY THE CHANGE IT SHIPS WITH, WHICH IS WHY IT SHIPS
// WITH IT. `noEmDash.test.ts` reads FILE SOURCE across a list of marketing
// surfaces, so it governs strings a person typed into a page. The plan pages
// now mount the app's real `SessionSteps`, whose text comes from the session
// catalogue and the composer — strings that exist in no marketing file. The
// marketing gate is blind to them BY CONSTRUCTION, and no amount of widening
// its surface list would help.
//
// `noEmDash.test.ts` says in its own header that this boundary was a decision:
//
//     "The APP is out of scope. Engine session labels ('Easy run — Zone 2')
//      and coach notes still use em dashes; changing those is an app-wide copy
//      change with a live coupling ... so it is a separate decision."
//
// That decision was made while engine copy stayed inside the app. Mounting a
// real app component on a marketing page moves copy ACROSS it.
//
// ⚠️ MEASURED, NOT ASSUMED — AND MY FIRST MEASUREMENT WAS WRONG IN THE
// COMFORTABLE DIRECTION. A scratch script said SIX; this gate said EIGHT on its
// first run, because the script collected hits in a `Set` (so the same note
// appearing in two different plans counted once) and never looked at
// `session.label`. **A Set deduplicates the thing you are counting.** Both
// errors under-reported. Nine published plans, nine rendered exemplars, EIGHT
// em dashes across six plans:
//
//   LABELS (2) — the engine-label case `noEmDash.test.ts` already declared out
//   of scope in those words ("Easy run — Zone 2"):
//     10k-12-week            w5  "Hill reps — 90s"
//     sub-50-10k-plan        w5  "Hill reps — 90s"
//
//   STEP NOTES (6) — sentences a runner reads:
//     half-marathon-12-week  w5  "Deliberately short — clearance, not recovery."
//     marathon-16-week       w6  "Rung one. Settle in — this is the pace you finish on."
//     sub-2-hour-half...     w6  "Rung one. Settle in — this is the pace you finish on."
//     sub-45-10k-plan        w5  "...at VO2max effort — about as hard as you could hold..."
//     sub-4-hour-marathon    w7  "...critical velocity — a notch past comfortably hard..."
//     sub-4-hour-marathon    w7  "Ninety seconds easy. Short — the point is to keep..."
//
// 🔻 THE EIGHT ARE REGISTERED DEBT, NOT A PASS, and they are NOT MINE TO FIX.
// They live in the session catalogue, which is coaching doctrine behind
// `.claude/hooks/coaching-guard.py`. The founder's ruling (2026-09-22) is
// "sentences the runner reads or hears, no em dash; session descriptions,
// allowed" — and whether a STEP NOTE is a sentence or a description is a
// coaching-and-founder question, not a build decision. Filed as
// `SITE-ENGINE-EMDASH-01`, routed 🏃 Coaching Board.
//
// ⚠️ A DECLARED REASON IS NOT A FIXED PROBLEM. These entered the register on
// 2026-11-05. What this gate does is stop the number growing: a SEVENTH em dash
// reaching a marketing page fails the build.

import { describe, it, expect } from 'vitest'
import { MARKETING_PLANS, planAnchor } from './plans'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isHardEffort } from '@/lib/plan/sessionRole'
import { composeSession } from '@/lib/plan/sessionComposer'
import { catalogueRowFor } from '@/lib/plan/catalogueLink'
import type { Session } from '@/types/plan'

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const EM_DASH = '—'

/**
 * Exactly what `PlanPage` renders: ONE exemplar per plan, the first quality
 * session carrying a resolved v2 set.
 *
 * ⚠️ IT RE-DERIVES THE SELECTION RATHER THAN IMPORTING IT, deliberately. A
 * checker that shares the producer's helper cannot catch the producer picking
 * the wrong session — this repo's `deloadCadence` lesson. If the two ever
 * disagree, the arm below that counts exemplars goes red.
 */
function renderedExemplars(): { slug: string; weekN: number; text: string }[] {
  const out: { slug: string; weekN: number; text: string }[] = []
  for (const p of MARKETING_PLANS) {
    const { planStart, raceDate } = planAnchor(p.dayOffset)
    const plan = generateRulePlan(p.input(raceDate), 'free', planStart)
    let found = false
    for (const w of plan.weeks) {
      if (found) break
      for (const d of DAY_ORDER) {
        const s = w.sessions[d] as Session | undefined
        if (!s || !isHardEffort(s) || !(s as { derived_set?: unknown }).derived_set) continue
        const structure = composeSession({ session: s, catalogueRow: catalogueRowFor(s) })
        out.push({
          slug: p.slug,
          weekN: w.n,
          // Every string the band can put on screen, in one blob. JSON rather
          // than a hand-walked tree: a new FIELD on a step is then covered on
          // the way in, which a field list would not be.
          text: JSON.stringify([(s as { derived_set?: unknown }).derived_set, structure, s.label]),
        })
        found = true
        break
      }
    }
  }
  return out
}

/** Known em dashes in engine copy that the plan pages render today. Coaching
 *  doctrine owns the strings; this file owns only the count. */
const BASELINE_EM_DASHES = 8

describe('engine copy on a marketing page — SITE-SESSION-STEPS-01', () => {
  const exemplars = renderedExemplars()

  it('every published plan renders an exemplar', () => {
    // Guards the guard twice over: if the picker stops finding a session, the
    // arms below pass on an empty corpus, and if PlanPage's own picker drifts
    // from this one the counts separate.
    expect(MARKETING_PLANS.length).toBeGreaterThanOrEqual(9)
    expect(exemplars.length).toBe(MARKETING_PLANS.length)
    expect(exemplars.every(e => e.text.length > 200)).toBe(true)
  })

  it('no NEW em dash reaches a marketing page through the engine', () => {
    const hits = exemplars.flatMap(e =>
      Array.from(e.text.matchAll(new RegExp(`[^"]{0,50}${EM_DASH}[^"]{0,50}`, 'g')))
        .map(m => `  ${e.slug} w${e.weekN}: ${m[0]}`))

    expect(
      hits.length,
      `Engine copy on /plans carries ${hits.length} em dashes, baseline ${BASELINE_EM_DASHES}.\n`
      + `${hits.join('\n')}\n\n`
      + 'If this went UP: a session-catalogue note added an em dash and it is now on a\n'
      + 'public page. Route to the Coaching Board (SITE-ENGINE-EMDASH-01); the catalogue\n'
      + 'is doctrine. If it went DOWN: lower BASELINE_EM_DASHES in this file, and say so.',
    ).toBeLessThanOrEqual(BASELINE_EM_DASHES)
  })

  it('the baseline is a real count, not a number someone typed', () => {
    // ⚠️ A ceiling alone would pass forever if the corpus emptied or the regex
    // stopped matching — the hollow shape this repo keeps shipping. This
    // asserts the debt is still THERE, so the register cannot rot into a
    // decoration while reading green.
    const hits = exemplars.flatMap(e =>
      Array.from(e.text.matchAll(new RegExp(EM_DASH, 'g'))))
    expect(hits.length, 'the em-dash debt has changed — re-baseline deliberately')
      .toBe(BASELINE_EM_DASHES)
  })
})
