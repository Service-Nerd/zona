// ADR-027 B4c (ADR027-B4C-VOLUME) — L3's delivered-volume owner.
//
// 🔴 WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY DOES NOT REPEAT.
// `raceNotVolume.test.ts` already asserts §121's race exclusion behaviourally, for every distance,
// and it was written because `INV-PLAN-RACE-NOT-VOLUME` is a plan-level proxy that could not see a
// re-inclusion on a 5K or 10K plan at all (0 of 20,736). **That arm is not copied here**; a second
// copy of a behavioural check is the duplication this whole phase exists to remove.
//
// What is NEW and had no gate: the function is now in L3 and reached through a RE-EXPORT by 39
// references in ~20 files, its predicate has **TWELVE** look-alikes rather than the three its own
// docstring claimed, five of them summing or comparing km with no race exclusion of their own — each
// safe only because a race WEEK is filtered somewhere else, including an early return 897 lines away
// that nothing connected to it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { sumWeeklyKm } from './deliveredVolume'
import * as engine from '@/lib/plan/ruleEngine'

const root = process.cwd()
const src = (f: string) => readFileSync(join(root, f), 'utf8')
/** A comment is prose (HOOK-RGBA-COMMENTS-01). Line count preserved so positions line up. */
const strip = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length))

describe('ADR-027 B4c — the owner moved, and nothing that reads it moved', () => {
  it('🔴 the re-export is LOAD-BEARING: both names are the same function', () => {
    // 39 references across ~20 files reach this through `ruleEngine`. If the re-export were dropped
    // or shadowed by a local reimplementation, every one of them would still compile and would be
    // reading a different function. Identity, not equality of behaviour.
    expect(engine.sumWeeklyKm).toBe(sumWeeklyKm)
  })

  it('🔴 `ruleEngine.ts` holds no second definition of it', () => {
    // The hazard a re-export creates: the old home keeps exporting the name, so a reimplementation
    // there is invisible to every consumer. Comments stripped, so the note recording the move passes.
    const code = strip(src('lib/plan/ruleEngine.ts'))
    expect(code).not.toMatch(/function\s+sumWeeklyKm/)
    expect(code, 'the re-export must still be there or 39 references break').toMatch(/export \{ sumWeeklyKm \}/)
  })

  it('the consumers still reach it, and there are many of them', () => {
    // A population figure, measured rather than quoted: if this collapses to a handful, the move
    // stopped being the zero-churn one the records claim.
    // `--untracked` matters: the owner is a new file, and a tracked-only search reported it absent
    // from its own population on the first run of this arm.
    const files = execSync(
      `git grep -l --untracked 'sumWeeklyKm' -- 'lib' 'app' 'components' 'scripts' || true`,
      { cwd: root, encoding: 'utf8' },
    ).trim().split('\n').filter(Boolean)
    expect(files.length, 'the consumer population collapsed — re-check the move').toBeGreaterThan(15)
    expect(files, 'the owner itself must be in the population').toContain('lib/engine/planner/deliveredVolume.ts')
  })
})

describe('ADR-027 B4c — the eight look-alikes, counted', () => {
  /**
   * The owner's docstring says this predicate must NOT be DRY'd, because each site asks a different
   * question that happens to list the same session types. It said "appears three times".
   *
   * 🔴 IT WAS WRONG BY FIVE, AND THIS ARM IS WHAT FOUND IT. My own first version of it asserted
   * FOUR — I had found one undocumented site and assumed it was the only one. The arm went red at
   * eight. Three of the five extras ask a volume question and do not mention the race; all three are
   * safe only because a RACE WEEK is excluded one level up, by a guard connected to none of them.
   */
  it('🔴 exactly twelve sites test `strength` on a session, in BOTH spellings', () => {
    // 🔴 THE POPULATION IS GLOBBED OVER L3, NOT A TWO-FILE LIST, AND A MOVE IS WHAT TAUGHT IT.
    // B4d took `applyWeekdayMinsCap` out of `ruleEngine.ts` into `weekdayCap.ts` and this arm went
    // red at 11 — one of the twelve had simply changed address. **Second time in one day a count
    // pinned to one file could not tell a relocation from a deletion** (`DELOAD-OWNER-01`'s widened
    // pin was the first). The population now follows the strangler: the old engine plus every L3
    // module, so a look-alike moving between them is invisible to the count and a NEW one is not.
    // ⚠️ FROM GIT, NOT `readdirSync`. A directory listing includes untracked scratch files: code
    // review verified that restoring an equivalence probe took this count 8 → 9 and failed with
    // "add a THIRTEENTH to the owner's docstring" — a confident, wrong diagnosis. Only tracked
    // modules are the engine.
    const planner = execSync("git ls-files 'lib/engine/planner/*.ts'", { cwd: root, encoding: 'utf8' })
      .trim().split('\n').filter(f => f && !f.endsWith('.test.ts'))
    expect(planner.length, 'no tracked L3 modules — this arm would read only ruleEngine').toBeGreaterThanOrEqual(4)
    const code = strip(src('lib/plan/ruleEngine.ts'))
      + planner.map(f => strip(src(f))).join('')
    // Matching the TYPE TEST rather than the whole predicate is deliberate: most of these omit
    // `race`, so a pattern spelling out all three types would have found only the documented ones —
    // which is precisely how "appears three times" survived.
    //
    // 🔴 AND BOTH SPELLINGS, BECAUSE COUNTING ONE IS HOW I GOT IT WRONG THE SECOND TIME. My first
    // correction asserted EIGHT and matched only `=== 'strength'`; code review found four more
    // written `!== 'strength'`, two of them km comparisons with no race mention. A negated
    // thirteenth would have left this gate green.
    const positive = code.match(/type === 'strength'/g) ?? []
    const negated = code.match(/type !== 'strength'/g) ?? []
    expect(positive.length, 'the `=== strength` count moved').toBe(8)
    expect(negated.length, 'the `!== strength` count moved — a NEGATED look-alike is still one').toBe(4)
    expect(
      positive.length + negated.length,
      'the look-alike count moved. A new one is a THIRTEENTH: add it to the owner\'s docstring with ' +
      'the question it asks and what protects it, or route it through the owner. Do not just update ' +
      'this number.',
    ).toBe(12)
  })

  it('🔴 the upstream race-week guards are load-bearing for predicates that never mention a race', () => {
    // `exactWeekKm` and `lopsidedWeek` sum or compare km without excluding the race. Neither is
    // wrong — §121 is display-and-totals only — and neither is safe by its own code. Each depends on
    // a week-level filter written elsewhere. If one of those goes, a marathon enters a taper-depth
    // measurement or becomes "this week's longest run", silently.
    // 🔴 BOUND THE REGION, NEVER GREP THE FILE — CLAUDE.md's rule, and the first cut of this arm
    // broke it. Both literals occur more than once in `ruleEngine.ts` (the taper filter twice, the
    // deload skip four times), so searching the whole file passed while the guard that MATTERS was
    // deleted: two falsification mutations stayed green and the arm, not the mutation, was at fault.
    // Each guard is now asserted inside the function that depends on it.
    const code = strip(src('lib/plan/ruleEngine.ts'))
    // ⚠️ LINES, NOT CHARACTERS. `strip` blanks comment TEXT while preserving length, so a
    // character window over a well-commented function is mostly blanks — a 500-char region reached
    // 6 lines into `applyTaperLongRunCap` and the arm failed on a guard that is right there.
    const codeLines = code.split('\n')
    const region = (startMarker: string, lineCount: number) => {
      const i = codeLines.findIndex(l => l.includes(startMarker))
      expect(i, `${startMarker} is gone — the region this arm reads no longer exists`).toBeGreaterThan(0)
      return codeLines.slice(i, i + lineCount).join('\n')
    }
    // `exactWeekKm` sums a week without excluding the race; its pass must filter race weeks out.
    expect(
      region('function applyTaperDeliveredDepth(', 30),
      "applyTaperDeliveredDepth's race-week filter is gone — exactWeekKm would see a race",
    ).toMatch(/w\.type !== 'race'/)
    // `lopsidedWeek` compares session km without excluding the race; its finder must skip race weeks.
    expect(
      region('const lopsidedWeek = weeks.find(', 20),
      "lopsidedWeek's race-week skip is gone — a race would become the week's longest run",
    ).toMatch(/w\.type === 'race'/)
    // 🔴 TWO MORE, FOUND BY CODE REVIEW IN THE NEGATED SPELLING. Both are §9 ratio floors comparing
    // "the longest other run"; a race would raise the floor and invert the rule it protects.
    expect(
      region('function applyTaperLongRunCap(', 20),
      "applyTaperLongRunCap's race-week skip is gone — §9's floor would read a race as an easy run",
    ).toMatch(/w\.type === 'race'/)
    expect(
      region('function reclampPeakStepBacks(', 20),
      "reclampPeakStepBacks' peak filter no longer excludes race weeks",
    ).toMatch(/w\.type !== 'race'/)
    // The fifth guard is the race-week early return, asserted in its own arm below.
  })

  it('🔴 `placedKm` still omits `race`, and that is the RULING', () => {
    // §121: "DISPLAY AND TOTALS ONLY — nothing placed in race week moves." Making `placedKm` mirror
    // the owner would change placement and breach the ruling's own scope, so this arm fails if
    // somebody "fixes" it — the opposite direction from a normal drift check.
    const code = strip(src('lib/plan/ruleEngine.ts'))
    const i = code.indexOf('const placedKm')
    expect(i, '`placedKm` is gone — if it was routed through the owner, §121\'s scope was breached').toBeGreaterThan(0)
    const body = code.slice(i, i + 320)
    expect(body, '`placedKm` must still exclude strength and rest').toMatch(/'strength'/)
    expect(body, '`placedKm` must still exclude strength and rest').toMatch(/'rest'/)
    expect(body, '§121 is display-and-totals only: `placedKm` must NOT exclude the race').not.toMatch(/'race'/)
  })

  it('🔴 the race-week early return is what makes `placedKm` safe — 897 lines away', () => {
    // This is the arm that matters. `placedKm` omits `race`, which would count a marathon and leave
    // race week with no easy runs — and the only reason it cannot is that `buildWeekSessions` returns
    // before reaching it. Nothing connected the two. Measured: the return precedes `placedKm`.
    const code = strip(src('lib/plan/ruleEngine.ts'))
    const lines = code.split('\n')
    const guard = lines.findIndex(l => /if \(isRaceWeek\) \{/.test(l))
    expect(guard, 'the race-week branch is gone').toBeGreaterThan(-1)
    // The branch must RETURN, not fall through.
    const after = lines.slice(guard, guard + 220).join('\n')
    expect(after, 'the race-week branch must return before the easy fill').toMatch(/return sessions/)
    const placed = lines.findIndex(l => /const placedKm/.test(l))
    expect(placed, '`placedKm` is gone').toBeGreaterThan(-1)
    expect(placed, 'the early return must come BEFORE the easy fill that omits `race`').toBeGreaterThan(guard)
    // 🔴 THERE IS NO SECOND GUARD, AND THIS ARM USED TO CLAIM THERE WAS. It asserted that some
    // `!isRaceWeek` appeared before `placedKm` — true, but the only one is §9's redistribution guard
    // 548 lines away, which protects nothing here. Code review falsified it: deleting that unrelated
    // guard turned the arm red under the message "the easy fill is no longer guarded". **The early
    // return is the SOLE protection**, so the assertion above is the whole gate, and a reader who
    // believed in a second one could have removed it.
    const fill = lines.slice(placed - 40, placed).join('\n')
    expect(fill, 'the easy fill has no !isRaceWeek guard of its own — do not add a claim that it does')
      .not.toMatch(/!isRaceWeek/)
  })
})

describe('ADR-027 B4c — the boundary and the metric', () => {

  it('a week of nothing but strength and rest delivers zero, and absence is not zero km', () => {
    // The one behavioural property not already covered by `raceNotVolume.test.ts`: the excluded
    // types contribute nothing, and a session with neither distance nor duration does not invent km.
    //
    // ⚠️ THE RACE EXCLUSION IS DELIBERATELY NOT RE-ASSERTED HERE, and that is checked rather than
    // claimed: removing `|| s.type === 'race'` from the owner leaves this file 9/9 GREEN and takes
    // `raceNotVolume.test.ts` to 6 FAILED. That is the gate working where it was put, not a hole —
    // a second copy of a behavioural check is the duplication this phase exists to remove.
    const pace = { minPerKmEasy: 6 } as never
    expect(sumWeeklyKm({ mon: { type: 'strength' } as never, tue: { type: 'rest' } as never }, pace)).toBe(0)
    expect(sumWeeklyKm({}, pace)).toBe(0)
    // Duration-anchored and distance-anchored sessions both count, which is SESSION-KM-01's whole
    // point: `distance_km ?? 0` would read the first of these as zero.
    expect(sumWeeklyKm({ mon: { type: 'easy', duration_mins: 60 } as never }, pace)).toBe(10)
    expect(sumWeeklyKm({ mon: { type: 'easy', distance_km: 8 } as never }, pace)).toBe(8)
  })
})
