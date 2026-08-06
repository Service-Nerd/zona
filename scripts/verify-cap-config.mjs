#!/usr/bin/env node
// Fails loudly if any local Capacitor plugin is missing from
// ios/App/App/capacitor.config.json → packageClassList.
//
// This is the backstop for the silent-regression class of bug: a raw
// `npx cap sync ios` (instead of `npm run sync:ios`) drops every local plugin,
// and the app ships with the widget empty / background push dead and no error.
//
// Wire this into the iOS build so a broken config can't ship:
//   - locally: `npm run verify:ios-plugins`
//   - Xcode: add a "Run Script" build phase before "Compile Sources":
//       cd "$SRCROOT/../.." && node scripts/verify-cap-config.mjs
// Exit 1 on any missing plugin.

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { LOCAL_IOS_PLUGINS } from './local-ios-plugins.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = resolve(__dirname, '../ios/App/App/capacitor.config.json')

let config
try {
  config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
} catch (err) {
  console.error(`[verify-cap-config] cannot read ${CONFIG_PATH}: ${err.message}`)
  console.error('[verify-cap-config] run `npx cap sync ios` first, then `node scripts/fix-cap-config.mjs`.')
  process.exit(1)
}

const list = config.packageClassList ?? []
const missing = LOCAL_IOS_PLUGINS.filter(p => !list.includes(p))

if (missing.length) {
  console.error(`[verify-cap-config] MISSING local plugin(s) from packageClassList: ${missing.join(', ')}`)
  console.error('[verify-cap-config] These load via NSClassFromString — a missing entry means the plugin')
  console.error('[verify-cap-config] silently never registers (empty widget / dead background push).')
  console.error('[verify-cap-config] Fix: `node scripts/fix-cap-config.mjs`  (or always sync via `npm run sync:ios`).')
  process.exit(1)
}

console.log(`[verify-cap-config] OK — all ${LOCAL_IOS_PLUGINS.length} local plugin(s) present in packageClassList.`)
