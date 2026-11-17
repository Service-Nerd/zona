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

// ADR-026 — the keys here are exactly the zone strings `computeZones` and `anchorHrBand` can
// EMIT, resolved through `zoneKeyForZoneString`. `zoneCopyReach.test.ts` asserts that, because
// the hole it closes is specific: before the band was derived, `zoneCopyByNumber(4)` returned
// the `Z4-5` entry, so a runner on a 20-minute tempo now labelled `Zone 4` would have tapped it
// and read *"Genuinely hard. Intervals, hill reps, fast finishes. You can't talk."* That is not
// their session, and they would have learned something false about their own training
// (Sierra, ADR-026 §9; the chair agreed the copy ships WITH the band, not after it).
export const ZONE_COPY: Record<ZoneKey | 'Z1' | 'Z4' | 'Z5', ZoneCopy> = {
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
    why: 'This is where the fitness actually builds. Run it too hard and you train the wrong system. That\'s grey-zone running, and it\'s why most amateurs stall.',
  },
  'Z3': {
    label: 'Zone 3',
    name: 'Tempo',
    what: 'Comfortably hard. The pace you could just about hold for an hour.',
    feel: 'Three-word answers only. Deliberate, focused.',
    why: 'Raises the speed you can hold before things fall apart. One of these a week, not two.',
  },
  // NEW with ADR-026. A threshold session's band is derived from its `T` anchor, so for a
  // trained runner it lands in Zone 4 — the same session reads `Zone 3–4` for someone less
  // trained, because the same effort is a different fraction of two different reserves.
  // Measured on the cohort: 9,384 sessions now read `Zone 4`.
  'Z4': {
    label: 'Zone 4',
    name: 'Threshold',
    what: 'Sustained hard running. Tempo and cruise work land here once you are trained.',
    feel: 'Three-word answers. The same hard at the end as at the start.',
    why: 'The ceiling you race under. It only counts if you hold it: drift up and you have run intervals you did not plan.',
  },
  'Z4-5': {
    label: 'Zone 4–5',
    name: 'Hard',
    what: 'Genuinely hard. Intervals, hill reps, fast finishes.',
    feel: 'You can\'t talk. You\'re counting down to the rest.',
    why: 'The top end of your fitness. Has to actually hurt to count; half-effort intervals are wasted intervals.',
  },
  // AMENDED with ADR-026, because what reaches this entry changed. The interval band is now
  // anchored at `I` with its floor on the CV ceiling, so for a runner with a VDOT it sits
  // wholly inside Zone 5 — measured, 904 interval sessions now read `Zone 5` where every one
  // of them read `Zone 4–5` before. The old copy ("Maximum effort. Short, sharp, full recovery
  // between.") described a sprint, and a 5 × 3 min set at interval pace is not a sprint.
  'Z5': {
    label: 'Zone 5',
    name: 'Intervals',
    what: 'Rep work at the top of your range, and race efforts. Reps you count down, not runs you settle into.',
    feel: 'You can\'t talk. Breathing sets the limit before your legs do.',
    why: 'The most expensive work you do, and the easiest to waste. Half-effort reps buy nothing; one session a week is plenty.',
  },
}

/** Resolve copy by zone number (1–5) — used by the Profile zones list. */
export function zoneCopyByNumber(n: number): ZoneCopy {
  if (n === 1) return ZONE_COPY['Z1']
  if (n === 2) return ZONE_COPY['Z2']
  if (n === 3) return ZONE_COPY['Z3']
  // ADR-026 — was `ZONE_COPY['Z4-5']`, which described intervals to a runner reading a tempo.
  if (n === 4) return ZONE_COPY['Z4']
  if (n === 5) return ZONE_COPY['Z5']
  return ZONE_COPY['Z2']
}
