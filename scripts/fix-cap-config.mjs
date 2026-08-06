#!/usr/bin/env node
// Ensures every local Capacitor plugin stays in
// ios/App/App/capacitor.config.json → packageClassList after `npx cap sync ios`.
// Capacitor 8 only discovers npm-installed plugins; local plugins are wiped on
// every sync. The authoritative list lives in ./local-ios-plugins.mjs.
//
// Run via: npm run sync:ios   (wraps cap sync + this script + verify)

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { LOCAL_IOS_PLUGINS } from './local-ios-plugins.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = resolve(__dirname, '../ios/App/App/capacitor.config.json')

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
const list = config.packageClassList ?? []

let changed = false
for (const plugin of LOCAL_IOS_PLUGINS) {
  if (!list.includes(plugin)) {
    list.push(plugin)
    changed = true
    console.log(`[fix-cap-config] Added ${plugin} to packageClassList`)
  }
}

if (changed) {
  config.packageClassList = list
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, '\t') + '\n')
  console.log('[fix-cap-config] capacitor.config.json updated.')
} else {
  console.log('[fix-cap-config] Nothing to fix — packageClassList already correct.')
}
