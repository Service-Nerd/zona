import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from './cohortGrid'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §94 Amendment 4 / `V1-DELIVERED-TAIL-01` — Coaching Board 2026-10-10.
 *
 * 🔴 WHY THIS EXISTS. `INV-PLAN-DELIVERED-RAMP` fires on WHETHER a week breached
 * §2 at delivery. It never reported how FAR, so Willy's condition on withdrawing
 * `ADR022-V1-DELIVERED-RISE-01` — *"the worst delivered rise was 79% before §100
 * and 79% after; the tail did not move, and the tail is what injures people.
 * Watch the tail, not the rate"* — was an observation **nobody could check.**
 *
 * ⛔ THERE IS NO THRESHOLD HERE, AND THAT IS THE RULING, NOT AN OMISSION.
 * §2 Amendment 2 carries Hutchinson's binding condition verbatim: the predicate
 * is *"frozen until we hold adherence or injury data"*, and *"any further
 * relaxation needs outcome evidence, not another corpus measurement"*. A refusal
 * threshold chosen from where a corpus distribution thins is **a percentile, not
 * a dose** — and §111/§113, the two refusal precedents, both refuse on a FACT
 * ABOUT THE RUNNER, never on a property of the generated plan. §94 Amendment 3
 * already recorded the general form: *"any non-zero tolerance is an invented
 * number."*
 *
 * ⚠️ GOVERNED ON THE TRIMABLE ARM (Willy). §52 exempts the long run BY RULING,
 * so a whole-week figure partly measures a thing we have decided not to control.
 * Both arms are reported; the trimable one is the one that may not grow.
 *
 * ⚠️ SEGMENTED, AND THAT IS BINDING (Sims). *"A magnitude baseline that reports
 * only the global p99 will hide them."* Masters plans are the flattest to begin
 * with — 18.6% never-build against 12.8% standard — so the same percentage is a
 * larger share of that runner's total training stress.
 *
 * 📊 SEILER'S QUESTION, ASKED AT THE SITTING AND ANSWERED HERE: p99 was almost
 * equal to MAX, and he refused to accept that as a tail — *"something is
 * clamping it."* The top of the distribution is
 * `67 67 67 67 67 67 67 65 65 62 62 52 …` — **seven identical maxima and then a
 * fifteen-point gap.** Seven identical values is not a clamp; it is the SAME
 * worst-case week shape recurring across grid rows that differ only on axes
 * irrelevant to that week (all `cwk=20 / longest=8 / 4–5 days`). **So the
 * maximum is a property of the grid's density, not of the engine. A different
 * input could exceed it, and this file must never be read as a ceiling.**
 *
 * ⚠️ THAT SEQUENCE IS THE *WHOLE-WEEK* ARM ON A 3,000-ROW `cohortGrid`-ONLY
 * SAMPLE, AND SAYING SO MATTERS. On this file's smaller segmented corpus the
 * governed TRIMABLE maximum repeats **twice**, not seven times. The conclusion
 * is unchanged — a repeated maximum is a corpus property — but the figure is
 * arm- and corpus-specific, and quoting it without that is how a measurement
 * becomes folklore.
 */

const STRIDE = 7919   // coprime with both grid lengths, so each sample is spread
const N_HEALTHY = 1200
const N_INJURY = 600
const MASTERS = GENERATION_CONFIG.MASTERS_AGE_THRESHOLD   // 45

type Segment = 'healthy_standard' | 'healthy_masters' | 'injury'

const ageOf = (i: GeneratorInput) => (i as { age?: number }).age ?? 0
const injuriesOf = (i: GeneratorInput) => ((i as { injury_history?: unknown[] }).injury_history ?? [])

function segmentOf(i: GeneratorInput): Segment {
  if (injuriesOf(i).length > 0) return 'injury'
  return ageOf(i) >= MASTERS ? 'healthy_masters' : 'healthy_standard'
}

/**
 * ⚠️ TWO CORPORA, AND THE SECOND IS NOT OPTIONAL. `cohortGrid` carries **0
 * injury-history rows out of 41,472** — measured. The first version of the
 * board evidence read it alone, reported "0 firings" on both of ADR-022's
 * injury invariants, and was within one paste of being submitted as *"no injury
 * exposure"*. ADR-022 itself records `INV-PLAN-INJURY-CAP-DELIVERED` as
 * exercised at 1,892 week-instances on a 600-plan injury grid. `targetedGrid`
 * holds 4,608 injured rows of 6,144 and is the only grid that reaches the cohort
 * Willy's condition is about.
 */
const CORPUS: GeneratorInput[] = (() => {
  const healthy = cohortGrid()
  const injured = targetedGrid().filter(i => injuriesOf(i).length > 0)
  return [
    ...Array.from({ length: N_HEALTHY }, (_, k) => healthy[(k * STRIDE) % healthy.length]),
    ...Array.from({ length: N_INJURY }, (_, k) => injured[(k * STRIDE) % injured.length]),
  ]
})()

interface Fire { segment: Segment; week: number; trimable: number }

/** Message shapes this file could not read. Asserted empty in a named arm. */
const unparsed: string[] = []

const measured: { fires: Fire[]; plans: number; bySeg: Record<Segment, number> } = (() => {
  const fires: Fire[] = []
  const bySeg = { healthy_standard: 0, healthy_masters: 0, injury: 0 } as Record<Segment, number>
  let plans = 0
  for (const input of CORPUS) {
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch { continue }
    plans++
    const seg = segmentOf(input)
    bySeg[seg]++
    for (const v of validatePlan(plan, input)) {
      if (v.code !== 'INV-PLAN-DELIVERED-RAMP') continue
      // ⚠️ PARSED FROM THE INVARIANT'S OWN `actual`, NEVER RE-DERIVED. Three
      // different numbers were produced for one question at the sitting because
      // each attempt re-derived the quantity with its own instrument.
      const m = String(v.actual).match(/\+(-?\d+)% week, \+(-?\d+)% non-long-run/)
      // ⚠️ COLLECTED, NOT THROWN. A shape change in the message must fail as a
      // NAMED ARM, not as a module-level throw: the first version asserted here,
      // and a broken parse made the whole FILE fail to collect. The build still
      // exited 1 — verified — but vitest reported "no tests", and a gate that
      // vanishes reads very differently from a gate that goes red. The
      // difference matters the day somebody is skimming CI output.
      if (!m) { unparsed.push(String(v.actual)); continue }
      fires.push({ segment: seg, week: v.week ?? 0, trimable: Number(m[2]) })
    }
  }
  return { fires, plans, bySeg }
})()

const q = (xs: number[], p: number) =>
  xs.length ? xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : NaN
const trimableOf = (seg: Segment) => measured.fires.filter(f => f.segment === seg).map(f => f.trimable)

/**
 * 📐 MEASURED 2026-10-10 on the corpus above. **The TRIMABLE arm, which is the
 * governed one.** Each may FALL, never rise; lower it in the commit that
 * improves it, and raise it only with a declared reason, exactly as
 * `cohort:shape` and `measure:fitness` require.
 *
 * 🔴 I WROTE "§94 CANNOT FIRE ON AN INJURED PLAN BY CONSTRUCTION" HERE AND THIS
 * GATE PROVED IT FALSE ON ITS FIRST RUN. It fires **51 times** on the injury
 * segment. The claim came from the board evidence, where the §94 arm had been
 * measured on `cohortGrid` alone — which carries no injured rows — so "no injury
 * firings" was a corpus artefact being read as a rule. **The gate caught my own
 * false doctrine before it shipped, which is the only reason it is not in the
 * principle.**
 *
 * ⚠️ AND THE CORRECTED NUMBERS CONFIRM WILLY'S INVERSION RATHER THAN REMOVING
 * IT. Injury maxes at **18%** against healthy-standard **105%** and
 * healthy-masters **79%** on the same arm, same corpus, same instrument:
 * ADR-022's three levers bind on the injured, and §94/§100 left the healthy with
 * the higher ceiling. That was the headline of the sitting and it survives
 * segmentation.
 */
const TRIMABLE_BASELINE: Record<Segment, { p99: number; max: number }> = {
  // 📐 MEASURED 2026-10-10 on the corpus above (1,800 inputs, 1,750 generated):
  //   healthy_standard  573 plans, 141 firings — p50 22 p90 43 p99 105 max 105
  //   healthy_masters   577 plans, 170 firings — p50 22 p90 40 p99  59 max  79
  //   injury            600 plans,  51 firings — p50 12 p90 18 p99  18 max  18
  // SESSION-KM-STRUCTURED-PACE-01 (2026-10-23), tightened 105/105 → 53/61 with the measurement: the two 94% firings at
  // HEAD were weeks whose structured quality session was priced at WORK pace for its whole duration (warm-up and jogs
  // included). Sized from its steps they are not ramps at all. healthy_standard 142 → 138 firings, p99 94 → 53,
  // max 94 → 61; masters 174 → 168 firings, p99 78, max 79 (unchanged); injury unchanged.
  healthy_standard: { p99: 53, max: 61 },
  // GOALPACE-5K-01 (2026-10-23), raised 59 → 78 with the measurement, not to go green: on a goal-paced week a
  // 5K intermediate's continuous tempo (6 km) becomes a rep row sized by the existing threshold work band
  // (`tempo_cruise_short`, 8 km), in the same week a fourth run day is added. 2 of 1,200 masters plans
  // (cohort k=482, 770), W8, +78% non-long-run; the beginners' tail FELL (59 → 52). Reported to the founder.
  healthy_masters:  { p99: 78,  max: 79 },
  injury:           { p99: 18,  max: 18 },
}

describe('§94 Am.4 — the delivered-ramp TAIL is measured, segmented, and may not grow', () => {
  it('the corpus is real and every segment is POPULATED', () => {
    // 🔴 THE ARM THAT MATTERS MOST. Sims's segmentation is worthless if a segment
    // silently empties — an empty segment passes every percentile arm below. This
    // is also the exact defect that bit the board evidence twice in one day:
    // `cohortGrid` has 0 injury rows, so a corpus that looked complete could not
    // reach the cohort the ruling was about.
    expect(measured.plans, 'the corpus stopped generating').toBeGreaterThan(CORPUS.length * 0.85)
    for (const seg of ['healthy_standard', 'healthy_masters', 'injury'] as Segment[]) {
      expect(measured.bySeg[seg], `segment ${seg} is EMPTY — the baseline below is vacuous`)
        .toBeGreaterThan(50)
    }
  })

  it("the invariant's message shape has not changed under us", () => {
    expect(unparsed.slice(0, 3),
      "INV-PLAN-DELIVERED-RAMP's `actual` no longer matches '+N% week, +N% non-long-run'. "
      + 'This file PARSES the invariant rather than re-deriving the magnitude, deliberately — '
      + 're-deriving produced three different numbers for one question at the sitting. Update '
      + 'the pattern, do not switch to a second computation.').toEqual([])
  })

  it('the detector sees magnitudes at all — vacuity', () => {
    // Without this, a parse that always failed would leave `fires` empty and
    // every percentile arm would pass on NaN forever.
    expect(measured.fires.length, 'no §94 firings parsed: the tail is unmeasured, not absent')
      .toBeGreaterThan(100)
    expect(measured.fires.every(f => Number.isFinite(f.trimable))).toBe(true)
  })

  it('🔴 the TRIMABLE tail does not grow, per segment', () => {
    const grown: string[] = []
    for (const seg of Object.keys(TRIMABLE_BASELINE) as Segment[]) {
      const xs = trimableOf(seg)
      const base = TRIMABLE_BASELINE[seg]
      const p99 = xs.length ? q(xs, 0.99) : 0
      const max = xs.length ? Math.max(...xs) : 0
      if (p99 > base.p99) grown.push(`${seg} p99 ${p99} > ${base.p99}`)
      if (max > base.max) grown.push(`${seg} max ${max} > ${base.max}`)
    }
    expect(
      grown,
      'The delivered-ramp tail GREW. §94 Am.4 governs the trimable arm because §52 exempts the '
      + 'long run by ruling. If a change improved it, LOWER the baseline in the same commit; if '
      + 'it worsened it, that is a load regression and Willy asked to be told about the tail '
      + 'rather than the rate.',
    ).toEqual([])
  })

  it('⛔ no coaching NUMERIC exists for this, and that is the ruling', () => {
    // The ruling REFUSED a refusal threshold: "a percentile is not a dose", and
    // §2 Am.2 freezes the predicate until outcome data exists.
    //
    // 🔴 THE FIRST VERSION OF THIS ARM WAS SELF-REFERENTIAL AND FAILED ON ITSELF.
    // It read this file's own source and asserted the absence of names like
    // `REFUSAL_THRESHOLD` — which the assertion itself contained, so it could
    // only ever fail. The honest property is not "this file avoids some words":
    // it is that **a threshold would have to be a coaching numeric**, and the
    // Configuration Singularity means that means a key in `GENERATION_CONFIG`.
    // That is checkable without reading this file at all.
    const keys = Object.keys(GENERATION_CONFIG)
    for (const banned of ['DELIVERED_RAMP_TAIL_MAX_PCT', 'DELIVERED_RAMP_REFUSAL_PCT', 'MAX_DELIVERED_RISE_PCT']) {
      expect(keys, `${banned} would be an invented number — §2 Am.2 and §94 Am.3 both forbid it`)
        .not.toContain(banned)
    }
    // And the governing structure stays a fixture in this file: three segments,
    // two fields each, no more. A fourth field is how a threshold sneaks in.
    expect(Object.keys(TRIMABLE_BASELINE).sort())
      .toEqual(['healthy_masters', 'healthy_standard', 'injury'])
    for (const v of Object.values(TRIMABLE_BASELINE)) {
      expect(Object.keys(v).sort()).toEqual(['max', 'p99'])
    }
  })

  it('reports both arms, and the maximum is a property of the CORPUS, not a ceiling', () => {
    // 📊 Seiler refused to read p99 ~= MAX as a tail. The top is
    // `67 67 67 67 67 67 67 65 65 62 62 52` — seven identical maxima then a
    // 15-point gap, which is one recurring week shape, not a clamp. Asserted so
    // the claim in the header stays true: if the duplicates ever disappear, the
    // reasoning in this file needs revisiting.
    const all = measured.fires.map(f => f.trimable).sort((a, b) => b - a)
    const top = all[0]
    // Within one point of the top, because these are rounded percentages: after SESSION-KM-STRUCTURED-PACE-01 the top
    // is `79 78 78` (the earlier `94 94` pair was a sizing artefact and is gone). Re-checked against Seiler's question:
    // the 79 and the two 78s are one masters week shape, not a clamp, so the reasoning still holds.
    // §120 Am. 2 (GOAL-PACE-REACHABLE-01, 2026-10-27) — RE-CHECKED, AND THE MAXIMUM NO LONGER REPEATS. Top was
    // `79 78 78 61 58 53`; it is now `79 61 52 51 51 50`. The two 78s were 5K masters goal-paced weeks (GOALPACE-5K-01's
    // rep row arriving with a fourth run day), and withholding goal pace past the line removed them: the tail FELL.
    // Seiler's question answered again: nothing in the engine clamps at 79 (no constant, no cap reaches it), and the 79
    // is one masters week, 18 points clear of the next, so it is a corpus property, not a ceiling. Held at the old
    // maximum so a NEW top cannot slip in under this reasoning.
    expect(top, 'a new maximum: re-check Seiler\'s question before raising anything').toBeLessThanOrEqual(79)
    const dupes = all.filter(v => v >= top - 1).length
    expect(dupes, 'the top is one week; if it repeats again, say why').toBeGreaterThanOrEqual(1)
    // eslint-disable-next-line no-console
    console.log(`\n  §94 Am.4 delivered-ramp tail (TRIMABLE arm, the governed one):`)
    for (const seg of Object.keys(TRIMABLE_BASELINE) as Segment[]) {
      const xs = trimableOf(seg)
      console.log(`    ${seg.padEnd(18)} plans ${String(measured.bySeg[seg]).padStart(4)}  firings ${String(xs.length).padStart(4)}`
        + (xs.length ? `  p50 ${q(xs,.5)}%  p90 ${q(xs,.9)}%  p99 ${q(xs,.99)}%  max ${Math.max(...xs)}%` : '  (no firings in this sample)'))
    }
    console.log(`    maximum ${top}% occurs ${dupes}x — a corpus week, NOT the engine's ceiling (nothing clamps there)\n`)
  })
})
