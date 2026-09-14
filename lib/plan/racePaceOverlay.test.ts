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

describe('§16 owns the percentage, not the catalogue row', () => {
  it('the segment is SESSION_FORMAT\'s 20%, for both distances', () => {
    // The rows declare their own split (hm 65/35, mp 60/40) and §16 declares 20%.
    // Coaching Board 2026-09-14: §16 governs — it is the section with the
    // reasoning attached, and Willy rejected the row's 40% as a marathon-pace
    // tempo bolted onto a three-hour long run. The row percentages are
    // SUPERSEDED and registered as such; this pins which number ships.
    const pct = SESSION_FORMAT.LONG_RUN_PEAK.race_pace_segment_pct
    for (const [label, id, pace] of [
      ['Long run with HM-pace finish', 'hm_pace_long_run', '4:58 /km'],
      ['Marathon-pace long run', 'mp_long_run', '5:20 /km'],
    ] as const) {
      const st = compose(longRun({ label, lr_segment_pace: pace }), id)
      expect(st?.race_pace_segment?.duration_pct, label).toBe(pct)
    }
    const rowPct = (row('mp_long_run').main_set_structure as { race_pace_pct?: number }).race_pace_pct
    expect(rowPct === undefined || rowPct === pct,
      'the row must not declare a SECOND, different percentage').toBe(true)
  })
})
