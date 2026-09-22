// TIER-DIVERGENT — FREE:  8-step wizard (distance → race → goal → fitness → benchmark → schedule → constraints)
//                  PAID:  11-step wizard adds hard-sessions → terrain → injuries
// One decision per screen. Slide transitions between steps.
'use client'

import PlanHeroMetrics from '@/components/shared/PlanHeroMetrics'
import PlanArc from '@/components/shared/PlanArc'
import { planArcSeries } from '@/lib/plan/weekVolume'
import { phaseDisplayLabel } from '@/lib/coaching/weekVoice'
import RefusalView from '@/components/shared/RefusalView'
import { useState, useEffect, useRef } from 'react'
import type { Plan, GeneratorInput, TrainingAge } from '@/types/plan'
import GeneratingCeremony from '@/components/GeneratingCeremony'
import { BRAND } from '@/lib/brand'
import { createClient } from '@/lib/supabase/client'
import { authedFetch } from '@/lib/supabase/authedFetch'
import SignOutLink from '@/components/shared/SignOutLink'
import { createEnrichSaveCoordinator } from '@/lib/plan/enrichSaveCoordinator'
import { weekVolumeLabel } from '@/lib/plan/weekVolume'
import { GENERATION_CONFIG, raceDistanceKey } from '@/lib/plan/generationConfig'
import { formatDistance, formatDuration } from '@/lib/format'
import { isPaidDistance } from '@/lib/plan/canUseFeature'
import { PLAN_SIGNATURES } from '@/lib/plan/planSignatures'
import PlanIntroCard from '@/components/shared/PlanIntroCard'
import RunwayRevealCard from '@/components/shared/RunwayRevealCard'
import FirstRunCard from '@/components/shared/FirstRunCard'
import PlanScaleCard from '@/components/shared/PlanScaleCard'
import CharityCohortCard, { type CharityCohortCardProps } from '@/components/shared/CharityCohortCard'
import { planScale } from '@/lib/plan/planScale'
import type { DistanceUnits } from '@/lib/format'
import { firstRunOfPlan } from '@/lib/plan/firstRun'
import Sheet from '@/components/shared/Sheet'
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
import { DayBudgetRows } from '@/components/shared/DayBudgetRows'
import {
  defaultWeek, weekPlanToInputs, weekPlanFromLegacy, dayCountVerdict, pruneDayBudgets,
  type WeekPlan, type DayBudgets,
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

// `paid` is DERIVED from the per-distance signature, never restated here.
// It was a hardcoded boolean duplicating `PLAN_SIGNATURES[d].free_tier_available`
// — a two-writer split on a COMMERCIAL boundary. The two agreed, so nothing was
// broken, but §17 names the signature as the authority for per-distance shape
// and this screen was quietly the real authority for who pays. Changing the
// documented source of truth would not have moved the paywall.
//
// TIER-ENFORCE-01 (2026-09-11): the predicate itself has now moved to
// `lib/plan/canUseFeature.ts`, because `/api/generate-plan` enforces the same
// boundary server-side and the lock a runner SEES must be the same rule the
// server APPLIES. While it lived here, this client component was the only place
// the paywall existed at all.

// PREF-SWEEP-01 — the SUB-LABEL is derived, not written. It used to be a
// hardcoded '42.2 km' on every row, so a miles runner picked "Marathon" and was
// told it was 42.2 km. `exact` keeps the iconic decimals (ADR-015): 42.2km /
// 26.2mi, never a rounded 26.
//
// The NAME stays fixed on purpose. "Marathon", "10K" and "Half" are what the
// race is called, in every country — they are not a unit conversion, and
// rendering "6.2M" would be wrong rather than localised.
const DISTANCES = [
  { label: '5K',       value: 5,    paid: isPaidDistance(5)    },
  { label: '10K',      value: 10,   paid: isPaidDistance(10)   },
  { label: 'Half',     value: 21.1, paid: isPaidDistance(21.1) },
  { label: 'Marathon', value: 42.2, paid: isPaidDistance(42.2) },
  { label: '50K',      value: 50,   paid: isPaidDistance(50)   },
  { label: '100K',     value: 100,  paid: isPaidDistance(100)  },
]

/**
 * P-05(a) — the plan-length range on each distance tile.
 *
 * The tiles said nothing about length. We offer SIX distances to the
 * competitor's four — including 50K and 100K, which they cannot offer at all —
 * and told the runner nothing about any of them.
 *
 * ⚠️ READ FROM `PLAN_SIGNATURES`, NEVER TYPED HERE (INV-CFG-001). A range
 * written into this component is prose about a rule, and prose about a rule
 * drifts from the rule — the homepage once claimed "four answers" against a
 * ~15-question wizard and survived five wizard changes.
 *
 * ⚠️ IT IS A RANGE, NOT A PROMISE, AND THAT IS HARD RULE 7. The length the
 * runner actually gets is runner-dependent: §97 lets a long runway earn a
 * longer plan and §44 refuses below a minimum. So this shows what the
 * signature PERMITS, before a race date exists to compute against — which is
 * why it reads "16-20 week plan" and never "your 18 week plan".
 *
 * En dash in the range, deliberately: BRAND-EMDASH-01 bans em dashes and
 * explicitly keeps en dashes in ranges.
 */
function planLengthRange(distanceKm: number): string | null {
  const sig = PLAN_SIGNATURES[raceDistanceKey(distanceKm)]
  if (!sig) return null
  return sig.min_weeks === sig.max_weeks
    ? `${sig.min_weeks} week plan`
    : `${sig.min_weeks}\u2013${sig.max_weeks} week plan`
}

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

// WIZARD-TIME-CHIPS-01 — the chips carry a STABLE KEY and derive their label.
//
// 🔴 WHY A KEY AND NOT A LABEL. The selected chip was stored as its LABEL, in
// React state AND in the saved `zona_wizard_draft`, and `weekdayDefaultMins`
// matched it back with `find(c => c.label === maxWeekdayChip)`. So renaming a
// label — which is exactly what ADR-015 compliance requires here — makes an
// in-flight draft match nothing, `?.value` yields `undefined`, and the runner's
// stated weekday cap silently becomes "No limit", changing the plan they get.
// The `??`-over-a-missing-value class this repo has now paid for five times.
//
// The key is an identity and never changes. The LABEL is derived through
// `formatDuration`, the ADR-015 owner, so these read "1h 30" like every other
// duration in the app instead of "90 min" — a third convention that survived
// because the input screen was the one surface nobody swept.
const MAX_WEEKDAY_CHIPS: { key: string; mins: number | undefined }[] = [
  { key: '30',   mins: 30        },
  { key: '45',   mins: 45        },
  { key: '60',   mins: 60        },
  { key: '90',   mins: 90        },
  { key: '120',  mins: 120       },
  { key: '180',  mins: 180       },
  { key: 'none', mins: undefined },
]

/** A chip's display text. "No limit" is a word, not a duration. */
const weekdayChipLabel = (mins: number | undefined): string =>
  mins == null ? 'No limit' : (formatDuration(mins) ?? 'No limit')

/**
 * Restore shim for drafts saved BEFORE this change, which stored the label.
 * Without it, anyone mid-wizard when this deploys loses their weekday cap
 * silently — which is the exact defect this item exists to prevent, caused by
 * the fix for it. Safe to delete once no legacy drafts remain.
 */
const LEGACY_CHIP_LABEL_TO_KEY: Record<string, string> = {
  '30 min': '30', '45 min': '45', '60 min': '60',
  '90 min': '90', '2 hrs': '120', '3 hrs': '180', 'No limit': 'none',
}
const normaliseWeekdayChip = (stored: string | null): string | null =>
  stored == null ? null
    : MAX_WEEKDAY_CHIPS.some(c => c.key === stored) ? stored
    : (LEGACY_CHIP_LABEL_TO_KEY[stored] ?? null)

// UX-WIZARD-01 Stage C — the per-day override cycle reuses the SAME time buckets
// as the weekday cap (one source of truth), minus "No limit": an absent day
// already means "same as the cap", so a per-day override is always a concrete
// number. `DayBudgetRows` renders the label; the value is what the engine sizes to.
// DayBudgetRows wants {value,label}; the label is derived, same owner.
const DAY_BUDGET_OPTIONS = MAX_WEEKDAY_CHIPS
  .filter((c): c is { key: string; mins: number } => c.mins != null)
  .map(c => ({ value: c.mins, label: weekdayChipLabel(c.mins) }))

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
// ui-patterns.md "Chip or CardSelect?" — CardSelect, on two counts: a runner can
// pick the wrong option from the label alone (Q1), and the answer changes the
// SHAPE of the plan rather than a number in it (Q2) — it is the demonstrated-
// readiness signal §89/§91 gate on, so a careless tap moves the first quality
// session by two weeks. It shipped as bare chips next to `your-level`, the same
// kind of question with the full card treatment.
//
// Labels remain neutral descriptions of PAST PRACTICE — recognition, never an
// "unlock" (SLT framing guardrail). Nothing here names what the runner gets for
// answering upward, and no option is phrased as a tier to qualify for.
const RECENT_QUALITY_OPTIONS: { label: string; sub: string; value: RecentQuality }[] = [
  { value: 'none',       label: 'Mostly easy.',    sub: 'Steady running. Nothing structured lately.' },
  { value: 'occasional', label: 'Here and there.', sub: 'The odd session. Not a routine.' },
  { value: 'regular',    label: 'Most weeks.',     sub: 'Intervals, hills or tempo: consistently, recently.' },
]

const STEP_META: Record<WizardSubStep, { title: string; subtitle: string; optional?: boolean; eyebrow?: string; interstitial?: boolean; cta?: string }> = {
  'distance':        { title: 'How far?',              subtitle: 'Start with the finish line. Work backwards from there.' },
  'race-details':    { title: 'Tell me about the race.', subtitle: 'Race name is optional. The date is not.' },
  'goal':            { title: 'What matters most?',    subtitle: 'Crossing the line, or hitting a number. Both are valid.' },
  'target-time':     { title: "What's the target?",    subtitle: "Be honest. Optimistic goals make bad training plans." },
  'teach-easy':      { title: 'This plan will feel too easy at first.', subtitle: '', eyebrow: 'Hold the zone', interstitial: true, cta: 'Got it' },
  'weekly-volume':   { title: 'How much are you running now?', subtitle: 'Last four weeks, roughly. Real numbers only.' },
  'longest-run':     { title: 'Longest run in the last six weeks?', subtitle: 'Tells us how much you can already hold.' },
  'training-age':    { title: 'How long have you been at this?', subtitle: 'Consistent months, not total years.', optional: true },
  // Subtitle no longer lists the session types — the option cards say it now, and
  // repeating it above them is the redundancy the CardSelect promotion removes.
  // What's left is the only thing the cards can't say: which window, and that
  // this is past tense.
  'recent-quality':  { title: 'Been doing the hard stuff?', subtitle: 'Last month or two. What you actually did, not what you meant to.', optional: true },
  'your-level':      { title: 'Where are you right now?', subtitle: "Based on what you told us. Overrule it if we've got it wrong." },
  'birth-year':      { title: 'What year were you born?', subtitle: "Only to estimate your max heart rate, if you haven't set one. Kept private.", optional: true },
  'benchmark':       { title: 'Recent race result?',   subtitle: 'Gives us precise pace targets for every session. Skip if you haven\'t raced lately.', optional: true },
  'teach-easy-day':  { title: 'Easy should feel easy.', subtitle: '', eyebrow: 'The easy day', interstitial: true, cta: 'Continue' },
  'your-week':       { title: 'Which days do you run?',  subtitle: 'Tap the days you train. Tap a weekend day again to make it your long run.' },
  'weekday-ceiling': { title: 'How long on a weekday?',  subtitle: 'Your cap Monday–Friday. Weekends stay open. Skip if you\'re flexible.', optional: true },
  'hard-sessions':   { title: 'You and hard sessions.', subtitle: 'Intervals, tempo, threshold. Where do you land?' },
  'terrain':         { title: 'Where do you run?',      subtitle: 'Road, trail, or a bit of both. Off-road, we coach by effort, not pace.' },
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
  foundation: 'Pre-plan easy running. Easy sessions only: no quality, no strides.',
  base:       'Aerobic foundation. Easy runs, nothing fancy.',
  build:      'One quality session a week. Everything else stays easy.',
  peak:       'Race-specific sharpening. Volume holds; the work gets specific.',
  taper:      'Volume drops. Race week is shakeouts only.',
}

// Full-width strip — every week as a coloured bar. No scrolling.
function PreviewPhaseStrip(
  { weeks, units }: { weeks: Plan['weeks']; units: DistanceUnits },
) {
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
              /* §121 Amendment 1 — the race is named, never folded in. This
                 preview is where the founder found the defect ("it looks like
                 it's got the highest volume... higher than peak"), and the bar
                 heights are fixed by §121 at the source; the tooltip is where
                 the two numbers are told apart. Shared owner, so this and the
                 published plan pages cannot drift. */
              title={isFoundation
                ? `Foundation · ${weekVolumeLabel(w, units) ?? ''}`
                : `Week ${w.n} · ${weekVolumeLabel(w, units) ?? ''} · ${w.phase ?? 'base'}${isDeload ? ' · recovery' : ''}${isRaceWeek ? ' · race' : ''}`}
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
function PhaseSummaryCard({ phase, weeks, units }: { phase: string; weeks: Plan['weeks']; units: DistanceUnits }) {
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
            {weekRange} · peak {formatDistance(peakKm, units)}
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
  birthYear: initialBirthYear, onBirthYearSave, onPlanSaved, onPlanEnriched, isOnboarding, hasExistingPlan, hasPaidAccess, onUpgrade, onOpenRedeem,
  preferredUnits = 'km',
  charityCohort,
}: {
  onBack: () => void
  /** ADR-015 / INV-PREF-001 — the unit preference propagates EVERYWHERE, and
   *  this screen was the one that never received it, so its reveal cards read km
   *  to a miles runner. Every sibling screen already takes this prop. */
  preferredUnits?: DistanceUnits
  /** FIRSTRUN-MOMENTS-01f — set only for a runner on a live charity grant whose
   *  batch declared a size. Absent for everyone else, which is most people. */
  charityCohort?: CharityCohortCardProps | null
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
  /** GTM-CHARITY-04 door 3 of 3. See the distance step. */
  onOpenRedeem?: () => void
}) {
  // ── App-level step state ──────────────────────────────────────────────────
  const [appStep, setAppStep]   = useState<AppStep>('distance')
  const [plan, setPlan]         = useState<Plan | null>(null)
  const [error, setError]       = useState<string | null>(null)
  // REFUSAL-SCREEN-01 — a deliberate coaching refusal (HTTP 422: §44 prep-time,
  // §52 days, §111 base-volume, §55 input) is NOT a crash. It reframes as "not
  // yet" with the lever, never "something went wrong" (which is kept for a real
  // fault: a 500 or a network drop). `errorAlternatives` carries the §44-style
  // levers the route returns in base/prep/days.
  const [errorIsRefusal, setErrorIsRefusal] = useState(false)
  const [errorAlternatives, setErrorAlternatives] = useState<string[]>([])
  /**
   * P-15 — the §118 base-build offer attached to a base-volume refusal.
   *
   * ⚠️ The COPY comes from the server, not from here. Two variants are keyed
   * on `reaches_race_door`, and the non-clearing one must say nothing at all
   * about a race — a client-side template would be free to break that, and the
   * runner it would mislead is the one we can least afford to mislead.
   * `lib/plan/baseBuildCopy.ts` is the single owner; this only renders.
   */
  const [errorOffer, setErrorOffer] = useState<
    { title: string; line: string; why: string } | null
  >(null)
  /**
   * ⚠️ There is deliberately NO `offerPending` state. `handleGenerate` sets
   * `appStep = 'generating'` on its first line, so the button is unmounted
   * before any pending style could render and the GeneratingCeremony IS the
   * pending state. A flag nothing can display is the "declared but inert"
   * class this repo keeps finding.
   */
  const [offerFailed, setOfferFailed] = useState(false)
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
  // UX-WIZARD-01 Stage C — per-day overrides of the weekday cap. Sparse by
  // design: an absent day means "same as the weekday cap", never a budget of
  // zero (SESSION-KM-02). Pruned whenever the grid changes so a day switched
  // back to Rest cannot keep a stale budget.
  const [dayBudgets,     setDayBudgets]     = useState<DayBudgets>({})

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
      if (s.maxWeekdayChip)  setMaxWeekdayChip(normaliseWeekdayChip(s.maxWeekdayChip))
      if (s.dayBudgets && typeof s.dayBudgets === 'object') setDayBudgets(s.dayBudgets as DayBudgets)
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
        weekPlan, maxWeekdayChip, dayBudgets,
        hardSessions, terrain, injuries,
      }))
    } catch {}
  }, [appStep, distanceKm, raceName, raceDate, goal,
      targetHours, targetMins,
      birthYear, weeklyKm, longestRun, restingHR, trainingAge, recentQuality,
      benchmarkType, benchmarkDistKm, benchHours, benchMins, benchmarkTTDist, benchmarkDate,
      weekPlan, maxWeekdayChip, dayBudgets,
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

  /**
   * P-15 — `acceptBaseBuild` is the runner taking the §118 offer on the
   * refusal screen. Threaded through THIS function rather than given its own
   * fetch, because the success path it needs (save, foundation check, preview)
   * is forty lines long and a second copy would drift from it — the
   * duplication class this repo keeps paying for.
   *
   * ⚠️ Not wired to an onClick directly anywhere: a bare `onClick={handleGenerate}`
   * would pass a MouseEvent as `opts`. Both call sites pass explicitly.
   */
  async function handleGenerate(opts?: { acceptBaseBuild?: boolean }) {
    setRevealComplete(false)
    setRulePlanReady(false)
    setAppStep('generating')
    setError(null)
    setPlan(null)
    setOfferFailed(false)
    // P-15 — a FRESH generate clears the offer; ACCEPTING one keeps it, so a
    // transport failure mid-acceptance returns the runner to a screen that
    // still has the card they just tapped rather than a bare refusal.
    if (!opts?.acceptBaseBuild) setErrorOffer(null)

    const ageYears      = birthYear !== null ? new Date().getFullYear() - birthYear : 30
    const weeklyKmVal   = weeklyKm   ?? GENERATION_CONFIG.WIZARD_VOLUME_RULER.WEEKLY_KM_ANCHOR
    const longestRunVal = longestRun ?? GENERATION_CONFIG.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_ANCHOR
    const targetTimeStr = goal === 'time_target' && (targetHours > 0 || targetMins > 0)
      ? `${targetHours}:${String(targetMins).padStart(2, '0')}:00` : undefined
    const benchTimeStr  = benchHours > 0 || benchMins > 0
      ? `${benchHours}:${String(benchMins).padStart(2, '0')}:00` : undefined
    // The one engine touch: derive the schedule fields from the week grid.
    //
    // UX-WIZARD-01 step 1 — `max_weekday_mins` is now derived HERE too, rather
    // than beside this line from the chip. The grid decides which weekdays the
    // runner actually runs, and only those can constrain a weekday cap; keeping
    // the two derivations apart meant a rest day's stale budget could cap a week
    // it has no part in. One owner, `weekPlanToInputs`.
    //
    // The third argument is the per-day overrides collected by `DayBudgetRows`
    // on the weekday-ceiling step (Stage C). When the runner sets none, the map
    // is empty and this resolves to exactly the chip value — the byte-identical
    // no-budget path `verify:parity` guards (2,916 cases). `weekPlanToInputs`
    // prunes to the weekdays actually run and derives `max_weekday_mins` as the
    // MIN across them, so a stale budget can never cap a week it has no part in.
    const weekdayDefaultMins = maxWeekdayChip
      ? MAX_WEEKDAY_CHIPS.find(c => c.key === maxWeekdayChip)?.mins : undefined
    const week = weekPlanToInputs(weekPlan, weekdayDefaultMins, dayBudgets)
    const maxWeekdayVal = week.maxWeekdayMins

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
      // UX-WIZARD-01 (Stage C) — per-day overrides set on the weekday-ceiling
      // step. Empty map → undefined → the plan is byte-identical to the global
      // chip; the engine sizes each day to its own budget when they are present.
      day_budgets:           week.dayBudgets,
      hard_session_relationship: hasPaidAccess ? (hardSessions ?? undefined) : undefined,
      injury_history:            hasPaidAccess && injuries.length ? injuries.map(i => i.toLowerCase()) : undefined,
      terrain:                   hasPaidAccess ? (terrain ?? undefined) : undefined,
    }

    // FIRSTRUN-MOMENTS-01c — stash the payload the moment it is built, not on
    // arrival. It used to be set ONLY inside `applyFoundationIfNeeded`, i.e.
    // after the response AND only on the >28-day 'choice' branch, so during the
    // ceremony it was still null and the personalised lines would never have
    // rendered at all. Setting it here also gives the foundation follow-up its
    // input on every path rather than one.
    lastInputRef.current = input

    try {
      // authedFetch attaches the bearer (cookie sync to server is unreliable
      // with @supabase/ssr) — single owner of the pattern, AUTH-BEARER-MISSING-01.
      const res = await authedFetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // P-15 — the accept flag rides the same payload. The server reads it
        // off the raw body and never puts it on GeneratorInput (ADR-003: the
        // engine takes a runner and a tier, not a UI intent).
        body: JSON.stringify(opts?.acceptBaseBuild ? { ...input, accept_base_build: true } : input),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // 422 is a deliberate coaching refusal (§44/§52/§55/§111), not a fault.
        // The route puts the brand-voiced message in `error` and the levers in
        // base/prep/days.alternatives. A 500 or a parse-empty body is a real
        // error and keeps the "something went wrong" framing.
        const isRefusal = res.status === 422
        const payload = data.base ?? data.prep ?? data.days ?? {}
        setError(data.error ?? (isRefusal ? 'This plan is not ready for you yet.' : 'Something went wrong building the plan.'))
        setErrorIsRefusal(isRefusal)
        setErrorAlternatives(Array.isArray(payload.alternatives) ? payload.alternatives : [])
        // P-15 — the §118 offer, when the route attached one. It only rides a
        // BASE-VOLUME refusal: a prep-time or days refusal gets no offer and
        // must render none, which is why this reads `data.get_running` rather
        // than inferring an offer from the refusal itself.
        const offer = (data as { get_running?: { title?: unknown; line?: unknown; why?: unknown } }).get_running
        setErrorOffer(
          offer && typeof offer.title === 'string' && typeof offer.line === 'string' && typeof offer.why === 'string'
            ? { title: offer.title, line: offer.line, why: offer.why }
            : null,
        )
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
          // `lastInputRef` is already set, before the fetch — only the modal
          // needs opening here now.
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
      setErrorIsRefusal(false)
      setErrorAlternatives([])
      // P-15 — a transport failure while ACCEPTING must not wipe the offer:
      // the runner said yes and the network dropped, so keep the card and let
      // them retry. It is cleared only on a fresh generate (below) and on a
      // refusal that carries no offer (above).
      if (opts?.acceptBaseBuild) setOfferFailed(true)
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
      // AUTH-BEARER-MISSING-01 — the foundation route calls getUserFromRequest;
      // a bare fetch sent no bearer, so the add silently 401'd on native.
      const res = await authedFetch('/api/generate-plan/foundation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: lastInputRef.current, plan }),
      })
      if (!res.ok) throw new Error(`foundation add failed: ${res.status}`)
      const data = await res.json() as { plan: Plan }
      setPlan(data.plan)
      setFoundationAddStatus('idle')
      setFoundationModalOpen(false)
    } catch (e) {
      // FOUNDATION-ADD-FAIL-01 — do not swallow. The route records a durable ops
      // event on a 500; this catches the client-side leg (a network drop before
      // the route, carrying the status from the throw above) so it is not silent.
      console.error('[foundation-add] failed', e)
      setFoundationAddStatus('error')
    }
  }

  // FOUNDATION-DECIDE-LATER-01 (SLT Fix A, 2026-09-18) — one handler for "proceed
  // without a block", reached by "Start plan as-is" and by dismissing the sheet,
  // which are the same outcome: the plan starts as generated. This used to be TWO
  // byte-identical handlers (handleFoundationSkip / handleFoundationStartNow), and
  // a third "Decide later" button that implied a re-offer which never came — the
  // modal has exactly one trigger, at generation, so "later" was a promise the app
  // could not keep. Deleted. "Start plan as-is" and dismissing are the two honest
  // ways out; there is no hidden deferred state to lose.
  function handleFoundationDismiss() {
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
      // SAVE-LATENCY-01 — the birth-year write is INDEPENDENT of the plan write
      // and must not sit in front of it. Awaited serially, the finalise path ran
      // four sequential Supabase round-trips (birth year -> auth.getUser ->
      // savePlanForUser -> user_settings.upsert) before the screen could move,
      // which is the "Saving..." hang. It is fire-and-forget on purpose: a
      // failed birth-year write costs an estimated max-HR fallback, never the
      // plan, and the runner can set it again in Profile.
      if (birthYear !== null && onBirthYearSave) void onBirthYearSave(birthYear).catch(() => {})
      await onPlanSaved(planRef.current)
      sessionStorage.removeItem(WIZARD_KEY)

      // Enrichment that landed mid-save is safe to write now the save has.
      const queued = coordRef.current.saveCompleted()
      if (queued) void onPlanEnriched?.(queued)
    } catch {
      coordRef.current.saveFailed()
      setIsSaving(false)
    } finally {
      // SAVE-LATENCY-01 — clear the flag on EVERY exit, not only the error one.
      // On success `setIsSaving(false)` was never called, so the button stayed
      // "Saving..." until the parent finished its own post-save work and swapped
      // the screen. Every millisecond of that tail read to the runner as the save
      // still being in flight, when the plan had already been written.
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
        // FIRSTRUN-MOMENTS-01c — the answers this runner just gave, so the
        // ceremony says something only true of them. `lastInputRef` already
        // holds the exact payload sent to /api/generate-plan (it is the
        // foundation-add follow-up's source of truth), so there is no second
        // copy of the wizard state to drift from.
        input={lastInputRef.current}
        onRevealComplete={() => setRevealComplete(true)}
      />
    )
  }

  if (appStep === 'error') {
    // REFUSAL-SCREEN-01 + P-15 — the whole view is `RefusalView`, extracted to
    // `components/shared/` rather than left inline. It sits behind auth AND a
    // completed wizard AND a refusal, so the only way to see it for real is to
    // be the runner it is failing; `/refusal-preview` renders THIS component in
    // every state. A fixture rendering a second copy of the markup would drift
    // and prove nothing.
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'var(--bg)' }}>
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          {!isOnboarding && <BackBtn onClick={goBack} />}
        </div>
        <div style={{ flex: 1, padding: '0 20px 24px' }}>
          <RefusalView
            isRefusal={errorIsRefusal}
            message={error}
            alternatives={errorAlternatives}
            offer={errorOffer}
            offerFailed={offerFailed}
            onAccept={() => void handleGenerate({ acceptBaseBuild: true })}
            onAdjust={() => navigateTo(getLastWizardStep(), 'back')}
          />
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
              starts {meta.plan_start} · {formatDistance(meta.race_distance_km, preferredUnits, { exact: true })}
            </div>
          </div>
          {/* P-06(c) — the shape of the block, led by its numbers. The week
              count moves INTO the panel rather than being said twice: it was
              in the subtitle above, and two renderings of one figure is how
              they drift. */}
          <div style={{ marginTop: '14px' }}>
            <PlanHeroMetrics plan={plan} units={preferredUnits} canReshape={!!hasPaidAccess} />
          </div>

          {/* DESIGN-REVEAL-SHAPE-01 (Design Board § 6p) — THE SHAPE, at the one
              moment it matters.
              🔴 Measured at the sitting: `PlanArc` rendered on the Plan screen,
              in `TabbedPhone` and on its preview page — and NOT HERE. This
              screen imported `PlanHeroMetrics` and never `PlanArc`, so at the
              moment the plan arrived the runner met its NUMBERS and never its
              SHAPE; the shape appeared later, on a tab they had to navigate to.
              P-06(c) gave this panel the biggest week and the total. This gives
              it the arc those numbers describe, and one sentence saying why a
              week is smaller before it reads as a bug. */}
          {/* Derived at render, never stored — a series written at generation
              goes stale the moment a plan is reshaped, which is this repo's
              recorded stale-mid-pipeline class (and the same reason P-06(c)'s
              hero numbers are derived here too). */}
          <div style={{ marginTop: '20px' }}>
            <PlanArc
              totalWeeks={plan.weeks.length}
              currentWeek={1}
              doneWeeks={0}
              weekKm={planArcSeries(plan.weeks).km}
              weekPhase={planArcSeries(plan.weeks).phase.map(phaseDisplayLabel)}
              raceWeek={plan.weeks.find(w => w.type === 'race')?.n}
              reveal
            />
          </div>
        </div>

        {/* Content scrolls internally (flex:1 + overflow); the CTA below is a
            flexShrink:0 footer, so it sits beneath this — no overlap, no sticky
            float. (Was position:sticky over an unbounded minHeight:100% wrapper,
            which floated the CTA over the plan on native — D7 padding was papering
            over a broken scroll model. Now matches the wizard footer.) */}
        <div style={{ flex: 1, padding: '0 20px 24px', overflowY: 'auto' }}>
          {/* FIRSTRUN-MOMENTS-01a — the uncovered-runway note, surfaced at the
              reveal led by the number (it was stamped on meta and shown nowhere).
              First card so a long-runway first-timer reads the relief without
              scrolling. Rendered ONLY here — it is not in planRationaleNotes, so
              there is no second copy lower down or on the Plan screen. */}
          {meta.uncovered_runway_note && meta.uncovered_runway_weeks != null && (
            <div style={{ marginBottom: '16px' }}>
              <RunwayRevealCard weeks={meta.uncovered_runway_weeks} note={meta.uncovered_runway_note} />
            </div>
          )}
          {/* FIRSTRUN-MOMENTS-01b — the first session, pulled out of the wall of
              weeks, so a first-timer reads one thing they could do tomorrow. Sits
              under the runway relief (01a): "you're early" then "here's where it
              starts". Absent when there is nothing concrete to promise. */}
          {(() => {
            const firstRun = firstRunOfPlan(weeks, preferredUnits, trainingAge)
            return firstRun ? (
              <div style={{ marginBottom: '16px' }}>
                <FirstRunCard {...firstRun} />
              </div>
            ) : null
          })()}
          {/* FIRSTRUN-MOMENTS-01d + 01e — the third beat: "you're early" (01a),
              "here's where it starts" (01b), then the honest size of it. Derived
              LIVE, never stamped: the longest-run line is a promise about a plan
              that can reshape (Hutchinson's binding condition at the SLT). */}
          {(() => {
            const scale = planScale(plan, preferredUnits)
            return scale ? (
              <div style={{ marginBottom: '16px' }}>
                <PlanScaleCard {...scale} />
              </div>
            ) : null
          })()}
          {/* FIRSTRUN-MOMENTS-01f — the fourth beat, and only for the cohort it
              is true of: one checkable fact, stated once. Sits last because
              "you are not alone" lands after the plan has been made concrete,
              not before it. */}
          {charityCohort && (
            <div style={{ marginBottom: '16px' }}>
              <CharityCohortCard {...charityCohort} />
            </div>
          )}
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
            <PreviewPhaseStrip weeks={weeks} units={preferredUnits} />
          </div>

          <div style={{ marginTop: '20px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              Plan shape
            </div>
            {PHASES.map(phase => {
              const phaseWeeks = weeks.filter(w => w.phase === phase)
              if (!phaseWeeks.length) return null
              return <PhaseSummaryCard key={phase} phase={phase} weeks={phaseWeeks} units={preferredUnits} />
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
          <Sheet onClose={handleFoundationDismiss} ariaLabel="Foundation Block">
            {() => (
            <div style={{ padding: '6px 20px 24px' }}>
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
                onClick={handleFoundationDismiss}
                style={{
                  width: '100%', padding: '15px', marginBottom: '10px',
                  borderRadius: 'var(--radius-md)', background: 'var(--bg-soft)',
                  border: '1px solid var(--line)', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 500, color: 'var(--ink)',
                }}
              >
                Start plan as-is
              </button>
            </div>
            )}
          </Sheet>
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
  // S3 (Design Board, app review 2026-09-22) — ONE CTA VOCABULARY, NO ARROWS.
  // Measured on the walked flow: FOUR labels for one button — `Continue`,
  // `Continue →`, `Got it →`, `Skip this →` — with the arrow on some and not
  // others. A button in a fixed position doing a fixed job does not need to
  // announce direction differently on different screens.
  const ctaLabel       = benchConfirm
    ? "That's about right"
    : (stepMeta.cta ?? (isLastStep ? 'Generate my plan' : 'Continue'))

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
        {/* S4a/b (Design Board, app review 2026-09-22) — THE BUTTON THAT LIED.
            `skipStep()` is `goNext()`. One line, no branch: it clears nothing
            and records nothing. So on each of the SIX optional steps there were
            two buttons calling the identical function, and answering the step
            and then tapping "Skip this →" KEPT the answer. The label was false.

            ⚠️ RELABELLED, NOT REMOVED, AND THE BOARD SAID "REMOVED" — so the
            departure is stated rather than quietly taken. The ruling's binding
            amendment keeps an affordance on any optional step with no field
            label to hang "optional" on. Measured: FIVE of the six have none
            (training-age, recent-quality, birth-year, weekday-ceiling and
            injuries are chip/card/wheel steps with no FieldLabel). Applying
            "remove" literally would delete it from `benchmark` alone and leave
            it on five, which is a one-of-six exception in a wave whose other
            ruling is ONE VOCABULARY. Consistency wins; the lie is what gets
            fixed.

            ⚠️ AND IT IS NOT AN EM DASH. `brand.md` § Punctuation bans them in
            copy SITE-WIDE — the "app-side exception" CLAUDE.md refers to does
            not exist in that section. A comma. */}
        {stepMeta.optional && (
          <button
            onClick={skipStep}
            style={{ width: '100%', textAlign: 'center', marginBottom: '8px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', padding: '8px' }}
          >
            Not sure, continue
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

        {/* ONBOARD-EXIT-01 — the escape, on EVERY step and only when trapped.
            The back button is hidden on step 0 during onboarding
            (`!(isOnboarding && currentIdx === 0)`), so backing up from step 12
            lands on a screen with no exit at all. Founder's ask was explicit:
            reachable from every page of the wizard, not just the first.
            Gated on `isOnboarding`: a runner REGENERATING a plan reached this
            screen from Me and has a working back button, so the link would be
            noise on the one flow that does not need it.
            No `disabled` guard needed: generation replaces this whole shell with
            `GeneratingCeremony`, so the footer is unmounted while a plan builds. */}
        {isOnboarding && <SignOutLink />}
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
                  // P-05(a) — the distance AND how long that plan runs. The
                  // range comes from PLAN_SIGNATURES; see `planLengthRange`.
                  sub={[formatDistance(d.value, preferredUnits, { exact: true }), planLengthRange(d.value)]
                    .filter(Boolean).join(' \u00b7 ')}
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
                {/* P-08(a) / GTM-CHARITY-08 (2026-09-20) — NAMES BOTH ROUTES,
                    because tapping the locked tile navigates AWAY to Upgrade
                    and a charity runner's correct action is the code link two
                    lines below, on the screen they just left.

                    ⚠️ A WORDING FIX, NOT A SECOND BUTTON. The redeem door is
                    directly beneath this; adding another here would be two
                    controls for one action and a third phrasing of the same
                    string, which is how surfaces drift apart (the reason the
                    existing door reuses the other two doors' wording).

                    ⚠️ The NAVIGATION IS LEFT ALONE deliberately. For the ~all
                    of users with no code, Upgrade IS the remedy, so making the
                    tile inert would break the majority case to serve 500
                    runners in October. Putting both routes in the sentence
                    read BEFORE the tap serves both. */}
                Marathon and longer need full access, which a charity code also gives you.{' '}
                <button onClick={onUpgrade} style={{ background: 'none', border: 'none', color: 'var(--moss)', fontFamily: 'var(--font-ui)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>
                  Start free trial →
                </button>
              </div>
            )}

            {/* GTM-CHARITY-04 — the third redeem door. The SLT asked for three;
                Me and Upgrade shipped, and this is the onboarding one.
                Deliberately NOT a wizard step: a step is invasive for the ~all
                of users who have no code, and Wood's objection to onboarding
                friction is about steps, not about one muted line.

                SHOWN ON DAY ONE TOO, not only once the paywall bites. A charity
                runner arrives holding a code and full trial access, so the gate
                above never renders for them; without this their access silently
                depends on remembering to redeem before day 15. Redeeming early
                costs them nothing, because `savePlanForUser` re-anchors the
                grant to race date + 7 days as soon as they build a plan
                (lib/charity/reanchor.ts, called from ADR-020's single writer).

                Hidden for an established paid user: they are neither
                onboarding nor gated, so it would be noise.

                String is the one the other two doors use. A third phrasing for
                the same action is how surfaces drift apart. */}
            {onOpenRedeem && (isOnboarding || !hasPaidAccess) && (
              <div style={{ gridColumn: '1/-1', marginTop: '2px' }}>
                <button
                  onClick={onOpenRedeem}
                  style={{
                    background: 'none', border: 'none', padding: '4px 0',
                    fontFamily: 'var(--font-ui)', fontSize: '12px',
                    color: 'var(--mute)', cursor: 'pointer',
                    textDecoration: 'underline', textUnderlineOffset: '3px',
                  }}
                >
                  Have a charity code?
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {RECENT_QUALITY_OPTIONS.map(o => (
              <CardSelect
                key={o.value}
                label={o.label}
                sub={o.sub}
                active={recentQuality === o.value}
                onClick={() => setRecentQuality(recentQuality === o.value ? null : o.value)}
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
          ? "You've got the miles in your legs, just not this month. That's not beginner, that's coming back."
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
            <WeekGrid
              value={weekPlan}
              onChange={p => { setWeekPlan(p); setDayBudgets(b => pruneDayBudgets(b, p)) }}
              ariaLabel="Your training week"
            />
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
                    key={c.key}
                    label={weekdayChipLabel(c.mins)}
                    active={maxWeekdayChip === c.key}
                    onClick={() => setMaxWeekdayChip(maxWeekdayChip === c.key ? null : c.key)}
                  />
                ))}
              </div>
            </div>

            {/* UX-WIZARD-01 Stage C — per-day overrides of the cap above.
                Progressive disclosure: the chips answer the simple case in one
                tap; this refines it only for the runner who wants to. Renders
                nothing when no weekday is a Run day (weekend-only weeks), and a
                row per weekday the grid marks Run otherwise. The engine sizes
                each day to its own budget (Stage B); an untouched control is
                byte-identical to the global chip. Tier: FREE — availability is
                plan correctness, not richness. */}
            <DayBudgetRows
              plan={weekPlan}
              budgets={dayBudgets}
              options={DAY_BUDGET_OPTIONS}
              defaultLabel="Same"
              onChange={setDayBudgets}
            />

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
