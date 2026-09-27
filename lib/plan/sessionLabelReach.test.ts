// SESSION-LABEL-LONGRUN-01 — "Long run" must be reachable (2026-09-27).
//
// 🔴 THE TWIN THAT WAS LEFT BEHIND FOR FIFTEEN DAYS.
// `PLAN-LONGRUN-COLOUR-01` (2026-09-12) fixed `getSessionColor` by taking the
// whole SESSION and asking `isLongRun`, because the engine models a long run as
// `type: 'easy'` so §52/§9 ratio rules treat it as aerobic volume. Its comment
// says `--s-long` was *"declared, ratified, consumed by nothing."*
//
// **`getSessionLabel` sat twenty lines below it and kept the bare-type
// signature.** So `SESSION_LABELS['easy']` was the only answer it could give,
// and "Long run" was unreachable for every engine-generated plan — the same
// sentence, about the same plan shape, in the same file.
//
// 📐 Found on a real user's post-run screen: the header read **"Easy run —
// Zone 2 · Sun"** while Kit's prose two inches below read **"RPE 3 on a long
// run is honest"**. The title contradicted the body, and the AI was the half
// that was right. Six of nine call sites passed a bare type.
//
// This is the `sessionColourReach.test.ts` pattern, applied to the twin.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getSessionLabel } from '@/lib/session-types'

const ROOT = path.resolve(__dirname, '../..')
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

function files(): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    if (!fs.existsSync(path.join(ROOT, d))) return
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx?$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out
}

/** `getSessionLabel(x.type …)` — a bare type cannot detect a long run. */
const TYPE_ARG = /getSessionLabel\(\s*[A-Za-z_$][\w$]*\.type\b/g

describe('SESSION-LABEL-LONGRUN-01', () => {
  it('🔴 a long run resolves to "Long run", not "Easy run"', () => {
    // The engine's real shape: type 'easy', distinguished structurally.
    const longRun = { type: 'easy', role: 'long_run', label: 'Long run — Zone 2', distance_km: 12 }
    expect(getSessionLabel(longRun as never)).toBe('Long run')
  })

  it('an ordinary easy run is unchanged', () => {
    expect(getSessionLabel({ type: 'easy', distance_km: 8 } as never)).toBe('Easy run — Zone 2')
  })

  it('a bare string still works, for call sites that genuinely hold only a type', () => {
    expect(getSessionLabel('quality')).toBe('Quality session')
    expect(getSessionLabel('rest')).toBe('Rest day')
  })

  it('🔴 no surface passes a bare `.type` — that cannot reach "Long run"', () => {
    const offenders: string[] = []
    for (const rel of files()) {
      const src = strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
      for (const m of Array.from(src.matchAll(TYPE_ARG))) {
        offenders.push(`${rel}:${src.slice(0, m.index!).split('\n').length} — ${m[0]}…) ` +
          `cannot produce "Long run": the engine models one as type 'easy'. Pass the whole session.`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('🔴 the population is real', () => {
    const f = files()
    expect(f.length).toBeGreaterThan(50)
    expect(f).toContain('app/dashboard/DashboardClient.tsx')
  })
})
