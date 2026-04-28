// Zone education copy — single source of truth for "what is this zone?"
// surfaced in the Profile zones list and the session card tap-explainer.
//
// Voice rules (docs/canonical/brand.md):
//   honest, slightly dry, no cringe.
//   one sentence per idea. specific beats abstract.
//   no jargon (RPE numbers, VO₂max, fast-twitch). plain English.

import type { ZoneKey } from './zoneRules'

export interface ZoneCopy {
  /** "Zone 2" */
  label: string
  /** Short human name shown in lists. */
  name: string
  /** What it is — one sentence. */
  what: string
  /** What it feels like — plain language, no RPE numbers. */
  feel: string
  /** Why it matters — coaching rationale, sharp not textbook. */
  why: string
}

export const ZONE_COPY: Record<ZoneKey | 'Z1' | 'Z5', ZoneCopy> = {
  'Z1': {
    label: 'Zone 1',
    name: 'Recovery',
    what: 'Walking pace. Warm-ups, cool-downs, the bit before and after the work.',
    feel: 'Effortless. You barely notice you\'re moving.',
    why: 'Movement that doesn\'t cost you anything. Useful around the work, not as the work.',
  },
  'Z2': {
    label: 'Zone 2',
    name: 'Aerobic base',
    what: 'Easy aerobic running. Most of your plan lives here.',
    feel: 'Embarrassingly slow. If you can hold a conversation, you\'re in. If you\'re huffing, slow down.',
    why: 'This is where the fitness actually builds. Run it too hard and you train the wrong system — that\'s grey-zone running, and it\'s why most amateurs stall.',
  },
  'Z3': {
    label: 'Zone 3',
    name: 'Tempo',
    what: 'Comfortably hard. The pace you could just about hold for an hour.',
    feel: 'Three-word answers only. Deliberate, focused.',
    why: 'Raises the speed you can hold before things fall apart. One of these a week, not two.',
  },
  'Z4-5': {
    label: 'Zone 4–5',
    name: 'Hard',
    what: 'Genuinely hard. Intervals, hill reps, fast finishes.',
    feel: 'You can\'t talk. You\'re counting down to the rest.',
    why: 'The top end of your fitness. Has to actually hurt to count — half-effort intervals are wasted intervals.',
  },
  'Z5': {
    label: 'Zone 5',
    name: 'All-out',
    what: 'Maximum effort. Short, sharp, full recovery between.',
    feel: 'You\'re not thinking, you\'re surviving the rep.',
    why: 'Use it sparingly. Expensive to recover from, easy to overdo.',
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
