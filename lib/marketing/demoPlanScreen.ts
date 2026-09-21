import { MARKETING_PLANS } from '@/lib/marketing/plans'
import { DEMO_BLOCK } from '@/lib/marketing/demoSurfaces'
import type { DemoBlockView } from '@/components/marketing/phoneBlock'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { getCurrentWeekIndex } from '@/lib/plan'
import { buildWeekVoiceContext, getWeekVoiceHeadline, getWeekVoiceItems, PHASE_LABELS } from '@/lib/coaching/weekVoice'
import { sumRoundedDistance, formatDistance } from '@/lib/format'
import { planArcSeries } from '@/lib/plan/weekVolume'
import type { Week } from '@/types/plan'

/**
 * DESIGN-V3 — the plan behind the marketing phone's Plan tab.
 *
 * ⚠️ THIS EXISTS SO THE RULE ENGINE STAYS ON THE SERVER. `TabbedPhone` is a
 * client component (it owns the selected tab), and `PlanCalendar` is a client
 * component (it owns move/swap). Calling `generateRulePlan` inside either
 * would ship the whole engine to every visitor's browser. The split is the
 * ordinary React Server Component one: DATA crosses the boundary, the
 * GENERATOR does not.
 *
 * ⚠️ THE ANCHOR IS DELIBERATELY IN THE PAST. Every other marketing surface
 * uses `planAnchor`, which starts a plan NEXT Monday — right for a published
 * plan page, wrong here. The Plan screen's whole shape is Past / Now / Next /
 * Later, and a plan that has not started has no Now that is not week 1 and no
 * Past at all. Anchoring five weeks back gives the screen the state a real
 * runner sees mid-block.
 *
 * ⚠️ NOTHING HERE ASSERTS A WEEK COUNT, AND THAT IS DELIBERATE. `dayOffset`
 * is the published plan's own, but `DATE-DST-01` means a span crossing a
 * clock change generates one week short — so a visitor in April could see 15
 * where `DEMO_BLOCK` says 16. Every surface therefore READS `totalWeeks` off
 * the generated plan instead of asserting it. A wrong-but-consistent number
 * is a known engine defect showing through; two different numbers on one
 * device is a new defect of our own, and that is the one worth preventing.
 */

/** Weeks of the block already behind the runner in the still. Derived, so the
 *  generated plan lands on the week `DEMO_BLOCK` says the still is in. */
const WEEKS_ELAPSED = DEMO_BLOCK.weekN - 1

export type DemoPlanScreen = {
  weeks: Week[]
  /** Array index of the week `PlanCalendar` will label "Now". */
  currentWeekIndex: number
  totalWeeks: number
  /**
   * `PlanArc`'s series — training km per week, and the raw phase key per
   * week. Computed HERE, on the server, from the same `planArcSeries` owner
   * the app calls, so the homepage cannot draw a different shape from the
   * Plan screen.
   */
  arc: { km: number[]; phase: (string | null)[] }
  /**
   * The Plan screen's this-week card, computed by the product's OWN rule
   * engine (`lib/coaching/weekVoice.ts`) over this plan's current week.
   *
   * ⚠️ NO KIT BYLINE, AND THAT IS THE APP'S RULE NOT A SHORTCUT. The real
   * card is tier-divergent: a paid runner sees an AI headline with
   * `CoachByline`, a free runner sees exactly these rule-engine words under a
   * plain "This week" label. `ui-patterns.md` § AIMark: provenance marks
   * belong to model output only. Putting Kit's mark on a rule-engine sentence
   * in a marketing still would be a provenance lie about our own product, so
   * the still shows the free-tier card — which is also the tier the page is
   * arguing for.
   */
  weekVoice: {
    headline: string
    items: string[]
    phaseLabel: string | null
    /** Already a STRING, from `formatDistance`. ADR-015 / INV-FMT-001:
     *  `lib/format.ts` is the sole owner of every distance string, and a
     *  component welding `km` onto an interpolated number is the exact shape
     *  `hardcodedUnits.test.ts` fails the build on. The still is always
     *  metric, so the unit is fixed here rather than threaded as a pref. */
    target: string | null
  }
}

/** The Monday `WEEKS_ELAPSED` weeks before the most recent Monday. */
function midBlockAnchor(dayOffset: number): { planStart: string; raceDate: string } {
  const now = new Date()
  const start = new Date(now)
  // Back to this week's Monday (UTC day 1), then back WEEKS_ELAPSED weeks.
  start.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7) - WEEKS_ELAPSED * 7)
  const race = new Date(start)
  race.setUTCDate(start.getUTCDate() + dayOffset)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { planStart: iso(start), raceDate: iso(race) }
}

/** Server only. Generates the plan the Plan tab renders. */
export function buildDemoPlanScreen(): DemoPlanScreen | null {
  const src = MARKETING_PLANS.find(p => p.slug === DEMO_BLOCK.slug)
  if (!src) return null
  const { planStart, raceDate } = midBlockAnchor(src.dayOffset)
  const plan = generateRulePlan(src.input(raceDate), 'free', planStart)
  const currentWeekIndex = getCurrentWeekIndex(plan.weeks)
  const week = plan.weeks[currentWeekIndex]
  const ctx = buildWeekVoiceContext(week, plan)
  const phase = (week as unknown as { phase?: string }).phase
  const sessions = Object.values((week as unknown as { sessions?: Record<string, unknown> }).sessions ?? {})

  return {
    weeks: plan.weeks,
    currentWeekIndex,
    totalWeeks: plan.weeks.length,
    arc: planArcSeries(plan.weeks),
    weekVoice: {
      headline: getWeekVoiceHeadline(ctx),
      // Two, as the Plan card shows — the Coach card is the one that shows three.
      items: getWeekVoiceItems(ctx, 2),
      phaseLabel: phase ? (PHASE_LABELS[phase] ?? phase) : null,
      target: (() => {
        const km = sumRoundedDistance(
          sessions.map(s => (s as { distance_km?: number } | null)?.distance_km),
          'km',
        )
        return km > 0 ? formatDistance(km, 'km') : null
      })(),
    },
  }
}

/**
 * The block, for a device rendered on its own (`/charity-runners`) where
 * there is no `DemoPlanScreen` prop to read it off.
 *
 * ⚠️ IT LIVES HERE, NOT IN `PhoneFrame.tsx`, AND THE REASON IS MEASURED.
 * `TabbedPhone` is a client component and imports `TodayStill` from
 * `PhoneFrame`. A client import pulls the whole MODULE graph, not just the
 * symbol — so the moment `PhoneFrame.tsx` imported `buildDemoPlanScreen`,
 * `generateRulePlan` and everything under it crossed into the browser
 * bundle: the homepage went **114 kB -> 251 kB First Load JS**, and stubbing
 * the thing I suspected (the race arc) changed nothing, because the edge was
 * an import two files away. Keep every engine call on this side of the line.
 */
export function demoBlockView(): DemoBlockView {
  const plan = buildDemoPlanScreen()
  return plan
    ? { weekN: plan.currentWeekIndex + 1, totalWeeks: plan.totalWeeks }
    : { weekN: DEMO_BLOCK.weekN, totalWeeks: DEMO_BLOCK.totalWeeks }
}
