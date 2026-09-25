/**
 * TIME-INPUT-SECONDS-01 — Design Board 2026-09-25, SHIP WITH AMENDMENT.
 *
 * Every time-entry field collects seconds, and the decision lives in the
 * component rather than at the call site.
 *
 * 🔴 WHAT WAS WRONG. `DurationPicker` is the canonical time entry and already
 * supported seconds — behind a `showSeconds` prop defaulting to FALSE, set at
 * three call sites and forgotten at three. That is precisely the drift
 * `ui-patterns.md` § Form Fields & Pickers was written to end (*"the same
 * quantities were collected 2-3 different ways across screens; these primitives
 * end that drift"*), surviving as a prop instead of as a component.
 *
 * ⚠️ AND THE THREE SCREENS DID NOT OMIT SECONDS — THEY FABRICATED THEM.
 * `BenchmarkUpdateScreen` and the wizard built their strings as
 * `` `${h}:${mm}:00` ``, asserting a precision nobody entered. Measured on live
 * production data before the board ruled: **12 of 12 stored times end `:00`**
 * (4 of 4 target times, 8 of 8 benchmarks). Not one runner had ever recorded a
 * real seconds value.
 *
 * ⚠️ THE DIRECTION OF THE ERROR IS THE FINDING (Sierra). Truncating to the
 * minute always makes the runner look FASTER — worst case **11.8 sec/km at 5K**,
 * 5.9 at 10K, 2.8 at HM — and every prescribed pace derives from that benchmark,
 * in a product whose thesis is that people run their easy days too hard.
 *
 * ⚠️ RECORDED DISSENT (Wroblewski): a target is an intention, not a fact, and a
 * seconds wheel under *"what time are you aiming for?"* demands precision the
 * runner does not have. The chair's amendment answers it — the wheel ships
 * defaulting to `00`, so expressing no view costs nothing. **His objection is
 * not settled**, and the evidence that would settle it (do runners enter
 * non-round targets?) cannot exist until this ships.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const OWNER = 'components/shared/DurationPicker.tsx'

function tsxFiles(dirs = ['app', 'components'], out: string[] = []): string[] {
  for (const d of dirs) {
    for (const e of readdirSync(d)) {
      const full = join(d, e)
      if (statSync(full).isDirectory()) tsxFiles([full], out)
      else if (/\.tsx?$/.test(e) && !/\.test\./.test(e)) out.push(full)
    }
  }
  return out
}
const ALL = tsxFiles()
const CALLERS = ALL.filter(f => f !== OWNER && /<DurationPicker/.test(readFileSync(f, 'utf8')))

describe('seconds are the component\'s decision, not the call site\'s', () => {
  it('there ARE callers — otherwise everything below is vacuous', () => {
    expect(CALLERS.length, 'no file renders <DurationPicker>; has it been renamed?')
      .toBeGreaterThanOrEqual(5)
  })

  // 🔴 THE REGRESSION CASE.
  it('no call site passes showSeconds — the prop does not exist', () => {
    const offenders = ALL.filter(f => /showSeconds/.test(readFileSync(f, 'utf8'))
      && !readFileSync(f, 'utf8').split('\n').every(l => !/showSeconds/.test(l) || l.trim().startsWith('//')))
      .filter(f => f !== OWNER)
    expect(offenders, 'showSeconds is gone: seconds are always collected').toEqual([])
  })

  it.each(CALLERS)('%s passes secs and onSecsChange', file => {
    const src = readFileSync(file, 'utf8')
    const block = src.slice(src.indexOf('<DurationPicker'), src.indexOf('<DurationPicker') + 600)
    expect(/\bsecs=/.test(block), `${file}: <DurationPicker> without secs`).toBe(true)
    expect(/onSecsChange=/.test(block), `${file}: <DurationPicker> without onSecsChange`).toBe(true)
  })
})

describe('no screen fabricates the seconds it did not collect', () => {
  // The exact shape of the defect: a time string built with a literal :00 tail.
  const FABRICATED = /`\$\{[^`]*\}:\$\{[^`]*padStart\(2[^`]*\}:00`/

  it.each(CALLERS)('%s builds no `H:MM:00` literal', file => {
    const src = readFileSync(file, 'utf8')
    const hits = src.split('\n')
      .map((l, i) => ({ l: l.trim(), n: i + 1 }))
      .filter(x => FABRICATED.test(x.l))
    expect(hits.map(h => `${file}:${h.n}  ${h.l}`),
      'a hardcoded :00 asserts a precision the runner never entered — '
      + 'measured 12 of 12 stored times ending :00, and the error always runs FAST',
    ).toEqual([])
  })

  it('the fixed-protocol 30-minute time trial keeps its literal, and that is correct', () => {
    // `'30:00'` is the PROTOCOL, not a runner-entered value — a 30-min TT is 30
    // minutes by definition. Named so the exemption reads as a decision.
    const src = readFileSync('app/dashboard/BenchmarkUpdateScreen.tsx', 'utf8')
    expect(src).toContain("time: '30:00'")
  })
})
