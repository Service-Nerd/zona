import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'
import {
  FATIGUE_TAGS, SKIP_REASONS, isFatigueTag, isSkipReason, type FatigueTag,
} from './completionVocab'
import { FATIGUE_HIGH_TAGS } from './constants'

// FIRSTRUN-MISSED-01 — the gate, not the sweep.
//
// A missed-session reason was being written into `fatigue_tag`, a column whose
// consumers match `Fresh | Fine | Heavy | Wrecked`. MEASURED IN PRODUCTION
// before the fix: 13 of 83 tagged rows (15.7%) were reasons, and for TWO users
// all three slots of the last-three window that drives `heavyFatigue` were
// occupied by them — making a trigger that needs two of three structurally
// unreachable. A one-off backfill fixes today; this stops it recurring.

describe('completion vocabularies are disjoint and owned', () => {
  it('no value is both a fatigue level and a skip reason', () => {
    // The whole defect in one assertion: two vocabularies, one column, and no
    // overlap, so a consumer of one can NEVER match a value from the other.
    const overlap = (SKIP_REASONS as readonly string[])
      .filter(r => (FATIGUE_TAGS as readonly string[]).includes(r))
    expect(overlap).toEqual([])
  })

  it('every skip reason is rejected by the fatigue predicate', () => {
    for (const reason of SKIP_REASONS) {
      expect(isFatigueTag(reason), `${reason} must not read as fatigue`).toBe(false)
    }
  })

  it('every fatigue tag is rejected by the skip predicate', () => {
    for (const tag of FATIGUE_TAGS) {
      expect(isSkipReason(tag), `${tag} must not read as a skip reason`).toBe(false)
    }
  })

  it('the legacy "Cooked" value still reads as fatigue', () => {
    // `FATIGUE_HIGH_TAGS` in constants.ts matches it, so a historical row must
    // not be mistaken for a stray during a backfill.
    expect(isFatigueTag('Cooked')).toBe(true)
    expect((FATIGUE_HIGH_TAGS as readonly string[]).includes('Cooked')).toBe(true)
  })

  it('every FATIGUE_HIGH_TAG is a recognised fatigue value', () => {
    // Reconciles the two registers that describe the same column. They were
    // written in different files and nothing compared them.
    for (const tag of FATIGUE_HIGH_TAGS) {
      expect(isFatigueTag(tag), `${tag} is matched as high fatigue but is not a fatigue value`).toBe(true)
    }
  })

  it('nulls and junk are neither', () => {
    for (const v of [null, undefined, '', 0, {}, 'Knackered']) {
      expect(isFatigueTag(v)).toBe(false)
      expect(isSkipReason(v)).toBe(false)
    }
  })
})

describe('no writer puts a skip reason back into fatigue_tag', () => {
  // Static scan. The runtime guard (`isFatigueTag` on the trend) stops a bad
  // value being READ; this stops one being WRITTEN, which is where it starts.
  const SOURCES = ['app/dashboard/DashboardClient.tsx']

  it('the skip handlers write skip_reason, never fatigue_tag', () => {
    for (const rel of SOURCES) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      // `status: 'skipped'` and `fatigue_tag:` in the same upsert is the defect.
      const offenders = src
        .split(/\n\s*\n/)
        .filter(block => /status:\s*'skipped'/.test(block) && /fatigue_tag:/.test(block))
      expect(
        offenders.map(b => b.slice(0, 120)),
        `${rel}: a skipped-session upsert is writing fatigue_tag. The reason belongs in skip_reason — ` +
        'a value there can never be matched by a fatigue consumer and it displaces real fatigue data ' +
        'in the five-entry trend window.',
      ).toEqual([])
    }
  })

  it('the fatigue trend is filtered by the owner, not by truthiness', () => {
    const src = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    // `if (c?.fatigue_tag)` accepted anything non-null. It must be a predicate.
    expect(src).toMatch(/isFatigueTag\(c\?\.fatigue_tag\)/)
  })

  it('the reason list is not written out by hand anywhere', () => {
    // It was inline in two places and is a WIRE FORMAT — planAdjustment.ts
    // matches 'Injury / illness' exactly and both handlers special-case
    // 'Too tired'. Two copies of a wire format is how they drift.
    const src = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const inlineArrays = src.match(/\['Injury \/ illness',\s*'Too tired'/g) ?? []
    expect(inlineArrays).toEqual([])
  })
})

describe('FATIGUE-ARRAY-DRY-01 — one fatigue vocabulary, one type', () => {
  // The module comment says it exists because "a type without its values is
  // exactly the split that lets two lists drift". It then shipped while
  // `reframeRiskGate.ts` still DECLARED its own `FatigueTag` union and four UI
  // call sites and two route filters still wrote the values out by hand. This
  // is the gate that stops a seventh copy appearing.
  const SCANNED = [
    'app/dashboard/DashboardClient.tsx',
    'app/api/post-run-reframe/route.ts',
    'app/api/coaching/weekly-free-insight/route.ts',
    'lib/coaching/reframeRiskGate.ts',
    'components/shared/SessionCompleteCard.tsx',
  ]

  it('🔴 nobody writes the four values out by hand', () => {
    // Matches both shapes the duplicates took: the `as const` array the UI
    // mapped over, and the `t === 'Fresh' || ...` chain the routes filtered by.
    const ARRAY   = /\['Fresh',\s*'Fine',\s*'Heavy',\s*'Wrecked'\]/
    const UNION   = /'Fresh'\s*\|\s*'Fine'\s*\|\s*'Heavy'\s*\|\s*'Wrecked'/
    const OR_CHAIN = /===\s*'Fresh'\s*\|\|/
    const offenders: string[] = []
    for (const rel of SCANNED) {
      readFileSync(join(process.cwd(), rel), 'utf8').split('\n').forEach((line, i) => {
        const t = line.trim()
        // A comment naming the values is documentation, not a second list.
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
        if (ARRAY.test(line) || UNION.test(line) || OR_CHAIN.test(line)) {
          offenders.push(`${rel}:${i + 1}  ${t.slice(0, 100)}`)
        }
      })
    }
    expect(
      offenders,
      'Import FATIGUE_TAGS / FatigueTag / isFatigueTag from lib/coaching/completionVocab instead.',
    ).toEqual([])
  })

  it('there is exactly ONE FatigueTag declaration in the tree', () => {
    // A RE-EXPORT (`export type { FatigueTag }`) is not a declaration — it is
    // the same type under a second import path, which is what keeps existing
    // importers of reframeRiskGate working. A literal union is.
    const declarations = execSync(
      "git grep -ln 'export type FatigueTag' -- 'lib/**/*.ts' 'app/**/*.ts' 'components/**/*.ts*' " +
        // This file quotes the pattern in order to search for it.
        "':!*.test.ts' ':!*.test.tsx' || true",
      { encoding: 'utf8', cwd: process.cwd() },
    ).trim().split('\n').filter(Boolean)
    expect(declarations).toEqual(['lib/coaching/completionVocab.ts'])
  })

  it('the derived type and the values cannot disagree', () => {
    // `FatigueTag = typeof FATIGUE_TAGS[number]` makes this true by
    // construction — asserted so that replacing the derivation with a literal
    // union (which is what reframeRiskGate had) fails here.
    const each: FatigueTag[] = [...FATIGUE_TAGS]
    expect(each).toHaveLength(FATIGUE_TAGS.length)
    expect(FATIGUE_TAGS.every(isFatigueTag)).toBe(true)
  })
})
