'use client'

import { useState } from 'react'
import { PhoneShell, type PhoneTab } from '@/components/marketing/PhoneShell'
import { TodayStill } from '@/components/marketing/PhoneFrame'
import SessionCard from '@/components/shared/SessionCard'
import ZoneRings from '@/components/shared/ZoneRings'
import CoachNoteBlock from '@/components/shared/CoachNoteBlock'
import PlanArc from '@/components/shared/PlanArc'
import { DEMO_WEEK, DEMO_ZONE_WEEK, DEMO_COACH_NOTE } from '@/lib/marketing/demoSurfaces'

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
 * So every screen here renders REAL shared components — `SessionCard`,
 * `ZoneRings`, `CoachNoteBlock`, `PlanArc` — fed by `demoSurfaces`, which is
 * the established pattern `ProductStill` already uses on this page. The
 * layout follows `docs/canonical/screen-architecture.md`, which is the
 * authority on what belongs on each screen. The handoff supplied the FRAME
 * and the idea of showing three screens; it did not supply their contents.
 *
 * ⚠️ NO SEGMENTED CONTROL. The handoff draws one above the frame and says in
 * as many words not to ship it: in the product, the nav changes tabs.
 *
 * ⚠️ TODAY IS IMPORTED, NOT REDRAWN. `TodayStill` is the same screen the hero
 * renders, and it was the one screen the first cut got right — because it was
 * reused from `PhoneFrame` rather than drawn.
 */


function ScreenHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div style={{ padding: '14px 16px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{
        fontSize: 'var(--fs-micro)', fontWeight: 700, letterSpacing: '0.08em',
        textTransform: 'uppercase', color: 'var(--mute)',
      }}>{eyebrow}</span>
      <span style={{
        fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)',
      }}>{title}</span>
    </div>
  )
}

/**
 * PLAN — `screen-architecture.md`: "Own the training arc." What belongs here
 * is the Plan Arc with its race countdown, the week-by-week session grid, and
 * this week's framing (phase, theme, km target).
 *
 * ⚠️ What was here before: a 7-day dot strip, a flat list of four
 * hand-drawn cards and an invented "4 sessions / 38km / 3 rest days" summary.
 * The arc — the FIRST thing the real screen shows and the thing that makes it
 * "own the training arc" — was missing entirely.
 *
 * Real components: `PlanArc`, `SessionCard`. Data: `DEMO_WEEK`.
 */
function PlanStill() {
  return (
    <>
      <ScreenHeader eyebrow="Week 6 of 16 · Base" title="This week" />

      <div style={{ padding: '0 16px 16px' }}>
        <PlanArc
          totalWeeks={16}
          currentWeek={6}
          doneWeeks={5}
          deloadWeeks={[4, 8, 12]}
          raceWeek={16}
          phaseLabel="base → build → peak → taper"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
        {DEMO_WEEK.map(s => (
          <SessionCard key={s.name} {...s} />
        ))}
      </div>
    </>
  )
}

/**
 * COACH — `screen-architecture.md`: "Kit's synthesis — what your training
 * data means and what to do next... The user opens Coach to hear from Kit."
 * What belongs here is Kit's weekly read and the zone rings.
 *
 * ⚠️ What was here before was fiction in three ways: four horizontal bars
 * where the product plots the week as RINGS (the brand mark used as a data
 * display, Pattern 22); the sentence "Target is 80%. Last week: 62%.", which
 * appears nowhere in the product; and no Kit read at all — the one thing the
 * screen exists for. It also hand-drew bars while `components/shared/
 * ZoneBar.tsx` calls itself the canonical zone-visualisation primitive.
 *
 * Real components: `ZoneRings`, `CoachNoteBlock aiGenerated` (which brings
 * the real byline and the real AIMark sparkle, so the AI provenance on the
 * marketing page is the product's own, not an impression of it).
 * Data: `DEMO_ZONE_WEEK`, `DEMO_COACH_NOTE` — the same figures the homepage
 * already shows, so the two surfaces cannot disagree.
 */
function CoachStill() {
  return (
    <>
      {/* The eyebrow says THIS week because ZoneRings' own default label
          does ("This week in zones"), and two timeframes on one screen is
          the kind of small lie that makes a mockup feel drawn. */}
      <ScreenHeader eyebrow="This week" title="How it is going" />

      <div style={{ padding: '0 16px 14px' }}>
        <ZoneRings pctByZone={DEMO_ZONE_WEEK.pct} meta={DEMO_ZONE_WEEK.meta} />
      </div>

      <div style={{ padding: '0 16px' }}>
        <CoachNoteBlock aiGenerated timestamp={DEMO_COACH_NOTE.timestamp}>
          <span style={{ display: 'block', marginBottom: '10px' }}>
            {DEMO_COACH_NOTE.observation}
          </span>
          <span style={{ display: 'block', fontStyle: 'italic' }}>
            {DEMO_COACH_NOTE.instruction}
          </span>
        </CoachNoteBlock>
      </div>
    </>
  )
}

export function TabbedPhone({ initial = 'Today' }: { initial?: PhoneTab }) {
  const [tab, setTab] = useState<PhoneTab>(initial)
  return (
    <PhoneShell
      activeTab={tab}
      // `Me` is in the nav because the product has four tabs and a mockup that
      // hides one is a mockup of a different app. It has no screen here, so
      // selecting it would show Today under a "Me" nav, which is worse than
      // not responding. It stays visible and inert.
      onTab={t => { if (t !== 'Me') setTab(t) }}
    >
      {tab === 'Plan' ? <PlanStill /> : tab === 'Coach' ? <CoachStill /> : <TodayStill />}
    </PhoneShell>
  )
}
