import { FUELLING_PRACTICE_NOTE, ULTRA_FUELLING_PREFIX } from './fuellingNotes'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { validatePlan, validateMaintenanceBlock, INVARIANT_CODES, type Violation } from '@/lib/plan/invariants'
import { validateBaseBuildBlock } from '@/lib/plan/baseBuildValidate'
import { assessOnRamp, generateBaseBuildPlan } from '@/lib/plan/baseBuildOnRamp'
import { generateMaintenanceBlock } from '@/lib/plan/maintenance'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { isLongRun } from '@/lib/plan/sessionRole'
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import type { GeneratorInput, Plan, Session, Week } from '@/types/plan'

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
  // §80 Am.1 — the shortfall note's CAUSE clause. Same family as the note
  // mutations below: the invariant asserts that what the plan SAYS matches what
  // the plan DID, so waking it means stating a cause the plan contradicts.
  // Here: blame weekly volume while parking the long run against its own
  // ceiling. That is precisely the live state found on 2026-09-18, where 71.0%
  // of real firings sat 2–3 minutes under the cap and blamed volume.
  { name: 'blame weekly volume while the long run sits at its cap', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    const km = typeof meta.race_distance_km === 'number' ? meta.race_distance_km : 42.2
    meta.race_distance_km = km
    const cap = km >= 40 ? 210 : km >= 20 ? 135 : km >= 9 ? 120 : 90
    meta.long_run_shortfall_note =
      'Your longest run tops out at 3h 28. For a race you will likely be moving for around 5h 38, '
      + 'and we would normally want it nearer 3h 57, but your weekly volume is what limits it: the long '
      + 'run is sized as a share of the week, and this week cannot carry more.'
    // Park the longest long run one minute under the ceiling.
    for (const w of realWeeks(p)) {
      for (const sn of Object.values(w.sessions ?? {})) {
        if (sn && isLongRun(sn)) (sn as unknown as Poke).duration_mins = cap - 1
      }
    }
  } },
  { name: 'claim returning allowance, delete its note', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.returning_runner_allowance_active = true
    delete meta.returning_runner_note
  } },
  // §57 Am. / §76 Am. — the uncovered pre-plan runway. Same family, and it needs
  // the same shape: the probe corpus is generated with `plan_start` pinned to
  // `today`, so NO probe plan has a runway at all and the stamp is never set.
  // Waking it means asserting the decision (weeks the plan does not cover) with
  // the telling removed — which is the exact silent state this invariant exists
  // to catch, and the state a 25-week charity runner was in before it shipped.
  { name: 'claim an uncovered runway, delete its note', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.uncovered_runway_weeks =
      GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD + 2
    delete meta.uncovered_runway_note
  } },
  // §97 Am. (LONG-RUNWAY-EARNS-PLAN-01) — INV-PLAN-SURPLUS-IN-PLAN.
  //
  // This invariant got HARDER to wake on 2026-09-16, and the reason is the point:
  // the engine now SPENDS its length headroom on surplus weeks, so every probe
  // plan is either at its cap or bound by the calendar. That is the invariant
  // being silent because it is SATISFIED, which is precisely the state this
  // harness exists to tell apart from a rule that cannot fail at all.
  //
  // The shape it forbids has to be built: a §57 foundation block sitting in front
  // of a plan that still had room to grow. Prepending the block alone is not
  // enough — `extensionExhausted` would still be true via the calendar arm — so
  // `plan_start` is moved back far enough that the calendar is demonstrably NOT
  // the binding constraint. That pair IS the defect: weeks handed to "habit and
  // routine" while the runner's own plan had headroom left.
  // §85 — INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD. This was WOKEN by the corpus
  // until 2026-09-16 and stopped being woken by §97's amendment, which is worth
  // stating plainly: longer plans rotate the quality selector onto different
  // catalogue rows, and `tempo_over_under` simply stopped appearing in the 64
  // probe plans. Nothing about the rule changed. (The same rotation shift took
  // `hill_reps` out of a 13-week 10K; measured, it still reaches 39.1% of plans
  // across a 207-plan grid, so neither row is unreachable — they are just no
  // longer in this corpus.)
  //
  // Keyed on `catalogue_id`, exactly as the invariant is (INV-CLASS — §22 and the
  // AI enricher both rewrite the label, neither can rewrite the row identity), so
  // this asserts the identity onto a paced quality session and lets the pace
  // arithmetic fall outside §85's 0-3% window.
  { name: 'stamp over-under identity on an EASY-paced session', apply: p => {
    // Stamped on an EASY session deliberately. A quality session's pace can
    // legitimately sit inside §85's 0-3%-faster-than-T window, so stamping one
    // woke nothing; an easy pace is always SLOWER than T, which drives the signed
    // delta negative and trips the arm the principle cares about most ("an
    // over-under whose mean is slower than threshold is not an over-under, it is
    // a tempo run with a name").
    for (const s of sessionsOf(p)) {
      const sn = s as unknown as Record<string, unknown>
      if (sn.type === 'easy' && typeof sn.pace_target === 'string') {
        sn.catalogue_id = 'tempo_over_under'
        return
      }
    }
  } },
  { name: 'foundation block in front of a plan below its cap', apply: p => {
    const weeks = p.weeks as unknown as Array<Record<string, unknown>>
    const first = weeks[0]
    if (!first) return
    weeks.unshift({ ...JSON.parse(JSON.stringify(first)), n: 0, phase: 'foundation' })
    const meta = p.meta as unknown as Record<string, unknown>
    if (typeof meta.plan_start === 'string') {
      const d = new Date(`${meta.plan_start}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() - 56)
      meta.plan_start = d.toISOString().slice(0, 10)
    }
  } },
  // §79 — VO2max inside the protected window. The re-entry check was
  // DECORATIVE until 2026-09-15 (it read calendar weeks, which are all-easy by
  // construction, so it could not fail). Re-anchored to QUALITY weeks it can
  // fail, and this is the state that must make it: a plan claiming an active
  // window whose FIRST quality week carries vo2max-category work.
  // §4 — phase structure. No single-field poke reaches it: the check reads the
  // SEQUENCE of week phases, so waking it needs the order itself broken. Sends
  // the plan back to `build` after `peak`, which is both out of order and
  // non-contiguous — the two things §4 forbids.
  // §105 — all marathon race-pace work inside the long run. It fires on 3.7% of
  // the swept population, but the 64-plan probe does not happen to contain that
  // shape, so it needs constructing. This is the real regression it guards: the
  // catalogue losing `mp_blocks` and marathon falling back to every scrap of
  // goal-pace exposure being a segment of the long run (the state
  // CAT-MARATHON-RACE-SPECIFIC-01 measured at 100% before it shipped).
  { name: 'all race-pace work back inside the long run', apply: p => {
    sessionsOf(p).forEach(s => {
      const sn = s as unknown as Poke & { type?: string; stimulus?: string }
      if (sn.stimulus === 'race_pace' && !isLongRun(s)) { sn.stimulus = 'tempo' }
    })
  } },
  { name: 'phases run out of order', apply: p => {
    const ws = p.weeks.filter(w => w.n >= 1)
    if (ws.length < 4) return
    const last = ws[ws.length - 1] as unknown as Poke
    last.phase = 'build'
  } },
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
  // Meta-flag mutations. These three invariants guard META consistency, not
  // session shape, so the session battery above cannot reach them — the same
  // gap that left the compression fields unproven when they were first written.
  { name: 'drop the fresh-return flag', apply: p => {
    delete (p.meta as unknown as Record<string, unknown>).fresh_return_active
  } },
  { name: 'claim a fresh return', apply: p => {
    (p.meta as unknown as Record<string, unknown>).fresh_return_active = true
  } },
  { name: 'call a short plan optimal', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.time_compressed = true
    meta.compression_classification = 'optimal'
    meta.compressed = true
  } },
  { name: 'front a constrained plan as comfortable', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.volume_constrained = true
    meta.compression_classification = 'constrained_by_inputs'
    meta.difficulty_band = 'comfortable'
    meta.compressed = true
  } },
  { name: 'drop the split compression fields', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    delete meta.time_compressed
    delete meta.volume_constrained
  } },
  { name: 'desync the deprecated compressed flag', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.time_compressed = false
    meta.volume_constrained = false
    meta.compressed = true
    meta.compression_classification = 'optimal'
  } },
  { name: 'discount off the staleness ladder', apply: p => {
    (p.meta as unknown as Record<string, unknown>).vdot_discount_applied_pct = 4.5
  } },
  { name: 'claim a gated runner with a foundation block', apply: p => {
    const meta = p.meta as unknown as Record<string, unknown>
    meta.early_quality_onset = true
    // SHORTEN THE PLAN TOO. The invariant exempts a plan that is already at its
    // signature maximum OR calendar-bound (as long as the weeks between its own
    // start and race day allow), because §97 has nothing left to extend into in
    // either case. Corpus plans are calendar-bound, so adding a foundation week
    // on its own leaves the check correctly silent and the rule reads as dead.
    // Dropping two middle weeks puts the plan below both bounds, which is the
    // only state §97 actually objects to.
    const main = p.weeks.filter(w => w.n >= 1)
    if (main.length > 4) {
      const drop = new Set([main[2], main[3]])
      p.weeks = p.weeks.filter(w => !drop.has(w))
    }
    const first = p.weeks[0]
    if (first && first.n >= 1) {
      p.weeks.unshift({ ...first, n: 0, phase: 'foundation', sessions: { ...first.sessions } } as typeof first)
    }
  } },
  { name: 'let the fast-float drift off its ceiling', apply: p => {
    // Synthesised on purpose: the corpus need not already contain an
    // intervals_rolling session for the RULE to be testable, and a rule only
    // provable when the catalogue happens to pick a row is a rule that goes
    // quiet the day it stops being picked.
    const s = sessionsOf(p).find(x => (x as unknown as { derived_set?: unknown }).derived_set)
      ?? sessionsOf(p)[0]
    if (!s) return
    const sn = s as unknown as Poke & { catalogue_id?: string; derived_set?: unknown }
    sn.catalogue_id = 'intervals_rolling'
    sn.derived_set = { version: 2, blocks: [{ repeat: 10, label: 'reps', steps: [
      { role: 'work', modality: 'run', length: '300 m', pace: '3:50–4:20 /km', pace_mode: 'target', advance: 'auto' },
      { role: 'recovery', modality: 'jog', length: '300 m', pace: '5:45–6:45 /km', pace_mode: 'target', advance: 'auto' },
    ] }] }
  } },
  { name: 'stop the peak long run at the floor', apply: p => {
    // The §35 block is gated on `volume_profile !== 'maintenance'`, and most
    // corpus plans that earn a tier above the floor are maintenance — so the
    // shrink alone changed nothing and the rule read as unwakeable. A mutation
    // must set every gate it needs, not only the field it is aimed at.
    ;(p.meta as unknown as Record<string, unknown>).volume_profile = 'build'
    // §35's floor-stopping, made literal: shrink every peak long run to just
    // over §24's floor and keep it well under the minute cap, so the tier check
    // is the only thing that can object.
    for (const w of p.weeks) {
      if (w.phase !== 'peak' || w.type === 'deload') continue
      for (const s of Object.values(w.sessions)) {
        const sn = s as unknown as (Poke & { distance_km?: number; duration_mins?: number }) | undefined
        if (!sn || !isLongRun(s as never)) continue
        if (sn.distance_km != null) sn.distance_km = Math.round(sn.distance_km * 0.5 * 2) / 2
        if (sn.duration_mins != null) sn.duration_mins = Math.min(sn.duration_mins, 45)
      }
    }
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
  // ──────────────────────────────────────────────────────────────────────────
  // LIVENESS-DEBT-01 (2026-09-17) — the `unclassified` column, worked.
  //
  // Twenty invariants sat in the baseline marked "nobody has looked yet". Each
  // mutation below was written against the rule's own gate, not against a guess
  // at what it means, and every one is the SHAPE the rule exists to forbid.
  // ──────────────────────────────────────────────────────────────────────────

  // §2 / INV-PLAN-BOUNCEBACK-BOUNDED — an injury-history runner's post-deload
  // week returning to pre-deload volume. Needs a clean [pre, deload, bounce]
  // triple: no blanket weekly_km mutation makes one, because scaling every week
  // by the same factor leaves the RATIO the rule reads unchanged.
  { name: 'bounceback back to pre-deload', apply: p => {
    for (let i = 2; i < p.weeks.length; i++) {
      const [pre, dl, bounce] = [p.weeks[i - 2], p.weeks[i - 1], p.weeks[i]]
      const isDl = (w: typeof dl) => w.type === 'deload' || w.badge === 'deload'
      if (!isDl(dl) || isDl(bounce) || isDl(pre) || bounce.phase === 'taper') continue
      bounce.weekly_km = pre.weekly_km * 1.2
      return
    }
  } },

  // §90 / INV-PLAN-INJURY-CAP-DELIVERED — the cap is a promise about the
  // TRIMABLE (non-long-run) portion, so the long run has to be held DOWN while
  // the week climbs. 'weekly_km x5' cannot reach it: it scales the long run too,
  // and the non-long ratio it reads comes out unchanged.
  { name: 'ramp the trimable portion', apply: p => {
    realWeeks(p).forEach((w, i) => {
      for (const s of Object.values(w.sessions ?? {})) {
        if (s && isLongRun(s)) (s as unknown as Poke).distance_km = 1
      }
      w.weekly_km = Math.round(20 * Math.pow(1.6, Math.min(i, 6)))
    })
  } },

  // §98 / INV-PLAN-ONSET-YIELD-BOUNDED — the yield ladder walking PAST its own
  // ungated bound. Plan-level meta the session battery cannot reach.
  { name: 'onset yield past its bound', apply: p => {
    (p.meta as unknown as Poke).onset_yield = { rungs: 3, bound: 2, effective: 5 }
  } },

  // CAT-ROW-ELIGIBILITY-01 / INV-PLAN-DERIVED-SET-PACED — a work step authored
  // at a pace anchor whose pace never resolved: a distance with no target. The
  // opposite of 'strip derived_set', which removes the claim along with the gap.
  { name: 'paced work step with no pace', apply: p => {
    for (const s of sessionsOf(p)) {
      const ds = (s as unknown as { derived_set?: { blocks?: Array<{ steps?: Array<Record<string, unknown>> }> } }).derived_set
      if (!ds?.blocks?.length) continue
      for (const b of ds.blocks) for (const st of b.steps ?? []) {
        if (st.role !== 'work') continue
        st.pace_mode = st.pace_mode ?? 'target'
        st.pace = null
      }
      return
    }
  } },

  // §116's three invariants are NOT probed here. They belong to
  // `validateBaseBuildBlock`, not `validatePlan`, and a base-build plan's weeks
  // are skipped by the main validator by design. They get their own probe
  // below, exactly as `validateMaintenanceBlock`'s do (MAINT-LIVENESS-01 — the
  // harness was calling the wrong validator, and that took months to notice).

  // §40b / INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED — neither grid ever sets
  // `terrain`, but the rule reads `plan.meta.terrain`, which IS mutable. The
  // shape is an effort-governed terrain carrying no effort-lead note.
  { name: 'effort-governed terrain, no note', apply: p => {
    const meta = p.meta as unknown as Poke
    meta.terrain = GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS[0]
    delete meta.terrain_effort_note
  } },

  // §40b / INV-PLAN-EFFORT-GOVERNED-NOT-GOAL-PACED — a pace number on a row
  // whose every work step is effort-targeted. `hill_reps` is such a row; the
  // mutation gives it the one thing the runner cannot act on.
  { name: 'goal-pace an effort-governed row', apply: p => {
    for (const s of sessionsOf(p)) {
      const sn = s as unknown as Poke & { type?: string }
      if (sn.type !== 'quality') continue
      sn.catalogue_id = 'hill_reps'
      sn.pace_target = '4:30–4:50 /km'
      return
    }
  } },

  // §82 / INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED — the floor fired and the
  // plan absorbed it silently. Needs BOTH gates: enough protected weeks, and a
  // profile that does not declare the suppression.
  { name: 'floor protection, undeclared', apply: p => {
    (p.meta as unknown as Poke).volume_profile = 'build'
    delete (p.meta as unknown as Poke).volume_constraint_note
    let hit = 0
    for (const w of realWeeks(p)) {
      const s = Object.values(w.sessions ?? {}).find(Boolean)
      if (!s) continue
      ;(s as unknown as Poke).floor_protected = true
      if (++hit >= GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS + 1) return
    }
  } },

  // §5 / INV-PLAN-VO2MAX-ONSET — VO2max introduced too late to adapt to it.
  // BOTH halves are needed: the early weeks must be CLEARED of vo2max (else
  // `vo2Weeks[0]` is early and the gap is legal) and the last build week loaded.
  { name: 'vo2max on the taper doorstep', apply: p => {
    const taperN = p.weeks.find(w => w.phase === 'taper')?.n
    if (taperN == null) return
    for (const s of sessionsOf(p)) {
      const sn = s as unknown as Poke & { stimulus?: string }
      if (sn.stimulus === 'vo2max') sn.stimulus = 'tempo'
      if (sn.catalogue_id === 'intervals_classic') sn.catalogue_id = 'tempo_continuous'
    }
    const target = p.weeks.filter(w => w.n >= 1 && w.n < taperN).pop()
    if (!target) return
    const q = Object.values(target.sessions ?? {}).find(s => s && (s as { type?: string }).type === 'quality')
      ?? Object.values(target.sessions ?? {}).find(Boolean)
    if (!q) return
    const sn = q as unknown as Poke
    sn.type = 'quality'; sn.stimulus = 'vo2max'
    sn.catalogue_id = 'intervals_classic'; sn.label = 'Classic VO2max'
  } },

  // §26 / INV-PLAN-RACE-WEEK-SHARPENING — race week is for sharpening, not
  // training. 'all sessions quality' leaves the LABEL alone and the rule reads
  // the label; 'all sessions hills' leaves the TYPE alone. It needs both.
  { name: 'tempo work in race week', apply: p => {
    for (const w of p.weeks) {
      const entries = Object.entries(w.sessions ?? {})
      if (!entries.some(([, s]) => (s as { type?: string } | null)?.type === 'race')) continue
      const donor = entries.find(([, s]) => {
        const t = (s as { type?: string } | null)?.type
        return t && t !== 'race' && t !== 'rest'
      })?.[1]
      if (!donor) continue
      const sn = donor as unknown as Poke
      sn.type = 'quality'; sn.label = 'Threshold tempo'
      return
    }
  } },

  // §44 / INV-PLAN-DIFFICULTY-ANNOTATED — 'drop every meta note' matches
  // /note|status|annotat/ and `difficulty_band` matches none of them, so the
  // one field this rule reads survived every existing meta mutation.
  { name: 'drop difficulty_band', apply: p => {
    delete (p.meta as unknown as Poke).difficulty_band
  } },

  // §79 Am. 5 / INV-PLAN-REENTRY-NOTE-MATCHES-CAUSE — the note tells a runner
  // who is NOT returning that they are "coming back".
  //
  // ⚠️ THE MUTATION WRITES BOTH FIELDS ON PURPOSE. The generic 'drop every meta
  // note' mutation deletes `intensity_reentry_omission_note`, which makes the
  // rule go SILENT rather than fire — the rule is gated on the note existing.
  // And a corpus plan that already carries the note is an early-onset plan,
  // which now carries the CORRECT copy, so nothing in the corpus can be nudged
  // into the defect either. Reconstructing the live defect exactly is the only
  // way to prove the rule can wake: this is the string that shipped.
  { name: 'reentry note says "coming back" to a non-returner', apply: p => {
    const meta = p.meta as unknown as Poke
    meta.intensity_reentry_cause = 'early_onset'
    meta.intensity_reentry_omission_note =
      'No interval or hill sessions this block. You are coming back, so the quality work leads with tempo and threshold while your legs re-adapt.'
  } },

  // …and the other arm: the note present with no cause stamped at all, which is
  // what a future caller writing the note by a second path would produce.
  // §24e Am. / INV-PLAN-LONG-SESSION-FUELLING-NOTE — strip the fuelling cue
  // from the peak long run. The generic 'drop every meta note' mutation cannot
  // reach it: this note lives on the SESSION, not in meta.
  { name: 'strip the fuelling cue from the peak long run', apply: p => {
    for (const w of p.weeks) {
      if ((w as unknown as { phase?: string }).phase !== 'peak') continue
      for (const sn of Object.values(w.sessions ?? {})) {
        const s2 = sn as unknown as { role?: string; coach_notes?: string[] }
        if (!s2 || s2.role !== 'long_run' || !s2.coach_notes) continue
        s2.coach_notes = s2.coach_notes.filter(
          n => !(n === FUELLING_PRACTICE_NOTE || n.startsWith(ULTRA_FUELLING_PREFIX)),
        ) as string[]
      }
    }
  } },

  { name: 'reentry note with no stamped cause', apply: p => {
    const meta = p.meta as unknown as Poke
    delete meta.intensity_reentry_cause
    meta.intensity_reentry_omission_note =
      'No interval or hill sessions this block. Your base is solid enough that quality starts earlier than standard.'
  } },

  // §83 / INV-PLAN-INTENSITY-ORDERING — threshold work prescribed FASTER than
  // VO2max work. Needs a matched pair in two different zone bands, which the
  // engine never produces, and the escape hatch closed (a surfaced goal-beyond-
  // fitness plan is allowed to invert).
  { name: 'threshold faster than vo2max', apply: p => {
    (p.meta as unknown as Poke).goal_beyond_measured_fitness = false
    const qs = sessionsOf(p).filter(s => (s as unknown as { type?: string }).type === 'quality')
    if (qs.length < 2) return
    const [a, b] = qs as unknown as Poke[]
    a.zone = 'Zone 3'; a.pace_target = '3:00–3:10 /km'
    b.zone = 'Zone 4'; b.pace_target = '5:00–5:10 /km'
  } },

  // §46 / INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES — a marathon/ultra peak below
  // the volume floor. 'weekly_km = 0' cannot reach it alone: the rule exempts
  // maintenance, which is what a zeroed plan classifies as.
  { name: 'peak below the long-race floor', apply: p => {
    (p.meta as unknown as Poke).volume_profile = 'build'
    for (const w of p.weeks) if (w.phase === 'peak') w.weekly_km = 1
  } },

  // §50 / INV-PLAN-HR-ASSUMPTIONS-SURFACED — the plan stops saying which of the
  // six fallback methods produced the zones the runner is training in.
  { name: 'drop hr_zone_method', apply: p => {
    delete (p.meta as unknown as Poke).hr_zone_method
  } },

  // §50 / INV-PLAN-MAX-HR-NOT-BELOW-ESTIMATE-FLOOR — a derived max BELOW the
  // age estimate with nothing but an estimate behind it. Every zone in the plan
  // is then anchored to a ceiling the runner demonstrably clears.
  { name: 'derived max below the estimate', apply: p => {
    const meta = p.meta as unknown as Poke
    meta.hr_estimated_max = 180
    meta.hr_derived_max = 150
    meta.hr_max_source = 'estimated'
  } },

  // §79 / INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE — the load-bearing half of the
  // two-axis rule: declaring yourself experienced buys INTENSITY, never
  // TONNAGE. The shape is a declared lift that moved the peak target.
  { name: 'declared level buys tonnage', apply: p => {
    const meta = p.meta as unknown as Poke
    meta.fitness_level_declared = 'experienced'
    meta.fitness_level = 'beginner'
    meta.peak_km_target = 500
  } },

  // §24c / INV-PLAN-BUILD-LR-SEGMENT-CAP and §24d / INV-PLAN-FINISH-GOAL-LR-CAP
  // — a paced segment inside a long run that should not carry one (a 5K/10K
  // build week; any finish-goal plan). 'strip lr_segment_pace' removes the
  // field; nothing in the battery ever ADDED it, so both rules read as dead.
  { name: 'segment every long run', apply: p => {
    sessionsOf(p).forEach(s => {
      if (isLongRun(s)) (s as unknown as Poke).lr_segment_pace = '5:10–5:30 /km'
    })
  } },

  // §96 / INV-PLAN-OVERDO-BRAKE — the readiness gate firing for a runner who
  // declared they will push too hard if allowed. The existing 'claim a gated
  // runner with a foundation block' mutation also sets this flag, but it drops
  // weeks and prepends a block at the same time, so it can throw before the
  // check is reached. This asserts the flag and nothing else.
  { name: 'claim early quality onset', apply: p => {
    (p.meta as unknown as Poke).early_quality_onset = true
  } },

  // §21 / INV-PLAN-INJURY-NO-HILLS — hill work for a runner whose injury
  // history forbids it. Sets the STRUCTURAL half (a catalogue row whose steps
  // are uphill) as well as the label, because the rule accepts either and a
  // label-only mutation proves only half the gate.
  { name: 'hill reps for a hill-restricted runner', apply: p => {
    sessionsOf(p).forEach(s => {
      const sn = s as unknown as Poke & { type?: string }
      if (sn.type === 'rest') return
      sn.catalogue_id = 'hill_reps'
      sn.label = 'Hill reps — 90s'
    })
  } },
]

export interface LivenessReport {
  woken: Map<string, string>
  unwoken: string[]
  plansProbed: number
}

/** Break `sampleSize` valid plans every way we know, and see what wakes up. */
/**
 * MAINT-LIVENESS-01 — the deliberate-breakage battery for maintenance blocks.
 *
 * A maintenance block is meant to be quiet, so silence on a healthy one cannot
 * tell a working rule from a dead one — the same reason the plan battery exists.
 * Each mutation targets one thing `validateMaintenanceBlock` claims to check.
 */
const MAINTENANCE_MUTATIONS: { name: string; apply: (w: Week[]) => void }[] = [
  { name: 'maint: blow the volume ceiling', apply: ws => { for (const w of ws) w.weekly_km = (w.weekly_km ?? 0) * 4 + 100 } },
  { name: 'maint: add a hard quality session', apply: ws => {
      const w = ws.find(x => Object.keys(x.sessions ?? {}).length > 0) ?? ws[0]
      if (w) (w.sessions as Record<string, unknown>).wed =
        { type: 'intervals', label: 'Intervals — Zone 4', distance_km: 10, duration_mins: 50 }
    } },
  { name: 'maint: fill every day (no rest)', apply: ws => {
      for (const w of ws) w.sessions = Object.fromEntries(
        ['mon','tue','wed','thu','fri','sat','sun'].map(d =>
          [d, { type: 'easy', label: 'Easy run — Zone 2', distance_km: 5, duration_mins: 30 }]),
      ) as Week['sessions']
    } },
  // ⚠️ EACH OF THESE READS A SPECIFIC FIELD, AND THE FIRST CUT MISSED FOUR OF
  // THEM BY GUESSING. `NO-RACE-SPECIFIC` reads `session.category`, not the
  // label; `INJURY-EASY-ONLY` reads /strides/ in the label; `QUALITY-CAP`
  // counts quality sessions in a PHASE-2 week against a per-week cap, so one
  // is not enough; `REENGAGEMENT-WINDOW` reads the `reengagement` flag against
  // the week's position. Mutations have to name the field the rule names.
  { name: 'maint: prescribe race-specific work', apply: ws => {
      for (const w of ws) (w.sessions as Record<string, unknown>).sat =
        { type: 'quality', category: 'race_specific', label: 'Race-pace progression', distance_km: 20, duration_mins: 110 }
    } },
  { name: 'maint: exceed the phase-2 quality cap', apply: ws => {
      for (const w of ws) {
        if (w.phase !== 'maintenance_base') continue
        w.sessions = {
          mon: { type: 'intervals', label: 'Intervals — Zone 4', distance_km: 8, duration_mins: 45 },
          wed: { type: 'tempo',     label: 'Tempo — Zone 3',     distance_km: 9, duration_mins: 45 },
          fri: { type: 'quality',   label: 'Cruise intervals',   distance_km: 9, duration_mins: 45 },
          sun: { type: 'easy',      label: 'Easy run — Zone 2',  distance_km: 6, duration_mins: 36 },
        } as Week['sessions']
      }
    } },
  { name: 'maint: give an injured runner strides', apply: ws => {
      for (const w of ws) (w.sessions as Record<string, unknown>).thu =
        { type: 'easy', label: 'Easy run + strides — Zone 2', distance_km: 6, duration_mins: 36 }
    } },
  { name: 'maint: invert the reengagement flags', apply: ws => {
      for (const w of ws) (w as unknown as Record<string, unknown>).reengagement = !w.reengagement
    } },
  { name: 'maint: flag reengagement during restoration', apply: ws => {
      for (const w of ws) if (w.phase === 'maintenance_restoration')
        (w as unknown as Record<string, unknown>).reengagement = true
    } },
  { name: 'maint: strip every session', apply: ws => { for (const w of ws) w.sessions = {} as Week['sessions'] } },
]

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
  //
  // Extended 2026-09-15 with ONE BIT — does the runner's longest recent run
  // already clear §24's floor? §35's tier lift is gated on exactly that, and the
  // key above does not contain it, so whichever HM/time_target row happened to
  // be first represented the whole family and it was a low-mileage one.
  // INV-PLAN-PEAK-LR-EARNED-TIER then read as unwakeable while a mutation woke
  // it on the first qualifying plan tried by hand. Same failure as §107's in
  // 2026-09-12, one field over: THE SHAPE KEY MUST CONTAIN THE FIELD THE RULE IS
  // GATED ON, or the sample cannot reach the rule and the debt register records
  // the sampling as if it were the engine.
  const byShape = cohortGrid().filter(i => {
    const r = i as unknown as { race_distance_km?: number; longest_recent_run_km?: number }
    const k = `${(i as {race_distance_km?: number}).race_distance_km}|${(i as {fitness_level?: string}).fitness_level}|${(i as {goal?: string}).goal}`
      + `|${(r.longest_recent_run_km ?? 0) >= (r.race_distance_km ?? 0) * 0.85 ? 'deep' : 'shallow'}`
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
    // `hard_session_relationship` is IN THE KEY, and leaving it out is not a
    // detail: the key is what the dedup calls a distinct shape, so a field the
    // key omits collapses back to whichever value happens to come first.
    // Measured 2026-09-17 — adding the axis took the grid 1,536 -> 6,144 and the
    // dedup put it straight back to 1,536, all 'neutral', leaving
    // INV-PLAN-OVERDO-BRAKE exactly as unwakeable as before the widening. Same
    // failure as §107's in 2026-09-12 and PEAK-LR-EARNED-TIER's in 2026-09-15.
    const k = `${r.race_distance_km}|${JSON.stringify(r.injury_history)}|${r.user_declared_level}`
      + `|${r.weeks_at_current_volume}|${r.foundation_decision}|${r.day_budgets ? 'budgets' : 'none'}`
      + `|${r.hard_session_relationship}`
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
  // SPREAD EACH CORPUS, because a round-robin CONSUMES HEADS (LIVENESS-DEBT-01,
  // 2026-09-17). This is the third time the sample has been the bug rather than
  // the rules, and the first two fixes did not reach it:
  //
  //   · the by-shape dedup fixed WHICH SHAPES EXIST in the list (2026-09-12),
  //   · the shape key fixed WHICH FIELD distinguishes them (2026-09-15),
  //   · neither changed the fact that only the first ~21 entries of each corpus
  //     are ever reached, because the budget is 64 across three corpora.
  //
  // Measured before this change: **zero of the 64 probed plans had an injury
  // history and zero were marathons.** `targetedGrid` exists precisely to reach
  // injury-gated mechanisms, and its dedup key names every axis it varies — so
  // the key is distinct for all 1,536 rows, the filter removes nothing, and the
  // head of the list is the base case with each axis at its FIRST value. Three
  // injury-gated invariants (BOUNCEBACK-BOUNDED, INJURY-CAP-DELIVERED,
  // INJURY-NO-HILLS) and the marathon volume floor read as unwakeable on a
  // corpus that could not contain their trigger.
  //
  // A coprime stride makes every PREFIX low-discrepancy, so the budget lands
  // across each corpus instead of on its first rows, and the walk still visits
  // every index exactly once (deterministic, no sampling).
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
  const spread = <T,>(c: readonly T[]): T[] => {
    const n = c.length
    if (n < 3) return [...c]
    let step = Math.max(1, Math.round(n * 0.6180339887))
    while (step > 1 && gcd(step, n) !== 1) step--
    return Array.from({ length: n }, (_, k) => c[(k * step) % n] as T)
  }
  const corpora = [spread(byShape), spread(byTargetedShape), spread(cohortGrid() as GeneratorInput[])]
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
  // ── MAINT-LIVENESS-01 — the maintenance block gets probed too ──────────────
  //
  // 🔴 THE BASELINE'S STATED REASON WAS WRONG, AND IT HID THE ACTUAL CAUSE.
  // Eight `INV-MAINT-*` codes sat as `corpus` debt — "the harness never builds
  // this plan SHAPE" — for months. The truth is narrower and worse: these
  // invariants are not checked by `validatePlan` at all. They are checked by
  // `validateMaintenanceBlock`, and this harness only ever called `validatePlan`.
  // **The harness was calling the wrong validator**, so no corpus, however wide,
  // could ever have woken them. §67 and §75 rest on two of these.
  //
  // Same class as the three previous liveness-debt findings (by-shape dedup,
  // shape key, round-robin heads): every one turned out to be the SAMPLE rather
  // than the rules. This is the fourth, and the first where the sample was not
  // the problem — the CALL was.
  {
    const raceWeek: Week = {
      n: 12, date: '2026-07-07', label: 'Race week', theme: 'Race day.',
      type: 'race', phase: 'taper', weekly_km: 30, long_run_hrs: null, sessions: {},
    } as Week
    // A spread of the axes the maintenance invariants actually gate on: base
    // volume, cadence, injury, and race distance (which sets the blackout).
    const maintCases: { baseKm: number; days: number; injured: boolean; distKm: number }[] = [
      { baseKm: 40, days: 4, injured: false, distKm: 42.2 },
      { baseKm: 25, days: 3, injured: true,  distKm: 21.1 },
      { baseKm: 60, days: 5, injured: false, distKm: 42.2 },
      { baseKm: 18, days: 2, injured: true,  distKm: 10 },
    ]
    for (const c of maintCases) {
      let weeks: Week[]
      try {
        weeks = generateMaintenanceBlock({
          raceResult: { finish_time: '3:45:00', distance_km: c.distKm, date: '2026-07-12', rpe: 7, outcome: 'on_target' },
          lastRaceWeek: raceWeek,
          baseWeeklyKm: c.baseKm,
          raceDistanceKm: c.distKm,
          daysAvailable: c.days,
          ...(c.injured ? { injuryHistory: ['Knee'] } : {}),
        })
      } catch { continue }
      const check = (ws: Week[], why: string) => {
        let vs: Violation[]
        try { vs = validateMaintenanceBlock(ws, c.baseKm, c.injured, c.days) } catch { return }
        for (const v of vs) if (!woken.has(v.code)) woken.set(v.code, why)
      }
      check(weeks, 'fires on a valid maintenance block')
      // The same deliberate-breakage discipline the plan mutations use: a rule
      // that nothing can wake is UNPROVEN, and silence on a healthy block
      // cannot tell a working rule from a dead one.
      for (const m of MAINTENANCE_MUTATIONS) {
        const w = JSON.parse(JSON.stringify(weeks)) as Week[]
        try { m.apply(w) } catch { continue }
        check(w, m.name)
      }
    }
  }

  // ── §116 base-build on-ramp ────────────────────────────────────────────────
  //
  // Its own validator, so its own probe. The corpus cannot contain one of these
  // plans (the flag is off and the shape only exists behind it), so the block is
  // constructed here and then deliberately broken — one mutation per amendment
  // the validator claims to enforce.
  {
    const input = {
      race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
      goal: 'finish', fitness_level: 'beginner', current_weekly_km: 8,
      longest_recent_run_km: 3, age: 32, injuries: [], recent_quality_training: 'none',
      training_age: '<6mo',
    } as unknown as GeneratorInput
    const a = assessOnRamp(input, 18, 29)
    if (a.outcome === 'offered') {
      const base = generateBaseBuildPlan(input, '2026-10-05', a).weeks
      const checkBB = (ws: Week[], why: string) => {
        for (const v of validateBaseBuildBlock(ws, a.startKm)) {
          if (!woken.has(v.code)) woken.set(v.code, why)
        }
      }
      const BB_MUTATIONS: { name: string; apply: (w: Week[]) => void }[] = [
        { name: 'bb: flatten the ramp', apply: ws => {
            for (const w of ws) (w as unknown as Poke).weekly_km = ws[0].weekly_km
          } },
        { name: 'bb: end on a deload', apply: ws => {
            (ws[ws.length - 1] as unknown as Poke).type = 'deload'
          } },
        { name: 'bb: prescribe a tempo', apply: ws => {
            (ws[1].sessions as Record<string, unknown>).thu =
              { type: 'tempo', label: 'Tempo', distance_km: 6, duration_mins: 30 }
          } },
        { name: 'bb: double a single run', apply: ws => {
            for (const s of Object.values(ws[2].sessions)) {
              if (s && s.type !== 'rest') { (s as unknown as Poke).distance_km = 40; break }
            }
          } },
      ]
      checkBB(base, 'fires on a valid base-build block')
      for (const m of BB_MUTATIONS) {
        const w = JSON.parse(JSON.stringify(base)) as Week[]
        try { m.apply(w) } catch { continue }
        checkBB(w, m.name)
      }
    }
  }

  const unwoken = (INVARIANT_CODES as readonly string[]).filter(c => !woken.has(c))
  return { woken, unwoken, plansProbed: sample.length }
}
