// COACH-FULL-SCREEN-01 — the whole Coach screen, Pro and free, and the trial's Upgrade screen, at 375px, from the
// REAL shared components and the founder's real data (computed 2026-10-31 by the app's own owners: computeLoadPicture,
// effortRecord, kitReceipts). For the Design Board's sign-off sitting. Dev only, like /coach-preview.
//
// ⚠️ TWO BLOCKS ARE REPLICAS, marked `data-replica`: Kit's read card and the "This week" card shell are written inline in
// DashboardClient's CoachScreen, not as components, so they are copied here style-for-style. Every component INSIDE them
// (CoachByline, ShareControl, RingsTapArea, ZoneRings, LoadShape, LoadHistory, WeekFacts) is the real one.
'use client'

import { notFound } from 'next/navigation'
import ScreenHeader from '@/components/ui/ScreenHeader'
import CoachByline from '@/components/shared/CoachByline'
import ShareControl from '@/components/shared/ShareControl'
import RingsTapArea from '@/components/shared/RingsTapArea'
import ZoneRings from '@/components/shared/ZoneRings'
import LoadShape from '@/components/shared/LoadShape'
import LoadHistory from '@/components/shared/LoadHistory'
import WeekFacts from '@/components/shared/WeekFacts'
import EffortRecord from '@/components/shared/EffortRecord'
import TrendCard from '@/components/shared/TrendCard'
import { RaceTimesCard } from '@/components/shared/RaceTimesCard'
import CoachTeaser from '@/components/dashboard/CoachTeaser'
import UpgradeScreen from '@/app/dashboard/UpgradeScreen'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { hueText } from '@/lib/ui/hueText'

// CAPTURE AID, this dev page only: a headless screenshot draws no animation frames, so TrendCard's count-up would read
// 0 → 0 (rAF-driven; on a visible device it reaches its value). Frames are driven by a timer on this page alone.
if (typeof window !== 'undefined') {
  let frame = 0  // each frame advances a full second, so a count-up settles in two frames however slow the timers are
  window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(++frame * 1000), 16) as unknown as number
}

const F = {"effortRuns": [{"date": "2026-09-08T18:50:38+00:00", "z1": 0, "z2": 60, "z3": 30, "z45": 10, "kind": "easy", "thisWeek": false}, {"date": "2026-09-11T18:23:34+00:00", "z1": 3.33, "z2": 20, "z3": 40, "z45": 36.67, "kind": "grey", "thisWeek": false}, {"date": "2026-09-13T09:45:27+00:00", "z1": 2.17, "z2": 82.61, "z3": 15.22, "z45": 0, "kind": "easy", "thisWeek": false}, {"date": "2026-09-15T18:02:59+00:00", "z1": 4.76, "z2": 9.52, "z3": 42.86, "z45": 42.86, "kind": "grey", "thisWeek": false}, {"date": "2026-09-19T12:16:25+00:00", "z1": 12.5, "z2": 87.5, "z3": 0, "z45": 0, "kind": "easy", "thisWeek": false}, {"date": "2026-09-20T09:14:13+00:00", "z1": 2.22, "z2": 53.33, "z3": 35.56, "z45": 8.89, "kind": "easy", "thisWeek": false}, {"date": "2026-09-30T18:52:06+00:00", "z1": 3.45, "z2": 37.93, "z3": 58.62, "z45": 0, "kind": "grey", "thisWeek": false}, {"date": "2026-10-01T18:31:53+00:00", "z1": 14.29, "z2": 85.71, "z3": 0, "z45": 0, "kind": "easy", "thisWeek": false}, {"date": "2026-10-06T18:07:29+00:00", "z1": 3.23, "z2": 25.81, "z3": 32.26, "z45": 38.71, "kind": "split", "thisWeek": false}, {"date": "2026-10-08T18:04:18+00:00", "z1": 10, "z2": 90, "z3": 0, "z45": 0, "kind": "easy", "thisWeek": false}, {"date": "2026-10-09T18:27:54+00:00", "z1": 3.03, "z2": 24.24, "z3": 51.52, "z45": 21.21, "kind": "grey", "thisWeek": false}, {"date": "2026-10-13T18:16:59+00:00", "z1": 0, "z2": 14.81, "z3": 40.74, "z45": 44.44, "kind": "hard", "thisWeek": false}, {"date": "2026-10-15T18:07:39+00:00", "z1": 14.29, "z2": 85.71, "z3": 0, "z45": 0, "kind": "easy", "thisWeek": false}, {"date": "2026-10-23T18:37:42+00:00", "z1": 22.73, "z2": 77.27, "z3": 0, "z45": 0, "kind": "easy", "thisWeek": false}, {"date": "2026-10-27T19:09:16+00:00", "z1": 3.33, "z2": 10, "z3": 43.33, "z45": 43.33, "kind": "grey", "thisWeek": true}], "receipts": [{"tone": "drifted", "lead": "27 Oct, 9.5km:", "text": "43% of it in Zone 3 and 43% in Zones 4\u20135. Your easy ceiling is 145."}, {"tone": "drifted", "lead": "This week:", "text": "1.65\u00d7 your recent normal."}, {"tone": "held", "lead": "23 Oct, 6km:", "text": "100% of it in Zones 1\u20132."}], "history": [{"km": 25.02379, "plannedEasy": false}, {"km": 22.55426, "plannedEasy": false}, {"km": 29.016530000000003, "plannedEasy": false}, {"km": 10.09165, "plannedEasy": false}, {"km": 25.13144, "plannedEasy": false}, {"km": 25.86128, "plannedEasy": false}, {"km": 21.53943, "plannedEasy": false}, {"km": 34.04089999999999, "plannedEasy": true}], "normalKm": 20.65595, "ratio": 1.6479948876715906, "ring": {"z1": 3.33, "z2": 10, "z3": 43.33, "z45": 43.33}, "ringHits": 1} as any

const PHONE = { width: '375px', flex: 'none', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '28px', overflow: 'hidden', paddingBottom: '24px' } as const
const STACK = { padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' } as const
const CARD = { background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' } as const

function ProCoach() {
  return (
    <div style={PHONE} data-screen="pro-coach">
      <ScreenHeader title="Your coach" sub="W2 of 8" />
      <div style={STACK}>
        <div data-replica="kit-read" style={{ ...CARD, padding: '18px 20px 18px 22px', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '8px', top: '14px', bottom: '14px', width: '3px', background: 'var(--moss)', borderRadius: '2px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <CoachByline color="moss" role="This week" />
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3, marginBottom: '10px' }}>
            You ran too hard when it mattered least.
          </div>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.7, margin: 0, marginBottom: '12px' }}>
            Tuesday&apos;s easy run was the problem: 10% in zone, aerobic efficiency down 18% against baseline. You&apos;re at 2 of 3 sessions done this week with Sunday&apos;s 9km easy still ahead of you. Volume&apos;s on track, but zone discipline sits at 10 out of 100.
          </p>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.5, fontStyle: 'italic' }}>
            Hold the zone on Sunday&apos;s easy run, and if heart rate lifts above ceiling, walk it back down immediately.
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}><ShareControl ariaLabel="Share this week" share={async () => {}} /></div>
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 'var(--space-5)', paddingTop: 'var(--space-5)' }}>
            <RingsTapArea onOpen={() => {}}>
              <ZoneRings chromeless pctByZone={F.ring} meta={`across ${F.ringHits} run`} />
            </RingsTapArea>
          </div>
        </div>

        <div data-replica="this-week" style={{ ...CARD, padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)', marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            This week <span style={{ fontSize: '11px', color: 'var(--moss-strong)' }}>ⓘ</span>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: hueText('var(--warn)'), letterSpacing: '-0.2px', lineHeight: 1.25 }}>above your recent normal</div>
          <div style={{ marginTop: 'var(--space-3)' }}><LoadShape ratio={F.ratio} color="var(--warn)" /></div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', color: 'var(--mute)', marginTop: 'var(--space-2)' }}>{F.ratio.toFixed(2)}× your recent average</div>
          <LoadHistory history={F.history} normalKm={F.normalKm} thisWeekColor="var(--warn)" />
          <WeekFacts runs={{ done: 2, planned: 3, verdict: { label: 'on track', color: 'var(--moss-strong)' } }} strength={{ done: 2, planned: 2, next: null }} />
        </div>

        <EffortRecord runs={F.effortRuns} weeks={8} />

        <TrendCard state="live" label="Easy run trend" sessionLabel="easy run" earlierMonth="May" earlierHr={138} nowHr={154} cohortSize={24} windowMonths={6} earlierPace={459} nowPace={399} glossless />

        <RaceTimesCard variant="status" stravaConnected={false} onOpenBenchmark={() => {}} previewData={{
            state: 1, confidence: 'high', label: 'From your benchmark', source: 'benchmark', vdot: 42,
            distances: null, recalibrationSuggested: false, upgradeCtaType: null,
            target: { distanceKm: 10, raceName: 'Dorney Lake', ultraDistance: false, currentSeconds: 2957, baselineSeconds: null, goalSeconds: 2700, arc: { distanceKm: 10, atLabel: null, baselineSeconds: null, baselineLabel: 'Plan start', currentSeconds: 2957, goalSeconds: 2700 }, deltaSeconds: null, deltaFormatted: null, improved: null },
          } as any} />
      </div>
    </div>
  )
}

export default function CoachFullPreview() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <main style={{ background: 'var(--bg-soft)', minHeight: '100vh', padding: '24px', fontFamily: 'var(--font-ui)' }}>
      <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
        <div><div style={{ ...MICRO_LABELS.eyebrow, color: 'var(--mute)', margin: '0 0 8px 4px' }}>Pro Coach</div><ProCoach /></div>
        <div><div style={{ ...MICRO_LABELS.eyebrow, color: 'var(--mute)', margin: '0 0 8px 4px' }}>Free Coach</div>
          <div style={PHONE} data-screen="free-coach"><CoachTeaser plan={{ weeks: Array.from({ length: 8 }, (_, i) => ({ n: i + 1, date: `2026-10-${String(19 + i * 7).padStart(2, '0')}`, sessions: {} })), meta: {} } as any} firstName="Russ" onUpgrade={() => {}} receipts={F.receipts} effortRuns={F.effortRuns} /></div></div>
        <div><div style={{ ...MICRO_LABELS.eyebrow, color: 'var(--mute)', margin: '0 0 8px 4px' }}>Upgrade, during the trial</div>
          <div style={PHONE} data-screen="upgrade"><UpgradeScreen onBack={() => {}} receipts={F.receipts} inTrial source="me" /></div></div>
      </div>
    </main>
  )
}
