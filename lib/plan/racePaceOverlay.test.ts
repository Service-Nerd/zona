// RACE-PACE-OVERLAY-REACH-01 — §16's race-pace long run reaches HM, not just
// MARATHON, and the card quotes the right pace.
//
// THE DEFECT. §16 declares the overlay for "HM and MARATHON". The gate was
//
//     isMpLong = isLong && label.toLowerCase().includes('marathon-pace')
//
// and the HM catalogue row is named "Long run with HM-pace finish", which does
// not contain that substring. So the HM runner's key peak session — the one
// whose whole purpose is "race pace on legs that are already tired" — rendered
// as a plain easy run. Measured on the real display path 2026-09-14:
// **MARATHON 12/12, HM 0 of 18.** Half a ratified principle, unreachable, and
// invisible because the card just looked calm.
//
// It is the D-17 label-classification class that ADR-018 exists to remove, and
// it was found by extending `configConsumer.test.ts` to SESSION_FORMAT:
// `race_pace_distances: ['HM','MARATHON']` was declared and read by nothing.
//
// ⚠️ The gate must stay NARROW. Two sibling long runs must not be swept into
// this two-part shape: §24b's 5K/10K three-part segmented long run (easy → MP →
// HM finish, built inline with no catalogue row) and §47's step-back peak long
// run (which strips the label, the zone, lr_segment_pace and catalogue_id).
import { describe, it, expect } from 'vitest'
import { composeSession } from './sessionComposer'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { SESSION_FORMAT } from './sessionFormat'
import { GENERATION_CONFIG } from './generationConfig'
import type { Session } from '@/types/plan'

const row = (id: string) => {
  const r = V1_SESSION_CATALOGUE.find(x => x.id === id)
  if (!r) throw new Error(`catalogue row ${id} missing — this test is asserting nothing`)
  return r
}

/** A peak race-specific long run, as the engine builds one. */
function longRun(o: Partial<Session> = {}): Session {
  return {
    id: 'w10-sun', type: 'easy', label: 'Long run', detail: null,
    distance_km: 26, duration_mins: 158, primary_metric: 'distance',
    zone: 'Zone 2–3', hr_target: '< 148 bpm', rpe_target: 5, role: 'long_run',
    ...o,
  } as unknown as Session
}

const compose = (s: Session, rowId: string | null, goalPace: string | null = '5:20 /km') =>
  composeSession({ session: s, catalogueRow: rowId ? row(rowId) : null, goalPace })

describe('the overlay reaches both distances §16 declares', () => {
  it('HM gets the race-pace segment — the defect, stated', () => {
    const st = compose(longRun({ label: 'Long run with HM-pace finish', lr_segment_pace: '4:58 /km' }), 'hm_pace_long_run')
    expect(st?.shape, 'HM rendered a plain long run before this fix').toBe('long_run_with_mp')
    expect(st?.race_pace_segment).toBeTruthy()
  })

  it('MARATHON still gets it — the half that always worked did not regress', () => {
    const st = compose(longRun({ label: 'Marathon-pace long run', lr_segment_pace: '5:20 /km' }), 'mp_long_run')
    expect(st?.shape).toBe('long_run_with_mp')
  })

  it('the HM card says HM, not MP', () => {
    // A half-marathon runner told to hit "MP target" on their key session is
    // being handed the wrong number. `race_pace_zone` is declared per row and
    // was read by nothing.
    const hm = compose(longRun({ label: 'Long run with HM-pace finish', lr_segment_pace: '4:58 /km' }), 'hm_pace_long_run')
    expect(hm?.race_pace_segment?.description).toContain('HM target')
    expect(hm?.race_pace_segment?.description).not.toContain('MP target')

    const mp = compose(longRun({ label: 'Marathon-pace long run', lr_segment_pace: '5:20 /km' }), 'mp_long_run')
    expect(mp?.race_pace_segment?.description).toContain('MP target')
  })
})

describe('the gate is the ROW, not the label (D-17 / ADR-018)', () => {
  it('a label containing "marathon-pace" with no row gets NOTHING', () => {
    // Falsifies the old gate directly: this input used to produce the overlay.
    const st = compose(longRun({ label: 'Marathon-pace long run' }), null)
    expect(st?.shape).toBe('long_run')
    expect(st?.race_pace_segment).toBeUndefined()
  })

  it("§24b's three-part 5K/10K long run is not flattened into the two-part shape", () => {
    // easy → marathon pace (middle) → HM pace (finish). Built inline, no row.
    // The two-part shape would hide the marathon-pace middle block entirely.
    const st = compose(longRun({
      label: 'Long run — marathon pace + HM-pace finish',
      lr_segment_pace: '4:58 /km',
    }), null)
    expect(st?.shape).not.toBe('long_run_with_mp')
  })

  it('a §47 step-back long run gets nothing — the row is gone by then', () => {
    // §47 strips label, zone, lr_segment_pace and catalogue_id, so both the old
    // label join and the new row join fail. Asserted because the new gate must
    // not resurrect the overlay the step-back deliberately removed.
    const st = compose(longRun({
      label: 'Long run', zone: 'Zone 2', rpe_target: 4,
    }), null)
    expect(st?.race_pace_segment).toBeUndefined()
  })

  it('a quality row is not a long run, however it is shaped', () => {
    const st = composeSession({
      session: { ...longRun(), type: 'quality', role: undefined, label: 'HM-pace intervals' } as unknown as Session,
      catalogueRow: row('hm_pace_intervals'), goalPace: '4:58 /km',
    })
    expect(st?.shape).not.toBe('long_run_with_mp')
  })
})

describe('the pace quoted is the one the engine RECORDED', () => {
  it('prefers the session\'s own lr_segment_pace over the plan goal pace', () => {
    // §107 records it and five invariants govern it; one says the point of
    // recording it is that otherwise "nothing downstream can check or render
    // them". Nothing rendered it until now.
    const st = compose(longRun({ label: 'Long run with HM-pace finish', lr_segment_pace: '4:58 /km' }), 'hm_pace_long_run', '5:20 /km')
    expect(st?.race_pace_segment?.pace_target).toBe('4:58 /km')
  })

  it('falls back to goal pace for a plan generated before §107', () => {
    const st = compose(longRun({ label: 'Marathon-pace long run' }), 'mp_long_run', '5:20 /km')
    expect(st?.race_pace_segment?.pace_target).toBe('5:20 /km')
  })

  it('no pace at all means no segment — never an empty target', () => {
    const st = compose(longRun({ label: 'Marathon-pace long run' }), 'mp_long_run', null)
    expect(st?.race_pace_segment).toBeUndefined()
  })
})

describe('§25 owns the percentage, and the card agrees with the coach note', () => {
  const LO = GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MIN
  const HI = GENERATION_CONFIG.LR_RACE_SEGMENT_PCT_MAX

  it('the segment is the ROW\'s declared share, per distance', () => {
    // ⚠️ This test asserted the OPPOSITE this morning: that §16's flat 20%
    // governed and the rows' 35/40 were a stray second declaration. §25 — one
    // section away, titled "Race-specific long run (HM and marathon,
    // time-targeted)" — ratifies "the final 25–40% of the long run", so the row
    // values were the faithful encoding and 20% was the general default §25
    // overrides. Found by the board's mandatory conflict scan.
    for (const [label, id, pace, want] of [
      ['Long run with HM-pace finish', 'hm_pace_long_run', '4:58 /km', 35],
      ['Marathon-pace long run', 'mp_long_run', '5:20 /km', 40],
    ] as const) {
      const st = compose(longRun({ label, lr_segment_pace: pace }), id)
      expect(st?.race_pace_segment?.duration_pct, label).toBe(want)
    }
  })

  it('every declared row percentage sits inside §25\'s band', () => {
    const rows = V1_SESSION_CATALOGUE.filter(r =>
      (r.main_set_structure as { type?: string } | null)?.type === 'long_run_with_segment')
    expect(rows.length, 'no long_run_with_segment rows — this asserts nothing').toBeGreaterThan(0)
    for (const r of rows) {
      const pct = (r.main_set_structure as { race_pace_pct?: number }).race_pace_pct
      expect(typeof pct, `${r.id} declares no race_pace_pct`).toBe('number')
      expect(pct, r.id).toBeGreaterThanOrEqual(LO)
      expect(pct, r.id).toBeLessThanOrEqual(HI)
    }
  })

  it('the percentage is of the SESSION, and the parts sum to the run', () => {
    // §25 says "of the long run". Reading it against the MAIN SET delivered
    // ~16% of the session while the coach note on the same card said "Final
    // 30–50%" — one segment, two answers, both visible at once.
    const total = 165
    const st = compose(longRun({
      label: 'Marathon-pace long run', lr_segment_pace: '5:20 /km',
      duration_mins: total, distance_km: 30,
    }), 'mp_long_run')
    const seg = Math.round(total * 40 / 100)
    expect(st?.race_pace_segment?.duration_pct).toBe(40)
    const parts = (st?.warmup.duration_mins ?? 0) + (st?.main.duration_mins ?? 0)
      + seg + (st?.cooldown.duration_mins ?? 0)
    expect(parts, 'warm-up + easy body + segment + cool-down must equal the run').toBe(total)
  })

  it('falls back to §16\'s general 20% only when a row declares nothing', () => {
    // §16 remains the universal-format default for any future segmented long
    // run that has not declared its own dose. It must not be the value that
    // ships for §25's two rows.
    const st = composeSession({
      session: longRun({ label: 'Marathon-pace long run', lr_segment_pace: '5:20 /km' }),
      catalogueRow: { main_set_structure: { type: 'long_run_with_segment', race_pace_zone: 'MP' } } as never,
      goalPace: '5:20 /km',
    })
    expect(st?.race_pace_segment?.duration_pct).toBe(SESSION_FORMAT.LONG_RUN_PEAK.race_pace_segment_pct)
  })
})
