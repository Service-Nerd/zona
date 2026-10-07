import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { ID_COLUMN_TYPES, TABLE_COLUMNS } from './tableColumns'

// COMPLETION-CLAIM-UUID-01 (2026-10-07) — SQL in a migration is code, and nothing
// type-checked it.
//
// `claim_session_completion` declared `inserted_id bigint` and ended
// `returning id into inserted_id`. `session_completions.id` is a **uuid**. The
// INSERT succeeded, the assignment threw, the transaction rolled back, so the
// function could never return true — and **no auto-link wrote a completion for any
// user from 2026-09-24 until it was found on 2026-10-07.**
//
// ⚠️ IT SHIPPED PAST 4,478 GREEN TESTS BECAUSE THE SUITE HAS NO POSTGRES. That is
// not fixable here: `vitest.config.ts` is `environment: 'node'` and a test needing
// live credentials would not run in CI, which this repo has twice recorded as
// equivalent to having no check. So the check is STATIC — it reads the migration
// text and compares it against the committed schema snapshot.
//
// ⚠️ WHAT THIS DOES NOT PROVE: that the snapshot matches the live database. If a
// column's type changes in production and nobody refreshes `ID_COLUMN_TYPES`, this
// goes green on a stale truth. That is the same limitation `TABLE_COLUMNS` carries
// and it is stated rather than solved.

// ⚠️ `Array.from(x.matchAll(...))`, never `[...x.matchAll(...)]` — spreading an
// iterator fails this repo's tsc target. Same family as CLAUDE.md's documented
// `[...seen]`-on-a-Set gotcha, which I hit earlier in this same session.
const DIR = join(process.cwd(), 'supabase/migrations')
const FILES = readdirSync(DIR).filter(f => f.endsWith('.sql')).sort()

/**
 * 🔴 STRIP COMMENTS BEFORE PARSING. The first version of this check grepped the raw
 * file, and the very first thing it failed on was THE COMMENT IN THE FIX ITSELF —
 * `20261007_claim_completion_uuid.sql` quotes `returning id into inserted_id` in its
 * header to explain the defect, so the parse matched prose with no preceding insert.
 * This repo has recorded the identical class twice: the pre-commit hook blocked a
 * hex inside a comment (`HOOK-RGBA-COMMENTS-01`), and an ownership arm went red on
 * its own comment earlier TODAY. A comment is prose, not code.
 *
 * Line structure is preserved so error messages stay honest about position.
 */
function stripSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))   // block comments
    .replace(/--[^\n]*/g, m => ' '.repeat(m.length))                 // line comments
}

/**
 * The authoritative definition of a function is the LATEST migration that defines
 * it, because `create or replace` supersedes every earlier one. Without this the
 * check fires forever on `20260924`'s `bigint`, which is history and correctly
 * still in the repo — and a check that fires on settled history gets switched off,
 * which this repo records as equivalent to having no check.
 */
function supersededFunctionFiles(): Set<string> {
  const latest = new Map<string, string>()   // function name -> newest file
  for (const file of FILES) {
    const sql = stripSql(readFileSync(join(DIR, file), 'utf8'))
    for (const m of Array.from(sql.matchAll(/create\s+or\s+replace\s+function\s+(?:public\.)?([a-z_]+)/gi))) {
      latest.set(m[1], file)                 // FILES is sorted, so the last wins
    }
  }
  const authoritative = new Set(latest.values())
  const superseded = new Set<string>()
  for (const file of FILES) {
    const sql = stripSql(readFileSync(join(DIR, file), 'utf8'))
    const defines = Array.from(sql.matchAll(/create\s+or\s+replace\s+function\s+(?:public\.)?([a-z_]+)/gi))
    if (defines.length && !authoritative.has(file)) superseded.add(file)
  }
  return superseded
}

const SUPERSEDED = supersededFunctionFiles()

/** `returning <col> into <var>` — the assignment that broke. */
const RETURNING_INTO = /returning\s+([a-z_]+)\s+into\s+([a-z_]+)/gi
/** `insert into public.<table> (` or `insert into <table> (` */
const INSERT_INTO = /insert\s+into\s+(?:public\.)?([a-z_]+)\s+(?:as\s+[a-z_]+\s+)?\(([^)]*)\)/gi

interface Finding { file: string; column: string; variable: string; declared?: string; table?: string }

/** Every `returning … into …` across every migration, with its declared type and target table. */
function returningIntoSites(): Finding[] {
  const out: Finding[] = []
  for (const file of FILES) {
    if (SUPERSEDED.has(file)) continue
    const sql = stripSql(readFileSync(join(DIR, file), 'utf8'))
    for (const m of Array.from(sql.matchAll(RETURNING_INTO))) {
      const [, column, variable] = m
      // The declaration: `declare <variable> <type>;`
      const decl = new RegExp(`declare\\s+${variable}\\s+([a-z_]+)\\s*;`, 'i').exec(sql)
      // The table is the nearest preceding `insert into`, bounded to this statement.
      const before = sql.slice(0, m.index)
      const inserts = Array.from(before.matchAll(INSERT_INTO))
      out.push({
        file, column, variable,
        declared: decl?.[1]?.toLowerCase(),
        table: inserts.length ? inserts[inserts.length - 1][1] : undefined,
      })
    }
  }
  return out
}

describe('COMPLETION-CLAIM-UUID-01 — a plpgsql variable must match the column it receives', () => {
  const sites = returningIntoSites()

  // ⚠️ POPULATION ARM FIRST. An empty population passes every other arm in this
  // file, and this repo has shipped exactly that more than once. If the regexes
  // stop matching (a migration is reformatted, `returning` wraps a line) the
  // check must FAIL rather than quietly reporting on nothing.
  it('finds the `returning … into …` sites and does not silently report on none', () => {
    expect(FILES.length).toBeGreaterThan(20)
    expect(sites.length).toBeGreaterThan(0)
    // The supersede resolution must actually have resolved something: 20260924 is
    // replaced by 20261007, so exactly that file should be excluded.
    expect(SUPERSEDED.has('20260924_claim_completion_no_log.sql')).toBe(true)
    expect(SUPERSEDED.has('20261007_claim_completion_uuid.sql')).toBe(false)
    // Every site resolved a declaration and a table, or the parse is wrong.
    for (const s of sites) {
      expect(s.declared, `${s.file}: no \`declare ${s.variable} <type>;\` found`).toBeDefined()
      expect(s.table, `${s.file}: could not resolve the insert target for ${s.variable}`).toBeDefined()
    }
  })

  it('every declared type matches the snapshotted column type', () => {
    for (const s of sites) {
      if (s.column !== 'id') continue   // only `id` is snapshotted; see ID_COLUMN_TYPES
      const expected = ID_COLUMN_TYPES[s.table!]
      expect(expected, `${s.table} is not in ID_COLUMN_TYPES — snapshot it`).toBeDefined()
      expect(
        s.declared,
        `${s.file}: \`declare ${s.variable} ${s.declared}\` receives ${s.table}.${s.column}, which is ${expected}. ` +
        `This is COMPLETION-CLAIM-UUID-01: the insert succeeds, the assignment throws, the transaction rolls back, ` +
        `and the function silently never succeeds.`,
      ).toBe(expected)
    }
  })

  it('every column a migration INSERTs into actually exists', () => {
    // Same class as SELECT-COLUMN-GATE-01, on the write side rather than the read.
    let checked = 0
    for (const file of FILES) {
      const sql = stripSql(readFileSync(join(DIR, file), 'utf8'))
      for (const m of Array.from(sql.matchAll(INSERT_INTO))) {
        const table = m[1]
        const known = TABLE_COLUMNS[table]
        if (!known) continue   // not every insert target is a snapshotted public table
        for (const raw of m[2].split(',')) {
          const col = raw.trim().replace(/"/g, '')
          if (!col || col.includes(' ')) continue
          checked++
          expect(known, `${file}: insert into ${table} names "${col}", which is not in TABLE_COLUMNS`).toContain(col)
        }
      }
    }
    expect(checked, 'no insert columns were checked — the parse is broken').toBeGreaterThan(0)
  })

  it('the snapshot itself is not uniformly uuid, so it is doing real work', () => {
    // If every value were 'uuid' this gate would be indistinguishable from a
    // hardcoded assumption. session_guidance is bigint; session_catalogue is text.
    expect(new Set(Object.values(ID_COLUMN_TYPES)).size).toBeGreaterThan(1)
    expect(ID_COLUMN_TYPES.session_guidance).toBe('bigint')
    expect(ID_COLUMN_TYPES.session_completions).toBe('uuid')
  })
})
