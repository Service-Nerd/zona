// ZONE-STRING-CLASSIFIER-01 — the gate.
//
// THE PROPERTY: `session.zone` is a DISPLAY STRING (§84 Amendment 1 — *"`hr_target` is the
// prescription; `session.zone` is a label ABOUT it"*). No guard that decides what KIND of work
// a session is may read it. INV-CLASS says the same thing in general terms: classify by a
// structural signal the producer stamps, never by a display string another layer can rewrite.
//
// WHY A TEST AND NOT A NOTE. Five sites read it, and it was invisible because the generator
// wrote exactly one string per band, so the string and the row agreed by construction. ADR-026
// derives the band from the runner's own pace anchor: the string becomes runner-dependent, and
// every one of those five starts answering a different question for the same session. The
// measured instance was a 24-minute `cv_intervals` THRESHOLD session judged against the 12–18
// minute VO2max dose bound.
//
// ⚠️ A SOURCE ASSERTION PASSES ON A COMMENT, so the main arm is BEHAVIOURAL: it rewrites every
// quality session's zone string to one that LIES about the session's class and asserts
// `validatePlan` returns the same verdict. The one source arm is a population ratchet on the
// generator, not a substitute for it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from './ruleEngine'
import { validatePlan, INVARIANT_CODES } from './invariants'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { workClassFor, workZonesFor, classifyStimulus, isVo2maxSession } from './sessionRole'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { Session } from '@/types/plan'

// Codes that legitimately move when the zone string moves. Two kinds, and the distinction is
// the finding of this item rather than bookkeeping:
//
//   (a) the string IS their subject — they exist to check it;
//   (b) the string is the only record of a PER-INSTANCE prescription decision. §33 repurposing
//       delivers an `ultra_specific` row at T-pace in Zone 3 and renames it; §22 delivers a
//       `threshold` row at goal pace. In both the row's category says what the row is FOR, not
//       what this instance was prescribed AS, so the row cannot answer and the zone — written at
//       construction from the band actually prescribed — can.
//
// ⚠️ SO THIS ARM IS A RATCHET AGAINST A NEW INSTANCE, NOT EVIDENCE ABOUT THE EXISTING ONES.
// With (b) exempted it cannot see the re-keys this item shipped; the arms below do that,
// directly and one at a time. Naming the limit is the point — the alternative is a green tick
// over a list long enough to exempt everything.
const STRING_IS_THEIR_SUBJECT = new Set([
  // (a)
  'INV-PLAN-COACH-NOTES-MATCH-INTENT',         // compares the coach note's words to session.zone
  'INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND', // §40b — the string must equal the row's declaration
  'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK',        // §84 Am. 1 — the string must describe hr_target
  'INV-PLAN-PACE-ZONE-COHERENT',               // ADR-026 condition 3 — amended in ANCHOR-BAND-FLIP-01
  'INV-PLAN-GOAL-PACE-SHAPE',                  // §83 — goal-pace work's own zone/pace pairing
  // (b)
  'INV-PLAN-LABEL-MATCHES-PACE',               // §19 — its threshold/easy arms; the vo2max arm is re-keyed
  'INV-PLAN-INTENSITY-ORDERING',               // §83/§44 — carried into ANCHOR-BAND-FLIP-01 with condition 3
])

/** A zone string that LIES about every session's class, whatever the session is. */
function lieAbout(zone: string | undefined): string {
  // Z3 ⇄ Z4–5 in both directions, so no session keeps a truthful string.
  return /[45]/.test(zone ?? '') ? 'Zone 3' : 'Zone 4–5'
}

function planFor(input: ReturnType<typeof cohortGrid>[number]) {
  return generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
}

/**
 * Generate real plans, mutate the quality sessions `pick` selects, and count how often `code`
 * fires before and after. Returns counts rather than a boolean so an arm cannot pass on an
 * EMPTY selection — `touched` is asserted, because "0 violations" and "0 sessions mutated" look
 * identical from the outside and only one of them is a result.
 */
function withMutatedQuality(
  pick: (s: Session) => boolean,
  mutate: (s: Session) => void,
  code: string,
  // ⚠️ REQUIRED, AND THE REASON IS THAT COUNTING THE CODE ALONE MADE AN ARM HOLLOW.
  // `INV-PLAN-LABEL-MATCHES-PACE` has FOUR arms under one code, and the NUMERIC one ("pace
  // midpoint is not within ±5% of vVO2max") fires on the same mutation for an unrelated reason.
  // Counting the code, the mislabel arm below passed under a mutation that disabled exactly the
  // behaviour it claims to prove. Match the arm's own sentence.
  messageMatch: RegExp,
) {
  const grid = cohortGrid()
  const inputs = Array.from({ length: 40 }, (_, i) => grid[Math.floor(i * grid.length / 40)])
  let touched = 0, base = 0, mutated = 0
  for (const input of inputs) {
    let plan
    try { plan = planFor(input) } catch { continue }
    const hit = (vs: ReturnType<typeof validatePlan>) =>
      vs.filter(v => v.code === code && messageMatch.test(v.message)).length
    base += hit(validatePlan(plan, input))
    const copy = JSON.parse(JSON.stringify(plan)) as typeof plan
    for (const w of copy.weeks) {
      for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
        if (!sn || sn.type !== 'quality' || !pick(sn)) continue
        mutate(sn); touched++
      }
    }
    mutated += hit(validatePlan(copy, input))
  }
  expect(touched, 'the mutation selected no session, so this arm proves nothing').toBeGreaterThan(0)
  return { fired: { base, mutated }, touched }
}

describe('ZONE-STRING-CLASSIFIER-01 — no guard classifies by the display string', () => {
  // A spread of real cohort inputs rather than one fixture: the five sites are reached by
  // different session kinds, and a single plan reaches at most a few of them.
  const grid = cohortGrid()
  const inputs = Array.from({ length: 24 }, (_, i) => grid[Math.floor(i * grid.length / 24)])

  it('rewriting every quality session zone to a LIE changes no verdict but the string checks', () => {
    let plansChecked = 0
    let qualityScrambled = 0
    const movedCodes = new Set<string>()

    for (const input of inputs) {
      let plan
      try { plan = planFor(input) } catch { continue }
      plansChecked++

      const before = validatePlan(plan, input)

      // Deep-copy, then make every quality session's zone string lie.
      const lied = JSON.parse(JSON.stringify(plan)) as typeof plan
      for (const w of lied.weeks) {
        for (const sn of Object.values(w.sessions) as (Session | undefined)[]) {
          if (!sn || sn.type !== 'quality' || !sn.zone) continue
          sn.zone = lieAbout(sn.zone)
          qualityScrambled++
        }
      }
      const after = validatePlan(lied, input)

      const count = (vs: typeof before) => {
        const m = new Map<string, number>()
        for (const v of vs) m.set(v.code, (m.get(v.code) ?? 0) + 1)
        return m
      }
      const b = count(before), a = count(after)
      for (const code of Array.from(new Set(Array.from(b.keys()).concat(Array.from(a.keys()))))) {
        if ((b.get(code) ?? 0) !== (a.get(code) ?? 0)) movedCodes.add(code)
      }
    }

    // An empty population must not render as a pass (EMPTY-POPULATION).
    expect(plansChecked).toBeGreaterThan(10)
    expect(qualityScrambled).toBeGreaterThan(50)

    const unexpected = Array.from(movedCodes).filter(c => !STRING_IS_THEIR_SUBJECT.has(c)).sort()
    expect(unexpected, `these guards changed their verdict when only the DISPLAY STRING moved, so they classify by it: ${unexpected.join(', ')}`).toEqual([])
  })

  it('§19 vo2max arm: a VO2max row is VO2max work even when its zone string denies it', () => {
    // The re-key, isolated. A `vo2max` row whose zone string has been made to read "Zone 3" —
    // which ADR-026 can produce for real, since the band is derived per runner — must not be
    // reported as a mislabel. The old code read the string and reported it.
    const { fired } = withMutatedQuality(
      s => workClassFor(s) === 'vo2max',
      s => { s.label = 'Classic VO2max'; s.zone = 'Zone 3' },
      'INV-PLAN-LABEL-MATCHES-PACE', /implies VO2max but zone is/,
    )
    expect(fired.mutated, 'a VO2max row with a lying zone string must not read as a mislabel').toBe(0)
  })

  it('§19 vo2max arm: a THRESHOLD row labelled VO2max IS a mislabel — and the old check could not see it', () => {
    // 🔑 THE ARM THE RE-KEY BUYS. `labelImpliesVo2 && !zoneIsVo2` asked the string, so a threshold
    // row renamed "Classic VO2max" and carrying "Zone 4–5" satisfied it: the label lied and the
    // string agreed with the lie. Reading the row catches it. This is the same shape as SC-09 and
    // as the enricher case D-17 warns about.
    const { fired } = withMutatedQuality(
      s => workClassFor(s) === 'threshold',
      s => { s.label = 'Classic VO2max'; s.zone = 'Zone 4–5' },
      'INV-PLAN-LABEL-MATCHES-PACE', /implies VO2max but zone is/,
    )
    expect(fired.base, 'the unmutated plans must be clean, or the arm is reading pre-existing noise').toBe(0)
    expect(fired.mutated, 'a threshold row renamed "Classic VO2max" must be reported, whatever its zone string says').toBeGreaterThan(0)
  })

  it('every exempted code is a REGISTERED invariant, so a fictional name cannot widen the list', () => {
    // ⚠️ A NAME IS NOT A CHECK. The item this gate closes cited `INV-PLAN-PACE-INVERSION`, which
    // exists nowhere, and my first exemption list named `INV-PLAN-ZONE-PRESENT`, which also does
    // not — a dead entry silently exempts nothing and reads as if it exempts something.
    const registered = new Set<string>(INVARIANT_CODES)
    const fictional = Array.from(STRING_IS_THEIR_SUBJECT).filter(c => !registered.has(c)).sort()
    expect(fictional, `exempted codes that are not registered invariants: ${fictional.join(', ')}`).toEqual([])
  })

  it('workClassFor reads the stamp, not the string — even when the string contradicts it', () => {
    // `cv_intervals` is category 'threshold' and declares ['Z3','Z4']: the zone set says Z4
    // while the TRAINING is threshold, which is why the set cannot answer this question either.
    expect(workClassFor({ catalogue_id: 'cv_intervals', label: 'CV intervals' })).toBe('threshold')
    expect(workClassFor({ catalogue_id: 'cv_intervals', label: 'CV intervals' }, V1_SESSION_CATALOGUE)).toBe('threshold')
    expect(workClassFor({ catalogue_id: 'intervals_classic', label: '10K-pace reps' })).toBe('vo2max')
    expect(workClassFor({ catalogue_id: 'mp_blocks', label: 'Marathon-pace run' })).toBe('race_specific')
    expect(workClassFor({ catalogue_id: 'aerobic_steady', label: 'Steady aerobic' })).toBe('aerobic')
  })

  it('an unresolvable session gets null, never a guess', () => {
    expect(workClassFor({ label: 'Wednesday session' })).toBeNull()
    expect(workClassFor({ catalogue_id: 'no_such_row', label: 'Wednesday session' })).toBeNull()
    // The SC-09 label fallback survives for pre-ADR-018 plans.
    expect(workClassFor({ label: 'Classic VO2max' })).toBe('vo2max')
  })

  it('isVo2maxSession still answers for a VO2max row whose LABEL does not say so (SC-09)', () => {
    // The regression this must not reintroduce: `hill_reps` is category 'vo2max' and labelled
    // "Hill reps — 45s", so a label test answered no and §22's exemption stopped applying.
    expect(isVo2maxSession({ catalogue_id: 'hill_reps', label: 'Hill reps — 45s' }, V1_SESSION_CATALOGUE)).toBe(true)
    expect(isVo2maxSession({ catalogue_id: 'cv_intervals', label: 'CV intervals' }, V1_SESSION_CATALOGUE)).toBe(false)
  })

  it('classifyStimulus does not call a threshold row VO2max because its zone string says so', () => {
    // This is the measured defect, in one line. Under ADR-026 a threshold row can read
    // "Zone 4–5"; the old heuristic stamped it `vo2max` and the 12–18 min VO2max dose bound
    // was then applied to a 24-minute CV session.
    expect(classifyStimulus({ catalogue_id: 'cv_intervals', label: 'CV intervals', zone: 'Zone 4–5' })).toBe('tempo')
    // A VO2max row still classifies as VO2max with no help from the string at all.
    expect(classifyStimulus({ catalogue_id: 'hill_reps', label: 'Hill reps — 45s', zone: 'Zone 2' })).toBe('vo2max')
    // The stamp always wins (CLASSIFY-STIMULUS-01).
    expect(classifyStimulus({ catalogue_id: 'cv_intervals', label: 'CV intervals', zone: 'Zone 4–5', stimulus: 'vo2max' })).toBe('vo2max')
  })

  it('classifyStimulus keeps the string fallback ONLY where no row resolves', () => {
    // A plan generated before the ADR-018 stamp: the string is the only record of the band
    // there is, so reading it is right. This is the one place it stays legal.
    expect(classifyStimulus({ label: 'Wednesday session', zone: 'Zone 4–5' })).toBe('vo2max')
    expect(classifyStimulus({ label: 'Wednesday session', zone: 'Zone 3' })).toBeNull()
  })

  it('workZonesFor reads the row declaration, which is a different fact from the string', () => {
    expect(workZonesFor({ catalogue_id: 'cv_intervals' })).toEqual([3, 4])
    expect(workZonesFor({ catalogue_id: 'tempo_continuous' })).toEqual([3])
    expect(workZonesFor({ catalogue_id: 'time_on_feet' })).toEqual([1, 2])
    expect(workZonesFor({ label: 'no row here' })).toEqual([])
  })

  it('the generator classifies by the string NOWHERE — population ratchet', () => {
    // `physBucket` lived here and is deleted. This is a ratchet, not the gate: it cannot tell a
    // correct read from an incorrect one, only that the producer has stopped making them. The
    // producer is the one place where a wrong answer is written into the plan rather than
    // merely reported about it.
    const src = readFileSync(join(process.cwd(), 'lib', 'plan', 'ruleEngine.ts'), 'utf8')
    const lines = src.split('\n')
      .map((l, i) => ({ n: i + 1, l }))
      .filter(({ l }) => !l.trimStart().startsWith('//'))
      .filter(({ l }) => /zone\s*\.includes\(\s*['"]zone [1-5]/i.test(l) || /\.zone\s*\?\?\s*''\)\s*\.toLowerCase/.test(l))
    expect(lines.map(x => `ruleEngine.ts:${x.n}`), 'the generator must not classify by the zone string it writes').toEqual([])
  })
})
