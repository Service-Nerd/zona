import { describe, it, expect } from 'vitest'
import { KEEN_PATH, HELD_PATH, TRACE_VIEWBOX } from '@/components/marketing/HrTrace'
import { BREACH_MINUTES, RUN_MINUTES, HERO_TRACE, LOOP_SECONDS } from '@/lib/marketing/heroTrace'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * DESIGN-V3 — the shaded minutes must match Kit's line.
 *
 * ⚠️ THIS IS THE CHECK THE HANDOFF NEEDED AND DID NOT HAVE. Its card said
 * "14 minutes above your ceiling", its Kit line said 14, and its drawn path
 * sat above the ceiling for 44.7% of the run: about 25 minutes of a
 * 55-minute 8 km easy run. Number and sentence agreed with each other and
 * both disagreed with the picture, which is the one part a reader actually
 * looks at.
 *
 * A number in copy cannot be kept in step with a bezier by anyone reading
 * either of them. So the path is re-measured here: the curve is flattened,
 * the crossings with the ceiling are found numerically, and the x-span above
 * the ceiling is converted to minutes at the run's own duration.
 */

/** Flatten a cubic to points. 2000 steps/segment is far finer than the ~1px
 *  the crossing needs and costs nothing at this size. */
function flatten(d: string): Array<[number, number]> {
  const nums = (s: string) => s.trim().split(/[\s,]+/).map(Number)
  const m = d.match(/^M([^C]+)/)
  if (!m) throw new Error('path does not start with M')
  let [cx, cy] = nums(m[1])
  const pts: Array<[number, number]> = [[cx, cy]]
  for (const seg of Array.from(d.matchAll(/C([^C]+)/g))) {
    const [x1, y1, x2, y2, x3, y3] = nums(seg[1])
    for (let i = 1; i <= 2000; i++) {
      const t = i / 2000, u = 1 - t
      pts.push([
        u ** 3 * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
        u ** 3 * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
      ])
    }
    cx = x3; cy = y3
  }
  return pts
}

/** Fraction of the run's x-span that sits above the ceiling.
 *  SVG y grows downward, so "above the ceiling" is y < ceilingY. */
function breachFraction(d: string): number {
  const pts = flatten(d)
  let above = 0
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][1] < TRACE_VIEWBOX.ceilingY && pts[i - 1][1] < TRACE_VIEWBOX.ceilingY) {
      above += pts[i][0] - pts[i - 1][0]
    }
  }
  return above / (TRACE_VIEWBOX.x1 - TRACE_VIEWBOX.x0)
}

function crossings(d: string): number[] {
  const pts = flatten(d)
  const out: number[] = []
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1][1] - TRACE_VIEWBOX.ceilingY
    const b = pts[i][1] - TRACE_VIEWBOX.ceilingY
    if (a * b < 0) out.push(pts[i - 1][0] + (-a / (b - a)) * (pts[i][0] - pts[i - 1][0]))
  }
  return out
}

describe('HR trace geometry matches the copy', () => {
  it('the keen path breaches the ceiling for exactly the minutes Kit names', () => {
    const minutes = breachFraction(KEEN_PATH) * RUN_MINUTES
    // Half a minute of slack: the figure is displayed as a whole number, so
    // anything that still rounds to it is honest.
    expect(minutes).toBeGreaterThan(BREACH_MINUTES - 0.5)
    expect(minutes).toBeLessThan(BREACH_MINUTES + 0.5)
  })

  it('crosses the ceiling exactly twice — up once, down once', () => {
    // Three crossings would mean the shaded region is two separate breaches,
    // which "14 minutes above your ceiling" would still total correctly but
    // "ease it back" would no longer describe.
    expect(crossings(KEEN_PATH)).toHaveLength(2)
  })

  it('breaches deeply enough to read as a breach', () => {
    // A path can satisfy the minutes and still be a barely-visible graze. The
    // amber is the argument; 30 units is where it stops carrying at mini size.
    const peak = Math.min(...flatten(KEEN_PATH).map(p => p[1]))
    expect(TRACE_VIEWBOX.ceilingY - peak).toBeGreaterThan(30)
  })

  it('the held path never crosses the ceiling', () => {
    expect(crossings(HELD_PATH)).toHaveLength(0)
    expect(breachFraction(HELD_PATH)).toBe(0)
    // And its state says zero, which is the same claim in words.
    expect(HERO_TRACE.states[1].value).toBe('0')
  })

  it('Kit’s sentence is built from the constant, not typed beside it', () => {
    expect(HERO_TRACE.states[0].sentence).toContain(`${BREACH_MINUTES} minutes`)
    expect(HERO_TRACE.states[0].value).toBe(String(BREACH_MINUTES))
  })

  it('would notice the handoff’s original path', () => {
    // The falsification: the path as delivered. If this ever stops failing,
    // the check above has stopped measuring anything.
    const original =
      'M20,200 C55,186 85,150 115,138 C150,124 172,132 202,118 C232,104 252,86 277,76 ' +
      'C302,66 322,60 347,64 C372,68 392,84 412,98 C434,113 452,124 472,130 C505,140 538,148 580,156'
    const minutes = breachFraction(original) * RUN_MINUTES
    expect(minutes).toBeGreaterThan(20)   // measured 24.6
    expect(Math.abs(minutes - BREACH_MINUTES)).toBeGreaterThan(5)
  })
})


/**
 * ⚠️ A CROSS-FADE MUST STAY A SMALL FRACTION OF THE LOOP IT SERVES.
 *
 * The fades were tuned against a 7-second loop (0.65s and 0.5s — 9.3% and
 * 7.1% of the cycle, so the card was almost always settled). When the loop
 * dropped to 3 seconds nothing else moved, and those same durations became
 * **21.7% and 16.7%**: more than a fifth of the card's life showing two
 * numbers and two of Kit's sentences on top of each other. It looks like a
 * rendering fault, and it was first mistaken for a screenshot artefact.
 *
 * Two constants in two languages, in two files, with no link between them.
 * This is the link.
 */
describe('hero loop — the fades are sized against the loop, not against nothing', () => {
  const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
  /** Read a duration token from the FIRST `:root` block, not the
   *  reduced-motion override further down, which is legitimately 0s. */
  const root = css.slice(0, css.indexOf('@media (prefers-reduced-motion'))
  const seconds = (name: string) => {
    const m = root.match(new RegExp(`--${name}:\\s*([\\d.]+)s`))
    expect(m, `--${name} should be declared in :root with a seconds value`).not.toBeNull()
    return Number(m![1])
  }

  it.each(['motion-crossfade', 'motion-verdict'])(
    '%s is at most 12%% of LOOP_SECONDS',
    token => {
      const share = seconds(token) / LOOP_SECONDS
      expect(
        Math.round(share * 1000) / 10,
        `--${token} is ${seconds(token)}s against a ${LOOP_SECONDS}s loop. ` +
          'Above ~12% the card spends a visible share of its life as a double exposure.',
      ).toBeLessThanOrEqual(12)
    },
  )

  it('and is not so short that the fade reads as a jump cut', () => {
    // The lower bound matters too: a 0.05s "cross-fade" is a swap, and a swap
    // of the number under a static curve is what makes a loop feel like a bug.
    for (const t of ['motion-crossfade', 'motion-verdict']) {
      expect(seconds(t), `--${t} should still read as a fade`).toBeGreaterThanOrEqual(0.15)
    }
  })
})
