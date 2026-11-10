import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * GOALPACE-REGEN-OWNER-01 — the gate that keeps `regenerateFromStored` single.
 *
 * 🔴 WHY. `lib/plan/storedPlanRegen.ts` exists precisely so two scripts share one
 * construction, and its docblock records the defect it fixed: passing the plan start as
 * `composePlanWithFoundation`'s "today" gives a 0-day gap and NO foundation weeks, so every
 * plan with a runway reads as *"the engine moves the calendar"* (2026-10-27: `a91d8fde` and
 * `3cc7c3a9` were refused for exactly this).
 *
 * **`scripts/goalpace-5k-01-regen.ts` then reimplemented the construction inline and carried
 * that same bug back in** — every other line identical to the owner's. An owner is a
 * convention until something checks it, and this repo's record of conventions is
 * `deloadCadence` in five places and `raceDistanceKey` in three.
 *
 * ⚠️ MEASURED HONESTLY: THE BUG WAS UNREACHABLE FOR THAT SCRIPT'S OWN TARGETS. Both
 * (`c8aef8f9`, `e49ea589`) carry **0 foundation weeks**, so `composeToday` resolved to
 * `planStart` either way and the refusal could never fire for them. The dry-run after the fix
 * proves the script still works; **it does not prove the fix fixed anything for those two.**
 * The bug is live for any stored plan WITH a runway, which is 7 of 41 today.
 *
 * ⚠️ AND THE OTHER DERIVATIONS CONVERGE BY A CAP, NOT BY AGREEMENT. `lib/ops/regressionVsNewRule.ts`
 * composes from `generated_at`; on all 7 live plans with a block that date differs from the
 * owner's (gaps of 22–75 days against the owner's 21) and **the composed block is identical
 * anyway, because `foundationWeekCount` clamps to `FOUNDATION_MAX_WEEKS = 3` and every gap
 * exceeds 21 days.** They would diverge only for a gap of 7–20 days, of which there are none
 * stored. A latent divergence with a named condition, not a defect — which is why it is an
 * exemption here rather than a fix.
 */
const OWNER = 'lib/plan/storedPlanRegen.ts'

/**
 * Files that compose a foundation block onto a plan they read from STORAGE and are
 * deliberately not on the owner. Each needs a reason, and the reason has to be about the
 * "today" it composes from, because that is the only thing the owner decides differently.
 */
const DECLARED_DIVERGENCES: Record<string, string> = {
  'scripts/fleet-invalid-debt-01-regen.ts':
    'anchors to the ORIGINAL plan_start so main-week identity is unchanged; gap 0 → no new foundation prefix, which is the point for a fleet sweep',
  'scripts/recal-live-repair.ts':
    'composes from TODAY because it RE-PLANS from today, so the stored runway is not the question',
  'scripts/recompose-foundation.ts':
    'composes from TODAY to REBUILD the block against the weekday budget; guarded on the foundation week COUNT since 2026-11-10 so a shorter runway cannot pass silently',
  'lib/ops/regressionVsNewRule.ts':
    'composes from generated_at to ask the question the plan was originally asked; converges with the owner on every stored plan by the FOUNDATION_MAX_WEEKS clamp',
}

const ROOTS = ['app', 'lib', 'scripts']
const SKIP = new Set(['node_modules', '.next', '.git', 'ios'])

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p)
  }
  return out
}

/** Strip comments so a file DISCUSSING the owner is not read as calling past it. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/** Composes a foundation block AND reads a stored plan's own answers: the regeneration shape. */
function regeneratesFromStorage(path: string): boolean {
  const src = stripComments(readFileSync(path, 'utf8'))
  return /composePlanWithFoundation\s*\(/.test(src) && /generator_input|storedPlanInput\s*\(/.test(src)
}

/**
 * 🔴 A CALL, NOT A MENTION — and the first cut of this gate got it wrong, which the mutation
 * caught. It tested `src.includes('regenerateFromStored')`, so reintroducing the inline
 * construction while leaving the now-unused `import { regenerateFromStored }` in place passed
 * every arm: **an unused import was exempting the file from the gate written to catch it.**
 * The repo's own rule, recorded several times over: when the thing being matched is a NAME,
 * anchor it. Here that means requiring the invocation.
 */
const callsOwner = (path: string): boolean =>
  /\bregenerateFromStored\s*\(/.test(stripComments(readFileSync(path, 'utf8')))

describe('GOALPACE-REGEN-OWNER-01 — one owner for regenerating a stored plan', () => {
  const files = ROOTS.flatMap(r => sourceFiles(r))
    .map(p => p.replace(/\\/g, '/'))
    .filter(p => !/\.test\.tsx?$/.test(p))

  it('the population is real — an empty one would pass every arm below', () => {
    expect(files.length, 'no source files found; the roots are wrong').toBeGreaterThan(300)
    const composers = files.filter(p => stripComments(readFileSync(p, 'utf8')).includes('composePlanWithFoundation('))
    expect(composers.length, 'nothing composes a foundation block; this gate is pointed at nothing')
      .toBeGreaterThan(5)
  })

  it('🔴 no file reimplements the construction — it calls the owner or declares why not', () => {
    const offenders = files
      .filter(p => p !== OWNER && regeneratesFromStorage(p))
      .filter(p => !(p in DECLARED_DIVERGENCES))
      .filter(p => !callsOwner(p))
    expect(offenders,
      'this file regenerates a stored plan inline. Call `regenerateFromStored`, or add it to '
      + 'DECLARED_DIVERGENCES with the reason it composes from a different day.')
      .toEqual([])
  })

  it('⚠️ every declared divergence still exists and still diverges', () => {
    // A stale exemption is its own defect: it reads as "we thought about this" when the file
    // may have been deleted, or moved onto the owner and no longer need the exemption at all.
    for (const [path, reason] of Object.entries(DECLARED_DIVERGENCES)) {
      expect(() => statSync(path), `${path} is declared divergent and does not exist`).not.toThrow()
      expect(regeneratesFromStorage(path), `${path} no longer regenerates from storage — drop the exemption`)
        .toBe(true)
      expect(callsOwner(path), `${path} now calls the owner — drop the exemption`).toBe(false)
      expect(reason.length, `${path}'s exemption has no reason`).toBeGreaterThan(40)
    }
  })

  it('the owner still composes from the STORED block, which is the whole defect it fixed', () => {
    // The one line this gate exists to protect. Read it rather than restate it.
    const src = readFileSync(OWNER, 'utf8')
    expect(src).toMatch(/storedFoundation\.length\s*\?\s*String\(storedFoundation\[0\]\.date\)\s*:\s*planStart/)
    expect(src, 'the owner composes from planStart, which is the bug it was written to fix')
      .not.toMatch(/composePlanWithFoundation\([^)]*,\s*planStart,\s*'add'\)/)
  })
})
