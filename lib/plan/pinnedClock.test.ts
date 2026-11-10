// PINNED-CLOCK-01 (2026-10-26). `noteNamesBindingLever.test.ts` fixed `TODAY = '2026-09-21'` and a race 16 weeks
// later, but called `generateRulePlan(input, 'paid')`, so the engine measured prep time from the WALL CLOCK. On
// 2026-10-26 the race fell inside the 10-week marathon floor and three tests started failing with no code change.
// Three more files had the same shape and dates that would have run out within weeks.
//
// Rule: a test that declares a fixed date constant (`TODAY` / `START`) must hand it to `generateRulePlan` as the
// third argument. `input.plan_start` alone does not pin the engine's clock.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function tests(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    if (n === 'node_modules' || n.startsWith('.')) return []
    return statSync(p).isDirectory() ? tests(p) : /\.test\.tsx?$/.test(n) ? [p] : []
  })
}

/**
 * 🔴 A THIRD PATH, AND THIS GATE'S OWN BUILD-LOG ENTRY PREDICTED A GAP LIKE IT: *"the gate only knows two names for a
 * pinned date."* (GOALPACE-5K-CLOCK-01, 2026-11-07.)
 *
 * The arm above enforces PINNED-CLOCK-01's remedy: hand the fixed date to the engine. **That remedy is not
 * sufficient, and the insufficiency is by design.** `vdotFor`'s own comment states that `applyVdotDiscount` is handed
 * `new Date()` deliberately — §10's staleness ramp measures how long ago the runner actually RAN, which is a fact
 * about the wall clock and not about the plan's anchoring — so a test may pin its generation date correctly, as
 * `goalPace5k.test.ts` always did, and still have a benchmark that AGES.
 *
 * What that cost: a fixture 16 days past its benchmark (3% discount) crossed into the 4% block at exactly four weeks,
 * which moved its goal from 4.66% to 5.44% past fitness, across §120 Amendment 2's 5% line. Three arms went red on a
 * clean tree from a commit that touched nothing, reporting "expected 0 to be greater than or equal to 3" — a date
 * reading as a shape regression. A bisect cannot find this: every step runs at today's clock, so a time-dependent
 * test reads as broken at the commit that introduced it.
 *
 * Rule: derive a benchmark date from today (`slowGoalDates`, the established owner), never pin the literal — or
 * freeze the clock, which is stronger and is exempted by detection.
 *
 * ⚠️ POPULATION LIMIT, STATED: `*.test.ts(x)` under `lib/`, `app/` and `packages/` — **650 files**. It does NOT reach
 * `lib/plan/cohortGrid.ts:95`'s pinned `2026-04-01`, which feeds the committed cohort-shape baseline, nor the
 * `scripts/` corpora. Those four are saturated at §10's cap today, so they cannot drift, but **that is a fact about
 * the date and not a property this arm checks** (/code-review, 2026-11-07).
 *
 * ⚠️ TWO THINGS THE FIRST CUT GOT WRONG, BOTH OF THEM CLASSES ALREADY IN THE RECORD, both caught by running it:
 *  1. **It matched its own test table.** The detector cases below are string literals containing exactly the shape
 *     being banned, so the gate reported itself as the offender — "an ownership arm matching its own comment"
 *     (2026-10-01). The gate file is excluded by name, because its occurrences ARE the fixtures.
 *  2. **It read comments.** `HOOK-RGBA-COMMENTS-01`: a value inside a comment is PROSE, and a guard that fires on a
 *     comment recording a measured value gets switched off — which this repo counts as equivalent to having no
 *     guard. Comments are stripped, and the stripper preserves string contents, because the twin trap is that a
 *     value inside a STRING is code, not prose.
 *
 * 🔴 AND THE SECOND CUT HAD A FALSE POSITIVE AND A FALSE NEGATIVE, BOTH FOUND BY `/code-review` AFTER THE PUSH:
 *  3. **A REGEX LITERAL HOLDING A QUOTE broke the stripper and never recovered.** `/it\'s/` opened a string state
 *     that nothing closed, so every `//` after it read as string content and comment bodies stopped being stripped —
 *     **51 of 649 scanned files**, and a commented date in one of them is reported as pinned. That is the exact
 *     `HOOK-RGBA-COMMENTS-01` class the note above claims to have handled, in the code written to handle it.
 *     Regex literals are now skipped, recognised by the token that precedes them.
 *  4. **A PINNED LITERAL BEHIND AN IDENTIFIER PASSED, AND THE TEST TABLE RATIFIED THAT SHAPE AS THE REMEDY.**
 *     `const BENCH = '2026-11-20'` then `benchmark_date: BENCH` is the defect; `benchmark_date: BENCH_DATE` fed from
 *     `slowGoalDates()` is the remedy; **the first cut could not tell them apart** and asserted the second. One hop
 *     through a variable is resolved now, exactly as `design-guard.py` and `coaching-guard.py` resolve a write
 *     target — the precedent is in this repo and I did not reach for it.
 */
/** Blanks comment bodies without touching string, template or REGEX contents. */
export function stripComments(src: string): string {
  let out = '', i = 0
  // A `/` starts a regex only in expression position; after a value it is division. This is the standard heuristic:
  // look back at the last non-space character. Getting it wrong costs a false positive, which is why it is here.
  const EXPR_BEFORE = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '\n', '+', '-', '*', '%', '<', '>', '~', '^'])
  const q = { s: false, d: false, t: false }
  let lastSig = '\n'
  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    const inStr = q.s || q.d || q.t
    if (!inStr && c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (!inStr && c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }
    if (!inStr && c === '/' && EXPR_BEFORE.has(lastSig)) {
      // A regex literal: copy it verbatim, honouring escapes and character classes, so a quote inside cannot leak.
      out += c; i++
      let cls = false
      while (i < src.length) {
        const r = src[i]
        if (r === '\\') { out += r + (src[i + 1] ?? ''); i += 2; continue }
        if (r === '\n') break
        out += r; i++
        if (r === '[') cls = true
        else if (r === ']') cls = false
        else if (r === '/' && !cls) break
      }
      lastSig = '/'
      continue
    }
    if (c === '\\' && inStr) { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
    if (!q.d && !q.t && c === "'") q.s = !q.s
    else if (!q.s && !q.t && c === '"') q.d = !q.d
    else if (!q.s && !q.d && c === '`') q.t = !q.t
    if (!/\s/.test(c) || c === '\n') lastSig = c
    out += c; i++
  }
  return out
}

/** A test that FREEZES the clock cannot drift, whatever its fixtures say — a STRONGER remedy than deriving the date,
 *  and the first cut had no exemption for it, so the gate pushed a correctly-written test onto the weaker one. */
export function freezesTheClock(src: string): boolean {
  return /setSystemTime\s*\(/.test(stripComments(src))
}

export function pinnedBenchmarkDates(src: string): string[] {
  const code = stripComments(src)
  const direct = Array.from(code.matchAll(/benchmark_date["']?\s*:\s*["'](\d{4}-\d{2}-\d{2})["']/g)).map(m => m[1])
  // One hop: `benchmark_date: IDENT` where IDENT is bound to a date LITERAL in the same file. A binding fed from
  // `slowGoalDates()` or any call resolves to nothing, which is the whole discrimination.
  const viaIdent = Array.from(code.matchAll(/benchmark_date["']?\s*:\s*([A-Za-z_$][\w$]*)/g)).flatMap(m => {
    const lit = new RegExp(`\\b(?:const|let|var)\\s+${m[1]}\\b[^=\\n]*=\\s*["'](\\d{4}-\\d{2}-\\d{2})["']`).exec(code)
    return lit ? [lit[1]] : []
  })
  return [...direct, ...viaIdent]
}

/** This gate's own file: its occurrences are the detector's fixtures, not a pinned plan input. */
const GATE_FILE = 'lib/plan/pinnedClock.test.ts'

/**
 * ⚠️ A REGISTER — and 🔴 **ALL FOUR OF ITS "IN THE RAMP" REASONS WERE FALSE WHEN FIRST WRITTEN, FOUND BY
 * `/code-review` AFTER THE PUSH.** Three of those files call `setSystemTime(FROZEN_NOW)` themselves, so **the
 * forward sweep that justified them was measuring a frozen clock** — my `vi.setSystemTime` prepend was overridden by
 * their own, and "green at 2027-03" proved nothing about them. The fourth (`reshapeCopy`, 2026-07-01) was already
 * **saturated** at the 7% cap on 2026-10-21, so it was never in the ramp either. Fourth measurement artefact in
 * three days, and this one is in a register I wrote the same day as the lesson.
 *
 * ⚠️ So the honest state is: **no file in this repo is actually at risk.** The three that freeze the clock are
 * exempted by DETECTION, not by name, and have left this register; the rest are saturated or overridden.
 * `TEST-CLOCK-BENCHDATE-SWEEP-01` was filed against the four and **has no subject** — closed, not swept.
 * **The value of this arm is not the register — it is that a NEW pinned date fails on the way in.**
 */
const PINNED_BENCHMARK_DEBT: Record<string, string> = {
  // Re-anchored on the line below the literal, and the result is asserted by its own premise arm.
  'lib/plan/goalPace5k.test.ts': 'the stored runner\'s input is kept VERBATIM for provenance; both dates are overridden from `slowGoalDates()` immediately below it',
  // Saturated: §10's discount is already at VDOT_STALENESS_MAX_DISCOUNT_PCT for these, so it cannot move again, and
  // a date in the past only gets older. Measured 2026-11-07 (weeks ago → discount): reshapeCopy 18.4 → 7% capped.
  'lib/plan/reshapeCopy.test.ts': '2026-07-01 — saturated at the cap since 2026-10-21 (NOT "in the ramp", as this row first claimed)',
  'lib/plan/ttLongRunSpacing.test.ts': '2026-05-25 — past the ramp, discount saturated at the cap',
  'lib/plan/v4AnchorAware.test.ts': '2026-04-01 — past the ramp, discount saturated at the cap',
  'lib/plan/marathonPeakRaceSpecific.test.ts': '2026-04-01 — past the ramp, discount saturated at the cap',
}

/** Calls to generateRulePlan with only two arguments, in a file that pins a date constant. */
export function unpinnedCalls(src: string): string[] {
  if (!/^const (TODAY|START)\s*=\s*'\d{4}-\d{2}-\d{2}'/m.test(src)) return []
  return Array.from(src.matchAll(/generateRulePlan\(\s*[^,()]+,\s*'(?:paid|free)'\s*\)/g)).map(m => m[0])
}

const files = ['lib', 'app', 'packages'].flatMap(d => tests(join(process.cwd(), d)))

describe('PINNED-CLOCK-01 — a pinned test pins the engine', () => {
  it('the population is derived', () => expect(files.length).toBeGreaterThan(300))
  it('🔴 no test with a fixed date lets the engine read the wall clock', () => {
    const bad = files.flatMap(f => unpinnedCalls(readFileSync(f, 'utf8')).map(c => `${f.replace(process.cwd() + '/', '')}: ${c}`))
    expect(bad).toEqual([])
  })
  it('🔴 no NEW test pins a benchmark date: the engine ages it against the wall clock by design', () => {
    const offenders = files.map(f => f.replace(process.cwd() + '/', ''))
      .filter(f => {
        if (f === GATE_FILE) return false
        const src = readFileSync(join(process.cwd(), f), 'utf8')
        if (freezesTheClock(src)) return false   // a stronger remedy than deriving the date
        return pinnedBenchmarkDates(src).length > 0
      })
    expect(offenders.filter(f => !(f in PINNED_BENCHMARK_DEBT)),
      'derive it from today with `slowGoalDates()`; see this file\'s header').toEqual([])
    // The register may not outlive its entries — a stale row reads as debt that is still there.
    expect(Object.keys(PINNED_BENCHMARK_DEBT).filter(f => !offenders.includes(f)), 'declared, but no longer pinned').toEqual([])
  })

  it('the frozen-clock exemption is EXERCISED, not decorative', () => {
    // An exemption no file uses is a branch nothing proves. Measured 2026-11-07: of 8 pinned files, 3 freeze.
    const frozen = files.map(f => f.replace(process.cwd() + '/', ''))
      .filter(f => f !== GATE_FILE)
      .filter(f => { const src = readFileSync(join(process.cwd(), f), 'utf8')
        return pinnedBenchmarkDates(src).length > 0 && freezesTheClock(src) })
    expect(frozen.sort(), 'these three override any system time a sweep sets, which is why the forward sweep that first justified this register proved nothing about them')
      .toEqual(['lib/plan/goldenPlans.test.ts', 'lib/plan/intensityOrdering.test.ts', 'lib/plan/raceWeekWeekdayCap.test.ts'])
  })

  it('the benchmark-date detector, both directions', () => {
    expect(pinnedBenchmarkDates(`benchmark_date: '2026-10-10'`)).toEqual(['2026-10-10'])
    expect(pinnedBenchmarkDates(`"benchmark_date":"2026-10-10"`), 'the JSON form a stored input is pasted in').toEqual(['2026-10-10'])
    expect(pinnedBenchmarkDates(`benchmark_date : "2026-10-10"`), 'spacing').toEqual(['2026-10-10'])
    expect(pinnedBenchmarkDates(`benchmark_date: BENCH_DATE`), 'an unbound identifier resolves to nothing').toEqual([])
    expect(pinnedBenchmarkDates(`const { benchmarkDate } = slowGoalDates()\nbenchmark_date: benchmarkDate`),
      'fed from the owner — the REMEDY, and it must not be confused with the defect').toEqual([])
    // 🔴 The false negative /code-review found: one hop through a variable.
    expect(pinnedBenchmarkDates(`const BENCH = '2026-11-20'\nbenchmark_date: BENCH`),
      'a pinned literal behind a name is still pinned').toEqual(['2026-11-20'])
    expect(pinnedBenchmarkDates(`let b = "2026-11-20"\nbenchmark_date: b`), 'let, double quotes').toEqual(['2026-11-20'])
    // 🔴 The false positive: a regex literal holding a quote used to open a string state nothing closed, so every
    // comment after it stopped being stripped — 51 of 649 files.
    expect(pinnedBenchmarkDates(`const re = /it's/\n// benchmark_date: '2026-11-20'\n`),
      'a regex may hold a quote; the comment after it is still a comment').toEqual([])
    expect(pinnedBenchmarkDates(`const re = /[/']/\nbenchmark_date: '2026-11-20'`),
      'a character class holding the delimiter must not swallow the rest of the file').toEqual(['2026-11-20'])
    expect(pinnedBenchmarkDates(`const x = 10 / 2\n// benchmark_date: '2026-11-20'`),
      'division is not a regex').toEqual([])
    expect(freezesTheClock(`vi.setSystemTime(FROZEN_NOW)`), 'freezing the clock is the stronger remedy').toBe(true)
    expect(freezesTheClock(`// setSystemTime( in a comment is not a remedy`)).toBe(false)
    expect(pinnedBenchmarkDates(`// benchmark_date: '2026-10-10' is what it used to be`),
      'HOOK-RGBA-COMMENTS-01 — a value in a COMMENT is prose, and a guard that fires on one gets switched off').toEqual([])
    expect(pinnedBenchmarkDates(`/* benchmark_date: '2026-10-10' */`), 'block comments too').toEqual([])
    expect(pinnedBenchmarkDates(`const u = 'http://x/y' // nothing\nbenchmark_date: '2026-10-10'`),
      'the stripper must not treat // inside a string as a comment opener').toEqual(['2026-10-10'])
    expect(stripComments(`const s = '// not a comment'`), 'a comment marker inside a STRING is code').toContain('// not a comment')
  })

  it('the detector', () => {
    expect(unpinnedCalls("const TODAY = '2026-09-21'\ngenerateRulePlan(input, 'paid')")).toHaveLength(1)
    expect(unpinnedCalls("const TODAY = '2026-09-21'\ngenerateRulePlan(input, 'paid', TODAY)")).toEqual([])
    expect(unpinnedCalls("generateRulePlan(input, 'paid')"), 'no fixed date → the clock is the intent').toEqual([])
  })
})

/**
 * 🔴 A FOURTH PATH, AND IT IS BEHAVIOURAL RATHER THAN A LINT: `runEngine`'s OWN `today`
 * REACHED THE FOUNDATION COMPOSITION AND NOT GENERATION (`PARITY-STAGED-BLIND-01` code
 * review, 2026-11-10).
 *
 * The arms above enforce PINNED-CLOCK-01 on `generateRulePlan`'s third argument and warn that
 * a pinned benchmark still ages. Neither can see the engine's OTHER entry point. `runEngine`
 * computed `req.today ?? formatDate(new Date())`, used it to compose foundation weeks, and
 * then called `generateRulePlan(input, tier, planStart)` — no `todayOverride` — so generation
 * read its own `formatDate(new Date())`.
 *
 * 📐 MEASURED, with `today` pinned to `2026-12-14` and only the WALL CLOCK moved one week:
 * `foundation_weeks_planned` went **0 → 3 on 3 of 3 inputs**, every plan hash changed, and
 * `foundation_gap_class` stayed `'none'` — from the pin. **A plan built half against the pin
 * and half against the clock, and internally inconsistent: three foundation weeks planned for
 * a gap the same plan classifies as none.** Production was unaffected because its one caller
 * passes no `today`, so both reads hit the same clock; every pinned test and script was not.
 *
 * ⚠️ WHY A LINT COULD NOT CATCH IT. `unpinnedCalls` above looks for a fixed date beside a
 * `generateRulePlan(` call with fewer than three arguments. These callers pass a pinned date to
 * `runEngine` and never name `generateRulePlan` at all — the pin was present, correct, and
 * silently dropped one frame down. **A source gate can only see the call it knows the name of.**
 */
describe('PINNED-CLOCK-04 — runEngine forwards `today` to generation, not just to composition', () => {
  const PLAN_START = '2026-12-14'
  const input = (days_available: number) => ({
    goal: 'finish', age: 40, resting_hr: 55, max_hr: 180, preferred_long_run_day: 'sun',
    race_date: '2027-03-28', race_distance_km: 42.2, current_weekly_km: 30,
    longest_recent_run_km: 10, days_available, user_declared_level: 'intermediate',
    injury_history: [] as string[],
  })
  // Wall-clock fields are excluded; `foundation_weeks_planned` is NOT one of them — that is the
  // whole point. It is in neither of `verify-parity.ts`'s strip lists either, and it should not be.
  const VOLATILE = ['generated_at', 'last_updated', 'created_at', 'updated_at']
  const shape = (p: unknown) =>
    JSON.stringify(p, (k, v) => (VOLATILE.includes(k) ? undefined : v))

  const planAt = async (wallClock: string, days: number) => {
    const { runEngine } = await import('./engine')
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(`${wallClock}T09:00:00Z`))
      const out = runEngine({
        input: input(days) as never, tier: 'paid',
        planStart: PLAN_START, today: PLAN_START, displayUnits: 'km',
      })
      if (out.kind === 'refusal') throw new Error('refused — the fixture must generate')
      return out.plan
    } finally {
      vi.useRealTimers()
    }
  }

  it('a pinned `today` makes generation clock-independent on every sampled input', async () => {
    for (const days of [3, 4, 5]) {
      const early = await planAt('2026-11-10', days)
      const later = await planAt('2026-11-17', days)
      expect(shape(later), `days_available=${days}: the wall clock moved and the plan must not`)
        .toBe(shape(early))
    }
  })

  it('names the field that moved, so a future regression says what broke', async () => {
    // Asserting hashes alone would report "something changed". This is the field that did,
    // and it is the one a reader of the plan would be most misled by.
    for (const days of [3, 4, 5]) {
      const early = await planAt('2026-11-10', days)
      const later = await planAt('2026-11-17', days)
      expect(later.meta.foundation_weeks_planned).toBe(early.meta.foundation_weeks_planned)
      // And it agrees with the gap class the SAME plan derived from the pinned date.
      expect(early.meta.foundation_gap_class, 'a 4-week runway is no gap').toBe('none')
      expect(early.meta.foundation_weeks_planned, 'no gap means no foundation weeks').toBe(0)
    }
  })

  it('the fixture is clock-SENSITIVE, so these arms are not vacuous', async () => {
    // ⚠️ Without this the two arms above pass on any input the clock cannot reach, which is
    // most of them. Freezing the clock a week later must change what the UNFIXED engine would
    // have produced — proved here by showing the two dates straddle the boundary that moved it:
    // a plan start 4 weeks after 2026-11-10 is inside the no-gap window and 5 weeks after
    // 2026-11-17 is not, which is exactly why `foundation_weeks_planned` went 0 → 3.
    // `plannedFoundationWeeks` is the SINGLE OWNER of this number (§91 / CB-ONSET-02), shared
    // by `computePhases` and `composePlanWithFoundation` precisely so they cannot disagree.
    // Asking it directly is asking the producer, not a reimplementation of it.
    const { plannedFoundationWeeks } = await import('./foundationBlock')
    expect(plannedFoundationWeeks('2026-11-10', PLAN_START), 'no gap at the earlier clock').toBe(0)
    expect(plannedFoundationWeeks('2026-11-17', PLAN_START), 'a gap at the later clock').toBeGreaterThan(0)
  })
})

/**
 * 🔴 THE CLOCK-DRIFT HARNESS MUST DERIVE ITS POPULATION (`PINNED-CLOCK-RUNWAY-01`, 2026-11-10).
 *
 * `scripts/check-clock-drift.ts` re-runs engine tests at a shifted wall clock. Its whole value
 * is that the population is computed — a hand-written file list would be *"the files someone
 * thought of"*, which is the failure this repo has recorded for four separate checks.
 *
 * 📐 Why a harness rather than the sweep the item asked for: re-measured 2026-11-10, **162 test
 * files / 554 call sites** pass `planStart` without `todayOverride` (the item said 136 / 451),
 * of which **51 files** carry a runway signal — and **all of them pass at +7, +30, +90 and +365
 * days**. Pinning 161 sites would be churn against no demonstrated defect; the incident that
 * filed the item was real and already fixed, so the class is LATENT. A harness says the day it
 * stops being.
 */
describe('PINNED-CLOCK-RUNWAY-01 — the drift harness derives its population', () => {
  const SRC = readFileSync(join(process.cwd(), 'scripts/check-clock-drift.ts'), 'utf8')
  const code = SRC
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))

  it('walks the tree and never names a test file', () => {
    expect(code, 'the population comes from a directory walk').toMatch(/readdirSync/)
    // A `.test.ts` path spelled out in code is a hand-written population.
    const named = code.match(/['"][\w/.-]*\.test\.tsx?['"]/g) ?? []
    expect(named, 'no test file may be named in the script').toEqual([])
  })

  it('🔴 refuses an empty or tiny population rather than passing', () => {
    // `an empty population must not render` — the recorded lesson. A broken derivation must
    // exit non-zero, not print a tick over nothing.
    expect(code).toMatch(/population\.length < \d+/)
    expect(code).toMatch(/POPULATION TOO SMALL/)
  })

  it('🔴 distinguishes a BROKEN HARNESS from a clock-dependent test', () => {
    // The first cut printed the failure banner for a vitest run that never started (the
    // generated config sat in `tmpdir()` and could not resolve `vitest/config`). A red result
    // from a broken harness reads exactly like a real defect.
    expect(code).toMatch(/BROKEN HARNESS/)
    // ⚠️ BOUND TO ITS BRANCH, and the loose form did not bite. `toMatch(/process\.exit\(2\)/)`
    // passed with the broken-harness exit changed to 1, because the file has a SECOND
    // `exit(2)` (the too-small population) and one match satisfied it. A mutation proved that,
    // so the assertion ties the code to the message instead of asserting both exist somewhere.
    expect(code, 'the broken-harness branch must exit 2, not 1 — a finding and a broken runner '
      + 'are different outcomes').toMatch(/BROKEN HARNESS[\s\S]{0,200}?process\.exit\(2\)/)
  })

  it('probes more than one shift, and the default spans a week to a year', () => {
    // 📐 The planted falsification fixture is caught at +7d and MISSED at +30d and +365d, so a
    // two-shift default was insufficient — measured, not assumed.
    expect(code).toMatch(/\[7, 30, 90, 365\]/)
  })

  it('replaces `Date` without touching timers, so a pinned planStart is unaffected', () => {
    expect(code).toMatch(/globalThis\.Date = D/)
    expect(code, 'fake timers would change async behaviour, not just the date')
      .not.toMatch(/useFakeTimers/)
  })

  it('is wired into verify:ci, and NOT into the pre-push hook', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
    expect(pkg.scripts['check:clock'], 'the script must exist').toBeTruthy()
    expect(pkg.scripts['verify:ci'], 'CI runs it').toContain('check:clock')
    // ⚠️ DELIBERATELY NOT in `.githooks/pre-push`. It costs ~80 s (4 shifts × ~20 s) and the
    // founder accepted a ~3 min pre-push budget for tsc + the suite; adding 50% to every push
    // without being asked is a scope decision, not a technical one. The class is latent and CI
    // is the right cadence for it.
    expect(readFileSync(join(process.cwd(), '.githooks/pre-push'), 'utf8'))
      .not.toContain('check:clock')
  })
})
