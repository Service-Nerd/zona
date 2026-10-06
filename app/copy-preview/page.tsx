// LOCAL DESIGN HARNESS — 404s in production, not linked from anywhere, not in the sitemap.
//
// NOEMDASH-JSX-TEXT-01. The founder asked whether the rewritten sentences behind auth
// render properly. Two of the eight changed files were already reachable (`ZoneRings`,
// `TrendCard` via `/coach-preview`). This page reaches the rest that CAN be reached.
//
// 🔴 WHAT IT DELIBERATELY DOES NOT COVER, AND WHY THAT IS THE REAL FINDING.
// 19 of the 35 rewrites live in `DashboardClient.tsx`, spread across **14 functions that
// are LOCAL and not exported** — OrientationScreen, SessionPopupInner, TodayScreen,
// CoachTeaser, ConnectRunsBanner, AppleHealthConnectionRow, HRZonesSection, SupportScreen,
// MeScreen, PendingAnalysisCard, LockedCoachingPreview, ManualRunModal, IconMe. None can be
// imported, so none can be rendered anywhere but inside a signed-in session.
//
// That is the same class this repo has recorded four times already ("a pattern that is a
// local variable cannot travel" — ACTION-ROW-01; `SectionLabel` as a local function, the
// fourth instance). Fourteen screen components inside one 12k-line file is why nothing can
// see them. Filed as ME-SCREEN-EXTRACT-02 rather than refactored here: exporting fourteen
// functions to check punctuation would be a large, risky change to satisfy a small one.

'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import PostRaceReshapeCard from '@/components/training/PostRaceReshapeCard'
import RaceResultSheet from '@/components/training/RaceResultSheet'
import GeneratePlanScreen from '@/app/dashboard/GeneratePlanScreen'
import SupportScreen from '@/components/dashboard/SupportScreen'
import LockedCoachingPreview from '@/components/dashboard/LockedCoachingPreview'
import PendingAnalysisCard from '@/components/dashboard/PendingAnalysisCard'
import ConnectRunsBanner from '@/components/dashboard/ConnectRunsBanner'
import HRZonesSection from '@/components/dashboard/HRZonesSection'
import AppleHealthConnectionRow from '@/components/dashboard/AppleHealthConnectionRow'
import IconMe from '@/components/dashboard/IconMe'
import ManualRunModal from '@/components/dashboard/ManualRunModal'
import OrientationScreen from '@/components/dashboard/OrientationScreen'
import CoachTeaser from '@/components/dashboard/CoachTeaser'
import FloatingBackButton from '@/components/shared/FloatingBackButton'
import TodayScreen from '@/components/dashboard/TodayScreen'
import MeScreen from '@/components/dashboard/MeScreen'
import SessionPopupInner from '@/components/dashboard/SessionPopupInner'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'
import type { Plan } from '@/types/plan'
import { MICRO_LABELS } from '@/components/shared/microLabels'

const noop = () => {}

// 🔴 REAL ENGINE OUTPUT, NOT A HAND-WRITTEN PLAN. `'Shin splints'` was once typed where
// the product emits `'shin_splints'`, and a test passed against a plan no engine would
// produce. A harness built on invented data shows a screen the runner will never see.
// Regenerate: `npx tsx scripts/build-harness-fixture.ts`. Guarded by harnessPlan.test.ts.
const harnessPlan = harnessPlanJson as unknown as Plan

// 🔴 DERIVED, NOT TYPED. A hardcoded index made the harness show TodayScreen on "Week 3"
// beside CoachTeaser on "W7 of 14" — the same runner, two different weeks, because
// CoachTeaser derives the week from the plan's dates and TodayScreen took what it was
// given. A harness that contradicts itself teaches the wrong thing about the product.
const WEEK_INDEX = Math.max(0, Math.min(
  harnessPlan.weeks.length - 1,
  harnessPlan.weeks.findIndex(w => {
    const start = new Date((w as unknown as { date: string }).date).getTime()
    return Date.now() >= start && Date.now() < start + 7 * 24 * 60 * 60 * 1000
  }),
))
const week = harnessPlan.weeks[WEEK_INDEX]!
const firstSessionKey = Object.keys(week.sessions ?? {}).find(k => (week.sessions as never)[k])!
const firstSession = (week.sessions as never)[firstSessionKey]

const todayProps = {
  plan: harnessPlan, weekIndex: WEEK_INDEX,
  daysToRace: 77, raceName: 'Brighton Half', preferredMetric: 'distance' as const,
  sessionMetricOverrides: {}, stravaRuns: [], allOverrides: [], overridesReady: true,
  allCompletions: {}, preferredUnits: 'km' as const, zone2Ceiling: 148,
}
const meProps = {
  plan: harnessPlan, initials: 'SC', athlete: 'Sam Carter',
  theme: 'light' as const, onThemeChange: noop,
  preferredUnits: 'km' as const, onUnitsChange: noop,
  preferredMetric: 'distance' as const, onMetricChange: noop,
  restingHR: 48, maxHR: 186, maxHrSource: 'observed' as const,
  firstName: 'Sam', lastName: 'Carter', profileEmail: 'sam@example.com',
  onSaveName: async () => true, dynamicAdjustmentsEnabled: true,
  onHRChange: noop,
}
const sessionProps = {
  session: firstSession, weekTheme: week.theme, weekN: week.n, preloadedRuns: [],
  aiNotes: true, onClose: noop, preferredUnits: 'km' as const, zone2Ceiling: 148,
  preferredMetric: 'distance' as const,
}

/**
 * 🔴 THE PREVIEW SHOWED ONE SESSION TYPE, AND IT WAS THE ONE THAT CHANGED LEAST.
 *
 * `firstSession` is the first key of the current week, which is an easy run — no
 * `derived_set`, no steps, no notes. So `SESSION-STEP-LEGIBILITY-01` could be
 * verified by reading strings and **never looked at**: the quality card, which is
 * the only type that renders step rows, notes, pace ceilings and rep groups, had
 * no preview at all. The founder asked whether the screens had been seen. For the
 * type that changed most, they had not.
 *
 * Picked BY SHAPE from the real harness plan, never by week index — a hardcoded
 * index is what made this page contradict itself about which week it was showing.
 */
function pickSession(match: (s: Record<string, unknown>) => boolean) {
  for (const w of harnessPlan.weeks) {
    for (const s of Object.values((w.sessions ?? {}) as Record<string, unknown>)) {
      if (s && match(s as Record<string, unknown>)) return { session: s, weekN: w.n, theme: w.theme }
    }
  }
  return null
}
const stepCount = (s: Record<string, unknown>) => {
  const ds = s.derived_set as { version?: number; blocks?: { steps: unknown[] }[] } | undefined
  return ds?.version === 2 ? (ds.blocks ?? []).reduce((n, b) => n + b.steps.length, 0) : 0
}
const progressive = pickSession(s => s.label === 'Progressive tempo' && stepCount(s) >= 3)
const reps = pickSession(s => stepCount(s) >= 2 && s.label !== 'Progressive tempo')
const longRun = pickSession(s => !!(s.structure as { race_pace_segment?: unknown } | undefined)?.race_pace_segment)
  ?? pickSession(s => s.type === 'easy' && Number(s.distance_km ?? 0) > 15)
const raceDay = pickSession(s => s.type === 'race')
const caseProps = (picked: ReturnType<typeof pickSession>, units: 'km' | 'mi' = 'km') => picked && ({
  ...sessionProps, session: picked.session, weekTheme: picked.theme, weekN: picked.weekN, preferredUnits: units,
})

function Case({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{
        ...MICRO_LABELS.eyebrow,
        color: 'var(--mute)',
        marginBottom: '8px',
      }}>
        {title}
      </div>
      {children}
      {note && (
        <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>
          {note}
        </p>
      )}
    </div>
  )
}

export default function CopyPreview() {
  if (process.env.NODE_ENV === 'production') notFound()

  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', padding: '24px 0 64px' }}>
      <div style={{ maxWidth: '420px', margin: '0 auto', padding: '0 16px' }}>

        <Case
          title="PostRaceReshapeCard — locked"
          note={'Checks: "…around your recovery, adjusting the next few weeks so you don’t come back too fast." The rewrite is in the Locked branch, which nothing else mounts.'}
        >
          <PostRaceReshapeCard state="locked" onUpgrade={noop} onDismiss={noop} />
        </Case>

        <Case
          title="RaceResultSheet — with a target time"
          note={'Checks two rewrites: "Set to your goal. Adjust to what you ran." (needs targetTime set) and "No next race yet. What now?" further down the sheet.'}
        >
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            style={{
              width: '100%', minHeight: '44px', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--line)', background: 'var(--card)',
              fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink)',
              cursor: 'pointer',
            }}
          >
            Open the sheet
          </button>
          {sheetOpen && (
            <RaceResultSheet
              raceWeekN={16}
              raceName="Brighton Marathon"
              targetTime="3:45:00"
              onClose={() => setSheetOpen(false)}
              onReshapeReady={noop}
              onLogOnly={noop}
            />
          )}
        </Case>

        {/* ── DASHBOARD-SCREEN-EXTRACT-01 phase 1 ────────────────────────────
            These five were module-level functions inside DashboardClient.tsx, so
            nothing could import them and nothing could render them. They are here
            unchanged, and between them they carry 8 of the 19 sentences that had
            never been seen outside a signed-in session. */}

        <Case
          title="SupportScreen — 1 rewrite"
          note={'Checks the diagnostics paragraph: "You’ll see it before you send. Delete it if you’d rather not."'}
        >
          <SupportScreen onBack={noop} email="runner@example.com" hasPaidAccess trialDaysLeft={null} />
        </Case>

        <Case
          title="LockedCoachingPreview — 1 rewrite"
          note={'"Kit reads here. He needs your runs first: Strava or Apple Health."'}
        >
          <LockedCoachingPreview onUpgrade={noop} onOpenCoach={noop} />
        </Case>

        <Case
          title="PendingAnalysisCard — 1 rewrite"
          note={'"Done. Your run gets analysed in the background."'}
        >
          <PendingAnalysisCard onOpenCoach={noop} />
        </Case>

        {/* 🔴 I PREDICTED THIS ONE WOULD NOT RENDER AND IT DOES. The note here said it
            self-hides until its Supabase query resolves, so signed out it would show
            nothing and its rewrite would be unverifiable. It renders. Corrected rather
            than left standing: a comment asserting a thing is unverifiable, sitting next
            to that thing verifying, is the same doc-versus-reality gap this whole day of
            work has been about. Reason: `visible` starts `undefined` and the banner
            treats not-yet-known as showable. */}
        <Case
          title="ConnectRunsBanner — 1 rewrite"
          note={'"Apple Health connects from the Me screen. Takes about ten seconds." It renders signed out, which I had expected it not to.'}
        >
          <ConnectRunsBanner />
        </Case>

        {/* ── DASHBOARD-SCREEN-EXTRACT-02 ────────────────────────────────────
            Four of the six second-phase extractions mount without a Plan fixture.
            ⚠️ `CoachTeaser` and `OrientationScreen` both REQUIRE a `Plan`, so their
            3 rewrites are still unrendered. Named rather than quietly omitted. */}

        <Case
          title="HRZonesSection — 1 rewrite"
          note={'"…(184 bpm), usually the highest your device happened to record, not your true max." Shown when the entered max is below the age estimate.'}
        >
          <HRZonesSection
            restingHR={48} maxHR={170} maxHrSource="observed" birthYear={1985}
            onSave={async () => {}} hrZoneMethod="karvonen" hrAssumptionNote={null}
          />
        </Case>

        <Case
          title="AppleHealthConnectionRow — 1 rewrite"
          note={'"Zonna reads your runs from Apple Health to coach you. Read-only: Zonna never writes to Apple Health."'}
        >
          <AppleHealthConnectionRow />
        </Case>

        <Case title="IconMe — 1 rewrite (the tab glyph)" note="Both states.">
          <span style={{ display: 'inline-flex', gap: '16px' }}>
            <IconMe active={false} />
            <IconMe active />
          </span>
        </Case>

        <Case
          title="ManualRunModal — 1 rewrite"
          note={'"…5 km · 45 min · edit below if different" — the hint under the prefilled planned values.'}
        >
          <ManualRunModal
            weekN={3} sessionKey="tue" preferredUnits="km"
            onClose={noop} onSaved={noop}
            sessionName="Easy run" sessionType="easy"
            plannedDistanceKm={8} plannedDurationMins={45}
            sessionDate="2026-09-29"
          />
        </Case>

        {/* ── DASHBOARD-HARNESS-01 ───────────────────────────────────────────
            These two needed a `Plan`, which is why they were unrendered until now.
            The plan is REAL ENGINE OUTPUT from a real production input (a 14-week
            half marathon), generated by `scripts/build-harness-fixture.ts` and
            guarded so it cannot drift from what the engine actually produces. */}

        <Case
          title="OrientationScreen — 2 rewrites"
          note={'"Most runners live in a grey middle: too hard to recover, too easy to improve." and the voice-anchor stamp under the wordmark.'}
        >
          <OrientationScreen
            plan={harnessPlan}
            firstName="Sam"
            zone2Ceiling={148}
            restingHR={48}
            maxHR={186}
            onDismiss={noop}
          />
        </Case>

        <Case
          title="CoachTeaser — 1 rewrite"
          note={'The free-tier Coach surface. Checks the locked report card copy.'}
        >
          <CoachTeaser plan={harnessPlan} firstName="Sam" onUpgrade={noop} />
        </Case>

        {/* 🔴 BACK-ARROW-FLOAT-01 — RENDERED IN A REAL SCROLLER, ON PURPOSE.
            `position: sticky` resolves against the nearest ancestor with `overflow`
            other than `visible` — even one that can never scroll. Four screens in this
            app once declared `overflow-y: auto` with no height and a header pinned to
            one of them was never sticky at all. The harness page scrolls in the
            DOCUMENT, so mounting a door here would prove nothing about the app, where
            the screen scrolls inside a `height: 100dvh; overflow-y: auto` box. This
            case reproduces that box. */}
        {/* 🔴 BACK-ARROW-FLOAT-04 — A STICKY FLEX ITEM, WHICH IS NEW. Three of the five
            screens converted here place the float as a DIRECT CHILD of a
            `flexDirection: column` parent; every earlier call site put it in a block
            container. A sticky flex item is legal CSS, but `align-items: stretch` against
            `width: fit-content` is exactly the kind of interaction this repo has been
            wrong about by reading, so it gets rendered. The inner column also reproduces
            the real screens' `minHeight: 100%` + `flex: 1, overflowY: auto` body, whose
            scrollport can never overflow: the arrow must pin to the OUTER box. */}
        {/* ⚠️ `HrCalibrationSheet` IS NOT MOUNTED HERE, DELIBERATELY (ZONES-HR-SHEET-01).
            Measured on this page: `role="dialog"` count is ZERO and only ONE "Resting HR"
            label exists, so `Sheet` never mounts on this harness. That is not new:
            `ManualRunModal` is a Sheet and has been mounted here rendering nothing. The
            portal needs a client page and this one is a server component. The sheet is
            previewed on `/sheet-preview`, which imports the real primitive. */}
        <Case
          title="FloatingBackButton — sticky inside a flex column (the converted screens)"
          note="Scroll the box. The arrow must hold at 16px, and must not stretch full-width."
        >
          <div
            id="float-flexcol"
            style={{ height: '220px', overflowY: 'auto', background: 'var(--bg)',
                     border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
              <FloatingBackButton onClick={noop} />
              <div style={{ padding: 'var(--space-5) 16px 0', flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '22px',
                  fontWeight: 600, color: 'var(--ink)', marginBottom: 'var(--space-6)' }}>
                  Update pace targets.
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>
                {Array.from({ length: 14 }, (_, i) => (
                  <div key={i} style={{ background: 'var(--card)', borderRadius: '12px',
                    padding: '14px 16px', marginBottom: '10px', fontSize: '13px',
                    color: 'var(--ink-2)', boxShadow: 'var(--shadow-card)' }}>
                    Body row {i + 1}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Case>

        <Case
          title="FloatingBackButton — in an app-shaped scroller"
          note="Scroll the box. The arrow must hold at 16px from its top edge, not slide away."
        >
          <div
            id="float-scroller"
            style={{ height: '220px', overflowY: 'auto', background: 'var(--bg)',
                     border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)' }}
          >
            <FloatingBackButton onClick={noop} />
            {/* BACK-ARROW-FLOAT-02 — the captioned variant, in the same scroller. Its
                label has no ground of its own in `BackButton`, so this is where that
                gets proved rather than assumed. */}
            <FloatingBackButton onClick={noop} ariaLabel="Adjust inputs" caption="Adjust inputs" />
            <div style={{ padding: '0 16px' }}>
              {Array.from({ length: 18 }, (_, i) => (
                <div key={i} style={{ background: 'var(--card)', borderRadius: '12px',
                  padding: '14px 16px', marginBottom: '10px', fontSize: '13px',
                  color: 'var(--ink-2)', boxShadow: 'var(--shadow-card)' }}>
                  A card the arrow has to survive passing over, row {i + 1}
                </div>
              ))}
            </div>
          </div>
        </Case>

        {/* The three biggest. Their prop sets are large because they ARE the app's
            main surfaces; the values below are a plausible mid-block runner so the
            screens show content rather than empty states. */}

        <Case title="TodayScreen" note="The main surface. 1 rewrite plus the whole today card.">
          <TodayScreen {...todayProps} />
        </Case>

        <Case title="MeScreen" note="The index, 1 rewrite. All doors closed.">
          <MeScreen {...meProps} />
        </Case>

        <Case title="SessionPopupInner — QUALITY, progressive tempo (v2 steps + notes)" note="SESSION-STEP-LEGIBILITY-01: three steps, three different instructions, a pace ceiling as 'or slower', durations with units.">
          {caseProps(progressive) ? <SessionPopupInner {...caseProps(progressive)!} /> : <p>no progressive tempo in the fixture</p>}
        </Case>
        <Case title="SessionPopupInner — QUALITY in MILES" note="The same card for a miles reader: no /km may appear.">
          {caseProps(progressive, 'mi') ? <SessionPopupInner {...caseProps(progressive, 'mi')!} /> : <p>n/a</p>}
        </Case>
        <Case title="SessionPopupInner — QUALITY, rep block (repeat label)" note="The grouped path: a repeat bar above its rows.">
          {caseProps(reps) ? <SessionPopupInner {...caseProps(reps)!} /> : <p>no rep session in the fixture</p>}
        </Case>
        <Case title="SessionPopupInner — LONG RUN" note="v1 path: no derived_set, so one main-set row and no notes.">
          {caseProps(longRun) ? <SessionPopupInner {...caseProps(longRun)!} /> : <p>no long run in the fixture</p>}
        </Case>
        <Case title="SessionPopupInner — RACE DAY" note="Race week renders the same card.">
          {caseProps(raceDay) ? <SessionPopupInner {...caseProps(raceDay)!} /> : <p>no race session in the fixture</p>}
        </Case>
        <Case title="SessionPopupInner — EASY (the original case)" note="Session detail, 2 rewrites.">
          <SessionPopupInner {...sessionProps} />
        </Case>

      </div>

      {/* GeneratePlanScreen holds 9 of the 35 rewrites, spread across wizard steps
          (the grey-middle explainers, the level-mismatch hints, the Foundation Block
          note, the six-day cap). It is an exported default whose only REQUIRED prop is
          `onBack`, so it mounts here; the rest of the wizard's state is its own.
          ⚠️ Full width, outside the 420px column, because it is a whole screen. */}
      <div style={{ borderTop: '1px solid var(--line)', marginTop: '16px', paddingTop: '16px' }}>
        <div style={{
          ...MICRO_LABELS.eyebrow,
          color: 'var(--mute)',
          padding: '0 16px 8px',
        }}>
          GeneratePlanScreen (wizard) · 9 rewrites across its steps
        </div>
        <GeneratePlanScreen onBack={noop} />
      </div>
    </div>
  )
}
