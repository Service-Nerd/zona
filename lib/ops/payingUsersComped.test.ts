import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * OPS-PAYING-COMPED-01 — the headline paying-user number counted comped seats.
 *
 * 📐 Measured in production 2026-11-11: the view reported **23**; subscriptions that are active
 * and NOT comped, fleet-wide, number **0**; all 24 subscriptions are Make-A-Wish offer-code
 * redemptions. The tier ladder resolves `premium` on an active subscription and never asks who
 * paid. `v_trial_conversion.converted_real` already draws that line
 * (`20260928_comped_entitlement_not_a_conversion.sql`); the rule had been applied to the
 * conversion metric and not to the count of customers.
 *
 * ⚠️ Scans the migration, not the database, for the reason `metricViewExclusion.test.ts` gives:
 * it must run in CI with no credentials. `npm run check:db` is the live check.
 */
const DIR = 'supabase/migrations'

/** The newest migration that defines the view is the one in force. */
function liveViewSql(): string {
  const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
    .filter(f => /create\s+(or\s+replace\s+)?view\s+public\.v_paying_users/i
      .test(readFileSync(join(DIR, f), 'utf8')))
  expect(files.length, 'no migration defines v_paying_users').toBeGreaterThan(0)
  return readFileSync(join(DIR, files[files.length - 1]), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*--[^\n]*$/gm, ' ')
}
const sql = liveViewSql()

/** How many times a global pattern matches the live view SQL. */
function countOf(re: RegExp): number {
  let n = 0
  for (let m = re.exec(sql); m !== null; m = re.exec(sql)) n++
  return n
}

describe('OPS-PAYING-COMPED-01 — v_paying_users', () => {
  it('counts only ACTIVE, NON-COMPED subscriptions as paying', () => {
    expect(sql).toMatch(/not\s+coalesce\(\s*b\.is_comped\s*,\s*false\s*\)/i)
    expect(sql).toMatch(/b\.status\s+in\s*\(\s*'active'\s*,\s*'trialing'\s*\)/i)
    expect(sql).toMatch(/as\s+paying_users/i)
  })

  it('keeps the comped cohort VISIBLE rather than discarding it', () => {
    // A charity cohort of 24 is a real and wanted fact; what is wrong is calling it revenue.
    // Two columns, so a reader cannot get the answer by accident.
    expect(sql).toMatch(/as\s+comped_users/i)
  })

  it('still excludes internal accounts from BOTH counts — INTERNAL-ACCOUNTS-01 must not regress', () => {
    // 🔴 THE FIRST CUT OF THIS ARM ASSERTED THE CLAUSE EXISTS SOMEWHERE, and deleting it from
    // ONE of the two count filters left the suite green — the other occurrence satisfied it.
    // An exclusion that holds for one column and not its sibling is the INTERNAL-ACCOUNTS-01
    // defect exactly: `v_paying_users` was the view that got the rule late. Count both.
    const filters = countOf(/count\(\*\)\s*filter\s*\(/gi)
    const guards  = countOf(/not\s+coalesce\(\s*t\.is_internal\s*,\s*false\s*\)/gi)
    expect(filters, 'no count filters found — this arm has stopped looking').toBeGreaterThan(1)
    expect(guards, `${guards} internal guards for ${filters} counts`).toBe(filters)
  })

  it('DROPS before creating, because it adds a column', () => {
    const drop = sql.search(/drop\s+view\s+if\s+exists\s+public\.v_paying_users/i)
    const create = sql.search(/create\s+(or\s+replace\s+)?view\s+public\.v_paying_users/i)
    expect(drop, 'no drop before the create — a column-set change would raise 42P16').toBeGreaterThan(-1)
    expect(drop).toBeLessThan(create)
  })

  it('stays off the client', () => {
    expect(sql).toMatch(/revoke\s+all\s+on\s+public\.v_paying_users\s+from\s+anon,\s*authenticated/i)
  })

  it('the conversion metric it is being aligned with still draws the same line', () => {
    // If `converted_real` ever stops excluding comped, this view's premise is void and the two
    // numbers would disagree again — better to fail here than to keep one of them honest.
    const files = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
      .filter(f => /create\s+(or\s+replace\s+)?view\s+public\.v_trial_conversion/i
        .test(readFileSync(join(DIR, f), 'utf8')))
    const conv = readFileSync(join(DIR, files[files.length - 1]), 'utf8')
    expect(conv, 'v_trial_conversion no longer excludes comped from converted_real')
      .toMatch(/not\s+coalesce\(\s*sub\.is_comped\s*,\s*false\s*\)/i)
  })
})
