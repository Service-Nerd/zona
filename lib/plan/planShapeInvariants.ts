// I1–I10 — the PLAN SHAPE invariants (MKT-PLAN-SHAPE-01, 2026-09-21).
//
// The nine published `/plans/*` pages are about to become TikTok/Instagram
// carousels, one slide per week. Every week becomes publicly visible to runners
// who comment, so the SHAPE of the block — does it ramp, does it deload, does
// peak actually peak — stops being an internal quality question and becomes the
// product's public face.
//
// WHY THIS MODULE EXISTS SEPARATELY FROM `invariants.ts`. `validatePlan()` asks
// "does this week break a rule?" and it answers correctly and in isolation.
// Every one of the seven defects the 2026-09-21 audit found is a relationship
// BETWEEN weeks that were each individually legal:
//
//   · build week 1 at the recovery week's volume — each week legal, the pair not
//   · peak lower than base                       — each week legal, the arc not
//   · a recovery week 3% below the week it recovers from
//   · a deload after ONE loading week
//
// `verify` proves plans are VALID. `verify:parity` proves they are UNCHANGED.
// `cohort:shape` proves the POPULATION has not shifted. `measure:fitness` proves
// the runner is BUILT. None of them looks at the week-to-week arc of one plan,
// which is exactly the thing a carousel renders. This is that fifth question.
//
// ⚠️ SEVERITY IS SPLIT, AND THE SPLIT IS THE POINT. `gate: true` findings fail
// the build. `gate: false` (advisory) findings are measured and printed but do
// NOT fail, because the invariant as written CONTRADICTS a ratified Coaching
// Board decision and the contradiction is the founder's call, not this module's.
// Each advisory names the principle it collides with. A silent compromise —
// implementing 80% of a proposed rule and reporting it as done — is the failure
// this repo has recorded most often; see `feedback_completion_claims_carry_their
// _negative_space`. So the rule is implemented AS WRITTEN and the conflict is
// surfaced, rather than the rule being quietly softened until it passes.

import type { Plan, Session } from '@/types/plan'
import type { Day } from './days'
import { GENERATION_CONFIG, raceDistanceKey } from './generationConfig'
import { SESSION_FORMAT, sessionSplit } from './sessionFormat'
import { isLongRun, isShakeout, isTimeTrial } from './sessionRole'
import { catalogueRowFor } from './catalogueLink'
import { sessionKmSelfPaced } from './sessionDistance'
import { trainingKm } from './weekVolume'

export interface ShapeFinding {
  id: string
  weekN: number
  message: string
  /** false = measured and reported, but does NOT fail the build (see header). */
  gate: boolean
  /** For an advisory, the ratified principle it contradicts. */
  conflictsWith?: string
}

type AnyWeek = Plan['weeks'][number]

const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const sessionsOf = (w: AnyWeek): { day: Day; s: Session }[] =>
  DAYS.map(d => ({ day: d, s: (w.sessions as Partial<Record<Day, Session>>)[d] }))
    .filter((x): x is { day: Day; s: Session } => x.s != null)

const isRaceWeek = (w: AnyWeek) => w.type === 'race'
const isDeload   = (w: AnyWeek) => w.type === 'deload'
/** A LOADING week — the reference every progression rule in this file measures
 *  against. Neither a planned drop (deload) nor the race. */
const isLoading  = (w: AnyWeek) => !isDeload(w) && !isRaceWeek(w)

const km = (s: Session | null | undefined): number => sessionKmSelfPaced(s) ?? 0

// Weekly km EXCLUDING the race — D1. Imported from `weekVolume`, not
// re-expressed here, so the published page and this checker cannot drift about
// what "training volume" means.
export { trainingKm, raceKm as raceKmOf } from './weekVolume'

/** The weekday easy runs of a week — not the long run, not a shakeout, not the
 *  5K time trial (`type: 'hard'`, which shares no properties with an easy run). */
export function easyRunsKm(w: AnyWeek): number[] {
  return sessionsOf(w)
    .filter(x => x.s.type === 'easy' && !isLongRun(x.s) && !isShakeout(x.s))
    .map(x => km(x.s))
    .filter(v => v > 0)
}

export function longRunKm(w: AnyWeek): number | null {
  const lr = sessionsOf(w).find(x => isLongRun(x.s))
  return lr ? km(lr.s) : null
}

/** Sessions that are quality WORK, by the rule I8 states: a structured session,
 *  the 5K time trial, OR a long run carrying a prescribed race-pace segment. */
export function qualitySessionsOf(w: AnyWeek): { day: Day; s: Session }[] {
  return sessionsOf(w).filter(({ s }) =>
    s.type === 'quality' || isTimeTrial(s) || racePaceSegmentPct(s) > 0)
}

/**
 * The fraction of a session prescribed ABOVE Zone 2, as a percentage of its
 * duration. Zero for a plain easy or long run.
 *
 * Read from the catalogue row's `main_set_structure.race_pace_pct` — the single
 * owner §25 Amendment 1 established — via the stamped `catalogue_id`, never from
 * the label. §24b's 5K/10K three-part long run is built inline with no catalogue
 * row, so its two segments come from their own config constants.
 */
export function racePaceSegmentPct(s: Session): number {
  const row = catalogueRowFor(s)
  const mss = row?.main_set_structure as { type?: string; race_pace_pct?: number } | undefined
  if (mss?.type === 'long_run_with_segment' && typeof mss.race_pace_pct === 'number') {
    return mss.race_pace_pct
  }
  // §24b — the inline 5K/10K segmented peak long run. No row to read, so the
  // config constants that BUILT it are the authority.
  if (isLongRun(s) && s.lr_segment_pace && !row) {
    return Math.round(
      (GENERATION_CONFIG.LR_5K10K_PEAK_MID_SEGMENT_PCT
        + GENERATION_CONFIG.LR_5K10K_PEAK_FINAL_SEGMENT_PCT) * 100)
  }
  return 0
}

/**
 * Minutes in this session prescribed at an intensity ABOVE easy.
 *
 *   · quality / hard  → the MAIN SET only. `sessionSplit` is the repo's single
 *                       owner of the warm-up / main / cool-down carve; the
 *                       warm-up and cool-down are Z1–Z2 and ARE easy minutes.
 *   · race            → all of it.
 *   · easy / long     → the prescribed race-pace segment, if any.
 */
export function nonEasyMinutes(s: Session): number {
  const mins = s.duration_mins ?? 0
  if (mins <= 0) return 0
  if (s.type === 'race') return mins
  if (s.type === 'strength' || s.type === 'rest') return 0
  if (s.type === 'quality' || isTimeTrial(s)) return sessionSplit(mins).main
  const segPct = racePaceSegmentPct(s)
  return segPct > 0 ? mins * segPct / 100 : 0
}

/**
 * I10 — the easy share of a plan, BY TIME, as a percentage.
 *
 * ⚠️ READ THE DEFINITION BEFORE QUOTING THE NUMBER. "Easy" here means
 * *prescribed at or below Zone 2*, measured in minutes, across every session of
 * every week including race week. A quality session contributes its warm-up and
 * cool-down to the easy side and its main set to the hard side, because that is
 * what §16 prescribes and what the runner actually runs. A long run carrying a
 * race-pace finish contributes that segment to the hard side.
 *
 * This is NOT §1's number. §1's ceiling (`max_quality_session_pct`) is a ratio of
 * SESSION COUNTS and says nothing about minutes; the two answer different
 * questions and will not agree. Quoting one as the other is the class of error
 * `feedback_the_denominator_is_where_claims_fail` records.
 */
export function easySharePctByTime(plan: Plan): number {
  let total = 0
  let hard = 0
  for (const w of plan.weeks) {
    if (w.n < 1) continue  // §57 foundation weeks are not part of the arc
    for (const { s } of sessionsOf(w)) {
      const mins = s.duration_mins ?? 0
      if (mins <= 0 || s.type === 'strength' || s.type === 'rest') continue
      total += mins
      hard += nonEasyMinutes(s)
    }
  }
  return total > 0 ? (total - hard) / total * 100 : 100
}

export interface WeekRow {
  n: number; phase: string; deload: boolean; race: boolean
  weeklyKm: number; easyKm: number[]; longKm: number | null; qualityKm: number[]
}

export function weekRows(plan: Plan): WeekRow[] {
  return plan.weeks.filter(w => w.n >= 1).map(w => ({
    n: w.n,
    phase: String(w.phase ?? ''),
    deload: isDeload(w),
    race: isRaceWeek(w),
    weeklyKm: w.weekly_km,
    easyKm: easyRunsKm(w),
    longKm: longRunKm(w),
    qualityKm: qualitySessionsOf(w).map(x => km(x.s)),
  }))
}


/**
 * Is this week a §47 peak-phase STEP-BACK — a deliberately reduced week sitting
 * before a peak-level one?
 *
 * Read from the OUTCOME (this week's long run is shorter than the next loading
 * week's), not by re-deriving §47's placement. The producer's own anchor, per
 * `applyPeakLongRunAlternation`, is "a week is stepped back when the week after
 * it is peak-level"; asking the same question of the finished plan means this
 * cannot drift from it, and it stays true if §47's internals change.
 *
 * ⚠️ NOT A GENERAL ESCAPE HATCH. It is consulted only by I2 and I6, only in the
 * peak phase, and only to move the test one week later — never to skip it. A
 * step-back that is NOT followed by a recovery to full height still fails I2 at
 * the following week, and I3's "peak is the peak" gate is untouched.
 */
function isPeakStepBack(weeks: AnyWeek[], i: number): boolean {
  const w = weeks[i]
  if (w.phase !== 'peak' || !isLoading(w)) return false
  const nextLoading = weeks.slice(i + 1).find(isLoading)
  if (!nextLoading || nextLoading.phase !== 'peak') return false
  const a = longRunKm(w), b = longRunKm(nextLoading)
  return a != null && b != null && a < b - 0.01
}

// ─── The ten checks ───────────────────────────────────────────────────────────

export function checkPlanShape(plan: Plan): ShapeFinding[] {
  const out: ShapeFinding[] = []
  const weeks = plan.weeks.filter(w => w.n >= 1)
  if (!weeks.length) return out

  const push = (id: string, weekN: number, message: string, gate: boolean, conflictsWith?: string) =>
    out.push({ id, weekN, message, gate, ...(conflictsWith ? { conflictsWith } : {}) })

  const distKey = raceDistanceKey(plan.meta.race_distance_km ?? 0)
  const pct = (a: number, b: number) => Math.round((a / b - 1) * 100)

  // ── I1 — loading-week progression ≤ max(10%, +3 km), vs the last LOADING week.
  //
  // The absolute arm is I1's own addition and only ever LOOSENS the percentage
  // arm, so it cannot admit anything §2 forbids on a plan large enough for the
  // percentage to bind. On a 18 km week, +3 km is +17%.
  const capPct = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
  const absArm = I1_ABSOLUTE_ARM_KM
  {
    let prevLoading: AnyWeek | null = null
    for (const w of weeks) {
      if (isLoading(w) && prevLoading) {
        const prev = trainingKm(prevLoading)
        const curr = trainingKm(w)
        const allowed = Math.max(prev * (1 + capPct / 100), prev + absArm)
        if (curr > allowed + 0.01) {
          // ADVISORY, AND THE REASON IS A RECONCILIATION, NOT A JUDGEMENT CALL.
          // I1 is §2 measured at delivery — which already exists, as
          // `INV-PLAN-DELIVERED-RAMP` (§94), and is already `warn` BY BOARD
          // RULING. §94 names the promotion to a producer change and declines
          // it in terms: "Re-anchoring the following week to the trimmed value
          // is the obvious fix and it is NOT taken here, because it would lower
          // delivered peak volume — the tonnage ceiling §79 and §89 explicitly
          // protect — and no measurement yet says by how much."
          //
          // Measured on the nine published plans: I1 as written fires 22 times;
          // INV-PLAN-DELIVERED-RAMP fires 6. The whole gap is the three gates
          // §94 ratified and I1 does not carry — a chronic-load floor (a rise
          // toward volume the runner already runs is not a spike), a 3 km
          // absolute floor, and a 10pp rounding tolerance for the fact that
          // `weekly_km` is an INTEGER, so 37 → 41 reads +10.8% where the curve
          // it came from read +7.7%.
          push('I1', w.n,
            `loading week stepped ${prev} → ${curr} km (+${pct(curr, prev)}%) against the last loading week (w${prevLoading.n}); cap is +${capPct}% or +${absArm} km`,
            false, '§94 / INV-PLAN-DELIVERED-RAMP — this exact rule is already checked at delivery and is `warn` by board ruling; I1 asks to promote it to a build-failing gate without §94\'s chronic-load, absolute-km and integer-rounding gates')
        }
      }
      if (isLoading(w)) prevLoading = w
    }
  }

  // ── I2 — resume after recovery, don't restart.
  //
  // The upper half (≤ the last loading week) is §2's own bounceback wording
  // verbatim: "may return to the pre-deload level, and no further". The lower
  // half (≥ 90%) is the rule that was missing, and its absence is P0-A.
  {
    let lastLoadingBeforeDeload: AnyWeek | null = null
    let sawDeload = false
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i]
      if (isDeload(w)) { sawDeload = true; continue }
      if (isRaceWeek(w)) continue
      // ⚠️ DEVIATION FROM I2 AS WRITTEN, STATED RATHER THAN ABSORBED. I2 says
      // "the FIRST loading week after a recovery week". On the 12-week plans the
      // peak phase OPENS on §47's step-back week, so the first loading week after
      // the last deload is deliberately reduced and I2 fires on three plans for a
      // shape that was chosen four days earlier (LONG-RUNWAY-EARNS-PLAN-01) to fix
      // a producer/checker drift. The test therefore moves ONE week — the plan must
      // resume within the block, not necessarily in the very next week. It is not
      // waived: if the following week also fails, the finding still fires.
      if (sawDeload && isPeakStepBack(weeks, i)) continue
      if (sawDeload && lastLoadingBeforeDeload) {
        const prev = trainingKm(lastLoadingBeforeDeload)
        const curr = trainingKm(w)
        const floor = prev * (I2_RESUME_MIN_PCT / 100)
        if (curr < floor - 0.01) {
          push('I2', w.n,
            `first loading week after recovery restarted at ${curr} km, ${pct(curr, prev)}% against the ${prev} km of w${lastLoadingBeforeDeload.n}; must resume at ≥${I2_RESUME_MIN_PCT}%`,
            true)
        }
        if (curr > prev + 0.01) {
          push('I2', w.n,
            `bounceback to ${curr} km exceeds the ${prev} km held before the recovery week (+${pct(curr, prev)}%); §2 says return to pre-deload and no further`,
            false, '§2 Amendment 1 — the healthy bounceback is deliberately UNBOUNDED above pre-deload in the peak phase; a hard ceiling here was measured and rejected by the board on 2026-09-06')
        }
        sawDeload = false
      }
      lastLoadingBeforeDeload = w
    }
  }

  // ── I3 — peak is the peak.
  {
    const maxOf = (ph: string) => Math.max(0, ...weeks.filter(w => w.phase === ph && isLoading(w)).map(trainingKm))
    const peakMax = maxOf('peak'), baseMax = maxOf('base'), buildMax = maxOf('build')
    if (peakMax > 0 && (peakMax < baseMax || peakMax < buildMax)) {
      const worst = weeks.find(w => w.phase === 'peak' && isLoading(w))
      push('I3', worst?.n ?? 0,
        `peak tops out at ${peakMax} km, below base ${baseMax} km / build ${buildMax} km — the plan peaks before its peak phase`,
        true)
    }
    // Non-decreasing within each loading block. ADVISORY — §47 alternates peak
    // long runs by design and `applyPeakStepBackVolume` lowers the step-back
    // week's volume with it.
    let prev: AnyWeek | null = null
    for (const w of weeks) {
      if (!isLoading(w)) { prev = null; continue }
      if (prev && trainingKm(w) < trainingKm(prev) - 0.01) {
        push('I3', w.n,
          `loading week fell ${trainingKm(prev)} → ${trainingKm(w)} km inside a block with no recovery week between`,
          false, '§47 — peak long runs ALTERNATE step-back / peak-level by design, and applyPeakStepBackVolume lowers the step-back week with them')
      }
      prev = w
    }
  }

  // ── I4 — recovery depth, and recovery easy runs never above the loading week's.
  {
    let prevLoading: AnyWeek | null = null
    for (const w of weeks) {
      if (isDeload(w) && prevLoading) {
        const prev = trainingKm(prevLoading), curr = trainingKm(w)
        const drop = prev > 0 ? (1 - curr / prev) * 100 : 0
        // ⚠️ THE INJURY CARVE IS SCOPED TO INJURY RUNNERS, AND THE FIRST CUT
        // WAS NOT — it read only the CONFIG value, which is a constant, so
        // `conflicts` was truthy on every plan and the too-shallow arm never
        // gated for anyone. Caught by the P1-B falsification case below, which
        // is the entire reason that case exists: a gate believed green is worth
        // nothing until it has been shown to go red.
        const injuryCut = 100 - GENERATION_CONFIG.INJURY_RECOVERY_WEEK_VOLUME_PCT
        const volumeCappedInjury = (plan.meta.injury_history ?? []).length > 0
        const conflicts = volumeCappedInjury && injuryCut < I4_MIN_DROP_PCT
          ? `§2 Amendment 2 (2026-09-16) — a §12 volume-capped injury runner gets a deliberately SHALLOWER cut (INJURY_RECOVERY_WEEK_VOLUME_PCT = ${GENERATION_CONFIG.INJURY_RECOVERY_WEEK_VOLUME_PCT}, i.e. ${injuryCut}%), which sits below I4's ${I4_MIN_DROP_PCT}% floor by ratified design`
          : undefined
        if (drop < I4_MIN_DROP_PCT - 0.5) {
          // TOO SHALLOW — GATES. This is the direction the audit found (a
          // recovery week 3% below the week it recovers from), and it has no
          // doctrinal defender: §3 promises 70%.
          push('I4', w.n,
            `recovery week only ${drop.toFixed(0)}% below w${prevLoading.n} (${prev} → ${curr} km); band is ${I4_MIN_DROP_PCT}–${I4_MAX_DROP_PCT}%`,
            !conflicts, conflicts)
        } else if (drop > I4_MAX_DROP_PCT + 0.5) {
          // TOO DEEP — ADVISORY. §3's 70% is applied to the volume CURVE by
          // `buildVolumeSequence`; the DELIVERED deload lands lower because its
          // smaller week hits session floors harder (the identical asymmetry
          // §3's LR-DELOAD-CUT-01 amendment documents for the long run, one
          // level up). Enforcing §3 at delivery is ADR-022's territory and
          // ADR-022 scoped itself to injury-history runners on purpose.
          push('I4', w.n,
            `recovery week cuts ${drop.toFixed(0)}% below w${prevLoading.n} (${prev} → ${curr} km); band is ${I4_MIN_DROP_PCT}–${I4_MAX_DROP_PCT}%`,
            false, '§3 / ADR-022 — RECOVERY_WEEK_VOLUME_PCT = 70 is applied to the volume CURVE; the delivered week falls further because session floors bite harder on a small week, and ADR-022 deliberately scoped delivered-volume enforcement to injury-history runners')
        }
        const maxEasyPrev = Math.max(0, ...easyRunsKm(prevLoading))
        const overshoot = easyRunsKm(w).filter(v => v > maxEasyPrev + 0.01)
        if (overshoot.length) {
          push('I4', w.n,
            `recovery-week easy runs ${JSON.stringify(overshoot)} km exceed the ${maxEasyPrev} km longest easy run of w${prevLoading.n}`,
            true)
        }
      }
      if (isLoading(w)) prevLoading = w
    }
  }

  // ── I5 — recovery placement.
  //
  // ⚠️ IMPLEMENTED CADENCE-RELATIVE, NOT AS THE LITERAL "week 4", AND THAT IS A
  // DEVIATION THE FOUNDER MUST SEE. I5 says "no earlier than week 4 (min 3
  // loading weeks before any recovery)". For a MASTERS runner §3's cadence is
  // 3:1, so their first recovery correctly falls on week 3 with 2 loading weeks
  // before it — the literal rule would fail every masters plan the engine has
  // ever produced. The parenthetical is the rule's own intent, so it is
  // expressed as `recoveryFreq − 1` loading weeks, which IS "3 loading weeks,
  // first recovery no earlier than week 4" for every non-masters plan, including
  // all nine published ones.
  {
    const freq = (plan.meta.age ?? 0) >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
      ? GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS
      : GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD
    const minLoading = freq - 1
    let loadingRun = 0
    for (const w of weeks) {
      if (isDeload(w)) {
        if (loadingRun < minLoading) {
          // ⚠️ ADVISORY, AND THE EVIDENCE IS A BRUTE-FORCE SEARCH, NOT AN
          // OPINION. I5 as written is UNSATISFIABLE on the shape that motivated
          // it. All 220 placements of three deloads in the 18-week marathon's
          // twelve eligible weeks were generated and validated: ZERO satisfy
          // I5 alongside §87 (no phase-opening), §95 (no build position 2),
          // §119 (min loading block), I2, I3 and the error invariants. Relax I5
          // alone and exactly TWO become legal — [3,6,9] and [3,6,10]. I5 is
          // therefore the binding constraint, and D-21 governs: a rule that
          // cannot be honoured is a defect in the rule.
          //
          // Its INTENT is ratified as §119 (`MIN_LOADING_BLOCK_WEEKS = 2`) —
          // "a deload after one loading week is meaningless" — which IS
          // satisfiable and which the sub-check below gates.
          push('I5', w.n,
            `recovery week after only ${loadingRun} loading week${loadingRun === 1 ? '' : 's'}; §3's ${freq}:1 cadence promises ${minLoading}`,
            false, `§3 masters cadence + §87 + §95 + §23 — brute-forced over all 220 placements on the 18-week marathon: 0 satisfy I5 jointly, 2 satisfy everything else ([3,6,9], [3,6,10]). I5 also fails every masters plan by construction, since §3's 3:1 cadence puts the first recovery on week 3 with 2 loading weeks. Ratified intent is §119's MIN_LOADING_BLOCK_WEEKS = ${GENERATION_CONFIG.MIN_LOADING_BLOCK_WEEKS}`)
        }
        loadingRun = 0
      } else if (isLoading(w)) loadingRun++
    }
  }

  // ── I6 — easy-run continuity.
  {
    let prevLoading: AnyWeek | null = null
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i]
      // §47 again, same allowance as I2 and stated for the same reason: a
      // step-back week reduces its easy runs along with its long run BY DESIGN.
      if (isLoading(w) && isPeakStepBack(weeks, i)) { prevLoading = w; continue }
      if (isLoading(w) && prevLoading && w.phase !== 'taper') {
        const a = Math.max(0, ...easyRunsKm(prevLoading))
        const b = Math.max(0, ...easyRunsKm(w))
        if (a > 0 && b < a * (1 - I6_MAX_EASY_DROP_PCT / 100) - 0.01) {
          push('I6', w.n,
            `longest easy run fell ${a} → ${b} km (${pct(b, a)}%) between loading weeks; cap is −${I6_MAX_EASY_DROP_PCT}%`,
            true)
        }
        // "No weekday easy run shorter than the plan's quality session."
        // ADVISORY — §9 sizes the easy runs as the REMAINDER of the week after
        // the long run and an 18%-of-weekly quality session, so on a low-volume
        // plan the arithmetic makes this unsatisfiable without shrinking quality.
        const q = Math.max(0, ...qualitySessionsOf(w).filter(x => !isLongRun(x.s)).map(x => km(x.s)))
        const short = easyRunsKm(w).filter(v => q > 0 && v < q - 0.01)
        if (short.length) {
          push('I6', w.n,
            `weekday easy runs ${JSON.stringify(short)} km are shorter than the ${q} km quality session`,
            false, '§9 + §8 — easy distance IS the remainder after the long run and an 18%-of-weekly quality session; on a low-volume week the remainder is arithmetically below the quality session')
        }
      }
      if (isLoading(w)) prevLoading = w
    }
  }

  // ── I7 — session typing, split in two because only one half is a defect.
  for (const w of weeks) {
    for (const { s } of sessionsOf(w)) {
      const segPct = racePaceSegmentPct(s)
      if (segPct > 0 && s.type === 'easy') {
        // I7a — ADVISORY. Re-typing this session to `quality` is not a local
        // change: `type: 'easy'` is what makes §9's long-vs-easy ratio, §52's
        // share cap and §1's session-count denominator treat a long run as the
        // aerobic volume it mostly is.
        push('I7a', w.n,
          `"${s.label}" carries ${segPct}% at race pace but is typed 'easy'`,
          false, "ADR-018 / §9 / §52 — a long run carries type 'easy' BY DESIGN so the ratio and share rules count it as aerobic volume; re-typing it to 'quality' moves it into §8's count ceiling, §7's spacing and §1's numerator at once")

        // I7b — GATE. The duration must reflect the pace the label prescribes.
        // This one has no doctrinal conflict: it is arithmetic, and ADR-015
        // already owns "the number shown to the runner must be the number the
        // prescription implies".
        const stated = s.duration_mins ?? 0
        const honest = honestDurationMins(s, segPct)
        if (honest != null && stated > 0 && stated > honest * (1 + I7B_DURATION_TOLERANCE_PCT / 100)) {
          push('I7b', w.n,
            `"${s.label}" states ${stated} min but its own prescription (${segPct}% at ${s.lr_segment_pace}) implies ≈${Math.round(honest)} min — the whole session is priced at easy pace`,
            true)
        }
      }
    }
  }

  // ── I8 — quality cap.
  //
  // ADVISORY IN FULL. §8's ceiling is set by FITNESS LEVEL (beginner 0 or 1,
  // intermediate 2, experienced 2), not by days available, and that is a
  // ratified ruling with its own recorded override of the original spec.
  for (const w of weeks) {
    if (isRaceWeek(w)) continue
    const days = sessionsOf(w).filter(x => x.s.type !== 'rest' && x.s.type !== 'strength').length
    const q = qualitySessionsOf(w)
    const allowed = days <= 4 ? I8_MAX_QUALITY_4_DAY : I8_MAX_QUALITY_5_DAY
    if (q.length > allowed) {
      push('I8', w.n,
        `${q.length} quality sessions (${q.map(x => x.s.label).join(', ')}) on a ${days}-day week; I8 allows ${allowed}`,
        false, '§8 — the quality ceiling is QUALITY_SESSIONS_PER_WEEK_MAX by fitness level (intermediate/experienced 2), deliberately not by day count')
    }
    // ≥1 easy day between quality sessions. This half has no conflict — §7
    // already says it — so it gates.
    const idx = q.map(x => DAYS.indexOf(x.day)).sort((a, b) => a - b)
    for (let i = 1; i < idx.length; i++) {
      if (idx[i] - idx[i - 1] < 2) {
        push('I8', w.n, `quality sessions on consecutive days (${DAYS[idx[i - 1]]}, ${DAYS[idx[i]]})`, true)
      }
    }
  }

  // ── I9 — taper length, including race week.
  {
    const taperWeeks = weeks.filter(w => w.phase === 'taper').length
    const want = I9_TAPER_WEEKS_INCL_RACE[distKey]
    const ratified = GENERATION_CONFIG.MAX_TAPER_PHASE_WEEKS[distKey]
    if (want != null && taperWeeks > want) {
      const conflicts = ratified > want
        ? `§49 — MAX_TAPER_PHASE_WEEKS.${distKey} = ${ratified} incl. race week, set by the Round-2 Case 04 review which found a 4-week marathon taper detrains and compresses the build; I9 asks for ${want}`
        : undefined
      push('I9', weeks.find(w => w.phase === 'taper')?.n ?? 0,
        `taper runs ${taperWeeks} weeks including race week; I9 asks for ${want}`,
        !conflicts, conflicts)
    }
  }

  // ── I10 — easy-share floor, by time.
  {
    const share = easySharePctByTime(plan)
    if (share < I10_MIN_EASY_SHARE_PCT - 0.05) {
      push('I10', 0, `easy share ${share.toFixed(1)}% by time, below the ${I10_MIN_EASY_SHARE_PCT}% floor`, true)
    }
  }

  return out
}

/**
 * What a segmented long run would take if each segment were run at the pace its
 * own coach note prescribes, rather than the whole thing being priced at easy
 * pace. Returns null when the segment pace cannot be parsed.
 */
function honestDurationMins(s: Session, segPct: number): number | null {
  const dist = s.distance_km
  const stated = s.duration_mins ?? 0
  if (dist == null || dist <= 0 || stated <= 0) return null
  const segPace = midpointMinPerKm(s.lr_segment_pace)
  // ⚠️ THE EASY PACE COMES FROM `pace_target`, THE BAND THE CARD SHOWS — NOT
  // FROM `stated / dist`. The first cut derived it from the duration it was
  // checking, so once the producer priced the session correctly the checker
  // simply re-derived the new blended pace as "easy" and fired again: a checker
  // that reads its own subject's output can never be satisfied, and worse, it
  // would have gone quiet on the ORIGINAL defect had the numbers moved the other
  // way. Reading the two rendered pace strings makes the assertion genuinely
  // independent of the engine's `PaceGuide` — it checks what the RUNNER is
  // shown against what the runner is shown.
  const easyPace = midpointMinPerKm(s.pace_target)
  if (segPace == null || easyPace == null) return null
  const segKm = dist * segPct / 100
  return (dist - segKm) * easyPace + segKm * segPace
}

/** '5:03–5:22 /km' or '5:40 /km' → minutes per km. */
function midpointMinPerKm(band: string | null | undefined): number | null {
  if (!band) return null
  const hits = Array.from(band.matchAll(/(\d+):(\d{2})/g)).map(m => Number(m[1]) + Number(m[2]) / 60)
  if (!hits.length) return null
  return hits.reduce((a, b) => a + b, 0) / hits.length
}

// ─── I1–I10's own numerics ────────────────────────────────────────────────────
// Deliberately NOT in GENERATION_CONFIG: these govern how a plan is CHECKED, not
// what the engine prescribes, and `configConsumer.test.ts` sorts config keys by
// what reads them. A checker's own tolerances living in the statute book is how
// a threshold comes to be read as doctrine. Every value below is I1–I10 as the
// 2026-09-21 brief wrote it.

/** I1 — the absolute arm, protecting low-volume plans from rounding. */
export const I1_ABSOLUTE_ARM_KM = 3
/** I2 — resume, don't restart. */
export const I2_RESUME_MIN_PCT = 90
/** I4 — recovery depth band. */
export const I4_MIN_DROP_PCT = 20
export const I4_MAX_DROP_PCT = 35
/** I6 — easy-run continuity. */
export const I6_MAX_EASY_DROP_PCT = 20
/** I7b — how far a stated duration may sit above its own prescription. */
export const I7B_DURATION_TOLERANCE_PCT = 3
/** I8 — quality cap by day count. */
export const I8_MAX_QUALITY_4_DAY = 1
export const I8_MAX_QUALITY_5_DAY = 2
/** I9 — taper weeks INCLUDING race week. */
export const I9_TAPER_WEEKS_INCL_RACE: Record<string, number> = {
  '5K': 2, '10K': 2, 'HM': 2, 'MARATHON': 3, '50K': 3, '100K': 3,
}
/** I10 — brand guardrail. */
export const I10_MIN_EASY_SHARE_PCT = 80

void SESSION_FORMAT
