/* PINNED-CLOCK-RUNWAY-01 — "will this suite be red next month for no reason?"
 *
 * 🔴 WHY A HARNESS AND NOT A SWEEP, WITH THE NUMBER THAT SETTLED IT.
 *
 * The item asked for a sweep: pin `todayOverride` on every at-risk `generateRulePlan` call.
 * 📐 Re-measured 2026-11-10 — **162 test files / 554 call sites** pass `planStart` and not
 * `todayOverride` (the item said 136 / 451), of which **44 files / 161 sites** mention a
 * runway signal. **Then the clock was actually moved: all 44 files pass at +3, +7, +14, +28,
 * +56, +120, +240 and +365 days.** Pinning 161 sites would be churn against no demonstrated
 * defect, and the item's own text warns that a blanket gate *"gets switched off"*.
 *
 * ⚠️ THE INCIDENT WAS REAL AND IS WHY THIS EXISTS. On 2026-11-09 four tests in two files went
 * red on a date roll with no code change — third instance of the `PINNED-CLOCK-01` family.
 * Those sites were pinned, so the class is LATENT, not gone. **A harness tells you the day it
 * stops being latent; a sweep only tells you about the sites someone thought of.**
 *
 * ⚙️ HOW. Re-runs a population at a shifted WALL CLOCK (`Date` is replaced; timers are not) and
 * fails if anything that passes today fails under the shift. A pinned `planStart` must behave
 * identically; whatever moves was reading `new Date()`.
 *
 * POPULATION — DERIVED, NEVER LISTED, and both figures are printed so the narrowing is visible:
 *   default   the at-risk subset: a test file that calls the engine without a pinned clock AND
 *             mentions a runway signal (foundation / prep_time / weeks.length / runway).
 *   --all     every test file that calls `generateRulePlan` or `runEngine` at all.
 *
 * ⏱️ COST, MEASURED: the at-risk subset is **51 files / 537 tests / ~20 s** per shift (so the
 * four default shifts are ~80 s); `--all`
 * is **218 files / 1,928 tests / 3 m 24 s** per shift. That is why the default is the subset and
 * why this is a `verify` / pre-push check rather than a per-commit one.
 *
 * 🔻 DECLARED LIMIT. The default population is a HEURISTIC: a file with no runway signal can
 * still expire (a benchmark ageing against §10's ramp is the recorded example, and
 * `pinnedClock.test.ts` owns that rule separately). `--all` is the honest population and it is
 * one flag away. ⚠️ And a shift only finds what a shift reaches: a test that breaks on a
 * specific calendar boundary between two probed offsets is invisible here.
 *
 *   npm run check:clock              # at-risk subset, +7 / +30 / +90 / +365 days
 *   npm run check:clock -- --all     # every engine-calling test file
 *   npm run check:clock -- --days 7,30,90
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { callArgs } from '../lib/ops/splitTopLevelArgs'

const ALL = process.argv.includes('--all')
const daysArg = process.argv[process.argv.indexOf('--days') + 1]
const SHIFTS = process.argv.includes('--days') && daysArg
  ? daysArg.split(',').map(Number).filter(n => Number.isFinite(n) && n > 0)
  // 🔴 FOUR SHIFTS, AND THE DEFAULT WAS TWO UNTIL A FALSIFICATION PROVED THEM INSUFFICIENT.
  // The planted clock-dependent fixture (a foundation runway that flips 0 → 3) is caught at
  // **+7d and missed at both +30d and +365d** — because the gap classification it crosses is a
  // boundary a few days wide, and a shift that steps over it lands back in the same class.
  // ⚠️ My own declared limit, *"a shift only finds what a shift reaches"*, was live in the
  // default. Four shifts span a week, a month, a quarter and a year at ~20 s each.
  : [7, 30, 90, 365]

const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => {
  const p = join(dir, n)
  if (n === 'node_modules' || n.startsWith('.')) return []
  return statSync(p).isDirectory() ? walk(p) : /\.test\.tsx?$/.test(n) ? [p] : []
})

/** Comments cannot vote: a docblock naming `foundation` is prose, not a risk signal. */
const strip = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))

/** A `generateRulePlan` call with a 3rd argument and no 5th — i.e. `planStart` pinned,
 *  `todayOverride` absent. `runEngine` is read by its named `today` key.
 *
 *  ⚠️ ARGUMENT SPLITTING IS `callArgs`'s JOB, NOT THIS FILE'S. The first cut wrote its own
 *  depth-tracking splitter with no quote state — the FOURTH such scanner in one day, found by
 *  `/code-review` in the same diff that fixed the third. 📐 Measured: the hole changes the count
 *  on exactly one file (`testClockIndependence.test.ts`, 6 against 4, whose case table holds
 *  `generateRulePlan(…)` inside strings), and no file dropped out of a population — latent in
 *  effect, real in kind, and a `)` inside a string would have truncated a call silently. */
function unpinnedEngineCalls(src: string): number {
  let n = 0
  for (const args of callArgs(src, 'generateRulePlan')) {
    const fifth = (args[4] ?? '').trim()
    if (args.length >= 3 && (fifth === '' || fifth === 'undefined')) n++
  }
  for (const m of Array.from(src.matchAll(/runEngine\s*\(\s*\{([\s\S]{0,400}?)\}\s*(?:as|\))/g))) {
    if (!/\btoday\s*:/.test(m[1]!)) n++
  }
  return n
}

const RISK = /foundation|prep_time|PrepTime|prepTime|weeks\.length|uncovered_runway|runway/

const all = ['lib', 'components', 'packages'].flatMap(d => { try { return walk(d) } catch { return [] } })
const engineTests = all.filter(f => {
  const s = strip(readFileSync(f, 'utf8'))
  return /generateRulePlan\s*\(|runEngine\s*\(/.test(s)
})
const unpinned = engineTests.filter(f => unpinnedEngineCalls(strip(readFileSync(f, 'utf8'))) > 0)
const atRisk = unpinned.filter(f => RISK.test(strip(readFileSync(f, 'utf8'))))
const population = ALL ? engineTests : atRisk

console.log('PINNED-CLOCK-RUNWAY-01 · clock-drift harness')
console.log(`  test files calling the engine          ${engineTests.length}`)
console.log(`  … with an UNPINNED clock               ${unpinned.length}`)
console.log(`  … and a runway signal (the default)    ${atRisk.length}`)
console.log(`  population this run                   ${population.length}  ${ALL ? '(--all)' : '(at-risk subset)'}`)
console.log(`  shifts                                ${SHIFTS.map(d => `+${d}d`).join(' ')}\n`)

// \U0001f534 AN EMPTY POPULATION MUST NOT PASS. It is the failure shape this repo records most.
if (population.length < 10) {
  console.error(`✗ POPULATION TOO SMALL (${population.length}). The derivation is broken, not the tree.`)
  process.exit(2)
}

// 🔴 INSIDE THE PROJECT, NOT `tmpdir()`, AND THE FIRST CUT USED `tmpdir()`. A vitest config
// in the system temp directory cannot resolve `vitest/config` — node module resolution walks up
// from the FILE, and that path has no `node_modules` above it — so every run died at startup and
// the harness reported `✗ +30d (no tally)`, i.e. a RED RESULT FROM A BROKEN HARNESS, which reads
// exactly like a real finding. `scripts/.tmp/` is gitignored and inside the project, so the
// generated config resolves and nothing is committed.
// ⚠️ `mkdirSync(…, { recursive: true })` FIRST, AND WITHOUT IT THIS CRASHED CI (/code-review,
// 2026-11-10). `scripts/.tmp/` is GITIGNORED, so it does not exist in a fresh checkout — and
// `check:clock` was added to `verify:ci` in the same commit, which the workflow runs. Every CI
// run would have died with `ENOENT: mkdtemp` before probing a single shift. **A gate that
// cannot run in CI is not a gate**, and this one would have taken the whole job down with it.
// Confirmed by moving the directory aside and watching it throw.
mkdirSync(join(process.cwd(), 'scripts', '.tmp'), { recursive: true })
const dir = mkdtempSync(join(process.cwd(), 'scripts', '.tmp', 'clock-'))
const setup = join(dir, 'shift.mjs')
writeFileSync(setup, `const R = Date
const S = Number(process.env.CLOCK_SHIFT_DAYS ?? '0') * 86400000
class D extends R {
  constructor(...a) { if (a.length === 0) super(R.now() + S); else super(...a) }
  static now() { return R.now() + S }
}
D.parse = R.parse; D.UTC = R.UTC
globalThis.Date = D
`)
const cfg = join(dir, 'vitest.clock.config.mts')
writeFileSync(cfg, `import base from ${JSON.stringify(join(process.cwd(), 'vitest.config.ts'))}
import { defineConfig, mergeConfig } from 'vitest/config'
export default mergeConfig(base, defineConfig({
  test: { root: ${JSON.stringify(process.cwd())}, setupFiles: [${JSON.stringify(setup)}] },
}))
`)

const run = (shiftDays: number) => {
  try {
    const out = execFileSync('npx',
      ['vitest', 'run', '--config', cfg, ...population],
      { encoding: 'utf8', env: { ...process.env, CLOCK_SHIFT_DAYS: String(shiftDays) }, stdio: 'pipe' })
    return { ok: true, out }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string }
    return { ok: false, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  }
}

// ⚠️ REMOVED ON EVERY EXIT PATH, including the two `process.exit`s below. Without this each
// `verify` run left another `scripts/.tmp/clock-*` behind (/code-review, 2026-11-10) — harmless
// but unbounded, and gitignored clutter is the kind nobody notices accumulating.
const cleanup = () => { try { rmSync(dir, { recursive: true, force: true }) } catch { /* best effort */ } }
process.on('exit', cleanup)

let failed = 0
for (const d of SHIFTS) {
  const { ok, out } = run(d)
  const tally = (out.match(/Tests {2}.*$/m) ?? ['(no tally)'])[0].trim()
  if (ok) { console.log(`  ✓ +${d}d  ${tally}`); continue }
  failed++
  console.log(`  ✗ +${d}d  ${tally}`)
  const lines = out.split('\n').filter(l => /^ ❯ .*failed|FAIL /.test(l))
  // 🔴 A HARNESS THAT CANNOT RUN MUST SAY SO, NOT REPORT A FINDING. The first cut printed
  // "(no tally)" and the failure banner for a vitest invocation that never started — a red
  // result from a broken harness reads exactly like a real defect, which is the shape this
  // repo records as the most expensive kind of wrong.
  if (!lines.length) {
    console.log('      ⚠️ NO FAILING TEST NAMED — the runner itself did not complete. Raw output:')
    for (const l of out.split('\n').filter(Boolean).slice(-20)) console.log(`      | ${l}`)
    console.log('      This is a BROKEN HARNESS, not a clock-dependent test. Fix the harness.')
    process.exit(2)
  }
  for (const l of lines.slice(0, 12)) console.log(`      ${l.trim()}`)
}

console.log('')
if (failed) {
  console.log('✗ A test that passes today fails at a shifted clock. It is reading `new Date()`.')
  console.log('  Pin the ENGINE’s clock, not just the plan’s calendar:')
  console.log('    generateRulePlan(input, tier, PINNED_PLAN_START, undefined, PINNED_PLAN_START)')
  console.log('    runEngine({ …, planStart: PINNED, today: PINNED })')
  console.log('  ⚠️ Pin it to the FILE’S OWN start, never a convenient date — "it went green" is')
  console.log('  not evidence the plan is the one you meant to assert on.')
  process.exit(1)
}
console.log('✓ No test’s verdict depends on the wall clock, at the shifts probed.')
console.log('⚠️  WHAT THIS DOES NOT PROVE')
console.log('    · The default population is a HEURISTIC. A file with no runway signal can still')
console.log('      expire — a benchmark ageing against §10’s ramp is the recorded example, and')
console.log('      `pinnedClock.test.ts` owns that rule. `--all` is the honest population.')
console.log('    · A shift only finds what a shift REACHES. A test that breaks on a calendar')
console.log('      boundary between two probed offsets is invisible here.')
