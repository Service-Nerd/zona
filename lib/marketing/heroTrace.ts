import { BRAND } from '@/lib/brand'

/**
 * DESIGN-V3 — the hero evidence card's two states, in one place.
 *
 * ⚠️ `BREACH_MINUTES` IS THE SINGLE SOURCE FOR THREE THINGS that have to
 * agree or the card is lying to the reader: the big verdict number, the
 * minutes Kit names in her sentence, and the shaded area of the drawn trace.
 *
 * The handoff had them disagreeing. Its number said 14 and its path shaded
 * 44.7% of an 8 km run, which is about 25 minutes. Kit's line said 14 too, so
 * the copy was self-consistent and the drawing was the outlier — and 25
 * minutes above the ceiling is not "bit keen", it is a different session. The
 * path was re-cut to match 14, and `hrTraceGeometry.test.ts` re-measures the
 * committed path against this constant on every run.
 *
 * ⚠️ The sentence is BUILT from the constant, not typed alongside it. Two
 * places to edit is how the number and the sentence drift apart, which is the
 * exact failure this module exists to prevent.
 */

/** The run the card describes. 8 km easy at the published easy band. */
export const RUN_KM = 8
export const RUN_MINUTES = 55
export const CEILING_BPM = 145

/** Minutes above the ceiling in the keen state. Drives number, copy and path. */
export const BREACH_MINUTES = 14

export type TracePhase = 0 | 1

export const HERO_TRACE = {
  /** Header, left. */
  /** The handoff's HOMEPAGE variant, not its hero-study variant: Zone 2 moves
   *  into the eyebrow so the right-hand side is short enough not to wrap at
   *  390px, where the two-up header stacked with a gap. */
  eyebrow: `Yesterday · ${RUN_KM} km easy · Zone 2`,
  /** Header, right. */
  meta: `Ceiling ${CEILING_BPM} bpm`,
  /** Shorter header for the 390px composition, where the row would wrap. */
  metaShort: `${CEILING_BPM} bpm`,
  label: 'minutes above your ceiling',

  states: [
    {
      value: String(BREACH_MINUTES),
      /** Voice: "Bit keen. Ease it back." is the canonical too-fast line in
       *  CLAUDE.md's table. The middle clause carries the measurement. */
      sentence: `Bit keen. ${BREACH_MINUTES} minutes above your ceiling. Ease it back Thursday.`,
      tone: 'warn' as const,
    },
    {
      value: '0',
      /** "There it is. Don't ruin it." is the canonical held line; this is the
       *  same register, naming the zone the product is about. */
      sentence: 'Held Zone 2 the whole way. That’s the win.',
      tone: 'moss' as const,
    },
  ],

  /** Kit is named from BRAND, never typed. */
  coachEyebrow: `${BRAND.coachName} · your coach`,
} as const

/** Seconds between state flips. Never runs under reduced motion. */
export const LOOP_SECONDS = 7
/** Delay before the draw-in, so the stroke animates rather than appearing drawn. */
export const DRAW_DELAY_MS = 150
