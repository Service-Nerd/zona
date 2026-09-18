import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

// REFUSAL-ALT-REACHABLE-01 — a refusal may not offer a door that is also locked.
//
// §113 refused a first-time marathoner whose longest run was 4 km, and told
// them: "Or start with a half marathon plan, which asks less of your longest
// run." **It asks exactly the same.** `LONG_RUN_READINESS_MIN_RACE_KM` is 21 km,
// so the floor governs the half marathon identically and refuses them again.
//
// ⚠️ WHY THIS IS THE WORST PLACE TO BE WRONG. The reader is a charity
// first-timer who has just been told no, in October, for a race in April. The
// charity's stated problem is that people who take a place never run. Handing
// them a second door that is also locked spends their one retry and sends them
// away — a refusal offering NOTHING would have done less damage.
//
// This is a claim/computation mismatch: the copy asserted something about the
// engine that the engine contradicts. Nothing could catch it, because refusal
// ALTERNATIVES are prose and no test had ever tried to follow one.

const START = '2026-10-12'

// ⚠️ RACE DATE MOVED IN 2026-09-18 (§113 Am.1). This fixture used to sit at
// 2027-04-25 — a 29-week runway — and that runner is now ADMITTED rather than
// refused, because readiness became a function of longest run AND runway. The
// rule under test here is unchanged (a suggested alternative must actually
// generate); only the persona who still triggers a refusal has moved. A
// short-runway first-timer is that persona.
//
// The window is narrow and deliberate: §44 refuses a marathon under 10 weeks,
// and §113 Am.1 now needs `weeksToReachFloor + block`. At a 2 km longest run
// that is 6 + 10 = 16 weeks, so a ~12-week runway passes §44 and is refused by
// §113 — which is the case this file has to reach.
const firstTimer = (race_distance_km: number, longest: number): GeneratorInput => ({
  athlete_name: 'A', age: 38, race_name: 'R', primary_metric: 'distance',
  plan_start: START, race_distance_km, race_date: '2027-01-04', goal: 'finish',
  resting_hr: 60, max_hr: 184, current_weekly_km: 10, longest_recent_run_km: longest,
  fitness_level: 'beginner', training_age: '<6mo', recent_quality_training: 'none',
  days_available: 4, days_cannot_train: [], injury_history: [],
} as unknown as GeneratorInput)

function refuse(input: GeneratorInput): any | null {
  try { generateRulePlan(input, 'paid', START); return null } catch (e) { return e }
}

describe('REFUSAL-ALT-REACHABLE-01 — a suggested alternative must actually generate', () => {
  // Deep enough below the floor that §113's ramp requirement exceeds the runway.
  const subFloor = GENERATION_CONFIG.MIN_SESSION_DISTANCE_ABSOLUTE_KM

  it('the case exists: a sub-floor first-timer IS refused for the marathon', () => {
    // Anti-vacuous. If this ever stops refusing, the rest of the file is inert.
    const e = refuse(firstTimer(42.2, subFloor))
    expect(e?.name).toBe('LongRunReadinessError')
  })

  it('🔴 the half marathon is NOT offered — it refuses the same runner', () => {
    const e = refuse(firstTimer(42.2, subFloor))
    const alts: string[] = e.readiness.alternatives
    // Proven, not assumed: follow the path before asserting on the copy.
    expect(refuse(firstTimer(21.1, subFloor))?.name).toBe('LongRunReadinessError')
    expect(
      alts.join(' '),
      'the half marathon carries the SAME §113 floor; suggesting it spends the runner\'s retry',
    ).not.toMatch(/half marathon/i)
  })

  it('🔴 the distance it DOES offer generates a real plan', () => {
    const e = refuse(firstTimer(42.2, subFloor))
    const alts: string[] = e.readiness.alternatives
    const offers10k = alts.some(a => /10K/i.test(a))
    expect(offers10k, 'the refusal should name a distance that opens').toBe(true)
    // Follow it. This is the whole point of the file.
    expect(refuse(firstTimer(10, subFloor)), 'the offered 10K must actually generate').toBeNull()
  })

  it('every alternative naming a race distance leads somewhere that opens', () => {
    // Generalises the rule so a future edit cannot reintroduce a locked door
    // under a different distance.
    const e = refuse(firstTimer(42.2, subFloor))
    const DISTANCES: Record<string, number> = {
      '5K': 5, '10K': 10, 'half marathon': 21.1, 'marathon': 42.2,
    }
    const locked: string[] = []
    for (const alt of e.readiness.alternatives as string[]) {
      for (const [name, km] of Object.entries(DISTANCES)) {
        if (!new RegExp(name, 'i').test(alt)) continue
        if (km === 42.2) continue                      // the race they just asked for
        if (refuse(firstTimer(km, subFloor))) locked.push(`${name}: ${alt}`)
      }
    }
    expect(locked, 'these alternatives are refused for the same runner they are offered to').toEqual([])
  })
})
