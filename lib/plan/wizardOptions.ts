import type { TrainingAge, GeneratorInput } from '@/types/plan'
import type { FitnessLevel } from './fitnessAssessment'
import { isPaidDistance } from './canUseFeature'

/**
 * ADR027-B0-GOLDEN-CORPUS — THE OPTION LISTS THE PLAN WIZARD OFFERS, with one owner.
 *
 * `GeneratePlanScreen` held every one of these inline. That was harmless while the wizard
 * was their only reader; ADR-027's golden corpus (`lib/corpus/goldenCorpus.ts`) and its shape gate
 * (`wizardShape.ts`) are two more, and a corpus that COPIED the lists would describe the
 * wizard as it was on the day of the copy (D-08, ARCH-ENG-007). So the VALUES moved here
 * and the wizard imports them. The COPY a runner reads stays in the wizard, keyed by value
 * with a `Record`, so the compiler refuses a value with no label and the copy stays inside
 * the em-dash guard's population (`noEmDashApp.test.ts` scans `app/dashboard/`).
 *
 * ⚠️ Only values the wizard can POST belong here. Anything else is not an option, it is
 * a guess about one.
 */

/** The six distance tiles, in tile order. `paid` derives from `PLAN_SIGNATURES` (TIER-ENFORCE-01).
 *  The label is the race's NAME, not prose, so it travels with the value. */
export const WIZARD_DISTANCES = [
  { label: '5K',       value: 5,    paid: isPaidDistance(5)    },
  { label: '10K',      value: 10,   paid: isPaidDistance(10)   },
  { label: 'Half',     value: 21.1, paid: isPaidDistance(21.1) },
  { label: 'Marathon', value: 42.2, paid: isPaidDistance(42.2) },
  { label: '50K',      value: 50,   paid: isPaidDistance(50)   },
  { label: '100K',     value: 100,  paid: isPaidDistance(100)  },
] as const

/** The injury chips, as DISPLAYED. The wizard posts each lowercased (`injuries.map(i => i.toLowerCase())`),
 *  so `WIZARD_INJURY_WIRE` is the posted spelling. */
export const WIZARD_INJURIES = ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis'] as const
export const WIZARD_INJURY_WIRE: readonly string[] = WIZARD_INJURIES.map(i => i.toLowerCase())

/**
 * WIZARD-TIME-CHIPS-01 — the weekday-cap chips: a STABLE KEY and the minutes it means.
 * `undefined` is "No limit". The label is derived in the wizard through `formatDuration`.
 */
export const MAX_WEEKDAY_CHIPS: readonly { key: string; mins: number | undefined }[] = [
  { key: '30',   mins: 30        },
  { key: '45',   mins: 45        },
  { key: '60',   mins: 60        },
  { key: '90',   mins: 90        },
  { key: '120',  mins: 120       },
  { key: '180',  mins: 180       },
  { key: 'none', mins: undefined },
]

/** UX-WIZARD-01 Stage C — the per-day override cycle: the same buckets minus "No limit". */
export const WIZARD_DAY_BUDGET_MINS: readonly number[] = MAX_WEEKDAY_CHIPS
  .map(c => c.mins)
  .filter((m): m is number => m != null)

export const WIZARD_TRAINING_AGES: readonly TrainingAge[] = ['<6mo', '6-18mo', '2-5yr', '5yr+']

export type RecentQuality = NonNullable<GeneratorInput['recent_quality_training']>
export const WIZARD_RECENT_QUALITY: readonly RecentQuality[] = ['none', 'occasional', 'regular']

export type HardSessionRelationship = NonNullable<GeneratorInput['hard_session_relationship']>
export const WIZARD_HARD_SESSIONS: readonly HardSessionRelationship[] = ['avoid', 'neutral', 'love', 'overdo']

export type WizardTerrain = NonNullable<GeneratorInput['terrain']>
export const WIZARD_TERRAINS: readonly WizardTerrain[] = ['road', 'trail', 'mixed']

/** §79 — the three level cards on `your-level`, in card order. */
export const WIZARD_LEVELS: readonly FitnessLevel[] = ['beginner', 'intermediate', 'experienced']

/** The birth-year wheel: ages 14–90 inclusive (`years = currentYear − 14 … currentYear − 90`). */
export const WIZARD_BIRTH_YEAR_AGE_MIN = 14
export const WIZARD_BIRTH_YEAR_AGE_MAX = 90
