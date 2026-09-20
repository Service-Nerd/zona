import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * GTM-CHARITY-05 — the SQL view and `resolveTier` must resolve the same order.
 *
 * THE DEFECT. `lib/trial.ts → resolveTier` is documented as THE SINGLE OWNER of
 *   admin → active subscription → charity grant → trial → free
 * and its header comment exists precisely because that order once lived in
 * three places and drifted (TIER-OWNER-01). The Supabase view
 * `admin_user_tiers` was a FOURTH copy and its CASE stopped at
 * admin → subscription → trial → free. It never read `charity_codes`.
 *
 * ⚠️ MEASURED IN PRODUCTION BEFORE THE FIX, not predicted: two live users read
 * `trial` who hold an active grant. Everyone else was unchanged (18 free, 13
 * trial, 1 admin). Two today; **five hundred in October**, at which point
 * `v_trial_conversion` — a LEFT JOIN over anyone with a `trial_started_at` —
 * would count every comped runner as an unconverted trial and make trial→paid
 * look worse than it is for an entire season.
 *
 * ⚠️ WHY A TEST AND NOT A COMMENT. This is D-16 (no parallel semantics) and
 * the duplication is UNAVOIDABLE: SQL cannot import a TypeScript function. So
 * the duplicate is knowingly kept, and the mitigation has to be mechanical —
 * the previous mitigation was a comment asking the next person to remember,
 * and that comment is what produced this defect. This test does not prove the
 * two agree semantically; it proves the view still CONTAINS each arm, in
 * order, so an arm cannot be dropped silently the way the grant arm was.
 */
const MIGRATIONS = join(process.cwd(), 'supabase/migrations')

/** The newest migration that redefines the view is the one in force. */
function liveViewSql(): string {
  const files = readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => readFileSync(join(MIGRATIONS, f), 'utf8').includes('VIEW public.admin_user_tiers'))
  expect(files.length, 'no migration defines admin_user_tiers').toBeGreaterThan(0)
  return readFileSync(join(MIGRATIONS, files[files.length - 1]), 'utf8')
}

const TRIAL_TS = readFileSync(join(process.cwd(), 'lib/trial.ts'), 'utf8')

describe('GTM-CHARITY-05 — admin_user_tiers tracks resolveTier', () => {
  const sql = liveViewSql()
  // Only the CASE that produces `tier`; the ORDER BY repeats the arms and
  // would otherwise make every index below ambiguous.
  // ⚠️ Anchored BACKWARDS from `END AS tier`, not forwards from the first
  // `CASE`. The first cut searched forwards and matched the word "CASE" inside
  // this migration's own header comment, so the slice began ~40 lines early
  // and the ordering assertions compared positions in prose. Caught because
  // the test went red on a view that was correct.
  const tierEnd = sql.indexOf('END AS tier')
  const tierCase = sql.slice(sql.lastIndexOf('CASE', tierEnd), tierEnd)

  it('reads a real view definition, so the test cannot pass on an empty string', () => {
    expect(tierCase.length).toBeGreaterThan(100)
    expect(tierCase).toContain('WHEN')
  })

  it('resolveTier still declares the order this view is tracking', () => {
    // If the OWNER's order changes, this test's premise is void — better to
    // fail here than to keep checking the view against a stale expectation.
    expect(TRIAL_TS).toContain('admin → active subscription → charity grant → trial → free')
  })

  it('the view carries all four arms, in resolveTier order', () => {
    const admin = tierCase.indexOf('is_admin')
    const sub   = tierCase.indexOf('sub.status')
    const grant = tierCase.indexOf('g.expires_at')
    const trial = tierCase.indexOf('trial_started_at')
    expect(admin, 'admin arm missing').toBeGreaterThan(-1)
    expect(sub,   'subscription arm missing').toBeGreaterThan(-1)
    expect(grant, 'CHARITY GRANT arm missing — this is the defect GTM-CHARITY-05 fixed').toBeGreaterThan(-1)
    expect(trial, 'trial arm missing').toBeGreaterThan(-1)
    expect(admin).toBeLessThan(sub)
    expect(sub).toBeLessThan(grant)   // a runner who later pays is resolved by the subscription
    expect(grant).toBeLessThan(trial) // a comped runner is not a lapsed trial
  })

  it('the grant arm tests expiry, not merely the presence of a claimed code', () => {
    // `isGrantActive` in lib/charity/grantWindow.ts is `expiresAt > now`. A
    // view that keyed off `claimed_by IS NOT NULL` would report a LAPSED grant
    // as current, which is the same class of error in the other direction.
    expect(tierCase).toMatch(/g\.expires_at\s*>\s*now\(\)/)
  })

  it('the view exposes the grant so a comped runner is legible as comped', () => {
    // `resolveTier` returns a `reason` for exactly this: a lapsed trial and a
    // lapsed grant both resolve to `free`, so the tier alone cannot answer
    // "what do we say when it ends?" (TIER-OWNER-01).
    expect(sql).toContain('AS grant_expires')
    expect(sql).toContain('AS grant_partner')
  })

  it('stays off the client — it exposes email and name', () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.admin_user_tiers FROM anon, authenticated/)
  })
})
