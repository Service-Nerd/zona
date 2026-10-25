// ACCOUNT-DELETED-TRACE-01 (2026-10-25). A charity runner redeemed, built plans, and vanished from the ops digest:
// every one of their events had user_id NULL (ops_events is SET NULL on delete), and nothing recorded the deletion,
// so "deleted their account" read exactly like "never signed up". The route now leaves one anonymous row.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const route = readFileSync(join(process.cwd(), 'app/api/delete-account/route.ts'), 'utf8')
const code = route.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

describe('ACCOUNT-DELETED-TRACE-01 — a deletion leaves a trace', () => {
  it('records account_deleted AFTER the delete succeeds, never before it', () => {
    const del = code.indexOf('deleteUser(')
    const err = code.indexOf('if (error)', del)
    const rec = code.indexOf("recordOpsEvent('account_deleted'")
    expect(del).toBeGreaterThan(-1)
    expect(rec).toBeGreaterThan(err)
  })
  it('the row carries no user id, so the cascade cannot erase it and it holds nothing personal', () => {
    const rec = code.slice(code.indexOf("recordOpsEvent('account_deleted'"))
    expect(rec.slice(0, rec.indexOf('return'))).toMatch(/\},\s*null\)/)
  })
  it('account_deleted is a declared ops event kind', () => {
    expect(readFileSync(join(process.cwd(), 'lib/ops/recordOpsEvent.ts'), 'utf8')).toMatch(/'account_deleted'/)
  })
})
