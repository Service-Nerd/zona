import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { moveDayRole, blockedDayLine, type MoveDayRole } from './PlanCalendar.logic'
import { normaliseDays } from '@/lib/plan/days'

/**
 * REORDER-BLOCKED-DAY-01 — move mode offered the days the runner said they cannot train.
 *
 * 📐 WHY THESE ARMS AND NOT A RENDER TEST: `vitest.config.ts` is `environment: 'node'` with no
 * jsdom, so the alternative was a source assertion, and **a source assertion passes on a comment**
 * (SHEET-RAF-FALLBACK-01). The verdict is a pure function for exactly that reason, and these arms
 * run it. The two arms that read source are scoped to the WIRING — that the verdict reaches the row
 * and that the row is inert — which no pure call can prove.
 */

const OFFERABLE = { target: true, swap: false, both: false }
const SWAPPABLE = { target: true, swap: true, both: false }

function role(day: string, blockedWords: readonly string[], over: Partial<Parameters<typeof moveDayRole>[0]> = {}): MoveDayRole {
  return moveDayRole({
    targetDay: day,
    blocked: normaliseDays(blockedWords),
    choices: OFFERABLE,
    occupied: false,
    rowHasSession: false,
    ...over,
  })
}

describe('moveDayRole — the move-mode day verdict', () => {
  it('🔴 an EMPTY blocked day is never a move target: the live defect, in one line', () => {
    // The shape measured 1,679 times across 563 live plan-weeks: §18 kept the day clear, so the day
    // is empty, so `moveChoices` says "offerable", so the row painted a dashed "Move here".
    expect(role('thu', ['monday', 'thursday'])).toBe('blocked')
    // Falsification: delete the blocked arm in `PlanCalendar.logic.ts` and this reads 'move'.
    expect(role('thu', ['monday', 'thursday'])).not.toBe('move')
  })

  it('an open day is still a move target, and an occupied open day still a swap target', () => {
    expect(role('wed', ['monday', 'thursday'])).toBe('move')
    expect(role('wed', ['monday', 'thursday'], { choices: SWAPPABLE, occupied: true, rowHasSession: true })).toBe('swap')
  })

  it('🔴 an OCCUPIED blocked day keeps its swap: all 9 live instances are races, and §77 permits them', () => {
    // §77 exempts race day from `days_cannot_train` deliberately — a runner who cannot train on
    // Wednesdays can still race on one. Measured 2026-11-16: 9 of 1,688 blocked day slots hold a
    // session and **every one is a race**. Calling that day "blocked" would deny a swap with a
    // session that is legitimately there, and this is the arm a careless fix breaks.
    expect(role('sat', ['saturday'], { choices: SWAPPABLE, occupied: true, rowHasSession: true })).toBe('swap')
  })

  it('reads BOTH wire spellings, through the owner, because the wizard stores full words', () => {
    // `days_cannot_train` is 'monday' from the wizard and 'mon' from the engine. A set built from
    // raw input matches nothing, and "nothing is blocked" looks exactly like "the runner blocked
    // nothing" — the silent failure `lib/plan/days.ts` exists to end.
    expect(role('mon', ['monday'])).toBe('blocked')
    expect(role('mon', ['mon'])).toBe('blocked')
    expect(role('mon', ['MONDAY'])).toBe('blocked')
  })

  it('an UNKNOWN constraint leaves every day offerable, and never claims nothing is blocked', () => {
    // 7 of 43 live plans predate `meta.generator_input` and cannot answer. Absence is not a value.
    expect(role('thu', [])).toBe('move')
    expect(moveDayRole({ targetDay: 'thu', blocked: normaliseDays(undefined), choices: OFFERABLE, occupied: false, rowHasSession: false })).toBe('move')
  })

  it('a day that is not offerable at all is "none", blocked or not', () => {
    // The source day itself, and a day already holding two sessions (§126): nothing to explain.
    expect(role('wed', ['monday'], { choices: null })).toBe('none')
    // 🔴 AND NULL CHOICES MEANS NO MOVE IS STAGED, so a blocked day is 'none' too — not 'blocked'.
    // The first cut returned 'blocked' here and the component patched it with its own `!!movingDay`,
    // which is two places deciding one thing inside the owner built to stop that. Found in review.
    expect(role('mon', ['monday'], { choices: null })).toBe('none')
    // An occupied day whose THIS row is the empty continuation slot is not a swap target.
    expect(role('wed', [], { choices: SWAPPABLE, occupied: true, rowHasSession: false })).toBe('none')
  })

  it('returns exactly one role for every combination — no state is unreachable or doubled', () => {
    const seen = new Set<MoveDayRole>()
    for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      for (const blockedWords of [[], ['monday'], ['monday', 'thursday']]) {
        for (const choices of [null, OFFERABLE, SWAPPABLE]) {
          for (const occupied of [false, true]) {
            for (const rowHasSession of [false, true]) {
              seen.add(moveDayRole({ targetDay: day, blocked: normaliseDays(blockedWords), choices, occupied, rowHasSession }))
            }
          }
        }
      }
    }
    expect(Array.from(seen).sort()).toEqual(['blocked', 'move', 'none', 'swap'])
  })
})

describe('blockedDayLine — one spelling of the sentence', () => {
  it('names the day in the plural, second person, as the runner’s own setting', () => {
    expect(blockedDayLine('thu')).toBe("You don't run Thursdays")
    expect(blockedDayLine('sun')).toBe("You don't run Sundays")
  })

  it('🔴 says RUN, not TRAIN: strength has its own unavailable_days and a lift may sit here', () => {
    // The first draft said "train". `packages/strength` carries `unavailable_days` on the strength
    // profile, a different field from the run plan's `days_cannot_train`, so a lift can legitimately
    // be scheduled on a run-blocked day — and the sentence would have been printed on a row the
    // runner can see has a session on it. It is also what the wizard asked: `WeekGrid` cycles each
    // day Rest → Run → Long.
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      expect(blockedDayLine(d)).not.toContain('train')
      expect(blockedDayLine(d)).toContain('run')
    }
  })

  it('never renders a raw day key or an empty sentence on an unrecognised day', () => {
    expect(blockedDayLine('xyz')).toBe("You don't run this day")
    expect(blockedDayLine('')).toBe("You don't run this day")
  })

  it('carries no em dash, as every runner-facing sentence must not (BRAND-EMDASH-APP-01)', () => {
    for (const d of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'xyz']) {
      expect(blockedDayLine(d)).not.toContain('—')
    }
  })
})

describe('the wiring — what a pure call cannot reach', () => {
  const SRC = readFileSync('components/training/PlanCalendar.tsx', 'utf8')

  /**
   * 🔴 THE COMMENTS COME OUT FIRST, AND THIS GATE CAUGHT ITSELF NEEDING IT.
   *
   * The first cut indexed the raw region and read `abandonMove()` out of the sentence
   * *"every non-than-target tap calls `abandonMove()`"* that the fix itself had just written one
   * line above the guard — so the order assertion compared the guard against its own
   * documentation and failed. **Searching for the thing finds the comment ABOUT the thing**, which
   * is `HOOK-RGBA-COMMENTS-01` from the other side.
   *
   * Quote-aware rather than line-wise, so a `//` inside a string literal is not a comment. Block
   * comments go too: the JSX branch above the guard is one.
   */
  function stripComments(src: string): string {
    let out = '', q: string | null = null
    for (let i = 0; i < src.length; i++) {
      const c = src[i]
      if (q) { out += c; if (c === '\\') { out += src[++i] ?? ''; continue } if (c === q) q = null; continue }
      if (c === '"' || c === "'" || c === '`') { q = c; out += c; continue }
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; out += '\n'; continue }
      if (c === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); i = end === -1 ? src.length : end + 1; continue }
      out += c
    }
    return out
  }

  it('the reader strips comments, or it reads the documentation instead of the code', () => {
    // Falsification of the READER, not of the subject: the first cut of the arm below passed this
    // same marker through unstripped and matched prose.
    expect(stripComments('a // abandonMove()\nb')).not.toContain('abandonMove')
    expect(stripComments('/* abandonMove() */ b')).not.toContain('abandonMove')
    // And a `//` inside a string is not a comment.
    expect(stripComments("const u = 'https://x' // gone")).toContain('https://x')
  })

  /** The body of a named function or arrow prop, bounded by brace balance. Never a grep of the file. */
  function region(startMarker: string): string {
    const at = SRC.indexOf(startMarker)
    expect(at, `marker not found: ${startMarker}`).toBeGreaterThan(-1)
    const open = SRC.indexOf('{', at)
    let depth = 0
    for (let i = open; i < SRC.length; i++) {
      if (SRC[i] === '{') depth++
      else if (SRC[i] === '}') { depth--; if (depth === 0) return SRC.slice(open, i + 1) }
    }
    throw new Error(`unbalanced region from ${startMarker}`)
  }

  it('the day row takes its target state from the OWNER, not from inline booleans', () => {
    // The two booleans used to be derived in the JSX. If either is ever computed from `choices`
    // again, a blocked day becomes a target with nothing to say so.
    expect(SRC).toContain("const isMoveTarget = role === 'move'")
    expect(SRC).toContain("const isSwapTarget = role === 'swap'")
    expect(SRC).not.toContain('const isMoveTarget = !!choices')
    expect(SRC).not.toContain('const isSwapTarget = !!choices')
    // 🔴 AND THE CALLER MAY NOT RE-GUARD THE VERDICT. The first cut read
    // `!!movingDay && role === 'blocked'`, because the owner answered 'blocked' on an ordinary
    // render. That is two places deciding one thing, inside the owner written to stop it.
    expect(SRC).toContain("const isBlockedDay = role === 'blocked'")
    expect(SRC).not.toContain("!!movingDay && role === 'blocked'")
  })

  it('🔴 a blocked row is INERT: it returns before the abandon AND before the strength open', () => {
    // This is the other half of the fix and it has no pure surface. Every non-target tap in move
    // mode calls `abandonMove()` — the staged move vanishes unexplained, which is what the item
    // recorded as "the app refused". Order matters twice: after the target check, before both.
    const body = stripComments(region('onTap={() => {'))
    const blockedAt = body.indexOf('if (isBlockedDay) return')
    const abandonAt = body.indexOf('abandonMove()')
    const strengthAt = body.indexOf('dayStrength?.onOpen()')
    expect(blockedAt, 'the blocked guard is missing from onTap').toBeGreaterThan(-1)
    expect(blockedAt).toBeLessThan(abandonAt)
    expect(blockedAt).toBeLessThan(strengthAt)
  })

  it('both move-mode day lines share ONE type register, so neither can drift', () => {
    // MICRO-LABEL-DRIFT-01: four uppercase labels at three trackings on one screen. Two sentence
    // lines in one row, written out twice, is the same thing starting again.
    expect(SRC).toContain('const MOVE_MODE_LINE: React.CSSProperties')
    expect(SRC).toContain("{ ...MOVE_MODE_LINE, color: 'var(--mute)' }")
    expect(SRC).toContain("{ ...MOVE_MODE_LINE, color: 'var(--moss-strong)' }")
  })

  it('the blocked row is exempt from the move-mode dim, because --mute at 0.4 fails AA', () => {
    // `opacity` is multiplicative over the subtree, so the sentence cannot opt out on its own:
    // --mute #6D6963 is 5.45:1 on --card and composites to roughly 1.8:1 at 0.4.
    expect(SRC).toContain('opacity: blockedLine ? 1 :')
  })
})
