import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan, INVARIANT_CODES } from '@/lib/plan/invariants'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { isLongRun } from '@/lib/plan/sessionRole'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * INVARIANT LIVENESS — can each rule still be made to fail? (test-coverage #5)
 *
 * `verify:invariants` proves every invariant is registered, declared, and passes
 * on three canonical cases. That is a check that they do not FALSE-fire. Nothing
 * proved the opposite and more important property: **that a rule can fire at
 * all.** An invariant that cannot be made to fail is not a safety net, it is a
 * green tick with nothing behind it — and this repo has shipped that exact thing
 * before (`--section-gap`, the decorative config family, D9's `flexShrink` that
 * never fired, §97's two inert gates).
 *
 * ⚠️ "NEVER FIRES ON A VALID PLAN" IS NOT THE SIGNAL, and reading it that way
 * would have been the wrong answer. Measured 2026-09-11: **86 of 93 invariants
 * never fire across 621 generated plans** — which is exactly what a healthy
 * engine looks like. A silent invariant is indistinguishable from a dead one
 * until you try to break the thing it guards.
 *
 * So this deliberately BREAKS valid plans, in ways the engine would never
 * produce, and records which rules wake up. A rule no mutation can wake is not
 * proven dead — it is UNPROVEN, and lands in the baseline with a reason:
 *
 *   corpus       the harness never builds this plan SHAPE (maintenance blocks
 *                have their own generator; foundation, recalibration and ultra
 *                paths are not in the cohort grid). Not a defect in the check.
 *   mutation     the battery does not yet perturb the field this rule reads.
 *                Add a mutation, not a fixture.
 *   unclassified nobody has looked yet. **This is the column that should shrink.**
 *
 * The baseline can only shrink — a NEW invariant that nothing can wake fails the
 * build, so the next one has to prove itself on the way in. Same debt-register
 * pattern as SWEEP-BASELINE-01, for the same reason: an unanswerable 93-item
 * audit becomes a tracked list that gets shorter.
 */

const clone = (p: Plan): Plan => JSON.parse(JSON.stringify(p))
const sessionsOf = (p: Plan) => p.weeks.flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Session[])
const realWeeks = (p: Plan) => p.weeks.filter(w => w.n > 0)
const anyOf = (p: Plan) => sessionsOf(p)[0]
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

type Poke = Record<string, unknown>

export interface Mutation { name: string; apply: (p: Plan) => void }

/** Ways to break a plan that the engine would never produce. */
export const MUTATIONS: Mutation[] = [
  { name: 'zero every distance',       apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).distance_km = null }) },
  { name: 'zero every duration',       apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).duration_mins = null }) },
  { name: 'halve every duration',      apply: p => sessionsOf(p).forEach(s => { const d = (s as unknown as {duration_mins?:number}).duration_mins; if (d) (s as unknown as Poke).duration_mins = Math.round(d / 2) }) },
  { name: 'treble every duration',     apply: p => sessionsOf(p).forEach(s => { const d = (s as unknown as {duration_mins?:number}).duration_mins; if (d) (s as unknown as Poke).duration_mins = d * 3 }) },
  { name: 'strip pace_target',         apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).pace_target }) },
  // The plan-level NOTE family (§51 returning-runner allowance, §79 Amendment 2
  // re-entry omission). These invariants assert "a decision the engine made is
  // TOLD to the runner", so the only way to wake them is to delete the telling
  // while leaving the decision — which is exactly the silent-degradation shape
  // they exist for. Stripping session `coach_notes` above does NOT reach them:
  // these notes live on `plan.meta`, not on a session.
  // The plan-level NOTE family (§51 returning-runner allowance, §79 Amendment 2
  // re-entry omission). These invariants assert "a decision the engine made is
  // TOLD to the runner", so waking them needs the DECISION present and the
  // TELLING removed — stripping the note alone is not enough, because on most
  // probe plans the decision was never made. Stripping session `coach_notes`
  // does not reach them either: these notes live on `plan.meta`.
  { name: 'claim returning allowance, delete its note', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.returning_runner_allowance_active = true
    delete meta.returning_runner_note
  } },
  // §79 — VO2max inside the protected window. The re-entry check was
  // DECORATIVE until 2026-09-15 (it read calendar weeks, which are all-easy by
  // construction, so it could not fail). Re-anchored to QUALITY weeks it can
  // fail, and this is the state that must make it: a plan claiming an active
  // window whose FIRST quality week carries vo2max-category work.
  { name: 'vo2max inside the re-entry window', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.intensity_reentry_active = true
    meta.intensity_reentry_weeks = 1
    for (const w of p.weeks) {
      if (w.n < 1) continue
      const q = Object.values(w.sessions).find(sn => sn && (sn as { type?: string }).type === 'quality')
      if (!q) continue
      const sn = q as unknown as Poke
      sn.catalogue_id = 'intervals_classic'
      sn.label = 'Classic VO2max'
      return                                  // first quality week only
    }
  } },
  { name: 'claim re-entry with no VO2max, delete its note', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.intensity_reentry_active = true
    delete meta.intensity_reentry_omission_note
    // Remove the VO2max work so the plan genuinely contains none — the state
    // §79 Amendment 2 permits, and requires the plan to declare.
    sessionsOf(p).forEach(s => {
      const sn = s as unknown as Poke & { type?: string }
      if (sn.type === 'quality') { delete sn.catalogue_id; sn.label = 'Easy run'; sn.type = 'easy' }
    })
  } },
  { name: 'strip coach_notes',         apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).coach_notes }) },
  { name: 'strip derived_set',         apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).derived_set }) },
  { name: 'strip catalogue_id',        apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).catalogue_id }) },
  { name: 'strip labels',              apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).label = '' }) },
  { name: 'strip zone',                apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).zone }) },
  // §107 / INV-PLAN-LR-SEGMENT-RECORDED — strips the RECORD while leaving the
  // prescription's zone marker in place. Deliberately not the same as 'strip
  // zone' above: that removes the marker too, so the session stops claiming to
  // be segmented and the check correctly stays silent. This is the case that
  // matters — a session still saying "Zone 2–3" with nothing behind it.
  { name: 'strip lr_segment_pace',     apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).lr_segment_pace }) },
  // §25 Amendment 1 / INV-PLAN-LR-RACE-SEGMENT-PCT — rewrites the DOSE the note
  // states while leaving the session otherwise valid. This is the live shape the
  // check was written for: a hand-typed "Final 30–50% at MP" note sat above
  // §25's ratified 40% ceiling for months, because a number inside prose is a
  // number nothing reads.
  { name: 'inflate race segment pct',  apply: p => sessionsOf(p).forEach(s => {
      const notes = (s as unknown as Poke).coach_notes
      if (Array.isArray(notes)) {
        (s as unknown as Poke).coach_notes = notes.map((n: unknown) =>
          typeof n === 'string' && /^Final \d+% at /.test(n) ? n.replace(/^Final \d+%/, 'Final 70%') : n)
      }
    }) },
  // §66 Amendment 1 / INV-PLAN-LONG-RUN-HAS-AN-AXIS — removes BOTH anchors from
  // every session. 'strip zone' and the distance mutations each remove one; this
  // is the shape that makes a long run comparable on neither axis, which is the
  // silent state the invariant exists to catch.
  // §39 Amendment 1 / INV-PLAN-NO-RACE-EVE-SESSION — lengthens whatever sits on
  // race eve past §30's shakeout cap. This is the live shape the check was
  // written for: §39's easy run landing the day before a Sunday race at 54 min
  // mean, 72 min worst. Targets the day before the race specifically, because a
  // blanket duration mutation would wake half the registry and prove nothing
  // about THIS rule.
  // §39 Amendment 1 / INV-PLAN-NO-RACE-EVE-SESSION — moves the race to Sunday,
  // then puts a 75-minute run on the Saturday.
  //
  // ⚠️ BOTH halves are required, and the reason is a finding in itself: every
  // harness in this repo generates MONDAY races. `COHORT_PLAN_START` is a Monday
  // and the grid derives race dates as planStart + N weeks, so race day is always
  // Monday and there is NO in-week day before it (`eveIdx === -1`). The cohort
  // grid, the liveness corpus and (until 2026-09-14) the coaching-review cases
  // all shared it. That is precisely why §39's race-eve easy run survived: no
  // harness could build the shape in which it appears.
  //
  // So this mutation constructs the shape the corpus does not have — which is
  // what a mutation is for — rather than being recorded as `corpus` debt.
  { name: 'long session on race eve', apply: p => {
      const order = ['mon','tue','wed','thu','fri','sat','sun']
      for (const w of (p.weeks ?? []) as { sessions?: Record<string, unknown> }[]) {
        const sessions = w.sessions
        if (!sessions) continue
        const entries = Object.entries(sessions)
        const race = entries.find(([, sn]) => (sn as { type?: string } | null)?.type === 'race')
        if (!race) continue
        const donor = entries.find(([, sn]) => {
          const t = (sn as { type?: string } | null)?.type
          return t && t !== 'race' && t !== 'rest'
        })?.[1]
        // Relocate the race to Sunday so a race eve exists at all.
        delete sessions[race[0]]
        sessions['sun'] = race[1]
        sessions['sat'] = {
          ...(donor ? (donor as object) : {}),
          type: 'easy', label: 'Race-week easy', duration_mins: 75,
        }
      }
    } },
  { name: 'strip both anchors',        apply: p => sessionsOf(p).forEach(s => {
      delete (s as unknown as Poke).distance_km
      delete (s as unknown as Poke).duration_mins
    }) },
  { name: 'strip stimulus',            apply: p => sessionsOf(p).forEach(s => { delete (s as unknown as Poke).stimulus }) },
  { name: 'placeholder copy',          apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).coach_notes = ['TODO', 'TBD']; (s as unknown as Poke).label = 'TBD' }) },
  { name: 'all sessions quality',      apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).type = 'quality' }) },
  { name: 'all sessions easy',         apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).type = 'easy' }) },
  { name: 'all sessions race',         apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).type = 'race' }) },
  { name: 'all sessions hills',        apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).label = 'Hill reps'; (s as unknown as Poke).stimulus = 'hills' }) },
  { name: 'long run 90% of week',      apply: p => realWeeks(p).forEach(w => { const l = Object.values(w.sessions ?? {}).find(Boolean) as Session | undefined; if (l) (l as unknown as Poke).distance_km = w.weekly_km * 0.9 }) },
  { name: 'long run +300% wk/wk',      apply: p => realWeeks(p).forEach((w, i) => { const l = Object.values(w.sessions ?? {}).find(Boolean) as Session | undefined; if (l) (l as unknown as Poke).distance_km = 5 * Math.pow(4, Math.min(i, 4)) }) },
  { name: 'every session 0.2km',       apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).distance_km = 0.2; (s as unknown as Poke).duration_mins = 2 }) },
  { name: 'every session 60km',        apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).distance_km = 60; (s as unknown as Poke).duration_mins = 400 }) },
  { name: 'weekly_km = 0',             apply: p => realWeeks(p).forEach(w => { w.weekly_km = 0 }) },
  { name: 'weekly_km x5',              apply: p => realWeeks(p).forEach(w => { w.weekly_km = w.weekly_km * 5 }) },
  { name: 'invert the volume curve',   apply: p => { const ws = realWeeks(p); const v = ws.map(w => w.weekly_km).reverse(); ws.forEach((w, i) => { w.weekly_km = v[i]! }) } },
  { name: 'deload bigger than prior',  apply: p => realWeeks(p).forEach((w, i, a) => { if (w.type === 'deload' && i > 0) w.weekly_km = a[i - 1]!.weekly_km * 1.5 }) },
  { name: 'no deload weeks',           apply: p => realWeeks(p).forEach(w => { if (w.type === 'deload') (w as unknown as Poke).type = undefined }) },
  { name: 'every week is peak',        apply: p => realWeeks(p).forEach(w => { (w as unknown as Poke).phase = 'peak' }) },
  { name: 'every week is base',        apply: p => realWeeks(p).forEach(w => { (w as unknown as Poke).phase = 'base' }) },
  { name: 'every week is taper',       apply: p => realWeeks(p).forEach(w => { (w as unknown as Poke).phase = 'taper' }) },
  { name: 'seven sessions a week',     apply: p => realWeeks(p).forEach(w => { const s = anyOf(p); if (s) for (const d of DAYS) (w.sessions as unknown as Poke)[d] = JSON.parse(JSON.stringify(s)) }) },
  { name: 'empty every week',          apply: p => realWeeks(p).forEach(w => { (w as unknown as Poke).sessions = {} }) },
  { name: 'one catalogue row only',    apply: p => sessionsOf(p).forEach(s => { (s as unknown as Poke).catalogue_id = 'tempo_continuous' }) },
  { name: 'drop volume_profile',       apply: p => { delete (p.meta as unknown as Poke).volume_profile } },
  { name: 'force volume_profile build', apply: p => { (p.meta as unknown as Poke).volume_profile = 'build' } },
  { name: 'drop constraint note',      apply: p => { delete (p.meta as unknown as Poke).volume_constraint_note } },
  { name: 'drop every meta note',      apply: p => { for (const k of Object.keys(p.meta as unknown as Poke)) if (/note|status|annotat/i.test(k)) delete (p.meta as unknown as Poke)[k] } },
  { name: 'drop vdot',                 apply: p => { delete (p.meta as unknown as Poke).vdot } },
  { name: 'vdot raw below anchor',     apply: p => { (p.meta as unknown as Poke).vdot = 1 } },
  { name: 'drop goal pace',            apply: p => { delete (p.meta as unknown as Poke).goal_pace_per_km } },
  { name: 'drop max_hr',               apply: p => { delete (p.meta as unknown as Poke).max_hr } },
  { name: 'truncate to 2 weeks',       apply: p => { p.weeks = p.weeks.slice(0, 2) } },
  { name: 'duplicate week 1 x20',      apply: p => { p.weeks = Array.from({ length: 20 }, () => JSON.parse(JSON.stringify(p.weeks[0]))) } },
  { name: 'drop the race week',        apply: p => { p.weeks = p.weeks.filter(w => w.type !== 'race') } },
  // §47 / INV-PLAN-PEAK-LR-ALTERNATION — added 2026-09-13 with
  // PEAK-LR-STEPBACK-MINUTES-01, and the reason is worth recording because it is
  // the harness working exactly as intended.
  //
  // This invariant used to be woken by 'every session 60km' — but only via a
  // DEFECT. §47 never ran on duration-anchored (beginner) plans, so two
  // consecutive peak weeks both kept their race-pace long run, and inflating
  // every distance pushed both over the threshold. Fixing §47 removed that, and
  // the invariant went from proven to unwakeable: the engine stopped producing
  // the shape the mutation was exploiting.
  //
  // `isPeakLevel` needs BOTH halves — a race-pace label and a distance within
  // PEAK_LR_ALTERNATION_THRESHOLD_PCT of the plan's max — and a step-back drops
  // both. So no single-field mutation above can reach it, and it cannot be
  // composed from them either. This does both in one poke.
  // §24 Amendment 1 / INV-PLAN-LR-FLOOR-NOT-ROUNDING — that rule reads the two
  // numbers the engine PRINTED in `volume_constraint_note`, so no structural
  // mutation can reach it. This writes the artefact sentence the amendment
  // exists to forbid: a stated shortfall smaller than the rounding step.
  { name: 'near-miss LR floor note', apply: p => {
      (p.meta as unknown as Poke).volume_constraint_note =
        'Peak long run 31.5 km is below the 31.7 km floor (75% of race distance) '
        + '— week-on-week long-run cap (§45) prevented reaching the ratio.'
    } },
  { name: 'every long run peak race-pace', apply: p => {
      const lrs = sessionsOf(p).filter(s => isLongRun(s))
      const max = Math.max(...lrs.map(s => (s as unknown as { distance_km?: number }).distance_km ?? 0), 0)
      const km = max > 0 ? max : 30
      lrs.forEach(s => {
        (s as unknown as Poke).label = 'Marathon-pace long run'
        ;(s as unknown as Poke).distance_km = km
      })
    } },
]

export interface LivenessReport {
  woken: Map<string, string>
  unwoken: string[]
  plansProbed: number
}

/** Break `sampleSize` valid plans every way we know, and see what wakes up. */
export function probeLiveness(sampleSize = 64): LivenessReport {
  // 32 -> 64 (GRID-COVERAGE-02 Phase 2). The sample is a FIXED BUDGET shared by
  // three corpora — population shapes, targeted shapes, then bulk — so adding
  // the targeted grid at 32 silently evicted population shapes and DE-PROVED
  // three invariants (DELOAD-PHASE-POSITION, VDOT-RAW-EXCEEDS-ANCHOR,
  // LARGEST-SESSIONS-SPACED). Buying coverage by losing coverage is not a gain;
  // the budget grows to fit both.
  const sample: { input: GeneratorInput; plan: Plan }[] = []
  // COVER SHAPES, never take the grid's head. `cohortGrid()` is ordered, so the
  // first N entries share a distance, a level and a goal — a sample that cannot
  // reach whole families of plan by construction, and those families then read
  // as `corpus` debt ("the harness never builds this shape") when the truth is
  // that the harness never LOOKED at them.
  //
  // Found 2026-09-12: §107's new invariant could not be woken because the
  // segmented 5K/10K peak long run it guards needs a time-targeted, NON-beginner
  // plan, and the head of the grid is none of those. Sampling one input per
  // distinct (distance x level x goal) instead newly PROVED 16 invariants that
  // had been sitting in the baseline as debt. The debt was mostly the sample.
  const seen = new Set<string>()
  const byShape = cohortGrid().filter(i => {
    const k = `${(i as {race_distance_km?: number}).race_distance_km}|${(i as {fitness_level?: string}).fitness_level}|${(i as {goal?: string}).goal}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // GRID-COVERAGE-02 Phase 2 — the TARGETED grid goes in FRONT of the bulk.
  //
  // `cohortGrid` never varies injury_history, user_declared_level,
  // weeks_at_current_volume, foundation_decision or day_budgets, so every
  // mechanism gated on them reads as `corpus` debt ("the harness never builds
  // this shape") when the truth is the harness cannot. One representative input
  // per targeted SHAPE, same by-shape dedup as above so a few hundred near-
  // identical rows cannot crowd out the population sample.
  const targetedSeen = new Set<string>()
  const byTargetedShape = targetedGrid().filter(i => {
    const r = i as unknown as Record<string, unknown>
    const k = `${r.race_distance_km}|${JSON.stringify(r.injury_history)}|${r.user_declared_level}`
      + `|${r.weeks_at_current_volume}|${r.foundation_decision}|${r.day_budgets ? 'budgets' : 'none'}`
    if (targetedSeen.has(k)) return false
    targetedSeen.add(k)
    return true
  })
  // ROUND-ROBIN, not concat. The sample is a fixed budget shared by three
  // corpora, and concatenating lets whichever sits in the middle consume the
  // remainder: appending the targeted grid de-proved three invariants
  // (DELOAD-PHASE-POSITION, VDOT-RAW-EXCEEDS-ANCHOR, LARGEST-SESSIONS-SPACED)
  // that only the BULK reaches, because the budget ran out before the bulk
  // started. Interleaving makes each corpus's share proportional to the budget
  // rather than to its position in the list.
  const corpora = [byShape, byTargetedShape, cohortGrid() as GeneratorInput[]]
  const ordered: GeneratorInput[] = []
  for (let i = 0; ordered.length < sampleSize * 4; i++) {
    let anyLeft = false
    for (const c of corpora) {
      if (i < c.length) { ordered.push(c[i] as GeneratorInput); anyLeft = true }
    }
    if (!anyLeft) break
  }
  for (const input of ordered) {
    if (sample.length >= sampleSize) break
    try {
      sample.push({
        input: input as GeneratorInput,
        plan: generateRulePlan(input as GeneratorInput, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START),
      })
    } catch { /* a refusal is the engine working */ }
  }

  const woken = new Map<string, string>()
  for (const { input, plan } of sample) {
    for (const v of validatePlan(plan, input)) if (!woken.has(v.code)) woken.set(v.code, 'fires on a valid plan')
    for (const m of MUTATIONS) {
      const p = clone(plan)
      try { m.apply(p) } catch { continue }
      let vs
      try { vs = validatePlan(p, input) } catch { continue }   // a throw is not a wake
      for (const v of vs) if (!woken.has(v.code)) woken.set(v.code, m.name)
    }
  }
  const unwoken = (INVARIANT_CODES as readonly string[]).filter(c => !woken.has(c))
  return { woken, unwoken, plansProbed: sample.length }
}
