// RESHAPE-MOMENT-02 — the adaptive block prints the ENGINE, not a promise.
//
// 🧭 Design Board 2026-10-08: a LIST of the eight signals was ruled DON'T SHIP, PERMANENT
// (the three-card proof band and W-03's commitments block in one artefact; 7 of the 8 have
// never fired). 🏃 Coaching Board passed the wording CORRECT WITH AMENDMENT (3). Those three
// amendments are the three arms that matter here.
// ⚠️ THIS FILE LIVES IN `lib/marketing/`, NOT BESIDE THE COMPONENT, AND THAT IS LOAD-BEARING.
// `sectionSurfaces.test.ts` counts occurrences of the literal `surface="card"` across every
// `.ts`/`.tsx` file in `components/marketing/` plus the homepage, to enforce W-08's "exactly
// one white spotlight". It strips COMMENTS but not code — correctly — so the two assertions
// below naming that literal were counted as two extra spotlights and took the count to 3.
//
// 🔴 The guard was right and my file was in the wrong place: **a test that asserts on a
// literal must not sit inside the population of a guard that counts that literal.** The
// other marketing guards (`noEmDash`, `sectionSurfaces`) already live here, so this is the
// conventional home rather than a dodge.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { MARKETING_PLANS, planAnchor } from '@/lib/marketing/plans'
import { checkAdjustmentTriggers } from '@/lib/coaching/planAdjustment'
import { orderedWeekSessions } from '@/lib/plan/weekSessions'
import { ZONE_DRIFT_ABOVE_CEILING_PCT } from '@/lib/coaching/constants'
import { computeSessionDiff, hasStructuralChange } from '@/lib/coaching/diff/sessionDiff'
import { DETECTED_TRIGGER_TYPES } from '@/lib/coaching/planAdjustment'

const SRC  = readFileSync(join(process.cwd(), 'components/marketing/WhenItNotices.tsx'), 'utf8')
const CODE = SRC.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n')

/** The same call the component makes. If this stops producing a trigger, the block vanishes
 *  from the page rather than printing a stale sentence, and these arms say so. */
function engine() {
  const plan = MARKETING_PLANS.find(p => p.slug === 'half-marathon-12-week')!
  const { planStart, raceDate } = planAnchor(plan.dayOffset)
  const week = generateRulePlan(plan.input(raceDate), 'free', planStart).weeks.find(w => w.n === 5)!
  const ordered = orderedWeekSessions(week)
  const plannedKm = ordered.reduce((s, x) => s + (x.distance_km ?? 0), 0)
  const proposed = checkAdjustmentTriggers({
    currentWeekN: week.n, totalWeeks: 12, currentWeekSessions: ordered,
    linkedKm: plannedKm, offPlanKm: 0, plannedKm,
    priorWeeksKm: [plannedKm, plannedKm, plannedKm, plannedKm],
    hrInZoneData: ordered.filter(s => s.type === 'easy').map(() => ({
      hrInZonePct: 40, aboveCeilingPct: ZONE_DRIFT_ABOVE_CEILING_PCT + 18, actualLoadKm: 8,
    })),
    efTrendPct: null, adjustmentsThisWeek: 0, currentPhase: week.phase as never,
  })
  return { week, ordered, proposed }
}

describe('🏃 the engine really does produce this, on the real published plan', () => {
  it('🔴 the trigger fires — if it stops, the block self-removes rather than lying', () => {
    const { proposed } = engine()
    expect(proposed).not.toBeNull()
    expect(proposed!.trigger.type).toBe('zone_drift')
    // The component's guard, asserted so it is understood as deliberate.
    expect(CODE).toContain('if (!proposed) return null')
  })

  it('the sentence on the page is the ENGINE’S sentence, not copy', () => {
    const { proposed } = engine()
    expect(proposed!.summary).toMatch(/above its zone ceiling/)
    // Rendered from the engine's output, never typed into the component.
    expect(CODE).toContain('{proposed.summary}')
    expect(CODE).not.toContain('above its zone ceiling')
  })

  it('the coach note is read from the engine’s own output too', () => {
    const { proposed } = engine()
    const note = proposed!.sessionsAfter.find(s => s.type === 'easy' && (s.coach_notes?.[0] ?? '').includes('ceiling'))
    expect(note?.coach_notes?.[0]).toBeTruthy()
    expect(CODE).toContain('coach_notes?.[0]')
    expect(CODE).not.toContain('HR ceiling enforced')
  })

  it('the sessions are REAL — generated at render time, not transcribed', () => {
    const { ordered } = engine()
    expect(ordered.filter(s => s.type !== 'rest').length).toBeGreaterThanOrEqual(3)
    expect(CODE).toContain('generateRulePlan(')
    expect(CODE).toContain('orderedWeekSessions(week)')
  })
})

describe('🏃 AMENDMENT 1 — the scenario is labelled ON THE SURFACE', () => {
  it('the page says the runner is an illustration', () => {
    // Hutchinson's W-04 binding condition: "the outcome half is where you will be tempted to
    // invent numbers." `SameWeekTwice` discharges it in copy on the page; so does this.
    expect(CODE).toMatch(/illustration/i)
    expect(CODE).toMatch(/nobody&rsquo;s heart rate is being reported/i)
  })

  it('…and the illustrated figure is DERIVED from the engine’s own threshold', () => {
    // Not a typed number. It cannot drift below the line it exists to cross.
    expect(CODE).toContain('ZONE_DRIFT_ABOVE_CEILING_PCT + 18')
  })
})

describe('🏃 AMENDMENT 2 — no claim of a structural change, because there is none', () => {
  it('🔴 MEASURED: this trigger changes no session', () => {
    // The amendment's whole basis. If the engine ever starts moving sessions on zone_drift,
    // this arm fails and the copy must be revisited rather than quietly becoming false.
    const { proposed } = engine()
    const diff = computeSessionDiff(proposed!.sessionsBefore, proposed!.sessionsAfter)
    expect(hasStructuralChange(diff)).toBe(false)
  })

  it('…and the copy says so rather than implying a reshuffle', () => {
    expect(CODE).toContain('No session was moved')
    expect(CODE).not.toMatch(/rewrites your week|rebuilds your week|moves your sessions/i)
  })
})

describe('🏃 AMENDMENT 3 + 🧭 the permanent kill — one signal, never a list', () => {
  it('🔴 THE KILLED SHAPE: no count of the eight appears on the page', () => {
    // "A list of the eight" is DON'T SHIP, PERMANENT, and may not return as a list with
    // better wording. The surest mechanical proxy is that the page names no count and
    // enumerates no second signal.
    expect(CODE).not.toMatch(/\beight\b|\b8 (signals|things|ways)/i)
    expect(CODE).not.toContain('WATCHED_SIGNALS')
    expect(CODE).not.toContain('watchedSignals')
    expect(CODE).not.toContain('DETECTED_TRIGGER_TYPES')
  })

  it('…and exactly ONE trigger type is exercised', () => {
    const named = DETECTED_TRIGGER_TYPES.filter(t => CODE.includes(`'${t}'`))
    expect(named).toEqual([])
    const { proposed } = engine()
    expect(proposed!.trigger.type).toBe('zone_drift')
  })

  it('⚕️ SIMS’ CLAUSE: the block states no CAUSE', () => {
    // §124, mandatory. It may say what was measured and what changed. The pattern these
    // detect is also how low energy availability presents, and we cannot diagnose that.
    expect(CODE).not.toMatch(/because you|due to|means you are|sign of|caused by/i)
  })

  it('🩹 WILLY: no injury claim, and none may be added', () => {
    expect(CODE).not.toMatch(/injur|prevent|safer|protects you/i)
  })

  it('📊 SEILER: the word "polarised" appears nowhere near it', () => {
    expect(CODE).not.toMatch(/polaris|polariz/i)
  })
})

describe('🧭 the section honours the page’s documented rules', () => {
  it('⛔ NOT a second white spotlight — W-08 permits one and SameWeekTwice spends it', () => {
    // A documented-rule regression Silvanto's seat could veto. Asserted so the next edit
    // has to argue with it.
    expect(CODE).not.toMatch(/surface="card"/)
    const swt = readFileSync(join(process.cwd(), 'components/marketing/SameWeekTwice.tsx'), 'utf8')
    expect(swt).toMatch(/surface="card"/)
  })

  it('uses the shared Section, not a raw <section>', () => {
    // SITE-WAVE-1b-i: a component rendering its own raw <section> is why the homepage once
    // measured 14 sections against 13 <Section> elements and a guard passed anyway.
    expect(CODE).toContain('<Section')
    expect(CODE).not.toMatch(/<section[\s>]/)
  })

  it('🔴 every size and measure is a TOKEN — no hardcoded px', () => {
    // ⚠️ The first version used `var(--measure-prose)`, WHICH DOES NOT EXIST — CSS drops an
    // unknown custom property silently, so the prose would have run the full page width and
    // nothing would have failed. The real token is `--measure-read`. Checked against
    // globals.css rather than assumed.
    const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
    const used = Array.from(CODE.matchAll(/var\((--[a-z0-9-]+)\)/g)).map(m => m[1]!)
    expect(used.length).toBeGreaterThan(8)
    // ⚠️ `Array.from`, not iteration over the Set directly: TS2802 under this tsconfig,
    // exactly as CLAUDE.md records for `[...seen]`. vitest passes it (esbuild does not
    // typecheck) and `tsc` does not, so this would have been green locally and red in
    // the build. Third time in this family today.
    for (const tok of Array.from(new Set(used))) {
      expect(css, `${tok} is used on the page and not defined in globals.css`).toContain(`${tok}:`)
    }
    // And no raw pixel sizes crept back in.
    expect(CODE).not.toMatch(/fontSize: '\d+px'/)
  })

  it('the block is on the homepage, straight after the proof', () => {
    const page = readFileSync(join(process.cwd(), 'app/page.tsx'), 'utf8')
    expect(page).toContain('<WhenItNotices />')
    expect(page.indexOf('<WhenItNotices />')).toBeGreaterThan(page.indexOf('<SameWeekTwice />'))
  })

  it('and it is in the marketing em-dash guard’s SURFACES list', () => {
    // CLAUDE.md, by name: "add any new marketing page to that test's SURFACES list".
    expect(readFileSync(join(process.cwd(), 'lib/marketing/noEmDash.test.ts'), 'utf8'))
      .toContain('components/marketing/WhenItNotices.tsx')
  })
})
