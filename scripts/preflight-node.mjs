#!/usr/bin/env node
// Preflight for `npm run sync:ios`: refuse to start on a Node the Capacitor
// CLI will reject, and say WHY it matters.
//
// 🔴 WHY THIS EXISTS (CAP-SYNC-NODE-FATAL-01, measured 2026-11-05).
// `@capacitor/cli@8` declares `engines.node >= 22`. This Mac's default shell
// Node is v20.20.2. So `npm run sync:ios` ended at:
//
//     [fatal] The Capacitor CLI requires NodeJS >=22.0.0
//
// The chain is `&&`-joined, so nothing was wiped — the command simply did not
// run. That is the whole defect: `ios/App/App/capacitor.config.json` is
// GENERATED and GITIGNORED, and it is the file Capacitor 8 reads to decide
// which native plugins exist at all (`packageClassList` → NSClassFromString).
// When the command that keeps it correct cannot run, the file silently stays
// at whatever it last was. Measured: it had sat untouched since 2026-08-06,
// missing `www.zonna.run` from allowNavigation (the ONBOARD-EXIT-01 fix),
// the PushNotifications presentationOptions, and both `FilesystemPlugin` and
// `SharePlugin` — so the native share path could not register.
//
// Nothing in the repo said which Node was required: no .nvmrc, no
// engines.node, and a fatal that names a number but not a consequence.
//
// ⚠️ THE RANGE IS READ FROM THE INSTALLED CLI, NEVER HARDCODED. A second copy
// of ">=22" here would be correct until the CLI bumps, which is the exact
// class of drift this repo keeps paying for.

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import semver from 'semver'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CLI_PKG = resolve(ROOT, 'node_modules/@capacitor/cli/package.json')
const NVMRC = resolve(ROOT, '.nvmrc')

function fail(lines) {
  console.error('')
  for (const l of lines) console.error(l)
  console.error('')
  process.exit(1)
}

// ── the requirement, from the producer ───────────────────────────────────────
if (!existsSync(CLI_PKG)) {
  fail([
    '[preflight-node] @capacitor/cli is not installed — run `npm install` first.',
    `[preflight-node] looked for ${CLI_PKG}`,
  ])
}

const cliPkg = JSON.parse(readFileSync(CLI_PKG, 'utf8'))
const range = cliPkg.engines?.node

if (!range) {
  // Not an allow-by-default arm: there is genuinely no declared requirement to
  // enforce. Say so loudly so a silent pass is not mistaken for a check.
  console.log(`[preflight-node] @capacitor/cli@${cliPkg.version} declares no engines.node — nothing to enforce.`)
  process.exit(0)
}

const running = process.versions.node

// ── is the .nvmrc pin still capable of satisfying it? ────────────────────────
// A pin may be major-only ("24" = newest installed 24.x), so comparing the
// coerced 24.0.0 against a range like ">=24.5.0" would false-fail. Compare
// majors, which is the claim a major-only pin actually makes.
if (existsSync(NVMRC)) {
  const pin = readFileSync(NVMRC, 'utf8').trim().replace(/^v/, '')
  const coerced = semver.coerce(pin)
  const floor = semver.minVersion(range)
  if (coerced && floor && semver.major(coerced) < semver.major(floor)) {
    fail([
      `[preflight-node] .nvmrc pins Node ${pin}, but @capacitor/cli@${cliPkg.version} needs ${range}.`,
      '[preflight-node] The pin has gone stale against the CLI. Update .nvmrc to a major that satisfies it.',
    ])
  }
} else {
  fail([
    '[preflight-node] .nvmrc is missing.',
    `[preflight-node] @capacitor/cli@${cliPkg.version} needs Node ${range}; without a pin nothing says so.`,
    '[preflight-node] Create .nvmrc at the repo root with the major version to use.',
  ])
}

// ── is the node actually running this capable of it? ─────────────────────────
if (!semver.satisfies(running, range, { includePrerelease: true })) {
  fail([
    `[preflight-node] WRONG NODE. Running v${running}; @capacitor/cli@${cliPkg.version} requires ${range}.`,
    '',
    '[preflight-node] Why this is not a cosmetic warning:',
    '[preflight-node]   `cap sync` regenerates ios/App/App/capacitor.config.json, which is the file',
    '[preflight-node]   Capacitor reads to decide which native plugins exist (packageClassList ->',
    '[preflight-node]   NSClassFromString). The CLI exits fatal on this Node, the sync chain stops,',
    '[preflight-node]   and that GITIGNORED generated file silently keeps its old contents. Measured',
    '[preflight-node]   2026-11-05: three months stale, two npm plugins absent, the share path dead.',
    '',
    '[preflight-node] Fix (the repo pins it):',
    '[preflight-node]   nvm use          # reads .nvmrc',
    '[preflight-node]   npm run sync:ios',
  ])
}

console.log(`[preflight-node] OK — Node v${running} satisfies @capacitor/cli@${cliPkg.version} (${range}).`)
