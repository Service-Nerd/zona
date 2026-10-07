// LEGACY-RAMP-BACKFILL-01 — the founder asked THREE TIMES why his own session
// still showed `9:20 min`, and all three of my answers were about the generator.
//
// 🔴 THE RAMP IS STAMPED INTO `plan_json` AT GENERATION. §8 Am. fixed
// `resolveMainSet`, which runs when a plan is BUILT — so his plan, generated
// 2026-04-21, was never going to change no matter what shipped. The answer was in
// his stored row, which this fixture reproduces byte-for-byte from production:
//
//     step1  9:20  pace="5:53–7:02 /km"
//     step2  9:20  pace=null  zone="Z2-Z3"
//     step3  9:20  pace="5:07–5:22 /km"
//
// 📐 Measured across the WHOLE production `plans` table: 13 of 30 plans, 30
// steps, 30 of 30 `progressive_tempo`, 30 of 30 bracketed by paced neighbours.
import { describe, it, expect } from 'vitest'
import { backfillLegacyRamp, buildStepGroups } from './sessionSteps'
import type { DerivedStep } from './resolveMainSet'

const fmt = (km: number) => `${km.toFixed(1)}km`
const opts = { metric: 'distance' as const, units: 'km' as const, formatDist: fmt }

/** The founder's stored week-3 Wednesday, exactly as it sits in production. */
const STORED: DerivedStep[] = [
  { role: 'work', modality: 'run', length: '9:20', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto',
    note: 'Hold back. This is the part that makes the last third honest.' },
  { role: 'work', modality: 'run', length: '9:20', pace: null, zone: 'Z2-Z3', advance: 'auto',
    note: 'Let it rise. Don’t chase it.' },
  { role: 'work', modality: 'run', length: '9:20', pace: '5:07–5:22 /km', advance: 'auto',
    note: 'Threshold now. Same effort as rep three of a cruise set.' },
]

describe('LEGACY-RAMP-BACKFILL-01 — a plan generated before the fix still renders the ramp', () => {
  it('fills the middle third from the anchors its neighbours carry', () => {
    const out = backfillLegacyRamp(STORED, { ...opts, catalogueId: 'progressive_tempo' })
    expect(out[1]!.pace, 'the stored middle third did not get its ramp — every plan generated ' +
      'before 2026-10-07 still shows a bare duration between two distances').toBe('5:53 → 5:07 /km')
    // The neighbours are untouched: this fills a gap, it does not rewrite a prescription.
    expect(out[0]!.pace).toBe(STORED[0]!.pace)
    expect(out[2]!.pace).toBe(STORED[2]!.pace)
  })

  it('the row then leads with a DISTANCE, like the rows above and below it', () => {
    const [group] = buildStepGroups(
      { version: 2, blocks: [{ repeat: 1, steps: backfillLegacyRamp(STORED, { ...opts, catalogueId: 'progressive_tempo' }) }] } as never,
      { ...opts, catalogueId: 'progressive_tempo' },
    )
    const leads = group!.rows.map(r => r.amountUnit)
    expect(leads, 'the middle row still leads with minutes beside two rows in km — which is ' +
      'exactly what the founder photographed three times').toEqual(['km', 'km', 'km'])
  })

  it('does NOT fire on another row, because the neighbour is not the T anchor there', () => {
    // 🩹 Willy's binding condition. On a `5K-pace progression` the following third
    // is the 5K anchor; ramping to it would roughly double the session's hard
    // component. `progressive_tempo`'s following third IS `{ anchor: 'T' }` by
    // construction, which is the only reason reading a neighbour is sound here.
    const out = backfillLegacyRamp(STORED, { ...opts, catalogueId: 'fivek_pace_progression' })
    expect(out[1]!.pace, 'the backfill ran on a row where the neighbour is not the T anchor').toBeNull()
    expect(backfillLegacyRamp(STORED, opts)[1]!.pace, 'it ran with no catalogue id at all').toBeNull()
  })

  it('a NEW plan is untouched — the generator has already stamped the ramp', () => {
    const already = STORED.map((s, i) => (i === 1 ? { ...s, pace: '5:53 → 5:07 /km' } : s))
    expect(backfillLegacyRamp(already, { ...opts, catalogueId: 'progressive_tempo' })).toBe(already)
  })

  it('withholds a ramp that would not RISE (PROGRESSION-GOAL-INVERTED-01)', () => {
    const inverted = STORED.map((s, i) => (i === 2 ? { ...s, pace: '5:56–6:10 /km' } : s))
    const out = backfillLegacyRamp(inverted, { ...opts, catalogueId: 'progressive_tempo' })
    expect(out[1]!.pace, 'a backwards ramp was drawn on a step whose note says "let it rise"').toBeNull()
  })
})
