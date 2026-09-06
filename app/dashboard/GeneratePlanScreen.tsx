// TIER-DIVERGENT — FREE:  8-step wizard (distance → race → goal → fitness → benchmark → schedule → constraints)
//                  PAID:  11-step wizard adds hard-sessions → terrain → injuries
// One decision per screen. Slide transitions between steps.
'use client'

import { useState, useEffect, useRef } from 'react'
import type { Plan, GeneratorInput, TrainingAge } from '@/types/plan'
import GeneratingCeremony from '@/components/GeneratingCeremony'
import { BRAND } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'
import { createEnrichSaveCoordinator } from '@/lib/plan/enrichSaveCoordinator'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import PlanIntroCard from '@/components/shared/PlanIntroCard'
import { DurationPicker } from '@/components/shared/DurationPicker'
import { TextField } from '@/components/shared/TextField'
import { WheelPicker } from '@/components/shared/WheelPicker'
import type { BenchmarkEstimate } from '@/lib/plan/aerobicEstimate'
import { Chip } from '@/components/shared/Chip'
import { type DayKey } from '@/components/shared/DayGridSelector'
import { Ruler } from '@/components/shared/Ruler'
import { CardSelect } from '@/components/shared/CardSelect'
import { recommendFitnessLevel, FITNESS_RANK, type FitnessLevel } from '@/lib/plan/fitnessAssessment'
import { WeekGrid } from '@/components/shared/WeekGrid'
import {
  defaultWeek, weekPlanToInputs, weekPlanFromLegacy, dayCountVerdict, type WeekPlan,
} from '@/components/shared/WeekGrid.logic'

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardSubStep =
  | 'distance' | 'race-details' | 'goal' | 'target-time'
  | 'teach-easy'
  | 'weekly-volume' | 'longest-run' | 'training-age' | 'recent-quality' | 'your-level' | 'birth-year'
  | 'benchmark' | 'teach-easy-day' | 'your-week' | 'weekday-ceiling'
  | 'hard-sessions' | 'terrain' | 'injuries'

type AppStep = WizardSubStep | 'generating' | 'preview' | 'error'

// Legacy key name — preserved to avoid wiping active user state. Future: migrate via key translation layer.
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

// Boundary maps between the wizard's persisted `days_cannot_train` wire format
// (full words — the form the engine's parsers document as accepted, see §18 and
// blockedDays()/parseBlockedDays()) and DayGridSelector's canonical DayKey.
// The primitive owns the Mon–Sun labels + order now; these only translate keys.
const FULL_BY_SHORT: Record<DayKey, string> = {
  mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
  fri: 'friday', sat: 'saturday', sun: 'sunday',
}
const SHORT_BY_FULL: Record<string, DayKey> = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu',
  friday: 'fri', saturday: 'sat', sunday: 'sun',
}
const INJURIES   = ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis']

// LEGACY — the weekly-volume + longest-run inputs are now the Ruler primitive
// (Coaching Board 2026-08-30; see GENERATION_CONFIG.WIZARD_VOLUME_RULER). These
// band tables are retained SOLELY to migrate a pre-Ruler `zona_wizard_draft`
// (label → km) on restore, so an in-flight draft doesn't lose its value across
// the deploy. Not rendered. Safe to delete once no legacy drafts remain.
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

// §89 — recent structured hard training. A tissue-readiness signal (what you've
// been DOING, past-tense) — not self-image. 'regular' can start quality sooner
// for an experienced, based, uninjured runner; every other answer keeps the full
// base. Labels are neutral descriptions of past practice — recognition, never an
// "unlock" (SLT framing guardrail).
type RecentQuality = 'none' | 'occasional' | 'regular'
const RECENT_QUALITY_CHIPS: { label: string; value: RecentQuality }[] = [
  { label: 'Mostly easy',  value: 'none'       },
  { label: 'Here and there', value: 'occasional' },
  { label: 'Most weeks',   value: 'regular'    },
]

const STEP_META: Record<WizardSubStep, { title: string; subtitle: string; optional?: boolean; eyebrow?: string; interstitial?: boolean; cta?: string }> = {
  'distance':        { title: 'How far?',              subtitle: 'Start with the finish line. Work backwards from there.' },
  'race-details':    { title: 'Tell me about the race.', subtitle: 'Race name is optional. The date is not.' },
  'goal':            { title: 'What matters most?',    subtitle: 'Crossing the line, or hitting a number. Both are valid.' },
  'target-time':     { title: "What's the target?",    subtitle: "Be honest. Optimistic goals make bad training plans." },
  'teach-easy':      { title: 'This plan will feel too easy at first.', subtitle: '', eyebrow: 'Hold the zone', interstitial: true, cta: 'Got it →' },
  'weekly-volume':   { title: 'How much are you running now?', subtitle: 'Last four weeks, roughly. Real numbers only.' },
  'longest-run':     { title: 'Longest run in the last six weeks?', subtitle: 'Tells us how much you can already hold.' },
  'training-age':    { title: 'How long have you been at this?', subtitle: 'Consistent months, not total years.', optional: true },
  'recent-quality':  { title: 'Been doing the hard stuff?', subtitle: 'Intervals, hills, tempo. Most weeks, lately? Honest answer.', optional: true },
  'your-level':      { title: 'Where are you right now?', subtitle: "Based on what you told us. Overrule it if we've got it wrong." },
  'birth-year':      { title: 'What year were you born?', subtitle: "Only to estimate your max heart rate, if you haven't set one. Kept private.", optional: true },
  'benchmark':       { title: 'Recent race result?',   subtitle: 'Gives us precise pace targets for every session. Skip if you haven\'t raced lately.', optional: true },
  'teach-easy-day':  { title: 'Easy should feel easy.', subtitle: '', eyebrow: 'The easy day', interstitial: true, cta: 'Continue →' },
  'your-week':       { title: 'Which days do you run?',  subtitle: 'Tap the days you train. Tap a weekend day again to make it your long run.' },
  'weekday-ceiling': { title: 'How long on a weekday?',  subtitle: 'Your cap Monday–Friday. Weekends stay open. Skip if you\'re flexible.', optional: true },
  'hard-sessions':   { title: 'You and hard sessions.', subtitle: 'Intervals, tempo, threshold. Where do you land?' },
  'terrain':         { title: 'Where do you run?',      subtitle: 'Road, trail, or a bit of both. Affects pace targets.' },
  'injuries':        { title: 'Anything to flag?',      subtitle: 'Old injuries that still show up. Skip if you\'re clean.', optional: true },
}

// ─── Step sequence ────────────────────────────────────────────────────────────

function getStepSequence(hasPaidAccess: boolean, goal: 'finish' | 'time_target' | null): WizardSubStep[] {
  const steps: WizardSubStep[] = ['distance', 'race-details', 'goal']
  if (goal === 'time_target') steps.push('target-time')
  // ⓘ teaching seams (CI-7): ⓘA right after the goal is stated (ambition peaks);
  // ⓘB after benchmark, just before they commit their week (pace is known).
  steps.push('teach-easy', 'weekly-volume', 'longest-run', 'training-age', 'recent-quality', 'your-level', 'birth-year', 'benchmark', 'teach-easy-day', 'your-week', 'weekday-ceiling')
  if (hasPaidAccess) steps.push('hard-sessions', 'terrain', 'injuries')
  return steps
}

// ─── Progress line ────────────────────────────────────────────────────────────
// A thin moss fill on a --line track — never a number. Per the wizard-redesign
// frontend-design pass (CI-1): "Step 7 of 12" turns setup into a chore and
// invites drop-off; the line reassures without counting.

function ProgressLine({ total, current }: { total: number; current: number }) {
  const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0
  return (
    <div style={{ height: '3px', borderRadius: '3px', background: 'var(--line)', margin: '0 0 24px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: 'var(--moss)',
        borderRadius: '3px', transition: 'width 0.25s ease',
      }} />
    </div>
  )
}

// ─── Shared primitives ────────────────────────────────────────────────────────

// Thin wrapper over the canonical TextField — kept so the wizard's many call
// sites stay unchanged while the actual control is the shared primitive.
function WizardInput({ value, onChange, placeholder, type = 'text', min, max }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  type?: 'text' | 'number' | 'date'; min?: number; max?: number
}) {
  return (
    <TextField
      value={value}
      onChange={onChange}
      type={type}
      placeholder={placeholder}
      min={min}
      max={max}
      inputMode={type === 'number' ? 'numeric' : undefined}
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
// OptionCard was extracted to the shared CardSelect primitive (row layout) —
// see components/shared/CardSelect.tsx and ui-patterns.md § Form Fields & Pickers.

// ─── Preview components ──────────────────────────────────────────────────────
// Plan-overview strip + per-phase summary cards. No horizontal scroll. No
// "+N more weeks" footer. Every week is represented in the strip; every
// phase has a card.

const PHASES = ['foundation', 'base', 'build', 'peak', 'taper'] as const

const PHASE_COLOUR: Record<string, string> = {
  foundation: 'var(--mute)',
  base:       'var(--s-easy)',
  build:      'var(--s-quality)',
  peak:       'var(--s-inter)',
  taper:      'var(--s-recov)',
}

const PHASE_DESCRIPTION: Record<string, string> = {
  foundation: 'Pre-plan easy running. Easy sessions only — no quality, no strides.',
  base:       'Aerobic foundation. Easy runs, nothing fancy.',
  build:      'One quality session a week. Everything else stays easy.',
  peak:       'Race-specific sharpening. Volume holds; the work gets specific.',
  taper:      'Volume drops. Race week is shakeouts only.',
}

// Full-width strip — every week as a coloured bar. No scrolling.
function PreviewPhaseStrip({ weeks }: { weeks: Plan['weeks'] }) {
  if (!weeks.length) return null
  const foundationCount = weeks.filter(w => w.phase === 'foundation').length
  const mainWeeks = weeks.filter(w => w.phase !== 'foundation')
  return (
    <div>
      {foundationCount > 0 && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginBottom: '6px', letterSpacing: '0.02em' }}>
          Foundation Block · {foundationCount} {foundationCount === 1 ? 'week' : 'weeks'} before your plan
        </div>
      )}
      <div style={{ display: 'flex', gap: '2px', height: '32px', alignItems: 'flex-end' }}>
        {weeks.map(w => {
          const isRaceWeek   = w.type === 'race'
          const isDeload     = w.badge === 'deload'
          const isFoundation = w.phase === 'foundation'
          const colour = isRaceWeek
            ? 'var(--s-race)'
            : PHASE_COLOUR[w.phase ?? 'base']
          return (
            <div
              key={w.n}
              title={isFoundation
                ? `Foundation · ${w.weekly_km}km`
                : `Week ${w.n} · ${w.weekly_km}km · ${w.phase ?? 'base'}${isDeload ? ' · recovery' : ''}${isRaceWeek ? ' · race' : ''}`}
              style={{
                flex: 1,
                height: isFoundation ? '60%' : '100%',  // subdued height for foundation
                borderRadius: '2px',
                background: colour,
                opacity: isFoundation ? 0.5 : (isDeload ? 0.35 : (isRaceWeek ? 1 : 0.85)),
                borderBottom: isFoundation ? '1px dashed var(--mute)' : undefined,
              }}
            />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {foundationCount > 0 ? 'Foundation' : 'Wk 1'}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Race · Wk {mainWeeks.length}
        </span>
      </div>
    </div>
  )
}

// Per-phase summary card — left accent in phase colour, key stats, character line.
function PhaseSummaryCard({ phase, weeks }: { phase: string; weeks: Plan['weeks'] }) {
  if (!weeks.length) return null
  const startW = weeks[0].n
  const endW   = weeks[weeks.length - 1].n
  const peakKm = Math.max(...weeks.map(w => w.weekly_km ?? 0))
  const colour = PHASE_COLOUR[phase] ?? 'var(--mute)'
  const description = PHASE_DESCRIPTION[phase] ?? ''
  // §57 — foundation weeks count DOWN to 0 (n <= 0); that's an internal
  // construction index, never a number to show a runner. Mirrors
  // PreviewPhaseStrip's own "N weeks before your plan" phrasing above
  // rather than a week-number range, which only ever makes sense from n=1.
  const weekRange = phase === 'foundation'
    ? `${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'}`
    : startW === endW ? `Week ${startW}` : `Weeks ${startW}–${endW}`
  return (
    <div style={{
      display: 'flex', gap: '14px',
      background: 'var(--card)',
      border: '1px solid var(--line)',
      borderLeft: `3px solid ${colour}`,
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
      marginBottom: '12px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 700, color: 'var(--ink)', textTransform: 'capitalize' }}>
            {phase}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)' }}>
            {weekRange} · peak {peakKm}km
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
          {description}
        </div>
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

// FREE plan-demand card (CoachingPrinciples §44 amendment / §31). Rule-engine
// output, so NO AIMark. Renders ONLY the demanding tiers — 'comfortable' and
// legacy plans (no band) render nothing (SLT 2026-08-18: silent on comfortable;
// the sentence is the surface, not a label/score). Amber = coaching caution
// (--warn), never --danger. Describes demand on the runner's timeline, not a
// verdict on the runner. Sits above the PAID ConfidenceBadge: feasibility (free)
// over quality (paid), so the two never read as competing scores. very_demanding
// additionally lists the §44 plan-level alternatives (never an upsell).
function DifficultyCard({ band, note, alternatives }: {
  band?: 'comfortable' | 'demanding' | 'very_demanding'
  note?: string
  alternatives?: string[]
}) {
  if (!band || band === 'comfortable' || !note) return null
  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', borderLeft: '3px solid var(--warn)', padding: '14px 16px', margin: '16px 0' }}>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.65 }}>
        {note}
      </div>
      {band === 'very_demanding' && alternatives?.length ? (
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {alternatives.map((alt, i) => (
            <div key={i} style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
              {alt}
            </div>
          ))}
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

// ADR-020 Option A — foundation-block construction moved server-side.
// /api/generate-plan now composes and validates foundation weeks before the
// plan ever reaches the client (composePlanWithFoundation, unfiltered
// validatePlan — see lib/plan/foundationCompose.ts). The client-side
// construction + best-effort console-only check that used to live here is
// gone; there is nothing left to validate on this side.

// ─── Main component ───────────────────────────────────────────────────────────

export default function GeneratePlanScreen({
  onBack, firstName: _firstName, lastName: _lastName, restingHR: initialRHR, maxHR: initialMHR,
  maxHrSource: initialMhrSource,
  birthYear: initialBirthYear, onBirthYearSave, onPlanSaved, onPlanEnriched, isOnboarding, hasExistingPlan, hasPaidAccess, onUpgrade,
}: {
  onBack: () => void
  firstName?: string
  lastName?: string
  restingHR?: number | null
  maxHR?: number | null
  /** §50 (HR-MAX-01) — provenance of the stored max, so a user_confirmed value
   *  survives regeneration instead of being floored as unattributed. */
  maxHrSource?: 'observed' | 'user_confirmed' | null
  birthYear?: number | null
  onBirthYearSave?: (year: number) => Promise<void>
  onPlanSaved?: (plan: Plan) => Promise<void>
  /** ENRICH-SAVE-01 — persist the AI-enriched copy that lands ~30s AFTER the
   *  runner has already committed to the plan. Never blocks them. */
  onPlanEnriched?: (plan: Plan) => Promise<void>
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
  // N8b — the preview is reachable as soon as the RULE plan is ready + the reveal
  // has played (fast). Waiting for the full enricher stream stranded the user on
  // "There it is." for 20–30s while the enricher ran — the ceremony is the
  // payoff, not the wait (ui-patterns §15). The enricher keeps streaming in the
  // background and `setPlan` swaps in the enriched plan live.
  //
  // ENRICH-SAVE-01 amends the second half of N8b: handleUsePlan no longer waits
  // for the stream either. It used to block up to 15s so the ENRICHED plan was
  // the one saved — but the enricher takes 28–35s, so the deadline expired and
  // it saved the bare rule plan anyway, silently. The enriched copy is now
  // written as a follow-up instead. Rule plan remains a valid standalone
  // fallback throughout (hybrid pattern, ADR-006).
  const [revealComplete, setRevealComplete] = useState(false)
  const [rulePlanReady, setRulePlanReady] = useState(false)
  // Mirrors for handleUsePlan, which may fire mid-stream and must read the LATEST
  // (enriched) plan + stream status, not a stale render closure.
  const planRef = useRef<Plan | null>(null)

  // ENRICH-SAVE-01 (2026-09-03) — save immediately, enrich in the background.
  //
  // The rule plan is ready in ~10ms; the enricher takes 28–35s (measured). The
  // previous flow blocked "Use this plan" for up to 15s waiting for it, which
  // was both a dead wait AND too short: when the deadline expired it saved the
  // bare rule plan, so a trial runner silently received an unenriched plan. That
  // was harmless while enrichment always failed (the fallback was the same
  // object); fixing enrichment in 2030f98 turned it into real data loss.
  //
  // ADR-006 already says the rule plan is complete and correct on its own and
  // the AI voice is a layer on top — so there is no reason to hold the runner
  // hostage to the topping. Save the plan they are looking at, let them go, and
  // write the enriched copy over it when it lands.
  //
  // The generation stream has no AbortController, so it survives this screen
  // unmounting on navigation and the patch still lands.
  // Ordering logic lives in lib/plan/enrichSaveCoordinator.ts so it is unit
  // testable — this repo has no component test harness, and an untested save
  // race is what shipped last time (N8).
  const coordRef = useRef(createEnrichSaveCoordinator<Plan>())

  // ── Foundation Block modal (Phase 4 — gap > 28 days) ─────────────────────
  const [foundationModalOpen, setFoundationModalOpen] = useState(false)
  // ADR-020 Option A — "Add Foundation Block" is now a real network call
  // (POST /api/generate-plan/foundation), not a synchronous local
  // computation, so it needs first-class loading/error UI state (INV-UI-004)
  // — this codebase has no shared toast component; per-feature local state is
  // the existing convention (see setAiNote/setRecalStatus in DashboardClient).
  const [foundationAddStatus, setFoundationAddStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  // Preserve the last generator input so the foundation block can use it
  const lastInputRef = useRef<GeneratorInput | null>(null)

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
  // Year of birth (not full DOB) — App Store Guideline 5.1.1 data minimisation.
  // Only used for Tanaka max-HR fallback (208 − 0.7 × age) and masters threshold.
  const [birthYear, setBirthYear] = useState<number | null>(initialBirthYear ?? null)
  const [weeklyKm,   setWeeklyKm]   = useState<number | null>(null)
  const [longestRun, setLongestRun] = useState<number | null>(null)
  const [restingHR,      setRestingHR]      = useState(initialRHR ? String(initialRHR) : '')
  const [trainingAge,    setTrainingAge]    = useState<TrainingAge | null>(null)
  // §89 — recent structured hard training. null = unanswered = full base (safe
  // default). Only 'regular' can shorten the base, and only for an experienced,
  // based, uninjured runner (the engine gates it).
  const [recentQuality,  setRecentQuality]  = useState<RecentQuality | null>(null)
  // §79 — the runner's self-selected level. null = accept the engine's
  // recommendation (which keeps the Phase-1 structural/intensity split); a value
  // is a deliberate override that sets input.fitness_level.
  const [fitnessLevel,   setFitnessLevel]   = useState<FitnessLevel | null>(null)

  // ── Step 6 — Benchmark ───────────────────────────────────────────────────
  const [benchmarkType,    setBenchmarkType]    = useState<'race' | 'tt_30min' | null>(null)
  const [benchmarkDistKm,  setBenchmarkDistKm]  = useState<number | null>(null)
  const [benchHours,       setBenchHours]       = useState(0)
  const [benchMins,        setBenchMins]        = useState(0)
  const [benchmarkDate,    setBenchmarkDate]    = useState('')
  const [benchmarkTTDist,  setBenchmarkTTDist]  = useState('')

  // CI-4 — auto-estimated benchmark from recent runs. `benchMode` flips to
  // 'manual' when the user taps "Let me adjust" (or when no estimate is available).
  const [benchEstimate,       setBenchEstimate]       = useState<BenchmarkEstimate | null>(null)
  const [benchEstimateStatus, setBenchEstimateStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [benchMode,           setBenchMode]           = useState<'confirm' | 'manual'>('manual')

  // ── Your week — the keystone grid (Option A). One WeekPlan owns which days
  //    are Rest/Run/Long; days_available, days_cannot_train and
  //    preferred_long_run_day are DERIVED from it (weekPlanToInputs), never
  //    stored separately. Replaces the old days-per-week + days-off steps.
  const [weekPlan,       setWeekPlan]       = useState<WeekPlan>(defaultWeek())
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
      if (typeof s.birthYear === 'number') setBirthYear(s.birthYear)
      // New numeric form (Ruler); fall back to the pre-Ruler label bucket so a
      // draft saved mid-wizard before this shipped still restores its value.
      if (typeof s.weeklyKm === 'number')   setWeeklyKm(s.weeklyKm)
      else if (s.weeklyKmChip)   setWeeklyKm(WEEKLY_KM_CHIPS.find(c => c.label === s.weeklyKmChip)?.value ?? null)
      if (typeof s.longestRun === 'number') setLongestRun(s.longestRun)
      else if (s.longestRunChip) setLongestRun(LONGEST_RUN_CHIPS.find(c => c.label === s.longestRunChip)?.value ?? null)
      if (s.restingHR)       setRestingHR(s.restingHR)
      if (s.trainingAge)     setTrainingAge(s.trainingAge)
      if (s.recentQuality)   setRecentQuality(s.recentQuality)
      if (s.fitnessLevel)    setFitnessLevel(s.fitnessLevel)
      if (s.benchmarkType)   setBenchmarkType(s.benchmarkType)
      if (s.benchmarkDistKm) setBenchmarkDistKm(s.benchmarkDistKm)
      if (typeof s.benchHours === 'number') setBenchHours(s.benchHours)
      if (typeof s.benchMins  === 'number') setBenchMins(s.benchMins)
      if (s.benchmarkTTDist) setBenchmarkTTDist(s.benchmarkTTDist)
      if (s.benchmarkDate)   setBenchmarkDate(s.benchmarkDate)
      // New: single weekPlan. Back-compat: rebuild it from the pre-grid separate
      // fields (days-off + long-run day) so a legacy draft doesn't lose the week.
      if (s.weekPlan && typeof s.weekPlan === 'object') setWeekPlan(s.weekPlan as WeekPlan)
      else if (Array.isArray(s.daysOff) || s.preferredLongRunDay) {
        const restShort = (Array.isArray(s.daysOff) ? s.daysOff : [])
          .map((f: string) => SHORT_BY_FULL[f]).filter(Boolean) as DayKey[]
        const longDay = s.preferredLongRunDay === 'sat' || s.preferredLongRunDay === 'sun'
          ? s.preferredLongRunDay : null
        setWeekPlan(weekPlanFromLegacy(restShort, longDay))
      }
      if (s.maxWeekdayChip)  setMaxWeekdayChip(s.maxWeekdayChip)
      if (s.hardSessions)    setHardSessions(s.hardSessions)
      if (s.terrain)         setTerrain(s.terrain)
      if (Array.isArray(s.injuries)) setInjuries(s.injuries)
      // Restore sub-step if it's a valid wizard step name
      const validSubSteps: WizardSubStep[] = ['distance','race-details','goal','target-time','teach-easy','weekly-volume','longest-run','training-age','recent-quality','your-level','birth-year','benchmark','teach-easy-day','your-week','weekday-ceiling','hard-sessions','terrain','injuries']
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
        birthYear, weeklyKm, longestRun, restingHR, trainingAge, recentQuality, fitnessLevel,
        benchmarkType, benchmarkDistKm, benchHours, benchMins, benchmarkTTDist, benchmarkDate,
        weekPlan, maxWeekdayChip,
        hardSessions, terrain, injuries,
      }))
    } catch {}
  }, [appStep, distanceKm, raceName, raceDate, goal,
      targetHours, targetMins,
      birthYear, weeklyKm, longestRun, restingHR, trainingAge, recentQuality,
      benchmarkType, benchmarkDistKm, benchHours, benchMins, benchmarkTTDist, benchmarkDate,
      weekPlan, maxWeekdayChip,
      hardSessions, terrain, injuries])

  // (The old "clear out-of-range days-per-week when distance gets stricter"
  //  effect is gone: the your-week grid derives the day count live and the
  //  threshold verdict blocks Continue directly — nothing stale to clear.)

  // CI-4 — auto-estimate the benchmark when the benchmark step opens. Native
  // only (web has no HealthKit → manual). HR is read client-side (the only place
  // that works on device); the FREE route reads the runs + does the math. Any
  // failure or no-data resolves to the manual ask — never a dead end.
  useEffect(() => {
    if (appStep !== 'benchmark' || benchEstimateStatus !== 'idle' || distanceKm == null) return
    let cancelled = false

    // Hard cap: the estimate is a nicety, never a gate. Whatever happens — a
    // hung HealthKit read, a stalled getSession, a slow network — the skeleton
    // clears and the manual benchmark ask appears. (Bug: on device any of those
    // three awaits could hang with no timeout, stranding the user on a grey
    // skeleton forever.) `withTimeout` bounds each step; this bounds the whole.
    const capMs = 6000
    const capId = setTimeout(() => { if (!cancelled) setBenchEstimateStatus('done') }, capMs)

    const withTimeout = <T,>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
      Promise.race([p, new Promise<T>(r => setTimeout(() => r(fallback), ms))])

    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) { if (!cancelled) setBenchEstimateStatus('done'); return }
        let rhr: number | null = initialRHR ?? (restingHR ? Number(restingHR) : null)
        let mhr: number | null = initialMHR ?? null
        if (rhr == null || mhr == null) {
          try {
            const { fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
            const snap = await withTimeout(fetchAppleHealthHRSnapshot(), 3500, null)
            rhr = rhr ?? snap?.restingHR ?? null
            mhr = mhr ?? snap?.maxHR ?? null
          } catch { /* HR unavailable → route answers no_hr → manual */ }
        }
        if (!cancelled) setBenchEstimateStatus('loading')
        const supabase = createClient()
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(), 3500, { data: { session: null } } as any,
        )
        const qs = new URLSearchParams({ raceDistanceKm: String(distanceKm) })
        if (rhr != null) qs.set('rhr', String(rhr))
        if (mhr != null) qs.set('mhr', String(mhr))
        const ctrl = new AbortController()
        const fetchTimer = setTimeout(() => ctrl.abort(), 4000)
        let data: BenchmarkEstimate = { available: false, reason: 'no_runs' }
        try {
          const res = await fetch(`/api/wizard-benchmark-estimate?${qs.toString()}`, {
            signal: ctrl.signal,
            headers: { ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          })
          if (res.ok) data = await res.json()
        } catch { /* aborted / network — manual is the fallback */ }
        clearTimeout(fetchTimer)
        if (cancelled) return
        setBenchEstimate(data)
        if (data.available) {
          // Pre-fill so "That's about right" (the sticky CTA) proceeds, and so a
          // later "Let me adjust" shows the estimate in the editable controls.
          setBenchmarkType('race')
          setBenchmarkDistKm(data.distanceKm)
          setBenchHours(Math.floor(data.timeSeconds / 3600))
          setBenchMins(Math.floor((data.timeSeconds % 3600) / 60))
          setBenchMode('confirm')
        }
      } catch { /* swallow — manual is the fallback */ }
      if (!cancelled) setBenchEstimateStatus('done')
    })()

    return () => { cancelled = true; clearTimeout(capId) }
    // benchEstimateStatus is set INSIDE this effect (→ 'loading' → 'done').
    // Including it as a dep tore the effect down the instant we set 'loading',
    // which flipped `cancelled` true and cancelled the 'done' that clears the
    // skeleton — the effect stranded itself on the grey loading state (only on
    // native, where the code actually reaches 'loading'). Gate on it via the
    // closure read above, never as a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appStep, distanceKm])

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
    // D6: "Adjust inputs" from the preview returns to the FIRST wizard step, not
    // the last. Landing on the last step forced the user to page backwards to
    // reach earlier fields. All field values are independent state and preserved,
    // so this is a quick walk-through, not a re-entry. (The error-screen retry
    // still jumps to the last step via its own handler — unchanged.)
    if (appStep === 'preview') {
      const sequence = getStepSequence(!!hasPaidAccess, goal)
      navigateTo(sequence[0], 'back')
      return
    }
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
      case 'weekly-volume':  return weeklyKm !== null
      case 'longest-run':    return longestRun !== null
      // training-age + birth-year are optional (App Store 5.1.1 — year of birth
      // "should be optional"; the engine falls back to age 30 / no training-age).
      case 'training-age':   return true
      case 'recent-quality': return true   // optional — unanswered = full base (safe default)
      case 'your-level':     return true  // pre-selected to the recommendation
      case 'birth-year':     return true
      case 'benchmark':
        if (benchmarkType === 'race')     return !!(benchmarkDistKm && (benchHours > 0 || benchMins > 0))
        if (benchmarkType === 'tt_30min') return benchmarkTTDist !== ''
        return true
      case 'your-week': {
        // Enough training days for the distance. warn (time goal, below the
        // recommended count) still proceeds — only a hard block stops.
        const wi = weekPlanToInputs(weekPlan)
        const distKey = distanceKm ? raceDistanceKey(distanceKm) : null
        const thr = distKey ? GENERATION_CONFIG.DAYS_AVAILABILITY_THRESHOLDS[distKey] : null
        return dayCountVerdict(wi.daysAvailable, thr ?? null, distKey, goal === 'time_target').state !== 'blocked'
      }
      case 'weekday-ceiling': return true
      case 'hard-sessions':  return true
      case 'terrain':        return true
      case 'injuries':       return true
      default:               return true
    }
  }

  // ── Plan generation ───────────────────────────────────────────────────────

  async function handleGenerate() {
    setRevealComplete(false)
    setRulePlanReady(false)
    setAppStep('generating')
    setError(null)
    setPlan(null)

    const ageYears      = birthYear !== null ? new Date().getFullYear() - birthYear : 30
    const weeklyKmVal   = weeklyKm   ?? GENERATION_CONFIG.WIZARD_VOLUME_RULER.WEEKLY_KM_ANCHOR
    const longestRunVal = longestRun ?? GENERATION_CONFIG.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_ANCHOR
    const targetTimeStr = goal === 'time_target' && (targetHours > 0 || targetMins > 0)
      ? `${targetHours}:${String(targetMins).padStart(2, '0')}:00` : undefined
    const benchTimeStr  = benchHours > 0 || benchMins > 0
      ? `${benchHours}:${String(benchMins).padStart(2, '0')}:00` : undefined
    const maxWeekdayVal = maxWeekdayChip
      ? MAX_WEEKDAY_CHIPS.find(c => c.label === maxWeekdayChip)?.value : undefined
    // The one engine touch: derive the schedule fields from the week grid.
    const week = weekPlanToInputs(weekPlan)

    const benchmark = (() => {
      const dateField = benchmarkDate ? { benchmark_date: benchmarkDate } : {}
      if (benchmarkType === 'race' && benchmarkDistKm && benchTimeStr)
        return { type: 'race' as const, distance_km: benchmarkDistKm, time: benchTimeStr, ...dateField }
      if (benchmarkType === 'tt_30min' && benchmarkTTDist)
        return { type: 'tt_30min' as const, distance_km: Number(benchmarkTTDist), time: '30:00', ...dateField }
      return undefined
    })()

    // Auto-populate HR from Apple Health when values are missing.
    // Runs on iOS native only; web/PWA falls through silently.
    // Failure is always silent — Tanaka formula fires as the fallback.
    // The generating ceremony covers this extra async step's wall-clock time.
    let hkRHR: number | null = initialRHR ?? (restingHR ? Number(restingHR) : null)
    let hkMHR: number | null = initialMHR ?? null
    // CoachingPrinciples §50 (HR-MAX-01) — track where max HR came from.
    // fetchAppleHealthHRSnapshot returns the highest heart rate on record, which
    // is a floor rather than a maximum for anyone who has never run flat out
    // wearing a sensor. A value inherited from user_settings carries its stored
    // provenance ('user_confirmed' when the runner typed it in Profile); a fresh
    // device read here is tagged 'observed'.
    let mhrSource: 'observed' | 'user_confirmed' | undefined =
      initialMHR != null ? (initialMhrSource ?? undefined) : undefined
    if (!hkRHR || !hkMHR) {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) {
          const { fetchAppleHealthHRSnapshot } = await import('@/lib/health/clientSync')
          const snap = await fetchAppleHealthHRSnapshot()
          if (snap) {
            hkRHR = hkRHR ?? snap.restingHR
            if (hkMHR == null && snap.maxHR != null) {
              hkMHR = snap.maxHR
              mhrSource = 'observed'
            }
          }
        }
      } catch {}
    }

    // §79 (2026-09-02) — send the runner's level on `user_declared_level`,
    // WHETHER ACCEPTED OR OVERRIDDEN, and never on `fitness_level` (which is the
    // API's structural declaration and would set peak km).
    //
    // The earlier revision passed the level only on a genuine override, and
    // passed `undefined` on accept, because `fitness_level` bound peak km and
    // threading an accepted level through pushed ordinary runners into a
    // `maintenance` label. That workaround left an honesty seam: the level the
    // runner saw and accepted was not the value the engine received. Now that a
    // declaration cannot touch structure upward, the seam closes — the engine
    // receives exactly what the runner chose.
    const levelRec = recommendFitnessLevel(
      weeklyKmVal, longestRunVal,
      trainingAge === '2-5yr' || trainingAge === '5yr+',
    )
    const declaredLevel = fitnessLevel ?? levelRec.level

    const input: GeneratorInput = {
      race_date:             raceDate,
      race_distance_km:      distanceKm!,
      race_name:             raceName || undefined,
      goal:                  goal!,
      target_time:           targetTimeStr,
      age:                   ageYears,
      current_weekly_km:     weeklyKmVal,
      longest_recent_run_km: longestRunVal,
      days_available:        week.daysAvailable,
      resting_hr:            hkRHR ?? undefined,
      max_hr:                hkMHR ?? undefined,
      max_hr_source:         mhrSource,
      training_age:          trainingAge ?? undefined,
      recent_quality_training: recentQuality ?? undefined,
      user_declared_level:   declaredLevel,
      preferred_long_run_day: week.longDay ?? 'sun',
      benchmark,
      days_cannot_train:     week.restShort.length ? week.restShort.map(k => FULL_BY_SHORT[k]) : undefined,
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

      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(input),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong building the plan.')
        setAppStep('error')
        return
      }

      // ADR-020 Option A — the server already composed foundation weeks into
      // `incoming` for the 'auto' gap band (7-28 days) and stamped
      // meta.foundation_gap_class. The only remaining client job is the
      // 'choice' band (>28 days): the server deliberately did NOT add a
      // block — it's the runner's call — so show the modal and stash the
      // input for the follow-up POST /api/generate-plan/foundation call if
      // they choose "Add".
      const applyFoundationIfNeeded = (incoming: Plan): Plan => {
        if (incoming.meta.foundation_gap_class === 'choice') {
          lastInputRef.current = input
          setFoundationModalOpen(true)
        }
        return incoming
      }

      const contentType = res.headers.get('content-type') ?? ''

      // Free tier: server returns plain JSON with the rule plan only.
      if (!contentType.includes('ndjson')) {
        const data = await res.json()
        setPlan(applyFoundationIfNeeded(data.plan as Plan))
        setRulePlanReady(true)
        return
      }

      // Trial/paid: NDJSON stream — rule_plan first, then final_plan.
      // Setting the plan as soon as rule_plan arrives lets the ceremony
      // begin its reveal while the enricher is still running.
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl = buffer.indexOf('\n')
        while (nl !== -1) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          nl = buffer.indexOf('\n')
          if (!line) continue
          const msg = JSON.parse(line) as { type: 'rule_plan' | 'final_plan'; plan: Plan }
          if (msg.type === 'rule_plan') {
            setPlan(applyFoundationIfNeeded(msg.plan))
            setRulePlanReady(true)   // preview reachable now; enricher streams on
          } else if (msg.type === 'final_plan') {
            // ADR-020 Option A — the server already re-attaches foundation
            // weeks onto final_plan for the 'auto' band and any decision
            // already known when /api/generate-plan ran. This client-side
            // splice still exists for one specific race: the "Add Foundation
            // Block" modal (gapClass 'choice') can be answered via the
            // separate POST /api/generate-plan/foundation call WHILE this
            // stream is still open (enrichment takes 28-35s) — a decision the
            // server generating THIS stream has no way to know about. Only
            // planRef (kept in sync with plan state) can see it, so re-derive
            // from there rather than trusting the stream's own foundation
            // weeks to be complete.
            //
            // Merged from planRef, not via a setPlan updater, because this can
            // run after the screen has unmounted (the runner already saved and
            // navigated). setState is a no-op then, so the updater's `current`
            // would never be read and the enriched plan would be lost.
            const enriched = msg.plan
            // Only splice from planRef when `enriched` genuinely has none —
            // for the 'auto' band (and any 'choice' decision already known
            // when this stream's own /api/generate-plan call ran), the
            // server's finalPlan ALREADY carries foundation weeks. Splicing
            // unconditionally double-counted them (2 foundation weeks became
            // 4 — confirmed 2026-09-03 against a real generated plan).
            const alreadyHasFoundation = enriched.weeks.some(w => w.n <= 0)
            const foundationWeeks = alreadyHasFoundation
              ? []
              : planRef.current?.weeks.filter(w => w.n <= 0) ?? []
            const merged: Plan = foundationWeeks.length
              ? { ...enriched, weeks: [...foundationWeeks, ...enriched.weeks] }
              : enriched
            planRef.current = merged
            setPlan(merged)

            // ENRICH-SAVE-01 — the runner may already have committed. Persist
            // the enriched copy over what they saved. Fire-and-forget: they
            // hold a valid plan either way (ADR-006), so this must never
            // surface an error or block anything.
            // 'queue'/'ignore' need no action here — the coordinator holds a
            // mid-save arrival, and a pre-save arrival is already on planRef.
            if (coordRef.current.enrichmentArrived(merged) === 'patch') {
              void onPlanEnriched?.(merged)
            }
          }
        }
      }
    } catch {
      setError('Could not reach the server. Check your connection.')
      setAppStep('error')
    }
  }

  // ── Foundation Block modal handlers ──────────────────────────────────────

  // ADR-020 Option A — construction moved server-side. This used to be a
  // synchronous local splice; now it's a real POST that can fail, so it needs
  // loading/error handling it never needed before (INV-UI-004). On failure,
  // the runner keeps whatever plan they already have (ADR-006) — the modal
  // stays open with a retry affordance rather than silently closing.
  async function handleFoundationAddBlock() {
    if (!plan || !lastInputRef.current) { setFoundationModalOpen(false); return }
    setFoundationAddStatus('loading')
    try {
      const res = await fetch('/api/generate-plan/foundation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: lastInputRef.current, plan }),
      })
      if (!res.ok) throw new Error(`foundation add failed: ${res.status}`)
      const data = await res.json() as { plan: Plan }
      setPlan(data.plan)
      setFoundationAddStatus('idle')
      setFoundationModalOpen(false)
    } catch {
      setFoundationAddStatus('error')
    }
  }

  function handleFoundationSkip() {
    setFoundationAddStatus('idle')
    setFoundationModalOpen(false)
  }

  function handleFoundationStartNow() {
    // No structural change — the plan starts at plan_start as generated.
    // "Start now" communicates user intent to begin immediately without a block.
    setFoundationAddStatus('idle')
    setFoundationModalOpen(false)
  }

  async function handleUsePlan() {
    if (!planRef.current || !onPlanSaved) return
    setIsSaving(true)
    coordRef.current.beginSave()
    try {
      // ENRICH-SAVE-01 — no wait. Save the plan the runner is looking at and let
      // them go; the enricher (28–35s) keeps streaming and patches its copy in
      // when it lands. If it has already arrived, planRef holds the enriched
      // plan and it is saved here directly.
      if (birthYear !== null && onBirthYearSave) await onBirthYearSave(birthYear).catch(() => {})
      await onPlanSaved(planRef.current)
      sessionStorage.removeItem(WIZARD_KEY)

      // Enrichment that landed mid-save is safe to write now the save has.
      const queued = coordRef.current.saveCompleted()
      if (queued) void onPlanEnriched?.(queued)
    } catch {
      coordRef.current.saveFailed()
      setIsSaving(false)
    }
  }

  // N8b — advance to preview once the RULE plan is ready AND the reveal has
  // played (fast). The enricher keeps streaming in the background; handleUsePlan
  // waits for it before saving so the enriched plan wins.
  useEffect(() => {
    if (appStep === 'generating' && rulePlanReady && revealComplete) setAppStep('preview')
  }, [appStep, rulePlanReady, revealComplete])

  // Keep refs in step for handleUsePlan (reads latest plan + stream status).
  useEffect(() => { planRef.current = plan }, [plan])

  // ── Special screens (ceremony / preview / error) ──────────────────────────

  if (appStep === 'generating') {
    return (
      <GeneratingCeremony
        hasPaidAccess={!!hasPaidAccess}
        plan={plan}
        onRevealComplete={() => setRevealComplete(true)}
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
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
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

        {/* Content scrolls internally (flex:1 + overflow); the CTA below is a
            flexShrink:0 footer, so it sits beneath this — no overlap, no sticky
            float. (Was position:sticky over an unbounded minHeight:100% wrapper,
            which floated the CTA over the plan on native — D7 padding was papering
            over a broken scroll model. Now matches the wizard footer.) */}
        <div style={{ flex: 1, padding: '0 20px 24px', overflowY: 'auto' }}>
          {/* FREE demand band — feasibility read, above the PAID confidence score */}
          <DifficultyCard band={meta.difficulty_band} note={meta.difficulty_note} alternatives={meta.prep_time_alternatives} />
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

          {/* CA-01 — FREE first-plan "why this plan" intro (Kit's voice). Never
              co-exists with the paid coach_intro above. */}
          {meta.plan_intro && (
            <div style={{ margin: '16px 0' }}>
              <PlanIntroCard text={meta.plan_intro} />
            </div>
          )}

          <div style={{ margin: '20px 0 0' }}>
            <PreviewPhaseStrip weeks={weeks} />
          </div>

          <div style={{ marginTop: '20px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Plan shape
            </div>
            {PHASES.map(phase => {
              const phaseWeeks = weeks.filter(w => w.phase === phase)
              if (!phaseWeeks.length) return null
              return <PhaseSummaryCard key={phase} phase={phase} weeks={phaseWeeks} />
            })}
          </div>
        </div>

        <div style={{ flexShrink: 0, background: 'var(--bg)', borderTop: '1px solid var(--line)', padding: '12px 20px calc(12px + env(safe-area-inset-bottom))' }}>
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

        {/* Foundation Block choice modal — shown when gap > 28 days */}
        {foundationModalOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(26,26,26,0.55)',
            display: 'flex', alignItems: 'flex-end',
          }}>
            <div style={{
              width: '100%', background: 'var(--card)',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
              padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
            }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '18px', fontWeight: 800, color: 'var(--ink)', marginBottom: '6px' }}>
                You've got some time.
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: '24px' }}>
                Your plan doesn't start for a while. A Foundation Block can ease you in — easy runs only, no pressure.
              </div>

              {foundationAddStatus === 'error' && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--warn)', marginBottom: '10px' }}>
                  Couldn't add that. Try again.
                </div>
              )}
              <button
                onClick={handleFoundationAddBlock}
                disabled={foundationAddStatus === 'loading'}
                style={{
                  width: '100%', padding: '15px', marginBottom: '10px',
                  borderRadius: 'var(--radius-md)', background: 'var(--moss)',
                  border: 'none', cursor: foundationAddStatus === 'loading' ? 'default' : 'pointer',
                  opacity: foundationAddStatus === 'loading' ? 0.7 : 1,
                  fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--card)',
                }}
              >
                {foundationAddStatus === 'loading' ? 'Adding…' : 'Add Foundation Block'}
              </button>
              <button
                onClick={handleFoundationStartNow}
                style={{
                  width: '100%', padding: '15px', marginBottom: '10px',
                  borderRadius: 'var(--radius-md)', background: 'var(--bg-soft)',
                  border: '1px solid var(--line)', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 500, color: 'var(--ink)',
                }}
              >
                Start plan as-is
              </button>
              <button
                onClick={handleFoundationSkip}
                style={{
                  width: '100%', padding: '12px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)',
                }}
              >
                Decide later
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Wizard ────────────────────────────────────────────────────────────────

  const currentSubStep = appStep as WizardSubStep
  const sequence       = getStepSequence(!!hasPaidAccess, goal)
  const currentIdx     = sequence.indexOf(currentSubStep)
  const isLastStep     = currentIdx === sequence.length - 1
  const stepMeta       = STEP_META[currentSubStep] ?? STEP_META['distance']
  // CI-4 9a: on the auto-estimate confirm card, the estimate IS the frame title
  // and the sticky CTA reads "That's about right" (an explicit confirm, not a
  // generic Continue).
  const benchConfirm   = currentSubStep === 'benchmark' && benchMode === 'confirm' && !!benchEstimate?.available
  const ctaLabel       = benchConfirm
    ? "That's about right →"
    : (stepMeta.cta ?? (isLastStep ? 'Generate my plan →' : 'Continue'))

  // Progress counts real questions only — the teaching interstitials don't
  // advance the line (CI-7: they're a moment, not a step to tick off).
  const realSteps = sequence.filter(s => !STEP_META[s]?.interstitial)
  const realDone  = sequence.slice(0, currentIdx + 1).filter(s => !STEP_META[s]?.interstitial).length

  const welcomeOverride = isOnboarding && currentSubStep === 'distance'
    ? { title: 'Start with the finish line.', subtitle: 'Work backwards from there.' }
    : null

  const benchmarkOverride = benchConfirm && benchEstimate && benchEstimate.available
    ? {
        title: `Looks like a ${DISTANCES.find(d => d.value === benchEstimate.distanceKm)?.label ?? `${benchEstimate.distanceKm}K`} in about ${benchEstimate.formattedTime}.`,
        subtitle: `${benchEstimate.label}. Close?`,
      }
    : null

  const title    = welcomeOverride?.title    ?? benchmarkOverride?.title    ?? stepMeta.title
  const subtitle = welcomeOverride?.subtitle ?? benchmarkOverride?.subtitle ?? stepMeta.subtitle

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
      {/* Header — back button + progress */}
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        {!(isOnboarding && currentIdx === 0) && <BackBtn onClick={goBack} />}
        <ProgressLine total={realSteps.length} current={Math.max(0, realDone - 1)} />
        <div style={{ marginBottom: stepMeta.interstitial ? '20px' : '28px', marginTop: stepMeta.interstitial ? '28px' : 0 }}>
          {stepMeta.eyebrow && (
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              {stepMeta.eyebrow}
            </div>
          )}
          <h1 style={{ fontFamily: 'var(--font-ui)', fontSize: '26px', fontWeight: 800, color: 'var(--ink)', letterSpacing: '-0.5px', marginBottom: '8px', margin: '0 0 8px' }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)', lineHeight: 1.55, margin: 0 }}>
              {subtitle}
            </p>
          )}
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

      // ── Teaching interstitials (CI-7) — headline is the frame title; the body
      //    lives here. No control; Continue commits like any screen. ─────────────
      case 'teach-easy':
        return (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--ink-2)', lineHeight: 1.7, margin: 0, maxWidth: '30ch' }}>
            That&apos;s on purpose. Most runners live in a grey middle — too hard to recover, too easy to improve. We&apos;re going to pull those apart.
          </p>
        )

      case 'teach-easy-day':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '16px', color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>
              Most runners push their easy days and coast their hard ones — so every run lands in the same tiring middle. Even elites spend about 80% of their time truly easy. Your easy runs build the engine. Let them.
            </p>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '17px', fontWeight: 700, color: 'var(--moss)', margin: 0 }}>
              {BRAND.voiceAnchor}
            </p>
          </div>
        )

      // ── Distance ───────────────────────────────────────────────────────────
      case 'distance':
        return (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {DISTANCES.map(d => {
              const locked = d.paid && !hasPaidAccess
              return (
                <CardSelect
                  key={d.value}
                  layout="tile"
                  label={d.label}
                  sub={d.sub}
                  active={distanceKm === d.value}
                  locked={locked}
                  lockLabel="PAID"
                  ariaLabel={d.label}
                  onClick={() => (locked ? onUpgrade?.() : setDistanceKm(d.value))}
                />
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
            <CardSelect
              label="Just finish."
              sub="Get to the line in one piece. That's the job."
              active={goal === 'finish'}
              onClick={() => setGoal('finish')}
            />
            <CardSelect
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
      // ── Fitness — split one-question-per-screen (CI-1) ───────────────────────
      case 'weekly-volume':
        return (
          <Ruler
            ariaLabel="Average weekly kilometres, last 4 weeks"
            value={weeklyKm}
            onChange={setWeeklyKm}
            min={GENERATION_CONFIG.WIZARD_VOLUME_RULER.WEEKLY_KM_MIN}
            max={GENERATION_CONFIG.WIZARD_VOLUME_RULER.WEEKLY_KM_MAX}
            step={GENERATION_CONFIG.WIZARD_VOLUME_RULER.WEEKLY_KM_STEP}
            restAnchor={GENERATION_CONFIG.WIZARD_VOLUME_RULER.WEEKLY_KM_ANCHOR}
            unit="km/week"
          />
        )

      case 'longest-run':
        return (
          <Ruler
            ariaLabel="Longest run in the last 6 weeks"
            value={longestRun}
            onChange={setLongestRun}
            min={GENERATION_CONFIG.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_MIN}
            max={GENERATION_CONFIG.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_MAX}
            step={GENERATION_CONFIG.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_STEP}
            restAnchor={GENERATION_CONFIG.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_ANCHOR}
            unit="km"
          />
        )

      case 'training-age':
        return (
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
        )

      case 'recent-quality':
        return (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {RECENT_QUALITY_CHIPS.map(c => (
              <Chip
                key={c.value}
                label={c.label}
                active={recentQuality === c.value}
                onClick={() => setRecentQuality(recentQuality === c.value ? null : c.value)}
              />
            ))}
          </div>
        )

      case 'your-level': {
        // §79 — recommendation from volume + longest run + training age (no VDOT
        // yet; benchmark comes later). Same owner the engine uses (no drift).
        const rec = recommendFitnessLevel(
          weeklyKm ?? 0, longestRun ?? 0,
          trainingAge === '2-5yr' || trainingAge === '5yr+',
        )
        const effective = fitnessLevel ?? rec.level
        const overrodeUp   = FITNESS_RANK[effective] > FITNESS_RANK[rec.level]
        const overrodeDown = FITNESS_RANK[effective] < FITNESS_RANK[rec.level]

        const LEVELS: { value: FitnessLevel; label: string; sub: string }[] = [
          { value: 'beginner',     label: 'Building the base.',   sub: 'Newer to it, or rebuilding. Easy running, no hard sessions yet.' },
          { value: 'intermediate', label: 'Got a base.',          sub: 'Used to some hard running. Tempo and threshold in the mix.' },
          { value: 'experienced',  label: 'The full toolkit.',    sub: 'Consistent miles, comfortable with intervals, threshold, hills.' },
        ]

        const whyLine = rec.isReturning
          ? "You've got the miles in your legs — just not this month. That's not beginner, that's coming back."
          : 'Based on your volume and history. Change it if we’ve read you wrong.'

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.5, marginBottom: '4px' }}>
              {whyLine}
            </div>
            {LEVELS.map(l => (
              <CardSelect
                key={l.value}
                label={l.label}
                sub={l.value === rec.level ? `${l.sub}  ·  Recommended` : l.sub}
                active={effective === l.value}
                onClick={() => setFitnessLevel(l.value)}
              />
            ))}
            {overrodeUp && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--warn)', lineHeight: 1.5, marginTop: '4px' }}>
                Harder than your recent numbers suggest. You&rsquo;ll get the sessions — we still build your mileage up gently so you don&rsquo;t get hurt getting fit.
              </div>
            )}
            {overrodeDown && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px' }}>
                More cautious than we&rsquo;d pick. Fine — nudge it up whenever you&rsquo;re ready.
              </div>
            )}
            {!overrodeUp && !overrodeDown && rec.isReturning && (
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px' }}>
                We&rsquo;ll ease the hard sessions in over the first few weeks while your body remembers.
              </div>
            )}
          </div>
        )
      }

      case 'birth-year': {
        const currentYear = new Date().getFullYear()
        // Descending years (newest first) so the wheel opens near most birth
        // years. 14–90 = the allowable runner age range.
        const years = Array.from({ length: 90 - 14 + 1 }, (_, i) => currentYear - 14 - i)
        const anchor = currentYear - 35   // ~age 35 resting position when unset
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <WheelPicker
              values={years}
              value={birthYear ?? anchor}
              onChange={setBirthYear}
              ariaLabel="Year of birth"
            />
          </div>
        )
      }

      // ── Benchmark ──────────────────────────────────────────────────────────
      case 'benchmark':
        if (benchEstimateStatus === 'loading') {
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[85, 100, 60].map((w, i) => (
                <div key={i} style={{ height: '18px', width: `${w}%`, borderRadius: '6px', background: 'var(--bg-soft)' }} />
              ))}
            </div>
          )
        }
        if (benchMode === 'confirm' && benchEstimate?.available) {
          // 9a — the estimate is the frame title/subtitle; the only control here
          // is the escape to manual. "That's about right" is the sticky CTA.
          return (
            <button
              type="button"
              onClick={() => setBenchMode('manual')}
              style={{ background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--moss)', textAlign: 'left' }}
            >
              Let me adjust →
            </button>
          )
        }
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

      // ── Your week — the keystone grid (Option A) ─────────────────────────────
      case 'your-week': {
        // Threshold verdict is re-keyed from the old days-per-week count to the
        // grid's derived day count (mirrors lib/plan/inputs.ts validateDaysAvailable).
        const distKey = distanceKm ? raceDistanceKey(distanceKm) : null
        const thr = distKey ? GENERATION_CONFIG.DAYS_AVAILABILITY_THRESHOLDS[distKey] : null
        const wi = weekPlanToInputs(weekPlan)
        const verdict = dayCountVerdict(wi.daysAvailable, thr ?? null, distKey, goal === 'time_target')
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <WeekGrid value={weekPlan} onChange={setWeekPlan} ariaLabel="Your training week" />
            {verdict.hint && (
              <div style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', lineHeight: 1.5,
                color: verdict.state === 'blocked' ? 'var(--danger)' : 'var(--warn)',
              }}>
                {verdict.hint}
              </div>
            )}
            <FieldNote>Six is the cap, on purpose — a rest day does more than a seventh run would.</FieldNote>
          </div>
        )
      }

      // ── Weekday ceiling ──────────────────────────────────────────────────────
      case 'weekday-ceiling':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
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
              <CardSelect key={o.value} label={o.label} sub={o.sub} active={hardSessions === o.value} onClick={() => setHardSessions(o.value)} />
            ))}
          </div>
        )

      // ── Terrain (paid) ────────────────────────────────────────────────────
      case 'terrain':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <CardSelect label="Road." sub="Pavement, tracks, flat surfaces. Speed-focused." active={terrain === 'road'} onClick={() => setTerrain('road')} />
            <CardSelect label="Trail." sub="Off-road, elevation, technical terrain. Effort-focused." active={terrain === 'trail'} onClick={() => setTerrain('trail')} />
            <CardSelect label="Mixed." sub="Both. Adapt pace targets to the surface." active={terrain === 'mixed'} onClick={() => setTerrain('mixed')} />
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
