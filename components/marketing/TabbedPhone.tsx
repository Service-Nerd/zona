'use client'

import { useState } from 'react'
import { PhoneShell, type PhoneTab } from '@/components/marketing/PhoneShell'
import { TodayStill } from '@/components/marketing/PhoneFrame'
import type { DemoBlockView } from '@/components/marketing/phoneBlock'
import ZoneRings from '@/components/shared/ZoneRings'
import CoachByline from '@/components/shared/CoachByline'
import PlanArc from '@/components/shared/PlanArc'
import PlanCalendar from '@/components/training/PlanCalendar'
import { DEMO_ZONE_WEEK, DEMO_COACH_NOTE, DEMO_BLOCK, DEMO_RACE_ARC } from '@/lib/marketing/demoSurfaces'
import { buildRaceProgressArc } from '@/lib/coaching/raceProgressArc'
import { RaceProgressArcRow } from '@/components/shared/RaceProgressArcRow'
import { RACE_PROJECTIONS_COPY } from '@/components/shared/raceProjectionsCopy'
import type { DemoPlanScreen } from '@/lib/marketing/demoPlanScreen'

/**
 * DESIGN-V3 — one phone, three screens, switched by the bottom nav.
 *
 * ⚠️ THESE SCREENS ARE THE APP, NOT THE DESIGN'S DRAWING OF IT. That
 * distinction cost a rewrite and is the whole point of this file.
 *
 * The first cut built Plan and Coach from the v3 handoff's description, and
 * both were fiction. Coach drew four horizontal zone BARS and a line reading
 * "Target is 80%. Last week: 62%." — a sentence that appears nowhere in the
 * product — while `screen-architecture.md` says the real Coach screen leads
 * with Kit's weekly read and plots the week with ZONE RINGS, the brand mark
 * used as a data display. It also hand-drew bars while `components/shared/
 * ZoneBar.tsx` exists and calls itself "the canonical zone-visualisation
 * primitive". Plan invented a summary row and a flat session list where the
 * real screen leads with the Plan Arc.
 *
 * ⚠️ A DESIGNER WHO HAS NOT SEEN THE APP CANNOT DRAW IT, and a marketing
 * mockup that shows a feature the product does not have is a promise the
 * product then breaks. This codebase already learned that twice: the SLT cut
 * a plan-adjustment card from `PhoneFrame` because it "drew Confirm/Revert
 * buttons nobody can press — a still pretending to be a demo", and
 * `realComponents.test.ts` exists because a still said "8 km" while the app
 * said "8km".
 *
 * ⚠️ AND THE SECOND CUT WAS STILL WRONG, for a subtler reason worth keeping.
 * It was rebuilt from `screen-architecture.md` — which says what BELONGS on a
 * screen, not what the screen IS. The founder caught it: "the plan screen
 * shows the weeks... coach is a Kit card and how it went." Reading
 * `PlanScreen` and `CoachScreen` in DashboardClient settled it:
 *
 *   Plan  = ScreenHeader "Your plan" -> race -> PlanArc -> zone compliance ->
 *           Kit's plan card -> **PlanCalendar**, the Past/Now/Next/Later WEEK
 *           cards. My version showed three loose session cards and no weeks.
 *   Coach = ScreenHeader "Your coach" -> **ONE Kit read** with the zone rings
 *           INSIDE it. The rings take `chromeless` for exactly this reason:
 *           they once kept their own border under the read and the founder
 *           read them as two cards, correctly. My version made them a
 *           separate card again and put them first.
 *
 * **A doc about a screen is not the screen.** Read the component.
 *
 * Every screen now renders REAL components — `PlanArc`, `PlanCalendar`,
 * `ZoneRings`, `CoachByline` — over a REAL generated plan (`generateRulePlan`,
 * the same call `SameWeekTwice` and the published plan pages make) and
 * `demoSurfaces`. The handoff supplied the FRAME and the idea of showing
 * three screens; it did not supply their contents.
 *
 * ⚠️ THE PLAN ARRIVES AS A PROP, GENERATED ON THE SERVER. See
 * `lib/marketing/demoPlanScreen.ts` — this file is `'use client'`, so calling
 * the engine here would ship it to every visitor.
 *
 * ⚠️ NO SEGMENTED CONTROL. The handoff draws one above the frame and says in
 * as many words not to ship it: in the product, the nav changes tabs.
 *
 * ⚠️ TODAY IS IMPORTED, NOT REDRAWN. `TodayStill` is the same screen the hero
 * renders, and it was the one screen the first cut got right — because it was
 * reused from `PhoneFrame` rather than drawn.
 */



function ScreenHeader({ title, sub }: { title: string; sub?: string }) {
  // Reproduced from DashboardClient's own ScreenHeader, which is a private
  // function there rather than a shared component. Same sizes, same tokens.
  return (
    <div style={{ padding: '16px 16px 8px' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 3, letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  )
}

/**
 * PLAN — `PlanScreen` in DashboardClient: "Your plan", the race, the arc,
 * Kit's card, then **PlanCalendar** — the Past / Now / Next / Later WEEK
 * cards. The weeks ARE the screen; a flat list of sessions is a different
 * screen (Today) wearing this one's header.
 *
 * ⚠️ `currentWeek` is READ from the plan, not typed. `PlanCalendar` decides
 * which week is "Now" from today's date via `getCurrentWeekIndex`, and a
 * hardcoded arc number would disagree with it the moment the anchor moved.
 */
function PlanStill({ plan, block }: { plan: DemoPlanScreen; block: DemoBlockView }) {
  return (
    <>
      <ScreenHeader title="Your plan" sub="Marathon" />
      <div style={{ padding: '0 16px 14px' }}>
        <PlanArc
          totalWeeks={block.totalWeeks}
          currentWeek={block.weekN}
          doneWeeks={block.weekN - 1}
          raceWeek={block.totalWeeks}
          phaseLabel="base → build → peak → taper"
        />
      </div>
      {/* This week, in the product's own words. `weekVoice` is computed by
          `lib/coaching/weekVoice.ts` — the same rule-engine functions the app
          renders this card from — so the sentence cannot be marketing copy
          wearing the app's clothes. Markup mirrors PlanScreen's card: moss
          rail, "This week" eyebrow, phase chip, headline, up to two items,
          km-target footer. No Kit byline: see demoPlanScreen.ts. */}
      <div style={{ padding: '0 16px 0' }}>
        <div style={{
          background: 'var(--card)', boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 14px 19px', position: 'relative' }}>
            <span aria-hidden style={{
              position: 'absolute', left: 8, top: 14, bottom: 14,
              width: 3, borderRadius: 2, background: 'var(--moss)',
            }} />
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{
                fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--mute)',
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>This week</span>
              {plan.weekVoice.phaseLabel && (
                <span style={{
                  marginLeft: 'auto', fontSize: 'var(--fs-micro)', fontWeight: 700,
                  color: 'var(--moss)', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{plan.weekVoice.phaseLabel}</span>
              )}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 600, color: 'var(--ink)',
              lineHeight: 1.4, letterSpacing: '-0.01em',
              marginBottom: plan.weekVoice.items.length > 0 ? 10 : 0,
            }}>{plan.weekVoice.headline}</div>
            {plan.weekVoice.items.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plan.weekVoice.items.map(item => (
                  <div key={item} style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>{item}</div>
                ))}
              </div>
            )}
          </div>
          {plan.weekVoice.target && (
            <div style={{
              padding: '10px 16px', borderTop: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                {plan.weekVoice.target} target
              </span>
              <span style={{ fontSize: 12, color: 'var(--mute)' }}>no runs logged yet</span>
            </div>
          )}
        </div>
      </div>

      {/* The real weeks view. Interactive in the app; the handlers are no-ops
          here because this is a still, and `PlanCalendar` keeps move and swap
          behind a tap, so at rest it shows exactly what a runner sees. */}
      <div style={{ paddingTop: 12 }} />
      <PlanCalendar
        weeks={plan.weeks}
        allOverrides={[]}
        allCompletions={{}}
        onOverrideChange={() => {}}
        onSessionTap={() => {}}
      />
    </>
  )
}

/**
 * COACH — `CoachScreen` in DashboardClient: "Your coach · W6 of 16", then
 * **CO-ONE, the ONE Kit read**, with the zone rings inside that same card
 * ("the week, pictured — one card with the read, not a second one").
 *
 * ⚠️ `chromeless` is the whole point. The rings once sat under the read and
 * kept their own border, and the founder read them as two cards. Giving them
 * their own card here would reproduce a bug the product already fixed.
 *
 * ⚠️ THE WEEK COUNT COMES FROM THE SAME PLAN THE PLAN TAB RENDERS. It was
 * typed as "W6 of 16" in the first pass — a 16-week count on a phone whose
 * Plan tab shows a 12-week half marathon. Two tabs of one device disagreed
 * about which block the runner is in, which is the fiction problem again at
 * a smaller scale. Caught by `realComponents.test.ts`, not by looking.
 */
/** The arc is a pure computation over three times; building it at module
 *  scope keeps it out of every render and proves it is not state. */
const ARC_COPY = RACE_PROJECTIONS_COPY.status.arc!
const arc = buildRaceProgressArc(DEMO_RACE_ARC)

function CoachStill({ block }: { block: DemoBlockView }) {
  return (
    <>
      <ScreenHeader title="Your coach" sub={`W${block.weekN} of ${block.totalWeeks}`} />
      <div style={{
        margin: '0 12px', background: 'var(--card)', borderRadius: 16,
        border: '0.5px solid var(--line)', padding: '14px 14px 4px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <CoachByline color="moss" role="This week" />
        <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.55, color: 'var(--ink-2)' }}>
          {DEMO_COACH_NOTE.observation}
        </span>
        <span style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.55, color: 'var(--ink-2)', fontStyle: 'italic' }}>
          {DEMO_COACH_NOTE.instruction}
        </span>
        <ZoneRings pctByZone={DEMO_ZONE_WEEK.pct} meta={DEMO_ZONE_WEEK.meta} chromeless />
      </div>

      {/* THE ARC — where I was, where I am, the goal I chose. The block the
          real CoachScreen renders directly under the read, and the reason the
          still stops looking like a screen that ran out: without it a quarter
          of the device was empty warm slate, which reads as "that is all there
          is" rather than as a crop. Real component, real copy constant, real
          `buildRaceProgressArc`; only the three times are illustrative. */}
      {arc && (
        <div style={{ padding: '12px 12px 0' }}>
          <div style={{
            background: 'var(--card)', borderRadius: 16,
            border: '0.5px solid var(--line)', padding: '14px 14px 16px',
          }}>
            <div style={{
              fontSize: 'var(--fs-micro)', fontWeight: 700, color: 'var(--mute)',
              textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
            }}>{ARC_COPY.raceEyebrow}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 14 }}>
              {DEMO_RACE_ARC.raceName}
            </div>
            <RaceProgressArcRow arc={arc} copy={ARC_COPY} />
          </div>
        </div>
      )}
    </>
  )
}

export function TabbedPhone({ plan, initial = 'Today' }: { plan: DemoPlanScreen | null; initial?: PhoneTab }) {
  const [tab, setTab] = useState<PhoneTab>(initial)
  // ONE block, read off the ONE generated plan, handed to all three tabs.
  // The alternative — each still deriving its own, or the page passing a
  // second prop — is how the device came to show a 16-week build on Today
  // and a 12-week one on Plan.
  const block: DemoBlockView = plan
    ? { weekN: plan.currentWeekIndex + 1, totalWeeks: plan.totalWeeks }
    : { weekN: DEMO_BLOCK.weekN, totalWeeks: DEMO_BLOCK.totalWeeks }
  return (
    <PhoneShell
      activeTab={tab}
      // `Me` is in the nav because the product has four tabs and a mockup that
      // hides one is a mockup of a different app. It has no screen here, so
      // selecting it would show Today under a "Me" nav.
      onTab={t => { if (t !== 'Me' && !(t === 'Plan' && !plan)) setTab(t) }}
    >
      {tab === 'Plan' && plan ? <PlanStill plan={plan} block={block} /> : tab === 'Coach' ? <CoachStill block={block} /> : <TodayStill {...block} />}
    </PhoneShell>
  )
}
