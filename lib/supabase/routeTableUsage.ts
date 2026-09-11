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
