#!/usr/bin/env node
/**
 * `npm run backlog:verify` — DOES EACH OPEN ITEM'S PREMISE STILL HOLD?
 *
 * 🔴 WHY THIS EXISTS. The founder asked four times whether the backlog was up to date. It was
 * mechanically CONSISTENT every time — `audit-docs.sh` was ALL CLEAN — and that check only ever
 * asks whether a record EXISTS and cross-references. **It never asks whether a record is TRUE.**
 * CLAUDE.md records that distinction and nothing acted on it, so items written weeks earlier went
 * on reading as current while the code moved underneath them.
 *
 * This is the other half. It re-derives what can be re-derived, mechanically, for every open item:
 *
 *   1. DEAD FILE  — the item names a path that no longer exists anywhere in the tree
 *   2. DEAD SYMBOL — the item names a function/constant `git grep -w` cannot find
 *   3. BASELINE   — the item names a CONSTANT; the live value is printed so a stated figure can
 *                   be compared against it rather than trusted
 *
 * ⚠️ WHAT IT CANNOT DO, STATED. 77 of 127 open items state no number at all — they are
 * behavioural claims ("the reorder screen offers days the runner said they cannot train"). No
 * script settles those; they need the behaviour exercised. This tells you which items are in
 * which category, so the unverifiable set is a NAMED list instead of an unexamined majority.
 *
 * ⚠️ A DEAD REFERENCE IS NOT ALWAYS A DEAD PREMISE. `CONTRACT-LEDGERCARD-01` names
 * `docs/contracts/components/ledger-card.md` precisely BECAUSE it does not exist — the absence is
 * the finding. Findings are reported, never auto-resolved.
 */
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8' }) } catch { return '' } }
const ROOT = sh('git', ['rev-parse', '--show-toplevel']).trim()
process.chdir(ROOT)

const ids = sh('bash', ['-c', '. scripts/lib/open-items.sh; { heading_open_ids docs/releases/backlog.md; board_tag_bullet_ids docs/releases/backlog.md; } | sort -u'])
  .split('\n').map(s => s.trim()).filter(Boolean)

const lines = readFileSync('docs/releases/backlog.md', 'utf8').split('\n')
const headIdx = lines.map((l, n) => (/^#{2,4} /.test(l) ? n : -1)).filter(n => n >= 0).concat(lines.length)
const bodies = new Map()
for (let k = 0; k < headIdx.length - 1; k++) {
  const head = lines[headIdx[k]]
  for (const id of ids) if (head.includes(id) && !bodies.has(id)) bodies.set(id, lines.slice(headIdx[k], headIdx[k + 1]).join('\n'))
}
lines.forEach((l, n) => {
  const m = /^- \S+ \*\*[^*]+\*\* `?([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)`?/.exec(l)
  if (m && ids.includes(m[1]) && !bodies.has(m[1])) {
    let j = n + 1
    while (j < lines.length && (lines[j].startsWith('  ') || lines[j].trim() === '')) j++
    bodies.set(m[1], lines.slice(n, j).join('\n'))
  }
})

const FILE = /`([a-zA-Z0-9_./-]+\.(?:ts|tsx|sh|mjs|py|md|css|json|sql))`/g
const SYM = /`([A-Za-z_][A-Za-z0-9_]{3,})(?:\(\))?`/g
const CONST = /`([A-Z][A-Z0-9_]{6,})`/g
const SKIP = /^(true|false|null|undefined|warn|error|string|number|boolean|paid|free|main|HEAD)$/i

/**
 * ⚠️ DECLARED EXEMPTIONS — a reference that is dead BY DESIGN, each with its reason.
 * This is a register, not a silencer: an entry with no reason is the thing it exists to prevent,
 * and an entry whose reason has become FALSE is the same failure one step later (this repo has
 * the `ZONES-SURFACE-01` precedent for exactly that).
 */
const DEAD_BY_DESIGN = new Map([
  ['CONTRACT-LEDGERCARD-01|docs/contracts/components/ledger-card.md',
   'the item exists BECAUSE this contract is missing — the absence is the finding. Remove when the contract is written.'],
])

const deadFiles = [], deadSyms = [], withNums = [], noNums = [], baselines = new Map()
for (const [id, body] of bodies) {
  for (const [, p] of body.matchAll(FILE)) {
    if (existsSync(p)) continue
    const base = p.split('/').pop()
    if (sh('git', ['ls-files', `*${base}`]).trim()) continue
    if (DEAD_BY_DESIGN.has(`${id}|${p}`)) continue
    deadFiles.push([id, p])
  }
  for (const [, s] of body.matchAll(SYM)) {
    if (SKIP.test(s) || /^[A-Z][A-Z0-9]*$/.test(s)) continue
    if (!sh('git', ['grep', '-lw', '--', s]).trim()) deadSyms.push([id, s])
  }
  for (const [, c] of body.matchAll(CONST)) {
    const hit = sh('git', ['grep', '-hn', `-e`, `^\\s*${c}[ :=]`, '--', '*.ts']).split('\n')[0]
    if (hit) baselines.set(`${id}|${c}`, hit.trim().slice(0, 100))
  }
  ;(/\*\*\d[\d,.]*\*\*|\b\d+ of \d+\b|\b\d+%/.test(body) ? withNums : noNums).push(id)
}

const head = s => console.log(`\n── ${s} ──`)
console.log(`\nBACKLOG PREMISE VERIFICATION — ${ids.length} open items\n`)
head('0. DEAD BY DESIGN — declared, with a reason')
;[...DEAD_BY_DESIGN.entries()].forEach(([k, why]) => {
  const [id, p] = k.split('|'); console.log(`  ${id.padEnd(34)} ${p}\n${' '.repeat(36)}${why}`)
})
head('1. DEAD FILE REFERENCES (a named path that exists nowhere)')
deadFiles.length ? deadFiles.forEach(([i, p]) => console.log(`  ${i.padEnd(34)} ${p}`)) : console.log('  none')
head('2. DEAD SYMBOL REFERENCES (a named function/constant git grep -w cannot find)')
deadSyms.length ? deadSyms.forEach(([i, s]) => console.log(`  ${i.padEnd(34)} ${s}`)) : console.log('  none')
head('3. BASELINES NAMED BY AN ITEM — live values, to compare against the stated figure')
;[...baselines.entries()].sort().forEach(([k, v]) => {
  const [id, c] = k.split('|'); console.log(`  ${id.padEnd(34)} ${c.padEnd(34)} ${v}`)
})
head('4. WHAT IS VERIFIABLE AT ALL')
console.log(`  ${withNums.length} items state a number — a figure exists to re-derive`)
console.log(`  ${noNums.length} items state NO number — behavioural claims, no script settles them`)
console.log('\n⚠️  A DEAD REFERENCE IS NOT ALWAYS A DEAD PREMISE: an item can name a file precisely')
console.log('    because it is missing. Nothing here is auto-resolved — read the item.')
console.log('⚠️  AND SECTION 4 IS THE HONEST LIMIT. This proves references are live and prints')
console.log('    baselines. It does not prove a behavioural premise still holds.\n')
process.exit(deadFiles.length + deadSyms.length > 0 ? 1 : 0)
