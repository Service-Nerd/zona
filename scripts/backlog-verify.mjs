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

/**
 * 🔴 SECTION 5 — THE FILING RULE FINALLY HAS A GATE (BACKLOG-TAG-IN-HEADING-01, 2026-11-08).
 *
 * `backlog.md` § Filing rule says every item names its board, and then says of itself:
 * *"This is a note, not a gate. This repo's own record says a rule that holds only while
 * someone remembers is not a rule — the filing rule has no mechanical check, unlike the two
 * board guards."* It was right, and it stayed right for seven weeks.
 *
 * ⚠️ WHAT BLOCKED IT WAS NEVER THE RULE, IT WAS THE PARSE. The item was filed P3 because
 * `backlog.md` holds items as `###`/`####` headings, `##` parents, LATER table rows and bare
 * bullets, and *"no parse written so far reads all four (four attempts on 2026-09-20 gave four
 * different counts)"*. That is no longer true: `scripts/lib/open-items.sh` has been the single
 * owner since 2026-11-07 and reads every shape.
 *
 * 📐 RE-MEASURED 2026-11-08 AND THE NUMBER WAS WRONG IN BOTH DIRECTIONS. Filed as 23 untagged.
 * `backlog-open.sh` reported 9. The truth was **ONE** (`NATIVE-BATCH-01`), and the other eight
 * were artefacts of deriving an item's board from the first line in the file that CONTAINED its
 * id — a MENTION, not a filing. Fixed in the owner; see `open_item_boards`.
 *
 * ⚠️ THE GATE IS ON THE TAG EXISTING, NOT ON WHERE IT SITS. The rule asks for the heading;
 * 18 of 23 items measured on 2026-10-05 stated their board in the body instead. Failing those
 * would fire on ~20 items of documented, correct decisions, and a gate that fires on ordinary
 * work gets switched off — which this repo has recorded four times as equivalent to no gate.
 * So the block counts, and the heading is the convention this file reports rather than enforces.
 */
// 🔴 NOT THROUGH `sh()` — AN ALLOW-BY-DEFAULT GATE IS NOT A GATE (code review, 2026-11-08).
// `sh()` swallows a child failure and returns `''`, so if `open_item_boards` could not run —
// a syntax error, a renamed function, a missing file — this gate saw **0 rows, 0 untagged**
// and exited 0. **The failure mode of the check was indistinguishable from a clean document**,
// which is the class this repo has recorded as "unverified is never a pass" and which my own
// `feedback_an_allow_by_default_arm_is_not_a_check` memory names outright. Falsified with a
// failing `bash` stub. It now throws, and an empty row set is itself a failure because the
// backlog always has open items.
let boardRows
try {
  boardRows = execFileSync('bash',
    ['-c', '. scripts/lib/open-items.sh; open_item_boards docs/releases/backlog.md'],
    { encoding: 'utf8' })
    .split('\n').filter(Boolean).map(l => l.split('\t'))
} catch (e) {
  console.error('\n✗ open_item_boards FAILED TO RUN — the board-tag gate cannot be evaluated.')
  console.error(`  ${e instanceof Error ? e.message : String(e)}`)
  console.error('  Unverified is never a pass. Fix scripts/lib/open-items.sh.')
  process.exit(1)
}
if (boardRows.length === 0) {
  console.error('\n✗ open_item_boards returned NO ROWS. The backlog always has open items, so')
  console.error('  an empty result is a broken derivation, not a clean document.')
  process.exit(1)
}
const untagged = boardRows.filter(r => r[1] === '?')
const byBoard = boardRows.reduce((a, r) => ((a[r[1]] = (a[r[1]] || 0) + 1), a), {})

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
head('4. BOARD TAGS — the filing rule, gated')
Object.keys(byBoard).sort().forEach(b => console.log(`  ${(b === '?' ? 'UNTAGGED' : b).padEnd(12)} ${byBoard[b]}`))
if (untagged.length) {
  console.log('\n  ✗ AN OPEN ITEM WITH NO BOARD TAG:')
  untagged.forEach(([id, , ln]) => console.log(`      L${String(ln).padEnd(7)} ${id}`))
  console.log('    Add one of 🏃 COACHING BOARD · 🧭 DESIGN BOARD · 💼 SLT · 👤 FOUNDER · ⚙️ NO BOARD')
  console.log('    to the item\'s heading. More than one? Name the ORDER — the first glyph is the')
  console.log('    board that rules first, and that is what this reads.')
}

head('5. WHAT IS VERIFIABLE AT ALL')
console.log(`  ${withNums.length} items state a number — a figure exists to re-derive`)
console.log(`  ${noNums.length} items state NO number — behavioural claims, no script settles them`)
console.log('\n⚠️  A DEAD REFERENCE IS NOT ALWAYS A DEAD PREMISE: an item can name a file precisely')
console.log('    because it is missing. Nothing here is auto-resolved — read the item.')
console.log('⚠️  AND SECTION 5 IS THE HONEST LIMIT. This proves references are live and prints')
console.log('    baselines. It does not prove a behavioural premise still holds.\n')
process.exit(deadFiles.length + deadSyms.length + untagged.length > 0 ? 1 : 0)
