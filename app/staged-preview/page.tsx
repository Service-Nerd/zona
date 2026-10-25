// LOCAL DESIGN HARNESS — 404s in production (guard below), not linked, not in the sitemap.
//
// NO-RUNNER-TURNED-AWAY-01. The founder asked whether the staged-plan SCREENS had been validated, and they had not: every
// check read code, none rendered a screen. These surfaces live behind auth and behind a server flag, so this page renders
// the REAL components with REAL engine output, generated here in the browser. What is stubbed: `/api/generate-plan`
// (answered with the engine's own staged plan for the wizard's answers) and the Supabase writes. Nothing is saved.

'use client'

import { useEffect, useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import GeneratePlanScreen from '@/app/dashboard/GeneratePlanScreen'
import TodayScreen from '@/components/dashboard/TodayScreen'
import PlanArc from '@/components/shared/PlanArc'
import StagedRaceBlockCard from '@/components/shared/StagedRaceBlockCard'
import PlanHeroMetrics from '@/components/shared/PlanHeroMetrics'
import FirstRunCard from '@/components/shared/FirstRunCard'
import { firstRunOfPlan as firstRunFor } from '@/lib/plan/firstRun'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { isDesignedRefusal } from '@/lib/plan/designedRefusal'
import { stagingDoorKm, generateStagedRacePlan, stagedRaceOf, stagedDisplay } from '@/lib/plan/stagedRacePlan'
import { evaluateCheckpoint } from '@/lib/plan/engine'
import { CHECKPOINT_THIS_WEEK_LINE, checkpointConsent, raceBlockTitle, raceBlockLineFor } from '@/lib/plan/checkpointCopy'
import { stagedHandoverCopy } from '@/lib/ui/handoverCopy'
import { planArcSeries } from '@/lib/plan/weekVolume'
import { phaseDisplayLabel } from '@/lib/coaching/weekVoice'
import type { GeneratorInput, Plan } from '@/types/plan'

const noop = () => {}
// Local date, not toISOString (UTC), which put the plan on a Sunday the first time this page was read.
const monday = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
const weeksFrom = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 7 * 864e5).toISOString().slice(0, 10)

/** What the route would do with the flag on: generate, and on a designed refusal the engine stages, stage. */
function stagedFor(input: GeneratorInput, planStart: string): Plan | null {
  try { return generateRulePlan(input, 'paid', planStart) } catch (e) {
    if (!isDesignedRefusal(e)) throw e
    const door = stagingDoorKm(e, input, planStart)
    return door === null ? null : generateStagedRacePlan(input, planStart, door)
  }
}

const RUNNER = {
  race_distance_km: 42.2, race_name: 'London Marathon', goal: 'finish', age: 34, injuries: [], fitness_level: 'beginner',
  training_age: '<6mo', user_declared_level: 'beginner', recent_quality_training: 'none',
  current_weekly_km: 5, longest_recent_run_km: 3, days_available: 3, race_date: weeksFrom(monday, 26),
} as unknown as GeneratorInput

function Case({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 700, color: 'var(--mute)', padding: '8px 16px' }}>
        {title}{note ? ` · ${note}` : ''}
      </div>
      <div style={{ width: 390, margin: '0 auto', border: '1px solid var(--line)', background: 'var(--bg)', minHeight: 200 }}>{children}</div>
    </section>
  )
}

export default function StagedPreview() {
  if (process.env.NODE_ENV === 'production') notFound()
  const [view, setView] = useState<'wizard' | 'today' | 'checkpoint' | 'consent' | 'plan'>('today')

  const plan = useMemo(() => stagedFor(RUNNER, monday)!, [])
  const s = stagedRaceOf(plan)!
  const d = stagedDisplay(plan)!

  // The wizard calls `/api/generate-plan`; answer it with the engine's staged plan for whatever was entered.
  useEffect(() => {
    const real = window.fetch
    window.fetch = async (url, init) => {
      if (String(url).includes('/api/generate-plan')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as GeneratorInput
        // The wizard's own answers, with the test runner's volume and race forced, so the preview is the staged one.
        const p = stagedFor({ ...body, current_weekly_km: 5, longest_recent_run_km: 3, race_distance_km: 42.2, race_date: RUNNER.race_date, goal: 'finish', fitness_level: 'beginner' } as GeneratorInput, monday)
        return new Response(JSON.stringify(p ? { plan: p } : { error: 'not staged' }), { status: p ? 200 : 422, headers: { 'content-type': 'application/json' } })
      }
      if (String(url).startsWith('/api/')) return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
      return real(url, init)
    }
    return () => { window.fetch = real }
  }, [])

  const lastIdx = plan.weeks.length - 1
  const cpDate = weeksFrom(monday, s.checkpoint_week)
  const short = Math.round(s.door_km * 0.9 * 10) / 10
  const loads = new Map(plan.weeks.map(w => [w.n, { linkedKm: short, offPlanKm: 0, totalKm: short, longestKm: short / 3 }]))
  const outcome = evaluateCheckpoint(RUNNER, plan, loads, 'km', cpDate)
  const consent = outcome.ok ? null : checkpointConsent(outcome.body, 'km')
  const series = planArcSeries(plan.weeks as never)
  const today = { plan, daysToRace: 26 * 7, raceName: d.raceName, preferredMetric: 'distance' as const,
    sessionMetricOverrides: {}, stravaRuns: [], allOverrides: [], overridesReady: true, allCompletions: {},
    preferredUnits: 'km' as const, zone2Ceiling: 148, onOpenSession: noop, hasPaidAccess: false }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-soft)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--card)', borderBottom: '1px solid var(--line)', padding: 10, display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: 'var(--font-ui)', fontSize: 13 }}>
        <strong>Staged plan harness</strong>
        {(['wizard', 'today', 'checkpoint', 'consent', 'plan'] as const).map(v => (
          <button key={v} data-view={v} onClick={() => setView(v)} style={{ fontWeight: view === v ? 700 : 400 }}>{v}</button>
        ))}
      </div>
      {view === 'wizard' && <Case title="Wizard → plan preview" note="real wizard; the generate call answered by the engine's staged plan">
        <GeneratePlanScreen preferredUnits="km" onBack={noop} hasPaidAccess onPlanSaved={async () => {}} />
      </Case>}
      {view === 'today' && <Case title="Today, week 1" note={`walk-run start; ${plan.weeks.length} base weeks, checkpoint w${s.checkpoint_week}`}>
        <TodayScreen {...(today as any)} weekIndex={0} />
      </Case>}
      {view === 'checkpoint' && <Case title="Today, checkpoint week" note="the checkpoint line, every tier">
        <TodayScreen {...(today as any)} weekIndex={lastIdx} checkpointLine={CHECKPOINT_THIS_WEEK_LINE} />
      </Case>}
      {view === 'consent' && <Case title="Today, after the checkpoint" note={`ran ${short} km/wk against ${s.door_km}`}>
        <TodayScreen {...(today as any)} weekIndex={lastIdx} handover={stagedHandoverCopy(s, d)} checkpointConsent={consent}
          onBuildRacePlan={noop} onDismissHandover={noop} onCheckpointOption={noop} />
      </Case>}
      {view === 'plan' && <Case title="Plan screen pieces" note="the arc with the race block outlined, and the race block card">
        <div style={{ padding: 16 }}>
          <PlanHeroMetrics plan={plan} units="km" canReshape={false} />
          <div style={{ height: 16 }} />
          {firstRunFor(plan.weeks) && <FirstRunCard {...firstRunFor(plan.weeks)!} />}
          <div style={{ height: 16 }} />
          <PlanArc totalWeeks={d.totalWeeks} currentWeek={1} doneWeeks={0} weekKm={series.km}
            weekPhase={series.phase.map(p => phaseDisplayLabel(p))} outline={{ weeks: d.raceWeeks, label: raceBlockTitle(s) }} />
          <div style={{ height: 16 }} />
          <StagedRaceBlockCard title={raceBlockTitle(s)} line={raceBlockLineFor(s, d.raceBlockStart)} />
        </div>
      </Case>}
    </div>
  )
}
