// scorecard.ts — Scorecard v2, the "never worse" bar (ADR-027 B0, ARCH-ENG-008).
//
//   npm run scorecard                                   # full run, compare against the baseline
//   npm run scorecard -- --fast                         # the plan-read step only, gate-sized sample
//   npm run scorecard -- --write --reason "<why>"       # re-baseline (full AND fast), reason recorded
//   npm run scorecard -- --corpus <module>#<export>     # another corpus provider (the golden corpus)
//   npm run scorecard -- --all                          # print every line, not only headlines + non-OK
//
// ── WHAT IT IS ──────────────────────────────────────────────────────────────
// ONE table and ONE baseline (`lib/plan/__fixtures__/scorecardBaseline.json`) over every measure
// we already have, plus the final plan read's defect predicates. Exit 1 if any line got WORSE.
//
// ⚠️ IT COMPOSES, IT DOES NOT REPLACE. The seven `review:coaching` steps (STEPS, imported from that
// script so there is one list), `cohort:shape` and `verify:strength` run as their owners run them,
// concurrently, and each keeps its own gate against its own baseline: the `.gate` line is that
// gate's exit. The numbers beside it are read from the same output. Only the plan-read step is new,
// and its predicates live in `lib/scorecard/predicates/`, one owner each.
//
// Exit 0 = nothing worse. 1 = at least one line WORSE / MOVED / NEW / MISSING / NOT MEASURED.
// 2 = the scorecard itself could not run.

import { spawn, execSync } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { STEPS } from './review-coaching'
import { ENVELOPE_PRODUCT_TOLERANCE, ENVELOPE_TOLERANCE } from '../lib/plan/envelopeMeasure'
import { existingCorpora } from '../lib/scorecard/corpora'
import { runPlanRead } from '../lib/scorecard/planRead'
import { compare, failing, readBaseline, renderTable, toBaselineLines, writeBaseline, BASELINE_PATH, type ScorecardBaseline } from '../lib/scorecard/ratchet'
import type { CorpusProvider, Line } from '../lib/scorecard/types'

const argv = process.argv.slice(2)
const flag = (f: string) => argv.includes(f)
const opt = (f: string) => { const k = argv.indexOf(f); return k >= 0 ? argv[k + 1] : undefined }
const FAST = flag('--fast'), WRITE = flag('--write'), ALL = flag('--all')
const REASON = opt('--reason')
const CORPUS = opt('--corpus')

if (WRITE && FAST) { console.error('--write re-baselines BOTH modes and needs the full run. Drop --fast.'); process.exit(2) }
if (WRITE && (!REASON || REASON.trim().length < 10)) { console.error('--write needs --reason "<why the baseline moves>" (10+ characters).'); process.exit(2) }

// ── Composed steps ────────────────────────────────────────────────────────
interface Shelled { id: string; cmd: string; lines: (out: string, code: number) => Line[] }
const num = (re: RegExp, s: string): number | null => { const m = re.exec(s); return m ? Number(m[1]) : null }
const gate = (id: string, code: number): Line => ({ id: `${id}.gate`, value: code === 0 ? 1 : 0, better: 'pass', headline: true })

function reviewStep(id: string): Shelled {
  const step = STEPS.find(s => s.id === id)
  if (!step) throw new Error(`review:coaching has no step "${id}" — STEPS changed; update scorecard.ts`)
  return { id: `review.${id}`, cmd: step.cmd, lines: (o, c) => [gate(`review.${id}`, c), ...(EXTRACT[id]?.(o) ?? [])] }
}

/** Numbers each step already prints, read back as lines. A parse that fails yields null, which
 *  reads NOT MEASURED and fails: a changed output format must not pass silently. */
const EXTRACT: Record<string, (o: string) => Line[]> = {
  foundation: o => [
    { id: 'review.foundation.plans_with_block', value: num(/carrying a foundation block: \*\*(\d+)\*\*/, o), better: 'stable' },
    { id: 'review.foundation.error_violations', value: num(/error-severity violations: \*\*(\d+)\*\*/, o), better: 'zero', headline: true },
  ],
  slow: o => {
    const g = /^GATE: .*?(\d+) slow-runner plans: (\d+) unrunnable goal pace, (\d+) floor breaches, (\d+) silent overruns, (\d+) error violations/m.exec(o)
    const v = (k: number) => (g ? Number(g[k]) : null)
    return [
      { id: 'review.slow.plans', value: v(1), better: 'stable' },
      { id: 'review.slow.unrunnable_goal_pace', value: v(2), better: 'lower', headline: true },
      { id: 'review.slow.floor_breaches', value: v(3), better: 'lower', headline: true },
      { id: 'review.slow.silent_overruns', value: v(4), better: 'lower', headline: true },
      { id: 'review.slow.error_violations', value: v(5), better: 'zero', headline: true },
    ]
  },
  envelope: o => {
    const out: Line[] = [{ id: 'review.envelope.product_fit_pct', value: num(/WHOLE PRODUCT\s+([\d.]+)%/, o), better: 'higher', tol: ENVELOPE_PRODUCT_TOLERANCE, headline: true }]
    for (const m of Array.from(o.matchAll(/^\s+([\d.]+)km\s+([\d.]+)%/gm)))
      out.push({ id: `review.envelope.fit_pct.${m[1]}km`, value: Number(m[2]), better: 'higher', tol: ENVELOPE_TOLERANCE.fitPct, headline: true })
    return out
  },
  objections: o => {
    const total = num(/^total findings across all cohorts: (\d+)/m, o)
    const out: Line[] = [{ id: 'review.objections.total', value: total, better: 'lower', headline: true }]
    const byCode: Record<string, number> = {}
    for (const sec of o.split(/^═══ /m).slice(1)) {
      const name = sec.slice(0, sec.indexOf(' ═══')).replace(/[^A-Za-z0-9]+/g, '_').replace(/_+$/, '')
      for (const m of Array.from(sec.matchAll(/^ {2}([A-Z][A-Z0-9-]+)\s+(\d+)\s+[\d.]+% of generated/gm))) {
        out.push({ id: `review.objections.${name}.${m[1]}`, value: Number(m[2]), better: 'lower' })
        byCode[m[1]] = (byCode[m[1]] ?? 0) + Number(m[2])
      }
    }
    for (const [k, v] of Object.entries(byCode)) out.push({ id: `review.objections.${k}`, value: v, better: 'lower', headline: true })
    return out
  },
}

const SHELLED: Shelled[] = [
  reviewStep('round'), reviewStep('foundation'), reviewStep('slow'), reviewStep('envelope'), reviewStep('cohort'), reviewStep('objections'),
  {
    // measure:fitness's own gate is planFitness.test.ts; the tolerances below are that test's.
    id: 'fitness', cmd: 'npm run --silent measure:fitness -- --json',
    lines: (o, c) => {
      const j = (() => { try { return JSON.parse(o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1)) } catch { return null } })() as
        { buckets: Record<string, { n: number; medianBuildPct: number; neverBuildsPct: number; medianMarathonLrPctOfRace: number | null }>; personas: { id: string; peakLr: number; refused: boolean }[] } | null
      if (!j) return [{ id: 'fitness.parsed', value: null, better: 'pass', headline: true }]
      const out: Line[] = [gate('fitness', c)]
      for (const [k, b] of Object.entries(j.buckets)) {
        const id = k.trim().replace(/\s+/g, '_')
        out.push({ id: `fitness.${id}.n`, value: b.n, better: 'stable' },
          { id: `fitness.${id}.never_builds_pct`, value: b.neverBuildsPct, better: 'lower', tol: 0.01, headline: true },
          { id: `fitness.${id}.median_build_pct`, value: b.medianBuildPct, better: 'higher', tol: 5, headline: true })
        if (b.medianMarathonLrPctOfRace != null) out.push({ id: `fitness.${id}.marathon_lr_pct`, value: b.medianMarathonLrPctOfRace, better: 'higher', tol: 3 })
      }
      for (const p of j.personas) if (!p.refused) out.push({ id: `fitness.persona.${p.id.split(' ')[0]}.peak_lr_km`, value: p.peakLr, better: 'higher', tol: 0.6 })
      return out
    },
  },
  {
    // cohort:shape has no exit gate of its own (cohortShape.test.ts is), so its lines carry that test's tolerances.
    id: 'cohort_shape', cmd: 'npm run --silent cohort:shape',
    lines: o => {
      const j = (() => { try { return JSON.parse(o.slice(o.indexOf('{'), o.lastIndexOf('}') + 1)) } catch { return null } })() as Record<string, number | Record<string, number>> | null
      if (!j) return [{ id: 'cohort_shape.parsed', value: null, better: 'pass', headline: true }]
      const out: Line[] = []
      for (const [k, v] of Object.entries(j)) {
        if (typeof v === 'number') out.push({ id: `cohort_shape.${k}`, value: v, better: 'stable', tol: /Pct$/.test(k) ? 0.5 : /Km$/.test(k) ? 0.3 : /^mean/.test(k) ? 0.05 : 0, headline: /Pct$|Km$/.test(k) })
        else for (const [d, x] of Object.entries(v)) out.push({ id: `cohort_shape.${k}.${d}`, value: x, better: 'stable', tol: 0.5 })
      }
      return out
    },
  },
  {
    id: 'strength', cmd: 'npm run --silent verify:strength',
    lines: (o, c) => [gate('strength', c),
      { id: 'strength.plans', value: num(/strength plans (\d+)/, o), better: 'stable' },
      { id: 'strength.violations', value: num(/· violations (\d+)/, o), better: 'zero', headline: true }],
  },
]

/** Children write to files, not pipes: the plan-read step holds this process's event loop for a
 *  minute or more, and a child blocked on a full pipe would serialise the "concurrent" run.
 *  NODE_ENV is removed so each step runs exactly as its own npm script runs it (several set it
 *  themselves; the rest must keep their development-mode throws). */
const OUT_DIR = mkdtempSync(join(tmpdir(), 'scorecard-'))
function run(id: string, cmd: string): Promise<{ out: string; code: number }> {
  return new Promise(res => {
    const file = join(OUT_DIR, `${id}.log`)
    const fd = openSync(file, 'w')
    const env: NodeJS.ProcessEnv = { ...process.env }
    delete (env as Record<string, unknown>).NODE_ENV
    const ch = spawn(cmd, { shell: true, env, stdio: ['ignore', fd, fd] })
    let settled = false
    const done = (code: number) => { if (settled) return; settled = true; closeSync(fd); res({ out: readFileSync(file, 'utf8'), code }) }
    ch.on('close', code => done(code ?? 2))
    ch.on('error', () => done(2))
  })
}

async function composed(): Promise<Line[]> {
  const t0 = Date.now()
  const results = await Promise.all(SHELLED.map(async s => {
    const r = await run(s.id, s.cmd)
    process.stdout.write(`  ${s.id.padEnd(20)} exit ${r.code}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`)
    try { return s.lines(r.out, r.code) } catch { return [{ id: `${s.id}.parsed`, value: null, better: 'pass', headline: true } as Line] }
  }))
  return results.flat()
}

async function provider(): Promise<{ name: string; p: CorpusProvider }> {
  if (!CORPUS) return { name: 'existing', p: existingCorpora }
  const [mod, exp = 'default'] = CORPUS.split('#')
  const m = await import(resolve(process.cwd(), mod)) as Record<string, unknown>
  const p = m[exp]
  if (typeof p !== 'function') throw new Error(`${mod} has no corpus provider export "${exp}"`)
  return { name: `${mod}#${exp}`, p: p as CorpusProvider }
}

async function main() {
  const t0 = Date.now()
  const { name: corpusName, p } = await provider()
  const key = (mode: 'full' | 'fast') => (corpusName === 'existing' ? mode : `${mode}:${corpusName}`)
  console.log(`\n══ SCORECARD v2 — never worse ══  ${new Date().toISOString().slice(0, 10)}  corpus: ${corpusName}${FAST ? '  (--fast: plan-read only)' : ''}\n`)

  const linesFor = async (mode: 'full' | 'fast'): Promise<{ lines: Line[]; examples: Record<string, string[]> }> => {
    const stepsP = mode === 'full' ? composed() : Promise.resolve([] as Line[])
    // The plan-read step runs in this process while the shelled steps run in theirs.
    await new Promise(r => setImmediate(r))
    const pr = runPlanRead(p(mode), { mode })
    process.stdout.write(`  plan-read (${mode})        ${pr.plansRead} plans read  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`)
    return { lines: [...(await stepsP), ...pr.lines], examples: pr.examples }
  }

  if (WRITE) {
    const full = await linesFor('full')
    const fast = await linesFor('fast')
    const prev = readBaseline()
    const b: ScorecardBaseline = {
      reason: REASON!, written_at: new Date().toISOString(),
      git_head: execSync('git rev-parse --short HEAD').toString().trim(),
      modes: { ...(prev?.modes ?? {}), [key('full')]: toBaselineLines(full.lines), [key('fast')]: toBaselineLines(fast.lines) },
    }
    const rows = compare(full.lines, prev?.modes[key('full')])
    console.log('\n' + renderTable(rows, { all: ALL }))
    writeBaseline(b)
    console.log(`\nbaseline written: ${BASELINE_PATH}\n  reason: ${REASON}\n  ${full.lines.length} full lines, ${fast.lines.length} fast lines, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    return 0
  }

  const mode = FAST ? 'fast' : 'full'
  const { lines, examples } = await linesFor(mode)
  const base = readBaseline()
  if (!base?.modes[key(mode)]) { console.log(`\nno baseline for mode "${key(mode)}": run with --write --reason "<why>"`); return 1 }
  const rows = compare(lines, base.modes[key(mode)])
  console.log('\n' + renderTable(rows, { all: ALL }))
  const bad = failing(rows)
  const exampleIds = bad.map(r => r.id.replace(/^planread\./, '').replace(/@.*$/, '')).filter(id => examples[id])
  for (const id of Array.from(new Set(exampleIds))) console.log(`\n  e.g. ${id}:\n    ${examples[id]!.join('\n    ')}`)
  console.log(`\n${lines.length} lines · baseline "${base.reason}" (${base.git_head}, ${base.written_at.slice(0, 10)}) · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
  console.log(`
⚠️  WHAT THIS DOES NOT PROVE
    · The population is the EXISTING corpora, sampled, not the production-shaped golden corpus.
    · A predicate counts a sentence or a shape it was written to see. A defect no predicate names is invisible.
    · A count that FALLS because a note's wording changed is a definition move, not an improvement.
    · Nothing here has run on a device, and no live plan is read.`)
  if (bad.length) { console.log(`\n✗ ${bad.length} line(s) not OK: ${bad.slice(0, 12).map(r => `${r.id} ${r.verdict}`).join(', ')}${bad.length > 12 ? ', …' : ''}`); return 1 }
  console.log('\n✓ never worse: no line regressed against the baseline.')
  return 0
}

main().then(c => process.exit(c), e => { console.error(e); process.exit(2) })
