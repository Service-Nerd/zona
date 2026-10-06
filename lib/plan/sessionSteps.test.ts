import { describe, it, expect } from 'vitest'
import { buildStepGroups, parseLength, roleLabelForStep, targetClause, NO_PACE_QUALIFIER } from './sessionSteps'
import type { DerivedSet } from './resolveMainSet'
import { formatDistance } from '@/lib/format'

const fmt = (km: number) => `${Number(km.toFixed(2))} km`

describe('parseLength', () => {
  it('parses durations, distances, and text', () => {
    expect(parseLength('5 min')).toEqual({ kind: 'duration', secs: 300 })
    expect(parseLength('1:30')).toEqual({ kind: 'duration', secs: 90 })
    expect(parseLength('45s')).toEqual({ kind: 'duration', secs: 45 })
    expect(parseLength('400 m')).toEqual({ kind: 'distance', km: 0.4 })
    expect(parseLength('5 km')).toEqual({ kind: 'distance', km: 5 })
    expect(parseLength('until ready')).toEqual({ kind: 'text', text: 'until ready' })
  })
  it('resolves a mirror to the length it mirrors', () => {
    expect(parseLength('same as the 1:30')).toEqual({ kind: 'duration', secs: 90 })
  })
})

/**
 * 🔴 `detail` IS NOW `target · secondary`, TARGET FIRST (SESSION-STEP-SLOTS-01,
 * Design Board 2026-10-06). It used to read `duration · target`.
 *
 * 🎓 Sierra's finding carried the ruling: mid-run the runner is answering *am I
 * doing the right thing right now?*, and the answer is the target. Their watch
 * already shows distance and time; it does not show what we told them to hold.
 * So the target is line two, first, on every row of every session — warm-up,
 * strides, main set, race-pace segment and cool-down alike.
 *
 * ⚠️ The last expectation below gains `· ~1.1 km`: on the DURATION setting a step
 * now carries the derived distance as its secondary. The old code's distance
 * branch never consulted the toggle at all, which is why the duration setting
 * mixed units on 33.2% of blocks against the distance setting's 29.2% — the
 * duration runner was served worse and nobody had measured it.
 */
describe('targetClause', () => {
  const ceiling = { role: 'recovery', modality: 'jog', length: '1:30', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' } as const
  // 🔴 THIS CASE USED TO ASSERT `'≤ 5:53–7:02 /km'` AND WAS NAMED FOR IT
  // ("marks a ceiling pace with ≤"). `design-rulings.md` (CD-11 / §12) had
  // already ruled the opposite, by name: *"'or slower' is ratified coaching
  // doctrine — never a ≤ symbol, which reads backwards for pace."* So a test
  // stood in for a ruling that said the reverse, on 41.6% of rendered steps,
  // and `easyPaceCeilingReach.test.ts` asserted `.not.toContain('≤')` on the
  // SAME quantity in another file. Same shape as `design-rulings.md:721` — a
  // rule that lives only in a test is not a rule, and here it was not even that.
  //
  // ⚠️ THE SIGN WAS INVERTED, not merely ugly: ADR-019 defines ceiling as "no
  // faster than", which on a pace NUMBER is ≥, not ≤. And it was printed over
  // the whole BAND, which is an operator applied to a range.
  it('renders a ceiling as the ratified "or slower", never an operator', () => {
    expect(targetClause(ceiling, 'km')).toBe('5:53 /km or slower')
    expect(targetClause(ceiling, 'km')).not.toContain('≤')
  })
  it('uses RPE when effort-governed, and says the pace is absent on purpose', () => {
    // §21b Am. 4 (Design Board, 2026-10-06 evening). The qualifier is appended to
    // what IS prescribed, never in place of it — Silvanto's precision condition.
    expect(targetClause({ role: 'work', modality: 'run', length: '1:30', pace: null, rpe: 8, advance: 'auto' }, 'km'))
      .toBe(`RPE 8 \u00b7 ${NO_PACE_QUALIFIER}`)
  })
  // PACE-UNITS-STEPS-01 — the QUALIFIER must survive the conversion, and the
  // conversion must not eat it. Both halves, because a qualifier lost to a regex
  // is a ceiling silently re-read as a target. The band is reduced to its fast
  // end AFTER conversion, so the number is the miles one.
  it('converts a ceiling band to miles and keeps the qualifier', () => {
    expect(targetClause(ceiling, 'mi')).toBe('9:28 /mi or slower')
  })
  it('converts a single target pace to miles', () => {
    expect(targetClause({ role: 'work', modality: 'run', length: '2 km', pace: '5:00 /km', pace_mode: 'target', advance: 'auto' }, 'mi'))
      .toBe('8:03 /mi')
  })
  it('leaves an RPE step alone in miles', () => {
    // The unit conversion must not touch an RPE, and §21b Am. 4's qualifier is
    // unit-free, so this reads identically in both systems.
    expect(targetClause({ role: 'work', modality: 'run', length: '1:30', pace: null, rpe: 8, advance: 'auto' }, 'mi'))
      .toBe(`RPE 8 \u00b7 ${NO_PACE_QUALIFIER}`)
  })
})

describe('buildStepGroups — VO2 rep set, distance toggle', () => {
  const set: DerivedSet = {
    version: 2,
    blocks: [{
      repeat: 6,
      steps: [
        { role: 'work', modality: 'run', length: '3 min', pace: '4:30–4:42 /km', pace_mode: 'target', advance: 'auto' },
        { role: 'recovery', modality: 'jog', length: '2 min', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ],
    }],
  }
  const groups = buildStepGroups(set, { metric: 'distance', units: 'km', formatDist: fmt })

  it('is one repeat block of 6 with two rows', () => {
    expect(groups).toHaveLength(1)
    expect(groups[0].repeat).toBe(6)
    expect(groups[0].repeatLabel).toBe('rounds of')
    expect(groups[0].rows).toHaveLength(2)
  })
  it('leads with an estimated distance and keeps time + pace in the detail', () => {
    const work = groups[0].rows[0]
    expect(work.role).toBe('Hard')
    expect(work.amountIsEstimate).toBe(true)
    expect(work.amount).toMatch(/^~/)          // pace-derived estimate
    expect(work.detail).toBe('4:30–4:42 /km · 3 min')
  })
  it('marks the recovery jog as rest with a pace ceiling', () => {
    const rest = groups[0].rows[1]
    expect(rest.kind).toBe('rest')
    expect(rest.role).toBe('Jog')
    expect(rest.detail).toBe('5:53 /km or slower · 2 min')
  })
})

describe('buildStepGroups — hill reps (effort-based, mixed lengths)', () => {
  const set: DerivedSet = {
    version: 2,
    blocks: [
      { repeat: 1, steps: [
        { role: 'transition', modality: 'run', length: 'to the bottom of the hill', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ]},
      { repeat: 8, steps: [
        { role: 'work', modality: 'run', terrain: 'uphill', length: '1:30', pace: null, rpe: 8, advance: 'auto' },
        { role: 'recovery', modality: 'stand', length: 'until ready', pace: null, advance: 'auto' },
        { role: 'recovery', modality: 'jog', terrain: 'downhill', length: 'same as the 1:30', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ]},
    ],
  }
  const groups = buildStepGroups(set, { metric: 'distance', units: 'km', formatDist: fmt })

  it('keeps the lead-in as a one-off "Run to base"', () => {
    expect(groups[0].repeat).toBe(1)
    expect(groups[0].rows[0].role).toBe('Run to base')
  })
  it('labels the repeat block as hill reps', () => {
    expect(groups[1].repeat).toBe(8)
    expect(groups[1].repeatLabel).toBe('hill reps')
  })
  it('keeps the uphill effort-based: time primary, RPE detail (no invented distance)', () => {
    const up = groups[1].rows[0]
    expect(up.role).toBe('Uphill')
    // ADR-015 §1 — the amount ALWAYS carries a unit. This used to read a bare
    // `1:30`, in the column where sibling rows show `~1.4km`, which is the
    // glyph ambiguity (minutes vs miles vs metres) that ADR renamed as a defect.
    expect(up.amount).toBe('1:30 min')
    expect(up.amountIsEstimate).toBe(false)
    expect(up.detail).toBe(`RPE 8 \u00b7 ${NO_PACE_QUALIFIER}`)
  })
  it('renders the stand and the downhill jog legibly', () => {
    expect(groups[1].rows[1].role).toBe('Stand')
    expect(groups[1].rows[1].amount).toBe('until ready')
    expect(groups[1].rows[2].role).toBe('Jog down')       // downhill jog
    expect(groups[1].rows[2].amountIsEstimate).toBe(true) // mirror → 1:30, estimated from pace
    expect(groups[1].rows[2].detail).toBe('5:53 /km or slower · 1:30 min')
  })
})

describe('buildStepGroups — duration toggle keeps time primary', () => {
  const set: DerivedSet = {
    version: 2,
    blocks: [{ repeat: 4, steps: [
      { role: 'work', modality: 'run', length: '5 min', pace: '4:25–4:35 /km', pace_mode: 'target', advance: 'auto' },
    ]}],
  }
  it('shows the duration as the amount when the toggle is on time', () => {
    const groups = buildStepGroups(set, { metric: 'duration', units: 'km', formatDist: fmt })
    expect(groups[0].rows[0].amount).toBe('5 min')
    expect(groups[0].rows[0].amountIsEstimate).toBe(false)
    expect(groups[0].rows[0].detail).toBe('4:25–4:35 /km · ~1.1 km')
  })
})

describe('STEP-SUBUNIT-ZERO-01 — an estimate that rounds to zero is not an estimate', () => {
  /**
   * 📐 MEASURED BEFORE CHANGING WHAT THE CARD LEADS WITH, because the item asked
   * for that: **640 rows of 188,928 read `~0mi`**, across 51,200 sessions from
   * 6,144 `targetedGrid()` inputs. Every one was the 30-second recovery `Jog` in
   * a quality session, and every one already carried the honest number in its own
   * detail line. **The row led with a zero and relegated the truth.** After the
   * fix: **0 of the same 188,928 rows**, so nothing was dropped.
   *
   * ⚠️ MILES IS WHERE IT FIRED; KM IS ONE SLOWER PACE AWAY. 30s at mile pace is
   * ~0.04 mi → `0mi`; at km pace it is 0.0625 km → `0.1km`. So the corpus shows
   * zero km hits and the bug is **latent** there, not absent —
   * `formatDistance(0.04, 'km')` is `0km` as well. Both units are asserted below
   * for that reason.
   */
  const step = (secs: number) => ({
    blocks: [{ reps: 1, steps: [
      { role: 'work', length: '3 min', pace: '5:00-5:20 /km' },
      { role: 'recovery', length: `${secs} s`, pace: '7:00-8:00 /km' },
    ] }],
  })

  const rows = (secs: number, units: 'km' | 'mi', fmt?: (km: number) => string) =>
    buildStepGroups(step(secs) as never, {
      metric: 'distance', units,
      formatDist: fmt ?? ((km: number) => formatDistance(km, units, { exact: true }) ?? '—'),
    }).flatMap(g => g.rows ?? [])

  // ⚠️ THE TWO UNITS NEED DIFFERENT DURATIONS, AND MY FIRST CUT OF THIS ARM GOT
  // IT WRONG WITH THE MEASUREMENT ALREADY IN HAND. I asserted km must also lead
  // with the duration at 30s. It must not: 30s at km pace is 0.0625 km, which
  // formats `0.1km` — a legible estimate the guard is right to leave alone.
  // **The km case needs a SHORTER step to reach zero**, which is exactly what
  // "latent, not absent" means, and writing the arm from assumption instead of
  // from the number I had just produced is how a test ends up asserting the
  // opposite of the finding.
  const ZERO_CASE = [
    { units: 'mi' as const, secs: 30, why: '~0.04 mi → `0mi`, the 640 live rows' },
    { units: 'km' as const, secs: 10, why: '~0.02 km → `0km`, the latent case' },
  ]
  for (const { units, secs, why } of ZERO_CASE) {
    it(`${units}: a ${secs}-second recovery leads with its DURATION, never a zero distance (${why})`, () => {
      const recover = rows(secs, units).find(r => /recover|jog/i.test(r.role))
      expect(recover, 'no recovery row produced').toBeTruthy()
      expect(recover!.amount, 'the card is telling the runner this step covers no ground')
        .not.toMatch(/^~0(\.0+)?\s*(km|mi|m)?$/)
      expect(recover!.amount, 'the honest number should lead').toContain(`${secs}s`)
      expect(recover!.amountIsEstimate, 'a duration is not an estimate').toBe(false)
    })
  }

  it('km at 30s is LEGIBLE and must keep its estimate — the guard is not a blanket', () => {
    // The measured asymmetry, asserted so it cannot be "tidied" into symmetry.
    const recover = rows(30, 'km').find(r => /recover|jog/i.test(r.role))
    expect(recover!.amount).toBe('~0.1km')
    expect(recover!.amountIsEstimate).toBe(true)
  })

  it('does NOT over-correct: an estimate that is legible still shows as an estimate', () => {
    // The guard must suppress a zero, not the estimate feature. A 10-minute
    // recovery covers real ground in either unit and must still read `~N`.
    for (const units of ['mi', 'km'] as const) {
      const recover = rows(600, units).find(r => /recover|jog/i.test(r.role))
      expect(recover!.amountIsEstimate, `${units}: the estimate was suppressed wholesale`).toBe(true)
      expect(recover!.amount).toMatch(/^~/)
    }
  })

  it('🔴 asks the FORMATTER what zero looks like, rather than matching /^0/', () => {
    // ⚠️ THE ARM THAT PROVES THE MECHANISM. `formatDist` is an injected
    // parameter with a sub-unit path for km, and ADR-015 owns it. A regex for
    // `/^0/` would pass this file and break the day the formatter renders zero
    // differently. Here it renders zero as the word "nil": a correct
    // implementation still suppresses it, a regex-based one would not.
    // The threshold must exceed the 0.0625 km this step actually produces, or the
    // fake never fires and the arm proves nothing — which is what my first cut
    // did, at 0.05.
    const nil = (km: number) => (km < 0.1 ? 'nil' : `${km.toFixed(2)}mi`)
    const recover = rows(30, 'mi', nil).find(r => /recover|jog/i.test(r.role))
    expect(recover!.amount, 'a formatter whose zero is not "0" was not recognised')
      .not.toContain('nil')
    expect(recover!.amount).toContain('30s')
  })
})
