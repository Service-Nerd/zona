import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from './cohortGrid'
import { hasVolumeCappedInjuryHistory } from './injuryScope'
import { sessionKmSelfPaced } from './sessionDistance'
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

type Driver = 'quality' | 'easy' | 'both' | 'unresolved'
interface Fire {
  segment: Segment; week: number; trimable: number
  /** Does ADR-022's lever set govern this runner? §12/§90's producer cap is knee/shin BY NAME. */
  leverScoped: boolean
  /** WHAT ROSE. §94 Am.5: the governed arm is non-long-run, which contains the quality session
   *  ADR-022's lever order forbids touching ("a quality session is never touched"). So a firing
   *  driven by quality ONSET reports a load change the lever set may not act on. */
  driver: Driver
}

/** Message shapes this file could not read. Asserted empty in a named arm. */
const unparsed: string[] = []

/** §94 Am.5 — what a week is MADE OF, so a firing can say what rose.
 *
 *  ⚠️ Computed inside the one existing generation pass, never by re-generating: this file's own
 *  header records that re-deriving a quantity produced three different numbers for one question. */
function compose(plan: Plan, n: number): { easyNonLong: number; quality: number } | null {
  const w = (plan.weeks as { n: number; sessions: unknown }[]).find(x => x.n === n)
  if (!w) return null
  const raw = w.sessions as unknown
  const ss = (Array.isArray(raw) ? raw : Object.values(raw as Record<string, unknown>))
    .flat().filter(Boolean) as Record<string, unknown>[]
  const run = ss.filter(x => x.type !== 'rest')
  const km = (x: Record<string, unknown>) => sessionKmSelfPaced(x as never) ?? 0
  const isQuality = (x: Record<string, unknown>) => x.type === 'quality' || x.type === 'hard' || x.type === 'intervals'
  const total = run.reduce((a, x) => a + km(x), 0)
  const longest = Math.max(0, ...run.map(km))
  const quality = run.filter(isQuality).reduce((a, x) => a + km(x), 0)
  return { easyNonLong: total - longest - quality, quality }
}

/** Which component grew into the firing week. 0.5 km of slack so rounding is not a driver. */
function driverOf(plan: Plan, week: number): Driver {
  const cur = compose(plan, week), prev = compose(plan, week - 1)
  if (!cur || !prev) return 'unresolved'
  const dQ = cur.quality - prev.quality
  const dE = cur.easyNonLong - prev.easyNonLong
  if (dQ > 0.5 && dE > 0.5) return 'both'
  if (dQ > 0.5) return 'quality'
  if (dE > 0.5) return 'easy'
  return 'unresolved'
}

const measured: {
  fires: Fire[]; plans: number; bySeg: Record<Segment, number>
  injuryPlansByScope: { leverScoped: number; notLeverScoped: number }
} = (() => {
  const fires: Fire[] = []
  const bySeg = { healthy_standard: 0, healthy_masters: 0, injury: 0 } as Record<Segment, number>
  const injuryPlansByScope = { leverScoped: 0, notLeverScoped: 0 }
  let plans = 0
  for (const input of CORPUS) {
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch { continue }
    plans++
    const seg = segmentOf(input)
    bySeg[seg]++
    // §94 Am.5 — the DENOMINATOR the 2026-10-10 sitting never had. A rate needs one, and
    // "0 firings" means nothing until you say 0 of how many.
    const leverScoped = hasVolumeCappedInjuryHistory(injuriesOf(input) as string[])
    if (seg === 'injury') injuryPlansByScope[leverScoped ? 'leverScoped' : 'notLeverScoped']++
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
      const week = v.week ?? 0
      fires.push({ segment: seg, week, trimable: Number(m[2]), leverScoped, driver: driverOf(plan, week) })
    }
  }
  return { fires, plans, bySeg, injuryPlansByScope }
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
 * 🔴 THE SENTENCE THAT USED TO BE HERE WAS VACATED BY THE BOARD ON 2026-11-04
 * (§94 Amendment 5, `INJURY-TAIL-PRODUCTION-SHAPE-01`). It read: *"ADR-022's three
 * levers bind on the injured, and §94/§100 left the healthy with the higher
 * ceiling. That was the headline of the sitting and it survives segmentation."*
 *
 * It does not survive segmentation, because the segment was not fine enough.
 * `segmentOf` calls any injury history `injury`, and `TARGETED_INJURIES` is
 * `Knee | Shin splints | Achilles`. **ADR-022's three levers and §12's producer cap
 * are scoped to knee/shin by name** (`hasVolumeCappedInjuryHistory`); achilles sits
 * in the CHECKER's wider cohort by the 2026-09-25 ruling and gets none of the
 * levers. Measured: **knee 0 firings / 202 plans, shin 0 / 199, achilles 48 / 199.**
 * So the injury segment's tail is composed ENTIRELY of the cohort the levers do not
 * reach, and the low 18% was too. A claim about lever count was read off a population
 * containing no instance of the levers governing anyone.
 *
 * ✅ WHAT REPLACES IT IS STRONGER, NOT WEAKER: **where ADR-022's levers apply, the
 * delivered ramp does not fire at all** — 0 of 401 plans. The arms below hold that at
 * EXACT zero, so the day a knee or shin plan fires, this file says so.
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
  // GOAL-PACE-LR-CURRENT-01 (2026-10-27), raised p99 53 -> 58 with the measurement, told to the founder as Willy asked:
  // restoring §47's step-back for withheld marathon/HM plans puts a 25 km step-back week before a 34 km peak week, so the
  // week AFTER the step-back carries the rise (one HM runner at 20 km/week, 3 days: +58% non-long-run in W13). Weekly
  // volume is unchanged against the commit before §120 Am. 2; the absorbing session is an easy run, a pattern that
  // already existed in 235 of 1,377 time-target plans before today (filed: EASY-RUN-ABSORBS-QUALITY-01). Max unchanged.
  // 🔴 COHORT-GRID-UNSET-LEVEL-01 (2026-11-03) — RAISED ON ALL THREE SEGMENTS, and this
  // is the entry to read before any other. THE ENGINE DID NOT CHANGE: `verify:parity`
  // is IDENTICAL on all 6,102 cases. THE CORPUS DID. Both grids forced
  // `fitness_level`, the API structural override no production caller sends, so every
  // measurement ever taken on this file was taken on a runner shape the product cannot
  // build. Measured before and after with this same instrument and corpus size
  // (1,800 inputs, 1,750 -> 1,752 generated):
  //
  //   healthy_standard  147 -> 137 firings   p90 39 -> 36   p99 58 -> 75   max 58 -> 75
  //   healthy_masters   168 -> 146 firings   p90 37 -> 43   p99 52 -> 88   max 79 -> 88
  //   injury             51 ->  48 firings   p90 18 -> 42   p99 18 -> 42   max 18 -> 42
  //
  // 🩹 WILLY'S CONDITION IS "WATCH THE TAIL, NOT THE RATE", AND THE TWO MOVED IN
  // OPPOSITE DIRECTIONS. Total firings fall 366 -> 331 (-9.6%) on every segment, so
  // FEWER plans breach §2 at delivery — and the breaches that remain are far bigger.
  // The injury segment's p90 more than DOUBLES.
  //
  // 🔴 AND IT PUTS ADR-022'S PREMISE IN QUESTION, WHICH IS WHY THIS IS FILED AND NOT
  // JUST RE-BASELINED. The paragraph above still reads "Injury maxes at 18% against
  // healthy-standard 105%... ADR-022's three levers bind on the injured". Every
  // injured row in `targetedGrid` was forced to a BEGINNER structural band, and the
  // three levers are structural. On the production shape (30 km/week, 12 km longest,
  // assessed INTERMEDIATE) the injury tail is 42%, not 18%. Filed for the Coaching
  // Board as `INJURY-TAIL-PRODUCTION-SHAPE-01`. Raised here so the gate ratchets from
  // the real population instead of staying green on a fiction.
  healthy_standard: { p99: 75, max: 75 },
  // GOALPACE-5K-01 (2026-10-23), raised 59 → 78 with the measurement, not to go green: on a goal-paced week a
  // 5K intermediate's continuous tempo (6 km) becomes a rep row sized by the existing threshold work band
  // (`tempo_cruise_short`, 8 km), in the same week a fourth run day is added. 2 of 1,200 masters plans
  // (cohort k=482, 770), W8, +78% non-long-run; the beginners' tail FELL (59 → 52). Reported to the founder.
  healthy_masters:  { p99: 88,  max: 88 },
  injury:           { p99: 42,  max: 42 },
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
    // §94 Am.5 (2026-11-04) added the last two: the sitting that vacated the lever-count attribution
    // was offered an achilles-specific tolerance three different ways, and refused each. If one ever
    // arrives it will arrive under a name like these.
    for (const banned of ['DELIVERED_RAMP_TAIL_MAX_PCT', 'DELIVERED_RAMP_REFUSAL_PCT', 'MAX_DELIVERED_RISE_PCT',
      'INJURY_DELIVERED_RAMP_MAX_PCT', 'UNACTIONABLE_RAMP_SHARE_MAX_PCT']) {
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
    // 🔴 COHORT-GRID-UNSET-LEVEL-01 — 79 -> 88, AND SEILER'S QUESTION RE-ASKED, because
    // raising this line without re-asking it is the whole thing the comment above warns
    // against. The top is now `88 88 75 75 69 58 58 58 55 54 54 50`: TWO PAIRS, then a
    // 6-point step. A pair is the same week shape recurring across rows that differ only
    // on axes irrelevant to that week — the reasoning the header already records — and
    // nothing in the engine clamps at 88 (no constant or cap reaches it; `verify:parity`
    // is IDENTICAL, so no engine value moved at all). It is a corpus property, and the
    // corpus is now the production one. Still never a ceiling.
    expect(top, 'a new maximum: re-check Seiler\'s question before raising anything').toBeLessThanOrEqual(88)
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

// ── §94 Amendment 5 (Coaching Board 2026-11-04, `INJURY-TAIL-PRODUCTION-SHAPE-01`) ────────────────────────
//
// 🔴 THE 2026-10-10 SITTING ATTRIBUTED A LOW INJURED TAIL TO ADR-022's LEVER COUNT, AND THE SEGMENT IT
// MEASURED CONTAINED NO RUNNER THE LEVERS GOVERN. `segmentOf` calls any history `injury`; the levers and
// §12's producer cap are knee/shin BY NAME. The attribution is vacated and replaced by the measurement.
//
// ⚠️ ITS OWN FIXTURE, NOT A FOURTH FIELD ON `TRIMABLE_BASELINE`. That object is held to exactly three
// segments and two fields by the no-numeric arm above, on the stated grounds that *"a fourth field is how
// a threshold sneaks in"* — so extending it to carry this would have broken a gate that is protecting
// something real, and the temptation would then have been to loosen the gate.
//
// 📐 MEASURED 2026-11-04 (this corpus; and on the FULL achilles population of `targetedGrid`, 1,536 rows,
// the rate is 400/1,536 = 26.0%, so the sample is not flattering it):
//
//   knee          0 firings / 202 plans = 0.0%   ← ADR-022's levers BIND
//   shin splints  0 firings / 199 plans = 0.0%   ← ADR-022's levers BIND
//   achilles     48 firings / 199 plans = 24.1%  ← no levers
//
// Driver decomposition over all 400 achilles firings on the full population:
//   QUALITY arrived, easy flat or DOWN  176  44.0%   ← ADR-022 forbids trimming this
//   EASY rose, quality flat              96  24.0%   ← the lever set's own target
//   BOTH rose                           128  32.0%
//
// 🩹 Willy: a governed arm that is 44% composed of load his lever set may not touch is reporting a problem
// nobody may act on — his own noise standard, and the logical form of the condition the 2026-09-25 ruling
// named as reopening it (*"rises the engine may not trim, which would make them unactionable"*).
// The worst case is quality ONSET: easy volume falls 12 → 8 km to fund a 9 km CV-interval session in W6.
// **The mechanism is §89/ADR-021's onset timing, not §94.** Filed as `ACHILLES-QUALITY-ONSET-01` 🏃.
const LEVER_SCOPE_BASELINE = {
  /** EXACT. Not a ceiling, not a tolerance — the measured fact the vacated sentence should have been.
   *  The day a knee or shin plan breaches §2 at delivery, this goes red and the board hears about it. */
  leverScopedFirings: 0,
  /** Share of NOT-lever-scoped firings whose rise the lever set may not act on (quality or both).
   *  May FALL freely; a rise means more unactionable reporting and is a finding, not a pass.
   *
   *  ⚠️ 71 IS THIS CORPUS'S MEASURED VALUE, NOT THE FULL POPULATION'S 76%. The first draft of this
   *  line carried 76 — the figure from all 1,536 achilles rows — against an arm that measures the
   *  1,800-input SAMPLE, which reads 70.9%. That is 5pp of slack nobody decided to grant, and §94
   *  Am.3's *"any non-zero tolerance is an invented number"* applies to a baseline exactly as it
   *  applies to a threshold. Sample: quality 29.2% + both 41.7% = 70.9%. Full population, for
   *  context and not for this gate: quality 44.0% + both 32.0% = 76.0%. */
  unactionableSharePct: 71,
} as const

describe('§94 Am.5 — the injury segment is TWO cohorts, and only one has levers', () => {
  const injuryFires = measured.fires.filter(f => f.segment === 'injury')
  const scoped = injuryFires.filter(f => f.leverScoped)
  const unscoped = injuryFires.filter(f => !f.leverScoped)

  it('🔴 VACUITY FIRST: the corpus contains lever-scoped injured plans at all', () => {
    // Without this, the zero below passes trivially the day `TARGETED_INJURIES` drops knee/shin —
    // which is exactly how the vacated attribution survived: a corpus artefact read as a rule.
    expect(measured.injuryPlansByScope.leverScoped,
      'no knee/shin plans in the corpus: the 0-firing arm below would be vacuous, not true')
      .toBeGreaterThan(100)
    expect(measured.injuryPlansByScope.notLeverScoped,
      'no achilles plans: the driver decomposition below would be vacuous')
      .toBeGreaterThan(100)
  })

  it('🔴 where ADR-022 LEVERS APPLY, the delivered ramp does not fire — EXACTLY zero', () => {
    expect(scoped.length,
      'A knee or shin-splint plan breached §2 at delivery. ADR-022 gave this cohort three levers '
      + '(deload re-anchored to the post-cap prior week, the injury peak week yielding its 2nd quality, '
      + 'easy runs trimming while §52\'s long run never does) and until now they drove this to zero on '
      + `${measured.injuryPlansByScope.leverScoped} plans. This is a load regression on the cohort with `
      + 'the strongest tissue argument. Do not re-baseline: take it to the Coaching Board (§94 Am.5).')
      .toBe(LEVER_SCOPE_BASELINE.leverScopedFirings)
  })

  it('🔴 so the whole injury tail belongs to the cohort with NO levers', () => {
    expect(unscoped.length).toBe(injuryFires.length)
    expect(injuryFires.length).toBeGreaterThan(0)
  })

  it('🔴 VACUITY: the unactionable drivers are PRESENT — a zero here is a finding, not a pass', () => {
    // 🔴 THIS ARM EXISTS BECAUSE THE ONE BELOW WAS HOLLOW AND A MUTATION PROVED IT. Forcing
    // `driverOf` to return 'easy' for every firing — i.e. claiming every rise is one ADR-022 may
    // trim — left all twelve arms GREEN, because a one-sided ratchet reads 0% as a triumph. The
    // share falling to zero does not mean the engine improved; it means either the decomposition
    // stopped working or the mechanism changed fundamentally, and both need a human. §94 Am.5's
    // whole finding is that these drivers DOMINATE, so their absence falsifies the amendment.
    const quality = unscoped.filter(f => f.driver === 'quality').length
    const both = unscoped.filter(f => f.driver === 'both').length
    expect(quality + both,
      'No achilles firing is driven by quality any more. §94 Am.5 recorded 70.9% on this corpus. '
      + 'If the engine genuinely changed, that is a Coaching Board matter (it would mean the '
      + 'base-to-build quality onset no longer moves the delivered week) — do not delete this arm.')
      .toBeGreaterThan(0)
    expect(quality, 'the pure quality-onset driver is gone: trace W6 before accepting it').toBeGreaterThan(0)
  })

  it('🔴 the UNACTIONABLE share does not grow — the arm must not drift further from the lever set', () => {
    const unactionable = unscoped.filter(f => f.driver === 'quality' || f.driver === 'both').length
    const pct = unscoped.length ? Math.round((100 * unactionable) / unscoped.length) : 0
    expect(pct,
      'More of the governed arm is now load ADR-022 may not trim. §94 Am.5 records this at '
      + `${LEVER_SCOPE_BASELINE.unactionableSharePct}%. Willy's standard is that a check reporting a `
      + 'problem nobody may act on is noise, and noise gets suppressed. If a change IMPROVED this, lower '
      + 'the baseline in the same commit.')
      .toBeLessThanOrEqual(LEVER_SCOPE_BASELINE.unactionableSharePct)
  })

  it('🔴 every firing resolves to a named driver — an unresolved one hides the mechanism', () => {
    expect(injuryFires.filter(f => f.driver === 'unresolved'),
      'a firing whose driver could not be read: the decomposition is the ruling, so this may not be silent')
      .toEqual([])
  })

  it('📊 Seiler: the injury maximum is still a CORPUS week, not an engine ceiling', () => {
    const xs = injuryFires.map(f => f.trimable).sort((a, b) => b - a)
    const top = xs[0]
    const cells = injuryFires.filter(f => f.trimable === top)
    // On the full achilles population the max is 32 firings from exactly TWO distinct input cells,
    // differing only on `weeks_at_current_volume` — an axis that cannot touch W6. Density, not a clamp.
    expect(new Set(cells.map(f => f.week)).size,
      'the maximum now spans several weeks: it is no longer one recurring shape, so re-ask Seiler')
      .toBe(1)
    // eslint-disable-next-line no-console
    console.log(`\n  §94 Am.5 injury segment, decomposed by LEVER SCOPE:`)
    console.log(`    lever-scoped (knee/shin)  plans ${String(measured.injuryPlansByScope.leverScoped).padStart(4)}  firings ${String(scoped.length).padStart(4)}  <- ADR-022 binds`)
    console.log(`    not lever-scoped          plans ${String(measured.injuryPlansByScope.notLeverScoped).padStart(4)}  firings ${String(unscoped.length).padStart(4)}`)
    for (const d of ['quality', 'easy', 'both'] as Driver[]) {
      const n = unscoped.filter(f => f.driver === d).length
      console.log(`      driver=${d.padEnd(8)} ${String(n).padStart(4)}  ${unscoped.length ? (100 * n / unscoped.length).toFixed(1) : '0.0'}%`
        + (d === 'easy' ? '   <- the only one the lever set may act on' : ''))
    }
    console.log(`    max ${top}% x${cells.length}, all in W${cells[0].week} — a corpus week shape\n`)
  })
})
