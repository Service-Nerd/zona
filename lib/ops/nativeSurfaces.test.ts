import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { nativeSurfaces, currentManifest, EXCLUDE, MANIFEST } from '../../scripts/native-surface-baseline.mjs'

/**
 * 🔴 `NATIVE-BATCH-01` FRESHNESS — because that item has gone stale silently, twice.
 *
 * Zonna loads the web app from Vercel (`server.url`), so almost everything ships instantly.
 * Only *native-layer* work needs a new binary, every binary costs an App Review cycle, and
 * `NATIVE-BATCH-01` is the one record of what the next build will carry.
 *
 * ⚠️ **IT HAS BEEN WRONG ABOUT ITSELF TWICE.** It spent three months describing a release that
 * had already shipped. And on 2026-11-15, ten days after being "measured":
 *   · it called `HK-NATIVE-BG-INGEST-01` *"unwritten Swift, so it cannot ride today's build"* —
 *     Phase 1 had shipped on 2026-11-05 (227 lines in `HealthObserverPlugin.swift`), and that
 *     item's own heading says *"SHIPPED, pending a binary"*;
 *   · its native-surface date list was wrong on **three of eight** entries, all three changed by
 *     that same ship;
 *   · its install figures (30 subscriptions / 25 users) read **32 / 27** live.
 *
 * Nothing in the repo noticed, because the item is prose and prose has no producer to diff
 * against. This gate gives it one: **a native file cannot change without someone being told to
 * reconcile the release item.** It deliberately does NOT try to parse the item's prose — that
 * would be a second, looser derivation of the same thing. It asserts the SURFACES are unchanged
 * since the last reconciliation, and the re-baseline is where the reading happens.
 *
 * ⚠️ **Distinct from `verify-cap-config.mjs`**, which asks whether the GENERATED iOS config
 * matches `capacitor.config.ts`. This asks whether any native surface has moved since the
 * release record was last brought up to date. Different question, different failure.
 */
describe('NATIVE-BATCH-01 — no native surface changes without reconciling the release item', () => {
  const baseline = JSON.parse(readFileSync(MANIFEST, 'utf8')).surfaces as Record<string, string>

  it('the population is non-empty and globbed, never hand-listed', () => {
    // `CLEAN — 0 files` was the first answer the colour sweep gave for selecting nothing
    // (`GUARD-TREE-SWEEP-01`). An empty population here would pass every arm below.
    const files = nativeSurfaces()
    expect(files.length, 'no native surfaces found — the glob is broken, not the tree empty')
      .toBeGreaterThan(20)
    expect(files, 'capacitor.config.ts is a native surface: `server.url` and the plugin list')
      .toContain('capacitor.config.ts')
    expect(files, 'the widget is shipped IN the binary').toContain('ios/App/ZonnaWidgetExtension/ZonnaWidget.swift')
  })

  it('every exclusion still matches something — a dead exclusion is a silent widening', () => {
    // An exclusion whose pattern no longer matches any tracked path has become a no-op, and the
    // population has widened without anyone deciding to. `verify-cap-config`'s own exemption arm
    // exists for exactly this shape, so this one is asserted rather than assumed.
    const all = execFileSync('git', ['ls-files', 'ios/', 'capacitor.config.ts'], { encoding: 'utf8' })
      .split('\n').map(f => f.trim()).filter(Boolean)
    const kept = nativeSurfaces()
    for (const e of EXCLUDE) {
      expect(all.some(f => e.pattern.test(f)), `exclusion ${e.pattern} (${e.why}) matches nothing — remove it`).toBe(true)
      expect(kept.some(f => e.pattern.test(f)), `exclusion ${e.pattern} leaked into the population`).toBe(false)
    }
  })

  it('🔴 no native surface has changed since the release item was last reconciled', () => {
    const now = currentManifest() as Record<string, string>
    const changed = Object.keys(now).filter(f => baseline[f] !== undefined && baseline[f] !== now[f])
    const added = Object.keys(now).filter(f => baseline[f] === undefined)
    const removed = Object.keys(baseline).filter(f => now[f] === undefined)
    expect(
      { changed, added, removed },
      'A native surface moved. That change reaches NOBODY until a new binary ships, so: '
        + "update NATIVE-BATCH-01's \"waiting for the binary\" table to say what this adds, then "
        + '`node scripts/native-surface-baseline.mjs --write` and name the carry in the commit.',
    ).toEqual({ changed: [], added: [], removed: [] })
  })
})
