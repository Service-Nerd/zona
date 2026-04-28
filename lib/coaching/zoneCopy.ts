// Zone education copy — single source of truth for "what is this zone?"
// surfaced in the Profile zones list and the session card tap-explainer.
//
// Voice: brand-aligned (CLAUDE.md), honest, no motivational fluff.
// Each zone has the same shape so a future "all zones" screen can map it
// directly without per-zone special-casing.

import type { ZoneKey } from './zoneRules'

export interface ZoneCopy {
  /** "Zone 2" */
  label: string
  /** Short human name shown in lists. */
  name: string
  /** One-line summary. */
  summary: string
  /** What it feels like — RPE band + pacing test. */
  feel: string
  /** When the user will see it in their plan. */
  whenYouSeeIt: string
  /** Why it matters — coaching rationale. */
  why: string
}

export const ZONE_COPY: Record<ZoneKey | 'Z1' | 'Z5', ZoneCopy> = {
  'Z1': {
    label: 'Zone 1',
    name: 'Recovery',
    summary: 'Active recovery. Walking, easy spinning, warm-up before a hard set.',
    feel: 'RPE 1–2. Effortless. You barely notice you\'re moving.',
    whenYouSeeIt: 'Warm-ups, cool-downs, recovery walks. Rarely a session in its own right.',
    why: 'Movement that doesn\'t add fatigue. Useful before and after the work, not as the work.',
  },
  'Z2': {
    label: 'Zone 2',
    name: 'Aerobic base',
    summary: 'Easy aerobic running. Most of your plan lives here.',
    feel: 'RPE 3–4. Conversational. You can hold full sentences without gasping.',
    whenYouSeeIt: 'Every easy run, every long run, every recovery run. ~80% of your weekly volume.',
    why: 'Aerobic adaptation happens here. Run too hard and you train your fast-twitch system instead — that\'s grey-zone running, and it\'s why most amateurs stall.',
  },
  'Z3': {
    label: 'Zone 3',
    name: 'Tempo',
    summary: 'Comfortably hard. The pace you could hold for an hour if you had to.',
    feel: 'RPE 5–6. 3-word sentences only. Deliberate, focused.',
    whenYouSeeIt: 'Tempo runs, longer threshold reps. Once a week at most.',
    why: 'Raises your lactate threshold — the speed you can hold before things fall apart.',
  },
  'Z4-5': {
    label: 'Zone 4–5',
    name: 'Hard',
    summary: 'Genuinely hard. Intervals, hill reps, fast finishes.',
    feel: 'RPE 7–9. Single-word answers. You\'re counting down to the rest.',
    whenYouSeeIt: 'Interval sessions. Short reps with full recovery between.',
    why: 'Trains VO₂max and running economy. Has to be hard to count — half-effort intervals are wasted intervals.',
  },
  'Z5': {
    label: 'Zone 5',
    name: 'VO₂ Max',
    summary: 'Maximum effort. Short, sharp, full-recovery intervals.',
    feel: 'RPE 9–10. You can\'t talk. You\'re counting down to the rest.',
    whenYouSeeIt: 'Short reps (30s–3min) with full recovery. Sparingly.',
    why: 'Top-end fitness. Use it occasionally — it\'s expensive to recover from.',
  },
}

/** Resolve copy by zone number (1–5) — used by the Profile zones list. */
export function zoneCopyByNumber(n: number): ZoneCopy {
  if (n === 1) return ZONE_COPY['Z1']
  if (n === 2) return ZONE_COPY['Z2']
  if (n === 3) return ZONE_COPY['Z3']
  if (n === 4) return ZONE_COPY['Z4-5']
  if (n === 5) return ZONE_COPY['Z5']
  return ZONE_COPY['Z2']
}
