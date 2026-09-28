import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { UPGRADE_SOURCES } from '@/lib/analytics'

// OPS-FUNNEL-02 — every paywall door carries a distinct source, and nothing
// reaches the paywall without one.
//
// 🔴 THIS GATE EXISTS BECAUSE I BROKE IT WHILE WRITING IT. The first pass
// substituted `setScreen('upgrade')` by regex across the whole file — and the
// COMMENT I had just inserted quoted that same string in backticks, so it
// consumed the first label and the new helper consumed the second. Every one of
// the nine doors ended up attributed to the wrong screen, two were left
// unattributed, and the helper called ITSELF. `tsc` passed: it was type-valid and
// behaviourally wrong.
//
// The repo already has the rule — **"bound the region, never grep the file"** —
// recorded three times (`--surface-moss-wash`, the hollow inset-border check, the
// coaching-guard substring bias). This is the fourth, and the only reason it was
// caught is that a straggler count did not reach zero.
//
// So the check is not "does a source exist" but "is every door DISTINCTLY
// attributed", which is the property that was actually violated.

const CLIENT = 'app/dashboard/DashboardClient.tsx'

function src(): string {
  return readFileSync(CLIENT, 'utf8')
}

/** `openUpgrade('x')` calls, excluding any that appear inside a comment line —
 *  because a comment quoting the call is exactly what corrupted the first pass. */
function labelledCalls(text: string): string[] {
  return text
    .split('\n')
    .filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .flatMap(l => Array.from(l.matchAll(/openUpgrade\('([a-z_]+)'\)/g), m => m[1]))
}

describe('OPS-FUNNEL-02 — every door is distinctly attributed', () => {
  it('uses every declared source exactly once', () => {
    const used = labelledCalls(src())
    const counts = new Map<string, number>()
    for (const u of used) counts.set(u, (counts.get(u) ?? 0) + 1)

    const missing = UPGRADE_SOURCES.filter(s => !counts.has(s))
    expect(missing, 'declared in UPGRADE_SOURCES but no door uses it').toEqual([])

    const duplicated = Array.from(counts.entries()).filter(([, n]) => n > 1).map(([s]) => s)
    expect(duplicated,
      'two doors share a source, so the funnel cannot tell them apart — this is the exact defect the first pass shipped')
      .toEqual([])
  })

  it('uses no source that is not declared', () => {
    const undeclared = labelledCalls(src())
      .filter(u => !(UPGRADE_SOURCES as readonly string[]).includes(u))
    expect(undeclared, 'add it to UPGRADE_SOURCES or fix the typo').toEqual([])
  })

  it('routes every paywall entry through the single owner', () => {
    // A bare setScreen('upgrade') is a door with no source. Exactly two mentions
    // are legitimate: the helper's own body, and the comment above it that
    // explains why the helper exists.
    const bare = src().split('\n')
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => l.includes("setScreen('upgrade')"))
    expect(bare.length,
      `bare setScreen('upgrade') at lines ${bare.map(([n]) => n).join(', ')} — route it through openUpgrade(source)`)
      .toBe(2)
    // And one of them must actually BE the helper, or the count above is satisfied
    // by two unattributed doors — a green tick with nothing behind it.
    expect(src()).toMatch(/const openUpgrade = \([^)]*\) => \{[^}]*setScreen\('upgrade'\)[^}]*\}/)
  })

  it('the helper does not call itself', () => {
    // The first pass produced `openUpgrade = (s) => { setUpgradeSource(s); openUpgrade('link_email') }`
    // — a stack overflow on the first tap, and type-valid.
    const helper = src().match(/const openUpgrade = \([^)]*\) => \{[^}]*\}/)?.[0] ?? ''
    expect(helper.length).toBeGreaterThan(0)
    expect(helper).not.toMatch(/openUpgrade\(/)
  })
})
