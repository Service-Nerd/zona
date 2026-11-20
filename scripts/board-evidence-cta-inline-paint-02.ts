// READ-ONLY board evidence for CTA-INLINE-PAINT-02 (Design Board, 2026-11-20).
// Re-derives the inline-override population with the SAME tag reader as
// components/ui/buttonInlineOverride.test.ts (copied, because importing a vitest file
// outside the runner executes its describe blocks), then lists, per call site, the
// variant and which Button-owned properties it sets and to what. Writes nothing.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const OWNED = ['background', 'borderRadius', 'fontSize', 'padding', 'minHeight', 'height'] as const
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out.filter(f => !f.includes('preview'))
}

type Site = { file: string; line: number; variant: string; size: string; props: Record<string, string> }
const sites: Site[] = []
let totalButtons = 0
for (const rel of tsxFiles()) {
  const src = strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'))
  for (const m of Array.from(src.matchAll(/<Button\b/g))) {
    totalButtons++
    let i = m.index! + '<Button'.length, depth = 0, quote = ''
    while (i < src.length) {
      const c = src[i]
      if (quote) { if (c === quote) quote = '' }
      else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
      i++
    }
    const tag = src.slice(m.index!, i)
    const style = tag.match(/(?:^|\s)style=\{\{([\s\S]*)$/)?.[1]
    if (!style) continue
    const props: Record<string, string> = {}
    for (const p of OWNED) {
      const mm = style.match(new RegExp(`(?:^|[\\s,{])${p}\\s*:\\s*([^,}\\n]+)`))
      if (mm) props[p] = mm[1].trim()
    }
    if (!Object.keys(props).length) continue
    const variant = tag.match(/variant=["{']?([a-z-]+)/)?.[1] ?? '(default)'
    const size = tag.match(/size=["{']?([a-z-]+)/)?.[1] ?? '(default)'
    sites.push({ file: rel, line: src.slice(0, m.index!).split('\n').length, variant, size, props })
  }
}

const propCount: Record<string, number> = {}
for (const s of sites) for (const p of Object.keys(s.props)) propCount[p] = (propCount[p] ?? 0) + 1
const files = new Set(sites.map(s => s.file))
console.log(`Button elements: ${totalButtons}; sites with an owned override: ${sites.length} across ${files.size} files`)
console.log('property frequency:', JSON.stringify(propCount))
const bgOnly = sites.filter(s => Object.keys(s.props).length === 1 && s.props.background)
const geomOnly = sites.filter(s => !s.props.background)
const both = sites.filter(s => s.props.background && Object.keys(s.props).length > 1)
console.log(`species by property set: background-only ${bgOnly.length} · geometry-only ${geomOnly.length} · background+geometry ${both.length}`)
const bgValues: Record<string, number> = {}
for (const s of sites) if (s.props.background) bgValues[s.props.background] = (bgValues[s.props.background] ?? 0) + 1
console.log('background values:', JSON.stringify(bgValues))
const geomSig: Record<string, number> = {}
for (const s of sites) for (const p of ['padding', 'borderRadius', 'fontSize', 'minHeight', 'height']) if (s.props[p]) { const k = `${p}=${s.props[p]}`; geomSig[k] = (geomSig[k] ?? 0) + 1 }
console.log('geometry values:', JSON.stringify(Object.fromEntries(Object.entries(geomSig).sort((a, b) => b[1] - a[1]))))
for (const s of sites) console.log(`${s.file}:${s.line} variant=${s.variant} size=${s.size} ${JSON.stringify(s.props)}`)
