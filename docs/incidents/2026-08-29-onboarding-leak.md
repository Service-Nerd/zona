# Incident — onboarding never completes ("Problem A") + two siblings

**Date found:** 2026-08-29 · **Live since:** unknown (≥ weeks) · **Triage:** Systemic
**Fix commits:** `ec398ce` (signup hang), `e2fa9e5` (onboarding leak + zones), `113c7ea` (enrich discard) · **Backfill:** 10 users, 2026-08-29 · **Catalogue class:** existing — *dead code / silent fallback / unchecked response*

> Three silent onboarding/plan-generation failures found in one fresh-account
> audit (`docs/investigations/onboarding-audit-2026-08-29.md`). They share DNA:
> an awaited Supabase call whose result or rejection was neither checked nor
> surfaced, and no telemetry, so each failed invisibly.

---

## Symptom

- **Signup (D1):** "Creating account…" span forever. The account *was* created and
  the user could later sign in — but the button never resolved.
- **Onboarding leak (D2 / "Problem A"):** 10 users had a saved `plans` row but
  `has_onboarded` never flipped to `true`. No error, no save failure, no ops_event.
- **Zone cards (D3):** the orientation screen showed all five HR zones as "—"
  even though the footnote reported the correct max HR.
- **Enrichment (A1):** a trial user's plan silently lost its AI voice/confidence;
  the DB showed three `plan_enrich_failed` / `post_enrich_invalid` events.

## What was actually wrong

- **D1** — `app/auth/login/page.tsx` `handleEmail`: `signUp` was awaited with no
  `try/catch/finally` and no timeout, so any rejection/hang stranded
  `loading=true`. Under auto-confirm it also ignored the returned session and never
  navigated.
- **D2** — `DashboardClient.tsx`: `has_onboarded=true` was written *only* in
  `dismissWelcome`, whose trigger — the retired Welcome screen — was commented out.
  The flip was dead code; nothing on the live `handlePlanSaved` path set it.
- **D3** — the orientation zone cards read HR from mount-time `user_settings`
  state, but the wizard writes HR only into `plan.meta`. New users had null state → "—".
- **A1** — `invariants.ts` `INV-PLAN-RACE-SPECIFIC-EXPOSURE` (per-week arm) tested
  for the substring `"pace"` in the session label; the enricher rewrites labels
  (`enrich.ts` `mergePlan`), so a rephrase to "Speed intervals" tripped post-enrich
  re-validation and the whole enriched plan was discarded (ADR-006 silent fallback).

## Why it survived

**The important section.** None of these crash — every one degrades silently.

- **D2** passed every check because there was *nothing to check*: the plan saved
  correctly (the `plans` write succeeded), and the flag was a separate write that
  simply never ran. No telemetry on the onboarding finalise, so a flag that never
  flipped looked identical to one that did. It survived because "plan exists" and
  "onboarded" were never asserted together.
- **D1** survived because the failure is a *non-event* — a promise that never
  settles produces no error to log and no branch to hit. There was no `finally` to
  reveal it.
- **A1** survived because ADR-006 makes enrich failure silent by design (fall back
  to the rule plan). The invariant *was* firing correctly; it was firing on the
  wrong signal (a mutable label). It looked like "AI just didn't add much" rather
  than "the AI plan was thrown away." Only 1 user hit it, so it never aggregated
  into a visible pattern — but the flaw is latent for every time-target archetype.
- The **named handover** that requested this reproduction (`ZONNA-RESHAPE-RLS-FIX.md`)
  was not in the repo, and its cohort claim ("zero ops_events") was contradicted by
  the DB (A1's three events). Reconstructed from code + DB instead.

## Blast radius

- **Data:** 10 users left un-onboarded; backfilled (`has_onboarded=true` where a
  plan exists). Leak now 0.
- **Native vs web:** D2's fix uses the same browser client that already persists
  the plan (proven to write on native for these users), so it is native-safe
  without a new route.
- **Enrichment:** A1's fix changed the *signal* (stamped `stimulus`, not label);
  verified it does not mask genuine gaps.
- **Not touched:** the rule engine's prescription (A1 is detection-only), pricing,
  gates, migrations.

## Fix

- **D1** — wrap `handleEmail` in `try/catch`; navigate on a returned session; keep
  "check your email" only for the genuine confirmation case.
- **D2** — move the `has_onboarded` flip into the live `handlePlanSaved`, check
  `.error`, surface (not swallow) failure. Also persist + hydrate HR there (D3).
- **A1** — detect goal-pace work structurally via `classifyStimulus` (reads the
  stamped `stimulus`, which the enricher cannot set), mirroring the `isVo2maxSession`
  / D-17 precedent. Chosen over "protect the label in the prompt" because a prompt
  instruction is not enforceable; the stamp is.

## Regression defence

- **A1** — `lib/plan/enrichRelabelRaceSpecific.test.ts`: base clean; stays clean
  when race-pace labels are rewritten to drop "pace" (fails pre-fix); still fires
  when a session is genuinely non-race-pace.
- **D1 / D2 / D3** — not unit-testable (auth promise behaviour, React
  state/persistence on the onboarding finalise are integration-level). Verified via
  `tsc` + `next build` + the live DB trace; the ops-event gap that hid D2 is the
  durable defence to add next (see follow-ups).

## Catalogue

- [x] **Existing** classes in the `zona-debug` catalogue: *dead code / retired
  trigger* (D2), *silent fallback* (A1, D1), *unchecked response* (D2's discarded
  upsert), *two-source-of-truth* (D3: state vs `plan.meta`). No new class — these
  are textbook instances of ones already catalogued.

## Follow-ups

- Client-side onboarding telemetry: `recordOpsEvent` is server-only, so the D2
  flip failure could not be recorded at its site. A small server route would make
  future onboarding-finalise failures visible instead of silent.
- `INV-PLAN-FOUNDATION-BLOCK` volume arm too strict + Foundation weeks never
  re-validated in the live path (surfaced during Coaching-1; fixed as an
  engineering follow-up — see the onboarding audit §7).
