'use client'

import { useState } from 'react'
import type { Plan, GeneratorInput } from '@/types/plan'

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 'form' | 'generating' | 'preview' | 'error'

const DISTANCES = [
  { label: '5K',           value: 5 },
  { label: '10K',          value: 10 },
  { label: 'Half Marathon', value: 21.1 },
  { label: 'Marathon',     value: 42.2 },
  { label: '50K',          value: 50 },
  { label: '100K',         value: 100 },
]

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const INJURIES = ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis']

// ─── Sub-components ───────────────────────────────────────────────────────────

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: 'var(--text-muted)', padding: '16px 16px 8px',
      display: 'flex', alignItems: 'center', gap: '6px',
    }}>
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
        <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', letterSpacing: '0.04em' }}>Back</span>
    </button>
  )
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
      {children}{required && <span style={{ color: 'var(--accent)', marginLeft: '3px' }}>*</span>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px', marginTop: '24px', paddingTop: '4px', borderTop: '0.5px solid var(--border-col)' }}>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'var(--bg)', border: '0.5px solid var(--border-col)',
        borderRadius: '8px', padding: '10px 12px',
        fontFamily: "'Inter', sans-serif", fontSize: '14px',
        color: 'var(--text-primary)', outline: 'none',
      }}
    />
  )
}

function NumberInput({ value, onChange, placeholder, min, max }: {
  value: string; onChange: (v: string) => void; placeholder?: string; min?: number; max?: number
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'var(--bg)', border: '0.5px solid var(--border-col)',
        borderRadius: '8px', padding: '10px 12px',
        fontFamily: "'Inter', sans-serif", fontSize: '14px',
        color: 'var(--text-primary)', outline: 'none',
      }}
    />
  )
}

function ToggleGroup<T extends string>({ options, value, onChange }: {
  options: { label: string; value: T }[]
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          padding: '8px 14px', borderRadius: '8px', border: `0.5px solid ${value === o.value ? 'var(--accent)' : 'var(--border-col)'}`,
          background: value === o.value ? 'var(--accent-soft)' : 'none',
          color: value === o.value ? 'var(--accent)' : 'var(--text-secondary)',
          fontFamily: "'Inter', sans-serif", fontSize: '13px', cursor: 'pointer',
          transition: 'all 0.15s',
        }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function MultiSelect({ options, values, onChange }: {
  options: string[]; values: string[]; onChange: (v: string[]) => void
}) {
  function toggle(item: string) {
    onChange(values.includes(item) ? values.filter(v => v !== item) : [...values, item])
  }
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = values.includes(o)
        return (
          <button key={o} onClick={() => toggle(o)} style={{
            padding: '7px 12px', borderRadius: '8px', border: `0.5px solid ${active ? 'var(--accent)' : 'var(--border-col)'}`,
            background: active ? 'var(--accent-soft)' : 'none',
            color: active ? 'var(--accent)' : 'var(--text-secondary)',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', cursor: 'pointer',
          }}>
            {o}
          </button>
        )
      })}
    </div>
  )
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const colour = score >= 7 ? 'var(--teal)' : score >= 5 ? 'var(--amber)' : 'var(--red)'
  const label = score >= 7 ? 'Good fit' : score >= 5 ? 'Possible' : 'Challenging'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '50%',
        border: `2px solid ${colour}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px', fontWeight: 500, color: colour }}>{score}</span>
      </div>
      <div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500, color: colour }}>{label}</div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', marginTop: '1px' }}>Plan confidence score</div>
      </div>
    </div>
  )
}

// ─── Preview — week card ──────────────────────────────────────────────────────

function WeekPreviewCard({ week }: { week: Plan['weeks'][0] }) {
  const sessionDays = Object.entries(week.sessions)
  const phaseColour: Record<string, string> = {
    base: 'var(--teal)', build: 'var(--accent)', peak: 'var(--amber)', taper: 'var(--text-muted)'
  }
  const colour = week.phase ? phaseColour[week.phase] ?? 'var(--text-muted)' : 'var(--text-muted)'

  return (
    <div style={{
      background: 'var(--card-bg)', borderRadius: '12px',
      border: '0.5px solid var(--border-col)', padding: '14px 16px', marginBottom: '10px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
            Week {week.n} · {week.label}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {week.theme}
          </div>
        </div>
        {week.phase && (
          <span style={{
            fontFamily: "'Inter', sans-serif", fontSize: '11px', letterSpacing: '0.08em',
            textTransform: 'uppercase', color: colour, border: `0.5px solid ${colour}`,
            borderRadius: '20px', padding: '3px 9px', flexShrink: 0, marginLeft: '8px',
          }}>
            {week.phase}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {sessionDays.map(([day, session]) => {
          if (!session || session.type === 'rest') return null
          const dotColour = session.type === 'quality' ? 'var(--amber)' : session.type === 'strength' ? 'var(--text-muted)' : session.type === 'race' ? 'var(--red)' : 'var(--teal)'
          return (
            <div key={day} style={{
              fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-secondary)',
              background: 'var(--bg)', borderRadius: '6px', padding: '4px 8px',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dotColour, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ textTransform: 'capitalize' }}>{day}</span>
              {session.distance_km && <span style={{ color: 'var(--text-muted)' }}>{session.distance_km}km</span>}
              {!session.distance_km && session.duration_mins && <span style={{ color: 'var(--text-muted)' }}>{session.duration_mins}m</span>}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--border-col)', display: 'flex', gap: '16px' }}>
        {week.weekly_km > 0 && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)' }}>{week.weekly_km} km total</span>}
        {week.long_run_hrs && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)' }}>Long run {week.long_run_hrs}h</span>}
        {week.badge && <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--amber)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{week.badge}</span>}
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function GeneratePlanScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<Step>('form')
  const [showMore, setShowMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [isStub, setIsStub] = useState(false)
  const [copied, setCopied] = useState(false)

  // Form state
  const [raceName, setRaceName]           = useState('')
  const [raceDate, setRaceDate]           = useState('')
  const [distanceKm, setDistanceKm]       = useState<number | null>(null)
  const [goal, setGoal]                   = useState<'finish' | 'time_target' | null>(null)
  const [targetTime, setTargetTime]       = useState('')
  const [fitnessLevel, setFitnessLevel]   = useState<'beginner' | 'intermediate' | 'experienced' | null>(null)
  const [weeklyKm, setWeeklyKm]           = useState('')
  const [longestRun, setLongestRun]       = useState('')
  const [daysAvailable, setDaysAvailable] = useState<number | null>(null)
  const [restingHR, setRestingHR]         = useState('')
  const [maxHR, setMaxHR]                 = useState('')
  // Optional
  const [daysOff, setDaysOff]             = useState<string[]>([])
  const [maxWeekday, setMaxWeekday]       = useState('')
  const [trainingStyle, setTrainingStyle] = useState<string | null>(null)
  const [hardSessions, setHardSessions]   = useState<string | null>(null)
  const [injuries, setInjuries]           = useState<string[]>([])
  const [terrain, setTerrain]             = useState<string | null>(null)

  function isFormValid() {
    return (
      raceDate !== '' &&
      distanceKm !== null &&
      goal !== null &&
      (goal !== 'time_target' || targetTime !== '') &&
      fitnessLevel !== null &&
      weeklyKm !== '' &&
      longestRun !== '' &&
      daysAvailable !== null &&
      restingHR !== '' &&
      maxHR !== ''
    )
  }

  async function handleGenerate() {
    if (!isFormValid()) return
    setStep('generating')
    setError(null)

    const input: GeneratorInput = {
      race_date: raceDate,
      race_distance_km: distanceKm!,
      race_name: raceName || undefined,
      goal: goal!,
      target_time: goal === 'time_target' ? targetTime : undefined,
      fitness_level: fitnessLevel!,
      current_weekly_km: Number(weeklyKm),
      longest_recent_run_km: Number(longestRun),
      days_available: daysAvailable!,
      resting_hr: Number(restingHR),
      max_hr: Number(maxHR),
      days_cannot_train: daysOff.length ? daysOff : undefined,
      max_weekday_mins: maxWeekday ? Number(maxWeekday) : undefined,
      training_style: trainingStyle as GeneratorInput['training_style'] ?? undefined,
      hard_session_relationship: hardSessions as GeneratorInput['hard_session_relationship'] ?? undefined,
      injury_history: injuries.length ? injuries.map(i => i.toLowerCase()) : undefined,
      terrain: terrain as GeneratorInput['terrain'] ?? undefined,
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
        setStep('error')
        return
      }
      setPlan(data.plan)
      setIsStub(data.stub === true)
      setStep('preview')
    } catch {
      setError('Could not reach the server. Check your connection.')
      setStep('error')
    }
  }

  function handleCopyJSON() {
    if (!plan) return
    navigator.clipboard.writeText(JSON.stringify(plan, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Generating ─────────────────────────────────────────────────────────────
  if (step === 'generating') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px', padding: '32px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          border: '2px solid var(--border-col)', borderTopColor: 'var(--accent)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '17px', fontWeight: 500, color: 'var(--text-primary)' }}>Building your plan</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>Applying coaching rules to your inputs…</div>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div style={{ padding: '0 16px' }}>
        <BackButton onBack={() => setStep('form')} />
        <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--red)', padding: '20px', margin: '16px 0' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500, color: 'var(--red)', marginBottom: '8px' }}>Could not generate plan</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{error}</div>
        </div>
        <button onClick={() => setStep('form')} style={{
          width: '100%', padding: '14px', borderRadius: '12px',
          background: 'var(--accent)', border: 'none', cursor: 'pointer',
          fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500, color: 'var(--zona-navy)',
        }}>
          Try again
        </button>
      </div>
    )
  }

  // ── Preview ────────────────────────────────────────────────────────────────
  if (step === 'preview' && plan) {
    const { meta, weeks } = plan
    const previewWeeks = weeks.slice(0, 3)

    return (
      <div style={{ paddingBottom: '32px' }}>
        <BackButton onBack={() => setStep('form')} />

        <div style={{ padding: '0 16px' }}>
          {isStub && (
            <div style={{ background: 'var(--amber-soft)', border: '0.5px solid var(--amber)', borderRadius: '10px', padding: '10px 14px', marginBottom: '16px', fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--amber)', lineHeight: 1.55 }}>
              Stub mode — add ANTHROPIC_API_KEY to .env.local for live generation
            </div>
          )}

          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
            {meta.race_name || 'Your plan'}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            {weeks.length} weeks · starts {meta.plan_start} · {meta.race_distance_km} km
          </div>

          {meta.confidence_score != null && (
            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '0.5px solid var(--border-col)', padding: '16px', marginBottom: '16px' }}>
              <ConfidenceBadge score={meta.confidence_score} />
              {meta.confidence_risks && meta.confidence_risks.length > 0 && (
                <ul style={{ margin: '12px 0 0', padding: '0 0 0 16px' }}>
                  {meta.confidence_risks.map((r, i) => (
                    <li key={i} style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px', marginTop: '20px' }}>
            First 3 weeks
          </div>
          {previewWeeks.map(w => <WeekPreviewCard key={w.n} week={w} />)}

          {weeks.length > 3 && (
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0 20px' }}>
              + {weeks.length - 3} more weeks
            </div>
          )}

          <button onClick={handleCopyJSON} style={{
            width: '100%', padding: '14px', borderRadius: '12px', marginBottom: '10px',
            background: copied ? 'var(--teal-soft)' : 'var(--bg)',
            border: `0.5px solid ${copied ? 'var(--teal)' : 'var(--border-col)'}`,
            cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px',
            color: copied ? 'var(--teal)' : 'var(--text-secondary)',
          }}>
            {copied ? 'Copied to clipboard' : 'Copy plan JSON'}
          </button>

          <button disabled style={{
            width: '100%', padding: '14px', borderRadius: '12px',
            background: 'var(--accent-dim)', border: '0.5px solid var(--accent-mid)',
            cursor: 'not-allowed', fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500,
            color: 'var(--accent)',
          }}>
            Use this plan — coming soon
          </button>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
            Copy the JSON and paste it into your plan gist for now
          </div>
        </div>
      </div>
    )
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ paddingBottom: '40px' }}>
      <BackButton onBack={onBack} />

      <div style={{ padding: '0 16px' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.3px', marginBottom: '4px' }}>
          Generate a plan
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Fill in your details and we'll build a personalised training plan.
        </div>

        {/* Race */}
        <SectionTitle>Your race</SectionTitle>

        <div style={{ marginBottom: '16px' }}>
          <FieldLabel>Race name</FieldLabel>
          <TextInput value={raceName} onChange={setRaceName} placeholder="e.g. London Marathon" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <FieldLabel required>Race date</FieldLabel>
          <TextInput type="date" value={raceDate} onChange={setRaceDate} />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <FieldLabel required>Distance</FieldLabel>
          <ToggleGroup
            options={DISTANCES}
            value={distanceKm !== null ? String(distanceKm) as any : null}
            onChange={(v: any) => setDistanceKm(Number(v))}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <FieldLabel required>Goal</FieldLabel>
          <ToggleGroup
            options={[{ label: 'Finish', value: 'finish' }, { label: 'Target time', value: 'time_target' }]}
            value={goal}
            onChange={setGoal}
          />
        </div>

        {goal === 'time_target' && (
          <div style={{ marginBottom: '16px' }}>
            <FieldLabel required>Target time (hh:mm:ss)</FieldLabel>
            <TextInput value={targetTime} onChange={setTargetTime} placeholder="e.g. 4:30:00" />
          </div>
        )}

        {/* You */}
        <SectionTitle>About you</SectionTitle>

        <div style={{ marginBottom: '16px' }}>
          <FieldLabel required>Fitness level</FieldLabel>
          <ToggleGroup
            options={[
              { label: 'Beginner', value: 'beginner' },
              { label: 'Intermediate', value: 'intermediate' },
              { label: 'Experienced', value: 'experienced' },
            ]}
            value={fitnessLevel}
            onChange={setFitnessLevel}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <FieldLabel required>Weekly km</FieldLabel>
            <NumberInput value={weeklyKm} onChange={setWeeklyKm} placeholder="35" min={0} />
          </div>
          <div>
            <FieldLabel required>Longest recent run (km)</FieldLabel>
            <NumberInput value={longestRun} onChange={setLongestRun} placeholder="18" min={0} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <FieldLabel required>Resting HR</FieldLabel>
            <NumberInput value={restingHR} onChange={setRestingHR} placeholder="50" min={30} max={100} />
          </div>
          <div>
            <FieldLabel required>Max HR</FieldLabel>
            <NumberInput value={maxHR} onChange={setMaxHR} placeholder="185" min={130} max={220} />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <FieldLabel required>Days available per week</FieldLabel>
          <ToggleGroup
            options={[2,3,4,5,6].map(n => ({ label: String(n), value: String(n) as any }))}
            value={daysAvailable !== null ? String(daysAvailable) as any : null}
            onChange={(v: any) => setDaysAvailable(Number(v))}
          />
        </div>

        {/* More options */}
        <button
          onClick={() => setShowMore(v => !v)}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px', marginTop: '8px', marginBottom: '8px',
            background: 'none', border: '0.5px solid var(--border-col)', cursor: 'pointer',
            fontFamily: "'Inter', sans-serif", fontSize: '13px', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          {showMore ? 'Hide' : 'More options'}
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M5 8L10 13L15 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {showMore && (
          <>
            <SectionTitle>Schedule</SectionTitle>

            <div style={{ marginBottom: '16px' }}>
              <FieldLabel>Days you cannot train</FieldLabel>
              <MultiSelect
                options={DAYS}
                values={daysOff.map(d => DAYS[DAY_KEYS.indexOf(d)] ?? d)}
                onChange={selected => setDaysOff(selected.map(s => DAY_KEYS[DAYS.indexOf(s)] ?? s.toLowerCase()))}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <FieldLabel>Max weekday session (mins)</FieldLabel>
              <NumberInput value={maxWeekday} onChange={setMaxWeekday} placeholder="90" min={30} max={180} />
            </div>

            <SectionTitle>Preferences</SectionTitle>

            <div style={{ marginBottom: '16px' }}>
              <FieldLabel>Training style</FieldLabel>
              <ToggleGroup
                options={[
                  { label: 'Predictable', value: 'predictable' },
                  { label: 'Variety', value: 'variety' },
                  { label: 'Minimalist', value: 'minimalist' },
                  { label: 'Structured', value: 'structured' },
                ]}
                value={trainingStyle as any}
                onChange={setTrainingStyle as any}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <FieldLabel>Hard sessions</FieldLabel>
              <ToggleGroup
                options={[
                  { label: 'Avoid', value: 'avoid' },
                  { label: 'Neutral', value: 'neutral' },
                  { label: 'Love them', value: 'love' },
                  { label: 'Overdo it', value: 'overdo' },
                ]}
                value={hardSessions as any}
                onChange={setHardSessions as any}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <FieldLabel>Terrain</FieldLabel>
              <ToggleGroup
                options={[
                  { label: 'Road', value: 'road' },
                  { label: 'Trail', value: 'trail' },
                  { label: 'Mixed', value: 'mixed' },
                ]}
                value={terrain as any}
                onChange={setTerrain as any}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <FieldLabel>Injury history</FieldLabel>
              <MultiSelect options={INJURIES} values={injuries} onChange={setInjuries} />
            </div>
          </>
        )}

        {/* Generate */}
        <button
          onClick={handleGenerate}
          disabled={!isFormValid()}
          style={{
            width: '100%', padding: '16px', borderRadius: '12px', marginTop: '24px',
            background: isFormValid() ? 'var(--accent)' : 'var(--accent-dim)',
            border: 'none', cursor: isFormValid() ? 'pointer' : 'not-allowed',
            fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500,
            color: isFormValid() ? 'var(--zona-navy)' : 'var(--accent)',
            transition: 'all 0.15s',
          }}
        >
          Generate plan
        </button>
        {!isFormValid() && (
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '8px' }}>
            Fill in all required fields to continue
          </div>
        )}
      </div>
    </div>
  )
}
