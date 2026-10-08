import { createClient } from '@supabase/supabase-js'

// OPS-01: internal operational telemetry (owned Supabase, no third-party vendor).
//
// SERVER-ONLY. Uses the service-role key, so never import this into a client
// component / isomorphic module (e.g. lib/plan.ts is imported by DashboardClient
// — do not pull this in there). The daily integrity probe backstops any write
// failure that can't be recorded at its site.

export type OpsEventKind =
  // SAVE-VALIDATE-01 (2026-09-19) — a plan reached the database carrying an
  // error-severity constitutional violation.
  //
  // WHY: NINE mutation routes call `savePlanForUser` and NONE of them called
  // `validatePlan`. Only `generate-plan` (6 calls) and `adjust-plan` validated.
  // `post-race-reshape` (+confirm/revert), `recalibrate-zones`,
  // `recalibrate-taper`, `maintenance-block`, `confirm-adjustment` and
  // `revert-adjustment` all persisted unchecked, and the only net was
  // `ops/plan-audit` — a DAILY cron, so an invalid plan could be live for 24
  // hours before anything noticed.
  //
  // The check lives in `savePlanForUser` rather than on the nine routes: one
  // owner covers every current writer AND every future one, where nine copies
  // of one rule is a D-08 violation whose tenth copy gets forgotten.
  //
  // ⚠️ IT NEVER BLOCKS A SAVE IN PRODUCTION. A runner's reshape failing to
  // persist is a worse outcome than a plan with a violation in it, and the
  // daily audit still sweeps. This makes the 24-hour window minutes instead.
  | 'plan_save_invalid'
  // SCHEMA-LIVE-01 (2026-09-19) — a saved plan did not match the canonical
  // Zod schema `types/plan.ts` and `lib/plan/schema.ts` jointly declare.
  //
  // WHY: `schema.ts`'s own header says it is "shared by the rule engine,
  // enricher, reshaper and multi-race" — FOUR declared consumers. `PlanSchema`
  // had exactly ONE, a test written the same day, and had never been run
  // against live engine output. That is how PHASE-EMPTY-01 hid: the engine
  // emitted a shape its own canonical schema rejected and nothing looked.
  //
  // ⚠️ OBSERVATION ONLY. It never throws, in ANY environment, including test.
  // The schema has already drifted from the engine once, so a throwing check
  // would refuse real runners for DRIFT rather than for defects — the schema is
  // not the constitution, `validatePlan` is. This records and moves on.
  | 'plan_schema_drift'

  // REFUSAL-TELEMETRY-01 (2026-09-19) — every DESIGNED refusal, with the inputs
  // that caused it.
  //
  // WHY: §111's door sits at 12 km/week and we could not say what share of real
  // runners fall under it. There is no public data — the coaching literature
  // says what a runner SHOULD have before a marathon block (24-40 km/week), not
  // what charity signups ACTUALLY run, and the charity cannot tell us either.
  // So we stopped trying to find the number and started collecting it: every
  // refusal is a data point, and the answer arrives on its own within days of
  // the codes going out.
  //
  // This is also the honest test of a P0. `S111-DENOMINATOR-01` added 456
  // refusals on a GRID; this records how many land on real people.
  //
  // Behavioural only, no PII: the volume, distance and day-count the runner
  // typed, plus which rule fired. Never a name, never free text.
  | 'plan_refused_by_design'

  | 'plan_save_failed'          // savePlanForUser threw on a server reshape/write path
  | 'plan_integrity_mismatch'   // an auto_applied adjustment never landed in plan_json (probe)
  | 'reshape_invalid'           // a reshaped plan failed a constitutional invariant (prod soft-degrade)
  | 'plan_enrich_failed'        // AI enrichment silently fell back to rule-engine output (GEN-FIX-02)
  | 'plan_rule_invalid'         // a GENERATED rule plan violated its own constitution (ENRICH-ATTRIB-01)
  // ENRICH-SERVER-SAVE-01 (2026-09-04) — the server's own persist of the enriched
  // plan. `_saved` is the SUCCESS case and is recorded deliberately: it is the
  // only evidence that the backstop caught a runner who closed the app, and a
  // backstop nobody can see firing is one nobody trusts.
  | 'plan_enrich_server_saved'
  // ENRICH-PARSE-RETRY-01 (2026-10-02) — the enricher's response failed to PARSE
  // and a single retry recovered it. Recorded so a retry is measurable rather than
  // looking like a clean success: two live runners lost their voice to
  // `parse_error` and four hypotheses for the cause are dead, so the only evidence
  // that will ever explain it is how often a second attempt works.
  // ⚠️ Retried on parse_error ONLY, never on a 4xx/5xx, transport error or rate
  // limit — doubling spend on a 429 is how a retry becomes an incident.
  | 'plan_enrich_retry_recovered'
  | 'plan_enrich_server_save_failed'
  // GTM-CHARITY-03 (2026-09-11) — a RevenueCat webhook event the handler has no
  // mapping for. It used to reply "received" and do nothing, which is why a
  // comp grant could fail without a trace: the subscriptions row was never
  // written, getUserTier stayed 'free', and the runner met a paywall we thought
  // we had lifted. Unhandled is still the correct BEHAVIOUR (we must not guess a
  // status), but it must be visible.
  | 'revenuecat_event_unhandled'
  // SUBS-ORDERING-REVENUECAT-01 (2026-09-24) — a RevenueCat event carrying no
  // usable `event_timestamp_ms`, so the ordering guard could not engage and the
  // write behaved exactly as the old plain upsert did.
  //
  // ⚠️ THE POINT IS THAT A DISENGAGED GUARD MUST NOT BE SILENT. Passing null is
  // the correct fallback (stamping `now()` would mark a STALE event as newest and
  // defeat the guard on the exact delivery it exists to suppress), but "correct
  // fallback" and "nobody can tell it happened" is how an inert check survives for
  // months here. If this fires at any volume, the field name is wrong or RevenueCat
  // changed their payload, and the guard is protecting nothing.
  | 'revenuecat_event_no_timestamp'
  // OPS-SUBS-TRACE-01 (2026-09-28) — the subscription webhooks leave a trace on
  // SUCCESS and on a failed write. Decided by `lib/subscriptions/webhookTrace.ts`,
  // which both routes share so they cannot drift.
  //
  // 🔴 WHY: measured in production on 2026-09-28, `ops_events` held 435 rows across
  // 13 kinds and NOT ONE came from either webhook, while `subscriptions` held a
  // single hand-seeded `stripe` row with `last_event_at = NULL`. The only two kinds
  // either route could emit were both FAILURE branches, so a healthy webhook and an
  // unreachable one were indistinguishable — and `resolveTier` reads that table for
  // every tier decision while `v_trial_conversion` feeds the 1 January trial-to-paid
  // gate. A first real purchase failing at the RPC returned 500 with nothing here.
  //
  // `_received` is the HEARTBEAT and is recorded on every delivery deliberately,
  // the same reasoning as `strava_webhook_received` and `plan_enrich_server_saved`:
  // a backstop nobody can see firing is one nobody trusts. `detail.applied = false`
  // is NOT an error — it is the SUBS-ORDERING-REVENUECAT-01 ordering guard
  // suppressing a stale or replayed delivery, which previously only console.log'd.
  | 'revenuecat_event_received'
  | 'revenuecat_event_write_failed'
  | 'revenuecat_event_unusable'
  // The Stripe half. It had the IDENTICAL blindness plus two failure modes
  // RevenueCat does not have — a subscription carrying no `user_id` metadata and one
  // carrying no `current_period_end` were each rejected with a bare console.error,
  // i.e. A REAL PAYMENT DROPPED WITH NO DURABLE RECORD. Stripe is the web purchase
  // path and owns the only `subscriptions` row that exists, so instrumenting only
  // RevenueCat would have been TWIN-SWEEP-01 exactly: a remedy applied to one twin
  // reads as finished, so nobody looks at the other.
  | 'stripe_event_received'
  | 'stripe_event_write_failed'
  | 'stripe_event_unhandled'
  | 'stripe_event_unusable'
  // CHARITY-OFFER-CODE-01 (2026-09-28) — the server-side entitlement re-check.
  //
  // `_reconciled` is the SUCCESS case and is recorded on every grant, because it
  // is the only evidence the offer-code journey worked for a given runner, and
  // 500 Make-A-Wish codes are about to depend on it.
  //
  // `_unconfigured` fires when REVENUECAT_SECRET_API_KEY is absent. The route
  // then refuses rather than granting: a reconcile that cannot verify must never
  // hand out access, and silence there would be indistinguishable from "nobody
  // redeemed".
  | 'revenuecat_reconciled'
  | 'revenuecat_reconcile_unconfigured'
  // SUBS-RECONCILE-RACE-01 (2026-09-28) — reconcile records EVERY outcome now.
  // Before this the route logged only success and a missing API key, so an empty
  // ops trail could not distinguish "never ran" (a client-side race) from "ran and
  // RevenueCat said no" (a timing problem) — the two have different fixes, and the
  // first real offer-code redemption presented as neither.
  | 'revenuecat_reconcile_none'
  | 'revenuecat_reconcile_failed'
  // SEC-08 sweep (2026-09-11) — the daily coach note's CACHE could not be read
  // or written. Found because `daily_coach_notes` did not exist in production
  // at all: the migration was committed AND recorded in the applied-migrations
  // ledger, but never landed. Both call sites discarded their error, so the
  // only symptom was an Anthropic call on every app open instead of one per
  // user per day. A cache that silently never hits is indistinguishable from a
  // cache that works, which is why this needs a trace and not a comment.
  | 'coach_note_cache_unavailable'
  // TIER-ENFORCE-01 (2026-09-11) — the distance paywall now exists server-side.
  // A legitimate client cannot reach it (the wizard locks the tile using the
  // SAME predicate), so every firing is either a hand-crafted request or a bug
  // in tier resolution. The second would be far worse than the first: it would
  // mean a paying or comped runner being refused a plan. Recorded so the
  // difference is visible rather than inferred from a support email.
  | 'plan_distance_gate_blocked'
  // FOUNDATION-ADD-FAIL-01 (2026-09-18) — the deferred "Add Foundation Block"
  // POST failed on the founder's device and the app recorded NOTHING: the client
  // catch set an error state with no code, message, console or ops event, and the
  // route 500'd with only a server console.error (not a durable, queryable row).
  // The cause (a missing bearer token — the client sent no Authorization header)
  // was fixed under AUTH-BEARER-MISSING-01; this is the observability half, so the
  // NEXT failure here is diagnosable rather than another "it just says try again".
  | 'plan_foundation_add_failed'
  // PLAN-WEEK-COLLISION-01 (2026-09-18) — a LIVE week-keyed row that predates the
  // plan it now resolves against. `week_n` restarts at 1 on every new race plan,
  // so a stale row does not merely sit there: it renders as a completed session
  // of the plan the runner is looking at today. Measured once in production — a
  // fresh 12-week 10K arrived 94% pre-completed — and found only because a human
  // opened his own plan and read it. `validatePlan()` cannot see this class by
  // construction: it validates the plan OBJECT, and the collision lives in
  // another table. With 500 charity runners arriving, "someone happens to look"
  // stops being a control.
  | 'plan_week_collision'
  // ONBOARD-OBS-01 (2026-09-13) — the onboarding finalise (has_onboarded flip +
  // HR persist in handlePlanSaved) is a live browser write, so it cannot call
  // this helper (service-role, server-only) and could previously only
  // console.error on failure. Problem A — 9 of 14 users left with a saved plan
  // but has_onboarded=false — stayed invisible for weeks for exactly that reason.
  // `_failed` is reported by the client via /api/ops/onboarding-event when the
  // settings upsert fails; `_incomplete` is the daily probe OBSERVING the broken
  // state (a plans row exists but has_onboarded is still false), independent of
  // where the write failed — the same belt-and-braces as reshape-integrity.
  | 'onboarding_finalise_failed'
  | 'onboarding_incomplete'
  // STRAVA-WEBHOOK-OBS-01 (2026-09-13) — a fully-killed app cannot
  // background-ingest from HealthKit, so the Strava webhook is the ONLY
  // device-independent auto-link for the common case (run ends, phone pocketed,
  // app killed). It depends on a push subscription whose callback_url lives at
  // STRAVA: nothing in this repo can fail, no deploy can break it, no test can
  // see it. The founder's "runs only link when I open the app" is exactly what a
  // dead subscription looks like from outside.
  //
  // `_received` is the HEARTBEAT and is recorded on every hit deliberately — the
  // silence check has nothing to be silent against otherwise, and the same
  // reasoning as plan_enrich_server_saved applies: a backstop nobody can see
  // firing is one nobody trusts.
  | 'strava_webhook_received'
  | 'strava_subscription_missing'   // no subscription, or one pointing at a stale/redirecting URL
  | 'strava_webhook_silent'         // subscription exists but has stopped delivering
  // OPS-AI-OWNER-01 (2026-09-20) — every Anthropic call, through the single
  // owner `lib/ai/callAnthropic.ts`.
  //
  // `ai_call` is the SUCCESS case and carries the token counts. It is recorded
  // on every call deliberately: `OPS-AI-SPEND-01` exists because not one of the
  // fourteen call sites read `response.usage`, so the only cost figure anybody
  // had was derived from prompt-file sizes and `max_tokens` literals. A total
  // assembled from failures alone would be the same guess with extra steps.
  //
  // `ai_call_failed` is `OPS-AI-FAILURE-ALERT-01`. Silent degradation is
  // CORRECT behaviour (ADR-006) and does not change; what changes is that it
  // leaves a trace. A run of these is also the earliest signal that the
  // Anthropic credit balance is gone, which matters more than usual with 500
  // comped runners arriving at once.
  //
  // ⚠️ Behavioural only, no PII: surface, model, token counts, an estimated
  // cost and a truncated error string. Never prompt text, never a name.
  | 'ai_call'
  | 'ai_call_failed'
  // EMAIL-WAVE-0 (2026-09-24) — one row per email the programme attempts,
  // INCLUDING the ones it chooses not to send. `detail.outcome` is
  // sent | suppressed_unsubscribed | no_address | failed.
  //
  // WHY: 35 emails had gone out with no record that they existed, so the SLT
  // sitting that approved the programme had to reconstruct reach from the
  // `*_sent_at` stamp columns — which only two of the five emails have. A
  // suppressed send is recorded deliberately: "we chose not to" and "it failed"
  // are different facts, and a caller that cannot tell them apart will stamp a
  // sent-column for an email nobody received.
  | 'email_sent'
  // HEALTH-SYNC-OBS-01 (2026-10-07) — the HealthKit ingest pipe, which is the
  // SYSTEM OF RECORD (ADR-011) and had no telemetry at all while its SUPPLEMENT,
  // the Strava webhook, has carried three kinds since STRAVA-WEBHOOK-OBS-01.
  // The remedy was applied to one twin.
  //
  // WHY `_swept` AND NOT AN INGEST-SUCCESS EVENT: the founder ran for 17 days
  // with the Apple Health *Workouts* permission off. `queryWorkouts` returned
  // zero, `syncRecentWorkouts` hit its `if (!res.workouts.length) break`, and
  // NOTHING WAS POSTED. There was no request to instrument. A server-side event
  // on `/api/health/ingest` is structurally blind to this failure, which is the
  // only failure that actually happened. So the CLIENT reports the sweep —
  // "I asked HealthKit for runs since X and got N" — and the three states
  // separate: no events at all = the sync is not running; events with
  // `workouts_found: 0` = permission off or genuinely no runs; found > 0 with
  // `posted: 0` = the ingest is rejecting them.
  //
  // ⚠️ IT CANNOT TELL "PERMISSION OFF" FROM "DID NOT RUN". Nothing on the device
  // can: `@capgo/capacitor-health` resolves a denied read as an empty result, not
  // an error. A RUN of zero-found sweeps is the signal, and it is a signal for a
  // human to read, never a claim to put in front of the runner.
  //
  // A success is NOT recorded: a successful ingest already leaves a row in
  // `strava_activities`, which is a better record than an event about it.
  //
  // No PII: counts, a lookback timestamp and a truncated error string.
  | 'health_sync_swept'
  // The ingest upsert failed. Until now this was a `console.error` the client
  // could not see either — `postWorkout` returns false and the caller counts a
  // failure without ever learning why.
  | 'health_ingest_failed'
  // HK-INGEST-REASON-01 (2026-10-08) — the ingest route REJECTED a payload before doing
  // any work, naming the field that was missing or zero.
  //
  // 🔴 ITS SIBLING `health_ingest_failed` HAS ZERO ROWS EVER, AND THAT IS WHAT MADE THIS
  // NECESSARY. 14 sweeps on 2026-10-08 reported `failed: 1, error: null`, and one user
  // has 22 sweeps that found workouts and never posted one. `health_ingest_failed` is
  // recorded at the UPSERT, so zero rows eliminates the write entirely: the rejection
  // happens at an early return, and every early return was silent on BOTH sides —
  // `postWorkout` collapsed the status into `false` on the client, and the route
  // recorded nothing on the server.
  //
  // ⚠️ IT CARRIES THE VALUES, NOT ONLY THE FIELD NAMES. `!payload.totalDistanceMeters`
  // rejects ZERO as well as absent, and those are different findings: a 0-distance
  // running workout is an indoor or treadmill run, which is a legitimate run that can
  // never be stored and is re-offered on every sweep. `!x` cannot tell 0 from undefined;
  // this event can.
  | 'health_ingest_rejected'
  // POSTRUN-JOURNEY-01 (2026-10-07) — the AI read came back over its WORD budget.
  //
  // The budget used to be in SENTENCES ("two, three at the absolute most") and the
  // founder's own read was three sentences and SEVENTY-SIX words — fully compliant,
  // and six times the corpus mean of 12. A limit in the wrong unit is not a limit.
  //
  // ⚠️ IT IS RECORDED, NOT REPAIRED. The read is left exactly as written: a sentence
  // sliced at word 40 is worse than a long one, and silently trimming would hide the
  // rate. This event is how we find out whether 40 is the right number — if it fires
  // constantly the budget is wrong, not the model.
  | 'read_over_budget'
  // READ-EM-DASH-01 (2026-10-08) — the model emitted an em dash in a run read and the
  // boundary repaired it.
  //
  // ⚠️ THE SIBLING OF `read_over_budget`, AND THE OPPOSITE CHOICE, FOR A STATED REASON.
  // An over-long read is RECORDED and left alone, because slicing a sentence is worse
  // than a long one. An em dash is RECORDED AND REPAIRED, because swapping one mark for
  // a comma costs the sentence nothing. What the two share is that neither is silent:
  // a repair nobody can see is how you stop finding out that the instruction is being
  // ignored, or that the rate is getting worse.
  //
  // 🔴 AND THE INSTRUCTION WAS ALREADY THERE. `buildVoiceHeader` has carried "Never use
  // an em dash" since BRAND-EMDASH-APP-01 and the model still did it on 18.1% of live
  // reads, which is the baseline this event is measured against. If it fires at a
  // materially different rate, something changed in the prompt or the model.
  | 'read_em_dash_repaired'
  // COMPLETION-CLAIM-UUID-01 (2026-10-07) — the atomic auto-link claim FAILED, as
  // opposed to losing a race.
  //
  // 🔴 WHY THIS EXISTS. `claim_session_completion` declared `inserted_id bigint`
  // while `session_completions.id` is a uuid, so the insert succeeded, the
  // assignment threw, the transaction rolled back, and the function could NEVER
  // return true. **No auto-link wrote a completion for ANY user from 2026-09-24
  // until 2026-10-07.**
  //
  // ⚠️ IT WAS INVISIBLE FOR TWO REASONS AND BOTH ARE FIXED HERE. First, the only
  // signal was a `console.warn` — and the migration it replaced had been swapped in
  // precisely BECAUSE the old implementation logged on every routine auto-link, so
  // the new failure was indistinguishable from the noise it was meant to remove.
  // Second, `claimAutoLink` converts the failure to `'exists'`, which means
  // "someone already linked it" — **the one return value that makes doing nothing
  // look correct.** The degradation stays (never push on uncertainty); what changes
  // is that it leaves a durable trace.
  //
  // `detail`: `{ week_n, session_day, source, message }`. No PII.
  | 'completion_claim_failed'

/**
 * Record an internal ops event. Fire-and-forget by nature but awaitable, so a
 * caller can guarantee the row lands before it rethrows the original error.
 *
 * NEVER throws: telemetry must not break the path it monitors. If the insert
 * itself fails, it degrades to a console.error and returns.
 */
export async function recordOpsEvent(
  kind: OpsEventKind,
  detail: Record<string, unknown> = {},
  userId: string | null = null,
): Promise<void> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { error } = await supabase.from('ops_events').insert({ kind, user_id: userId, detail })
    if (error) console.error('[ops] failed to record event', kind, error.message)
  } catch (err) {
    console.error('[ops] failed to record event', kind, err)
  }
}
