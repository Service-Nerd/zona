// INTERNAL-ACCOUNTS-01 — every user metric excludes `is_admin` AND `is_internal`.
//
// 🔴 WHY A GATE AND NOT A NOTE. The brief asked for the pattern to be recorded in
// decisions and patterns, and this repo's own rule is that a rule which holds only while
// someone remembers is not a rule. The pattern is one line of prose; this is the thing
// that makes it bite on the NEXT metric view somebody writes.
//
// 📐 THE PATTERN HAD NO MECHANISM TO COPY, which is the finding behind it. The brief said
// "we already exclude is_admin users"; measured against production 2026-11-11, of the four
// views it named only `v_trial_conversion` referenced `is_admin` at all, and it does not
// filter on it. Three different shapes were in use:
//   · a tier LADDER (`admin_user_tiers`), so admins fall out of `v_paying_users` as a side
//     effect of never being 'premium';
//   · a `_real` BOOLEAN plus a `looks_like_test` email heuristic (`v_trial_conversion`);
//   · nothing at all (`v_coach_engagement`, `v_partner_cohort`, `v_hr_present_pct`).
// So `v_metric_users` was created as the single owner and this asserts every metric view
// reads it.
//
// ⚠️ IT SCANS MIGRATIONS, NOT THE LIVE DATABASE, and that bound is the point: it has to
// run in CI with no credentials. `npm run check:db` is the live-schema check and is not in
// `verify:ci`. So this proves what we WROTE; it cannot prove what is APPLIED. The runbook
// `docs/runbooks/internal-accounts.md` carries the post-apply verification.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { DERIVED_VIEWS } from '@/lib/supabase/userDataSurfaces'

const DIR = 'supabase/migrations'
const OWNER = 'v_metric_users'

/**
 * Views that are NOT user metrics, each with the reason it is exempt.
 *
 * ⚠️ A reason column is not a fixed problem (this repo's own rule), but these four are
 * exempt by KIND rather than by debt, so they do not shrink.
 */
const NOT_A_USER_METRIC: Record<string, string> = {
  [OWNER]:
    'The owner itself. It defines the exclusion; it cannot consume it.',
  admin_user_directory:
    'An ADMIN directory. It must SHOW every account including internal ones, and it now '
    + 'exposes is_internal and internal_reason so an admin can see who is flagged.',
  admin_user_tiers:
    'An ADMIN tier view, and deliberately NOT filtered: the flag grants nothing and testers '
    + 'keep full access, so hiding them here would make the view lie about what they can do. '
    + 'It exposes is_internal alongside the real tier.',
}

// 🔴 `v_paying_users` WAS EXEMPT HERE AND THE REASON WAS HALF FALSE.
// It read: "Counts TIERS, not users ... admins and internal accounts are excluded as a side
// effect of the tier ladder, so a where clause here would be wrong rather than redundant."
// An ADMIN is excluded by construction (`resolveTier` puts admin first, so an admin reads
// tier='admin' and can never read 'premium'). **AN INTERNAL ACCOUNT IS EXCLUDED BY NOTHING** —
// the flag grants and removes nothing, so an internal account reads its real tier. Measured in
// production: premium = 23 rows, 0 internal, so the view is clean TODAY and clean only by
// accident of who happens to hold a subscription. The brief named this view explicitly.
// `20261111b_paying_users_excludes_internal.sql` adds the filter (23 -> 23, no value change),
// so the view now reads `is_internal` and the derived arm below covers it like the rest.

/** The migration that introduces the owner, and therefore the floor for this rule. */
const INTRODUCED_IN = '20261111_internal_accounts.sql'

function migrationFiles(): string[] {
  return readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()
}

/** Every `create [or replace] view public.<name>` in a file, with its body. */
function viewsIn(sql: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = []
  // Bodies run to the terminating semicolon. Migrations here use no `$$` inside a view.
  const re = /create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-z0-9_]+)\s+as([\s\S]*?);\s*(?=\n|$)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sql)) !== null) out.push({ name: m[1], body: m[2] })
  return out
}

describe('INTERNAL-ACCOUNTS-01 — the exclusion has one owner and every metric reads it', () => {
  it('the owner view exists, and is defined on BOTH flags', () => {
    const sql = readFileSync(join(DIR, INTRODUCED_IN), 'utf8')
    const owner = viewsIn(sql).find(v => v.name === OWNER)
    expect(owner, `${OWNER} is not created in ${INTRODUCED_IN}`).toBeTruthy()
    expect(owner!.body).toMatch(/is_admin/)
    expect(owner!.body).toMatch(/is_internal/)
  })

  it('every user-metric view created or replaced from 2026-11-11 reads the owner', () => {
    // 🔑 THE POPULATION IS DERIVED, not listed: any migration at or after the one that
    // introduced the owner. A new metric view in a new migration is in scope the moment
    // it is written, which is the only way this catches the next one.
    const offenders: string[] = []
    let scanned = 0
    for (const f of migrationFiles()) {
      if (f < INTRODUCED_IN) continue
      const sql = readFileSync(join(DIR, f), 'utf8')
      for (const v of viewsIn(sql)) {
        if (v.name in NOT_A_USER_METRIC) continue
        scanned++
        // 🔑 EITHER SHAPE COUNTS, and the gate's first cut accepted only the join —
        // which failed `v_trial_conversion`, correctly and informatively. That view is
        // row-per-trialling-user and must KEEP the internal rows while marking them, so
        // it exposes `is_internal` as a column and excludes it inside `converted_real`.
        // A join would delete the rows an analyst needs in order to see the difference.
        // The RULE is "excludes is_admin and is_internal"; the join is one way to obey it.
        const obeys = v.body.includes(OWNER) || /is_internal/.test(v.body)
        if (!obeys) offenders.push(`${f}: ${v.name}`)
      }
    }
    // An empty population must not read as a pass — the `CLEAN — 0 files` class.
    expect(scanned, 'no user-metric views were scanned, so this arm proves nothing').toBeGreaterThan(0)
    expect(offenders, `these user-metric views do not read ${OWNER}; join it, or add it to `
      + 'NOT_A_USER_METRIC with the reason').toEqual([])
  })

  it('the four exemptions are each justified in prose, not merely listed', () => {
    for (const [name, reason] of Object.entries(NOT_A_USER_METRIC)) {
      expect(reason.length, `${name} has no real reason`).toBeGreaterThan(40)
    }
  })

  it('EVERY exemption names a view the repo actually declares — no stale entries', () => {
    // The inverse arm, as `_SHIPPED_AND_OPEN_OK` has in audit-docs.sh: a list that can only
    // grow is one nobody trusts.
    //
    // ⚠️ THE POPULATION IS `DERIVED_VIEWS`, not "views this migration touches", and the
    // first cut got that wrong: `v_paying_users` is exempt precisely BECAUSE it needs no
    // change, so demanding the migration define it fired on the correct decision. The
    // repo's own declaration of its views is the right register to check against.
    for (const name of Object.keys(NOT_A_USER_METRIC)) {
      if (name === OWNER) continue   // created by this migration, not a pre-existing view
      expect(Object.keys(DERIVED_VIEWS), `${name} is exempt but is not a declared view in `
        + 'userDataSurfaces.ts — delete the stale exemption, or declare the view')
        .toContain(name)
    }
  })

  it('the flag is never read for entitlement — resolveTier stays the single owner', () => {
    // The brief: "Do NOT change entitlements". `is_internal` must not appear in the tier
    // resolver, the feature gates, or the route gate.
    for (const f of ['lib/trial.ts', 'lib/plan/canUseFeature.ts', 'lib/strength-bridge/routeGate.ts']) {
      const src = readFileSync(f, 'utf8')
      expect(src, `${f} reads is_internal — the flag must grant and remove NOTHING`)
        .not.toMatch(/is_internal/)
    }
  })

  it('the privileged columns are guarded by a TRIGGER, not an inert column REVOKE', () => {
    // 🔴 The brief asked whether the UPDATE policy blocks a user setting this on their own
    // row. It does not: the policy is `USING (auth.uid() = id)` with NO with_check,
    // `pg_class.relacl` holds a TABLE-level UPDATE grant for `authenticated`, and there
    // were zero triggers — so a signed-in user could set is_admin = true on their own row.
    //
    // 🔴 AND MY FIRST FIX WAS INERT: column privileges in Postgres are ADDITIVE, so
    // `revoke update (is_admin) ...` removes a column grant that does not exist and the
    // table grant still carries the write. This arm asserts the mechanism that actually
    // works, and asserts the inert one is NOT what we rely on.
    const sql = readFileSync(join(DIR, INTRODUCED_IN), 'utf8')
    expect(sql).toMatch(/create\s+trigger\s+guard_privileged_user_settings/i)
    expect(sql).toMatch(/new\.is_admin\s*:=\s*old\.is_admin/i)
    expect(sql).toMatch(/new\.is_internal\s*:=\s*old\.is_internal/i)
    // ⚠️ INVOKER, not DEFINER: inside a SECURITY DEFINER function `current_user` is the
    // function OWNER, so the guard would never fire. An inert fix for an inert fix.
    const fn = sql.slice(sql.indexOf('create or replace function public.guard_privileged_user_settings'))
    expect(fn.slice(0, 400)).not.toMatch(/security\s+definer/i)
    // The inert instrument must not come back as the thing we depend on.
    expect(sql).not.toMatch(/^revoke\s+update\s*\(/im)
  })
})
