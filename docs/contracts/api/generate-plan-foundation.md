# API Contract — /api/generate-plan/foundation

**Method:** POST
**Auth:** Bearer token (any tier). No feature gate — Foundation Block is FREE infrastructure (ADR-020 §SLT-1).
**Added:** 2026-09-03, ADR-020 Option A.

## Purpose

Completes the deferred "Add Foundation Block" decision. Only reachable after an
`/api/generate-plan` response carried `meta.foundation_gap_class === 'choice'`
(>28-day gap between today and `plan_start`) — the server declined to add a
block without asking, and the client showed the modal.

Deliberately **not** a re-call to `/api/generate-plan`. It must not re-run
`generateRulePlan` or re-pay for AI enrichment (28–35s, real cost) just to
prepend a few easy weeks onto an already-good plan the runner may have
already seen or saved. This route composes onto the **existing** plan the
client already has.

## Request body

```json
{
  "input": { /* the same GeneratorInput used to generate `plan` */ },
  "plan": { /* the full Plan object currently held by the client */ }
}
```

Both fields required. Returns 422 if either is missing.

## Response — 200

```json
{ "plan": { /* plan with foundation weeks composed onto it */ } }
```

`plan.weeks` now contains the foundation block (`phase: 'foundation'`,
`n ≤ 0`) prepended, and `plan.meta.foundation_gap_class` is stamped
(always `'choice'` on this route, by construction — see Behaviour).

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 422 | `input` or `plan` missing |
| 500 | Unexpected error |

## Behaviour

- Calls `composePlanWithFoundation(body.plan, body.input, today, 'add')`
  (`lib/plan/foundationCompose.ts`) — the same single-owner composition
  function `/api/generate-plan` calls for the `'auto'` gap band. `today` is
  the server's own clock (`formatDate(new Date())`), never trusted from the
  client.
- The server **re-derives** the gap classification itself from
  `plan.meta.plan_start` — it does not trust a client-asserted gap class,
  only the `'add'` decision. If the gap has somehow moved outside the
  `'choice'` band since the original `/api/generate-plan` call (a stale
  client plan, a clock skew), the route still behaves correctly: `'auto'`
  adds the block anyway (harmless — it was going to happen), `'none'` is a
  no-op.
- `enforceViolations()` (`lib/plan/invariants.ts`) runs on the composed
  plan's violations before returning — throws in dev/test, logs in prod
  (ADR-006: never break the runner's plan over a defect).
- No `generateRulePlan` call. No AI enrichment. No database read or write —
  this route is stateless; the client still owns saving the plan via its
  existing `onPlanSaved` → `savePlanForUser` path, unchanged.

## Client usage

`app/dashboard/GeneratePlanScreen.tsx`'s `handleFoundationAddBlock` is the
only caller. It's a real network call (unlike the old client-side
`generateFoundationBlock` splice it replaced), so it carries first-class
loading/error UI state (`foundationAddStatus`). On failure the runner keeps
whatever plan they already have — the modal stays open with a retry
affordance, never a silent block or a lost plan (ADR-006).
