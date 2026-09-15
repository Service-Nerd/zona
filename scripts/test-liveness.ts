// test-liveness.ts — TEST-LIVENESS-01.
//
// `invariant:liveness` deliberately breaks valid plans 46 ways and records which
// of the 79 invariants wake up. A rule nothing can wake is UNPROVEN, not proven
// dead. That protects the invariants.
//
// NOTHING PROTECTED THE 21 PRINCIPLES COVERED BY A NAMED TEST. A test can pass
// while asserting nothing that matters, and this repo has shipped exactly that
// more than once: `--section-gap`, the decorative-config family, D9's
// `flexShrink` that could never fire, §97's two inert gates. "Covered by a test"
// was a green tick nobody had tried to turn red.
//
// So this turns them red on purpose. It breaks the SOURCE each test claims to
// cover, one small change at a time, and re-runs only that test file:
//
//   mutation KILLED    the test failed -> it is live for that behaviour
//   mutation SURVIVED  the test passed -> the test is BLIND to that behaviour
//
// A surviving mutant is not automatically a bad test. Some mutations change
// nothing observable, and some change a behaviour the principle does not claim.
// Those live in the baseline WITH A REASON, same debt-register pattern as
// SWEEP-BASELINE-01 and the invariant-liveness baseline. What may not happen is
// the survivor count rising quietly.
//
// ⚠️ NOT IN `npm run verify`. This is minutes, not seconds, and a gate that slows
// every commit gets disabled — which this repo already records as equivalent to
// having no gate. It runs nightly.
//
// Run: npx tsx scripts/test-liveness.ts [--only <substring>]

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

// ── The map is DECLARED, never inferred ─────────────────────────────────────
//
// A "first import wins" heuristic works today and breaks silently the first time
// someone reorders an import block. Declaring it makes the pairing reviewable,
// and makes an unmapped test file a visible gap rather than an absent one.
const SUBJECTS: Record<string, string[]> = {
  'lib/coaching/cohortSimilarity.test.ts':          ['lib/coaching/runHistory.ts'],
  'lib/coaching/dayBoundary.test.ts':               ['lib/coaching/dayBoundary.ts'],
  'lib/coaching/limiter.test.ts':                   ['lib/coaching/limiter.ts'],
  'lib/coaching/postRaceRecoveryCurve.test.ts':     ['lib/coaching/postRaceReshape.ts'],
  'lib/coaching/prompts/sessionFeedback.test.ts':   ['lib/coaching/prompts/sessionFeedback.ts'],
  'lib/coaching/qualityDowngrade.test.ts':          ['lib/coaching/qualityDowngrade.ts'],
  'lib/coaching/readinessBaseline.test.ts':         ['lib/coaching/readinessBaseline.ts'],
  'lib/coaching/recalibrationPrompt.test.ts':       ['lib/coaching/recalibrationPrompt.ts'],
  'lib/coaching/reshapeMagnitude.test.ts':          ['lib/coaching/reshapeMagnitude.ts'],
  'lib/coaching/sessionScore.test.ts':              ['lib/coaching/sessionScore.ts'],
  'lib/plan/featureGates.test.ts':                  ['lib/plan/canUseFeature.ts'],
  'lib/plan/fitnessThresholds.test.ts':             ['lib/plan/fitnessAssessment.ts'],
  'lib/plan/inputRanges.test.ts':                   ['lib/plan/inputs.ts'],
  'lib/plan/taperRecalibration.test.ts':            ['lib/plan/taperRecalibration.ts'],
  'lib/planDateWindow.test.ts':                     ['lib/plan.ts'],
}

// Tests with NO mutable subject, recorded rather than silently absent.
const NO_SUBJECT: Record<string, string> = {
  'lib/coaching/raceProjectionHonesty.test.ts':
    'Asserts over PROMPT TEXT it builds inline; there is no separate module whose behaviour a '
    + 'mutation could change. Its own FALSIFICATION block is the liveness proof.',
  'lib/plan/raceResultWriteBoundary.test.ts':
    'A source-ORDER test: it reads app/api/post-race-reshape/route.ts as text. Mutating that '
    + 'source is what the test already does conceptually, and its `at()` helper fails loudly when '
    + 'an anchor disappears.',
  'lib/coaching/reframeCohort.test.ts':
    'Composes sessionRole + constants rather than owning a module; the behaviour it guards lives '
    + 'in classifiers already covered by invariant liveness.',
  'lib/plan/maintenanceNotePrescriptive.test.ts':
    'Subject is ruleEngine.ts (~7k lines). Mutating it at random produces mutants unrelated to §38 '
    + 'and drowns the signal. Its profile-flip assertions ARE the falsification: change the named '
    + 'input, the profile must move.',
}

/**
 * The byte ranges of the functions a given test actually imports from a subject.
 *
 * ⚠️ WITHOUT THIS THE REPORT IS NOISE, and the first full run proved it: 53 of 84
 * mutations "survived", and the worst offenders were tests written the same day
 * with dense, specific assertions. `inputs.ts` is 521 lines and its first
 * code-level `>=` sits at line 97 inside `alternativesFor` — a function
 * `inputRanges.test.ts` never calls. The test was not blind; the mutation was
 * out of scope. Measuring mutation of arbitrary code and calling it a verdict on
 * a test is the denominator error, one more time.
 *
 * So mutations are confined to the declarations the test names in its import
 * statement. A survivor then means what it should: the test calls this function,
 * the function's behaviour changed, and the test did not notice.
 */
function importedSymbols(testSrc: string, subject: string): string[] {
  const base = subject.replace(/^.*\//, '').replace(/\.ts$/, '')
  const out: string[] = []
  for (const m of Array.from(testSrc.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g))) {
    if (!m[2].endsWith('/' + base) && !m[2].endsWith(base)) continue
    for (const part of m[1].split(',')) {
      const name = part.replace(/\btype\b/, '').trim().split(/\s+as\s+/)[0].trim()
      if (name) out.push(name)
    }
  }
  return out
}

/** Byte spans of those declarations, by brace matching on masked source. */
function spansFor(src: string, symbols: string[]): Array<[number, number]> {
  const mask = maskNonCode(src)
  const spans: Array<[number, number]> = []
  for (const sym of symbols) {
    const re = new RegExp(`(?:export\\s+)?(?:async\\s+)?(?:function\\s+${sym}\\b|const\\s+${sym}\\s*[=:])`)
    const m = re.exec(mask)
    if (!m || m.index == null) continue
    let i = mask.indexOf('{', m.index)
    if (i < 0) continue
    let depth = 0
    for (let j = i; j < mask.length; j++) {
      if (mask[j] === '{') depth++
      else if (mask[j] === '}') { depth--; if (depth === 0) { spans.push([i, j]); break } }
    }
  }
  return spans
}

const inSpans = (i: number, spans: Array<[number, number]>) =>
  spans.length === 0 || spans.some(([a, b]) => i >= a && i <= b)

interface Mutation { name: string; apply: (src: string, spans: Array<[number, number]>) => string | null }

/**
 * Blank out comments and string literals, PRESERVING LENGTH so offsets still map
 * 1:1 onto the original.
 *
 * ⚠️ NOT OPTIONAL, and the first run proved it. `dayBoundary.ts` has 48 lines and
 * zero comparison operators, so the only mutation that applied was "perturb the
 * first numeric literal" — and the first numeric literal in that file is the
 * `65` in `CoachingPrinciples §65` on line 1, inside a comment. The harness
 * changed a section number in a comment, the test correctly did not care, and it
 * was reported as a SURVIVOR. A mutation that cannot change behaviour is not
 * evidence of a blind test; counting it as one fills the baseline with noise and
 * teaches you to ignore the report.
 */
function maskNonCode(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const two = src.slice(i, i + 2)
    if (two === '//') {
      const end = src.indexOf('\n', i); const stop = end < 0 ? src.length : end
      out += ' '.repeat(stop - i); i = stop; continue
    }
    if (two === '/*') {
      const end = src.indexOf('*/', i + 2); const stop = end < 0 ? src.length : end + 2
      out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue
    }
    const ch = src[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < src.length && src[j] !== ch) { if (src[j] === '\\') j++; j++ }
      const stop = Math.min(j + 1, src.length)
      out += src.slice(i, stop).replace(/[^\n]/g, ' '); i = stop; continue
    }
    out += ch; i++
  }
  return out
}

/**
 * Replace the Nth occurrence of `find` — one behaviour change at a time.
 * Located in the MASKED source so comments and strings are never targets, then
 * spliced into the real source at the same offset.
 */
const nth = (src: string, find: string, repl: string, n: number,
             spans: Array<[number, number]>): string | null => {
  const mask = maskNonCode(src)
  let i = -1, hit = 0
  while (true) {
    i = mask.indexOf(find, i + 1)
    if (i < 0) return null
    if (!inSpans(i, spans)) continue
    if (hit++ === n) break
  }
  return src.slice(0, i) + repl + src.slice(i + find.length)
}

const MUTATIONS: Mutation[] = [
  { name: 'flip first >= to >',   apply: (s, sp) => nth(s, ' >= ', ' > ', 0, sp) },
  { name: 'flip first <= to <',   apply: (s, sp) => nth(s, ' <= ', ' < ', 0, sp) },
  { name: 'flip first === to !==', apply: (s, sp) => nth(s, ' === ', ' !== ', 0, sp) },
  { name: 'flip second >= to >',  apply: (s, sp) => nth(s, ' >= ', ' > ', 1, sp) },
  { name: 'flip first && to ||',  apply: (s, sp) => nth(s, ' && ', ' || ', 0, sp) },
  { name: 'flip second && to ||', apply: (s, sp) => nth(s, ' && ', ' || ', 1, sp) },
  { name: 'flip first || to &&',  apply: (s, sp) => nth(s, ' || ', ' && ', 0, sp) },
  {
    name: 'perturb first numeric literal',
    // Skips 0 and 1: they are overwhelmingly indices and identity values, and
    // perturbing them produces crashes rather than behaviour changes.
    apply: (s, sp) => {
      const mask = maskNonCode(s)
      for (const m of Array.from(mask.matchAll(/(?<![\w.$])([2-9]\d*)(?![\w.])/g))) {
        if (m.index == null || !inSpans(m.index, sp)) continue
        return s.slice(0, m.index) + String(Number(m[1]) + 1) + s.slice(m.index + m[1].length)
      }
      return null
    },
  },
]

const only = process.argv.includes('--only')
  ? process.argv[process.argv.indexOf('--only') + 1] : null

function runsGreen(testFile: string): boolean {
  try {
    execFileSync('npx', ['vitest', 'run', testFile, '--silent'],
      { cwd: process.cwd(), stdio: 'pipe', timeout: 180_000 })
    return true
  } catch { return false }
}

interface Survivor { test: string; subject: string; mutation: string; site: string }

/** The line a mutation actually changed — recorded so review is cheap later. */
function mutationSite(original: string, mutated: string): string {
  const a = original.split('\n'), b = mutated.split('\n')
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return `L${i + 1}: ${(a[i] ?? '').trim().slice(0, 90)}`
  }
  return '(no line differed)'
}
const survivors: Survivor[] = []
const unreached: string[] = []
let killed = 0, inert = 0, testsChecked = 0

const entries = Object.entries(SUBJECTS).filter(([t]) => !only || t.includes(only))

console.log('TEST LIVENESS — break the source, and see whether the test notices.\n')

for (const [testFile, subjects] of entries) {
  // The test must be GREEN before it is meaningful to say a mutation killed it.
  if (!runsGreen(testFile)) {
    console.log(`  ✗ ${testFile} is already failing — skipped`)
    continue
  }
  testsChecked++
  const results: string[] = []
  let applied = 0

  for (const subject of subjects) {
    const path = join(process.cwd(), subject)
    const original = readFileSync(path, 'utf8')
    const symbols = importedSymbols(readFileSync(join(process.cwd(), testFile), 'utf8'), subject)
    const spans = spansFor(original, symbols)
    if (symbols.length && spans.length === 0) {
      console.log(`  ⚪ ${testFile.replace('lib/', '')} — imports ${symbols.join(', ')} but no `
        + 'declaration span was found; mutations would be unscoped, so none were applied')
      continue
    }
    try {
      for (const mut of MUTATIONS) {
        const mutated = mut.apply(original, spans)
        if (mutated == null || mutated === original) { inert++; continue }
        applied++
        writeFileSync(path, mutated)
        const stillGreen = runsGreen(testFile)
        if (stillGreen) {
          const site = mutationSite(original, mutated)
          survivors.push({ test: testFile, subject, mutation: mut.name, site })
          results.push(`SURVIVED: ${mut.name}  ${site}`)
        } else {
          killed++
        }
      }
    } finally {
      // ALWAYS restore, on any path. A harness that can leave the repo mutated
      // is worse than no harness.
      writeFileSync(path, original)
      if (readFileSync(path, 'utf8') !== original) {
        console.error(`\n!! FAILED TO RESTORE ${subject} — check git status before doing anything else`)
        process.exit(3)
      }
    }
  }

  const label = testFile.replace('lib/', '')
  // ⚠️ ZERO APPLIED MUTATIONS IS *UNPROVEN*, NOT PASSING, and the first version
  // of this line got it wrong: `dayBoundary.ts` has no comparison operator and no
  // code-level numeric literal, so the battery reached it 0 times and the report
  // said "every mutation killed". Reporting clean when nothing was checked is the
  // exact failure this harness exists to find, one layer up. Same distinction
  // invariant-liveness draws: a rule nothing can wake is unproven, not dead.
  if (applied === 0) {
    unreached.push(testFile)
    console.log(`  ⚪ ${label.padEnd(44)} UNPROVEN — the battery reaches this subject 0 times`)
  } else if (results.length === 0) {
    console.log(`  ✅ ${label.padEnd(44)} ${applied} mutation(s), all killed`)
  } else {
    console.log(`  ⚠️  ${label.padEnd(44)} ${results.length} of ${applied} survived`)
  }
  for (const r of results) console.log(`        ${r}`)
}

console.log('\n── unmutable by design ──')
for (const [t, why] of Object.entries(NO_SUBJECT)) {
  console.log(`  · ${t.replace('lib/', '')}\n      ${why}`)
}

// ── The debt register ───────────────────────────────────────────────────────
//
// Same pattern as SWEEP-BASELINE-01 and the invariant-liveness baseline: known
// survivors are tracked WITH A REASON so they are visible, and the count may
// only fall. A NEW survivor fails the run, so the next test that ships blind
// proves itself on the way in rather than joining a pile.
//
// A survivor is not automatically a bad test. Some mutants are equivalent —
// `FITNESS_RANK.experienced: 2 -> 3` changes a number nothing depends on
// absolutely, because only the ORDERING is asserted and only the ordering is
// real. Those belong here with that sentence attached, not in a backlog item.
const BASELINE_PATH = join(process.cwd(), 'scripts', '__fixtures__', 'testLivenessBaseline.json')
const key = (s: Survivor) => `${s.test.replace('lib/', '')} :: ${s.mutation}`
const found = survivors.map(key).sort()

if (process.argv.includes('--write')) {
  const existing: Record<string, string> = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).survivors ?? {} : {}
  const out: Record<string, string> = {}
  const siteOf = new Map(survivors.map(v => [key(v), v.site]))
  for (const k of found) {
    const prior = existing[k]
    out[k] = prior && !prior.startsWith('UNREVIEWED')
      ? prior
      : `UNREVIEWED — mutates ${siteOf.get(k)}`
  }
  writeFileSync(BASELINE_PATH, JSON.stringify({
    _: 'Mutations the covering test does NOT catch. May only SHRINK. Each needs a reason.',
    generated: new Date().toISOString().slice(0, 10),
    unproven: unreached.map(t => t.replace('lib/', '')),
    survivors: out,
  }, null, 1) + '\n')
  console.log(`\nbaseline written: ${found.length} survivors`)
}

let regressed: string[] = []
if (existsSync(BASELINE_PATH) && !process.argv.includes('--write')) {
  const base = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  const known = new Set(Object.keys(base.survivors ?? {}))
  regressed = found.filter(k => !known.has(k))
  const fixed = Array.from(known).filter(k => !found.includes(k))
  if (fixed.length) console.log(`\n✓ newly KILLED (remove from baseline): ${fixed.join(', ')}`)
  const bare = Object.entries(base.survivors ?? {})
    .filter(([, why]) => String(why).startsWith('UNREVIEWED')).map(([k]) => k)
  if (bare.length) console.log(`\n⚠️  ${bare.length} baseline entries still say UNREVIEWED`)
}

console.log(`\ntests checked ${testsChecked} · killed ${killed} · SURVIVED ${survivors.length}`
  + ` · UNPROVEN ${unreached.length} · inert mutations ${inert}`)
if (survivors.length) console.log('⚠️  SURVIVORS: those tests pass while the behaviour they name is broken.')
if (unreached.length) console.log(`⚪ UNPROVEN: ${unreached.map(t => t.replace('lib/', '')).join(', ')}`
  + '\n   The battery does not reach these subjects. Not evidence the test is good —'
  + '\n   evidence the harness cannot speak to it. Widen the mutations, or say why not.')
if (!survivors.length && !unreached.length) {
  console.log('✅ every behaviour-changing mutation was caught by the test that claims to cover it.')
}
if (regressed.length) {
  console.log(`\n✗ NEW survivors above the baseline:\n  ${regressed.join('\n  ')}`)
  console.log('\n  A test that claims to cover a principle and does not notice its behaviour')
  console.log('  changing is the green tick with nothing behind it. Fix the test, or add the')
  console.log('  entry WITH A REASON if the mutant is equivalent.')
  process.exit(1)
}
