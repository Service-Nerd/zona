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
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

export const MANIFEST = 'lib/ops/nativeSurfaceBaseline.json'

// ⚠️ EXCLUSIONS ARE NAMED WITH A REASON AND ASSERTED TO STILL MATCH (see the test). A file
// excluded by a pattern that no longer matches anything is an exclusion that has silently
// become a no-op, which is how a population quietly widens.
export const EXCLUDE = [
  { pattern: /(^|\/)\.gitignore$/, why: 'not compiled into the binary' },
  { pattern: /\.md$/,              why: 'documentation; the widget README is a build runbook, not a surface' },
]

/** Every tracked file whose change can only reach a runner through a new binary. */
export function nativeSurfaces(cwd = process.cwd()) {
  const tracked = execFileSync('git', ['ls-files', 'ios/', 'capacitor.config.ts'], { cwd, encoding: 'utf8' })
    .split('\n').map(s => s.trim()).filter(Boolean)
  return tracked.filter(f => !EXCLUDE.some(e => e.pattern.test(f))).sort()
}

export function hashOf(file, cwd = process.cwd()) {
  return createHash('sha256').update(readFileSync(`${cwd}/${file}`)).digest('hex').slice(0, 16)
}

export function currentManifest(cwd = process.cwd()) {
  const out = {}
  for (const f of nativeSurfaces(cwd)) out[f] = hashOf(f, cwd)
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
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
