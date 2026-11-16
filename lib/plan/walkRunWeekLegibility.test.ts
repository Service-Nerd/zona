import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { walkRunLadder, walkRunSchedule, generateWalkRunWeeks } from './walkRunStart'

/**
 * WALKRUN-WEEK-LEGIBILITY-01 (Design Board 2026-11-16) — §117's ladder reaches the Plan screen.
 *
 * 📐 THE DEFECT, MEASURED. The ladder progresses **1/2 → 2/2 → 3/2 → 3/2 (deload) → 4/2 → 5/2 →
 * 6/1** and is correct. But the Plan screen's week card renders `week.label`, which read
 * `Walk-run 1..7` — an ordinal, **under an eyebrow that already says `W3 · 16 NOV – 22 NOV`** — and
 * every session row renders `sessionDisplayLabel`, which is `"Walk-run"` on all 21 sessions. So a
 * runner saw the same week seven times.
 *
 * ⚠️ THE PROGRESSION WAS AUTHORED AND HAD NOWHERE TO GO. It lives in `week.theme`, and
 * `renderGuidance.ts` recorded on **2026-10-09** that `week.theme` has *"no reachable render
 * today"* — **sixteen days before §117's ladder was ratified into that field**. Its one reader is
 * Today's maintenance-transition card, which this runner never sees.
 *
 * 🔑 The chair had already ruled the remedy in a different sitting: *"a planned easy week marked by
 * its LABEL, not a second bar."* This is conformance, not a new decision.
 */

const weeksFor = () => generateWalkRunWeeks(
  { days_cannot_train: ['monday'], preferred_long_run_day: 'sun' } as never,
  '2026-11-23',
  '120-140 bpm',
) as never as { n: number; label: string; theme: string; type: string }[]

describe('WALKRUN-WEEK-LEGIBILITY-01 — the ladder is visible where the Plan screen looks', () => {
  it('the block is real: seven weeks, a progressing ladder and one deload', () => {
    // Vacuity guard. Every arm below is about this block; if it stops being generated they all
    // pass on an empty array.
    const weeks = weeksFor()
    expect(weeks.length).toBeGreaterThan(3)
    expect(walkRunLadder().length).toBeGreaterThan(3)
    expect(walkRunSchedule().filter(w => w.deload).length).toBeGreaterThan(0)
  })

  it('🔴 the LABEL carries the interval, because the label is what the week card renders', () => {
    const ladder = walkRunLadder()
    const sched = walkRunSchedule()
    weeksFor().forEach((w, i) => {
      const lvl = ladder[sched[i].level]
      expect(w.label, `w${w.n} label does not name its interval`)
        .toBe(`Run ${lvl.run_mins}, walk ${lvl.walk_mins}`)
    })
  })

  it('🔴 the label is not an ORDINAL: the eyebrow already says which week this is', () => {
    // `WeekCard` renders `W{n} · {dates}` directly above `week.label`. The old label spent its one
    // line restating that number, which is why seven weeks looked alike.
    //
    // 🔴 I WROTE THIS ARM AS A GENERALISATION TWICE AND IT WAS WRONG BOTH TIMES, and its own runs
    // are what said so. First `not.toMatch(/\b\d+$/)` — but `Run 1, walk 2` ends in a digit
    // because that digit is the WALK MINUTES. Then `not.toMatch(/\b{n}$/)` — but w2's correct
    // label is `Run 2, walk 2`, which ends in its own week number **by coincidence**.
    // **A coincidence is not a defect, and a generalisation that forbids the right answer is not a
    // check.** What survives is the specific shape that WAS the defect, plus the structural form
    // of the complaint below.
    const weeks = weeksFor()
    for (const w of weeks) {
      expect(w.label, `w${w.n} is named after its own position`).not.toMatch(/^Walk-run \d+$/)
    }
    // And the structural form of the same claim: stripping trailing digits must NOT collapse the
    // labels to one string, which is exactly what `Walk-run 1..7` did.
    const stripped = new Set(weeks.map(w => w.label.replace(/\s*\d+$/, '')))
    expect(stripped.size, 'the labels differ only by a trailing number').toBeGreaterThan(1)
  })

  it('🔴 every STEP of the ladder is distinguishable on the week card', () => {
    // The property, not a snapshot of today's seven strings: two weeks at DIFFERENT levels must
    // not render the same label. (Two weeks at the SAME level legitimately do — see the next arm.)
    const sched = walkRunSchedule()
    const weeks = weeksFor()
    for (let i = 0; i < weeks.length; i++) {
      for (let j = i + 1; j < weeks.length; j++) {
        if (sched[i].level === sched[j].level) continue
        expect(weeks[i].label, `w${i + 1} and w${j + 1} are different levels but read the same`)
          .not.toBe(weeks[j].label)
      }
    }
  })

  it('🔴 the DELOAD repeats its level, so the label alone cannot separate it — the type must', () => {
    // The sharpest case and the reason the second half of this fix exists. The walk-run deload does
    // NOT drop a level: w3 and w4 are both L2, so every session is byte-identical and so is the new
    // label. Without a deload mark on the card the two weeks are indistinguishable.
    const sched = walkRunSchedule()
    const weeks = weeksFor()
    const repeats = sched
      .map((w, i) => ({ i, w }))
      .filter(({ i, w }) => w.deload && i > 0 && sched[i - 1].level === w.level)
    expect(repeats.length, 'no deload repeats its level; re-read this arm against the schedule')
      .toBeGreaterThan(0)
    for (const { i } of repeats) {
      expect(weeks[i].label, 'a repeated level SHOULD read the same').toBe(weeks[i - 1].label)
      expect(weeks[i].type, `w${i + 1} repeats a level and is not typed deload, so nothing marks it`)
        .toBe('deload')
    }
  })
})

describe('WALKRUN-WEEK-LEGIBILITY-01 — the two renderings of a week agree', () => {
  const SRC = readFileSync('components/training/PlanCalendar.tsx', 'utf8')

  /** A named function's body, by brace balance. Never a grep of the file. */
  function body(name: string): string {
    const at = SRC.indexOf(`function ${name}(`)
    expect(at, `no function ${name}`).toBeGreaterThan(-1)
    const open = SRC.indexOf('{', SRC.indexOf(')', at))
    let d = 0
    for (let i = open; i < SRC.length; i++) {
      if (SRC[i] === '{') d++
      else if (SRC[i] === '}') { d--; if (d === 0) return SRC.slice(open, i + 1) }
    }
    throw new Error(`unbalanced ${name}`)
  }

  it('🔴 BOTH the expanded card and the collapsed strip mark a deload', () => {
    // `WeekStripCard` carried `· deload` all along; `WeekCard` — the Now/Next card, the one a runner
    // actually reads — had no mark, so two renderings of the SAME week in the SAME file disagreed
    // about whether it was a planned step back.
    const mark = "(week as any).type === 'deload' && <span style={{ color: 'var(--mute)' }}> · deload</span>"
    expect(body('WeekCard'), 'the expanded week card does not mark a deload').toContain(mark)
    expect(body('WeekStripCard'), 'the collapsed strip no longer marks a deload').toContain(mark)
  })

  it('the week card renders `week.label`, which is why the label had to carry the ladder', () => {
    // If this stops being true the fix above is pointed at the wrong field, and every arm in the
    // first block would still pass while the runner saw nothing.
    expect(body('WeekCard')).toContain('{week.label ?? \'\'}')
  })
})
