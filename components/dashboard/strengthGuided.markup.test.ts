import { describe, it, expect } from 'vitest'
import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { generateStrengthPlan, isLoadedLift, type Day, type LiftSuggestion, type RunContext, type RunRole, type StrengthSession } from '@/packages/strength'
import { sessionParts } from '@/lib/strength-bridge/sessionParts'
import { STRENGTH_GUIDED, guidedSteps, startGuided, type GuidedState } from '@/lib/strength-bridge/guidedSession'
import { STRENGTH_GUIDED_COPY as COPY, exerciseName } from '@/lib/strength-bridge/display'
import { formatClockTime, formatStepDuration, formatWeight } from '@/lib/format'

/**
 * 🔴 STRENGTH-GUIDED-SESSION-01 (Design Board 2026-10-28 F) — each guided page, rendered from a REAL engine session.
 * Pages are reached the way a runner reaches them on a second open: today's progress resumed from the device.
 */
;(globalThis as { React?: unknown }).React = React
const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const ctx = (weeks: number): RunContext => ({
  version: 1, race_date: null, injury_tags: [], masters: false,
  days: Array.from({ length: weeks }, (_, w) => (['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest'] as RunRole[]).map((role, k) => ({
    date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: DAYS[k], week_n: w + 1, role }))).flat(),
  weeks: Array.from({ length: weeks }, (_, i) => ({ n: i + 1, phase: 'build' as const })),
})
const session: StrengthSession = generateStrengthPlan(
  { focus: 'general', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands'], experience: 'regular' }, ctx(8),
).weeks[2].sessions.find(s => s.kind === 'full_body')!
const parts = sessionParts(session)
const steps = guidedSteps(parts)
const T0 = 1_800_000_000_000
const mains = session.blocks.find(b => b.role === 'main')!.items
const last = { date: '2026-11-10', exercise_id: 'x', load_kg: 40, feel: 'right' as const, counts: true }
const suggestions = Object.fromEntries(mains.map(i => [i.exercise_id, (isLoadedLift(i.exercise_id)
  ? { kind: 'step', load_kg: 42.5, extra_reps: 0, last } : { kind: 'bodyweight', load_kg: null, extra_reps: 0, last: null }) as LiftSuggestion]))
const lifts = { suggestions, today: {}, units: 'km' as const, onLog: async () => true }

async function page(state: Partial<GuidedState> | null, props: Record<string, unknown> = {}) {
  const { default: G } = await import('@/components/dashboard/StrengthGuidedSession')
  const saved = state ? JSON.stringify({ ...startGuided(session, T0, { [mains[0].exercise_id]: 42.5 }), ...state }) : null
  const storage = { getItem: () => saved, setItem: () => {}, removeItem: () => {} }
  return renderToStaticMarkup(React.createElement(G, {
    session, title: 'Full body', lifts, onExit: () => {}, onFinish: async () => true, now: () => T0 + 5 * 60_000, storage, ...props,
  } as never))
}
const count = (html: string, s: string) => html.split(s).length - 1
const stepOf = (pred: (i: number) => boolean) => steps.findIndex((_, i) => pred(i))

describe('the guided session', () => {
  it('🔴 a first open starts at the warm-up: round 1, straight through, timers on timed moves, End session and the clock', async () => {
    const html = await page(null)
    expect(html).toContain(COPY.rounds(1, parts[0].rounds))
    expect(html).toContain('Straight through, no rest between moves.')
    expect(html).toContain(COPY.end)
    // A first open starts the clock now.
    expect(html).toMatch(/data-guided-elapsed="true"[^>]*>0:00</)
    expect(await page({ step: 0 })).toMatch(/data-guided-elapsed="true"[^>]*>5:00</)
    const timed = parts[0].items.filter(i => i.seconds != null && i.sets >= 1)
    expect(timed.length).toBeGreaterThan(0)
    for (const i of timed) expect(html).toContain(COPY.timer(i.seconds!))
    expect(html).not.toContain('data-weight-stepper')
  })
  it('🔴 a superset page: both moves linked, the rest and effort said once, a stepper on each loaded main lift prefilled', async () => {
    const at = stepOf(i => steps[i].kind === 'work' && parts[steps[i].part].kind === 'superset' && parts[steps[i].part].items.every(x => x.role === 'main'))
    const p = parts[steps[at].part]
    const html = await page({ step: at })
    expect(html).toContain(`Both moves back to back, then rest ${formatStepDuration(p.rest_s)}. Stop with 2 in the tank.`)
    expect(count(html, 'data-superset-link')).toBe(p.items.length - 1)
    expect(count(html, 'data-weight-stepper')).toBe(p.items.filter(i => isLoadedLift(i.exercise_id)).length)
    expect(html).toContain('42.5')
    expect(html).toContain(COPY.roundDone(steps[at].round, steps[at].restAfter_s > 0))
    for (const i of p.items) expect(html).toContain(exerciseName(i.exercise_id).replace(/'/g, '&#x27;'))
  })
  // STRENGTH-GUIDED-DEVICE-01 — rest is a BAND inside the round's page now, not a page.
  it('🔴 the rest band counts down from the part\'s own rest and names what comes next', async () => {
    const at = stepOf(i => steps[i].restAfter_s > 0)
    const rest = { rest_s: steps[at].restAfter_s }
    const html = await page({ step: at, restEndsAt: T0 + 5 * 60_000 + rest.rest_s * 1000 })
    expect(html).toContain('data-guided-rest')
    expect(html).toContain(`>${formatClockTime(rest.rest_s)}<`)
    expect(html).toContain(COPY.extendRest)
    expect(html).toContain(COPY.skipRest)
    expect(html).toMatch(/next: /)
  })
  it('🔴 the end page: minutes, parts and rounds, a feel per main lift, the weight from the stepper, Done', async () => {
    const html = await page({ step: steps.length - 1, endedAt: T0 + 51 * 60_000 })
    expect(html).toContain(COPY.minutes(51))
    expect(html).toContain(COPY.feelAsk)
    expect(count(html, 'data-guided-log')).toBe(mains.length)
    expect(count(html, '>About right<')).toBe(mains.length)
    expect(html).toContain('value="42.5"')
    expect(html).toContain(COPY.logNote)
    expect(html).toContain(`>${COPY.done}<`)
    expect(html).not.toContain(COPY.end)
    // 🔴 An exit that is not Done: a failed save must never strand the runner here.
    expect(html).toMatch(new RegExp(`btn--quiet[^>]*>${COPY.back}<`))
  })
  it('🔴 a move with fewer sets than its part\'s rounds is left out of the rounds it is not done in', async () => {
    const { default: G } = await import('@/components/dashboard/StrengthGuidedSession')
    const pairPart = parts.find(p => p.kind === 'superset' && p.rounds >= 3)!
    const short = pairPart.items[1]
    // The engine's own unequal pairs (1,580 measured): one half carries a set fewer.
    const uneven: StrengthSession = { ...session, blocks: session.blocks.map(b => ({ ...b, items: b.items.map(i => (i.exercise_id === short.exercise_id && i.superset === short.superset ? { ...i, sets: pairPart.rounds - 1 } : i)) })) }
    const st = guidedSteps(sessionParts(uneven))
    const ps = sessionParts(uneven)
    const lastRound = st.findIndex(s => s.kind === 'work' && ps[s.part].items.some(i => i.exercise_id === short.exercise_id) && s.round === pairPart.rounds)
    const firstRound = st.findIndex(s => s.kind === 'work' && ps[s.part].items.some(i => i.exercise_id === short.exercise_id) && s.round === 1)
    const render = (step: number) => {
      const saved = JSON.stringify({ ...startGuided(uneven, T0, {}), step })
      return renderToStaticMarkup(React.createElement(G, { session: uneven, title: 'Full body', lifts, onExit: () => {}, onFinish: async () => true, now: () => T0, storage: { getItem: () => saved, setItem: () => {}, removeItem: () => {} } } as never))
    }
    const name = exerciseName(short.exercise_id).replace(/'/g, '&#x27;')
    expect(render(firstRound)).toContain(name)
    expect(render(lastRound)).not.toContain(name)
  })
  it('the stepper\'s hint names the lift\'s own step', async () => {
    const at = stepOf(i => steps[i].kind === 'work' && parts[steps[i].part].items.some(x => x.role === 'main' && isLoadedLift(x.exercise_id)))
    const html = await page({ step: at })
    const steps_ = parts[steps[at].part].items.filter(x => x.role === 'main' && isLoadedLift(x.exercise_id)).map(x => STRENGTH_GUIDED.stepKg(x.exercise_id))
    for (const s of steps_) expect(html).toContain(COPY.stepperHint(formatWeight(s)!))
    // 🔴 A miles runner reads the step in pounds, the unit the number is shown in.
    const lb = await page({ step: at }, { lifts: { ...lifts, units: 'mi' } })
    for (const s of steps_) expect(lb).toContain(COPY.stepperHint(formatWeight(s, 'mi')!))
    expect(lb).not.toMatch(/Steps of [\d.]+ kg/)
  })
})

describe('the overview starts it', () => {
  async function overview(props: Record<string, unknown>) {
    const { default: S } = await import('@/components/dashboard/StrengthSessionScreen')
    return renderToStaticMarkup(React.createElement(S, { session, dayLabel: 'Today', weekN: 3, status: null, canLog: true, onBack: () => {}, onSetStatus: async () => true, ...props } as never))
  }
  it('🔴 on the day: Start session is the one primary, Mark complete without starting and Skip below it', async () => {
    const html = await overview({ onStart: () => {} })
    expect(html).toMatch(new RegExp(`btn--primary[^>]*>${COPY.start}<`))
    expect(count(html, 'btn--primary')).toBe(1)
    expect(html).toContain(COPY.markWithoutStarting)
    expect(html).toContain('>Skip<')
  })
  it('without onStart (another day): Mark complete, as before', async () => {
    const html = await overview({})
    expect(html).not.toContain(COPY.start)
    expect(html).toContain('>Mark complete<')
  })
  it('🔴 the guided session is a full screen: the dashboard hides the nav on it, and starts it only on the day', () => {
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(src).toMatch(/if \(screen === 'strength-guided'\) return null/)
    expect(src).toMatch(/onStart=\{activeStrength\.date === isoLocalDate\(new Date\(\)\)/)
  })
})

/**
 * STRENGTH-GUIDED-DEVICE-01 (Design Board 2026-11-04) — the three device findings.
 * Every one of these came off the founder's own phone, the first time this ran on one.
 */
describe('STRENGTH-GUIDED-DEVICE-01 — the guided session on a device', () => {
  const firstRest = steps.findIndex(s => s.restAfter_s > 0)

  it('🔴 the rest band renders INSIDE the round, not instead of it', async () => {
    const html = await page({ step: firstRest, restEndsAt: T0 + 5 * 60_000 + steps[firstRest].restAfter_s * 1000 })
    expect(html).toContain('data-guided-rest')
    // THE RULING: the lift, its dose and the weight stepper are still on the page. On the old
    // model this page replaced them with a number.
    expect(html).toContain('data-weight-stepper')
    const p = parts[steps[firstRest].part]
    for (const i of p.items) expect(html).toContain(exerciseName(i.exercise_id).replace(/'/g, '&#x27;'))
  })

  it('the contents control says where you are, and the sheet is shut until asked', async () => {
    const html = await page({ step: firstRest })
    expect(html).toContain('data-guided-contents')
    expect(html).not.toContain('data-guided-contents-sheet')   // a sheet is opened, never pre-rendered open
  })

  it('🔴 the actions on the session screen are STICKY, not buried under the parts', async () => {
    // The founder scrolled past Start session because it sat below nine part cards.
    const src = readFileSync('components/dashboard/StrengthSessionScreen.tsx', 'utf8')
    const block = src.slice(src.indexOf('data-strength-actions'), src.indexOf('data-strength-actions') + 400)
    expect(block).toMatch(/position:\s*'sticky'/)
    // Above the tab bar, which owns the last 60px — not pinned to 0 and painted under it.
    expect(block).toContain('var(--nav-h)')
  })

  it('the label is a button label, not a sentence', async () => {
    expect(COPY.markWithoutStarting).toBe('Log it as done')
    expect(COPY.markWithoutStarting.split(' ').length).toBeLessThanOrEqual(5)
  })
})

/** Code review on `1414e559` found four of these. Every arm below is one of them, pinned. */
describe('STRENGTH-GUIDED-DEVICE-01 — the review findings', () => {
  const firstRest = steps.findIndex(s => s.restAfter_s > 0)

  it('🔴 after Skip rest the button does NOT promise a rest that will not happen', async () => {
    // restedStep set + no countdown running = the rest is served. The label read
    // `restAfter_s > 0` alone and said "Round N done, rest" again while the tap advanced.
    const html = await page({ step: firstRest, restedStep: firstRest, restEndsAt: null })
    expect(html).toContain(COPY.roundDone(steps[firstRest].round, false))
    expect(html).not.toContain(COPY.roundDone(steps[firstRest].round, true))
  })

  it('🔴 the contents control does not claim a part number on the warm-up or cool-down', async () => {
    const training = parts.filter(p => p.kind !== 'warmup' && p.kind !== 'cooldown')
    const warmup = steps.findIndex(s => parts[s.part].kind === 'warmup')
    if (warmup >= 0) {
      const html = await page({ step: warmup })
      // "1 of N" on the warm-up is identical to part 1 — a plausible wrong answer.
      expect(html).toContain(COPY.contentsAt(null, training.length))
      expect(html).not.toContain(`>1 of ${training.length}<`)
    }
    const onPart1 = steps.findIndex(s => parts[s.part] === training[0])
    expect((await page({ step: onPart1 }))).toContain(COPY.contentsAt(1, training.length))
  })

  it('the sheet is closed by ONE path, so its exit animation runs', async () => {
    const src = readFileSync('components/dashboard/StrengthGuidedSession.tsx', 'utf8')
    const wire = src.slice(src.indexOf('<ContentsSheet'), src.indexOf('<ContentsSheet') + 320)
    // onJump must not also flip the open flag: the unmount would win and the row would
    // vanish instantly while the Close button animates.
    expect(wire).not.toMatch(/onJump=\{[^}]*setContentsOpen/)
    expect(wire).toMatch(/onClose=\{\(\) => setContentsOpen\(false\)\}/)
  })
})
