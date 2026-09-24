/**
 * GATE-FALSIFY-01 (d) — `npm run distinguish`.
 *
 * 🔴 THE INCIDENT IT EXISTS FOR, 2026-09-24. A migration could not be applied
 * from here, so the founder was handed a query to prove it had landed:
 * `pg_get_functiondef(...) like '%charity_codes%'`, false = applied. It returned
 * `true` and a GOOD migration was nearly declared failed — the replacement
 * function names `charity_codes` three times in its own explanatory comments, so
 * the predicate says `true` in BOTH states. The check was reading the explanation
 * of the fix and reporting it as the bug.
 *
 * ⚠️ Two other hollow checks the same day were caught by mutation. This one could
 * not be, because it ran on someone else's machine. **A verification step handed
 * to a human is untested code.**
 */
import { describe, it, expect } from 'vitest'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runPredicate, discriminates } from '@/scripts/distinguish'

function pair(before: string, after: string): [string, string] {
  const d = mkdtempSync(join(tmpdir(), 'distinguish-'))
  const a = join(d, 'before.txt'), b = join(d, 'after.txt')
  writeFileSync(a, before); writeFileSync(b, after)
  return [a, b]
}

const BOOL = "grep -q charity_codes {} && echo true || echo false"

describe('distinguish — can this predicate tell the two states apart?', () => {
  it('REPRODUCES THE INCIDENT: a word that survives in the new file\'s own comments', () => {
    // Exactly the shape of the two real migrations: the old one UPDATES the
    // table, the new one only NAMES it while explaining why it no longer does.
    const [a, b] = pair(
      'update public.charity_codes set claimed_at = null where claimed_by = old.id;',
      '-- charity_codes.claimed_at is DELIBERATELY NOT CLEARED HERE (see the ruling)',
    )
    const x = runPredicate(BOOL, a), y = runPredicate(BOOL, b)
    expect(x.stdout).toBe('true')
    expect(y.stdout).toBe('true')     // ← the false positive, reproduced
    expect(discriminates(x, y)).toBe(false)
  })

  it('the CORRECTED predicate — matching the statement, not the word — discriminates', () => {
    const [a, b] = pair(
      'update public.charity_codes set claimed_at = null where claimed_by = old.id;',
      '-- charity_codes.claimed_at is DELIBERATELY NOT CLEARED HERE (see the ruling)',
    )
    const p = "grep -qE 'update[[:space:]]+public\\.charity_codes' {} && echo true || echo false"
    expect(discriminates(runPredicate(p, a), runPredicate(p, b))).toBe(true)
  })

  it('a COUNT can look fine while the BOOLEAN it stands in for does not', () => {
    // The tool's real work: express the predicate as the boolean it will actually
    // be evaluated as. Counting discriminates here; the boolean does not — and the
    // SQL predicate was a boolean.
    const [a, b] = pair('charity_codes\ncharity_codes', 'charity_codes')
    expect(discriminates(runPredicate('grep -c charity_codes {}', a),
                         runPredicate('grep -c charity_codes {}', b))).toBe(true)
    expect(discriminates(runPredicate(BOOL, a), runPredicate(BOOL, b))).toBe(false)
  })

  it('compares EXIT STATUS as well as stdout — a silent predicate still discriminates', () => {
    const [a, b] = pair('present', 'absent')
    const p = 'grep -q present {}'          // no stdout either way; only the status differs
    const x = runPredicate(p, a), y = runPredicate(p, b)
    expect(x.stdout).toBe('')
    expect(y.stdout).toBe('')
    expect(discriminates(x, y)).toBe(true)
  })

  it('identical files can never be distinguished, whatever the predicate', () => {
    const [a, b] = pair('same', 'same')
    expect(discriminates(runPredicate(BOOL, a), runPredicate(BOOL, b))).toBe(false)
    expect(discriminates(runPredicate('wc -c < {}', a), runPredicate('wc -c < {}', b))).toBe(false)
  })

  it('a failing predicate does not throw — it is an outcome to compare, not an error', () => {
    const [a] = pair('x', 'x')
    // `{}` is required when the predicate is not a plain command + path — without
    // it the file is appended, and `exit 3 <file>` is a usage error, not exit 3.
    expect(() => runPredicate('cat {} > /dev/null; exit 3', a)).not.toThrow()
    expect(runPredicate('cat {} > /dev/null; exit 3', a).code).toBe(3)
  })
})
