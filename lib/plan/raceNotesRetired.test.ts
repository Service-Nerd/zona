import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from './ruleEngine'
import { slowGoalDates } from './slowGoalGrid'
import { quotesGoalPace } from './goalPaceReach'

/**
 * RACE-NOTES-INERT-01 (Design Board 2026-11-16) — `week.race_notes` is retired, and it stays retired.
 *
 * 📐 WHAT WAS MEASURED, over all 43 live plans. **39 carried the field and it had ZERO readers in
 * `app/`, `components/` or the marketing site**, so nothing it said had ever reached a runner. The
 * board ruled DON'T SHIP the render rather than place it, because the race SESSION already says
 * everything it said and says it with the runner's own numbers:
 *
 *   · **5 of 5** short-race plans opened with the identical sentence, *"Start slower than feels
 *     right"*, from two different producers.
 *   · Where it DIFFERED it was wrong. **5 of the 6** plans carrying *"settle into goal pace"* had
 *     goal pace **withheld** by §80 Am. 2, and a marathon read *"Start at Zone 2"* beside a session
 *     reading *"First 5.1 km at 5:34 /km, the pace your training says you can hold today."*
 *   · §80 Am. 2 is enforced by `quotesGoalPace` over `coach_notes`, and this field sat OUTSIDE that
 *     population — so rendering it would have shipped a violation past the gate written to stop
 *     exactly that. The checker's population excluded the case at risk.
 *
 * ⚠️ THE ABSENCE ARM IS NOT THE POINT ON ITS OWN. A retirement that leaves a hole is a regression,
 * so the arm that matters asserts the race session still carries race-day pacing. `smokeTrackerGone`
 * is the shape precedent; this adds the positive half it did not need.
 */

const { planStart: PLAN_START, benchmarkDate: BENCH_DATE } = slowGoalDates()
const isoPlus = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 864e5).toISOString().slice(0, 10)

/** A runner whose goal is reachable, so nothing is withheld and the race session speaks plainly. */
const base = (raceKm: number, days: number) => ({
  age: 38, goal: 'time_target', max_hr: 185, resting_hr: 52,
  benchmark: { time: '0:25:00', type: 'race', distance_km: 5, benchmark_date: BENCH_DATE },
  race_date: isoPlus(PLAN_START, days), race_name: 'Test Race',
  race_distance_km: raceKm, target_time: raceKm <= 10 ? '0:51:00' : '3:50:00',
  training_age: '2-4y', max_hr_source: 'observed', days_available: 5,
  days_cannot_train: ['monday', 'friday'], user_declared_level: 'intermediate',
  current_weekly_km: 45, longest_recent_run_km: 18, preferred_long_run_day: 'sun',
  recent_quality_training: 'regular',
}) as never

describe('RACE-NOTES-INERT-01 — the field is retired at the producer', () => {
  // Both branches of the retired code: the <=10K line and the long-race line.
  for (const [km, days, name] of [[10, 90, '10K'], [42.2, 140, 'marathon']] as const) {
    it(`${name}: no week carries race_notes, and the race week is really there`, () => {
      const plan = generateRulePlan(base(km, days), 'paid', PLAN_START) as never as {
        weeks: { n: number; race_notes?: string; sessions: Record<string, { type?: string; coach_notes?: string[] } | null> }[]
      }
      const raceWeek = plan.weeks.find(w => Object.values(w.sessions ?? {}).some(s => s?.type === 'race'))
      // ⚠️ Without this the arm below passes on a plan that has no race week at all, which is the
      // vacuity this repo keeps finding under a green tick.
      expect(raceWeek, 'no race week was generated; the absence arm would prove nothing').toBeTruthy()
      for (const w of plan.weeks) {
        expect(w.race_notes, `w${w.n} carries a retired race_notes`).toBeUndefined()
      }
    })

    it(`${name}: 🔴 the race SESSION still carries race-day pacing — retirement left no hole`, () => {
      const plan = generateRulePlan(base(km, days), 'paid', PLAN_START) as never as {
        weeks: { sessions: Record<string, { type?: string; coach_notes?: string[] } | null> }[]
      }
      const race = plan.weeks
        .flatMap(w => Object.values(w.sessions ?? {}))
        .find(s => s?.type === 'race')
      expect(race, 'no race session').toBeTruthy()
      const notes = (race?.coach_notes ?? []).filter(Boolean)
      expect(notes.length, 'the race session says nothing; the week note was the only pacing copy').toBeGreaterThan(0)
      // Something about how to run it, not merely a name. The retired field's whole content was an
      // opening instruction, so the replacement must carry one.
      expect(notes.join(' ')).toMatch(/start|pace|zone|first/i)
    })
  }
})

describe('RACE-NOTES-INERT-01 — it stays retired', () => {
  /**
   * ⚠️ COMMENTS ARE STRIPPED, AND THAT IS NOT OPTIONAL HERE. Every file this gate scans explains the
   * retirement in prose that names the field, so an unstripped sweep reports the record of the fix as
   * the fix's absence — `HOOK-RGBA-COMMENTS-01` from the other side, which bit four separate guards
   * on 2026-11-16 alone. Quote-aware, so a `//` inside a string is not a comment.
   */
  function stripComments(src: string): string {
    let out = '', q: string | null = null
    for (let i = 0; i < src.length; i++) {
      const c = src[i]
      if (q) { out += c; if (c === '\\') { out += src[++i] ?? ''; continue } if (c === q) q = null; continue }
      if (c === '"' || c === "'" || c === '`') { q = c; out += c; continue }
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 1; continue }
      out += c
    }
    return out
  }

  /**
   * ⚠️ AND STRING CONTENTS GO TOO, WHICH THE FIRST CUT OF THE EXEMPTION ARM DID NOT DO. The one
   * exempt line asserts absence and names the field AGAIN inside its own failure message, so a
   * count over the raw line read TWO and the arm went red on correct code. Worse, the mutation that
   * removed the real reference left the message behind and the arm stayed GREEN. Code and prose,
   * both out, before anything is counted.
   */
  function blankStrings(src: string): string {
    let out = '', q: string | null = null
    for (let i = 0; i < src.length; i++) {
      const c = src[i]
      if (q) { if (c === '\\') { i++; continue } if (c === q) { q = null; out += c; continue } out += c === '\n' ? '\n' : ' '; continue }
      if (c === '"' || c === "'" || c === '`') { q = c; out += c; continue }
      out += c
    }
    return out
  }

  const codeOf = (f: string) => blankStrings(stripComments(readFileSync(f, 'utf8')))

  it('the stripper works, or this gate reads the documentation instead of the code', () => {
    expect(stripComments('a // race_notes\nb')).not.toContain('race_notes')
    expect(stripComments('/* race_notes */ b')).not.toContain('race_notes')
    expect(stripComments("const u = 'http://x' // gone")).toContain('http://x')
    // And the string blanker: the identifier survives in code, never inside a literal.
    expect(blankStrings('const a = x.race_notes')).toContain('race_notes')
    expect(blankStrings('const m = `names race_notes here`')).not.toContain('race_notes')
  })

  const tracked = (): string[] =>
    execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(f => /^(app|components|lib|scripts|types)\/.*\.tsx?$/.test(f))
      .filter(f => !f.endsWith('lib/plan/raceNotesRetired.test.ts'))

  it('the population is real — an empty sweep would pass every arm below', () => {
    expect(tracked().length, 'the glob selected nothing').toBeGreaterThan(300)
  })

  /**
   * ⚠️ ONE EXEMPTION, NAMED WITH ITS REASON AND CHECKED IN BOTH DIRECTIONS. `goalPace5k.test.ts`
   * references the field in order to assert it is GONE — D8's original arm, converted rather than
   * deleted. An exemption nobody can read is a loophole, so the arm below proves the file exists AND
   * that every line of it naming the field is an absence assertion.
   */
  const EXEMPT: Record<string, string> = {
    'lib/plan/goalPace5k.test.ts': "GOALPACE-5K-01 D8's arm, converted to assert the field's absence",
  }

  it('the exemption is real, and it only ever asserts the ABSENCE', () => {
    for (const [f, why] of Object.entries(EXEMPT)) {
      expect(tracked(), `exempt file no longer exists: ${f} (${why})`).toContain(f)
      const lines = codeOf(f).split('\n').filter(l => /\brace_notes\b/.test(l))
      expect(lines.length, `${f} no longer mentions the field; drop the exemption`).toBeGreaterThan(0)
      for (const l of lines) {
        // 🔴 THREE CONDITIONS, BECAUSE "the line says toBeUndefined" IS NOT ENOUGH AND A MUTATION
        // PROVED IT. Adding `const _x = w.race_notes;` in FRONT of the assertion left the line
        // matching `/toBeUndefined/` and the arm green — a line can satisfy the pattern and still
        // do something else on the way. So: the reference sits inside an `expect(`, the line
        // asserts absence, and the field appears EXACTLY ONCE.
        const msg = `${f} reads race_notes for something other than asserting it is gone: ${l.trim()}`
        expect(l, msg).toMatch(/expect\(\s*[^;]*\brace_notes\b/)
        expect(l, msg).toMatch(/toBeUndefined/)
        expect((l.match(/\brace_notes\b/g) ?? []).length, msg).toBe(1)
      }
    }
  })

  it('🔴 no file declares, stamps or reads race_notes any more', () => {
    const offenders = tracked()
      .filter(f => !EXEMPT[f])
      .filter(f => /\brace_notes\b/.test(codeOf(f)))
    expect(offenders,
      'the race session is the single producer of race-day pacing. A week-level note re-introduces ' +
      'a second opening prescription, and on a goal-pace-withheld plan a §80 Am. 2 violation that ' +
      '`quotesGoalPace` cannot see, because it reads coach_notes.').toEqual([])
  })

  it('and the detector that could not see it is real, so the reason above is not folklore', () => {
    // The exact sentence 5 of 6 live short-race plans carried, against the live detector.
    expect(quotesGoalPace('Race day. Start slower than feels right, then settle into goal pace.', null)).toBe(true)
    expect(quotesGoalPace('Race day. Start at Zone 2. The second half is where the race begins.', null)).toBe(false)
  })
})
