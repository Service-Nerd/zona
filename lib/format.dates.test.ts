// DATE-OWNER-01 — `lib/format.ts` owns every date a runner reads.
//
// ADR-015 made this file the sole owner of "every time/distance/metric string".
// Dates were never brought under it. Measured 2026-09-23: **9 distinct formats
// across 22 hand-written sites, no owner, every one hardcoding `'en-GB'`**, plus
// **one raw ISO string shown to a runner** — `starts 2026-12-07`, on the screen
// where they commit to a plan.
//
// ⚠️ NOT A LOCALISATION FIX, AND THE SLT DECLINED TO MAKE IT ONE. **Not one
// format was ambiguous** — every one names its month, so `24 Apr 2027` reads
// correctly to an American, merely in an unfamiliar order. Fried: *"a new
// setting is permanent surface area — a preference, a migration, a Me-screen
// row and a branch in every call, to change WORD ORDER for people who can
// already read the date."* **No preference was built.**

import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { formatDate } from './format'

describe('formatDate — the owner', () => {
  const D = '2027-04-24'   // a Saturday

  it('renders each named style', () => {
    expect(formatDate(D, 'short')).toBe('24 Apr')
    expect(formatDate(D, 'medium')).toBe('24 Apr 2027')
    expect(formatDate(D, 'long')).toBe('24 April 2027')
    expect(formatDate(D, 'weekday-short')).toBe('Sat 24 Apr')
    expect(formatDate(D, 'weekday-long')).toBe('Saturday 24 April')
    expect(formatDate(D, 'weekday-only')).toBe('Sat')
  })

  it('defaults to `short`', () => {
    expect(formatDate(D)).toBe(formatDate(D, 'short'))
  })

  it('🔴 returns null rather than "Invalid Date" — the thing a bare toLocaleDateString renders', () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate(undefined)).toBeNull()
    expect(formatDate('not-a-date')).toBeNull()
    expect(formatDate('')).toBeNull()
    // The failure this replaces: `new Date('nope').toLocaleDateString()` is the
    // STRING "Invalid Date", which renders happily into a card.
    expect(new Date('nope').toLocaleDateString('en-GB')).toBe('Invalid Date')
  })

  it('takes a Date as readily as an ISO string', () => {
    expect(formatDate(new Date('2027-04-24T00:00:00Z'), 'medium')).toBe(formatDate(D, 'medium'))
  })
})

describe('DATE-OWNER-01 — nothing formats a date outside the owner', () => {
  const files = execSync(
    "git ls-files 'app/*.tsx' 'app/**/*.tsx' 'components/*.tsx' 'components/**/*.tsx' " +
      "'app/**/*.ts' 'lib/**/*.ts' 'lib/*.ts'",
    { encoding: 'utf8' },
  ).trim().split('\n').filter(f => f && !/\.test\.tsx?$/.test(f) && f !== 'lib/format.ts')

  it('the scan reaches the tree (guards the guard)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('🔴 no hand-written `toLocaleDateString` outside lib/format.ts', () => {
    const offenders: string[] = []
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((raw, i) => {
        const t = raw.trim()
        // A comment naming the rule is not a second copy of it — the sixth
        // recording of "bound the region, never grep the file" was today.
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
        if (raw.includes('toLocaleDateString')) offenders.push(`${f}:${i + 1}`)
      })
    }
    expect(
      offenders,
      'Use formatDate(date, style) from lib/format.ts. ADR-015 owns every string a runner reads, ' +
        'and dates were the one family it never covered: 9 formats across 22 sites before this.',
    ).toEqual([])
  })

  it('🔴 no raw ISO date interpolated into JSX', () => {
    // The defect the founder saw: `starts {meta.plan_start}` → "starts 2026-12-07".
    const offenders: string[] = []
    for (const f of files.filter(x => x.endsWith('.tsx'))) {
      readFileSync(f, 'utf8').split('\n').forEach((raw, i) => {
        const t = raw.trim()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
        if (/\{\s*[\w.]*\b(plan_start|race_date)\s*\}/.test(raw)) offenders.push(`${f}:${i + 1}`)
      })
    }
    expect(offenders, 'These are ISO storage keys, not display strings. Wrap in formatDate().').toEqual([])
  })
})
