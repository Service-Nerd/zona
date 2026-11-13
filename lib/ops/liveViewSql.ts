import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Which migration currently defines a view, and its SQL.
 *
 * 🔴 EXTRACTED BECAUSE A PINNED PATH IS A GATE THAT STOPS LOOKING (OPS-TRIAL-SQL-CLOCK-01).
 * `activationFunnel.test.ts` read a hardcoded `20261111c_activation_funnel.sql`, so the moment a
 * later migration redefined the view the gate went on validating a SUPERSEDED definition and
 * stayed green. `adminViewTierParity.test.ts` had already solved this by scanning; the solution
 * existed one file away and was not shared, which is how the pinned copy survived.
 *
 * ⚠️ CASE-INSENSITIVE, and that is not cosmetic: a case-SENSITIVE
 * `includes('VIEW public.admin_user_tiers')` once let a lowercase `create or replace view`
 * escape the population entirely. **Match the effect, not the spelling.**
 */
const MIGRATIONS = join(process.cwd(), 'supabase/migrations')

export function migrationsDefining(view: string): string[] {
  const re = new RegExp(`VIEW\\s+public\\.${view}\\b`, 'i')
  return readdirSync(MIGRATIONS)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .filter(f => re.test(readFileSync(join(MIGRATIONS, f), 'utf8')))
}

/** The newest migration that defines `view` is the one in force. Throws if none does. */
export function liveViewSql(view: string): string {
  const files = migrationsDefining(view)
  if (files.length === 0) throw new Error(`no migration defines ${view} — this check has stopped looking`)
  return readFileSync(join(MIGRATIONS, files[files.length - 1]!), 'utf8')
}

/**
 * Just the `create view` statement for `view`, not the whole file.
 *
 * 🔴 THE WHOLE FILE IS THE WRONG POPULATION, measured the moment this was extracted: the
 * migration that introduced it defines a function and two views, so file-level assertions saw
 * `is_admin` from a sibling view and the window constants from the function, and three arms
 * failed on text that is not the view's. The pinned path this replaced was only ever safe
 * because its file happened to hold one statement.
 * ⚠️ A view body here contains no `;`, so the statement ends at the first line-terminating one.
 */
export function liveViewStatement(view: string): string {
  const sql = liveViewSql(view)
  const re = new RegExp(`create\\s+(?:or\\s+replace\\s+)?view\\s+public\\.${view}\\b`, 'i')
  const m = re.exec(sql)
  if (!m) throw new Error(`no create statement for ${view} in its own migration`)
  const rest = sql.slice(m.index)
  const lines = rest.split('\n')
  const endIdx = lines.findIndex(l => l.trimEnd().endsWith(';'))
  if (endIdx < 0) throw new Error(`unterminated create statement for ${view}`)
  return lines.slice(0, endIdx + 1).join('\n')
}

/** Whole-line `--` comments blanked, line structure kept, so an assertion cannot pass on prose. */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*--[^\n]*$/gm, ' ')
}
