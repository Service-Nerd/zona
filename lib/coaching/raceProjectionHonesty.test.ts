// §109 — a progress surface may remember and compare. It may not predict.
//
// Coaching Board, 2026-09-12. The founder asked for "where I was, where I am,
// and what the potential is". Two of those three are memory and already ship
// (R31: baselineSeconds / currentSeconds / deltaSeconds). Only the third
// invents anything, and the board ruled it must not: "potential" is the
// runner's OWN target_time framed by `goal_beyond_measured_fitness`, never an
// engine-projected race-day finish.
//
// §44 settled the same question for plan feasibility — "with one benchmark run
// and one max HR the engine cannot defend a probability; a '72% chance' is
// fabricated precision, and false precision is an overclaim." A projected
// race-day time is that claim wearing a different number.
//
// This is mechanically checkable only because the copy is centralised: the
// component header states "All copy lives in raceProjectionsCopy.ts — nothing
// user-facing is hardcoded in this component." If that ever stops being true,
// this check narrows silently, so the last test pins it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RACE_PROJECTIONS_COPY } from '@/components/shared/raceProjectionsCopy'

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/** Field names that would carry a time for a date that has not happened. */
const FUTURE_FIELD = /\b(projectedAt\w*|projectedBy\w*|raceDay\w*|potentialSeconds|forecast\w*|predictedFinish\w*|willRun\w*)\b/

/**
 * Forward-looking CLAIMS in runner-facing copy. Deliberately narrow: this must
 * catch a promise, not the ordinary future tense. "Log a benchmark for a
 * higher-confidence estimate" is fine; "you will run 3:42 on race day" is not.
 */
const FUTURE_CLAIM = /\b(on race day you|you will run|projected finish|you'?ll run|expect to run|chance of (a|your)|% chance)\b/i

/** Every string in the copy tree, flattened. */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (v && typeof v === 'object') for (const x of Object.values(v)) strings(x, out)
  return out
}

describe('§109 — the race projection remembers, it does not predict', () => {
  const route = read('app/api/race-times/route.ts')
  const copy = strings(RACE_PROJECTIONS_COPY)

  it('the contract carries no field naming a future-dated projection', () => {
    const hit = route.match(FUTURE_FIELD)
    expect(hit?.[0] ?? null, `race-times must not expose a future-dated time (§109)`).toBeNull()
  })

  it('no runner-facing projection copy makes a forward-looking claim', () => {
    const offending = copy.filter(s => FUTURE_CLAIM.test(s))
    expect(offending, 'copy must not promise a future result (§109, §44.1)').toEqual([])
  })

  it('FALSIFICATION — the claim matcher actually catches the thing it exists for', () => {
    // If this ever fails, the regex has been loosened into decoration and the
    // test above passes for free.
    expect(FUTURE_CLAIM.test('On race day you will run 3:42.')).toBe(true)
    expect(FUTURE_CLAIM.test('You have a 72% chance of a sub-4.')).toBe(true)
    expect(FUTURE_CLAIM.test("You'll run faster than this.")).toBe(true)
    // ...and does not fire on the honest copy that already ships.
    expect(FUTURE_CLAIM.test('Log a benchmark result in Profile for a higher-confidence estimate.')).toBe(false)
    expect(FUTURE_CLAIM.test('Aerobic fitness has moved since plan start.')).toBe(false)
  })

  it('FALSIFICATION — the field matcher catches a future-dated field name', () => {
    expect(FUTURE_FIELD.test('  raceDaySeconds: number | null')).toBe(true)
    expect(FUTURE_FIELD.test('  projectedBySeconds: number')).toBe(true)
    // ...and leaves the ratified R31 fields alone. These are memory, not prophecy.
    expect(FUTURE_FIELD.test('  baselineSeconds: number | null')).toBe(false)
    expect(FUTURE_FIELD.test('  currentSeconds: number | null')).toBe(false)
    expect(FUTURE_FIELD.test('  deltaSeconds: number | null')).toBe(false)
  })

  it('the copy really is centralised — this check has something to read', () => {
    // A component that starts hardcoding strings would narrow this test to
    // nothing without failing it. Pin both the source of truth and its size.
    expect(copy.length).toBeGreaterThan(8)
    expect(read('components/shared/RaceTimesCard.tsx')).toContain('RACE_PROJECTIONS_COPY')
  })
})
