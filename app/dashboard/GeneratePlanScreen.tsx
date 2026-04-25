// TIER-DIVERGENT — FREE:  8-step wizard (distance → race → goal → fitness → benchmark → schedule → constraints)
//                  PAID:  11-step wizard adds hard-sessions → terrain → injuries
// One decision per screen. Slide transitions between steps.
'use client'

import { useState, useEffect } from 'react'
import type { Plan, GeneratorInput, TrainingAge } from '@/types/plan'
import GeneratingCeremony from '@/components/GeneratingCeremony'
import { BRAND } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardSubStep =
  | 'distance' | 'race-details' | 'goal' | 'target-time'
  | 'fitness' | 'benchmark' | 'schedule' | 'constraints'
  | 'hard-sessions' | 'terrain' | 'injuries'

type AppStep = WizardSubStep | 'generating' | 'preview' | 'error'

const WIZARD_KEY = 'zona_wizard_draft'

// ─── Constants ────────────────────────────────────────────────────────────────

const DISTANCES = [
  { label: '5K',       sub: '5 km',    value: 5,    paid: false },
  { label: '10K',      sub: '10 km',   value: 10,   paid: false },
  { label: 'Half',     sub: '21.1 km', value: 21.1, paid: false },
  { label: 'Marathon', sub: '42.2 km', value: 42.2, paid: true  },
  { label: '50K',      sub: '50 km',   value: 50,   paid: true  },
  { label: '100K',     sub: '100 km',  value: 100,  paid: true  },
]

const BENCHMARK_DISTANCES = [
  { label: '5K',   value: 5    },
  { label: '10K',  value: 10   },
  { label: 'Half', value: 21.1 },
  { label: 'Full', value: 42.2 },
]

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KEYS   = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const INJURIES   = ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis']

const WEEKLY_KM_CHIPS = [
  { label: 'Under 20', value: 15  },
  { label: '20–40',    value: 30  },
  { label: '40–60',    value: 50  },
  { label: '60–80',    value: 70  },
  { label: '80–100',   value: 90  },
  { label: '100+',     value: 115 },
] as const

const LONGEST_RUN_CHIPS = [
  { label: 'Under 10km', value: 7  },
  { label: '10–15km',    value: 12 },
  { label: '15–20km',    value: 18 },
  { label: '20–30km',    value: 25 },
  { label: '30–40km',    value: 35 },
  { label: '40+km',      value: 45 },
] as const

const MAX_WEEKDAY_CHIPS: { label: string; value: number | undefined }[] = [
  { label: '30 min',   value: 30        },
  { label: '45 min',   value: 45        },
  { label: '60 min',   value: 60        },
  { label: '90 min',   value: 90        },
  { label: '2 hrs',    value: 120       },
  { label: '3 hrs',    value: 180       },
  { label: 'No limit', value: undefined },
]

const TRAINING_AGE_CHIPS: { label: string; value: TrainingAge }[] = [
  { label: '< 6 months',   value: '<6mo'   },
  { label: '6–18 months',  value: '6-18mo' },
  { label: '2–5 years',    value: '2-5yr'  },
  { label: '5+ years',     value: '5yr+'   },
]

const STEP_META: Record<WizardSubStep, { title: string; subtitle: string; optional?: boolean }> = {
  'distance':        { title: 'How far?',              subtitle: 'Start with the finish line. Work backwards from there.' },
  'race-details':    { title: 'Tell me about the race.', subtitle: 'Race name is optional. The date is not.' },
  'goal':            { title: 'What matters most?',    subtitle: 'Crossing the line, or hitting a number. Both are valid.' },
  'target-time':     { title: "What's the target?",    subtitle: "Be honest. Optimistic goals make bad training plans." },
  'fitness':         { title: 'Be honest.',             subtitle: "The plan only works if these numbers are real. Flattering yourself here just means a harder race." },
  'benchmark':       { title: 'Recent race result?',   subtitle: 'Gives us precise pace targets for every session. Skip if you haven\'t raced lately.', optional: true },
  'schedule':        { title: 'Your schedule.',         subtitle: "Training has to fit your life. Not the other way around." },
  'constraints':     { title: 'Any hard limits?',       subtitle: 'Days you can never train, or a max time on weekdays. Skip if you\'re flexible.', optional: true },
  'hard-sessions':   { title: 'You and hard sessions.', subtitle: 'Intervals, tempo, threshold. Where do you land?' },
  'terrain':         { title: 'Where do you run?',      subtitle: 'Road, trail, or a bit of both. Affects pace targets.' },
  'injuries':        { title: 'Anything to flag?',      subtitle: 'Old injuries that still show up. Skip if you\'re clean.', optional: true },
}

// ─── Step sequence ────────────────────────────────────────────────────────────

function getStepSequence(hasPaidAccess: boolean, goal: 'finish' | 'time_target' | null): WizardSubStep[] {
  const steps: WizardSubStep[] = ['distance', 'race-details', 'goal']
  if (goal === 'time_target') steps.push('target-time')
  steps.push('fitness', 'benchmark', 'schedule', 'constraints')
  if (hasPaidAccess) steps.push('hard-sessions', 'terrain', 'injuries')
  return steps
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginBottom: '24px' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          height: '5px',
          borderRadius: '3px',
          width: i === current ? '20px' : '5px',
          background: i <= current ? 'var(--moss)' : 'var(--line-strong)',
          transition: 'all 0.25s ease',
          flexShrink: 0,
        }} />
      ))}
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function WizardInput({ value, onChange, placeholder, type = 'text', min, max }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: string; min?: number; max?: number
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
        width: '100%', boxSizing: 'border-box',
        background: 'var(--bg-soft)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)', padding: '14px 16px',
        fontFamily: 'var(--font-ui)', fontSize: '17px',
        color: 'var(--ink)', outline: 'none',
      }}
    />
  )
}

function FieldNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '8px' }}>
      {children}
    </div>
  )
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      {children}
      {optional && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.7, fontSize: '10px' }}>optional</span>}
    </div>
  )
}

// Large card-style option (used for goal, hard-sessions, terrain)
function OptionCard({ label, sub, active, onClick, locked, lockLabel }: {
  label: string; sub?: string; active: boolean; onClick: () => void
  locked?: boolean; lockLabel?: string
}) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '18px 20px',
        borderRadius: 'var(--radius-lg)',
        border: `1.5px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
        background: active ? 'var(--moss-soft)' : 'var(--card)',
        cursor: locked ? 'default' : 'pointer',
        transition: 'all 0.15s',
        opacity: locked ? 0.5 : 1,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}
    >
      <div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', fontWeight: active ? 700 : 500, color: active ? 'var(--moss)' : 'var(--ink)', marginBottom: sub ? '4px' : 0 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.45 }}>
            {sub}
          </div>
        )}
      </div>
      {lockLabel && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.08em', marginTop: '2px', flexShrink: 0 }}>{lockLabel}</span>}
    </button>
  )
}

// Compact chip toggle (used for benchmark distances, days-off circles)
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '10px 18px', borderRadius: 'var(--radius-md)',
        border: `1px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
        background: active ? 'var(--moss-soft)' : 'var(--card)',
        color: active ? 'var(--moss)' : 'var(--ink-2)',
        fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ─── DurationPicker — stepper for hours + minutes ────────────────────────────

function DurationPicker({ hours, mins, onHoursChange, onMinsChange, maxHours = 23 }: {
  hours: number; mins: number
  onHoursChange: (v: number) => void; onMinsChange: (v: number) => void
  maxHours?: number
}) {
  const btnStyle: React.CSSProperties = {
    width: '44px', height: '44px', borderRadius: '8px',
    border: '1px solid var(--line)', background: 'none',
    cursor: 'pointer', color: 'var(--ink-2)',
    fontFamily: 'var(--font-ui)', fontSize: '20px', lineHeight: 1,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const valStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '30px', fontWeight: 600,
    color: 'var(--ink)', minWidth: '52px', textAlign: 'center', lineHeight: 1,
  }
  const unitStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <button style={btnStyle} onClick={() => onHoursChange(Math.min(maxHours, hours + 1))}>+</button>
        <div style={valStyle}>{hours}</div>
        <div style={unitStyle}>hrs</div>
        <button style={btnStyle} onClick={() => onHoursChange(Math.max(0, hours - 1))}>−</button>
      </div>
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', color: 'var(--mute)', fontWeight: 300, paddingBottom: '20px' }}>:</span>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <button style={btnStyle} onClick={() => onMinsChange(mins === 59 ? 0 : mins + 1)}>+</button>
        <div style={valStyle}>{String(mins).padStart(2, '0')}</div>
        <div style={unitStyle}>min</div>
        <button style={btnStyle} onClick={() => onMinsChange(mins === 0 ? 59 : mins - 1)}>−</button>
      </div>
    </div>
  )
}

// Preview components — plan arc + week card
const PHASES = ['base', 'build', 'peak', 'taper'] as const

function PhaseArc({ weeks }: { weeks: Plan['weeks'] }) {
  const phaseColour: Record<string, string> = {
    base: 'var(--s-easy)', build: 'var(--s-quality)', peak: 'var(--s-inter)', taper: 'var(--s-recov)',
  }
  const repWeeks = PHASES.map(phase => {
    const phaseWks = weeks.filter(w => w.phase === phase)
    if (!phaseWks.length) return null
    return { week: phaseWks[Math.floor(phaseWks.length / 2)], phase }
  }).filter(Boolean) as { week: Plan['weeks'][0]; phase: string }[]

  if (!repWeeks.length) return null

  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', overflowX: 'auto' }}>
      {repWeeks.map(({ week, phase }) => (
        <WeekCard key={week.n} week={week} phaseLabel={phase} phaseColour={phaseColour[phase]} />
      ))}
    </div>
  )
}

function WeekCard({ week, phaseLabel, phaseColour }: {
  week: Plan['weeks'][0]; phaseLabel?: string; phaseColour?: string
}) {
  const sessions = Object.values(week.sessions).filter(Boolean)
  return (
    <div style={{ background: 'var(--card)', borderRadius: '12px', border: '1px solid var(--line)', padding: '14px 16px', minWidth: '140px', flex: '1 1 140px' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginBottom: '8px' }}>
        Week {week.n} · {week.weekly_km ?? '—'}km
      </div>
      {phaseLabel && phaseColour && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: phaseColour, textTransform: 'uppercase', letterSpacing: '0.08em', border: `1px solid ${phaseColour}`, borderRadius: '20px', padding: '2px 8px', display: 'inline-block', marginBottom: '8px' }}>
          {phaseLabel}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sessions.slice(0, 3).map((s: any, i: number) => (
          <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--ink-2)', lineHeight: 1.4 }}>
            {s.label ?? s.type}
          </div>
        ))}
        {sessions.length > 3 && (
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>
            +{sessions.length - 3} more
          </div>
        )}
      </div>
    </div>
  )
}

function ConfidenceBadge({ score, risks }: { score: number; risks?: string[] }) {
  const colour = score >= 80 ? 'var(--moss)' : score >= 60 ? 'var(--warn)' : 'var(--danger)'
  const label  = score >= 80 ? 'High confidence' : score >= 60 ? 'Moderate confidence' : 'Lower confidence'
  return (
    <div style={{ paddingTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 800, color: colour }}>{score}</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: colour }}>{label}</span>
      </div>
      {risks?.length ? (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.55 }}>
          {risks.join(' · ')}
        </div>
      ) : null}
    </div>
  )
}

// Teaser card shown to free users on the last free step
function TeaserCard({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <div style={{ background: 'var(--warn-bg)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', marginTop: '24px' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--warn)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
        Unlock more personalisation
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coach-ink)', lineHeight: 1.55, marginBottom: '14px' }}>
        Add terrain, injury history, hard session preferences, and training style. Your plan adapts to you — not a template.
      </div>
      <button
        onClick={onUpgrade}
        style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 600, color: 'var(--warn)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        Upgrade to personalise →
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GeneratePlanScreen({
  onBack, firstName: _firstName, lastName: _lastName, restingHR: initialRHR, maxHR: initialMHR,
  dob: initialDob, onDobSave, onPlanSaved, isOnboarding, hasExistingPlan, hasPaidAccess, onUpgrade,
}: {
  onBack: () => void
  firstName?: string
  lastName?: string
  restingHR?: number | null
  maxHR?: number | null
  dob?: string | null
  onDobSave?: (dob: string) => Promise<void>
  onPlanSaved?: (plan: Plan) => Promise<void>
  isOnboarding?: boolean
  hasExistingPlan?: boolean
  hasPaidAccess?: boolean
  onUpgrade?: () => void
}) {
  // ── App-level step state ──────────────────────────────────────────────────
  const [appStep, setAppStep]   = useState<AppStep>('distance')
  const [plan, setPlan]         = useState<Plan | null>(null)
  const [error, setError]       = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // ── Animation state ───────────────────────────────────────────────────────
  const [visible, setVisible]     = useState(true)
  const [slideFrom, setSlideFrom] = useState<'right' | 'left'>('right')

  // ── Step 1 — Distance ─────────────────────────────────────────────────────
  const [distanceKm, setDistanceKm] = useState<number | null>(null)

  // ── Step 2 — Race details ─────────────────────────────────────────────────
  const [raceName, setRaceName] = useState('')
  const [raceDate, setRaceDate] = useState('')

  // ── Step 3 — Goal ─────────────────────────────────────────────────────────
  const [goal, setGoal] = useState<'finish' | 'time_target' | null>(null)

  // ── Step 4 — Target time ──────────────────────────────────────────────────
  const [targetHours, setTargetHours] = useState(0)
  const [targetMins,  setTargetMins]  = useState(0)

  // ── Step 5 — Fitness ─────────────────────────────────────────────────────
  const [dob,            setDob]            = useState(initialDob ?? '')
  const [dobError,       setDobError]       = useState<string | null>(null)
  const [weeklyKmChip,   setWeeklyKmChip]   = useState<string | null>(null)
  const [longestRunChip, setLongestRunChip] = useState<string | null>(null)
  const [restingHR,      setRestingHR]      = useState(initialRHR ? String(initialRHR) : '')
  const [trainingAge,    setTrainingAge]    = useState<TrainingAge | null>(null)

  // ── Step 6 — Benchmark ───────────────────────────────────────────────────
  const [benchmarkType,    setBenchmarkType]    = useState<'race' | 'tt_30min' | null>(null)
  const [benchmarkDistKm,  setBenchmarkDistKm]  = useState<number | null>(null)
  const [benchHours,       setBenchHours]       = useState(0)
  const [benchMins,        setBenchMins]        = useState(0)
  const [benchmarkDate,    setBenchmarkDate]    = useState('')
  const [benchmarkTTDist,  setBenchmarkTTDist]  = useState('')

  // ── Step 7 — Schedule ────────────────────────────────────────────────────
  const [daysAvailable,         setDaysAvailable]         = useState<number | null>(null)
  const [preferredLongRunDay,   setPreferredLongRunDay]   = useState<'sat' | 'sun'>('sun')

  // ── Step 8 — Constraints ─────────────────────────────────────────────────
  const [daysOff,        setDaysOff]        = useState<string[]>([])
  const [maxWeekdayChip, setMaxWeekdayChip] = useState<string | null>(null)

  // ── Step 9 — Hard sessions (paid) ────────────────────────────────────────
  const [hardSessions, setHardSessions] = useState<'avoid' | 'neutral' | 'love' | 'overdo' | null>(null)

  // ── Step 10 — Terrain (paid) ──────────────────────────────────────────────
  const [terrain, setTerrain] = useState<'road' | 'trail' | 'mixed' | null>(null)

  // ── Step 11 — Injuries (paid) ────────────────────────────────────────────
  const [injuries, setInjuries] = useState<string[]>([])

  // ── Restore wizard draft from sessionStorage ──────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(WIZARD_KEY)
      if (!raw) return
      const s = JSON.parse(raw)
      if (s.distanceKm)      setDistanceKm(s.distanceKm)
      if (s.raceName)        setRaceName(s.raceName)
      if (s.raceDate)        setRaceDate(s.raceDate)
      if (s.goal)            setGoal(s.goal)
      if (typeof s.targetHours === 'number') setTargetHours(s.targetHours)
      if (typeof s.targetMins  === 'number') setTargetMins(s.targetMins)
      if (s.dob)             setDob(s.dob)
      if (s.weeklyKmChip)    setWeeklyKmChip(s.weeklyKmChip)
      if (s.longestRunChip)  setLongestRunChip(s.longestRunChip)
      if (s.restingHR)       setRestingHR(s.restingHR)
      if (s.trainingAge)     setTrainingAge(s.trainingAge)
      if (s.benchmarkType)   setBenchmarkType(s.benchmarkType)
      if (s.benchmarkDistKm) setBenchmarkDistKm(s.benchmarkDistKm)
      if (typeof s.benchHours === 'number') setBenchHours(s.benchHours)
      if (typeof s.benchMins  === 'number') setBenchMins(s.benchMins)
      if (s.benchmarkTTDist) setBenchmarkTTDist(s.benchmarkTTDist)
      if (s.benchmarkDate)   setBenchmarkDate(s.benchmarkDate)
      if (s.daysAvailable)   setDaysAvailable(s.daysAvailable)
      if (s.preferredLongRunDay === 'sat' || s.preferredLongRunDay === 'sun') setPreferredLongRunDay(s.preferredLongRunDay)
      if (Array.isArray(s.daysOff)) setDaysOff(s.daysOff)
      if (s.maxWeekdayChip)  setMaxWeekdayChip(s.maxWeekdayChip)
      if (s.hardSessions)    setHardSessions(s.hardSessions)
      if (s.terrain)         setTerrain(s.terrain)
      if (Array.isArray(s.injuries)) setInjuries(s.injuries)
      // Restore sub-step if it's a valid wizard step name
      const validSubSteps: WizardSubStep[] = ['distance','race-details','goal','target-time','fitness','benchmark','schedule','constraints','hard-sessions','terrain','injuries']
      if (validSubSteps.includes(s.appStep)) setAppStep(s.appStep)
    } catch {}
  }, [])

  // ── Persist wizard draft to sessionStorage ────────────────────────────────
  useEffect(() => {
    if (typeof appStep !== 'string' || appStep === 'generating' || appStep === 'preview' || appStep === 'error') return
    try {
      sessionStorage.setItem(WIZARD_KEY, JSON.stringify({
        appStep, distanceKm, raceName, raceDate, goal,
        targetHours, targetMins,
        dob, weeklyKmChip, longestRunChip, restingHR, trainingAge,
        benchmarkType, benchmarkDistKm, benchHours, benchMins, benchmarkTTDist, benchmarkDate,
        daysAvailable, preferredLongRunDay, daysOff, maxWeekdayChip,
        hardSessions, terrain, injuries,
      }))
    } catch {}
  }, [appStep, distanceKm, raceName, raceDate, goal,
      targetHours, targetMins,
      dob, weeklyKmChip, longestRunChip, restingHR, trainingAge,
      benchmarkType, benchmarkDistKm, benchHours, benchMins, benchmarkTTDist, benchmarkDate,
      daysAvailable, preferredLongRunDay, daysOff, maxWeekdayChip,
      hardSessions, terrain, injuries])

  // ── Navigation helpers ────────────────────────────────────────────────────

  function navigateTo(step: AppStep, dir: 'fwd' | 'back') {
    setSlideFrom(dir === 'fwd' ? 'right' : 'left')
    setVisible(false)
    setTimeout(() => {
      setAppStep(step)
      setVisible(true)
    }, 140)
  }

  function goNext() {
    if (appStep === 'generating' || appStep === 'preview' || appStep === 'error') return
    const sequence = getStepSequence(!!hasPaidAccess, goal)
    const idx      = sequence.indexOf(appStep as WizardSubStep)
    if (idx === sequence.length - 1) {
      void handleGenerate()
    } else {
      navigateTo(sequence[idx + 1], 'fwd')
    }
  }

  function skipStep() {
    goNext()
  }

  function goBack() {
    if (appStep === 'error') { onBack(); return }
    if (appStep === 'preview') { navigateTo(getLastWizardStep(), 'back'); return }
    if (appStep === 'generating') { onBack(); return }
    const sequence = getStepSequence(!!hasPaidAccess, goal)
    const idx      = sequence.indexOf(appStep as WizardSubStep)
    if (idx <= 0) { onBack() } else { navigateTo(sequence[idx - 1], 'back') }
  }

  function getLastWizardStep(): WizardSubStep {
    const sequence = getStepSequence(!!hasPaidAccess, goal)
    return sequence[sequence.length - 1]
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function canProceed(): boolean {
    switch (appStep) {
      case 'distance':       return distanceKm !== null
      case 'race-details':   return raceDate !== ''
      case 'goal':           return goal !== null
      case 'target-time':    return targetHours > 0 || targetMins > 0
      case 'fitness': {
        if (!dob) return false
        const ageCheck = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000)
        if (ageCheck < 14 || ageCheck > 90) return false
        return weeklyKmChip !== null && longestRunChip !== null
      }
      case 'benchmark':
        if (benchmarkType === 'race')     return !!(benchmarkDistKm && (benchHours > 0 || benchMins > 0))
        if (benchmarkType === 'tt_30min') return benchmarkTTDist !== ''
        return true
      case 'schedule':       return daysAvailable !== null
      case 'constraints':    return true
      case 'hard-sessions':  return true
      case 'terrain':        return true
      case 'injuries':       return true
      default:               return true
    }
  }

  // ── Plan generation ───────────────────────────────────────────────────────

  async function handleGenerate() {
    setAppStep('generating')
    setError(null)
    setPlan(null)

    const ageYears      = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : 30
    const weeklyKmVal   = WEEKLY_KM_CHIPS.find(c => c.label === weeklyKmChip)?.value ?? 30
    const longestRunVal = LONGEST_RUN_CHIPS.find(c => c.label === longestRunChip)?.value ?? 12
    const targetTimeStr = goal === 'time_target' && (targetHours > 0 || targetMins > 0)
      ? `${targetHours}:${String(targetMins).padStart(2, '0')}:00` : undefined
    const benchTimeStr  = benchHours > 0 || benchMins > 0
      ? `${benchHours}:${String(benchMins).padStart(2, '0')}:00` : undefined
    const maxWeekdayVal = maxWeekdayChip
      ? MAX_WEEKDAY_CHIPS.find(c => c.label === maxWeekdayChip)?.value : undefined

    const benchmark = (() => {
      const dateField = benchmarkDate ? { benchmark_date: benchmarkDate } : {}
      if (benchmarkType === 'race' && benchmarkDistKm && benchTimeStr)
        return { type: 'race' as const, distance_km: benchmarkDistKm, time: benchTimeStr, ...dateField }
      if (benchmarkType === 'tt_30min' && benchmarkTTDist)
        return { type: 'tt_30min' as const, distance_km: Number(benchmarkTTDist), time: '30:00', ...dateField }
      return undefined
    })()

    const input: GeneratorInput = {
      race_date:             raceDate,
      race_distance_km:      distanceKm!,
      race_name:             raceName || undefined,
      goal:                  goal!,
      target_time:           targetTimeStr,
      age:                   ageYears,
      current_weekly_km:     weeklyKmVal,
      longest_recent_run_km: longestRunVal,
      days_available:        daysAvailable!,
      resting_hr:            restingHR ? Number(restingHR) : undefined,
      max_hr:                initialMHR ?? undefined,
      training_age:          trainingAge ?? undefined,
      preferred_long_run_day: preferredLongRunDay,
      benchmark,
      days_cannot_train:     daysOff.length ? daysOff : undefined,
      max_weekday_mins:      maxWeekdayVal,
      hard_session_relationship: hasPaidAccess ? (hardSessions ?? undefined) : undefined,
      injury_history:            hasPaidAccess && injuries.length ? injuries.map(i => i.toLowerCase()) : undefined,
      terrain:                   hasPaidAccess ? (terrain ?? undefined) : undefined,
    }

    try {
      // Pass the access token explicitly — cookie sync to server is unreliable
      // with @supabase/ssr; getSession() always returns the in-memory session.
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const res  = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(input),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong building the plan.')
        setAppStep('error')
        return
      }
      setPlan(data.plan)
    } catch {
      setError('Could not reach the server. Check your connection.')
      setAppStep('error')
    }
  }

  async function handleUsePlan() {
    if (!plan || !onPlanSaved) return
    setIsSaving(true)
    try {
      if (dob && onDobSave) await onDobSave(dob).catch(() => {})
      await onPlanSaved(plan)
      sessionStorage.removeItem(WIZARD_KEY)
    } catch { setIsSaving(false) }
  }

  // ── Special screens (ceremony / preview / error) ──────────────────────────

  if (appStep === 'generating') {
    return (
      <GeneratingCeremony
        hasPaidAccess={!!hasPaidAccess}
        plan={plan}
        onRevealComplete={() => setAppStep('preview')}
      />
    )
  }

  if (appStep === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          {!isOnboarding && <BackBtn onClick={goBack} />}
        </div>
        <div style={{ flex: 1, padding: '0 20px 24px' }}>
          <div style={{ background: 'var(--warn-bg)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--warn)', marginBottom: '8px' }}>
              Something went wrong building the plan.
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coach-ink)', lineHeight: 1.55 }}>
              {error}
            </div>
          </div>
          <button
            onClick={() => navigateTo(getLastWizardStep(), 'back')}
            style={{ width: '100%', padding: '15px', borderRadius: 'var(--radius-md)', background: 'var(--moss)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--card)' }}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (appStep === 'preview' && plan) {
    const { meta, weeks } = plan
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)', paddingBottom: '40px' }}>
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          <BackBtn onClick={goBack} label="Adjust inputs" />
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '22px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.3px' }}>
              {meta.race_name || 'Your plan'}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', marginTop: '4px' }}>
              {weeks.length} weeks · starts {meta.plan_start} · {meta.race_distance_km}km
            </div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
          {meta.confidence_score != null && (
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '4px 16px 20px', margin: '16px 0' }}>
              <ConfidenceBadge score={meta.confidence_score} risks={meta.confidence_risks} />
            </div>
          )}

          {meta.coach_intro && (
            <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', borderLeft: '3px solid var(--moss)', padding: '14px 16px', margin: '16px 0' }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.65 }}>
                {meta.coach_intro}
              </div>
            </div>
          )}

          <div style={{ margin: '20px 0 0' }}>
            <PhaseArc weeks={weeks} />
          </div>

          {weeks.slice(0, 4).map(w => (
            <WeekCard key={w.n} week={w} />
          ))}

          {weeks.length > 4 && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', textAlign: 'center', padding: '4px 0 16px' }}>
              + {weeks.length - 4} more weeks in your plan
            </div>
          )}
        </div>

        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', borderTop: '1px solid var(--line)', padding: '12px 20px calc(12px + env(safe-area-inset-bottom))' }}>
          {hasExistingPlan && !isSaving && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', textAlign: 'center', marginBottom: '8px' }}>
              This replaces your current plan.
            </div>
          )}
          {onPlanSaved ? (
            <button
              onClick={handleUsePlan}
              disabled={isSaving}
              style={{
                width: '100%', padding: '15px', borderRadius: 'var(--radius-md)',
                background: isSaving ? 'var(--moss-soft)' : 'var(--moss)',
                border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
                color: isSaving ? 'var(--mute)' : 'var(--card)', transition: 'all 0.15s',
              }}
            >
              {isSaving ? 'Saving…' : 'Use this plan'}
            </button>
          ) : (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', textAlign: 'center' }}>
              Preview only — save not available in this context
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Wizard ────────────────────────────────────────────────────────────────

  const currentSubStep = appStep as WizardSubStep
  const sequence       = getStepSequence(!!hasPaidAccess, goal)
  const currentIdx     = sequence.indexOf(currentSubStep)
  const isLastStep     = currentIdx === sequence.length - 1
  const stepMeta       = STEP_META[currentSubStep] ?? STEP_META['distance']
  const ctaLabel       = isLastStep ? 'Generate my plan →' : 'Continue'

  const welcomeOverride = isOnboarding && currentSubStep === 'distance'
    ? { title: 'Welcome to Zona.', subtitle: "Let's build your plan. Start with the distance." }
    : null

  const title    = welcomeOverride?.title    ?? stepMeta.title
  const subtitle = welcomeOverride?.subtitle ?? stepMeta.subtitle

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
      {/* Header — back button + progress */}
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        {!(isOnboarding && currentIdx === 0) && <BackBtn onClick={goBack} />}
        <ProgressDots total={sequence.length} current={currentIdx} />
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: '8px', margin: '0 0 8px' }}>
            {title}
          </h1>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)', lineHeight: 1.55, margin: 0 }}>
            {subtitle}
          </p>
        </div>
      </div>

      {/* Step content — animated */}
      <div
        style={{
          flex: 1,
          padding: '0 20px 24px',
          overflowY: 'auto',
          opacity:   visible ? 1 : 0,
          transform: visible ? 'translateX(0)' : `translateX(${slideFrom === 'right' ? '14px' : '-14px'})`,
          transition: visible ? 'opacity 0.18s ease-out, transform 0.18s ease-out' : 'none',
        }}
      >
        {renderStep()}
      </div>

      {/* CTA — sticky bottom */}
      <div style={{
        flexShrink: 0,
        padding: '12px 20px calc(12px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg)',
      }}>
        {stepMeta.optional && (
          <button
            onClick={skipStep}
            style={{ width: '100%', textAlign: 'center', marginBottom: '8px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', padding: '8px' }}
          >
            Skip this →
          </button>
        )}
        <button
          onClick={canProceed() ? goNext : undefined}
          disabled={!canProceed()}
          style={{
            width: '100%', padding: '15px', borderRadius: 'var(--radius-md)',
            background: canProceed() ? 'var(--moss)' : 'var(--moss-soft)',
            color:      canProceed() ? 'var(--card)'         : 'var(--mute)',
            border: 'none', cursor: canProceed() ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  )

  // ── Step renderers ────────────────────────────────────────────────────────

  function renderStep(): React.ReactNode {
    switch (currentSubStep) {

      // ── Distance ───────────────────────────────────────────────────────────
      case 'distance':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {DISTANCES.map(d => {
              const locked = d.paid && !hasPaidAccess
              const active = distanceKm === d.value
              return (
                <button
                  key={d.value}
                  onClick={() => locked ? onUpgrade?.() : setDistanceKm(d.value)}
                  style={{
                    padding: '18px 16px', borderRadius: 'var(--radius-lg)',
                    border: `1.5px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
                    background: active ? 'var(--moss-soft)' : 'var(--card)',
                    cursor: locked ? 'default' : 'pointer',
                    textAlign: 'left', transition: 'all 0.15s',
                    opacity: locked ? 0.55 : 1,
                    display: 'flex', flexDirection: 'column', gap: '4px',
                    minHeight: '72px', position: 'relative',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: active ? 700 : 500, color: active ? 'var(--moss)' : 'var(--ink)' }}>{d.label}</span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>{d.sub}</span>
                  {locked && (
                    <span style={{ position: 'absolute', top: '8px', right: '10px', fontFamily: 'var(--font-ui)', fontSize: '9px', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.08em' }}>
                      PAID
                    </span>
                  )}
                </button>
              )
            })}
            {!hasPaidAccess && (
              <div style={{ gridColumn: '1/-1', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '4px' }}>
                Marathon and longer require a paid plan.{' '}
                <button onClick={onUpgrade} style={{ background: 'none', border: 'none', color: 'var(--moss)', fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                  Start free trial →
                </button>
              </div>
            )}
          </div>
        )

      // ── Race details ───────────────────────────────────────────────────────
      case 'race-details':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <FieldLabel optional>Race name</FieldLabel>
              <WizardInput value={raceName} onChange={setRaceName} placeholder="e.g. London Marathon" />
            </div>
            <div>
              <FieldLabel>Race date</FieldLabel>
              <WizardInput type="date" value={raceDate} onChange={setRaceDate} />
              <FieldNote>Date locks the plan length. Everything works backwards from here.</FieldNote>
            </div>
          </div>
        )

      // ── Goal ───────────────────────────────────────────────────────────────
      case 'goal':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <OptionCard
              label="Just finish."
              sub="Get to the line in one piece. That's the job."
              active={goal === 'finish'}
              onClick={() => setGoal('finish')}
            />
            <OptionCard
              label="Hit a time."
              sub="A number on the clock. You'll need to earn it."
              active={goal === 'time_target'}
              onClick={() => setGoal('time_target')}
            />
          </div>
        )

      // ── Target time ────────────────────────────────────────────────────────
      case 'target-time':
        return (
          <div>
            <FieldLabel>Target time</FieldLabel>
            <DurationPicker
              hours={targetHours} mins={targetMins}
              onHoursChange={setTargetHours} onMinsChange={setTargetMins}
              maxHours={23}
            />
            <FieldNote>Be honest. Optimistic targets make bad training plans.</FieldNote>
          </div>
        )

      // ── Fitness ────────────────────────────────────────────────────────────
      case 'fitness': {
        const dobAge = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null
        const dobAgeErr = dob && dobAge !== null
          ? (dobAge < 14 ? 'Must be 14 or older.' : dobAge > 90 ? 'Date looks off — check the year.' : null)
          : null
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <FieldLabel>Date of birth</FieldLabel>
              <WizardInput
                type="date"
                value={dob}
                onChange={v => { setDob(v); setDobError(null) }}
              />
              {(dobError ?? dobAgeErr) && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--danger)', marginTop: '6px' }}>
                  {dobError ?? dobAgeErr}
                </div>
              )}
              <FieldNote>Used to calculate your training zones. Kept private.</FieldNote>
            </div>
            <div>
              <FieldLabel>Average weekly km — last 4 weeks</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {WEEKLY_KM_CHIPS.map(c => (
                  <Chip
                    key={c.label}
                    label={c.label}
                    active={weeklyKmChip === c.label}
                    onClick={() => setWeeklyKmChip(weeklyKmChip === c.label ? null : c.label)}
                  />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Longest run in last 6 weeks</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {LONGEST_RUN_CHIPS.map(c => (
                  <Chip
                    key={c.label}
                    label={c.label}
                    active={longestRunChip === c.label}
                    onClick={() => setLongestRunChip(longestRunChip === c.label ? null : c.label)}
                  />
                ))}
              </div>
            </div>
            <div>
              <FieldLabel optional>How long have you been running consistently?</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {TRAINING_AGE_CHIPS.map(c => (
                  <Chip
                    key={c.value}
                    label={c.label}
                    active={trainingAge === c.value}
                    onClick={() => setTrainingAge(trainingAge === c.value ? null : c.value)}
                  />
                ))}
              </div>
              <FieldNote>Helps us judge how much volume you can handle.</FieldNote>
            </div>
          </div>
        )
      }

      // ── Benchmark ──────────────────────────────────────────────────────────
      case 'benchmark':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Chip
                label="Race result"
                active={benchmarkType === 'race'}
                onClick={() => setBenchmarkType(benchmarkType === 'race' ? null : 'race')}
              />
              <Chip
                label="30-min time trial"
                active={benchmarkType === 'tt_30min'}
                onClick={() => setBenchmarkType(benchmarkType === 'tt_30min' ? null : 'tt_30min')}
              />
            </div>

            {benchmarkType === 'race' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <FieldLabel>Race distance</FieldLabel>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {BENCHMARK_DISTANCES.map(d => (
                      <Chip
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
                  <DurationPicker
                    hours={benchHours} mins={benchMins}
                    onHoursChange={setBenchHours} onMinsChange={setBenchMins}
                    maxHours={9}
                  />
                </div>
              </div>
            )}

            {benchmarkType === 'tt_30min' && (
              <div>
                <FieldLabel>Distance covered in 30 minutes (km)</FieldLabel>
                <WizardInput type="number" value={benchmarkTTDist} onChange={setBenchmarkTTDist} placeholder="e.g. 5.2" min={1} />
                <FieldNote>Run flat-out for exactly 30 minutes and record the distance.</FieldNote>
              </div>
            )}

            {benchmarkType !== null && (
              <div>
                <FieldLabel optional>When did you run this?</FieldLabel>
                <WizardInput type="date" value={benchmarkDate} onChange={setBenchmarkDate} />
                <FieldNote>Older than 6 months? We'll use slightly more conservative pace targets.</FieldNote>
              </div>
            )}

            {benchmarkType === null && (
              <div style={{ background: 'var(--bg-soft)', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55 }}>
                  Without a benchmark we use population estimates for your fitness level. Still works — just less personal.
                </div>
              </div>
            )}
          </div>
        )

      // ── Schedule ───────────────────────────────────────────────────────────
      case 'schedule':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <FieldLabel>Days per week</FieldLabel>
              {[2,3,4,5,6].map(n => (
                <button
                  key={n}
                  onClick={() => setDaysAvailable(n)}
                  style={{
                    width: '100%', padding: '18px 20px', borderRadius: 'var(--radius-lg)',
                    border: `1.5px solid ${daysAvailable === n ? 'var(--moss)' : 'var(--line)'}`,
                    background: daysAvailable === n ? 'var(--moss-soft)' : 'var(--card)',
                    textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: daysAvailable === n ? 700 : 500, color: daysAvailable === n ? 'var(--moss)' : 'var(--ink)' }}>
                    {n} days
                  </span>
                  <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>
                    {n === 2 ? 'Selective.' : n === 3 ? 'Enough.' : n === 4 ? 'Building.' : n === 5 ? 'Race-ready.' : 'All in.'}
                  </span>
                </button>
              ))}
            </div>
            <div>
              <FieldLabel>Long-run day</FieldLabel>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Chip label="Saturday" active={preferredLongRunDay === 'sat'} onClick={() => setPreferredLongRunDay('sat')} />
                <Chip label="Sunday" active={preferredLongRunDay === 'sun'} onClick={() => setPreferredLongRunDay('sun')} />
              </div>
              <FieldNote>Pick the one your week protects.</FieldNote>
            </div>
          </div>
        )

      // ── Constraints ────────────────────────────────────────────────────────
      case 'constraints':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <FieldLabel optional>Days you can never train</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {DAYS_SHORT.map((d, i) => {
                  const key    = DAY_KEYS[i]
                  const active = daysOff.includes(key)
                  return (
                    <button
                      key={key}
                      onClick={() => setDaysOff(prev => active ? prev.filter(x => x !== key) : [...prev, key])}
                      style={{
                        width: '44px', height: '44px', borderRadius: '50%',
                        border: `1px solid ${active ? 'var(--moss)' : 'var(--line)'}`,
                        background: active ? 'var(--moss-soft)' : 'var(--card)',
                        color: active ? 'var(--moss)' : 'var(--ink-2)',
                        fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: active ? 600 : 400,
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
              <FieldLabel optional>Max weekday session</FieldLabel>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {MAX_WEEKDAY_CHIPS.map(c => (
                  <Chip
                    key={c.label}
                    label={c.label}
                    active={maxWeekdayChip === c.label}
                    onClick={() => setMaxWeekdayChip(maxWeekdayChip === c.label ? null : c.label)}
                  />
                ))}
              </div>
              <FieldNote>Applies Monday–Friday only. Ultra runners: 3 hrs or No limit.</FieldNote>
            </div>
            {!hasPaidAccess && onUpgrade && <TeaserCard onUpgrade={onUpgrade} />}
          </div>
        )

      // ── Hard sessions (paid) ───────────────────────────────────────────────
      case 'hard-sessions':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {([
              { value: 'avoid',   label: 'Avoid them.',    sub: 'Keep it aerobic. No intervals unless absolutely necessary.' },
              { value: 'neutral', label: 'Fine either way.', sub: 'Structure as the plan needs. No strong preference.' },
              { value: 'love',    label: 'Bring it on.',   sub: 'More quality, more structure. I like working hard.' },
              { value: 'overdo',  label: 'I overdo it.',   sub: 'Reign me in. I know I\'ll push too hard if I can.' },
            ] as const).map(o => (
              <OptionCard key={o.value} label={o.label} sub={o.sub} active={hardSessions === o.value} onClick={() => setHardSessions(o.value)} />
            ))}
          </div>
        )

      // ── Terrain (paid) ────────────────────────────────────────────────────
      case 'terrain':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <OptionCard label="Road." sub="Pavement, tracks, flat surfaces. Speed-focused." active={terrain === 'road'} onClick={() => setTerrain('road')} />
            <OptionCard label="Trail." sub="Off-road, elevation, technical terrain. Effort-focused." active={terrain === 'trail'} onClick={() => setTerrain('trail')} />
            <OptionCard label="Mixed." sub="Both. Adapt pace targets to the surface." active={terrain === 'mixed'} onClick={() => setTerrain('mixed')} />
          </div>
        )

      // ── Injuries (paid) ───────────────────────────────────────────────────
      case 'injuries':
        return (
          <div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {INJURIES.map(inj => (
                <Chip
                  key={inj}
                  label={inj}
                  active={injuries.includes(inj)}
                  onClick={() => setInjuries(prev => prev.includes(inj) ? prev.filter(x => x !== inj) : [...prev, inj])}
                />
              ))}
            </div>
            <FieldNote>Select any that are still an issue. We'll avoid aggravating them in the plan structure.</FieldNote>
          </div>
        )

      default: return null
    }
  }
}

// ─── Back button ──────────────────────────────────────────────────────────────

function BackBtn({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--mute)', padding: '0 0 4px', marginBottom: '4px',
        minHeight: '44px',
      }}
    >
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
          <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {label && <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>{label}</span>}
    </button>
  )
}
