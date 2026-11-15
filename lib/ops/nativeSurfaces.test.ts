import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { nativeSurfaces, currentManifest, nativeDeps, EXCLUDE, MANIFEST, ROOT } from '../../scripts/native-surface-baseline.mjs'

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
  const baseline = JSON.parse(readFileSync(`${ROOT}/${MANIFEST}`, 'utf8')).surfaces as Record<string, string>

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
    const all = execFileSync('git', ['ls-files', 'ios/', 'capacitor.config.ts'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map(f => f.trim()).filter(Boolean)
    for (const e of EXCLUDE) {
      expect(all.some(f => e.pattern.test(f)), `exclusion ${e.pattern} (${e.why}) matches nothing — remove it`).toBe(true)
    }
    // 🔴 THE SECOND HALF OF THIS ARM USED TO BE HOLLOW (`/code-review`, 2026-11-15). It asserted
    // that `nativeSurfaces()` contains no excluded path — which is TRUE BY CONSTRUCTION, since
    // that function filters by this same predicate. No mutation could turn it red. The real
    // question is whether the COMMITTED MANIFEST holds one, because that file can be hand-edited
    // and is what every other arm reads.
    for (const e of EXCLUDE) {
      const leaked = Object.keys(baseline).filter(f => e.pattern.test(f))
      expect(leaked, `${e.pattern} leaked into the committed manifest`).toEqual([])
    }
  })

  it('a Capacitor PLUGIN BUMP counts as a native surface, with no ios/ diff', () => {
    // 🔴 THE POPULATION MISSED THIS (`/code-review`). A plugin version bump changes the binary's
    // native payload and touches no `ios/` file: `Package.swift` names local plugins by PATH with
    // no version, `Package.resolved` pins only remote transitive deps, and the generated config
    // is gitignored. So the gate was green while the payload moved.
    const deps = nativeDeps()
    expect(deps.length, 'no Capacitor-family dependencies found — the scope list is broken')
      .toBeGreaterThan(5)
    expect(deps.some(d => d.startsWith('@capacitor/core@'))).toBe(true)
    expect(deps.every(d => /@[\^~]?[\d]/.test(d)), 'each entry carries its range').toBe(true)
    expect(Object.keys(baseline), 'the dep hash is in the manifest').toContain('(native deps)')
  })

  it('🔴 no native surface has changed since the release item was last reconciled', () => {
    const now = currentManifest() as unknown as Record<string, string>
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
