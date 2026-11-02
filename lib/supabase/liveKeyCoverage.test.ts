/**
 * CHECK-DB-LIVE-KEY-ARM-01 — every week-keyed table whose uniqueness is keyed on `week_n`
 * must have a PARTIAL unique index scoped to the live plan, and must have shed its plain one.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────────────────
 * The five `%_live_key` partial indexes ARE the write side of PLAN-WEEK-COLLISION-01. With
 * them, a new plan's week-1 row inserts beside its superseded history; without them, or with
 * one rebuilt minus its `WHERE superseded_at IS NULL`, every week-keyed write silently lands
 * on a tombstone again. That defect took weeks to notice twice —
 * COMPLETION-TOMBSTONE-01 (2026-09-23) and WEEKLY-REPORT-SUPERSEDED-WRITE-01 (2026-11-02) —
 * and in both cases the write succeeded, every read excluded the row, and nothing errored.
 *
 * 🔴 **AND `check:db` COULD NOT SEE ANY OF IT.** `scripts/check-db-drift.ts` prints
 * *"No SQL RPC available; falling back to a per-table probe"*: there is no `exec_sql`, the
 * only credentials in `.env.local` are PostgREST's, and `pg` is not a dependency — so it
 * reads tables, policies, `week_n` coverage and FK delete rules, and **nothing about keys**.
 * Worse, `check:db` is referenced by nothing but its own `package.json` line: not `verify`,
 * not `verify:ci`, not any of the ten workflows. It is a check that runs when somebody types
 * it, which is this repo's own definition of not a check.
 *
 * ⚠️ **WHAT THIS FILE DOES AND DOES NOT PROVE — read this before trusting it green.**
 * It reads the MIGRATIONS, so it proves the repo's *intent* is complete and consistent. It
 * **cannot** see production: an index dropped by hand in the Supabase dashboard leaves this
 * test passing. That half needs the live arm in `check:db` (and a `schema_unique_keys()` RPC
 * for it to call) and something that runs it. Filed: `CHECK-DB-LIVE-KEY-CRON-01`.
 *
 * What it does catch, and what the two incidents actually were: a week-keyed table added
 * with no live key, and a live key created without its predicate.
 *
 * ⚠️ **THE POPULATION AND THE EXEMPTIONS ARE BOTH DERIVED.** `WEEK_KEYED_TABLES` being
 * hand-written is precisely how `weekly_reports` came to be missed from it in the first
 * place, so a second hand-written list here — especially an exemption list — would rebuild
 * the hole. A table needs a live key **iff** it carries `superseded_at` AND some migration
 * declares week_n-keyed uniqueness for it. `run_analysis` (unique on the activity uuid, which
 * is globally unique per user) and `plan_adjustments` (no unique, insert-only) fall out as
 * exempt by that rule rather than by anyone's say-so.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { WEEK_KEYED_TABLES } from '@/lib/plan/supersede'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations')

const migrationSql = (): string =>
  readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
    .toLowerCase()

const SQL = migrationSql()

/**
 * The body of a table's own `create table (…)`, or null.
 *
 * ⚠️ BOUNDED ON THE STATEMENT, NEVER GREPPED ACROSS THE FILE — and the first cut of this
 * file got it wrong, which is why the comment is here. `create table[\s\S]*?<table>[\s\S]*?
 * unique\(…week_n…\)` run over the concatenated migrations matched a `create table` in one
 * file, the table name in another and a `unique(week_n)` in a third, so `run_analysis` and
 * `plan_adjustments` were both pulled in as needing a live key. CLAUDE.md records this class
 * four times over ("bound the region, never grep the file"); it reappears the moment you
 * concatenate sources.
 */
function createTableBody(table: string): string | null {
  const head = new RegExp(`create table\\s+(?:if not exists\\s+)?(?:public\\.)?${table}\\s*\\(`, 'i')
  const m = head.exec(SQL)
  if (!m) return null
  let depth = 0
  const start = m.index + m[0].length
  for (let i = start - 1; i < SQL.length; i++) {
    if (SQL[i] === '(') depth++
    else if (SQL[i] === ')') { depth--; if (depth === 0) return SQL.slice(start, i) }
  }
  return null
}

/** Does this table declare a plain UNIQUE keyed on `week_n` in its own CREATE TABLE? */
function declaresPlainWeekUnique(table: string): boolean {
  const body = createTableBody(table)
  if (!body) return false
  return /unique\s*\([^)]*week_n[^)]*\)/i.test(body)
}

/** Did a migration drop such a constraint for this table? (Anchored on the table NAME, which
 *  is a name and so is anchored rather than searched — the same rule as above.) */
function dropsPlainWeekUnique(table: string): boolean {
  return new RegExp(`drop constraint if exists\\s+${table}_[a-z_]*week_n[a-z_]*_key`, 'i').test(SQL)
}

/** Needs a live key iff it carries `superseded_at` AND its uniqueness is keyed on `week_n` —
 *  either still declared, or declared once and since dropped by this very family. */
function hasWeekKeyedUniqueness(table: string): boolean {
  return declaresPlainWeekUnique(table) || dropsPlainWeekUnique(table)
}

/** Does a migration create a `<table>_live_key` index at all? */
function hasLiveKeyIndex(table: string): boolean {
  return new RegExp(`create unique index(?: if not exists)?\\s+${table}_live_key`, 'i').test(SQL)
}

/**
 * Three buckets, not two — and the middle one is why.
 *
 * `session_overrides` carries a live key but never carried a plain constraint: its migration
 * says "one live row per (user, week, original day) has been a CONVENTION, kept by the client
 * deleting before it inserts". Forcing it into REQUIRED on a premise that is false of it would
 * be inventing a reason to make a check pass. Its index still has to keep its predicate, which
 * is what MUST_KEEP covers.
 *
 * ⚠️ `session_completions` has no `create table` in this directory (it predates it), so only
 * the dropped-constraint evidence places it. That is enough and it is stated rather than
 * silently relied on.
 */
const REQUIRE_LIVE_KEY = WEEK_KEYED_TABLES.filter(hasWeekKeyedUniqueness)
const MUST_KEEP_PREDICATE = WEEK_KEYED_TABLES.filter(hasLiveKeyIndex)

describe('CHECK-DB-LIVE-KEY-ARM-01 — the population is derived', () => {
  it('every table whose uniqueness is week_n-keyed is required to have a live key', () => {
    // 4 as of 2026-11-02: session_completions, session_metric_overrides, session_reflections,
    // weekly_reports. A fifth table arriving with a week_n UNIQUE lands here automatically.
    expect(REQUIRE_LIVE_KEY.length).toBeGreaterThanOrEqual(4)
    for (const t of REQUIRE_LIVE_KEY) {
      expect(hasLiveKeyIndex(t), `${t} has week_n-keyed uniqueness and NO ${t}_live_key index`).toBe(true)
    }
  })

  it('the set of live keys has not shrunk', () => {
    // 5 as of 2026-11-02 — the four above plus session_overrides. This is the arm that fires
    // if an index migration is deleted, which the per-table arms below cannot see: they
    // iterate the surviving set, so a removal makes them quieter rather than redder.
    expect(MUST_KEEP_PREDICATE.length).toBeGreaterThanOrEqual(5)
  })

  it('exempts only tables whose uniqueness is NOT keyed on week_n', () => {
    const exempt = WEEK_KEYED_TABLES.filter(t => !REQUIRE_LIVE_KEY.includes(t) && !hasLiveKeyIndex(t))
    // Not an exemption list — an assertion about WHY each one is out of scope. run_analysis is
    // unique on the activity uuid (globally unique per user, so no cross-plan collision);
    // plan_adjustments declares no uniqueness and is insert-only.
    expect(exempt.length).toBeGreaterThan(0)
    for (const t of exempt) {
      expect(hasWeekKeyedUniqueness(t), `${t} is exempt but DOES have week_n-keyed uniqueness`).toBe(false)
    }
  })
})

/**
 * Every unique INDEX the migrations declare, in apply order, with later drops applied.
 *
 * 🔴 WHY NOT `%_live_key`. The first cut of this file matched on that NAME, and within the
 * hour `20261104_live_week_keys_survivors.sql` created `run_analysis_manual_live_uniq` — a
 * week_n-keyed unique index that the check was structurally blind to, because it is not
 * called `_live_key`. A check keyed on a NAME guards the names it knows; the property is
 * "week_n-keyed and unique", so that is what this reads. Same class as the three
 * `label.includes('pace')` instances and `isVo2max`-by-category: anchor on the property.
 *
 * ⚠️ DROPS ARE APPLIED. `run_analysis_manual_uniq` was created by an earlier migration and
 * dropped by a later one; scanning without replaying the drops would flag it forever, which
 * is a check that is wrong about the present in order to be thorough about the past.
 */
function declaredUniqueIndexes(): Map<string, { table: string; cols: string; predicate: string | null }> {
  const live = new Map<string, { table: string; cols: string; predicate: string | null }>()
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()
  const create = /create\s+unique\s+index\s+(?:if not exists\s+)?([a-z0-9_]+)\s+on\s+(?:public\.)?([a-z0-9_]+)\s*\(([^)]*)\)([^;]*)/gi
  const drop   = /drop\s+index\s+(?:if exists\s+)?(?:public\.)?([a-z0-9_]+)/gi
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8').toLowerCase()
    for (const m of Array.from(sql.matchAll(create))) {
      const where = /where\s+([\s\S]*)$/i.exec(m[4] ?? '')
      live.set(m[1], { table: m[2], cols: m[3].replace(/\s+/g, ''), predicate: where ? where[1].trim() : null })
    }
    for (const m of Array.from(sql.matchAll(drop))) live.delete(m[1])
  }
  return live
}

/** Week_n-keyed unique indexes on a table that carries `superseded_at`. Derived, not named. */
// Array.from, not a spread — CLAUDE.md § TypeScript: this tsconfig's target cannot iterate
// a Map or a matchAll result directly. The rule was already written down; I ignored it and
// tsc caught it, which is the one place a house convention is cheap to enforce.
const WEEK_KEYED_UNIQUE_INDEXES = Array.from(declaredUniqueIndexes())
  .filter(([, v]) => v.cols.split(',').includes('week_n'))
  .filter(([, v]) => (WEEK_KEYED_TABLES as readonly string[]).includes(v.table))

describe('CHECK-DB-LIVE-KEY-ARM-01 — every week_n-keyed unique index is live-scoped', () => {
  it('finds them by their COLUMNS, not by a name convention', () => {
    // 6 as of 2026-11-02: the five %_live_key indexes plus run_analysis_manual_live_uniq.
    // An index added under any name lands here the moment its columns include week_n.
    expect(WEEK_KEYED_UNIQUE_INDEXES.length).toBeGreaterThanOrEqual(6)
    // And the one that proves the name coupling is gone.
    expect(WEEK_KEYED_UNIQUE_INDEXES.map(([n]) => n)).toContain('run_analysis_manual_live_uniq')
  })

  for (const [name, v] of WEEK_KEYED_UNIQUE_INDEXES) {
    it(`${name} is partial on superseded_at IS NULL`, () => {
      expect(
        v.predicate && /superseded_at\s+is\s+null/i.test(v.predicate),
        `${name} on ${v.table}(${v.cols}) has predicate ${v.predicate ?? 'NONE'} — a week_n-keyed unique that is not live-scoped means a new plan's row cannot insert beside its superseded history`,
      ).toBeTruthy()
    })
  }

  for (const table of REQUIRE_LIVE_KEY) {
    it(`${table} has shed any plain unique constraint on week_n`, () => {
      if (!declaresPlainWeekUnique(table)) return
      expect(dropsPlainWeekUnique(table), `${table} still declares a plain UNIQUE on week_n and no migration drops it — the partial index alone does not help while the key is still occupied`).toBe(true)
    })
  }
})
