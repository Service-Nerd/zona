/**
 * verify-parity — did this change alter what the engine generates?
 *
 *   npm run verify:parity            # vs HEAD~1
 *   npm run verify:parity <commit>   # vs any commit/branch/tag
 *
 * WHY THIS EXISTS. `npm run verify` proves generated plans are VALID (matrix,
 * sweep, invariants). It cannot tell you whether they are UNCHANGED — a plan can
 * be different and still pass every invariant. After a refactor in `lib/plan/`,
 * "no new violations" is not the same claim as "identical output", and the
 * second one is usually what you actually want to assert.
 *
 * HOW IT WORKS. Checks the baseline commit out into a throwaway git worktree,
 * COPIES ITSELF in, and runs the same grid on both sides in `--probe` mode.
 * Self-copying is the point: if each side ran its own version of the grid, the
 * comparison would be meaningless the moment the grid changed.
 *
 * TWO TRAPS IT IS BUILT TO AVOID, both hit for real while developing it:
 *
 *   1. VOLATILE FIELDS. The first version hashed the whole plan including
 *      `meta.generated_at`, a wall-clock stamp. It reported all 2592 plans as
 *      changed when nothing had changed at all. Volatile fields are stripped
 *      below; add to STRIP_META if a new one appears.
 *
 *   2. COMPARING NOTHING. A comparison of two empty outputs reports "identical"
 *      and is the most dangerous possible result. This asserts both sides
 *      produced the expected number of rows with a matching key set, and exits
 *      non-zero if not. (This repo has shipped a "successful" regression
 *      comparison that ran on two empty files. Once is enough.)
 *
 *   3. COMPARING HALF THE ENGINE — found 2026-09-13, and it had been true since
 *      this script was written. The grid hardcoded `goal: 'finish'`, so all 2,916
 *      cases ran ONE branch. Everything gated on `goal === 'time_target'` was
 *      invisible: §22's goal-pace renames, §24b/§24c's segmented long runs, §25's
 *      race-specific long runs, goal-paced quality, and the maintenance-label
 *      logic. LR-SEGMENT-RECORDED-§25 changed §25's producer, the golden snapshots
 *      caught it in four lines, and this script reported "IDENTICAL — 2916 cases,
 *      byte-for-byte unchanged" with total confidence.
 *
 *      Note that trap 2's guard did not help and could not have: row COUNT says
 *      nothing about input COVERAGE. 2,916 rows of the same branch is still one
 *      branch. `goal` is now an axis (×2 → 5,832), with a realistic per-distance
 *      `target_time` so the time-target plans are the ones a runner would get.
 *
 * NOT part of `npm run verify`: it needs a baseline commit and creates a
 * worktree, so it is an on-demand check, not a gate.
 */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, copyFileSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

// ── The grid ────────────────────────────────────────────────────────────────
// Deliberately spans the axes most likely to hide a regression: every distance
// (free and paid), both tiers, injury profiles (so injury-adaptation changes
// show up), and volumes that straddle the §44 refusal thresholds. Refusals are
// compared too — an input that used to be refused and now generates, or vice
// versa, is exactly the kind of silent change this is looking for.
const PLAN_START = '2026-09-14'                     // pinned Monday, never `new Date()`
const RACE_DATES = ['2026-12-06', '2027-01-17', '2027-03-28']
const DISTANCES = [5, 10, 21.1, 42.2, 50, 100]
const LEVELS = ['beginner', 'intermediate', 'experienced'] as const
const DAYS = [3, 4, 5]
const INJURIES: string[][] = [[], ['knee'], ['shin']]
const VOLUMES = [15, 30, 55]
const TIERS = ['free', 'paid'] as const

// Both goal branches. `finish` and `time_target` diverge early and widely — see
// trap 3 above. The target times are realistic mid-pack goals for each distance,
// because an absurd one gets refused by §44 and would silently test nothing.
const TARGET_TIMES: Record<number, string> = {
  5: '0:25:00', 10: '0:52:00', 21.1: '1:55:00',
  42.2: '4:00:00', 50: '6:00:00', 100: '14:00:00',
}
const GOALS = ['finish', 'time_target'] as const

// PARITY-HSR-01 (2026-09-16) — `hard_session_relationship` was not varied AT
// ALL (grepped: 0 occurrences), so every run reported on a single value of it.
//
// ⚠️ THAT IS NOT A COSMETIC GAP. Four principles key off this input across 13
// call sites in `ruleEngine.ts` — §35's earned long-run tier (`love`), §47's
// consecutive-peak exception (`love`), §96's brake and Z2 cue (`overdo`) and
// §110's cap, dose and onset brake (`avoid`). §110 came back "IDENTICAL, 5832
// cases" on the very change that rewrote what an `avoid` runner is prescribed,
// which is the trap this file's own header warns about: IDENTICAL is not the
// same as VERIFIED, and a clean parity run is only evidence for the inputs the
// grid actually varies.
//
// A NINTH CARTESIAN AXIS WOULD BE THE WRONG FIX — 4x on an already slow check,
// to re-test 5,832 combinations against a lever that reads one field. Instead
// the main grid is untouched and a focused block is APPENDED: every distance x
// level x goal, at one race date / day count / volume, for the three non-default
// values. 108 rows on 5,832 (+1.9%) and every hsr-sensitive principle is
// exercised at every distance.
//
// Both sides of a parity run execute the SAME copy of this script (the
// orchestrator copies itself into the baseline worktree), so widening the key
// is safe — there is no stored baseline to invalidate.
const HSR_EXTRA = ['love', 'overdo', 'avoid'] as const

/**
 * The key's field order, in one place. Both the axis-coverage guard and the
 * changed-by-axis report read positions out of the key, and until now each
 * carried its own copy of the layout — so appending `hsr` after `goal` silently
 * broke the guard (it asserted coverage with `endsWith('|finish')`, which stops
 * being true the moment anything follows `goal`). Two readers of one layout get
 * one definition.
 */
const KEY_FIELDS = ['distance', 'race', 'level', 'days', 'injuries',
  'volume', 'tier', 'goal', 'hsr'] as const
const keyField = (k: string, name: typeof KEY_FIELDS[number]) =>
  k.split('|')[KEY_FIELDS.indexOf(name)]

const EXPECTED_ROWS =
  DISTANCES.length * RACE_DATES.length * LEVELS.length *
  DAYS.length * INJURIES.length * VOLUMES.length * TIERS.length * GOALS.length
  + DISTANCES.length * LEVELS.length * GOALS.length * HSR_EXTRA.length

/** Wall-clock / run-scoped fields. Present on both sides, different every run. */
const STRIP_META = ['generated_at', 'created_at', 'updated_at']

async function probe(): Promise<void> {
  // Imported lazily so the orchestrator never loads the engine itself.
  const { generateRulePlan } = await import('../lib/plan/ruleEngine')
  const rows: string[] = []

  for (const race_distance_km of DISTANCES)
    for (const race_date of RACE_DATES)
      for (const fitness_level of LEVELS)
        for (const days_available of DAYS)
          for (const injury_history of INJURIES)
            for (const current_weekly_km of VOLUMES)
              for (const tier of TIERS)
              for (const goal of GOALS) {
                const input = {
                  goal, age: 40, resting_hr: 55, max_hr: 180,
                  preferred_long_run_day: 'sun',
                  ...(goal === 'time_target' ? { target_time: TARGET_TIMES[race_distance_km] } : {}),
                  race_date, race_distance_km, current_weekly_km,
                  longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
                  days_available, fitness_level, injury_history,
                }
                const key = [race_distance_km, race_date, fitness_level, days_available,
                  injury_history.join('+') || 'none', current_weekly_km, tier, goal,
                  // The main grid sends no `hard_session_relationship` at all;
                  // 'unset' is the honest label for that, not 'neutral'.
                  'unset'].join('|')
                try {
                  const plan: any = generateRulePlan(input as any, tier as any, PLAN_START)
                  const stable = JSON.parse(JSON.stringify(plan))
                  for (const f of STRIP_META) {
                    if (stable?.meta) delete stable.meta[f]
                    delete stable[f]
                  }
                  rows.push(`${key}\tOK\t${createHash('sha256')
                    .update(JSON.stringify(stable)).digest('hex').slice(0, 16)}`)
                } catch (e: any) {
                  // A refusal is a result. Compare the reason, not just the fact.
                  rows.push(`${key}\tREFUSED\t${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 140)}`)
                }
              }

  // ── PARITY-HSR-01 block — see HSR_EXTRA above for why this is appended
  // rather than folded into the cartesian product.
  for (const race_distance_km of DISTANCES)
    for (const fitness_level of LEVELS)
      for (const goal of GOALS)
        for (const hard_session_relationship of HSR_EXTRA) {
          const race_date = RACE_DATES[0]
          const days_available = 5
          const current_weekly_km = 30
          const tier = 'paid'
          const input = {
            goal, age: 40, resting_hr: 55, max_hr: 180,
            preferred_long_run_day: 'sun',
            ...(goal === 'time_target' ? { target_time: TARGET_TIMES[race_distance_km] } : {}),
            race_date, race_distance_km, current_weekly_km,
            longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
            days_available, fitness_level, injury_history: [],
            hard_session_relationship,
          }
          const key = [race_distance_km, race_date, fitness_level, days_available,
            'none', current_weekly_km, tier, goal, hard_session_relationship].join('|')
          try {
            const plan: any = generateRulePlan(input as any, tier as any, PLAN_START)
            const stable = JSON.parse(JSON.stringify(plan))
            for (const f of STRIP_META) {
              if (stable?.meta) delete stable.meta[f]
              delete stable[f]
            }
            rows.push(`${key}\tOK\t${createHash('sha256')
              .update(JSON.stringify(stable)).digest('hex').slice(0, 16)}`)
          } catch (e: any) {
            rows.push(`${key}\tREFUSED\t${String(e?.message ?? e).replace(/\s+/g, ' ').slice(0, 140)}`)
          }
        }

  rows.sort()
  process.stdout.write(rows.join('\n') + '\n')
}

function run(cmd: string, args: string[], cwd: string): string {
  return execFileSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
}

function parse(out: string, side: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const [k, status, v] = line.split('\t')
    m.set(k, `${status}\t${v}`)
  }
  // Trap 2: never let an empty or truncated run masquerade as agreement.
  if (m.size !== EXPECTED_ROWS) {
    console.error(`\n✗ ${side} produced ${m.size} rows, expected ${EXPECTED_ROWS}.`)
    console.error('  Refusing to compare — an incomplete run cannot prove parity.')
    process.exit(2)
  }
  // Trap 3: row COUNT is not input COVERAGE. The grid ran 2,916 rows of a single
  // `goal` branch for months and reported IDENTICAL across a change it could not
  // see. A count guard cannot catch that — only asserting the axis is actually
  // varied can. Cheap, and it fails the moment someone narrows the grid again.
  // Read by POSITION, not by suffix. The suffix form asserted coverage only
  // while `goal` happened to be the last field, and quietly stopped asserting
  // anything when `hsr` was appended after it — a coverage guard that fails
  // open is worse than none, which is the exact lesson trap 3 records.
  for (const g of GOALS) {
    if (!Array.from(m.keys()).some(k => keyField(k, 'goal') === g)) {
      console.error(`\n✗ ${side} produced no \`${g}\` rows.`)
      console.error('  Refusing to compare — a grid that runs one branch cannot prove parity for the other.')
      process.exit(2)
    }
  }

  // PARITY-HSR-01 — the same assertion for the axis this file was blind to.
  // Without it, someone narrowing the HSR block back out would restore the
  // original gap and every run would still print IDENTICAL.
  for (const h of HSR_EXTRA) {
    if (!Array.from(m.keys()).some(k => keyField(k, 'hsr') === h)) {
      console.error(`\n✗ ${side} produced no \`${h}\` rows.`)
      console.error('  Refusing to compare — hard_session_relationship drives §35, §47, §96 and §110,')
      console.error('  and a grid that pins it cannot prove parity for the runners those rules govern.')
      process.exit(2)
    }
  }
  return m
}

async function main(): Promise<void> {
  if (process.argv.includes('--probe')) return probe()

  const repo = resolve(__dirname, '..')
  const baseRef = process.argv[2] ?? 'HEAD~1'
  const baseSha = run('git', ['rev-parse', '--short', baseRef], repo).trim()
  const headSha = run('git', ['rev-parse', '--short', 'HEAD'], repo).trim()

  // The "current" side runs from the REPO DIRECTORY, so it executes whatever is
  // in the working tree — uncommitted edits included. That is the behaviour you
  // want (you are usually checking work you have not committed yet), but the
  // report used to name two commit shas, which reads as "I compared these two
  // commits" and is false the moment the tree is dirty. Say which it was.
  const dirty = run('git', ['status', '--porcelain'], repo).trim().length > 0
  const headLabel = dirty ? `working tree (on top of ${headSha})` : headSha

  if (baseSha === headSha && !dirty) {
    console.error(`✗ ${baseRef} resolves to HEAD (${headSha}) and the tree is clean. Nothing to compare.`)
    process.exit(2)
  }

  console.log(`Plan-generation parity`)
  console.log(`  baseline : ${baseSha} (${baseRef})`)
  console.log(`  current  : ${headLabel}`)
  console.log(`  cases    : ${EXPECTED_ROWS}\n`)

  const self = join(repo, 'scripts', 'verify-parity.ts')
  const wt = mkdtempSync(join(tmpdir(), 'zonna-parity-'))
  let created = false

  try {
    console.log(`→ generating from the ${dirty ? 'working tree' : 'current commit'}`)
    const headOut = run('npx', ['tsx', '--tsconfig', 'tsconfig.json', self, '--probe'], repo)

    console.log(`→ checking out ${baseSha} into a worktree`)
    run('git', ['worktree', 'add', '--detach', wt, baseSha], repo)
    created = true

    // The baseline commit has no node_modules of its own, and may not even
    // contain this script — so bring both in from HEAD.
    const nm = join(wt, 'node_modules')
    if (!existsSync(nm)) symlinkSync(join(repo, 'node_modules'), nm, 'dir')
    copyFileSync(self, join(wt, 'scripts', 'verify-parity.ts'))

    console.log(`→ generating at ${baseSha}\n`)
    const baseOut = run('npx', ['tsx', '--tsconfig', 'tsconfig.json',
      join(wt, 'scripts', 'verify-parity.ts'), '--probe'], wt)

    const head = parse(headOut, 'HEAD')
    const base = parse(baseOut, baseSha)

    // Array.from, not [...spread] — the repo's tsconfig target rejects
    // spreading a Map iterator (the same note is in CLAUDE.md for Set).
    const changed = Array.from(base.keys()).filter(k => base.get(k) !== head.get(k))

    if (changed.length === 0) {
      console.log(`✓ IDENTICAL — ${EXPECTED_ROWS} cases, byte-for-byte unchanged.`)
      console.log(`  Generation is provably unaffected between ${baseSha} and ${headLabel}.`)
      return
    }

    console.log(`✗ ${changed.length} of ${EXPECTED_ROWS} cases CHANGED.\n`)
    console.log('  key = distance|race|level|days|injuries|volume|tier|goal\n')

    // WHERE the change landed, not just how much. Only 25 keys are printed
    // below, so without this a 900-case diff cannot be checked for containment
    // — "did my ultra-only change touch a 10K plan?" is exactly the question a
    // parity run should answer, and counting a truncated list cannot answer it.
    const AXES = ['distance', 'race', 'level', 'days', 'injuries', 'volume', 'tier', 'goal', 'hsr']
    console.log('  changed cases by axis:')
    for (let i = 0; i < AXES.length; i++) {
      const axis = AXES[i]
      const tally = new Map<string, number>()
      for (const k of changed) {
        const v = k.split('|')[i]
        tally.set(v, (tally.get(v) ?? 0) + 1)
      }
      const all = new Map<string, number>()
      for (const k of Array.from(head.keys())) {
        const v = k.split('|')[i]
        all.set(v, (all.get(v) ?? 0) + 1)
      }
      const parts = Array.from(all.keys()).map(v => {
        const c = tally.get(v) ?? 0
        return `${v}=${c}/${all.get(v)}`
      })
      console.log(`    ${axis.padEnd(9)} ${parts.join('  ')}`)
    }
    console.log('')
    for (const k of changed.slice(0, 25)) {
      console.log(`  ${k}`)
      console.log(`     ${baseSha}: ${base.get(k)}`)
      console.log(`     ${headLabel}: ${head.get(k)}`)
    }
    if (changed.length > 25) console.log(`\n  ...and ${changed.length - 25} more.`)
    console.log(`\n  If this was intended, say so explicitly and record WHY.`)
    console.log(`  If it was not, you just caught a silent prescription change.`)
    process.exitCode = 1
  } finally {
    if (created) {
      try { run('git', ['worktree', 'remove', '--force', wt], repo) } catch { /* best effort */ }
      run('git', ['worktree', 'prune'], repo)
    }
    rmSync(wt, { recursive: true, force: true })
  }
}

main().catch(err => { console.error(err); process.exit(2) })
