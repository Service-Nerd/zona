// LOAD-VERDICT-RED-01 — the single owner of the Coach load verdict: the words and the colours for a week's
// acute:chronic ratio. Read by the Coach "This week's load" tile, its `LoadShape` marker and the load sheet.
//
// Was a private function inside `DashboardClient`, so nothing else could reuse it or test it, and it coloured
// "above your recent normal" `--danger`: red in the training UI, against ux-principles.md ("No red in the training
// UI: amber for warnings"). A week above the runner's normal is a warning, not an error.
//
// LOAD-SOURCE-TOTAL-01 (Coaching Board + Design Board 2026-10-30): BELOW normal is not a warning by default. In a week
// the plan made lighter it is the plan working (moss, and the words say so); one unplanned week under is an
// observation (neutral words, a muted marker); only `LOAD_PICTURE_LOW_WEEKS_TO_NAME` unplanned weeks in a row are
// amber. `color` is for WORDS and `markerColor` for the `LoadShape` mark: 6t-g puts hue on marks and ink on words, so
// the neutral case needs the two apart.
//
// UX-COACH-01 polish (2026-09-13): plain language, not telemetry. The verdict reads as Kit, not a readout.

import { LOAD_RATIO, LOAD_PICTURE_LOW_WEEKS_TO_NAME } from '@/lib/coaching/constants'

export interface LoadVerdict { label: string; color: string; markerColor: string }

/** What the plan says about this week. Required, so a caller cannot forget it and fall back to "a warning". */
export interface LoadVerdictContext { plannedEasy: boolean; lowWeeksRunning: number }

export function loadRatioContext(ratio: number | null, ctx: LoadVerdictContext): LoadVerdict {
  if (ratio === null) return { label: '—', color: 'var(--mute)', markerColor: 'var(--mute)' }
  if (ratio >= LOAD_RATIO.watch) return { label: 'above your recent normal', color: 'var(--warn)', markerColor: 'var(--warn)' }
  if (ratio < LOAD_RATIO.under) {
    if (ctx.plannedEasy) return { label: 'lighter, as planned', color: 'var(--moss-strong)', markerColor: 'var(--moss)' }
    if (ctx.lowWeeksRunning >= LOAD_PICTURE_LOW_WEEKS_TO_NAME) {
      return { label: 'under your normal again', color: 'var(--warn)', markerColor: 'var(--warn)' }
    }
    return { label: 'under your recent normal', color: 'var(--ink-2)', markerColor: 'var(--mute)' }
  }
  return { label: 'right on your normal', color: 'var(--moss-strong)', markerColor: 'var(--moss-strong)' }
}
