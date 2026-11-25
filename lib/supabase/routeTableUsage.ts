// SEC-08 — which (table, operation) pairs does a route source perform?
//
// Shared by `scripts/rls-convertible-routes.ts` (the rollout report) and
// `rlsCoverage.test.ts` (the build-time guard), so the report and the gate can
// never disagree about what a route does. Extracting it twice would be the same
// parallel-semantics mistake the tier resolution just had.

import type { PolicyOp } from './rlsPolicyManifest'

const OP_MAP: Record<string, PolicyOp[]> = {
  select: ['select'],
  insert: ['insert'],
  update: ['update'],
  delete: ['delete'],
  // An upsert may do either, so it needs both permissions.
  upsert: ['insert', 'update'],
}

/** `.from('table')` followed by the operation that starts the chain. */
const USAGE_RE =
  /\.from\(\s*['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]\s*\)[\s\S]{0,160}?\.(select|insert|upsert|update|delete)\b/g

/**
 * `.from()` calls whose table is NOT a string literal, e.g. `.from(tableVar)`.
 * These are invisible to static analysis, so a route containing one cannot be
 * cleared for conversion by this tooling. `Array.from(x)` is excluded: it is not
 * a Supabase call and matching it would produce constant false alarms.
 */
const DYNAMIC_RE = /(?<!Array)\.from\(\s*(?!['"`])[A-Za-z_$]/g

export interface RouteTableUsage {
  /** table → operations performed on it. */
  usage: Map<string, Set<PolicyOp>>
  /** Count of `.from(<non-literal>)` calls. Non-zero means "cannot be cleared". */
  dynamicTableRefs: number
}

export function extractTableUsage(src: string): RouteTableUsage {
  const usage = new Map<string, Set<PolicyOp>>()
  let m: RegExpExecArray | null
  const re = new RegExp(USAGE_RE.source, 'g')
  while ((m = re.exec(src))) {
    const [, table, verb] = m
    if (!usage.has(table)) usage.set(table, new Set())
    for (const op of OP_MAP[verb] ?? []) usage.get(table)!.add(op)
  }
  const dynamicTableRefs = (src.match(new RegExp(DYNAMIC_RE.source, 'g')) ?? []).length
  return { usage, dynamicTableRefs }
}

// ── Table access that happens in ANOTHER module ────────────────────────────
//
// A route can hand its client to a helper, and that helper's queries are
// invisible to the regex above. This is not hypothetical: `savePlanForUser`
// (ADR-020's single plan writer) calls `reanchorCharityGrant`, which UPDATES
// `charity_codes` — a table a user-scoped client may only SELECT. Eleven routes
// call it, and a first pass of this tooling cleared seven of them for
// conversion. Converting any of those would have silently stopped charity
// grants re-anchoring to race day, which is precisely the class of bug the
// user-scoped rollout is meant to reduce.
//
// So: helpers that accept a client carry their transitive table usage here, and
// a route that calls one inherits it. Keep this list in step when a helper
// starts touching a new table — `rlsCoverage.test.ts` verifies the modules
// named below still perform the operations claimed, so a drift shows up as a
// failure rather than as a quietly-wrong clearance.
export const CLIENT_ACCEPTING_HELPERS: Record<string, {
  /** Modules whose table access this helper performs, for the drift check. */
  modules: string[]
  /** table → operations the helper performs with the caller's client. */
  tables: Record<string, PolicyOp[]>
}> = {
  savePlanForUser: {
    modules: ['lib/plan.ts', 'lib/charity/reanchor.ts'],
    tables: {
      plans:             ['select', 'insert', 'update'],
      plan_archive:      ['select', 'insert'],
      plan_weekly_notes: ['delete'],
      // The one that blocks conversion. SELECT is policied; UPDATE is not.
      charity_codes:     ['select', 'update'],
    },
  },
  // 🔴 CONFIRM-REVERT-WRITE-ERRORS-01 (2026-11-25) — REGISTERED BECAUSE MOVING A SAVE BEHIND AN
  // OWNER MADE FOUR ROUTES LOOK CONVERTIBLE WHEN THEY ARE NOT.
  //
  // This map keys on the helper's name appearing in the ROUTE source. `confirm-adjustment`,
  // `revert-adjustment`, `post-race-reshape/confirm` and `post-race-reshape/revert` reach
  // `savePlanForUser` through `applyAnsweredProposal` and no longer name it, so every table it
  // touches — including the `charity_codes: ['select','update']` pair that BLOCKS conversion —
  // became invisible to the analysis. Measured by code review: `rls-convertible-routes.ts`
  // listed all four as 🟢 CONVERTIBLE while `post-race-reshape/route.ts`, which still calls
  // `savePlanForUser` directly, stayed 🔴 BLOCKED. Converting any of them to a JWT client would
  // have stopped charity grants re-anchoring, silently, for the 500 Make-A-Wish runners — the
  // exact failure `ADJUST-PLAN-SAVE-CLIENT-01` records as its abandoned first cut.
  //
  // ⚠️ `rlsCoverage.test.ts` CANNOT CATCH A MISSING ENTRY — it verifies that LISTED helpers still
  // do what they claim, so its population is this object. A helper nobody registers is outside
  // it by construction. **Register a client-accepting helper in the same commit that creates
  // one**, and the sibling to check is `planRouteClient.test.ts`, whose population had the same
  // dependency on the literal call.
  applyAnsweredProposal: {
    modules: ['lib/supabase/applyAnsweredProposal.ts', 'lib/plan.ts', 'lib/charity/reanchor.ts'],
    tables: {
      // Its own writes.
      plan_adjustments:   ['select', 'update'],
      post_race_reshapes: ['select', 'update'],
      user_settings:      ['update'],
      // …plus everything `savePlanForUser` does, because it calls it. Kept as a literal copy
      // rather than a spread so a reader sees what a JWT client would be asked to do, and the
      // drift check reads the modules above either way.
      plans:              ['select', 'insert', 'update'],
      plan_archive:       ['select', 'insert'],
      plan_weekly_notes:  ['delete'],
      charity_codes:      ['select', 'update'],
    },
  },
}

/** Merge in the usage of any client-accepting helper this source calls. */
export function withHelperUsage(src: string, base: RouteTableUsage): RouteTableUsage {
  const usage = new Map(Array.from(base.usage.entries()).map(([k, v]) => [k, new Set(v)]))
  for (const [helper, spec] of Object.entries(CLIENT_ACCEPTING_HELPERS)) {
    if (!new RegExp(`\\b${helper}\\s*\\(`).test(src)) continue
    for (const [table, ops] of Object.entries(spec.tables)) {
      if (!usage.has(table)) usage.set(table, new Set())
      for (const op of ops) usage.get(table)!.add(op)
    }
  }
  return { usage, dynamicTableRefs: base.dynamicTableRefs }
}

/**
 * Does this route accept an INTERNAL call authenticated by the service key
 * rather than by a user's JWT?
 *
 * `analyse-run` and `weekly-report` are invoked both by the runner's app AND by
 * a cron on their behalf (`x-service-key` + `x-user-id`). On that path there is
 * no user token at all, so `createUserScopedClient` returns null and the route
 * has nothing to query with. Table-usage analysis cannot see this — both routes
 * looked perfectly convertible — so it is asked separately.
 *
 * Such a route can still be converted, but only by BRANCHING: user-scoped client
 * on the interactive path, service role on the internal one. That is a different
 * and larger change than a client swap, so the report lists them as blocked
 * rather than clearing them.
 */
export function acceptsInternalServiceCall(src: string): boolean {
  return /x-service-key/.test(src)
}
