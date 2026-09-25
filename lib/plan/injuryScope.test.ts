/**
 * INJURY-GUARD-PREDICATE-01 — §12's volume-cap scope has ONE owner.
 *
 * 🔴 THE DEFECT THIS EXISTS FOR. The engine's injury matcher was made
 * separator-insensitive on 2026-09-16 because three of the six values
 * `GeneratePlanScreen` can emit never matched. The validator restated the
 * predicate in THREE places and none of them was fixed, so:
 *
 *     'Shin splints'  ->  engine CAPS the volume
 *     'Shin splints'  ->  INV-PLAN-INJURY-CAP-DELIVERED never runs
 *     'Shin splints'  ->  INV-PLAN-DELOAD-BOUNCEBACK-BOUNDED never runs
 *
 * ...while the comment two lines above the broken copy read "Predicate matches
 * the engine's injury-cap gate exactly". It had been false for nine days.
 *
 * ⚠️ EVERY FIXTURE HERE USES THE PRODUCT'S OWN STRINGS. The reason the defect
 * survived is that the sweeps used the CODE's spelling — `['shin_splints']`,
 * `['shin']` — values the wizard cannot produce. A green run is only ever safety
 * for the inputs actually swept.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  hasInjuryKeyword, hasVolumeCappedInjuryHistory, VOLUME_CAPPED_INJURY_KEYWORDS,
} from './injuryScope'

/**
 * The six chips `app/dashboard/GeneratePlanScreen.tsx` offers, verbatim. Read
 * from the source rather than copied, so a seventh injury cannot be added to the
 * wizard without this test seeing it.
 */
const WIZARD_INJURIES: string[] = (() => {
  const src = readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8')
  const m = src.match(/const INJURIES\s*=\s*\[([^\]]*)\]/)
  if (!m) throw new Error('INJURIES list not found in GeneratePlanScreen.tsx — did it move?')
  return m[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
})()

describe('the wizard list is the ground truth', () => {
  it('reads the six product values from the screen, not from a copy here', () => {
    expect(WIZARD_INJURIES).toEqual(
      ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis'])
  })
})

describe('hasVolumeCappedInjuryHistory — §12 scope', () => {
  // 🔴 THE REGRESSION CASE. Fails against the pre-fix predicate
  // (`s.includes('shin_splints')`), passes now.
  it('MATCHES the product string "Shin splints", space and capital included', () => {
    expect(hasVolumeCappedInjuryHistory(['Shin splints'])).toBe(true)
  })

  it('matches every spelling of the same two injuries the codebase has ever used', () => {
    for (const v of ['Shin splints', 'shin splints', 'shin_splints', 'shin', 'SHIN SPLINTS']) {
      expect(hasVolumeCappedInjuryHistory([v]), `"${v}" must be volume-capped`).toBe(true)
    }
    for (const v of ['Knee', 'knee', 'Left knee, posterior, recurring']) {
      expect(hasVolumeCappedInjuryHistory([v]), `"${v}" must be volume-capped`).toBe(true)
    }
  })

  // ⚠️ THE SCOPE MUST NOT WIDEN. §12 names knee and shin-splint histories
  // specifically. Widening to any injury is INJURY-DELIVERED-COVERAGE-01, a
  // Coaching Board question, and this fix deliberately does not pre-empt it.
  it('does NOT widen: achilles, back, hip and plantar stay outside §12', () => {
    for (const v of ['Achilles', 'Back', 'Hip', 'Plantar fasciitis']) {
      expect(hasVolumeCappedInjuryHistory([v]), `"${v}" must NOT be volume-capped`).toBe(false)
    }
  })

  it('exactly 2 of the 6 wizard values are in scope', () => {
    const inScope = WIZARD_INJURIES.filter(v => hasVolumeCappedInjuryHistory([v]))
    expect(inScope).toEqual(['Knee', 'Shin splints'])
  })

  it('is silent on an empty, null or undefined history', () => {
    expect(hasVolumeCappedInjuryHistory([])).toBe(false)
    expect(hasVolumeCappedInjuryHistory(null)).toBe(false)
    expect(hasVolumeCappedInjuryHistory(undefined)).toBe(false)
  })

  it('finds the keyword anywhere in a multi-injury list', () => {
    expect(hasVolumeCappedInjuryHistory(['Achilles', 'Shin splints'])).toBe(true)
    expect(hasVolumeCappedInjuryHistory(['Achilles', 'Back'])).toBe(false)
  })
})

describe('hasInjuryKeyword — the bidirectional rule', () => {
  it("matches the wizard's shorter label against a longer keyword ('Hip' -> 'hip_flexor')", () => {
    expect(hasInjuryKeyword(['Hip'], 'hip_flexor')).toBe(true)
    expect(hasInjuryKeyword(['Plantar fasciitis'], 'plantar_fasciitis')).toBe(true)
  })

  it('needs >= 3 characters in the reverse direction, so a stray short value cannot match everything', () => {
    expect(hasInjuryKeyword(['it'], 'itb_syndrome')).toBe(false)
    expect(hasInjuryKeyword(['itb'], 'itb_syndrome')).toBe(true)
  })
})

// ── THE GUARD, and it is the point ───────────────────────────────────────────
//
// `deloadCadence.test.ts`'s pattern. The predicate existed in four places and
// they disagreed; a test that only checks the owner cannot stop a fifth copy
// being written, and the three that drifted each carried a comment explaining
// why a copy was necessary. So: no file outside this module may restate it.
describe('nobody restates §12 scope outside this module', () => {
  const OWNER = 'lib/plan/injuryScope.ts'
  // Not a violation: these ask a DIFFERENT question of the same field.
  //  - HILL_RESTRICTING_INJURIES (knee, itb, achilles, shin, calf, plantar) —
  //    hill exclusion, a wider and separately ratified list.
  //  - DashboardClient's hill copy line — the same wider question, in copy.
  //  - scripts/ — corpora and reports supply their own fixture values.
  const EXEMPT = new Set<string>([
    OWNER,
    'lib/plan/injuryScope.test.ts',
    'lib/plan/generationConfig.ts',      // HILL_RESTRICTING_INJURIES, ratified separately
    'app/dashboard/DashboardClient.tsx', // hill COPY, not the volume cap
  ])

  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.next' || e === '.git') continue
      const full = join(dir, e)
      if (statSync(full).isDirectory()) walk(full, out)
      else if (/\.tsx?$/.test(e)) out.push(full)
    }
    return out
  }

  it('no file outside the owner hand-rolls a knee/shin volume-cap predicate', () => {
    // Both spellings that have ever appeared, plus the one that was broken.
    const RESTATEMENT = /includes\(\s*['"]knee['"]\s*\)\s*\|\|\s*\w*\.?includes\(\s*['"]shin/
    const offenders: string[] = []
    for (const dir of ['lib', 'app', 'components']) {
      for (const f of walk(dir)) {
        if (EXEMPT.has(f)) continue
        const src = readFileSync(f, 'utf8')
        src.split('\n').forEach((line, i) => {
          if (RESTATEMENT.test(line)) offenders.push(`${f}:${i + 1}  ${line.trim()}`)
        })
      }
    }
    expect(offenders, `restates §12 scope instead of calling ${OWNER}:\n${offenders.join('\n')}`)
      .toEqual([])
  })

  it('the keyword list is a real list, so a widening is visible in one diff', () => {
    expect([...VOLUME_CAPPED_INJURY_KEYWORDS]).toEqual(['knee', 'shin_splints'])
  })
})
