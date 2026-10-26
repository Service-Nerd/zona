// MIGRATION-GRANTS-01 (2026-10-26). Supabase stops auto-granting Data API access to NEW tables in `public` on
// 2026-10-30. A table created after that is unreachable through supabase-js / PostgREST until it is granted, and
// the failure arrives as an error OBJECT, which most call sites here do not read: a new feature would look empty,
// not broken. Before this, 0 of 28 table-creating migrations carried a single GRANT (the auto-grant did it).
//
// Rule: a migration dated 2026-10-30 or later that creates a table in `public` grants it, in the same file, to
// `authenticated` and `service_role`. `anon` is a choice per table (most tables here are never read signed-out), so
// it is not required. RLS still decides which ROWS; the grant decides whether the table is reachable at all.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const GRANT_CUTOFF = '20261030'
export const REQUIRED_ROLES = ['authenticated', 'service_role'] as const

const strip = (sql: string) => sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

/** Tables in `public` created by this SQL that lack a grant to a required role. */
export function ungrantedTables(sql: string): string[] {
  const code = strip(sql)
  const created = Array.from(code.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?(\w+)"?/gi))
    .map(m => m[1].toLowerCase())
  const missing: string[] = []
  for (const t of created) {
    for (const role of REQUIRED_ROLES) {
      const re = new RegExp(`grant\\s+[\\w\\s,]+\\s+on\\s+(?:table\\s+)?(?:"?public"?\\.)?"?${t}"?\\s+to\\s+[\\w\\s,]*\\b${role}\\b`, 'i')
      if (!re.test(code)) missing.push(`${t} → ${role}`)
    }
  }
  return missing
}

const dir = join(process.cwd(), 'supabase/migrations')
const files = readdirSync(dir).filter(f => f.endsWith('.sql'))

describe('MIGRATION-GRANTS-01 — a new table is granted in the migration that creates it', () => {
  it('the population is derived and every file is dated, so the cutoff can apply', () => {
    expect(files.length).toBeGreaterThan(50)
    expect(files.filter(f => !/^\d{8}/.test(f))).toEqual([])
  })
  it('🔴 every migration on or after the cutoff grants each table it creates', () => {
    const bad = files.filter(f => f.slice(0, 8) >= GRANT_CUTOFF)
      .flatMap(f => ungrantedTables(readFileSync(join(dir, f), 'utf8')).map(m => `${f}: ${m}`))
    expect(bad).toEqual([])
  })
  it('the detector: ungranted, partly granted, fully granted, and a grant only in a comment', () => {
    expect(ungrantedTables('create table public.foo (id uuid);')).toEqual(['foo → authenticated', 'foo → service_role'])
    expect(ungrantedTables('CREATE TABLE IF NOT EXISTS foo (id uuid);\ngrant select on public.foo to authenticated;'))
      .toEqual(['foo → service_role'])
    expect(ungrantedTables(`create table public.foo (id uuid);
      grant select, insert, update, delete on public.foo to authenticated;
      grant select, insert, update, delete on table public.foo to service_role;`)).toEqual([])
    expect(ungrantedTables('create table foo (id uuid);\n-- grant all on foo to authenticated, service_role;'))
      .toHaveLength(2)
    expect(ungrantedTables('create table foo (id uuid); grant all on foo to authenticated, service_role;')).toEqual([])
  })
})
