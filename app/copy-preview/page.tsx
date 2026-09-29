// LOCAL DESIGN HARNESS — 404s in production, not linked from anywhere, not in the sitemap.
//
// NOEMDASH-JSX-TEXT-01. The founder asked whether the rewritten sentences behind auth
// render properly. Two of the eight changed files were already reachable (`ZoneRings`,
// `TrendCard` via `/coach-preview`). This page reaches the rest that CAN be reached.
//
// 🔴 WHAT IT DELIBERATELY DOES NOT COVER, AND WHY THAT IS THE REAL FINDING.
// 19 of the 35 rewrites live in `DashboardClient.tsx`, spread across **14 functions that
// are LOCAL and not exported** — QuitTab, OrientationScreen, SessionPopupInner, TodayScreen,
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
import QuitTab from '@/components/dashboard/QuitTab'
import SupportScreen from '@/components/dashboard/SupportScreen'
import LockedCoachingPreview from '@/components/dashboard/LockedCoachingPreview'
import PendingAnalysisCard from '@/components/dashboard/PendingAnalysisCard'
import ConnectRunsBanner from '@/components/dashboard/ConnectRunsBanner'
import HRZonesSection from '@/components/dashboard/HRZonesSection'
import AppleHealthConnectionRow from '@/components/dashboard/AppleHealthConnectionRow'
import IconMe from '@/components/dashboard/IconMe'
import ManualRunModal from '@/components/dashboard/ManualRunModal'

const noop = () => {}

function Case({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{
        fontSize: '10px', fontWeight: 700, color: 'var(--mute)',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px',
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
          title="QuitTab — 4 rewrites"
          note={'The smoking timeline: "48 hours: CO leaves bloodstream." and three siblings, each an em dash before this.'}
        >
          <QuitTab quitDays={12} raceDistanceKm={42.2} onBack={noop} />
        </Case>

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
            onOpenZones={noop}
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

      </div>

      {/* GeneratePlanScreen holds 9 of the 35 rewrites, spread across wizard steps
          (the grey-middle explainers, the level-mismatch hints, the Foundation Block
          note, the six-day cap). It is an exported default whose only REQUIRED prop is
          `onBack`, so it mounts here; the rest of the wizard's state is its own.
          ⚠️ Full width, outside the 420px column, because it is a whole screen. */}
      <div style={{ borderTop: '1px solid var(--line)', marginTop: '16px', paddingTop: '16px' }}>
        <div style={{
          fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase',
          letterSpacing: '0.08em', padding: '0 16px 8px',
        }}>
          GeneratePlanScreen (wizard) · 9 rewrites across its steps
        </div>
        <GeneratePlanScreen onBack={noop} />
      </div>
    </div>
  )
}
