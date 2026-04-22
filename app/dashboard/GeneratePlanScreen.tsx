// TIER-DIVERGENT — FREE: 3-step wizard (race → fitness → schedule) → rule-engine plan; teaser card above CTA
//                  PAID/TRIAL: 4-step wizard adds terrain, injuries, hard sessions, training style → enriched plan
'use client'

import { useState, useEffect, useRef } from 'react'
import type { Plan, GeneratorInput } from '@/types/plan'
import GeneratingCeremony from '@/components/GeneratingCeremony'

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4
type AppStep = WizardStep | 'generating' | 'preview' | 'error'

const WIZARD_KEY = 'zona_wizard_draft'

// ─── Constants ────────────────────────────────────────────────────────────────

const DISTANCES = [
  { label: '5K',       value: 5,    paid: false },
  { label: '10K',      value: 10,   paid: false },
  { label: 'Half',     value: 21.1, paid: false },
  { label: 'Marathon', value: 42.2, paid: true  },
  { label: '50K',      value: 50,   paid: true  },
  { label: '100K',     value: 100,  paid: true  },
]

const BENCHMARK_DISTANCES = [
  { label: '5K',   value: 5    },
  { label: '10K',  value: 10   },
  { label: 'Half', value: 21.1 },
  { label: 'Full', value: 42.2 },
]

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KEYS   = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const INJURIES = ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis']

const SESSION_COLOURS: Record<string, string> = {
  easy:           'var(--session-easy)',
  run:            'var(--session-easy)',
  long:           'var(--session-long)',
  quality:        'var(--session-quality)',
  tempo:          'var(--session-quality)',
  intervals:      'var(--session-intervals)',
  hard:           'var(--session-intervals)',
  race:           'var(--session-race)',
  recovery:       'var(--session-recovery)',
  strength:       'var(--session-strength)',
  'cross-train':  'var(--session-cross)',
  cross:          'var(--session-cross)',
}

const STEP_META: Record<WizardStep, { title: string; subtitle: string }> = {
  1: { title: 'Your race.',          subtitle: 'Start with the finish line. Work backwards from there.' },
  2: { title: 'Be honest.',          subtitle: "The plan only works if these numbers are real. Flattering yourself here just means a harder race." },
  3: { title: 'Your schedule.',      subtitle: "Training has to fit your life. Not the other way around." },
  4: { title: 'A bit more detail.',  subtitle: "Terrain, injury history, training preferences. Skip what doesn't apply." },
}


function fmtDurationMins(mins: number): string {
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

// ─── Primitives ───────────────────────────────────────────────────────────────

function ChipToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 16px',
        borderRadius: '10px',
        border: `0.5px solid ${active ? 'var(--accent)' : 'var(--border-col)'}`,
        background: active ? 'var(--accent-soft)' : 'none',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontFamily: 'var(--font-ui)',
        fontSize: '13px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{
      fontFamily: 'var(--font-ui)',
      fontSize: '11px',
      color: 'var(--text-muted)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      {children}
      {optional && (
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, opacity: 0.7 }}>optional</span>
      )}
    </div>
  )
}

function StepInput({ value, onChange, placeholder, type = 'text', min, max }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; min?: number; max?: number
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        background: 'var(--input-bg)',
        border: '0.5px solid var(--border-col)',
        borderRadius: '10px',
        padding: '12px 14px',
        fontFamily: 'var(--font-ui)',
        fontSize: '15px',
        color: 'var(--text-primary)',
        outline: 'none',
      }}
    />
  )
}

// ─── Step progress bar ────────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: WizardStep; total: number }) {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '0 16px', marginBottom: '28px' }}>
      {Array.from({ length: total }, (_, i) => i + 1).map(n => (
        <div key={n} style={{
          flex: 1,
          height: '2px',
          borderRadius: '2px',
          background: n <= current ? 'var(--accent)' : 'var(--border-col)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )
}

// ─── Confidence badge (paid-only — only rendered when meta.confidence_score present) ─────

function ConfidenceBadge({ score, risks }: { score: number; risks?: string[] }) {
  const colour = score >= 7 ? 'var(--teal)' : 'var(--amber)'
  const label  = score >= 7 ? 'Good fit' : score >= 5 ? 'Possible' : 'Challenging'
  const desc   = score >= 7
    ? "Your fitness and timeline line up. This plan will stretch you without breaking you."
    : score >= 5
    ? "Achievable, but there's some stretch here. Stick to the easy days and it's yours."
    : "This is a big ask given your current base. You can do it — the plan will reflect that."

  return (
    <div style={{ textAlign: 'center', padding: '24px 0 20px' }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%',
        border: `2px solid ${colour}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 12px',
        background: `color-mix(in srgb, ${colour} 8%, transparent)`,
      }}>
        <span style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: colour }}>{score}</span>
      </div>
      <div style={{ fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600, color: colour, marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '280px', margin: '0 auto' }}>{desc}</div>
      {risks && risks.length > 0 && (
        <div style={{ marginTop: '14px', textAlign: 'left', padding: '12px 14px', background: 'var(--amber-soft)', borderRadius: '10px', border: '0.5px solid var(--amber-mid)' }}>
          {risks.map((r, i) => (
            <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '10px', position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, color: 'var(--amber)' }}>·</span>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Phase arc — one rep week per phase ───────────────────────────────────────

function PhaseArc({ weeks }: { weeks: Plan['weeks'] }) {
  const PHASES = ['base', 'build', 'peak', 'taper'] as const
  const phaseColour: Record<string, string> = {
    base: 'var(--session-easy)', build: 'var(--accent)', peak: 'var(--amber)', taper: 'var(--text-muted)'
  }

  const repWeeks = PHASES.map(phase => {
    const phaseWks = weeks.filter(w => w.phase === phase)
    if (!phaseWks.length) return null
    return { week: phaseWks[Math.floor(phaseWks.length / 2)], phase }
  }).filter(Boolean) as { week: Plan['weeks'][0]; phase: string }[]

  if (!repWeeks.length) {
    return <>{weeks.slice(0, 3).map(w => <WeekCard key={w.n} week={w} />)}</>
  }

  return (
    <>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
        Plan arc
      </div>
      {repWeeks.map(({ week, phase }) => (
        <WeekCard key={week.n} week={week} phaseLabel={phase} phaseColour={phaseColour[phase]} />
      ))}
    </>
  )
}

// ─── Week card (preview) ──────────────────────────────────────────────────────

function WeekCard({ week, phaseLabel, phaseColour }: {
  week: Plan['weeks'][0]
  phaseLabel?: string
  phaseColour?: string
}) {
  const sessionDays = Object.entries(week.sessions ?? {})

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: '12px',
      border: '0.5px solid var(--border-col)', padding: '14px 16px', marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {phaseLabel ? `${phaseLabel.charAt(0).toUpperCase()}${phaseLabel.slice(1)} phase` : `Week ${week.n}`}
            {' '}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '13px' }}>· W{week.n}</span>
          </div>
          {week.label && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {week.label}
            </div>
          )}
        </div>
        {phaseColour && phaseLabel && (
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: '10px', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: phaseColour,
            border: `0.5px solid ${phaseColour}`, borderRadius: '20px',
            padding: '2px 8px', flexShrink: 0, marginLeft: '8px',
          }}>
            {phaseLabel}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {sessionDays.map(([day, session]) => {
          if (!session || session.type === 'rest') return null
          const dot = SESSION_COLOURS[session.type] ?? 'var(--text-muted)'
          return (
            <div key={day} style={{
              fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-secondary)',
              background: 'var(--bg)', borderRadius: '6px', padding: '4px 8px',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ textTransform: 'capitalize' }}>{day}</span>
              {session.distance_km
                ? <span style={{ color: 'var(--text-muted)' }}>{session.distance_km}km</span>
                : session.duration_mins
                  ? <span style={{ color: 'var(--text-muted)' }}>{fmtDurationMins(Number(session.duration_mins))}</span>
                  : null}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--border-col)', display: 'flex', gap: '16px' }}>
        {week.weekly_km > 0 && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>{week.weekly_km} km</span>
        )}
        {week.long_run_hrs && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)' }}>Long {week.long_run_hrs}h</span>
        )}
        {week.badge && (
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{week.badge}</span>
        )}
      </div>
    </div>
  )
}

// ─── Teaser card (free users on Step 3) ──────────────────────────────────────
// Non-blocking upsell. Left teal accent = same visual language as session cards.
// Free path (generate anyway) is always visible as the primary CTA below.

function TeaserCard({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <button
      onClick={onUpgrade}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: 'var(--card-bg)', borderRadius: '12px',
        borderTop: '0.5px solid var(--border-col)',
        borderRight: '0.5px solid var(--border-col)',
        borderBottom: '0.5px solid var(--border-col)',
        borderLeft: '3px solid var(--teal)',
        padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
          Want a more personal plan?
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Terrain, injury history, training style. Your plan adapts around what matters to you.
        </div>
      </div>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--teal)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        Free trial →
      </span>
    </button>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GeneratePlanScreen({
  onBack,
  firstName,
  lastName,
  restingHR: initialRHR,
  onPlanSaved,
  isOnboarding = false,
  hasExistingPlan = false,
  hasPaidAccess = true,
  onUpgrade,
}: {
  onBack: () => void
  firstName?: string
  lastName?: string
  restingHR?: number | null
  onPlanSaved?: (plan: Plan) => Promise<void>
  isOnboarding?: boolean
  hasExistingPlan?: boolean
  hasPaidAccess?: boolean
  onUpgrade?: () => void
}) {
  const lastStep: WizardStep = hasPaidAccess ? 4 : 3
  const totalSteps = hasPaidAccess ? 4 : 3

  const [appStep, setAppStep]   = useState<AppStep>(1)
  const [error, setError]       = useState<string | null>(null)
  const [plan, setPlan]         = useState<Plan | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Step 1 — Race
  const [raceName, setRaceName]     = useState('')
  const [raceDate, setRaceDate]     = useState('')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [goal, setGoal]             = useState<'finish' | 'time_target' | null>(null)
  const [targetTime, setTargetTime] = useState('')

  // Step 2 — Fitness
  const [age, setAge]             = useState('')
  const [weeklyKm, setWeeklyKm]   = useState('')
  const [longestRun, setLongestRun] = useState('')
  // Benchmark — optional, enables VDOT-derived paces
  const [benchmarkType, setBenchmarkType] = useState<'race' | 'tt_30min' | null>(null)
  const [benchmarkDistKm, setBenchmarkDistKm] = useState<number | null>(null)
  const [benchmarkTime, setBenchmarkTime] = useState('')
  const [benchmarkTTDist, setBenchmarkTTDist] = useState('')

  // Step 3 — Schedule
  const [daysAvailable, setDaysAvailable] = useState<number | null>(null)
  const [daysOff, setDaysOff]             = useState<string[]>([])
  const [maxWeekday, setMaxWeekday]       = useState('')

  // Step 4 — Profile (all optional, paid/trial only)
  const [restingHR, setRestingHR] = useState(initialRHR ? String(initialRHR) : '')
  const [terrain, setTerrain]     = useState<string | null>(null)
  const [hardSessions, setHardSessions]   = useState<string | null>(null)
  const [trainingStyle, setTrainingStyle] = useState<string | null>(null)
  const [injuries, setInjuries]           = useState<string[]>([])

  // Pre-fill resting HR from profile if it arrives after mount
  useEffect(() => {
    if (initialRHR && !restingHR) setRestingHR(String(initialRHR))
  }, [initialRHR])

  // Restore wizard draft from sessionStorage on mount (survives back-navigation and upgrade flow)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(WIZARD_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (typeof s.appStep === 'number' && s.appStep >= 1 && s.appStep <= 4) setAppStep(s.appStep as WizardStep)
      if (s.raceName)                  setRaceName(s.raceName)
      if (s.raceDate)                  setRaceDate(s.raceDate)
      if (s.distanceKm != null)        setDistanceKm(s.distanceKm)
      if (s.goal)                      setGoal(s.goal)
      if (s.targetTime)                setTargetTime(s.targetTime)
      if (s.age)                       setAge(s.age)
      if (s.weeklyKm)                  setWeeklyKm(s.weeklyKm)
      if (s.longestRun)                setLongestRun(s.longestRun)
      if (s.benchmarkType)             setBenchmarkType(s.benchmarkType)
      if (s.benchmarkDistKm != null)   setBenchmarkDistKm(s.benchmarkDistKm)
      if (s.benchmarkTime)             setBenchmarkTime(s.benchmarkTime)
      if (s.benchmarkTTDist)           setBenchmarkTTDist(s.benchmarkTTDist)
      if (s.daysAvailable != null)     setDaysAvailable(s.daysAvailable)
      if (s.daysOff)                   setDaysOff(s.daysOff)
      if (s.maxWeekday)                setMaxWeekday(s.maxWeekday)
      if (s.terrain)                   setTerrain(s.terrain)
      if (s.hardSessions)              setHardSessions(s.hardSessions)
      if (s.trainingStyle)             setTrainingStyle(s.trainingStyle)
      if (s.injuries)                  setInjuries(s.injuries)
    } catch {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist wizard draft to sessionStorage on every form change
  useEffect(() => {
    if (typeof appStep !== 'number') return // don't save transient states
    try {
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({
        appStep, raceName, raceDate, distanceKm, goal, targetTime,
        age, weeklyKm, longestRun,
        benchmarkType, benchmarkDistKm, benchmarkTime, benchmarkTTDist,
        daysAvailable, daysOff, maxWeekday,
        terrain, hardSessions, trainingStyle, injuries,
      }))
    } catch {}
  }, [appStep, raceName, raceDate, distanceKm, goal, targetTime,
      age, weeklyKm, longestRun,
      benchmarkType, benchmarkDistKm, benchmarkTime, benchmarkTTDist,
      daysAvailable, daysOff, maxWeekday,
      terrain, hardSessions, trainingStyle, injuries])

  // ── Step validation ──────────────────────────────────────────────────────────

  function step1Valid() {
    return raceDate !== '' && distanceKm !== null && goal !== null && (goal !== 'time_target' || targetTime !== '')
  }
  function step2Valid() {
    return age !== '' && Number(age) >= 14 && Number(age) <= 90 && weeklyKm !== '' && longestRun !== ''
  }
  function step3Valid() {
    return daysAvailable !== null
  }
  // Step 4 is always valid (all optional)

  function canProceed() {
    if (appStep === 1) return step1Valid()
    if (appStep === 2) return step2Valid()
    if (appStep === 3) return step3Valid()
    return true
  }

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function goNext() {
    if (appStep === lastStep) {
      void handleGenerate()
    } else if (typeof appStep === 'number' && appStep < lastStep) {
      setAppStep((appStep + 1) as WizardStep)
    }
  }

  function goBack() {
    if (appStep === 1 || appStep === 'error') {
      onBack()
    } else if (appStep === 'preview') {
      setAppStep(lastStep)
    } else if (typeof appStep === 'number' && appStep > 1) {
      setAppStep((appStep - 1) as WizardStep)
    }
  }

  async function handleGenerate() {
    setAppStep('generating')
    setError(null)
    setPlan(null)   // reset so ceremony starts in loading phase

    const benchmark = (() => {
      if (benchmarkType === 'race' && benchmarkDistKm && benchmarkTime) {
        return { type: 'race' as const, distance_km: benchmarkDistKm, time: benchmarkTime }
      }
      if (benchmarkType === 'tt_30min' && benchmarkTTDist) {
        return { type: 'tt_30min' as const, distance_km: Number(benchmarkTTDist), time: '30:00' }
      }
      return undefined
    })()

    const input: GeneratorInput = {
      race_date:             raceDate,
      race_distance_km:      distanceKm!,
      race_name:             raceName || undefined,
      goal:                  goal!,
      target_time:           goal === 'time_target' ? targetTime : undefined,
      age:                   Number(age),
      current_weekly_km:     Number(weeklyKm),
      longest_recent_run_km: Number(longestRun),
      days_available:        daysAvailable!,
      resting_hr:            restingHR ? Number(restingHR) : undefined,
      benchmark,
      days_cannot_train:     daysOff.length ? daysOff : undefined,
      max_weekday_mins:      maxWeekday ? Number(maxWeekday) : undefined,
      // Step 4 fields — paid/trial only
      training_style:            hasPaidAccess ? (trainingStyle as GeneratorInput['training_style'] ?? undefined) : undefined,
      hard_session_relationship: hasPaidAccess ? (hardSessions as GeneratorInput['hard_session_relationship'] ?? undefined) : undefined,
      injury_history:            hasPaidAccess && injuries.length ? injuries.map(i => i.toLowerCase()) : undefined,
      terrain:                   hasPaidAccess ? (terrain as GeneratorInput['terrain'] ?? undefined) : undefined,
    }

    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setAppStep('error')
        return
      }
      setPlan(data.plan)
      // Ceremony handles the transition to 'preview' via onRevealComplete
    } catch {
      setError('Could not reach the server. Check your connection.')
      setAppStep('error')
    }
  }

  async function handleUsePlan() {
    if (!plan || !onPlanSaved) return
    setIsSaving(true)
    try {
      await onPlanSaved(plan)
      sessionStorage.removeItem(WIZARD_KEY)
    } catch {
      setIsSaving(false)
    }
  }

  // ── Generating ceremony ──────────────────────────────────────────────────────

  if (appStep === 'generating') {
    return (
      <GeneratingCeremony
        hasPaidAccess={hasPaidAccess}
        plan={plan}
        onRevealComplete={() => setAppStep('preview')}
      />
    )
  }

  // ── Error screen ─────────────────────────────────────────────────────────────

  if (appStep === 'error') {
    return (
      <div style={{ padding: '16px' }}>
        <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '8px 0 20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px' }}>Back</span>
        </button>

        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--amber)', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 500, color: 'var(--amber)', marginBottom: '8px' }}>
            Could not generate plan
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {error}
          </div>
        </div>

        <button onClick={() => setAppStep(lastStep)} style={{
          width: '100%', padding: '14px', borderRadius: '12px',
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 500,
          color: 'var(--zona-navy)',
        }}>
          Try again
        </button>
      </div>
    )
  }

  // ── Preview screen ───────────────────────────────────────────────────────────

  if (appStep === 'preview' && plan) {
    const { meta, weeks } = plan

    return (
      <div style={{ paddingBottom: '40px' }}>
        <div style={{ padding: '16px 16px 0' }}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px' }}>Adjust inputs</span>
          </button>
        </div>

        <div style={{ padding: '0 16px' }}>
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              {meta.race_name || 'Your plan'}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {weeks.length} weeks · starts {meta.plan_start} · {meta.race_distance_km}km
            </div>
          </div>

          {/* Confidence badge — paid-only; absent on free plans (INV-PLAN-008) */}
          {meta.confidence_score != null && (
            <div style={{ background: 'var(--card-bg)', borderRadius: '14px', border: '0.5px solid var(--border-col)', padding: '4px 16px 20px', margin: '16px 0' }}>
              <ConfidenceBadge score={meta.confidence_score} risks={meta.confidence_risks} />
            </div>
          )}

          {/* Coach intro — paid-only */}
          {meta.coach_intro && (
            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', borderLeft: '3px solid var(--teal)', padding: '14px 16px', margin: '16px 0' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                {meta.coach_intro}
              </div>
            </div>
          )}

          <div style={{ margin: '20px 0 0' }}>
            <PhaseArc weeks={weeks} />
          </div>

          {weeks.length > 4 && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0 16px' }}>
              + {weeks.length - Math.min(4, weeks.length)} more weeks in your plan
            </div>
          )}
        </div>

        {/* Actions — sticky bottom */}
        <div style={{
          position: 'sticky', bottom: 0,
          background: 'var(--bg)',
          borderTop: '0.5px solid var(--border-col)',
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        }}>
          {hasExistingPlan && !isSaving && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '8px' }}>
              This replaces your current plan.
            </div>
          )}
          {onPlanSaved ? (
            <button
              onClick={handleUsePlan}
              disabled={isSaving}
              style={{
                width: '100%', padding: '15px', borderRadius: '12px',
                background: isSaving ? 'var(--accent-dim)' : 'var(--accent)',
                border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 600,
                color: isSaving ? 'var(--accent)' : 'var(--zona-navy)',
                transition: 'all 0.15s',
              }}
            >
              {isSaving ? 'Saving…' : 'Use this plan'}
            </button>
          ) : (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Plan preview — save is not available in this context
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Wizard form ──────────────────────────────────────────────────────────────

  const currentStep = appStep as WizardStep
  const stepMeta = currentStep === 1 && isOnboarding
    ? { title: 'Welcome to Zona.', subtitle: "Let's build your plan. Start with the finish line." }
    : STEP_META[currentStep]

  const ctaLabel = currentStep === lastStep ? 'Generate my plan' : 'Continue'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <button onClick={goBack} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 0,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px' }}>
              {currentStep === 1 ? 'Back' : `Step ${currentStep - 1}`}
            </span>
          </button>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            {currentStep} / {totalSteps}
          </span>
        </div>

        <StepProgress current={currentStep} total={totalSteps} />

        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '6px' }}>
            {stepMeta.title}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {stepMeta.subtitle}
          </div>
        </div>
      </div>

      {/* Form body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 24px' }}>

        {/* ── Step 1: Race ── */}
        {currentStep === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <FieldLabel optional>Race name</FieldLabel>
              <StepInput value={raceName} onChange={setRaceName} placeholder="e.g. London Marathon" />
            </div>

            <div>
              <FieldLabel>Race date</FieldLabel>
              <StepInput type="date" value={raceDate} onChange={setRaceDate} />
            </div>

            <div>
              <FieldLabel>Distance</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {DISTANCES.map(d => {
                  const locked = d.paid && !hasPaidAccess
                  const active = distanceKm === d.value
                  return (
                    <button
                      key={d.value}
                      onClick={() => locked ? onUpgrade?.() : setDistanceKm(d.value)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: '10px',
                        border: `0.5px solid ${active ? 'var(--accent)' : locked ? 'var(--border-col)' : 'var(--border-col)'}`,
                        background: active ? 'var(--accent-soft)' : 'none',
                        color: active ? 'var(--accent)' : locked ? 'var(--text-muted)' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        opacity: locked ? 0.6 : 1,
                      }}
                    >
                      {d.label}
                      {locked && (
                        <span style={{ fontSize: '10px', color: 'var(--teal)', letterSpacing: '0.04em' }}>
                          PAID
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {!hasPaidAccess && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Marathon and longer require a paid plan. <button onClick={onUpgrade} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontFamily: 'var(--font-ui)', fontSize: '11px', cursor: 'pointer', padding: 0 }}>Start free trial →</button>
                </div>
              )}
            </div>

            <div>
              <FieldLabel>Goal</FieldLabel>
              <div style={{ display: 'flex', gap: '8px' }}>
                <ChipToggle label="Just finish" active={goal === 'finish'} onClick={() => setGoal('finish')} />
                <ChipToggle label="Target time" active={goal === 'time_target'} onClick={() => setGoal('time_target')} />
              </div>
            </div>

            {goal === 'time_target' && (
              <div>
                <FieldLabel>Target time</FieldLabel>
                <StepInput value={targetTime} onChange={setTargetTime} placeholder="e.g. 4:30:00" />
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Fitness ── */}
        {currentStep === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <FieldLabel>Age</FieldLabel>
              <StepInput type="number" value={age} onChange={setAge} placeholder="32" min={14} max={90} />
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Used to calculate your max heart rate and training zones.
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <FieldLabel>Avg weekly km — last 4 weeks</FieldLabel>
                <StepInput type="number" value={weeklyKm} onChange={setWeeklyKm} placeholder="35" min={0} />
              </div>
              <div>
                <FieldLabel>Longest run — last 6 weeks (km)</FieldLabel>
                <StepInput type="number" value={longestRun} onChange={setLongestRun} placeholder="18" min={0} />
              </div>
            </div>

            {/* Benchmark — optional, enables VDOT-derived paces */}
            <div>
              <FieldLabel optional>Recent benchmark</FieldLabel>
              <div style={{
                background: 'var(--card-bg)', borderRadius: '12px',
                border: '0.5px solid var(--border-col)', padding: '14px 16px',
              }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
                  A recent race time or time trial gives us precise pace targets for every session. Without one we use population estimates — still works, less personal.
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <ChipToggle
                    label="Recent race result"
                    active={benchmarkType === 'race'}
                    onClick={() => setBenchmarkType(benchmarkType === 'race' ? null : 'race')}
                  />
                  <ChipToggle
                    label="30-min time trial"
                    active={benchmarkType === 'tt_30min'}
                    onClick={() => setBenchmarkType(benchmarkType === 'tt_30min' ? null : 'tt_30min')}
                  />
                </div>

                {benchmarkType === 'race' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <FieldLabel>Race distance</FieldLabel>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {BENCHMARK_DISTANCES.map(d => (
                          <ChipToggle
                            key={d.value}
                            label={d.label}
                            active={benchmarkDistKm === d.value}
                            onClick={() => setBenchmarkDistKm(d.value)}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Finish time</FieldLabel>
                      <StepInput
                        value={benchmarkTime}
                        onChange={setBenchmarkTime}
                        placeholder="e.g. 25:30 or 1:52:00"
                      />
                    </div>
                  </div>
                )}

                {benchmarkType === 'tt_30min' && (
                  <div>
                    <FieldLabel>Distance covered in 30 minutes (km)</FieldLabel>
                    <StepInput
                      type="number"
                      value={benchmarkTTDist}
                      onChange={setBenchmarkTTDist}
                      placeholder="e.g. 5.2"
                      min={1}
                    />
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                      Run as far as you can in exactly 30 minutes on a flat surface. Record the distance.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Schedule ── */}
        {currentStep === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <FieldLabel>How many days can you run each week?</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[2,3,4,5,6].map(n => (
                  <ChipToggle key={n} label={`${n} days`} active={daysAvailable === n} onClick={() => setDaysAvailable(n)} />
                ))}
              </div>
            </div>

            <div>
              <FieldLabel optional>Days you can never train</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {DAYS_SHORT.map((d, i) => {
                  const key = DAY_KEYS[i]
                  const active = daysOff.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => setDaysOff(prev => active ? prev.filter(x => x !== key) : [...prev, key])}
                      style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        border: `0.5px solid ${active ? 'var(--teal)' : 'var(--border-col)'}`,
                        background: active ? 'var(--accent-soft)' : 'none',
                        color: active ? 'var(--teal)' : 'var(--text-secondary)',
                        fontFamily: 'var(--font-ui)', fontSize: '12px',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <FieldLabel optional>Max weekday session length (mins)</FieldLabel>
              <StepInput type="number" value={maxWeekday} onChange={setMaxWeekday} placeholder="90" min={30} max={180} />
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Leave blank for no limit. Applies Monday–Friday only.
              </div>
            </div>

            {/* Teaser — free users only, non-blocking upsell to Step 4 personalisation */}
            {!hasPaidAccess && onUpgrade && (
              <TeaserCard onUpgrade={onUpgrade} />
            )}
          </div>
        )}

        {/* ── Step 4: Profile + Generate (paid/trial only) ── */}
        {currentStep === 4 && hasPaidAccess && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <FieldLabel optional>Resting heart rate</FieldLabel>
              <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', padding: '14px 16px', marginBottom: '4px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
                  Refines your Zone 2 ceiling via the Karvonen formula. Check your wearable's overnight average, or measure first thing in the morning before getting up. Skip if you don't know it.
                </div>
                <StepInput type="number" value={restingHR} onChange={setRestingHR} placeholder="e.g. 52" min={30} max={100} />
              </div>
              {initialRHR && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--teal)', marginTop: '4px' }}>
                  Pre-filled from your profile
                </div>
              )}
            </div>

            <div>
              <FieldLabel optional>Terrain preference</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(['road', 'trail', 'mixed'] as const).map(t => (
                  <ChipToggle key={t} label={t.charAt(0).toUpperCase() + t.slice(1)} active={terrain === t} onClick={() => setTerrain(t)} />
                ))}
              </div>
            </div>

            <div>
              <FieldLabel optional>Hard sessions</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {([
                  { value: 'avoid',   label: 'Avoid them' },
                  { value: 'neutral', label: 'Fine either way' },
                  { value: 'love',    label: 'Bring it on' },
                  { value: 'overdo',  label: 'I overdo it' },
                ] as const).map(o => (
                  <ChipToggle key={o.value} label={o.label} active={hardSessions === o.value} onClick={() => setHardSessions(o.value)} />
                ))}
              </div>
            </div>

            <div>
              <FieldLabel optional>Training style</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {([
                  { value: 'predictable', label: 'Predictable' },
                  { value: 'variety',     label: 'Variety' },
                  { value: 'minimalist',  label: 'Minimalist' },
                  { value: 'structured',  label: 'Structured' },
                ] as const).map(o => (
                  <ChipToggle key={o.value} label={o.label} active={trainingStyle === o.value} onClick={() => setTrainingStyle(o.value)} />
                ))}
              </div>
            </div>

            <div>
              <FieldLabel optional>Injury history</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {INJURIES.map(inj => (
                  <ChipToggle
                    key={inj}
                    label={inj}
                    active={injuries.includes(inj)}
                    onClick={() => setInjuries(prev => prev.includes(inj) ? prev.filter(x => x !== inj) : [...prev, inj])}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CTA — sticky bottom */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        borderTop: '0.5px solid var(--border-col)',
        background: 'var(--bg)',
      }}>
        <button
          onClick={goNext}
          disabled={!canProceed()}
          style={{
            width: '100%', padding: '15px', borderRadius: '12px',
            background: canProceed() ? 'var(--accent)' : 'var(--accent-dim)',
            border: 'none', cursor: canProceed() ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-brand)', fontSize: '15px', fontWeight: 600,
            color: canProceed() ? 'var(--zona-navy)' : 'var(--accent)',
            transition: 'all 0.15s',
          }}
        >
          {ctaLabel}
        </button>

        {!canProceed() && currentStep === 1 && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
            Date, distance, and goal are required
          </div>
        )}
      </div>
    </div>
  )
}
