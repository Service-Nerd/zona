// LOAD-VERDICT-RED-01 — the single owner of the Coach load verdict: the words and the colour for a week's
// acute:chronic ratio. Read by the Coach "This week's load" tile, its `LoadShape` marker and the load sheet.
//
// Was a private function inside `DashboardClient`, so nothing else could reuse it or test it, and it coloured
// "above your recent normal" `--danger`: red in the training UI, against ux-principles.md ("No red in the training
// UI: amber for warnings"). A week above the runner's normal is a warning, not an error. Words and marker share the
// colour on purpose, so they can never disagree (A5, Design Board 2026-09-22).
//
// UX-COACH-01 polish (2026-09-13): plain language, not telemetry. The number is the same; the verdict reads as Kit,
// not a readout ("overloading" became the plain words below). Both the tile and the load-ratio sheet use this label.

import { LOAD_RATIO } from '@/lib/coaching/constants'

export function loadRatioContext(ratio: number | null): { label: string; color: string } {
  if (ratio === null) return { label: '—', color: 'var(--mute)' }
  if (ratio >= LOAD_RATIO.watch) return { label: 'above your recent normal', color: 'var(--warn)' }
  if (ratio < LOAD_RATIO.under) return { label: 'under your recent normal', color: 'var(--warn)' }
  return { label: 'right on your normal', color: 'var(--moss-strong)' }
}
