// SESSION-PRERUN-DETAIL-01 — the session silhouette (Design Board 2026-10-21, re-sat 2026-10-22): the shape of one
// session before it is run. Width is minutes, height is the prescribed zone, read from the session MODEL
// (`composeSession` parts + the resolved `derived_set` steps), never from display text.
//
// Pure, no I/O. The one owner of the shape, so a future surface (the Today card, phase 3) draws the same one.
//
// Why it is not UX-SESSION-GLYPH-01 again: that glyph subdivided one colour on Plan rows and duplicated the label. This
// encodes DURATION and ZONE PER STEP, which neither the colour nor the label carries, and it is not drawn on Plan rows.
// ⚠️ CD-1: Cruise intervals and 1600m repeats (was "Mile repeats") draw the same shape on the harness plan (two ~10-minute reps, ~2-minute jog).
// That is the engine's taxonomy showing through, routed to the Coaching Board; the drawing is not wrong for showing it.

import type { SessionStructure } from './sessionComposer'
import type { DerivedSet, DerivedStep } from './resolveMainSet'
import { parseLength, paceMeanSecPerKm } from './sessionSteps'
import { zonesFromZoneString } from '@/lib/coaching/zoneRules'

export interface SilhouetteSegment {
  part: 'warmup' | 'main' | 'cooldown'
  mins: number
  /** 1–5, with up to +0.5 for the faster of two work paces in one zone (an "over" above an "under"). */
  level: number
  work: boolean
}

const topZone = (z: string | undefined, fallback: number) => {
  const zs = zonesFromZoneString(z)
  return zs.length ? Math.max(...zs) : fallback
}

function stepMinutes(step: DerivedStep): number | null {
  const p = parseLength(step.length)
  if (p.kind === 'duration') return p.secs / 60
  if (p.kind === 'distance') {
    const pace = paceMeanSecPerKm(step.pace)
    return pace ? (p.km * pace) / 60 : null
  }
  return null
}

/** The session's shape, or null when it has no structure worth drawing (fewer than two segments, or no minutes). */
export function sessionSilhouette(structure: SessionStructure | null, derivedSet: DerivedSet | null | undefined): SilhouetteSegment[] | null {
  if (!structure) return null
  const mainZone = topZone(structure.main.zone, 2)
  const out: SilhouetteSegment[] = []
  if (structure.warmup.duration_mins > 0) out.push({ part: 'warmup', mins: structure.warmup.duration_mins, level: topZone(structure.warmup.zone, 2), work: false })

  const main: SilhouetteSegment[] = []
  if (derivedSet?.version === 2 && derivedSet.blocks.length) {
    for (const b of derivedSet.blocks) for (let r = 0; r < b.repeat; r++) for (const st of b.steps) {
      const mins = stepMinutes(st)
      if (mins == null || mins <= 0) continue
      const work = st.role === 'work'
      // RUNWALK-STEPS-01: a run-walk run step (a `transition` run carrying a zone) draws at its zone, so the alternation
      // with the walk shows. The catalogue's only other transitions run "to the hill", have no minutes and are skipped.
      const level = work ? topZone(st.zone, mainZone) : st.role === 'transition' && st.modality === 'run' && st.zone ? topZone(st.zone, 1) : 1
      main.push({ part: 'main', mins, level, work })
    }
    // Within one zone, the faster of the work paces sits a half-level up, so an over-under reads as one.
    const workPaces = derivedSet.blocks.flatMap(b => b.steps).filter(s => s.role === 'work').map(s => paceMeanSecPerKm(s.pace))
    const distinct = Array.from(new Set(workPaces.filter((p): p is number => p != null)))
    if (distinct.length > 1) {
      const fastest = Math.min(...distinct)
      let i = 0
      for (const b of derivedSet.blocks) for (let r = 0; r < b.repeat; r++) for (const st of b.steps) {
        if (stepMinutes(st) == null || (stepMinutes(st) ?? 0) <= 0) continue
        const seg = main[i++]
        if (seg.work && paceMeanSecPerKm(st.pace) === fastest) seg.level += 0.5
      }
    }
    // The steps are the shape; the composer's main-set minutes are the length. Scale to it so the strip agrees with
    // the section headers beneath it.
    const sum = main.reduce((a, s) => a + s.mins, 0)
    if (sum > 0 && structure.main.duration_mins > 0) for (const s of main) s.mins *= structure.main.duration_mins / sum
  }
  if (main.length === 0 && structure.main.duration_mins > 0) {
    main.push({ part: 'main', mins: structure.main.duration_mins, level: mainZone, work: mainZone >= 3 })
  }
  out.push(...main)
  // An MP long run's race-pace segment closes the main set, a level above the easy body.
  if (structure.race_pace_segment && structure.race_pace_segment.duration_mins > 0) {
    const seg = structure.race_pace_segment
    const last = out[out.length - 1]
    if (last?.part === 'main') last.mins = Math.max(0, last.mins - seg.duration_mins)
    out.push({ part: 'main', mins: seg.duration_mins, level: Math.min(5, mainZone + 1), work: true })
  }
  if (structure.cooldown.duration_mins > 0) out.push({ part: 'cooldown', mins: structure.cooldown.duration_mins, level: topZone(structure.cooldown.zone, 1), work: false })

  const drawn = out.filter(s => s.mins > 0)
  return drawn.length >= 2 ? drawn : null
}
