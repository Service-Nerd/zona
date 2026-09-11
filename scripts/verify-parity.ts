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

const EXPECTED_ROWS =
  DISTANCES.length * RACE_DATES.length * LEVELS.length *
  DAYS.length * INJURIES.length * VOLUMES.length * TIERS.length

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
              for (const tier of TIERS) {
                const input = {
                  goal: 'finish', age: 40, resting_hr: 55, max_hr: 180,
                  preferred_long_run_day: 'sun',
                  race_date, race_distance_km, current_weekly_km,
                  longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
                  days_available, fitness_level, injury_history,
                }
                const key = [race_distance_km, race_date, fitness_level, days_available,
                  injury_history.join('+') || 'none', current_weekly_km, tier].join('|')
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
  return m
}

async function main(): Promise<void> {
  if (process.argv.includes('--probe')) return probe()

  const repo = resolve(__dirname, '..')
  const baseRef = process.argv[2] ?? 'HEAD~1'
  const baseSha = run('git', ['rev-parse', '--short', baseRef], repo).trim()
  const headSha = run('git', ['rev-parse', '--short', 'HEAD'], repo).trim()

  if (baseSha === headSha) {
    console.error(`✗ ${baseRef} resolves to HEAD (${headSha}). Nothing to compare.`)
    process.exit(2)
  }

  console.log(`Plan-generation parity`)
  console.log(`  baseline : ${baseSha} (${baseRef})`)
  console.log(`  head     : ${headSha}`)
  console.log(`  cases    : ${EXPECTED_ROWS}\n`)

  const self = join(repo, 'scripts', 'verify-parity.ts')
  const wt = mkdtempSync(join(tmpdir(), 'zonna-parity-'))
  let created = false

  try {
    console.log('→ generating at HEAD')
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
      console.log(`  Generation is provably unaffected between ${baseSha} and ${headSha}.`)
      return
    }

    console.log(`✗ ${changed.length} of ${EXPECTED_ROWS} cases CHANGED.\n`)
    console.log('  key = distance|race|level|days|injuries|volume|tier\n')
    for (const k of changed.slice(0, 25)) {
      console.log(`  ${k}`)
      console.log(`     ${baseSha}: ${base.get(k)}`)
      console.log(`     ${headSha}: ${head.get(k)}`)
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
