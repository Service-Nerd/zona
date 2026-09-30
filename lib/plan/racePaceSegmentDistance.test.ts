// MKT-PLAN-SEGMENT-BASIS-01 — the race-pace segment is priced at ITS OWN pace.
//
// THE DEFECT. `withDistances` stamped every part of a composed session at the
// session's AVERAGE pace (`distance_km / duration_mins`) so that the parts would
// sum to the total exactly. That is correct for warm-up, main and cool-down,
// which are all easy. It is wrong for the one part that is deliberately NOT run
// at average pace: §25's race-pace segment.
//
// Measured on the board's worked example (30 km marathon long run, 168 min,
// MP 5:00/km, `race_pace_pct: 40` → a 67-minute segment):
//
//     displayed   67 min × (30 km / 168 min) = 11.96 km
//     actual      67 min ÷ 5:00/km           = 13.40 km
//
// Out by 1.44 km — ~11% — on the key segment of the key session of the peak
// block. ADR-015: the number shown must be the number the prescription implies.
//
// ⚠️ THE SUM PROPERTY IS PRESERVED, not traded away. The easy body absorbs the
// residual, so warm-up + main + cool-down + segment still equals the session
// distance. The body's implied pace becomes slower than average, which is
// correct — it is Z1/Z2 while the segment is at goal pace.
import { describe, it, expect } from 'vitest'
import { composeSession } from './sessionComposer'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { Session } from '@/types/plan'

const row = (id: string) => {
  const r = V1_SESSION_CATALOGUE.find(x => x.id === id)
  if (!r) throw new Error(`catalogue row ${id} missing — this test is asserting nothing`)
  return r
}

/** The board's worked example, as the engine builds it. */
function mpLongRun(o: Partial<Session> = {}): Session {
  return {
    id: 'w14-sun', type: 'easy', label: 'Marathon-pace long run', detail: null,
    distance_km: 30, duration_mins: 168, primary_metric: 'distance',
    zone: 'Zone 2–3', hr_target: '< 148 bpm', rpe_target: 6, role: 'long_run',
    lr_segment_pace: '5:00 /km',
    ...o,
  } as unknown as Session
}

const compose = (s: Session, rowId: string | null = 'mp_long_run') =>
  composeSession({ session: s, catalogueRow: rowId ? row(rowId) : null, goalPace: '5:00 /km' })

const partsKm = (st: NonNullable<ReturnType<typeof compose>>) =>
  [st.warmup, st.main, st.cooldown, st.race_pace_segment]
    .reduce((a, p) => a + (p?.distance_km ?? 0), 0)

describe('the race-pace segment is priced at its own pace', () => {
  it('stamps the segment at goal pace, not the session average', () => {
    const st = compose(mpLongRun())!
    const seg = st.race_pace_segment!
    expect(seg.duration_mins, '40% of 168 min').toBe(67)
    // 67 min ÷ 5:00/km. The old uniform rate gave 11.96 and that is the defect.
    expect(seg.distance_km).toBeCloseTo(13.4, 1)
    expect(seg.distance_km, 'the average-pace answer must not survive')
      .not.toBeCloseTo(11.96, 1)
  })

  it('still sums to the session distance — the property the uniform rate protected', () => {
    const st = compose(mpLongRun())!
    expect(partsKm(st)).toBeCloseTo(30, 1)
  })

  it('the easy body is implied SLOWER than average, because it is easy', () => {
    const st = compose(mpLongRun())!
    const bodyKm = (st.warmup.distance_km ?? 0) + (st.main.distance_km ?? 0) + (st.cooldown.distance_km ?? 0)
    const bodyMins = st.warmup.duration_mins + st.main.duration_mins + st.cooldown.duration_mins
    const avgRate = 30 / 168
    expect(bodyKm / bodyMins, 'body covers less ground per minute than the session average')
      .toBeLessThan(avgRate)
  })

  it('falls back to the uniform rate when the pace cannot be parsed — never a wrong number', () => {
    // `parsePaceMidpoint` returns null rather than 0 so this choice stays here.
    const st = compose(mpLongRun({ lr_segment_pace: 'goal pace' }))!
    const seg = st.race_pace_segment!
    expect(seg.distance_km).toBeCloseTo(67 * (30 / 168), 1)
    expect(partsKm(st)).toBeCloseTo(30, 1)
  })

  it('falls back when the segment would consume the whole run', () => {
    // A 3:00/km segment over 67 min is 22.3 km of a 22 km run: degenerate. The
    // uniform rate is wrong but bounded; a negative body distance is not.
    const st = compose(mpLongRun({ distance_km: 22, lr_segment_pace: '3:00 /km' }))!
    expect(st.race_pace_segment!.distance_km).toBeGreaterThan(0)
    expect(st.warmup.distance_km ?? 0).toBeGreaterThanOrEqual(0)
    expect(st.main.distance_km ?? 0).toBeGreaterThanOrEqual(0)
  })

  it('leaves a plain long run on the uniform rate — narrow by construction', () => {
    const st = compose(mpLongRun({ label: 'Long run', lr_segment_pace: undefined }), null)!
    expect(st.race_pace_segment).toBeFalsy()
    expect(st.main.distance_km).toBeCloseTo(st.main.duration_mins * (30 / 168), 1)
  })

  it('a duration-anchored session gets no distances at all (§79/§80)', () => {
    const st = compose(mpLongRun({ distance_km: null as unknown as number, duration_mins: 168 }))!
    expect(st.race_pace_segment?.distance_km).toBeUndefined()
  })
})
