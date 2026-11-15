#!/usr/bin/env node
// NATIVE-BATCH-01's freshness gate: a manifest of every file that can only reach a runner
// through a NEW BINARY, by content hash.
//
// 🔴 WHY A HASH AND NOT A GIT DATE. The obvious implementation reads `git log -1 --format=%ad`
// per file and compares it against the dates NATIVE-BATCH-01 states. `actions/checkout@v4`
// defaults to **fetch-depth: 1** and `verify.yml` does not override it, so in CI `git log` per
// file returns NOTHING — every date would read as absent and the gate would be vacuous exactly
// where it matters. A content hash needs only the working tree.
// (`feedback-a-gate-that-cannot-run-in-ci-is-not-a-gate`.)
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

// 🔴 ANCHORED TO THE REPO ROOT, AND IT WAS NOT (`/code-review`, 2026-11-15). Run from
// `scripts/` this printed `0 native surfaces` and exited 0 — and `--write` would have
// committed an EMPTY baseline, after which the gate passes for ever. Same cwd class
// `verify-cap-config.mjs` already fixed with `process.chdir(ROOT)` plus a refusal.
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const MANIFEST = 'lib/ops/nativeSurfaceBaseline.json'

/** Capacitor-family dependencies, whose VERSION is part of the native payload.
 *  🔴 A PLUGIN BUMP CHANGES THE BINARY WITH NO DIFF IN ANY ios/ FILE (`/code-review`):
 *  `Package.swift` names local plugins by PATH with no version, `Package.resolved` pins only
 *  remote transitive deps, and the generated config is gitignored. So the gate was green while
 *  the native payload moved. ⚠️ Hashing all of `package.json` would fire on every unrelated
 *  dependency change, and a gate that fires on ordinary work gets switched off — so only the
 *  native-family ranges are read. */
export const NATIVE_DEP_SCOPES = ['@capacitor/', '@capacitor-community/', '@capawesome/', '@capgo/', '@revenuecat/']

/** `name@range` for every native-family dependency, sorted — a pseudo-surface. */
export function nativeDeps(cwd = ROOT) {
  const pkg = JSON.parse(readFileSync(`${cwd}/package.json`, 'utf8'))
  const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
  return Object.keys(all)
    .filter(n => NATIVE_DEP_SCOPES.some(sc => n.startsWith(sc)))
    .sort()
    .map(n => `${n}@${all[n]}`)
}

// ⚠️ EXCLUSIONS ARE NAMED WITH A REASON AND ASSERTED TO STILL MATCH (see the test). A file
// excluded by a pattern that no longer matches anything is an exclusion that has silently
// become a no-op, which is how a population quietly widens.
export const EXCLUDE = [
  { pattern: /(^|\/)\.gitignore$/, why: 'not compiled into the binary' },
  { pattern: /\.md$/,              why: 'documentation; the widget README is a build runbook, not a surface' },
]

/** Every tracked file whose change can only reach a runner through a new binary. */
export function nativeSurfaces(cwd = ROOT) {
  const tracked = execFileSync('git', ['ls-files', 'ios/', 'capacitor.config.ts'], { cwd, encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean)
  const kept = tracked.filter(f => !EXCLUDE.some(e => e.pattern.test(f))).sort()
  // ⚠️ AN EMPTY POPULATION IS A BROKEN SELECTOR, NEVER AN EMPTY TREE. Refused rather than
  // returned, so no caller can baseline or assert against nothing.
  if (kept.length === 0) {
    throw new Error(`native-surface-baseline: 0 surfaces selected under ${cwd} — the glob is broken`)
  }
  return kept
}

/** `null` when the file is gone, so a DELETION reports as `removed` instead of throwing.
 *  🔴 A plain `rm` of a tracked native file made `currentManifest()` die with ENOENT, which
 *  also meant `--write` could not run in that state (`/code-review`). */
export function hashOf(file, cwd = ROOT) {
  const abs = `${cwd}/${file}`
  if (!existsSync(abs)) return null
  return createHash('sha256').update(readFileSync(abs)).digest('hex').slice(0, 16)
}

export function currentManifest(cwd = ROOT) {
  const out = {}
  for (const f of nativeSurfaces(cwd)) {
    const h = hashOf(f, cwd)
    if (h !== null) out[f] = h
  }
  out['(native deps)'] = createHash('sha256').update(nativeDeps(cwd).join('\n')).digest('hex').slice(0, 16)
  return out
}

// ⚠️ `pathToFileURL`, not string concatenation: `file://${argv[1]}` does not match for any path
// containing a space or non-ASCII character, so `--write` printed nothing, wrote nothing and
// exited 0 (`/code-review`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.chdir(ROOT)
  const write = process.argv.includes('--write')
  const now = currentManifest()
  if (write) {
    writeFileSync(MANIFEST, JSON.stringify({
      _why: 'NATIVE-BATCH-01 freshness. Re-baseline ONLY after reconciling that item\'s '
          + '"waiting for the binary" table, and say in the commit what the new binary carries.',
      surfaces: now,
    }, null, 2) + '\n')
    console.log(`wrote ${MANIFEST} — ${Object.keys(now).length} native surfaces`)
  } else {
    console.log(`${Object.keys(now).length} native surfaces`)
    for (const [f, h] of Object.entries(now)) console.log(`  ${h}  ${f}`)
  }
}
