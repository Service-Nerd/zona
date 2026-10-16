'use client'
// STRENGTH-APP-01 — dev-only harness for the strength surfaces, rendered from REAL engine
// output (the run harness plan + a generated strength plan placed around it). Strength is
// admin-only and behind auth, so without this page none of it can be looked at in a browser.

import { useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import TodayScreen from '@/components/dashboard/TodayScreen'
import StrengthSessionScreen from '@/components/dashboard/StrengthSessionScreen'
import StrengthSetupScreen from '@/components/dashboard/StrengthSetupScreen'
import PlanCalendar from '@/components/training/PlanCalendar'
import ScreenHeader from '@/components/ui/ScreenHeader'
import { Chip } from '@/components/shared/Chip'
import { STRENGTH_SCREEN_SUB, STRENGTH_TITLE } from '@/components/shared/meDoors'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'
import { generateStrengthPlan, type StrengthSession } from '@/packages/strength'
import type { Plan } from '@/types/plan'
import { isoLocalDate } from '@/lib/strength-bridge/display'

const plan = harnessPlanJson as unknown as Plan
// TodayScreen's optional handlers are not needed for a look; fixture props only.
const Today = TodayScreen as unknown as (p: Record<string, unknown>) => JSX.Element
const CASES = ['today', 'session', 'plan', 'setup'] as const

/** Shift the harness plan so its current week contains today, as a live runner's would. */
function livePlan(): Plan {
  const first = new Date(plan.weeks[0].date + 'T00:00:00')
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7)
  const shift = Math.round((monday.getTime() - first.getTime()) / 86_400_000)
  return { ...plan, weeks: plan.weeks.map(w => { const d = new Date(w.date + 'T00:00:00'); d.setDate(d.getDate() + shift); return { ...w, date: isoLocalDate(d) } }) }
}

export default function StrengthPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  const [c, setC] = useState<(typeof CASES)[number]>('today')
  const run = useMemo(livePlan, [])
  const strength = useMemo(() => {
    return generateStrengthPlan(
      { focus: 'running', session_minutes: 45, sessions_per_week: 3, equipment: ['dumbbells', 'bench', 'bands', 'box'], experience: 'some' },
      null, { standaloneStart: run.weeks[0].date },
    )
  }, [run])
  const byDate = useMemo(() => {
    const m: Record<string, StrengthSession> = {}
    for (const w of strength.weeks) for (const s of w.sessions) if (s.date) m[s.date] = s
    // Make sure TODAY carries one, so the Today case always shows strength.
    const today = isoLocalDate(new Date())
    if (!m[today]) { const any = strength.weeks[5].sessions.find(s => s.kind !== 'mobility')!; m[today] = { ...any, date: today } }
    return m
  }, [strength])
  const [completions, setCompletions] = useState<Record<string, 'done' | 'skipped'>>({})
  const setStatus = async (date: string, st: 'done' | 'skipped' | null) => {
    setCompletions(x => { const n = { ...x }; if (st) n[date] = st; else delete n[date]; return n }); return true
  }
  const todayS = byDate[isoLocalDate(new Date())]
  const strengthProp = { sessionsByDate: byDate, completions, onOpen: () => setC('session'), onSetStatus: setStatus }
  const weekIndex = run.weeks.findIndex(w => { const s = new Date(w.date + 'T00:00:00').getTime(); return Date.now() >= s && Date.now() < s + 7 * 86_400_000 })

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', maxWidth: '390px', margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '6px', padding: '8px', borderBottom: '1px solid var(--line)' }}>
        {CASES.map(k => <Chip key={k} label={k} active={c === k} onClick={() => setC(k)} />)}
      </div>
      {c === 'today' && (
        <Today plan={run} weekIndex={Math.max(0, weekIndex)} daysToRace={60} raceName="Brighton Half" preferredMetric="distance"
          sessionMetricOverrides={{}} stravaRuns={[]} allOverrides={[]} overridesReady allCompletions={{}} preferredUnits="km"
          zone2Ceiling={148} firstName="Sam" strength={strengthProp} />
      )}
      {c === 'session' && todayS && (
        <StrengthSessionScreen session={todayS} dayLabel="Today" weekN={todayS.week_n} status={completions[todayS.date!] ?? null}
          canLog onBack={() => setC('today')} onSetStatus={st => setStatus(todayS.date!, st)} />
      )}
      {c === 'plan' && (
        <PlanCalendar weeks={run.weeks} allOverrides={[]} allCompletions={{}} onOverrideChange={() => {}} onSessionTap={() => {}}
          strength={{ sessionsByDate: byDate, completions, onOpen: () => setC('session') }} />
      )}
      {c === 'setup' && (
        <>
          <ScreenHeader title={STRENGTH_TITLE} sub={STRENGTH_SCREEN_SUB} onBack={() => setC('today')} />
          <StrengthSetupScreen profile={null} planInjuries={['achilles']} planNotes={[]} onSave={async () => null} />
        </>
      )}
    </main>
  )
}
