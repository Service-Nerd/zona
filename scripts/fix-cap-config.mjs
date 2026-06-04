#!/usr/bin/env node
// Ensures SharedStorePlugin stays in ios/App/App/capacitor.config.json after
// every `npx cap sync ios`. Capacitor 8 only discovers npm-installed plugins via
// packageClassList — local plugins are wiped on every sync.
//
// Run via: npm run sync:ios   (wraps cap sync + this script)

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = resolve(__dirname, '../ios/App/App/capacitor.config.json')
const LOCAL_PLUGINS = ['SharedStorePlugin']

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
const list = config.packageClassList ?? []

let changed = false
for (const plugin of LOCAL_PLUGINS) {
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
