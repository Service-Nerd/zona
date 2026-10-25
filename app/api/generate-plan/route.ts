import { readPlanJson } from '@/lib/planRead'
import { NextRequest, NextResponse } from 'next/server'
import type { GeneratorInput, Plan } from '@/types/plan'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createUserScopedClient } from '@/lib/supabase/userScopedClient'
import { guardAiRequest } from '@/lib/ai/guardAiRequest'
import { getUserTier } from '@/lib/trial'
// ── The engine, behind one import (ENGINE-ENTRY-01, 2026-10-15) ──────────────
//
// 🔴 THIS FILE USED TO IMPORT EIGHTEEN ENGINE MODULES AND SEQUENCE THEM ITSELF,
// which meant the ROUTE was the orchestrator and the engine was a bag of parts:
// extract the engine today and all eighteen become public API surface. The
// synchronous path now lives behind `runEngine` — see `lib/plan/engine.ts` for
// what it takes, what it deliberately does NOT take, and why.
//
// ⚠️ IT IS 18 → 7, NOT 18 → 1, AND THE ITEM'S OWN CONSTRAINT IS WHY. The five
// enrichment/AI modules below are the CALLER's by doctrine (ADR-006, and
// `docs/contracts/engine.md` § What this contract does NOT cover); `freeIntro`
// calls Anthropic. `canGenerateDistance` is a COMMERCIAL gate at the auth
// boundary (ADR-003) — it answers 403, not 422, and a second consumer of a hosted
// engine would not apply Zonna's price list. Collapsing those would drag the AI
// layer and persistence inside the engine, which `ENGINE-PURITY-GATE-01` forbids.
import { runEngine, validatePlan, evaluateCheckpoint, isBaseBuildPlan, type EngineOutcome } from '@/lib/plan/engine'
import { canGenerateDistance } from '@/lib/plan/canUseFeature'
import { enrich, type EnrichOutcome } from '@/lib/plan/enrich'
import { errorBaseline, violationsIntroducedBy, statusForReason } from '@/lib/plan/enrichAttribution'
import {
  attributableWeeks, revertWeeksToRuleCopy,
  attributableSessions, revertSessionsToRuleCopy,
} from '@/lib/plan/enrichPartialRevert'
import { shouldServerPersist } from '@/lib/plan/enrichServerSave'
import { generateFreeIntro } from '@/lib/plan/freeIntro'
import { waitUntil } from '@vercel/functions'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { fetchWeeklyLoad } from '@/lib/coaching/weeklyActualLoad'
import { getUserDisplayPrefs } from '@/lib/userPrefs'

// ─── Guard rails ──────────────────────────────────────────────────────────────
//
// CoachingPrinciples §44 owns prep-time refusal (block / warn) for race
// distance vs available weeks. The legacy hardcoded rules below were superseded
// by validatePrepTime in 2026-04-28/H-01 and removed. This wrapper now only
// guards inputs the constitution doesn't yet cover.

function validate(input: GeneratorInput): string | null {
  if (input.days_available < 2) return 'At least 2 training days per week are required.'

  // MARATHON-VOLUME-GATE-01 (§111, Coaching Board 2026-09-18) — the marathon
  // base-volume floor used to live here as `current_weekly_km < 20`. It was
  // ungoverned, non-monotonic and refused the charity cohort at the door. It is
  // now the governed §111 base-build ceiling, thrown from generateRulePlan as
  // BaseVolumeError (caught below) — expressed on the delivered peak vs the
  // runner's real base, with alternatives, not a bare string here.
  //
  // The longest_recent_run_km < 5 gate that was also here is now §113
  // (LONGEST-RUN-GATE-01, Coaching Board 2026-09-18): governed, reading the
  // floor from MIN_SESSION_DISTANCE_KM.long rather than a second copy of `5`,
  // and thrown from generateRulePlan as LongRunReadinessError with the
  // alternatives §44's own text requires. Nothing hardcoded remains here.

  return null
}

/**
 * The runner's own first name, read from their profile row.
 *
 * WHY THE SERVER OWNS THIS RATHER THAN THE WIZARD. `athlete_name` is the one
 * GeneratorInput field that is not a coaching input: it changes nothing the
 * engine prescribes. Its only consumers are the enrichment prompt
 * (`enrich.ts`), the free-plan intro (`freeIntro.ts`) and the `plan.meta.athlete`
 * stamp. Nothing in the app ever set it, so every plan ever generated addressed
 * the runner as "Athlete" while their name sat in `user_settings` the whole
 * time. Resolving it at the auth boundary (ADR-003) means the server decides who
 * the runner is, it cannot be spoofed by the client, and an existing account
 * gets its name on the next plan with no new wizard step.
 *
 * Never throws and never blocks generation: no token, no row, or a failed read
 * returns null, which is precisely the behaviour every plan had before.
 */
async function resolveAthleteFirstName(req: NextRequest, userId: string): Promise<string | null> {
  try {
    const supabase = createUserScopedClient(req)
    if (!supabase) return null
    const { data } = await supabase
      .from('user_settings')
      .select('first_name')
      .eq('id', userId)
      .maybeSingle()
    return (data?.first_name ?? '').trim() || null
  } catch {
    return null
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // GENERATE-500-NO-TRACE-01 (2026-10-16) — what the outer catch reports. A crash used
  // to be `console.error` + 500 and nothing else, so a runner whose generation FAILED
  // looked exactly like one who never tried (measured on the Make-A-Wish funnel: 5 of
  // 19 without a plan, and no way to say which). `stage` names the last step reached.
  let stage: 'auth' | 'tier' | 'guard' | 'input' | 'engine' | 'respond' = 'auth'
  let userId: string | null = null
  let tierSeen: string | null = null
  let raceKm: number | null = null
  try {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
    stage = 'tier'

    const tier = await getUserTier(user.id)
    tierSeen = tier
    stage = 'guard'
    // UNITS-PROSE-01 — ONE read of the runner's units for the whole route.
    // ADR-015's amendment makes the AI layer a display surface, so the three
    // AI calls below (§118 offer copy, free intro, enrichment) must all be told
    // the same unit. Before this the §118 block read prefs on its own and the
    // two enrichers were never told at all. A failed read falls back to km
    // rather than blocking generation.
    const displayUnits = await (async () => {
      const c = createUserScopedClient(req)
      return c ? (await getUserDisplayPrefs(c, user.id)).units : ('km' as const)
    })()
    const guard = await guardAiRequest(req, user.id, 'generate-plan')
    if (!guard.ok) return guard.response
    // Name comes from the profile, not the request body — see
    // resolveAthleteFirstName. Anything the client sent is only a fallback.
    const athleteFirstName = await resolveAthleteFirstName(req, user.id)
    let input: GeneratorInput = athleteFirstName
      ? { ...guard.body, athlete_name: athleteFirstName }
      : guard.body
    // ENGINE-ENTRY-01 — `planStart` (next Monday) and `today` are derived INSIDE
    // `runEngine` now. They were read here and threaded through five call sites,
    // which is the sequencing that made the route the orchestrator.

    // P-15 (2026-09-20) — the runner ACCEPTING the §118 base-build offer.
    //
    // Read off the raw body rather than added to `GeneratorInput`, deliberately:
    // it is a client intent about which plan to build, not an attribute of the
    // runner, and `lib/plan/*` is pure functions of the runner plus a tier
    // (ADR-003). Putting it on GeneratorInput would leak a UI decision into the
    // engine's input type and into every grid that sweeps those fields.
    const acceptBaseBuild = (guard.body as { accept_base_build?: unknown }).accept_base_build === true

    // NO-RUNNER-TURNED-AWAY-01 (§116 Am. 9, Q2) — THE CHECKPOINT, computed HERE and never trusted from the client.
    //
    // The base-build handover used to send the block's PLANNED end volume as `current_weekly_km`, which is the
    // credit-in-advance the September veto forbade (measured 2026-10-24: the two live base-build runners had recorded
    // 3.1 of a planned 21 km, and 0 of 16.5). So the route reads the runner's stored base-build plan and what they
    // ACTUALLY ran, and that figure replaces whatever the body carried. §111 then decides, in its one place.
    //
    // ⚠️ A failed read is a 500, never "ran nothing": `fetchWeeklyLoad` throws on a query error by design.
    // C1 — `volume_observed` is the server's to set. A client that sent it would switch §29 off for a declared
    // volume, so it is removed from every request before anything reads the input.
    // The stored plan, read at most once. 🔴 A failed read THROWS (a 500), never "no plan": `readPlanJson` returns its
    // error for the caller to decide, and treating it as null told a staged runner they had no plan (code review).
    let storedRead: { plan: Plan | null } | null = null
    const readStored = async (): Promise<Plan | null> => {
      if (storedRead) return storedRead.plan
      const { createClient } = await import('@supabase/supabase-js')
      const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const r = await readPlanJson(svc, user.id)
      if (r.error) throw new Error(`stored plan read failed: ${r.error}`)
      storedRead = { plan: r.plan as Plan | null }
      return storedRead.plan
    }
    const isCheckpoint = (guard.body as { checkpoint?: unknown }).checkpoint === true
    if ('volume_observed' in input) {
      // Kept ONLY for a faithful replay of the runner's own stored plan: the checkpoint measured it, the plan stores it,
      // and a Modify that leaves the volume alone re-sends it (code review: stripping it let §29 re-discount observed
      // volume). Server-verified against the stored input; a client cannot mint it.
      const stored = isCheckpoint ? null : await readStored()
      const gi = (stored?.meta as unknown as { generator_input?: GeneratorInput } | undefined)?.generator_input
      const faithful = !!gi?.volume_observed && gi.current_weekly_km === input.current_weekly_km
      if (!faithful) {
        const { volume_observed: _drop, ...rest } = input
        input = rest as GeneratorInput
      }
    }
    // `extend` returns more base building, already built; it is answered after the paywall, like any other plan.
    let checkpointPlan: Plan | null = null
    if (isCheckpoint) {
      const { createClient } = await import('@supabase/supabase-js')
      const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      const stored = await readStored()
      const loads = stored && isBaseBuildPlan(stored) ? await fetchWeeklyLoad(svc, user.id, stored) : null
      // The consent screen's re-send (Design Board amendment 7). Anything else is no choice at all, so an unknown value
      // can only ever produce the screen again, never a plan.
      const rawChoice = (guard.body as { checkpoint_choice?: unknown }).checkpoint_choice
      const choice = rawChoice === 'extend' || rawChoice === 'run_walk' || rawChoice === 'half' ? rawChoice : undefined
      const cp = evaluateCheckpoint(input, stored, loads, displayUnits, undefined, choice)
      if (cp.telemetry) await recordOpsEvent(cp.telemetry.event, cp.telemetry.detail, user.id)
      if (!cp.ok) return NextResponse.json(cp.body, { status: cp.status })
      if ('plan' in cp) checkpointPlan = cp.plan
      else input = cp.input
    }
    stage = 'input'
    raceKm = typeof input.race_distance_km === 'number' ? input.race_distance_km : null

    const guardError = validate(input)
    if (guardError) {
      // GENERATE-500-NO-TRACE-01 — a refused input is "tried and failed", so it is recorded
      // under the same kind as the engine's §55 refusals.
      await recordOpsEvent('plan_input_refused', { field: 'days_available', race_distance_km: raceKm }, user.id)
      return NextResponse.json({ error: guardError }, { status: 422 })
    }

    // ── The distance paywall, at the auth boundary (TIER-ENFORCE-01) ───────
    //
    // Marathon / 50K / 100K are PAID (feature-registry "Distance tier gating";
    // data in PLAN_SIGNATURES.free_tier_available). Until now this boundary was
    // enforced ONLY by `GeneratePlanScreen` rendering a locked tile, so the most
    // commercially significant route in the product trusted the client — while
    // ADR-003 names the API route as the auth boundary and ten other routes
    // honour it.
    //
    // SAME PREDICATE AS THE WIZARD, deliberately: `canGenerateDistance` is the
    // single owner, so the lock a runner sees and the 403 the server returns
    // cannot disagree. A legitimate client therefore never reaches this branch.
    //
    // A TRIAL OR COMPED RUNNER IS NEVER BLOCKED. `getUserTier` resolves admin,
    // subscription and charity grant to `paid` before it ever returns `free`
    // (resolveTier, §single owner), so a Make-A-Wish runner meets no gate here.
    // That mattered enough to pin as a test: `distancePaywall.test.ts`.
    if (!canGenerateDistance(input.race_distance_km, tier)) {
      await recordOpsEvent('plan_distance_gate_blocked',
        { tier, race_distance_km: input.race_distance_km }, user.id)
      return NextResponse.json({
        error: 'That distance needs a subscription.',
        reason: 'paid_distance',
        race_distance_km: input.race_distance_km,
      }, { status: 403 })
    }

    if (checkpointPlan) return NextResponse.json({ plan: checkpointPlan })

    // ── THE ENGINE, IN ONE CALL (ENGINE-ENTRY-01) ─────────────────────────
    //
    // Everything from inputs to a composed, validated plan is the engine's:
    // `planStart`, the §118 accept-base-build branch, `generateRulePlan`, the four
    // designed refusals and their telemetry payloads, the §116/§118 offers, then
    // `composePlanWithFoundation` and its validation (ADR-020).
    //
    // ⚠️ A DESIGNED REFUSAL COMES BACK AS A VALUE, NOT A THROW. §44, §52, §111 and
    // §113 are the engine WORKING, and the naive HTTP mapping of "threw" is 500.
    // `runEngine` returns the 422 body plus the event to record. A GENUINE fault
    // still throws, and still lands in this handler's own 500 below — unchanged.
    //
    // ⚠️ `displayUnits` IS PASSED IN, NEVER LOOKED UP (ADR-015). The engine does
    // not read a user preference; the §118 offer copy needs the unit, and a
    // distance string assembled without it is the defect ADR-015 exists to prevent.
    stage = 'engine'
    const outcome: EngineOutcome = runEngine({ input, tier, acceptBaseBuild, displayUnits })
    stage = 'respond'

    if (outcome.kind === 'refusal') {
      // REFUSAL-TELEMETRY-01 — recorded BEFORE the branch-specific response, at ONE
      // site, so a new refusal type cannot be added without it. The engine computes
      // the payload (it owns `derivedLevelsFor`, `effectiveStartKm`, `assessOnRamp`);
      // writing it is the caller's, because `lib/plan/*` must stay free of the
      // service-role client. ⚠️ `InputFieldError` carries NO telemetry and never
      // did — `isDesignedRefusal` is false for it, so recording one here would be a
      // new event rather than a refactor.
      if (outcome.telemetry) {
        await recordOpsEvent(outcome.telemetry.event, outcome.telemetry.detail, user.id)
      }
      return NextResponse.json(outcome.body, { status: outcome.status })
    }

    // §118 / P-15 — the runner accepted the base-build offer. Returned through the
    // SAME `{ plan }` shape as the free-tier success path, so the client saves and
    // previews it by the route it already has. No enrichment and no foundation
    // composition: `plan_kind: 'base_build'` is its own plan object and both passes
    // are shaped for a race block.
    if (outcome.kind === 'base_build') {
      if (outcome.telemetry) await recordOpsEvent(outcome.telemetry.event, outcome.telemetry.detail, user.id)
      return NextResponse.json({ plan: outcome.plan })
    }

    // ⚠️ BOTH PLANS, DELIBERATELY. `composedRule` is what the runner gets;
    // `rulePlan` is the foundation-FREE plan that `enrich()` and `generateFreeIntro()`
    // must receive, because §57 keeps foundation-week copy away from the model and
    // ADR-020's blast-radius table confirms that is by design. The revert ladder
    // needs `composedRule` as its source of rule copy. 🔴 DO NOT MUTATE `rulePlan`
    // AND READ `composedRule` — that was `FOUNDATION-META-ALIAS-01`.
    const { plan: composedRule, rulePlan, gapClass, composeViolations } = outcome

    // Free tier: no enrichment. CA-01 — on the user's FIRST plan only, add a
    // single short "why this plan" intro line (the one AI surface a free user
    // gets — the wedge moment). Silent fallback: any failure leaves the rule
    // plan untouched. Subsequent free plans skip the call entirely.
    if (tier === 'free') {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        const service = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )
        // The `plans` table holds one row per user, written on first save. No
        // row yet ⇒ this is their first plan (it isn't persisted until they tap
        // "Use this plan"). Cheapest reliable first-plan signal.
        const { count } = await service
          .from('plans')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if ((count ?? 0) === 0) {
          // FOUNDATION-META-ALIAS-01 — generated FROM the foundation-free plan
          // (unchanged: §57 keeps foundation copy away from the AI, as enrich()
          // does) and stamped ON the plan this route actually returns.
          const intro = await generateFreeIntro(rulePlan, input, user.id, displayUnits)
          if (intro) composedRule.meta.plan_intro = intro
        }
      } catch (e) {
        console.error('[generate-plan] free intro skipped', e)
      }
      // GEN-FIX-02 — free plans are never enriched by design (ADR-006 tier split).
      // Stamping 'skipped' rather than leaving the field absent means an absent
      // value is unambiguously "generated before this shipped", not "free tier".
      //
      // 🔴 FOUNDATION-META-ALIAS-01 (2026-10-15) — STAMPED ON `composedRule`, THE
      // PLAN THIS ROUTE RETURNS. This line used to write `rulePlan.meta` under a
      // comment asserting the two shared one meta object. That was true when
      // written and `FOUNDATION-LONG-RUNWAY-01` falsified it twelve days later, so
      // for 30 days every DELAYED-START plan returned with this field absent — the
      // exact failure `BASEBUILD-ENRICH-VISIBILITY-01` had already recorded five
      // days earlier in `schema.ts`, where an absent stamp made the digest report
      // "0 of 23 missing" on a morning a paid runner held a voiceless plan. That
      // fix swept for plan KINDS; it did not sweep for RETURN PATHS, which is the
      // shape. `composePlanWithFoundation` now always returns a fresh meta, so
      // there is no longer an aliased object to stamp by mistake.
      composedRule.meta.enrichment = 'skipped'
      return NextResponse.json({ plan: composedRule })
    }

    // Trial/paid: stream NDJSON. Send the rule plan immediately so the
    // ceremony can begin reveal while the enricher is still running. Send
    // the enriched plan when ready (silent fallback to rule plan on failure).
    const encoder = new TextEncoder()
    // GEN-FIX-02 — the rule plan goes out before enrichment has run, so its
    // status is genuinely unknown at this point. Stamping 'pending' gives
    // the client-side save race (N8) a fingerprint: a *saved* plan reading
    // 'pending' means the user tapped through before final_plan landed.
    //
    // 🔴 FOUNDATION-META-ALIAS-01 — on `composedRule`, which is what the
    // `rule_plan` frame below actually carries. Writing `rulePlan.meta` here left
    // the fingerprint off every delayed-start plan, so a runner who tapped through
    // early saved a plan with NO enrichment field at all — which GEN-FIX-02 says
    // must mean "generated before this shipped". The saved FINAL plan was never
    // affected (`finalPlan.meta.enrichment` is stamped directly below), and the two
    // live paid rows with uncovered weeks confirm it: 'applied' and
    // 'applied_partial'. It is the interim frame that lost its fingerprint.
    composedRule.meta.enrichment = 'pending'

    // ENRICH-SERVER-SAVE-01 — the enrich→persist chain runs OUTSIDE the stream
    // body, registered with `waitUntil`.
    //
    // It used to live inside `ReadableStream.start()`, after a 28-35s await. That
    // is the one place it must not be: the runner locking their phone is exactly
    // the case this backstop exists for, and a disconnected client can take the
    // stream — and the function — down with it before the write lands. The fix
    // would then have failed precisely where it was needed, silently.
    //
    // `waitUntil` is the platform's answer to "this must outlive the response",
    // and this repo already uses it for the same reason in
    // app/api/health/ingest/route.ts. Started here, in request scope, rather than
    // inside `start()` — one promise, two consumers: the platform holds the
    // function open for it, and the stream awaits the same promise to serve a
    // client that is still listening.
    //
    // The chain NEVER rejects (every await inside is guarded), so `waitUntil`
    // never receives a rejected promise.
    const enrichWork: Promise<Plan> = (async () => {
      try {

        // ENRICH-ATTRIB-01 (2026-09-03) — baseline the rule plan's OWN violations
        // BEFORE enrichment runs. generateRulePlan validates itself, but in
        // production it only console.errors and returns the plan (ruleEngine.ts
        // — never break the user). So the rule plan reaching this point may
        // already carry error-severity violations, and the post-enrich check
        // below must not attribute them to the AI. See the incident note there.
        //
        // ADR-020 Option A — baselined on composedRule (with foundation weeks),
        // not the foundation-free rulePlan, and reuses composeViolations rather
        // than calling validatePlan a second time on the same plan. The
        // post-enrich comparison below re-attaches foundation weeks onto
        // finalPlan before diffing, so both sides of the diff are apples-to-apples.
        const baseline = errorBaseline(composeViolations)

        // A rule plan that violates its own constitution is a separate, more
        // serious defect than a failed enrichment, and it had no durable signal
        // at all — console.error on a Vercel function is not a record. Recorded
        // here rather than in the engine because lib/plan/* must stay free of
        // the service-role client (it is imported by DashboardClient).
        if (baseline.size > 0) {
          await recordOpsEvent(
            'plan_rule_invalid',
            { codes: Array.from(baseline), tier, race_distance_km: input.race_distance_km },
            user.id,
          )
        }

        let finalPlan: Plan = composedRule
        let outcome: EnrichOutcome
        try {
          // enrich() takes the foundation-free rulePlan, never composedRule —
          // the AI must never see or touch foundation-week copy (§57;
          // ADR-020's own blast-radius table confirms this is correct by
          // design, not an oversight).
          const result = await enrich(rulePlan, input, tier, user.id, displayUnits)
          // Re-attach foundation weeks the enricher never saw. Mirrors,
          // almost verbatim, what GeneratePlanScreen used to do client-side
          // at the final_plan merge point — now server-side, ahead of the
          // post-enrich validatePlan check below so it sees the full plan.
          const foundationWeeks = composedRule.weeks.filter(w => w.n <= 0)
          finalPlan = foundationWeeks.length
            ? { ...result.plan, weeks: [...foundationWeeks, ...result.plan.weeks] }
            : result.plan
          outcome = result.outcome
        } catch (e) {
          // enrich() is written not to throw; this is the backstop.
          console.error('[generate-plan] enrich threw unexpectedly', e)
          outcome = {
            status: 'failed',
            reason: 'fetch_failed',
            detail: e instanceof Error ? e.message : String(e),
          }
        }

        finalPlan.meta.enrichment =
          outcome.status === 'applied' ? 'applied' : statusForReason(outcome.reason)

        // PV2-A — re-validate AFTER enrichment. The copy invariants
        // (INV-PLAN-COPY-MATCHES-SESSIONS, -THEME-MATCHES-PRESCRIPTION,
        // -TAPER-COPY-MATCHES-DURATION, -NO-PLACEHOLDER-COPY) run inside
        // generateRulePlan, i.e. BEFORE the AI rewrites labels/themes/notes — so
        // an enricher that promises a session the week doesn't contain sailed
        // through unchecked. The rule plan is already valid; enriched voice is a
        // paid nicety, and a correct plan is not negotiable. If enrichment
        // introduced an error-severity violation, fall back to rule copy.
        //
        // ENRICH-ATTRIB-01: "introduced" means NEW relative to `baseline`. The
        // original code compared against zero, so one pre-existing engine
        // violation discarded every enriched plan — and the enricher cannot
        // produce most violation classes at all (EnrichedWeekSchema exposes only
        // label, theme and coach_notes; it cannot touch a single numeric).
        if (outcome.status === 'applied') {
          const introduced = violationsIntroducedBy(baseline, validatePlan(finalPlan, input))
          if (introduced.length > 0) {
            // ENRICH-PARTIAL-01 (2026-09-04) — revert the OFFENDING WEEKS, not
            // the whole plan.
            //
            // The old behaviour discarded every week's copy for one bad word on
            // one week. Observed on a real trial plan: two §27 violations, on two
            // of the five weeks that carry no intensity, cost the runner enriched
            // copy across all fourteen. Base phase is all-easy BY DESIGN (§4/§5),
            // so the runners with the most exposure are beginners and finish-goal
            // plans — the ones least likely to know the app should sound
            // different, and most likely to be on trial.
            //
            // A partial revert leaves the plan correct everywhere and enriched
            // almost everywhere, which strictly dominates correct-everywhere and
            // enriched-nowhere. The full revert remains the fallback for anything
            // that cannot be attributed to a week (plan-level and meta checks),
            // and for the case where reverting the named weeks does not actually
            // clear the violations — re-validated rather than assumed.
            // ENRICH-PARTIAL-02 (2026-10-02) — try the NARROWEST repair first.
            //
            // A week is still too wide. Measured on live traffic the same day: one
            // mis-named zone in ONE coach note cost a runner week 20 entirely, and
            // another lost weeks 10, 12-16 and 18 — five sessions each, four of
            // which were fine. ⚠️ Neither cause is a false positive: the prompt
            // says "NEVER NAME A ZONE OTHER THAN THE SESSION'S OWN" and "never add
            // a stride note to a session that has NO strides field", so the model
            // broke an instructed rule and the invariants are right. The only
            // honest lever is how much copy one mistake destroys.
            //
            // Ladder: session -> week -> full, and EVERY rung is re-validated
            // rather than assumed, which is the rule ENRICH-PARTIAL-01 already set.
            let repaired: Plan | null = null
            const { sessions: badSessions, allAttributable: allSessionAttributable } =
              attributableSessions(introduced, finalPlan)
            let repairedAtSessionLevel = false
            if (allSessionAttributable && badSessions.size > 0) {
              const candidate = revertSessionsToRuleCopy(finalPlan, composedRule, badSessions)
              if (violationsIntroducedBy(baseline, validatePlan(candidate, input)).length === 0) {
                repaired = candidate
                repairedAtSessionLevel = true
              }
            }

            const { weeks: badWeeks, allAttributable } =
              attributableWeeks(introduced, finalPlan)
            if (!repaired && allAttributable && badWeeks.size > 0) {
              // ADR-020 Option A — composedRule, not rulePlan: the latter has no
              // foundation weeks, so rule copy for a foundation week is only
              // found on the composed plan.
              const candidate = revertWeeksToRuleCopy(finalPlan, composedRule, badWeeks)
              const remaining = violationsIntroducedBy(baseline, validatePlan(candidate, input))
              if (remaining.length === 0) repaired = candidate
            }

            if (repaired) {
              finalPlan = repaired
              finalPlan.meta.enrichment = 'applied_partial'
            } else {
              // ADR-020 Option A — composedRule, not rulePlan: the latter has no
              // foundation weeks. A revert here used to silently drop a runner's
              // foundation block every time enrichment introduced a violation —
              // found by validation before it could ship, not observed in prod.
              finalPlan = composedRule
              finalPlan.meta.enrichment = 'failed_invalid_copy'
            }

            // Recorded AFTER the decision so the event says what actually
            // happened. Reporting it before meant every partial repair still
            // logged as a flat failure, which is how a fixed problem keeps
            // looking broken in the data.
            console.error(
              `[generate-plan] enrichment introduced invariant violations (${repaired ? 'reverted ' + badWeeks.size + ' week(s)' : 'full revert'})`,
              introduced.map(v => `${v.code}@W${v.week}`))
            await recordOpsEvent(
              'plan_enrich_failed',
              {
                reason: 'post_enrich_invalid',
                // ENRICH-PARTIAL-02 — the RUNG matters in the data. A session
                // revert and a week revert both used to log as 'partial_revert',
                // so the narrowing would have been invisible in production and
                // the next person measuring blast radius would see no change.
                outcome: !repaired ? 'full_revert'
                  : badSessions.size > 0 && repairedAtSessionLevel ? 'partial_revert_session'
                  : 'partial_revert',
                reverted_sessions: repairedAtSessionLevel ? Array.from(badSessions) : undefined,
                reverted_weeks: !repaired ? 'all' : repairedAtSessionLevel ? undefined : Array.from(badWeeks),
                codes: introduced.map(v => v.code),
                // ENRICH-PARTIAL-01 — `weeks` and `messages` added 2026-09-04.
                // The event recorded codes and nothing else, so diagnosing the
                // real failure meant reconstructing by hand which weeks could
                // even trip §27. One field would have made it a two-minute job.
                weeks: introduced.map(v => v.week),
                messages: introduced.slice(0, 3).map(v => v.message),
                pre_existing: Array.from(baseline),
                tier,
                race_distance_km: input.race_distance_km,
              },
              user.id,
            )
          }
        }

        // Silent to the user (ADR-006), visible to us. Awaited so the row is
        // durable before the stream closes — recordOpsEvent never throws.
        if (outcome.status === 'failed') {
          await recordOpsEvent(
            'plan_enrich_failed',
            { reason: outcome.reason, detail: outcome.detail, tier, race_distance_km: input.race_distance_km },
            user.id,
          )
        }

        // Belt-and-braces: composedRule.meta already carries this (shared meta
        // reference with rulePlan, stamped before enrich() ran), but finalPlan
        // may be a fresh object from enrich()'s own meta-spread — stamp
        // explicitly rather than depend on that being complete.
        finalPlan.meta.foundation_gap_class = gapClass

        // ENRICH-SERVER-SAVE-01 (2026-09-04) — persist the enriched plan
        // SERVER-SIDE before the stream closes.
        //
        // ENRICH-SAVE-01 made the runner save immediately and receive the
        // enriched copy "as a follow-up". That follow-up was owned entirely by
        // the client, so the design told the runner not to wait and then
        // silently cost them the voice layer when they didn't: tap "Use this
        // plan", lock the phone, and `meta.enrichment` stays 'pending' forever.
        // Observed on a real trial plan — saved 5s after generation, never
        // written again.
        //
        // `shouldServerPersist` keeps this narrow: the row must already exist
        // (generation alone never creates one) and its `meta.generated_at` must
        // match THIS generation, so it can only ever overwrite the plan it just
        // produced — never one the runner deliberately kept. The client's own
        // follow-up write stays as the fast path; this is the backstop.
        //
        // Failure here must never break generation (ADR-006): the runner already
        // has a complete plan, and the enriched copy is a nicety. Recorded, not
        // thrown.
        try {
          // Own client: the one above is scoped to the free-tier intro branch,
          // which this path never enters.
          const { createClient } = await import('@supabase/supabase-js')
          const svc = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
          )
          // PLANS-SINGLE-NOT-MAYBE-01 — through the shared read; same row shape as before.
          const stored = await readPlanJson(svc, user.id)
          const storedRow = stored.plan ? { plan_json: stored.plan } : null

          if (shouldServerPersist(storedRow, finalPlan)) {
            const { error: writeErr } = await svc
              .from('plans')
              .update({ plan_json: finalPlan, updated_at: new Date().toISOString() })
              .eq('user_id', user.id)
            if (writeErr) {
              await recordOpsEvent('plan_enrich_server_save_failed',
                { detail: writeErr.message, tier, race_distance_km: input.race_distance_km }, user.id)
            } else {
              await recordOpsEvent('plan_enrich_server_saved',
                { enrichment: finalPlan.meta.enrichment, tier, race_distance_km: input.race_distance_km }, user.id)
            }
          }
        } catch (e) {
          // Never let the backstop break the thing it is backing up.
          await recordOpsEvent('plan_enrich_server_save_failed',
            { detail: e instanceof Error ? e.message : String(e), tier, race_distance_km: input.race_distance_km },
            user.id)
        }

        return finalPlan
      } catch (e) {
        // Makes the "never rejects" contract above TRUE rather than merely
        // intended. Every `await` in the chain is already guarded or documented
        // not to throw, but `validatePlan` and the revert helpers are synchronous
        // and are not — and a rejected promise handed to `waitUntil` is an
        // unhandled rejection in the platform's hands, on the very path whose job
        // is to be reliable when nobody is watching.
        //
        // The runner already holds a complete plan from `rule_plan` (ADR-006), so
        // the honest fallback is the un-enriched one.
        console.error('[generate-plan] enrich chain threw', e)
        await recordOpsEvent('plan_enrich_server_save_failed',
          { detail: `chain threw: ${e instanceof Error ? e.message : String(e)}`,
            tier, race_distance_km: input.race_distance_km },
          user.id)
        composedRule.meta.enrichment = statusForReason('fetch_failed')
        return composedRule
      }
    })()

    // Guarded because this is THE critical path. `waitUntil` needs a platform
    // request context; outside one (local dev, a test harness, a future runtime
    // change) an unguarded call would throw and 500 the whole generation —
    // strictly worse than the bug it exists to fix. The chain runs either way;
    // without the platform hold it is simply back to surviving only as long as
    // the stream does, which is today's behaviour.
    try {
      waitUntil(enrichWork)
    } catch (e) {
      console.error('[generate-plan] waitUntil unavailable — enrichment persists only while the stream lives', e)
    }

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'rule_plan', plan: composedRule }) + '\n'))
        try {
          const finalPlan = await enrichWork
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'final_plan', plan: finalPlan }) + '\n'))
        } catch {
          // The chain is written not to reject, and the runner already holds a
          // complete plan from `rule_plan` (ADR-006). Close cleanly rather than
          // error the stream; `waitUntil` still owns finishing the write.
        }
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })

  } catch (e) {
    console.error('generate-plan error:', e)
    // `recordOpsEvent` never throws, so this cannot turn a 500 into an unhandled rejection.
    await recordOpsEvent('plan_generate_failed', {
      stage,
      error_name: e instanceof Error ? e.name.slice(0, 60) : typeof e,
      message: (e instanceof Error ? e.message : String(e)).split('\n')[0].slice(0, 200),
      tier: tierSeen,
      race_distance_km: raceKm,
    }, userId)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
