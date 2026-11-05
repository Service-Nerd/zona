#!/usr/bin/env node
// Asserts that ios/App/App/capacitor.config.json is WHAT A SYNC WOULD PRODUCE
// RIGHT NOW — not merely that it mentions our two local plugins.
//
// That file is generated, gitignored, and load-bearing: Capacitor 8 reads
// `packageClassList` and instantiates each name via NSClassFromString, so a
// class missing from it is a plugin that silently never registers (every JS
// call rejects — empty widget, dead background push, a share button that
// falls through to the web path).
//
// ── Three arms ──────────────────────────────────────────────────────────────
//   1. every LOCAL plugin is present                      (zero dependencies)
//   2. every field matches capacitor.config.ts            (field-for-field)
//   3. exactly one class per installed Capacitor npm plugin, plus the locals
//
// 🔴 WHY ARMS 2 AND 3 EXIST (CAP-CONFIG-DRIFT-GATE-01, measured 2026-11-05).
// This script reported `OK — all 2 local plugin(s) present` while the file was
// THREE MONTHS STALE: `www.zonna.run` absent from server.allowNavigation (the
// ONBOARD-EXIT-01 fix, which is what stops sign-out escaping to Safari), the
// PushNotifications presentationOptions absent, and `FilesystemPlugin` and
// `SharePlugin` both absent from packageClassList.
//
// ⚠️ IT WAS NOT WRONG. Its POPULATION was `LOCAL_IOS_PLUGINS` — two names —
// so the npm plugins and every config field were outside what it could see.
// "The checker's population excludes the cases at risk" is a class this repo
// has recorded repeatedly; this is its instance in the native toolchain.
//
// ⚠️ ARMS 2 AND 3 DELIBERATELY CALL THE CLI'S OWN FUNCTIONS (`loadConfig`,
// `getIOSPlugins`, `getPluginFiles`, `findPluginClasses`). Normally a checker
// sharing the producer's predicate cannot catch the producer being wrong
// (DELOAD-OWNER-01) — and that is not the question here. The question is
// whether the FILE ON DISK matches what the producer would write now, i.e. is
// it stale, wiped by a raw `npx cap sync ios`, or hand-edited. Sharing the
// producer is the only correct way to ask that, and it means there is no
// second copy of the derivation to drift.
//
// ⚠️ IT CANNOT RUN IN CI, and the reason is structural: the file it checks is
// gitignored, so it does not exist in a fresh checkout. Nothing else blocks it
// — measured 2026-11-05, all three arms run fine on Node 20 even though the
// `cap sync` COMMAND needs >=22, because the CLI's own config loader does not.
// Its homes are `npm run sync:ios`, `npm run verify:ios-plugins`, and the
// Xcode build phase (scripts/xcode-verify-cap-config.sh) — the last of which
// is the one that matters, because an Xcode build is the only way a stale
// config reaches a device.
//
// Exit 1 on any failure, or if arms 2-3 could not be evaluated. An arm that
// could not run is UNVERIFIED, never OK.
//
// CAP_CONFIG_PATH overrides the file under test (used by the test suite — the
// real file is gitignored, so `git checkout` cannot undo a mutation of it).

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { LOCAL_IOS_PLUGINS } from './local-ios-plugins.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const CONFIG_PATH = process.env.CAP_CONFIG_PATH
  ? resolve(process.env.CAP_CONFIG_PATH)
  : resolve(ROOT, 'ios/App/App/capacitor.config.json')

const failures = []
const notes = []

// 🔴 THE CLI'S `loadConfig()` READS `process.cwd()`, SO THIS SCRIPT USED TO
// PASS OR FAIL DEPENDING ON WHERE IT WAS RUN FROM. Xcode runs a build phase
// with cwd = the .xcodeproj's directory (ios/App), which holds no
// capacitor.config.ts and no package.json, so `loadExtConfig` returned `{}`
// — and an EMPTY config is not an error to it. Measured from ios/App: arm 2
// reported all 7 top-level keys as "PRESENT in the generated file but not in
// capacitor.config.ts", and arm 3 computed "0 installed npm plugin(s)" and
// flagged all ten real classes as UNEXPECTED. The build phase would have
// blocked every iOS build with a confident "stale or hand-edited" verdict and
// a fix instruction that could not work.
//
// ⚠️ It is fixed HERE rather than in the shell wrapper, because the wrapper is
// one caller of four and the next one will not remember either. Fixing the
// caller would have fixed the caller.
//
// ⚠️ AND THE SILENT HALF IS THE DANGEROUS HALF: an absent config read as "the
// config declares nothing" is absence written as a value. The guard below
// refuses outright rather than reporting it as drift.
process.chdir(ROOT)

// ── read the generated file ─────────────────────────────────────────────────
let config
try {
  config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
} catch (err) {
  console.error(`[verify-cap-config] cannot read ${CONFIG_PATH}: ${err.message}`)
  console.error('[verify-cap-config] This file is GENERATED and gitignored — it does not exist in a')
  console.error('[verify-cap-config] fresh checkout. Run `nvm use && npm run sync:ios` to create it.')
  process.exit(1)
}

const list = config.packageClassList ?? []

// ── arm 1: local plugins present (no dependencies) ─────────────────────────
const missingLocal = LOCAL_IOS_PLUGINS.filter(p => !list.includes(p))
if (missingLocal.length) {
  failures.push([
    `ARM 1 — MISSING local plugin(s) from packageClassList: ${missingLocal.join(', ')}`,
    '  These load via NSClassFromString; a missing entry means the plugin never registers',
    '  (empty widget / dead background run-analysis push).',
    '  Fix: `node scripts/fix-cap-config.mjs`, or always sync via `npm run sync:ios`.',
  ])
} else {
  notes.push(`ARM 1 — all ${LOCAL_IOS_PLUGINS.length} local plugin(s) present.`)
}

// ── load the producer for arms 2 and 3 ─────────────────────────────────────
let cli = null
let cliError = null
try {
  const [{ loadConfig }, { getPlugins }, { getIOSPlugins }, iosPlugin, { getCordovaPlugins }] = await Promise.all([
    import('@capacitor/cli/dist/config.js'),
    import('@capacitor/cli/dist/plugin.js'),
    import('@capacitor/cli/dist/ios/common.js'),
    import('@capacitor/cli/dist/util/iosplugin.js'),
    import('@capacitor/cli/dist/cordova.js'),
  ])
  cli = { loadConfig, getPlugins, getIOSPlugins, getCordovaPlugins, ...iosPlugin }
} catch (err) {
  cliError = err
}

if (!cli) {
  failures.push([
    'ARMS 2 and 3 — UNVERIFIED. Could not load @capacitor/cli.',
    `  ${cliError?.message ?? cliError}`,
    `  Running Node v${process.versions.node}. The Capacitor CLI needs the version in .nvmrc.`,
    '  Fix: `nvm use` then re-run. An arm that could not run is not a pass.',
  ])
} else {
  let resolved = null
  try {
    resolved = await cli.loadConfig()
  } catch (err) {
    failures.push([
      'ARMS 2 and 3 — UNVERIFIED. Could not load capacitor.config.ts.',
      `  ${err.message}`,
    ])
  }

  if (resolved && resolved.app?.rootDir !== ROOT) {
    failures.push([
      'ARMS 2 and 3 — UNVERIFIED. The Capacitor CLI resolved a different project root.',
      `  expected ${ROOT}`,
      `  resolved ${resolved.app?.rootDir ?? '(none)'}`,
      '  An empty or foreign config would be compared as DRIFT, which is absence written as a value.',
      '  Refusing instead. This is the ios/App cwd defect; it should be impossible now.',
    ])
    resolved = null
  }

  if (resolved && !resolved.app?.extConfig?.appId) {
    failures.push([
      'ARMS 2 and 3 — UNVERIFIED. capacitor.config.ts loaded but carries no appId.',
      '  That is what an unreadable or empty ext-config looks like, not what drift looks like.',
    ])
    resolved = null
  }

  if (resolved) {
    // ── arm 2: field-for-field parity with capacitor.config.ts ────────────
    // `cap copy` writes app.extConfig verbatim and then stamps
    // packageClassList onto it, so the two must be identical apart from that
    // one key. Compared in BOTH directions: a key the CLI started emitting is
    // as interesting as one that went missing.
    const { packageClassList: _ignored, ...onDisk } = config
    // `cap copy` deletes ios.buildOptions / android.buildOptions before
    // writing the JSON (cli/dist/tasks/copy.js), because they carry signing
    // config for `cap build` and have no business in the app bundle. Comparing
    // extConfig verbatim would fail a CORRECTLY synced file the moment anyone
    // declares them. Mirror the producer rather than the source.
    const expectedFields = stripBuildOptions(resolved.app.extConfig)
    const diffs = deepDiff(expectedFields, onDisk, '')
    if (diffs.length) {
      failures.push([
        `ARM 2 — ${diffs.length} field(s) differ from capacitor.config.ts:`,
        ...diffs.map(d => `  ${d}`),
        '  The generated file is stale, or was hand-edited. Fix: `nvm use && npm run sync:ios`.',
      ])
    } else {
      notes.push(`ARM 2 — every field matches capacitor.config.ts (${Object.keys(onDisk).length} top-level keys).`)
    }

    // ── arm 3: one class per installed npm plugin, plus the locals ────────
    try {
      const iosPlugins = await cli.getIOSPlugins(await cli.getPlugins(resolved, 'ios'))
      const npmClasses = await cli.findPluginClasses(await cli.getPluginFiles(iosPlugins))
      const expected = new Set([...npmClasses, ...LOCAL_IOS_PLUGINS])
      // The producer appends CDVPlugin whenever ANY Cordova plugin is
      // installed (generateIOSPackageJSON). None are today; without this, the
      // day one arrives a freshly synced config fails as UNEXPECTED.
      const cordova = await cli.getCordovaPlugins(resolved, 'ios')
      if (cordova.length > 0) expected.add('CDVPlugin')
      const actual = new Set(list)
      const missing = [...expected].filter(c => !actual.has(c))
      const unexpected = [...actual].filter(c => !expected.has(c))
      if (missing.length || unexpected.length) {
        const lines = [`ARM 3 — packageClassList does not match the ${iosPlugins.length} installed npm plugin(s) + ${LOCAL_IOS_PLUGINS.length} local:`]
        if (missing.length) lines.push(`  MISSING: ${missing.join(', ')}`)
        if (unexpected.length) lines.push(`  UNEXPECTED: ${unexpected.join(', ')}`)
        lines.push('  A missing class is a plugin that silently never registers.')
        lines.push('  An unexpected one is a class NSClassFromString will not find — or a local plugin')
        lines.push('  that was added by hand instead of declared in scripts/local-ios-plugins.mjs.')
        lines.push('  Fix: `nvm use && npm run sync:ios`.')
        failures.push(lines)
      } else {
        notes.push(`ARM 3 — all ${expected.size} class(es) present and none extra (${npmClasses.length} npm + ${LOCAL_IOS_PLUGINS.length} local).`)
      }
    } catch (err) {
      failures.push(['ARM 3 — UNVERIFIED. Could not derive the expected class list.', `  ${err.message}`])
    }
  }
}

// ── report ─────────────────────────────────────────────────────────────────
if (failures.length) {
  console.error('')
  console.error(`[verify-cap-config] FAILED — ${failures.length} arm(s)`)
  console.error(`[verify-cap-config] file: ${CONFIG_PATH}`)
  for (const block of failures) {
    console.error('')
    for (const line of block) console.error(`[verify-cap-config] ${line}`)
  }
  if (notes.length) {
    console.error('')
    for (const n of notes) console.error(`[verify-cap-config] ok: ${n}`)
  }
  console.error('')
  process.exit(1)
}

for (const n of notes) console.log(`[verify-cap-config] ${n}`)
console.log('[verify-cap-config] OK — the generated iOS config is what a sync would produce now.')

// ── helpers ────────────────────────────────────────────────────────────────
// Order-sensitive on arrays, because the CLI copies extConfig verbatim: a
// reordered allowNavigation list means the file was not written by a sync.
function deepDiff(expected, actual, path) {
  const out = []
  const kind = v => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v)
  const ek = kind(expected)
  const ak = kind(actual)

  if (ek !== ak) {
    out.push(`${path || '<root>'}: expected ${ek} ${j(expected)}, found ${ak} ${j(actual)}`)
    return out
  }
  if (ek === 'array') {
    if (expected.length !== actual.length) {
      out.push(`${path}: expected ${expected.length} item(s) ${j(expected)}, found ${actual.length} ${j(actual)}`)
      return out
    }
    expected.forEach((v, i) => out.push(...deepDiff(v, actual[i], `${path}[${i}]`)))
    return out
  }
  if (ek === 'object') {
    for (const k of Object.keys(expected)) {
      if (!(k in actual)) out.push(`${path}.${k}: MISSING from the generated file (expected ${j(expected[k])})`)
      else out.push(...deepDiff(expected[k], actual[k], `${path}.${k}`))
    }
    for (const k of Object.keys(actual)) {
      if (!(k in expected)) out.push(`${path}.${k}: PRESENT in the generated file but not in capacitor.config.ts (${j(actual[k])})`)
    }
    return out
  }
  if (expected !== actual) out.push(`${path}: expected ${j(expected)}, found ${j(actual)}`)
  return out
}

// Mirrors cap copy's own deletion. Does not mutate the CLI's object.
function stripBuildOptions(ext) {
  const out = { ...ext }
  for (const platform of ['ios', 'android']) {
    if (out[platform] && typeof out[platform] === 'object' && 'buildOptions' in out[platform]) {
      const { buildOptions: _dropped, ...rest } = out[platform]
      out[platform] = rest
    }
  }
  return out
}

function j(v) {
  const s = JSON.stringify(v)
  return s === undefined ? 'undefined' : s.length > 90 ? `${s.slice(0, 87)}...` : s
}
