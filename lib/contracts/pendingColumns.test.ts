import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { PENDING_COLUMNS, TABLE_COLUMNS } from './tableColumns'

/**
 * SELECT-COLUMN-GATE-01 follow-on — a declared-pending column must not outlive its migration.
 *
 * 🔴 WHY THIS EXISTS. `tableColumns.ts` is a snapshot of what the database ACTUALLY has, and a
 * column listed there but not live is the direction that ships a silent query. Sometimes that is
 * unavoidable: production DDL cannot be applied from the sandbox, so code and schema land in
 * different hands. `PENDING_COLUMNS` makes that window DECLARED instead of invisible.
 *
 * ⚠️ The declaration is the risk, so it is the thing that is gated: once the migration appears
 * in the applied ledger, the entry must go. "Refresh the snapshot" otherwise depends on someone
 * remembering, and this repo has recorded what that is worth.
 */
const LEDGER = '.claude/state/applied-migrations.txt'

describe('pending columns are declared, and do not outlive their migration', () => {
  it('every pending column is actually IN the snapshot it is pending for', () => {
    // An entry naming a column nobody listed is a note, not a declaration.
    for (const p of PENDING_COLUMNS) {
      const cols = (TABLE_COLUMNS as Record<string, readonly string[]>)[p.table]
      expect(cols, `${p.table} is not a known table`).toBeTruthy()
      expect(cols, `${p.table}.${p.column} is declared pending but is not in TABLE_COLUMNS`)
        .toContain(p.column)
    }
  })

  it('every pending column names a migration file that exists', () => {
    for (const p of PENDING_COLUMNS) {
      expect(existsSync(`supabase/migrations/${p.migration}`),
        `${p.column} names a migration that does not exist: ${p.migration}`).toBe(true)
    }
  })

  it('🔴 a pending entry is REMOVED once its migration is applied', () => {
    if (!existsSync(LEDGER)) return
    const applied = readFileSync(LEDGER, 'utf8')
    const stale = PENDING_COLUMNS.filter(p => applied.includes(p.migration))
    expect(stale.map(p => `${p.table}.${p.column} (${p.migration})`),
      'these migrations are applied, so the columns are LIVE and the pending entry is now a lie — '
      + 'delete it').toEqual([])
  })

  it('the list is short, because every entry is a window where a select can fail', () => {
    // Not a style rule: each entry is a deploy-ordering constraint someone has to honour by
    // hand. If this is growing, migrations are not being applied.
    expect(PENDING_COLUMNS.length).toBeLessThan(8)
  })
})
