'use client'

import { useState, useEffect, useRef } from 'react'
import type { Plan, GeneratorInput } from '@/types/plan'

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4
type AppStep = WizardStep | 'generating' | 'preview' | 'error'

// ─── Constants ────────────────────────────────────────────────────────────────

const DISTANCES = [
  { label: '5K',    value: 5 },
  { label: '10K',   value: 10 },
  { label: 'Half',  value: 21.1 },
  { label: 'Marathon', value: 42.2 },
  { label: '50K',   value: 50 },
  { label: '100K',  value: 100 },
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
  1: { title: 'Your race.',        subtitle: 'Start with the finish line. Work backwards from there.' },
  2: { title: 'Be honest.',        subtitle: "The plan only works if these numbers are real. Flattering yourself here just means a harder race." },
  3: { title: 'Your schedule.',    subtitle: "Training has to fit your life. Not the other way around." },
  4: { title: 'A bit more detail.', subtitle: "Fill what you know. Skip what you don't. HR data makes every session smarter." },
}

const GENERATING_LINES = [
  "Mapping your race. Working backwards from the finish line.",
  "Calculating your Zone 2 ceiling. It's lower than you think.",
  "Spreading the load. The 10% rule applies — even when you want to ignore it.",
  "Adding deload weeks. You'll thank us at week 8.",
  "Checking session spacing. Hard sessions need 48 hours between them.",
  "Building your taper. The fitness is already there.",
  "Reviewing your terrain preferences. Roads and trails train differently.",
  "Validating your race window. You have more time than you think.",
]

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
        fontFamily: "'Inter', sans-serif",
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
      fontFamily: "'Inter', sans-serif",
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
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '10px', color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, opacity: 0.7 }}>optional</span>
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
        fontFamily: "'Inter', sans-serif",
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

// ─── Confidence badge (hero version) ─────────────────────────────────────────

function ConfidenceBadge({ score, risks }: { score: number; risks?: string[] }) {
  const colour = score >= 7 ? 'var(--teal)' : score >= 5 ? 'var(--amber)' : 'var(--red)'
  const label  = score >= 7 ? 'Good fit'  : score >= 5 ? 'Possible'  : 'Challenging'
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
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 600, color: colour }}>{score}</span>
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px', fontWeight: 600, color: colour, marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '280px', margin: '0 auto' }}>{desc}</div>
      {risks && risks.length > 0 && (
        <div style={{ marginTop: '14px', textAlign: 'left', padding: '12px 14px', background: 'var(--amber-soft)', borderRadius: '10px', border: '0.5px solid var(--amber-mid)' }}>
          {risks.map((r, i) => (
            <div key={i} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '10px', position: 'relative' }}>
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
    // No phases — show first 3 weeks
    return (
      <>
        {weeks.slice(0, 3).map(w => <WeekCard key={w.n} week={w} />)}
      </>
    )
  }

  return (
    <>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '12px' }}>
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
  const sessionDays = Object.entries(week.sessions)

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: '12px',
      border: '0.5px solid var(--border-col)', padding: '14px 16px', marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {phaseLabel ? `${phaseLabel.charAt(0).toUpperCase()}${phaseLabel.slice(1)} phase` : `Week ${week.n}`}
            {' '}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '13px' }}>· W{week.n}</span>
          </div>
          {week.label && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {week.label}
            </div>
          )}
        </div>
        {phaseColour && phaseLabel && (
          <span style={{
            fontFamily: "'Inter', sans-serif", fontSize: '10px', letterSpacing: '0.08em',
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
              fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-secondary)',
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
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)' }}>{week.weekly_km} km</span>
        )}
        {week.long_run_hrs && (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)' }}>Long {week.long_run_hrs}h</span>
        )}
        {week.badge && (
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{week.badge}</span>
        )}
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GeneratePlanScreen({
  onBack,
  firstName,
  lastName,
  restingHR: initialRHR,
  maxHR: initialMHR,
  onPlanSaved,
  isOnboarding = false,
}: {
  onBack: () => void
  firstName?: string
  lastName?: string
  restingHR?: number | null
  maxHR?: number | null
  onPlanSaved?: (plan: Plan) => Promise<void>
  isOnboarding?: boolean
}) {
  const [appStep, setAppStep]   = useState<AppStep>(1)
  const [error, setError]       = useState<string | null>(null)
  const [plan, setPlan]         = useState<Plan | null>(null)
  const [isStub, setIsStub]     = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Step 1 — Race
  const [raceName, setRaceName]     = useState('')
  const [raceDate, setRaceDate]     = useState('')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [goal, setGoal]             = useState<'finish' | 'time_target' | null>(null)
  const [targetTime, setTargetTime] = useState('')

  // Step 2 — Fitness
  const [fitnessLevel, setFitnessLevel] = useState<'beginner' | 'intermediate' | 'experienced' | null>(null)
  const [weeklyKm, setWeeklyKm]         = useState('')
  const [longestRun, setLongestRun]     = useState('')

  // Step 3 — Schedule
  const [daysAvailable, setDaysAvailable] = useState<number | null>(null)
  const [daysOff, setDaysOff]             = useState<string[]>([])
  const [maxWeekday, setMaxWeekday]       = useState('')

  // Step 4 — Profile (all optional)
  const [restingHR, setRestingHR]       = useState(initialRHR ? String(initialRHR) : '')
  const [maxHR, setMaxHR]               = useState(initialMHR ? String(initialMHR) : '')
  const [terrain, setTerrain]           = useState<string | null>(null)
  const [hardSessions, setHardSessions] = useState<string | null>(null)
  const [trainingStyle, setTrainingStyle] = useState<string | null>(null)
  const [injuries, setInjuries]         = useState<string[]>([])

  // Pre-fill HR from profile if it arrives after mount
  useEffect(() => {
    if (initialRHR && !restingHR) setRestingHR(String(initialRHR))
    if (initialMHR && !maxHR) setMaxHR(String(initialMHR))
  }, [initialRHR, initialMHR])

  // Rotating generating line
  const [lineIdx, setLineIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (appStep === 'generating') {
      timerRef.current = setInterval(() => {
        setLineIdx(i => (i + 1) % GENERATING_LINES.length)
      }, 2200)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [appStep])

  // ── Step validation ──────────────────────────────────────────────────────────

  function step1Valid() {
    return raceDate !== '' && distanceKm !== null && goal !== null && (goal !== 'time_target' || targetTime !== '')
  }
  function step2Valid() {
    return fitnessLevel !== null && weeklyKm !== '' && longestRun !== ''
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
    if (appStep === 4) {
      void handleGenerate()
    } else if (typeof appStep === 'number' && appStep < 4) {
      setAppStep((appStep + 1) as WizardStep)
    }
  }

  function goBack() {
    if (appStep === 1 || appStep === 'error') {
      onBack()
    } else if (appStep === 'preview') {
      setAppStep(4)
    } else if (typeof appStep === 'number' && appStep > 1) {
      setAppStep((appStep - 1) as WizardStep)
    }
  }

  async function handleGenerate() {
    setAppStep('generating')
    setError(null)

    // HR defaults if not provided
    const rhr = restingHR ? Number(restingHR) : 55
    const mhr = maxHR     ? Number(maxHR)     : 185

    const input: GeneratorInput = {
      race_date:                raceDate,
      race_distance_km:         distanceKm!,
      race_name:                raceName || undefined,
      goal:                     goal!,
      target_time:              goal === 'time_target' ? targetTime : undefined,
      fitness_level:            fitnessLevel!,
      current_weekly_km:        Number(weeklyKm),
      longest_recent_run_km:    Number(longestRun),
      days_available:           daysAvailable!,
      resting_hr:               rhr,
      max_hr:                   mhr,
      days_cannot_train:        daysOff.length ? daysOff : undefined,
      max_weekday_mins:         maxWeekday ? Number(maxWeekday) : undefined,
      training_style:           trainingStyle as GeneratorInput['training_style'] ?? undefined,
      hard_session_relationship: hardSessions as GeneratorInput['hard_session_relationship'] ?? undefined,
      injury_history:           injuries.length ? injuries.map(i => i.toLowerCase()) : undefined,
      terrain:                  terrain as GeneratorInput['terrain'] ?? undefined,
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
      setIsStub(data.stub === true)
      setAppStep('preview')
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
    } catch {
      setIsSaving(false)
    }
  }

  // ── Generating screen ────────────────────────────────────────────────────────

  if (appStep === 'generating') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '70vh', padding: '32px 24px',
        gap: '28px',
      }}>
        {/* Spinner */}
        <div style={{ position: 'relative', width: '56px', height: '56px' }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: '2px solid var(--border-col)',
            borderTopColor: 'var(--accent)',
            animation: 'genSpin 0.9s linear infinite',
          }} />
          <style>{`@keyframes genSpin { to { transform: rotate(360deg) } }`}</style>
        </div>

        <div style={{ textAlign: 'center', maxWidth: '280px' }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px',
            fontWeight: 500, color: 'var(--text-primary)', marginBottom: '10px',
          }}>
            Building your plan
          </div>
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: '13px',
            color: 'var(--text-muted)', lineHeight: 1.6,
            minHeight: '40px',
            transition: 'opacity 0.4s',
          }}>
            {GENERATING_LINES[lineIdx]}
          </div>
        </div>
      </div>
    )
  }

  // ── Error screen ─────────────────────────────────────────────────────────────

  if (appStep === 'error') {
    return (
      <div style={{ padding: '16px' }}>
        <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '8px 0 20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px' }}>Back</span>
        </button>

        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--red)', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500, color: 'var(--red)', marginBottom: '8px' }}>
            Could not generate plan
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {error}
          </div>
        </div>

        <button onClick={() => setAppStep(4)} style={{
          width: '100%', padding: '14px', borderRadius: '12px',
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500,
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
        {/* Back */}
        <div style={{ padding: '16px 16px 0' }}>
          <button onClick={goBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px' }}>Adjust inputs</span>
          </button>
        </div>

        <div style={{ padding: '0 16px' }}>
          {isStub && (
            <div style={{
              background: 'var(--amber-soft)', border: '0.5px solid var(--amber)', borderRadius: '10px',
              padding: '10px 14px', margin: '12px 0',
              fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--amber)', lineHeight: 1.55,
            }}>
              Stub mode — add ANTHROPIC_API_KEY to .env.local for live generation
            </div>
          )}

          {/* Plan title */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              {meta.race_name || 'Your plan'}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {weeks.length} weeks · starts {meta.plan_start} · {meta.race_distance_km}km
            </div>
          </div>

          {/* Confidence hero */}
          {meta.confidence_score != null && (
            <div style={{ background: 'var(--card-bg)', borderRadius: '14px', border: '0.5px solid var(--border-col)', padding: '4px 16px 20px', margin: '16px 0' }}>
              <ConfidenceBadge score={meta.confidence_score} risks={meta.confidence_risks} />
            </div>
          )}

          {/* Phase arc */}
          <div style={{ margin: '20px 0 0' }}>
            <PhaseArc weeks={weeks} />
          </div>

          {weeks.length > 4 && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0 16px' }}>
              + {weeks.length - (Math.min(4, weeks.length))} more weeks in your plan
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
          {onPlanSaved ? (
            <button
              onClick={handleUsePlan}
              disabled={isSaving}
              style={{
                width: '100%', padding: '15px', borderRadius: '12px',
                background: isSaving ? 'var(--accent-dim)' : 'var(--accent)',
                border: 'none', cursor: isSaving ? 'wait' : 'pointer',
                fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 600,
                color: isSaving ? 'var(--accent)' : 'var(--zona-navy)',
                transition: 'all 0.15s',
              }}
            >
              {isSaving ? 'Saving…' : 'Use this plan'}
            </button>
          ) : (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
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
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px' }}>
              {currentStep === 1 ? 'Back' : `Step ${currentStep - 1}`}
            </span>
          </button>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
            {currentStep} / 4
          </span>
        </div>

        <StepProgress current={currentStep} total={4} />

        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '6px' }}>
            {stepMeta.title}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>
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
                {DISTANCES.map(d => (
                  <ChipToggle
                    key={d.value}
                    label={d.label}
                    active={distanceKm === d.value}
                    onClick={() => setDistanceKm(d.value)}
                  />
                ))}
              </div>
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
              <FieldLabel>How would you describe your running?</FieldLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {([
                  { value: 'beginner', label: 'Starting out', desc: "Running a few times a week. Longest run under 10km." },
                  { value: 'intermediate', label: 'Getting serious', desc: "Running consistently. Completed a few races. Up to half-marathon distance." },
                  { value: 'experienced', label: 'Been at it a while', desc: "Regular training, multiple race finishes, comfortable with long distances." },
                ] as { value: 'beginner' | 'intermediate' | 'experienced'; label: string; desc: string }[]).map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFitnessLevel(opt.value)}
                    style={{
                      padding: '14px 16px', borderRadius: '12px', textAlign: 'left',
                      border: `0.5px solid ${fitnessLevel === opt.value ? 'var(--accent)' : 'var(--border-col)'}`,
                      background: fitnessLevel === opt.value ? 'var(--accent-soft)' : 'var(--card-bg)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '14px', fontWeight: 500, color: fitnessLevel === opt.value ? 'var(--accent)' : 'var(--text-primary)', marginBottom: '3px' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <FieldLabel>Weekly km (avg)</FieldLabel>
                <StepInput type="number" value={weeklyKm} onChange={setWeeklyKm} placeholder="35" min={0} />
              </div>
              <div>
                <FieldLabel>Longest recent run (km)</FieldLabel>
                <StepInput type="number" value={longestRun} onChange={setLongestRun} placeholder="18" min={0} />
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
                        border: `0.5px solid ${active ? 'var(--red)' : 'var(--border-col)'}`,
                        background: active ? 'rgba(224,90,90,0.1)' : 'none',
                        color: active ? 'var(--red)' : 'var(--text-secondary)',
                        fontFamily: "'Inter', sans-serif", fontSize: '12px',
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
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                Leave blank for no limit. Applies Monday–Friday only.
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Profile + Generate ── */}
        {currentStep === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div>
              <FieldLabel optional>Heart rate data</FieldLabel>
              <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', padding: '14px 16px', marginBottom: '4px' }}>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
                  Used to calculate your personal Zone 2 ceiling. Skipping this uses population averages — it still works, just less precise.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <FieldLabel optional>Resting HR</FieldLabel>
                    <StepInput type="number" value={restingHR} onChange={setRestingHR} placeholder="55" min={30} max={100} />
                  </div>
                  <div>
                    <FieldLabel optional>Max HR</FieldLabel>
                    <StepInput type="number" value={maxHR} onChange={setMaxHR} placeholder="185" min={130} max={220} />
                  </div>
                </div>
              </div>
              {(initialRHR || initialMHR) && (
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--teal)', marginTop: '4px' }}>
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
            fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 600,
            color: canProceed() ? 'var(--zona-navy)' : 'var(--accent)',
            transition: 'all 0.15s',
          }}
        >
          {currentStep === 4 ? 'Generate my plan' : 'Continue'}
        </button>

        {!canProceed() && currentStep === 1 && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
            Date, distance, and goal are required
          </div>
        )}
      </div>
    </div>
  )
}
