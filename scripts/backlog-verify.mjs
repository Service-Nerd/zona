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
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: 'utf8' }) } catch { return '' } }
const ROOT = sh('git', ['rev-parse', '--show-toplevel']).trim()
process.chdir(ROOT)

const ids = sh('bash', ['-c', '. scripts/lib/open-items.sh; { heading_open_ids docs/releases/backlog.md; board_tag_bullet_ids docs/releases/backlog.md; } | sort -u'])
  .split('\n').map(s => s.trim()).filter(Boolean)

/**
 * § 7's OPEN set, and it is WIDER than § 4's on purpose.
 *
 * 🔴 CODE REVIEW, 2026-11-09. The first cut asked "is this id FILED" against a headings-only
 * derivation and reported `POSTRUN-PLAN-FEEDBACK-01` — filed at L22232 and cited as an open
 * blocker six times — as an id that was never filed. `backlog.md` names THREE item formats and
 * the owner covered two, so the arm false-fired on 10 bullet-only open ids.
 *
 * ⚠️ § 4's tag gate keeps the narrower population BY RULING (`BACKLOG-TAG-IN-HEADING-01`):
 * demanding a board tag from 23 status bullets that never carried one is a different change.
 * This set answers a different question — "is this a live item?" — so it reads all three.
 */
const openIdsWide = Array.from(new Set([...ids, ...sh('bash',
  ['-c', '. scripts/lib/open-items.sh; status_bullet_open_ids docs/releases/backlog.md | sort -u'])
  .split('\n').map(s => s.trim()).filter(Boolean)]))

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

/**
 * 🔴 SECTION 1b — A CONTRACT THAT CITES A FILE THAT DOES NOT EXIST (added 2026-11-08).
 *
 * Found by code review on W4's own seven contracts: `wordmark.md` and `text-field.md` both
 * cited `lib/ui/typeScale.test.ts` (the real app gate is `appTypeScale.test.ts`, and the
 * similarly-named `lib/marketing/typeScale.test.ts` has a disjoint population), and
 * `article-page.md` cited `lib/marketing/comparisons.test.ts`, which does not exist — those
 * assertions are in `articles.test.ts`, already named on the same line.
 *
 * ⚠️ **A CONTRACT CITING A GATE THAT DOES NOT EXIST IS WORSE THAN CITING NONE**, and it is the
 * exact failure `COMPONENT-CONTRACT-GATE-01` was built for, one level up: *"a contract nobody
 * checks is worse than no contract — it is documentation that reads as authoritative and is
 * fiction."* That gate compares PROP NAMES; nothing read the prose. **49 contracts remain to be
 * written, so the cheap moment to gate this is now.**
 *
 * ⚠️ Backticked paths only, and only ones that LOOK like repo paths (a slash and a known
 * extension) — a bare filename in prose is not a reference, and matching one would fire on
 * ordinary writing, which this repo records four times as how a guard gets switched off.
 */
const contractDir = 'docs/contracts'
const contractFiles = sh('bash', ['-c', `find ${contractDir} -name '*.md' | sort`])
  .split('\n').map(s => s.trim()).filter(Boolean)
const deadContractRefs = []
for (const cf of contractFiles) {
  const body = readFileSync(cf, 'utf8')
  for (const m of body.matchAll(/`([a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)+\.(?:ts|tsx|sh|mjs|py|css|sql))`/g)) {
    const path = m[1]
    if (existsSync(path)) continue
    deadContractRefs.push([cf.replace(`${contractDir}/`, ''), path])
  }
}
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


/**
 * 🔴 SECTION 6 — THE `Verify still open:` PREDICATES, FINALLY RUN (BACKLOG-VERIFY-PREDICATE-01,
 * 2026-11-08).
 *
 * `backlog.md` § *Keeping this file honest* states the convention and then states its purpose:
 * *"It exists so an audit is a script rather than a careful read: run the check, and if it comes
 * back false the entry is stale."* **The script did not exist. 48 predicates, zero executions.**
 *
 * 🔴 AND THE DANGEROUS DIRECTION IS NOT HYPOTHETICAL — it was found the same day.
 * `HK-NATIVE-BG-INGEST-02`'s predicate read `grep -rn "refresh" ios/App/App/*.swift` → *no hit =
 * still open*. It returns FIVE hits: Apple's `AppDelegate` boilerplate comment, a widget-refresh
 * note, and three lines in `HealthObserverPlugin` that exist **precisely because the feature is
 * unbuilt** (*"No token refresh. Supabase ROTATES refresh tokens on use…"*). **So the predicate
 * reported the work DONE.** A predicate that the ABSENCE of the feature makes fail is worse than
 * none.
 *
 * ⚠️ SAFETY: AN ALLOW-LIST OF COMMAND HEADS, NOT ARBITRARY EXECUTION. The predicates are prose in
 * a markdown file, and some are `npx tsx -e "…"` or use process substitution. Running whatever a
 * document happens to contain is not a check, it is a shell. Only `grep`, `test`, `ls`, `find`
 * and `git remote get-url` run; everything else is REPORTED as not mechanically runnable, which
 * is the honest answer rather than a silent skip.
 *
 * ⚠️ WHAT A GREEN SECTION 6 DOES NOT PROVE, and it is the more important half: that a predicate
 * asks the RIGHT question. `FIRSTRUN-MARATHON-01` read open for 33 days with a predicate that
 * ran fine. This proves a predicate still EXECUTES and, where it states an expected count, that
 * the count still matches. It cannot tell a correct question from a plausible one.
 */
const PRED = /\*?\*?Verify still open:?\*?\*?:?\s*(.*)$/
const SAFE_PROGS = new Set(['grep', 'test', 'ls', 'find', 'git'])

/**
 * 🔴 NO SHELL AT ALL — THE ONLY FIX THAT IS NOT A BLACKLIST (code review, 2026-11-08).
 *
 * The first cut allow-listed the first TOKEN and handed the whole string to `bash -c`, so
 * `grep -c x /dev/null; echo ARBITRARY-COMMAND-RAN` was admitted and ran both halves. **This
 * script is second in `verify:ci`.** ⚠️ **And my falsification tested a command whose head was
 * `rm`, which the head test already caught** — a falsification aimed at the shape the check
 * handles proves nothing, which this repo records by name.
 *
 * My second cut refused any shell metacharacter, and that was WRONG IN THE OTHER DIRECTION:
 * `grep -c "sex\|gender"` and `grep -ci 'menstrual\|cycle'` are ordinary greps whose PATTERNS
 * contain `|` and quotes, so 6 runnable predicates became unrunnable and the count fell 20→14.
 * **A guard that reclassifies correct work as unverifiable is the noise failure, one step
 * removed.**
 *
 * So the command is TOKENISED and run with `execFileSync(prog, args)`. There is no shell to
 * inject into: a `;` inside a quoted pattern is data, and a `;` outside quotes cannot be
 * expressed at all and is refused with its reason. Globs are expanded here, deliberately
 * narrowly, because `ios/App/App/*.swift` is a real predicate.
 */
const UNSHELLABLE = /[;&|`$(){}<>]/

/** POSIX-ish tokeniser: single quotes literal, double quotes with backslash escapes, bare
 *  words with backslash escapes. Returns null when a shell would be required. */
function tokenise(cmd) {
  const out = []
  let i = 0, cur = '', started = false
  while (i < cmd.length) {
    const c = cmd[i]
    if (c === ' ' || c === '\t') { if (started) { out.push(cur); cur = ''; started = false } ; i++; continue }
    started = true
    if (c === "'") {
      const end = cmd.indexOf("'", i + 1)
      if (end < 0) return null
      cur += cmd.slice(i + 1, end); i = end + 1; continue
    }
    if (c === '"') {
      i++
      while (i < cmd.length && cmd[i] !== '"') {
        if (cmd[i] === '\\' && i + 1 < cmd.length) { cur += cmd[i + 1]; i += 2; continue }
        cur += cmd[i]; i++
      }
      if (i >= cmd.length) return null
      i++; continue
    }
    if (c === '\\' && i + 1 < cmd.length) { cur += '\\' + cmd[i + 1]; i += 2; continue }
    // An UNQUOTED metacharacter needs a shell, which is exactly what this refuses.
    if (UNSHELLABLE.test(c)) return null
    cur += c; i++
  }
  if (started) out.push(cur)
  return out
}

/** Expand `dir/*.ext` against the filesystem. Narrow by design: one `*` segment, no `**`. */
function expandGlob(tok) {
  if (!tok.includes('*')) return [tok]
  const at = tok.lastIndexOf('/')
  const dir = at < 0 ? '.' : tok.slice(0, at)
  const pat = tok.slice(at + 1)
  if (pat.includes('*') === false || dir.includes('*')) return [tok]
  let names = []
  try { names = readdirSync(dir) } catch { return [tok] }
  const re = new RegExp('^' + pat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '$')
  const hits = names.filter(nm => re.test(nm)).sort().map(nm => (at < 0 ? nm : `${dir}/${nm}`))
  return hits.length ? hits : [tok]
}

/**
 * 🔴 THE POPULATION IS THE FILE, NOT THE ITEM BODIES, AND MEASURING THAT WAS THE BUILD.
 *
 * My first cut keyed off `bodies` — the heading-derived map every other section uses — and saw
 * **3 lines of 52**, all of them this item's own prose. **48 of 52 predicates are ORPHANED from
 * a heading block**: they live in `> *Verify still open:*` blockquotes and in bullets under
 * LATER tables and unscheduled sections. That is the "three item formats" the backlog's own
 * convention paragraph warns about, and a heading-keyed parse reads one of them.
 *
 * A predicate line is self-contained — it carries the command AND the expected outcome — so the
 * item id is needed only to NAME the finding. Attributed to the nearest preceding id, the same
 * way a sentence's subject can be its heading.
 */
const allLines = readFileSync('docs/releases/backlog.md', 'utf8').split('\n')
const ID_RE = /`?\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+){1,4})\b`?/
const predRan = [], predStale = [], predManual = []
let nearestId = '(file)'
/**
 * ⚠️ THE PHRASE MUST OPEN THE LINE, OR THE SCAN READS PROSE ABOUT THE CONVENTION AS A
 * PREDICATE. My first cut matched anywhere on the line and collected four narrative mentions —
 * three of them this item's own text, plus the convention paragraph itself and ADR-015's
 * write-up of a predicate that once contradicted its own tick. **A check that fires on writing
 * about the check is `HOOK-RGBA-COMMENTS-01`, and this is its fifth appearance in two days.**
 * A real predicate opens its line after the bullet or blockquote markup.
 */
/**
 * 🔴 THE PREFIX CLASS STOPPED AT AN EMOJI, SO THE ITEM THAT MOTIVATED THIS BUILD WAS NEVER
 * SCANNED (code review, 2026-11-08). `HK-NATIVE-BG-INGEST-02`'s corrected predicate reads
 * `- ✅ **Use the one …:**` on one line and the command on the NEXT, and its sibling opens
 * `- 🔴 **Verify still open — …**`. Neither matched: the class `[-*>\s|]*` has no emoji, and
 * the command had to share the phrase's line.
 *
 * ⚠️ **THE BUILD'S OWN MOTIVATING CASE, OUTSIDE ITS OWN POPULATION.** Fixed by allowing any
 * non-word prefix characters, and by looking for the command on the predicate line OR the one
 * after it.
 */
const opensLine = line =>
  /^[^A-Za-z]{0,24}\*?\*?`?\*?Verify still open/.test(line)

/**
 * 🔴 A CLOSED ITEM'S PREDICATE MUST NOT BE SCANNED, AND THE FIRST RUN PROVED WHY.
 *
 * `SWEEP-AGE-01` is ticked ✅, and its predicate reads *"`grep -c "age: pick(ages)"` → 0 =
 * open"*. It now reads 1 — which is the predicate **correctly reporting that the item is
 * closed**. Reported as a contradiction, that is a gate nagging about finished work on every
 * run, and this repo records four times that such a gate gets switched off entirely, which is
 * the same as having none. A predicate's job is to tell you whether an OPEN item is stale.
 *
 * Closed is read from the nearest preceding RECORD lead line — a heading, a bullet, or a
 * blockquote bullet — carrying ✅ or a ~~strikethrough~~.
 */
const LEAD = /^(?:#{2,4} |>?\s*[-*] |> \*\*)/
/**
 * 🔴 `~~` ANYWHERE ON A LEAD LINE READ AS CLOSED, AND IT SILENTLY DROPPED AN OPEN ITEM
 * (code review, 2026-11-08). `ENGINE-03` is ⛔ and OPEN, and its lead line contains
 * `~~struck prose~~` describing a superseded phase — so its runnable predicate vanished from
 * all three buckets, which directly contradicts this section's own promise that nothing is
 * silently skipped.
 *
 * A record is closed when it is TICKED, or when its own IDENTIFIER is struck through. Struck
 * prose in the middle of a line is an editorial mark, not a status.
 */
const isClosedLead = l => /✅/.test(l) || /~~[^~]*\*\*[A-Z][A-Z0-9-]{3,}/.test(l) || /~~\*?\*?`?[A-Z][A-Z0-9-]{3,}/.test(l)
let leadClosed = false

allLines.forEach((line, n) => {
  // 🔴 THE PREDICATE'S OWN BULLET IS A LEAD LINE, AND IT RESET THE FLAG. Found by injecting a
  // matched pair of probe items, one ✅ and one 🔲, with the same wrong predicate: BOTH were
  // reported. `### ✅ …` set `leadClosed`, and then the very next line — `- **Verify still
  // open:** …` — matched `LEAD`, carried no ✅, and cleared it again before the predicate was
  // read. So the skip worked only where the predicate sat in a blockquote under a bullet, and
  // silently did nothing for a heading-shaped item.
  //
  // ⚠️ MY FIRST FALSIFICATION ATTEMPT WAS TO UN-TICK A REAL CLOSED ITEM, AND IT WAS
  // INCONCLUSIVE — no output either way, which reads exactly like a working skip. The matched
  // pair is what settled it: two items differing in ONE character, with the same predicate.
  if (LEAD.test(line) && !opensLine(line)) leadClosed = isClosedLead(line)
  // Attribution is for NAMING a finding, nothing more: any line carrying a backticked id
  // updates it, because the blockquote predicates sit under a `> **ITEM-ID**` lead line that
  // is neither a heading nor a bullet. ⚠️ The LINE NUMBER is the exact locator; the id is a
  // hint and can name a neighbour.
  const idm = ID_RE.exec(line)
  if (idm && /`/.test(line)) nearestId = idm[1]
  if (!opensLine(line)) return
  if (leadClosed) return
  const m = PRED.exec(line)
  if (!m) return
  const rest = m[1]
  const id = `${nearestId}:L${n + 1}`
  // The command is the FIRST backticked span; the stated outcome is the prose after it. A line
  // with no backticks is a prose gate ("Gate: 50+ paying users") and is reported, not run.
  // ⚠️ THE COMMAND MAY BE ON THE NEXT LINE. A wrapped markdown bullet puts the backticked
  // command on the continuation, which is how HK-NATIVE-BG-INGEST-02's corrected predicate is
  // written. One line of lookahead, joined before the search.
  const joined = `${rest} ${(allLines[n + 1] ?? '').trim()}`
  // ⚠️ A BACKTICKED SPAN IS NOT NECESSARILY A COMMAND, and reporting one as "not allow-listed"
  // MISLABELS THE RESIDUAL (code review, 2026-11-08): six prose gates were listed as though
  // somebody had tried to run `subscriptions` or `NEXT_PUBLIC_APP_URL`, which are a table name
  // and an env var quoted inside an external-gate sentence. **A residual list that misnames its
  // own entries is read once and ignored.** So the FIRST backticked span whose first token looks
  // like a program is the candidate; a line with none is a prose gate.
  const looksLikeCommand = t => SAFE_PROGS.has(t) || /^(npx|npm|node|bash|sh|tsx|pnpm|yarn)$/.test(t)
  const spans = Array.from(joined.matchAll(/`([^`]+)`/g)).map(m => m[1].trim())
  const cmd = spans.find(sp => looksLikeCommand((tokenise(sp) ?? sp.split(/\s+/))[0] ?? ''))
  if (!cmd) { predManual.push([id, 'prose gate', rest.replace(/\*\*/g, '').trim().slice(0, 80)]); return }
  // ⚠️ AN ALLOW-LIST OF COMMAND HEADS, NOT ARBITRARY EXECUTION. These are prose in a markdown
  // file and some are `npx tsx -e "…"`. Running whatever a document happens to contain is not a
  // check, it is a shell. Everything else is REPORTED as not runnable — never silently skipped.
  const argv0 = tokenise(cmd)
  if (!argv0) { predManual.push([id, 'needs a shell', cmd.slice(0, 80)]); return }
  if (!SAFE_PROGS.has(argv0[0])) { predManual.push([id, 'not allow-listed', cmd.slice(0, 80)]); return }
  // `git` is allow-listed only for the one read it is used for.
  if (argv0[0] === 'git' && !(argv0[1] === 'remote' && argv0[2] === 'get-url')) {
    predManual.push([id, 'git subcommand not allow-listed', cmd.slice(0, 80)]); return
  }
  const argv = [argv0[0], ...argv0.slice(1).flatMap(expandGlob)]
  // ⚠️ A TIMEOUT, BECAUSE A PREDICATE IS A CHECK AND NOT A BUILD — and because removing the
  // closed-item skip to falsify it HUNG THIS SCRIPT, which sits in `verify:ci`. A predicate
  // that cannot answer in 15s is reported as not runnable rather than stalling the gate; a
  // gate that can hang is a gate someone removes from CI. `stdin` is /dev/null for the same
  // family of reason: a `grep` with no file argument would otherwise wait on it forever.
  let out = '', failed = false, timedOut = false, status = 0
  try {
    out = execFileSync(argv[0], argv.slice(1),
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15_000 })
  } catch (e) {
    failed = true
    timedOut = !!(e && (e.signal === 'SIGTERM' || e.code === 'ETIMEDOUT'))
    status = (e && typeof e.status === 'number') ? e.status : 1
    out = (e && e.stdout) ? String(e.stdout) : ''
  }
  if (timedOut) { predManual.push([id, 'timed out at 15s', cmd.slice(0, 80)]); return }
  // 🔴 GREP'S ERROR EXIT WAS DISCARDED ON THE COUNTED PATH (code review, 2026-11-08). grep
  // returns 1 for "no match" and >=2 for "the file is unreadable" — and on the second it still
  // prints nothing, so a MISSING TARGET read as 0 and matched a stated `0 = still open`. **The
  // predicate would then confirm an item's premise using a file that no longer exists**, which
  // is the `a null from a field that does not exist` class. Latent today: all eight targets
  // exist. Reported as unanswerable, never as a count.
  if (status >= 2) { predManual.push([id, `the command errored (exit ${status})`, cmd.slice(0, 80)]); return }
  const rows = out.trim().split('\n').filter(Boolean)
  // `grep -c` prints the count (prefixed by a filename when multiple files are given).
  const count = /^grep\b.*\s-\w*c/.test(cmd)
    ? rows.reduce((a, r) => a + Number(r.split(':').pop() || 0), 0)
    : rows.length
  // 🔴 A NaN COUNT FELL INTO `predRan` AS "NaN = stated" AND READ GREEN, because `predRan` is
  // only counted and never printed (code review, 2026-11-08). `unverified is never a pass.`
  if (!Number.isFinite(count)) { predManual.push([id, 'count not derivable', cmd.slice(0, 80)]); return }
  const stated = /→\s*\*?\*?(\d+)\s*=/.exec(joined) ?? /\*\*(\d+)\s*=/.exec(joined)
  if (stated) {
    const want = Number(stated[1])
    if (count !== want) predStale.push([id, cmd.slice(0, 66), `states ${want}, reads ${count}`])
    else predRan.push([id, cmd.slice(0, 66), `${count} = stated`])
  } else {
    predRan.push([id, cmd.slice(0, 66), failed ? 'no match (exit non-zero)' : `${count} line(s)`])
  }
})

const head = s => console.log(`\n── ${s} ──`)
console.log(`\nBACKLOG PREMISE VERIFICATION — ${ids.length} open items\n`)
head('0. DEAD BY DESIGN — declared, with a reason')
;[...DEAD_BY_DESIGN.entries()].forEach(([k, why]) => {
  const [id, p] = k.split('|'); console.log(`  ${id.padEnd(34)} ${p}\n${' '.repeat(36)}${why}`)
})
head('1. DEAD FILE REFERENCES (a named path that exists nowhere)')
deadFiles.length ? deadFiles.forEach(([i, p]) => console.log(`  ${i.padEnd(34)} ${p}`)) : console.log('  none')
head('1b. A CONTRACT CITING A FILE THAT DOES NOT EXIST')
deadContractRefs.length
  ? deadContractRefs.forEach(([c, p]) => console.log(`  ✗ ${c.padEnd(38)} cites ${p}`))
  : console.log(`  none — ${contractFiles.length} contracts scanned`)

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
head('6. `Verify still open` PREDICATES — RUN, not read')
console.log(`  ran and consistent ${predRan.length} · CONTRADICTED ${predStale.length} · not mechanically runnable ${predManual.length}`)
// ⚠️ THE RAN LIST IS PRINTED, not merely counted (code review, 2026-11-08). A bucket that is
// only counted cannot be checked: a NaN count fell into it reading "NaN = stated" and nobody
// would have seen it. **A green total is not evidence of what was green.**
predRan.forEach(([id, cmd, note]) => console.log(`      ✓ ${id.padEnd(32)} ${note.padEnd(20)} ${cmd}`))
if (predStale.length) {
  console.log('\n  ✗ A PREDICATE WHOSE STATED COUNT NO LONGER MATCHES:')
  predStale.forEach(([id, cmd, why]) => console.log(`      ${id.padEnd(32)} ${why}\n${' '.repeat(34)}${cmd}`))
  console.log('    Re-derive the figure and correct the item, or the predicate is lying in the')
  console.log('    direction that closes work that is still open.')
}
if (predManual.length) {
  console.log('\n  — not mechanically runnable (reported, never silently skipped):')
  predManual.forEach(([id, why, what]) => console.log(`      ${id.padEnd(32)} [${why}] ${what}`))
}

/**
 * 🔴 SECTION 7 — THE 🔺 RESIDUAL MARK (`DOCS-RESIDUAL-01`, 2026-11-09).
 *
 * A residual on a SHIPPED item has no home in "what's left". CLAUDE.md's flow is: an open item
 * lives in roadmap + backlog, a shipped one moves to `feature-registry.md` — so **shipping is
 * what gives an item a home, and a residual is the part that did not ship.** It gets written
 * into the shipped entry, in detail, by an author who has just proved they understand it, and
 * then nothing ever queries it again. That is `PUSH-UNITS-01`'s shape.
 *
 * ⚠️ REQUIRING EVERY RESIDUAL TO NAME AN ITEM IS WORSE THAN THE PROBLEM, and it was measured
 * before this was built: **425 `🔻` markers** in `backlog.md` + `feature-registry.md` (686 across
 * `docs/`), against the **105** the item was filed on five weeks earlier. Most are correctly
 * ACCEPTED trade-offs ("iPhone-only runners get no HR coaching"). Retrofitting 425 marks to
 * satisfy a check is how a register fills with `accepted` and stops meaning anything.
 *
 * So there are TWO marks and only the new one is gated: `🔻` = accepted trade-off, unchanged;
 * `🔺` = unfixed, and here is the open item that tracks it.
 *
 * ⚠️ THREE ARMS, HONESTLY RANKED. (1) a 🔺 with no id at all — cheap, and only catches someone
 * who knows the convention and forgot. (2) an id that was never filed — a typo. (3) **an id that
 * is CLOSED — the `PUSH-UNITS-01` shape, a residual outliving the item that tracked it.** The
 * third is the one that earns its keep, and it is why the owner gained `heading_all_ids`.
 *
 * ⚠️ WHAT IT CANNOT DO: find a 🔻 that should have been a 🔺. That is a judgement about whether a
 * cost was accepted or merely noted, and no script settles it.
 *
 * ⚠️ TWO DELIBERATE EXCLUSIONS, BOTH MEASURED. `###` HEADINGS: 🔻 is overloaded — 9 occurrences in
 * `backlog.md` are an item's STATUS glyph, not a residual. And the CONVENTION BLOCK itself, which
 * describes the marks: searching for the mark finds the documentation of the mark, which is
 * `HOOK-RGBA-COMMENTS-01` exactly. The block is bounded by a sentinel pair this section ASSERTS
 * exists and is under 45 lines, so it cannot be widened to swallow a real residual.
 */
const RESIDUAL_FILES = ['docs/releases/backlog.md', 'docs/canonical/feature-registry.md']
const SENTINEL = ['residual-convention:start', 'residual-convention:end']
const ID_IN_TICKS = /`([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)`/g
const resNoId = [], resNotOpen = [], resOk = []
let resSentinelFail = null

/**
 * 🔴 THE CLAUSE, NOT THE LINE (code review, 2026-11-09). The first cut scanned ids from the
 * WHOLE line, and a `feature-registry.md` row is 2,000-3,000 characters. Measured on its own
 * first run: `feature-registry.md:1354`'s real tracker sits 27 chars after the mark and the ids
 * credited as "tracked and open" were **600 and 950 chars later, in unrelated sentences**.
 * **Co-occurrence read as a reference — the `GTM-CHARITY-02` class, inside the gate, in the
 * commit whose own write-up records measuring that class twice.**
 *
 * ⚠️ AND IT MUST CROSS A WRAP. `backlog.md` prose is hard-wrapped: `backlog.md:3142` says
 * "RESIDUALS, **both** filed below" and the second id is on 3143, invisible to a line scan —
 * which also sent an id-on-the-next-line residual into the "no item id" arm.
 *
 * So: from the mark to the end of its TABLE CELL (`|`), or for prose to the end of its
 * PARAGRAPH — following lines while they are non-empty and do not open a new block.
 */
function clauseAt(ls, i) {
  const l = ls[i]
  const from = l.indexOf('🔺')
  if (l.trimStart().startsWith('|')) {
    const end = l.indexOf('|', from)
    return l.slice(from, end < 0 ? undefined : end)
  }
  const parts = [l.slice(from)]
  for (let j = i + 1; j < ls.length; j++) {
    const n = ls[j]
    if (!n.trim()) break
    if (/^\s*(#{1,6} |\||[-*] |\d+\. )/.test(n.replace(/^>\s?/, ''))) break
    if (n.includes('🔺') || n.includes('🔻')) break
    parts.push(n.replace(/^>\s?/, ''))
  }
  return parts.join(' ')
}

for (const f of RESIDUAL_FILES) {
  const ls = readFileSync(f, 'utf8').split('\n')
  let skipFrom = -1, skipTo = -1, scan = true
  const a = ls.findIndex(l => l.includes(SENTINEL[0]))
  const b = ls.findIndex(l => l.includes(SENTINEL[1]))
  if (f.endsWith('backlog.md')) {
    // ⚠️ A SENTINEL FAILURE SKIPS THE SCAN (code review). The first cut left `skipFrom` at -1
    // and went on collecting, so the unskipped convention block alone contributed 1 closed and
    // 3 no-id to the exit code while only the sentinel message printed: five failures, one
    // explanation, four of them about the documentation.
    if (a < 0 || b < 0 || b <= a) { resSentinelFail = `${f}: the ${SENTINEL[0]}/${SENTINEL[1]} pair is missing or inverted`; scan = false }
    else if (b - a + 1 > 45) { resSentinelFail = `${f}: the convention block spans ${b - a + 1} lines (max 45) — it must not be widened`; scan = false }
    else { skipFrom = a; skipTo = b }
  }
  if (!scan) continue
  ls.forEach((l, i) => {
    // ⚠️ A MARK INSIDE A CODE SPAN IS BEING NAMED, NOT USED. This gate fired on its own
    // convention table and then on its own shipped write-up, which quotes `🔺` to explain the
    // mark — `HOOK-RGBA-COMMENTS-01`, twice in one build. The MARK is looked for in the
    // code-span-blanked line; the IDS are read from the original, because ids are in backticks.
    // ⚠️ ODD PARITY MEANS THE SPANS CANNOT BE PAIRED, and blanking then shifts and can swallow a
    // real bare mark with NO arm firing — the em-dash guard's recorded mechanism. So an odd
    // count skips the blanking and scans raw: a false fire is reviewable, a silent skip is not.
    const parity = (l.match(/`/g) ?? []).length % 2 === 0
    const prose = parity ? l.replace(/`[^`]*`/g, '@@') : l
    if (!prose.includes('🔺')) return
    if (i >= skipFrom && i <= skipTo && skipFrom >= 0) return
    if (/^#{2,4} /.test(l)) return
    const clause = clauseAt(ls, i)
    const named = Array.from(clause.matchAll(ID_IN_TICKS)).map(m => m[1])
    const where = `${f.split('/').pop()}:${i + 1}`
    const text = clause.trim().replace(/\s+/g, ' ').slice(0, 92)
    if (!named.length) return resNoId.push([where, text])
    // 🔑 EVERY id in the clause must be OPEN, not just one of them. The short-circuit in the
    // first cut (`if (open.length) return ok`) masked BOTH of the findings this arm exists to
    // make: `feature-registry.md:1327` names an open id AND `SELECT-DEAD-01` (✅ DONE), which is
    // the PUSH-UNITS-01 shape exactly, and it reported 0.
    const closed = named.filter(n => !openIdsWide.includes(n))
    if (!closed.length) return resOk.push([where, named.join(', ')])
    resNotOpen.push([where, closed.join(', '), text])
  })
}

head('7. 🔺 RESIDUALS — unfixed, and every item named as its tracker must still be OPEN')
if (resSentinelFail) {
  console.log(`  ✗ ${resSentinelFail}`)
  console.log('    This section skips the block that DESCRIBES the marks; without a bounded')
  console.log('    sentinel it would fire on the documentation. The scan is SKIPPED, not run')
  console.log('    partially, so this message is the only finding rather than one of five.')
} else if (!resOk.length && !resNoId.length && !resNotOpen.length) {
  console.log('  ✗ NOT ONE 🔺 IN EITHER FILE. A convention nobody uses is a convention that does')
  console.log('    not exist, and a gate over an empty population is green by construction.')
  console.log('    Adopt it on the next residual, or delete the convention and this section.')
} else {
  console.log(`  tracked and open ${resOk.length} · no id ${resNoId.length}`
    + ` · ✗ TRACKER NOT OPEN ${resNotOpen.length}`)
  resOk.forEach(([w, n]) => console.log(`      ✓ ${w.padEnd(30)} ${n}`))
  if (resNotOpen.length) {
    console.log('\n  ✗ A RESIDUAL WHOSE TRACKER IS NOT AN OPEN ITEM — the PUSH-UNITS-01 shape:')
    resNotOpen.forEach(([w, n, t]) => console.log(`      ${w.padEnd(30)} ${n}\n${' '.repeat(32)}${t}`))
    console.log('    Either the residual shipped (drop the 🔺, or say so), or it is still live and')
    console.log('    needs an OPEN item. A shipped, parked or withdrawn id is not a tracker.')
    console.log('    (Filed-but-closed and never-filed are ONE bucket on purpose: telling them')
    console.log('     apart needs an all-ids derivation, and the first cut of that was a verbatim')
    console.log('     second copy of the owner\'s extraction. Read the item.)')
  }
  if (resNoId.length) {
    console.log('\n  ✗ A 🔺 WITH NO ITEM ID — use 🔻 for an accepted trade-off, or file an item:')
    resNoId.forEach(([w, t]) => console.log(`      ${w.padEnd(30)} ${t}`))
  }
}

/**
 * 🔴 § 8 — A TRUE DUPLICATE FILING (`BACKLOG-DUPLICATE-HEADING-01`, 2026-11-10).
 *
 * An id filed under more than one heading, at least one still OPEN, and **none of them marked
 * as the archive**. Stamping one such heading leaves the other open, so the item is half-closed
 * and nothing says so — which is exactly what `audit-docs.sh` reported for
 * `SUITE-POOL-WALLCLOCK-01` (*"STILL OPEN … (has a feature-registry row)"*).
 *
 * ⚠️ THE ITEM ASKED FOR A DIFFERENT GATE AND IT WOULD NOT HAVE WORKED. It specified *"fail when
 * an id has two headings whose CLOSED status disagrees"*. Measured against the incident that
 * caused it, that rule fires **0** — both headings were OPEN and IDENTICAL, and the ✅ arrived in
 * the commit that fixed it. Measured against today's file it fires on **2 ids, both correct**:
 * a live heading beside an ARCHIVED one is this document's convention, which the item itself
 * says must not be merged. **A gate that misses every real case and cries wolf on every
 * legitimate one.**
 *
 * 📐 The rule shipped here: **1 at `23e1ccb6^`, 0 today**, with all 43 legitimate pairs silent.
 * The derivation lives in `duplicate_filing_ids` (`scripts/lib/open-items.sh`), beside the
 * closed vocabulary it depends on, so it cannot drift from what "closed" means.
 */
let dupRows = []
try {
  dupRows = execFileSync('bash',
    ['-c', '. scripts/lib/open-items.sh; duplicate_filing_ids docs/releases/backlog.md'],
    { encoding: 'utf8' }).split('\n').filter(Boolean).map(l => l.split('\t'))
} catch (e) {
  // ⚠️ An allow-by-default arm is not a check (W2-REVIEW-ROUND-01, recorded under that name).
  // `sh()` above swallows failures and returns ''; this must not.
  console.error('\n✗ duplicate_filing_ids FAILED TO RUN — § 8 cannot be evaluated.')
  console.error(`  ${e instanceof Error ? e.message : String(e)}`)
  console.error('  Unverified is never a pass. Fix scripts/lib/open-items.sh.')
  process.exit(1)
}

head('8. DUPLICATE FILINGS — one id, two live headings, no archive marker')
if (!dupRows.length) {
  console.log('  none — every id with more than one heading marks the second as the record')
} else {
  for (const [id, n, first, last] of dupRows) {
    console.log(`  ✗ ${id} — ${n} headings (L${first} and L${last}), none marked as the archive`)
  }
  console.log('    Stamping one of these leaves the other OPEN and the item half-closed.')
  console.log('    Fix: mark the second heading as the record — the convention this file already')
  console.log('    uses is "the original filing, for the record" — or merge the two filings.')
}

console.log('\n⚠️  A DEAD REFERENCE IS NOT ALWAYS A DEAD PREMISE: an item can name a file precisely')
console.log('    because it is missing. Nothing here is auto-resolved — read the item.')
console.log('⚠️  AND SECTION 5 IS THE HONEST LIMIT. This proves references are live and prints')
console.log('    baselines. It does not prove a behavioural premise still holds.\n')
console.log('⚠️  AND SECTION 6 PROVES A PREDICATE STILL EXECUTES, NOT THAT IT ASKS THE RIGHT')
console.log('    QUESTION. `FIRSTRUN-MARATHON-01` read open for 33 days with a predicate that ran')
console.log('    fine. A correct question and a plausible one look identical from here.\n')
console.log('⚠️  AND SECTION 7 CANNOT FIND A 🔻 THAT SHOULD HAVE BEEN A 🔺. Whether a cost was')
console.log('    ACCEPTED or merely NOTED is a judgement; 425 existing 🔻 stay as they are.\n')
console.log('⚠️  AND SECTION 8 CANNOT SEE A SECOND HEADING WRONGLY MARKED AS THE ARCHIVE.')
console.log('    The marker is prose a human writes, so putting it on a live filing silences')
console.log('    this arm by hand. It catches the UNMARKED duplicate — the one nobody chose')
console.log('    to create, which is the one that half-closes an item in silence.\n')
const residualFail = resNoId.length + resNotOpen.length
  + (resSentinelFail ? 1 : 0)
  + (!resOk.length && !resNoId.length && !resNotOpen.length && !resSentinelFail ? 1 : 0)
process.exit(deadFiles.length + deadSyms.length + untagged.length + deadContractRefs.length
  + predStale.length + residualFail + dupRows.length > 0 ? 1 : 0)
