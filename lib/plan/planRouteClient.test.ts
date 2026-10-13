/**
 * RECALIBRATE-ZONES-COOKIE-CLIENT-01 — a route that fetches a runner's plan must
 * use the SERVICE client, never the cookie client.
 *
 * 🔴 THE DEFECT, AND IT WAS A HALF-FIX SHIPPED A WEEK EARLIER. Every one of these
 * routes authenticates off the BEARER token (`getUserFromRequest`).
 * `AUTH-BEARER-MISSING-01` (2026-09-18) fixed the CLIENT half — `authedFetch`
 * attaches the token, because "cookie sync is unreliable on native", and a bare
 * fetch 401'd every paid recalibration. **The SERVER half of that same sentence
 * was never fixed on `/api/recalibrate-zones`:** it took the bearer and then read
 * the plan with a cookie-bound client, which on native hits RLS with no session
 * and returns nothing.
 *
 * The runner is then told **"No plan found."** while their plan sits in the
 * `plans` table. Confirmed live 2026-09-25 on a trial user with exactly one row.
 *
 * ⚠️ `post-race-reshape` has carried the fix AND the explanation since September,
 * and `maintenance-block` and `recalibrate-hr` both use the service client. The
 * remedy existed in three places and was never carried to the fourth — the same
 * shape as §90/§94, CB-1's foundation-only exemption and DELOAD-INVERSION-01.
 *
 * This is a SOURCE check, deliberately: the failure only reproduces against a
 * live RLS-enforcing database on a native client, which no unit test can stand
 * up. What IS mechanically checkable is that no such route reaches for the
 * cookie client, and that is what would have caught it.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** Every `app/api/**\/route.ts`. */
function routeFiles(dir = 'app/api', out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    if (statSync(full).isDirectory()) routeFiles(full, out)
    else if (e === 'route.ts') out.push(full)
  }
  return out
}

const PLAN_FETCHERS = routeFiles().filter(f =>
  /\bfetchPlanForUser\s*\(/.test(readFileSync(f, 'utf8')))

/**
 * 🔴 THE WRITE HALF, ADDED 2026-10-13 (`ADJUST-PLAN-SAVE-CLIENT-01`).
 *
 * The arm above has existed since `RECALIBRATE-ZONES-COOKIE-CLIENT-01`
 * (2026-09-25) and keys on `fetchPlanForUser` — **so it can only ever see a
 * READ**. Three routes went on handing the cookie client to `savePlanForUser`
 * for another eighteen days, and the failure is worse than the read's: a read
 * returns "No plan found", a write throws AFTER the adjustment row has been
 * committed, so the two records disagree and only a daily probe notices.
 *
 * Measured on the founder's account: 3 `plan_save_failed`, all
 * `new row violates row-level security policy for table "plans"`.
 *
 * ⚠️ THE POPULATION IS DERIVED, NOT LISTED. A hand-written file list is the
 * failure class this repo has recorded four times in one day — the list stops
 * matching the code and the check reports on a smaller world.
 */
const PLAN_SAVERS = routeFiles().filter(f =>
  /\bsavePlanForUser\s*\(/.test(readFileSync(f, 'utf8')))

describe('plan-fetching routes use the service client', () => {
  it('there ARE such routes — otherwise the assertion below is vacuous', () => {
    expect(PLAN_FETCHERS.length, 'no route calls fetchPlanForUser; has it been renamed?')
      .toBeGreaterThanOrEqual(4)
  })

  // 🔴 THE REGRESSION CASE. Red against the pre-fix route.
  it.each(PLAN_FETCHERS)('%s does not build a cookie client', file => {
    const src = readFileSync(file, 'utf8')
    // The cookie client is `createClient()` from `@/lib/supabase/server` — it
    // takes NO arguments. The service client takes url + service-role key.
    const usesCookieClient = /from '@\/lib\/supabase\/server'/.test(src)
    expect(usesCookieClient,
      `${file} fetches a plan but imports the cookie client from @/lib/supabase/server. `
      + 'It authenticates off the Bearer token, so on native the cookie session is absent, '
      + 'the read hits RLS with no session, and the runner is told "No plan found." '
      + 'Use createServiceClient, as post-race-reshape / maintenance-block / recalibrate-hr do.',
    ).toBe(false)
  })

  it.each(PLAN_FETCHERS)('%s passes the service client INTO fetchPlanForUser', file => {
    const src = readFileSync(file, 'utf8')
    // Whatever identifier it passes must be assigned from a service-client call,
    // not from a bare `createClient()`.
    const passed = src.match(/fetchPlanForUser\(\s*[^,]+,\s*([A-Za-z_$][\w$]*)/)?.[1]
    expect(passed, `${file}: could not read the client argument to fetchPlanForUser`).toBeTruthy()
    const assignment = new RegExp(`(const|let)\\s+${passed}\\s*=\\s*createServiceClient\\(`)
    expect(assignment.test(src),
      `${file}: fetchPlanForUser receives \`${passed}\`, which is not assigned from createServiceClient`,
    ).toBe(true)
  })
})

describe('plan-SAVING routes never write through a cookie client', () => {
  it('there ARE such routes — an empty population passes every arm below', () => {
    expect(PLAN_SAVERS.length, 'no route calls savePlanForUser; has it been renamed?')
      .toBeGreaterThanOrEqual(8)
  })

  // 🔴 THE REGRESSION CASE. Red against adjust-plan / confirm-adjustment /
  // revert-adjustment as they stood on 2026-10-12.
  it.each(PLAN_SAVERS)('%s passes a client that sets auth.uid() INTO savePlanForUser', file => {
    const src = readFileSync(file, 'utf8')
    const passed = src.match(/savePlanForUser\(\s*[^,]+,\s*[^,]+,\s*([A-Za-z_$][\w$]*)/)?.[1]
    expect(passed, `${file}: could not read the client argument to savePlanForUser`).toBeTruthy()

    // Either client is acceptable and the reason differs per table, so the check
    // is "sets auth.uid() or bypasses RLS deliberately", never a single name:
    //   · createServiceClient      — bypasses RLS
    //   · createUserScopedClient   — sets auth.uid() from the Bearer token
    // What is NEVER acceptable is the bare `createClient()` cookie client, whose
    // auth.uid() is NULL on native.
    const ok = new RegExp(
      `(const|let)\\s+${passed}\\s*=\\s*(createServiceClient|createUserScopedClient)\\(`,
    ).test(src)
    expect(ok,
      `${file}: savePlanForUser receives \`${passed}\`, which is not assigned from `
      + 'createServiceClient or createUserScopedClient. A bearer-authenticated route that '
      + 'writes through the cookie client has auth.uid() NULL on native, so RLS refuses the '
      + 'upsert and savePlanForUser throws AFTER the caller has already recorded its work. '
      + 'This is ADJUST-PLAN-SAVE-CLIENT-01, measured 3× on production.',
    ).toBe(true)
  })

  it.each(PLAN_SAVERS)('%s does not build a cookie client at all', file => {
    const src = readFileSync(file, 'utf8')
    expect(/from '@\/lib\/supabase\/server'/.test(src),
      `${file} saves a plan and still imports the cookie client. Even unused it is a loaded `
      + 'footgun: the next edit reaches for the nearest client in scope.',
    ).toBe(false)
  })
})
