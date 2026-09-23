// review-coaching.ts — the whole coaching measurement protocol, in order, once.
//
//   npm run review:coaching            # the full protocol
//   npm run review:coaching -- --fast  # skip the two slow corpus runs
//
// ── WHY ONE COMMAND ────────────────────────────────────────────────────────
// There are eight measurement commands. `coaching-rulings.md` listed FOUR of
// them as "how to re-run the review and compare like with like", and that list
// went stale the moment `review:cohort` and `measure:fitness` existed. A
// protocol written in prose in one document, executed by hand in another order
// each time, is not a protocol — it is a memory test, and this repo has
// recorded what happens to those.
//
// ⚠️ IT RUNS THEM, IT DOES NOT REIMPLEMENT THEM. Each step shells out to the
// npm script that owns that question. A second copy of any of these measures is
// the DELOAD-OWNER-01 shape and would drift within a week.
//
// ── WHAT THE SCORECARD IS FOR ──────────────────────────────────────────────
// Every step already prints its own answer and its own delta. What no step can
// do is say whether the PRODUCT got better, because each answers a different
// question and three of them can be green while the fourth is the one that
// matters. The scorecard puts all of them on one page with the question each
// one answers written next to it.
//
// Exit 0 = every step passed. 1 = at least one moved or failed (named). 2 = a
// step could not run, which is NOT a pass.

import { spawnSync } from 'node:child_process'

const FAST = process.argv.includes('--fast')

interface Step {
  id: string
  question: string           // the question this step, and only this step, answers
  cmd: string
  slow?: boolean
  /** Pull the one line worth putting on the scorecard. */
  headline: (out: string) => string
}

/** ⚠️ ORDER IS NOT ARBITRARY. Generate first (a doctrine change that broke a
 *  case should be loud before anything else runs), then the population measures,
 *  then the corpus sweeps. A sweep failure after a generation failure tells you
 *  nothing you did not already know. */
const STEPS: Step[] = [
  {
    id: 'round',
    question: 'Does every canonical case and persona still generate a valid plan?',
    cmd: 'NODE_ENV=production npx tsx scripts/coaching-review-round.ts',
    headline: o => (o.match(/^.*generated with 0 error violations.*$/m)?.[0] ?? '').trim()
      || `${(o.match(/\|\s*✅/g) ?? []).length} clean, ${(o.match(/⛔ refused/g) ?? []).length} refused by design`,
  },
  {
    id: 'foundation',
    question: 'And do they still generate valid plans WITH a foundation block composed on?',
    cmd: 'NODE_ENV=production npx tsx scripts/foundation-review-round.ts',
    headline: o => {
      const c = o.match(/carrying a foundation block: \*\*(\d+)\*\*/)?.[1]
      const e = o.match(/error-severity violations: \*\*(\d+)\*\*/)?.[1]
      return c ? `${c} plans carried a block, ${e} violations` : ''
    },
  },
  {
    id: 'envelope',
    question: 'What share of the weighted population gets a plan we would hand over?',
    cmd: 'npm run --silent measure:envelope',
    headline: o => (o.match(/^\s*WHOLE PRODUCT.*$/m)?.[0] ?? '').trim(),
  },
  {
    id: 'cohort',
    question: 'WHICH RUNNERS are failing, and what does a refused one actually receive?',
    cmd: 'npm run --silent review:cohort',
    headline: o => o.includes('unchanged against the baseline')
      ? 'unchanged, every band' : 'MOVED — see the table above',
  },
  {
    id: 'objections',
    question: 'Would a coach object to these plans, and at what rate?',
    cmd: 'npm run --silent audit:plans',
    slow: true,
    headline: o => (o.match(/^total findings across all cohorts: .*$/m)?.[0] ?? '').trim(),
  },
  {
    id: 'fitness',
    question: 'Do these plans actually BUILD the runner, far enough to finish safely?',
    cmd: 'npm run --silent measure:fitness',
    slow: true,
    // The cohort table is the answer; the per-persona list below it is detail.
    // The first cut grabbed the LAST line of output, which is one arbitrary
    // persona — a headline that changes when the list is reordered is not a
    // headline.
    headline: o => {
      const rows = Array.from(o.matchAll(/^\s{2}(INJURY|healthy)\s+(\S+)\s+\d+\s+\S+\s+([\d.]+%)/gm))
      if (!rows.length) return ''
      const worst = rows.map(m => ({ c: `${m[1]} ${m[2]}`, nb: parseFloat(m[3]) }))
        .sort((a, b) => b.nb - a.nb)[0]
      return `worst never-builds: ${worst.c} ${worst.nb}%`
    },
  },
]

const line = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n)

console.log(`\n══ COACHING MEASUREMENT PROTOCOL ══  ${new Date().toISOString().slice(0, 10)}${FAST ? '  (--fast)' : ''}\n`)
console.log('Doctrine: docs/canonical/coaching-measurement.md\n')

interface Result { step: Step; code: number; headline: string; skipped?: boolean }
const results: Result[] = []

for (const step of STEPS) {
  if (FAST && step.slow) { results.push({ step, code: 0, headline: 'skipped (--fast)', skipped: true }); continue }
  process.stdout.write(`→ ${step.id} … `)
  const r = spawnSync(step.cmd, { shell: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`
  const code = r.status ?? 2
  let headline = ''
  try { headline = step.headline(out) } catch { headline = '' }
  results.push({ step, code, headline: headline || (code === 0 ? 'ok' : 'see output') })
  console.log(code === 0 ? 'ok' : `EXIT ${code}`)
  // A failing step prints its own diagnosis. Swallowing it to keep the
  // scorecard tidy would make this command less useful than running them by
  // hand, which is the only reason anyone would stop using it.
  if (code !== 0) console.log(out.split('\n').slice(-25).join('\n'))
}

console.log(`\n${'─'.repeat(100)}`)
console.log(`${line('STEP', 12)}│ ${line('THE QUESTION IT ANSWERS', 58)}│ RESULT`)
console.log(`${'─'.repeat(100)}`)
for (const r of results) {
  const mark = r.skipped ? '·' : r.code === 0 ? '✓' : '✗'
  console.log(`${mark} ${line(r.step.id, 10)}│ ${line(r.step.question, 58)}│ ${r.headline}`)
}
console.log(`${'─'.repeat(100)}`)

// ⚠️ THE NEGATIVE SPACE IS PART OF THE OUTPUT, NOT A README FOOTNOTE.
// Every completion claim in this repo carries one line saying what it does not
// prove. A scorecard that prints only green ticks is how "all clear" comes to
// mean "the things this script looks at are fine" without anyone noticing the
// difference.
console.log(`
⚠️  WHAT NONE OF THESE CAN SEE
    · Nothing has run on a device. Every number here is a generated plan.
    · Nothing measures whether a §118 get-running plan builds the runner WELL,
      only that it validates (§118 chair's known gap, still open).
    · Coach objections are measured on plans WITHOUT a foundation block
      (HARNESS-COMPOSE-GAP-01) — the error-severity half is covered, this is not.
    · The population weights are ASSUMPTIONS with written reasons, not
      observations. Production has a handful of plans and zero recorded refusals.
    · A green run means no measured rate moved. It does not mean the engine
      improved, and a rate that moves because a DEFINITION moved is a correction,
      never an improvement (ZERO-REJECTION-SERVED-01).`)

const failed = results.filter(r => !r.skipped && r.code !== 0)
if (failed.length) {
  console.log(`\n✗ ${failed.length} step(s) failed or moved: ${failed.map(f => f.step.id).join(', ')}`)
  console.log('  A move is not automatically wrong. It is automatically something to DECLARE.')
  process.exit(failed.some(f => f.code === 2) ? 2 : 1)
}
console.log('\n✓ every step passed; no measured rate moved.')
