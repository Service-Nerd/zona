import { describeDerivedSet, type DerivedSet } from './resolveMainSet'
import { z } from 'zod'
// FREE — infrastructure
// Universal run format composer (CoachingPrinciples §16, ADR-009).
//
// Takes a Session + SESSION_FORMAT + optional catalogue row, returns a
// structured warm-up / main / cool-down output. The output is data — UI
// consumers (SessionCard, AI enricher prompts) render it. The composer
// doesn't render strings beyond short structural labels.
//
// Backward compat (4.3): handles legacy sessions without structured fields by
// falling back to whatever data is available; never throws.

import { SESSION_FORMAT, sessionSplit } from './sessionFormat'
import { isLongRun, isShakeout } from './sessionRole'
import type { Session } from '@/types/plan'
import type { SessionCatalogueRow } from './sessionCatalogueData'

export interface SessionPart {
  duration_mins:  number
  zone:           string
  description:    string
  /** Estimated distance for this part, in km. Derived from the SESSION's own
   *  overall pace (distance_km / duration_mins) — the same one-representative
   *  -pace convention the top-level session total already uses (a quality
   *  session's own `distance_km` is itself computed via main-set pace applied
   *  across the whole duration, Coaching Board 2026-09-03), so this doesn't
   *  invent a new precision claim — it reflects the one already baked into
   *  the total the runner already sees. Parts sum to the session total
   *  exactly (up to rounding), by construction. Absent when the session has
   *  no `distance_km` to derive a ratio from (a pure-duration session). The
   *  UI marks it as an estimate (`~`), same convention as the top-level card. */
  distance_km?: number
}

export interface StridesBlock {
  count:               number
  duration_secs:       number
  description:         string
}

export interface RacePaceSegment {
  duration_pct:    number   // % of total session main set
  pace_target:     string   // e.g. "5:04 /km"
  description:     string
}

export interface SessionStructure {
  warmup:             SessionPart
  strides?:           StridesBlock
  main:               SessionPart
  race_pace_segment?: RacePaceSegment
  cooldown:           SessionPart
  total_duration_mins: number
  /** Stable identifier the UI may use to map to icons/labels. */
  shape: 'easy_run' | 'long_run' | 'long_run_with_mp' | 'quality_continuous' | 'quality_repeats' | 'quality_progression' | 'shakeout' | 'race' | 'strength' | 'rest' | 'unknown'
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface ComposeArgs {
  session:        Session
  catalogueRow?:  SessionCatalogueRow | null
  goalPace?:      string | null
}

/**
 * Compose a structured session breakdown from a Session, an optional catalogue
 * row, and optional goal pace. Returns null only if duration cannot be
 * determined (no distance + no duration). Otherwise always returns a structure.
 */
export function composeSession(args: ComposeArgs): SessionStructure | null {
  const { session, catalogueRow, goalPace } = args

  // No-op session types — return a minimal "shape" for the UI to handle.
  if (session.type === 'rest') {
    return zeroStructure('rest')
  }
  if (session.type === 'race') {
    return zeroStructure('race')
  }
  if (session.type === 'strength' || session.type === 'cross-train') {
    return zeroStructure('strength', session.duration_mins ?? 45)
  }

  // Determine total duration. Prefer duration_mins; fall back to distance × pace
  // estimate (6.5 min/km, matching DashboardClient's `~Xmin` heuristic) for
  // legacy plans where duration_mins is absent but distance_km is present.
  // Sessions with neither field still return null — there's nothing meaningful
  // to compose.
  let total = session.duration_mins ?? 0
  if (total <= 0 && typeof session.distance_km === 'number' && session.distance_km > 0) {
    total = Math.round(session.distance_km * 6.5)
  }
  if (total <= 0) return null

  // Coaching Board 2026-09-03 (cleared, ADR-015 display work) / SLT 2026-09-03
  // — the session's own overall pace, used to stamp a distance estimate onto
  // every part via `withDistances`. Null when there's no distance_km to derive
  // a ratio from (a pure-duration session) — parts then stay duration-only.
  const kmPerMin = typeof session.distance_km === 'number' && session.distance_km > 0 && total > 0
    ? session.distance_km / total
    : null

  const isQuality = session.type === 'quality' || session.type === 'tempo' || session.type === 'intervals' || session.type === 'hard'
  const isLong    = isLongRun(session)
  // marathon-pace is a display sub-shape of the long run, not a correctness
  // classification — kept label-derived.
  const isMpLong  = isLong && (session.label?.toLowerCase().includes('marathon-pace') ?? false)
  const isShake   = isShakeout(session)

  // Shakeout: short Z1 with brief warm-up only.
  if (isShake) {
    return withDistances({
      warmup:   part(2, 'Z1', 'Walk-jog opener.'),
      main:     part(Math.max(total - 4, 1), 'Z1', 'Easy through. Loose, not committed.'),
      cooldown: part(2, 'Z1', 'Easy walk-jog finish.'),
      total_duration_mins: total,
      shape: 'shakeout',
    }, kmPerMin)
  }

  // ── Easy / long runs ────────────────────────────────────────────────────────
  if (!isQuality) {
    const warmupMins   = Math.max(SESSION_FORMAT.UNIVERSAL.warmup_min_duration_mins, Math.round(total * SESSION_FORMAT.UNIVERSAL.warmup_pct / 100))
    const cooldownMins = Math.max(SESSION_FORMAT.COOLDOWN.min_duration_mins, Math.round(total * SESSION_FORMAT.UNIVERSAL.cooldown_pct / 100))
    const mainMins     = Math.max(0, total - warmupMins - cooldownMins)

    if (isMpLong && goalPace) {
      // Long run with MP segment (CoachingPrinciples §5).
      const mpPct = SESSION_FORMAT.LONG_RUN_PEAK.race_pace_segment_pct
      return withDistances({
        warmup:   part(SESSION_FORMAT.LONG_RUN_PEAK.warmup_mins, 'Z1→Z2', 'Easy through warm-up. Build to Z2 over the first third.'),
        main:     part(Math.round(mainMins * (1 - mpPct / 100)), 'Z2', 'Easy aerobic. Stay calm.'),
        race_pace_segment: {
          duration_pct: mpPct,
          pace_target:  goalPace,
          description:  `Final ${mpPct}% at MP target ${goalPace}. Pace, not effort.`,
        },
        cooldown: part(cooldownMins, 'Z1', 'Easy walk-jog finish.'),
        total_duration_mins: total,
        shape: 'long_run_with_mp',
      }, kmPerMin)
    }

    return withDistances({
      warmup:   part(warmupMins, 'Z1→Z2', 'Easy through warm-up. Build to Z2 over the first third.'),
      main:     part(mainMins, session.zone ?? 'Z2', 'Steady aerobic.' ),
      cooldown: part(cooldownMins, 'Z1', SESSION_FORMAT.COOLDOWN.include_walk_for_long_runs && isLong ? 'Easy walk-jog finish.' : 'Easy finish.'),
      total_duration_mins: total,
      shape: isLong ? 'long_run' : 'easy_run',
    }, kmPerMin)
  }

  // ── Quality session ─────────────────────────────────────────────────────────
  // Phase 3, Coaching Board 2026-09-03 (D-08/INV-CFG-001 defect fix) — single
  // owner is `sessionFormat.sessionSplit`, not a local re-derivation. This used
  // to add its own 5-minute cool-down floor that `mainSetMinutes` never had —
  // for a 25-minute session this disagreed with the invariant layer's own
  // number (5 min main here vs 7.5 min via mainSetMinutes).
  const split = sessionSplit(total)
  const warmupMins = Math.round(split.warmup)
  const cooldownMins = Math.round(split.cooldown)
  const mainMins = Math.max(1, total - warmupMins - cooldownMins)

  const strides: StridesBlock | undefined = SESSION_FORMAT.WARMUP.strides_required_for_quality
    ? {
        count:         SESSION_FORMAT.WARMUP.strides_count,
        duration_secs: SESSION_FORMAT.WARMUP.strides_duration_seconds,
        description:   `${SESSION_FORMAT.WARMUP.strides_count}×${SESSION_FORMAT.WARMUP.strides_duration_seconds}s strides at end of warm-up.`,
      }
    : undefined

  const mainShape = catalogueShapeFor(catalogueRow)
  const mainDesc  = mainSetDescription(catalogueRow, session)

  return withDistances({
    warmup:   part(warmupMins, 'Z1→Z2', 'Easy build through warm-up. Final third in Z2.'),
    strides,
    main:     part(mainMins, session.zone ?? 'Z3', mainDesc),
    cooldown: part(cooldownMins, 'Z1', 'Easy walk-jog finish.'),
    total_duration_mins: total,
    shape: mainShape,
  }, kmPerMin)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function part(duration_mins: number, zone: string, description: string): SessionPart {
  return { duration_mins, zone, description }
}

// Coaching Board 2026-09-03 (cleared without a ruling — pure display, ADR-015
// territory) / SLT 2026-09-03 (build now, build completely, FREE tier) —
// stamps a distance estimate onto every part of a composed structure, using
// the SESSION's own overall pace (distance_km / duration_mins) so parts
// always sum to the session total exactly. Applied once, centrally, rather
// than threading a ratio through every `part(...)` call site.
function withDistances(structure: SessionStructure, kmPerMin: number | null): SessionStructure {
  if (kmPerMin == null) return structure
  const stamp = (p: SessionPart): SessionPart =>
    p.duration_mins > 0 ? { ...p, distance_km: +(p.duration_mins * kmPerMin).toFixed(2) } : p
  return {
    ...structure,
    warmup: stamp(structure.warmup),
    main: stamp(structure.main),
    cooldown: stamp(structure.cooldown),
  }
}

function zeroStructure(shape: SessionStructure['shape'], total = 0): SessionStructure {
  return {
    warmup: part(0, '—', ''),
    main:   part(total, '—', ''),
    cooldown: part(0, '—', ''),
    total_duration_mins: total,
    shape,
  }
}

function catalogueShapeFor(row: SessionCatalogueRow | null | undefined): SessionStructure['shape'] {
  if (!row) return 'quality_continuous'
  const t = (row.main_set_structure as { type?: string } | null)?.type
  if (t === 'repeats')     return 'quality_repeats'
  if (t === 'progression') return 'quality_progression'
  return 'quality_continuous'
}

// The session stores `derived_set` as `unknown` (schema.ts keeps DerivedSet's
// shape owned by resolveMainSet.ts rather than duplicating it in Zod — D-08).
// This is the narrow runtime guard for reading it back at the display boundary.
const DerivedSetSchema = z.object({
  version: z.literal(2),
  blocks: z.array(z.object({
    repeat: z.number(),
    label: z.string().optional(),
    steps: z.array(z.object({
      role: z.enum(['work', 'recovery', 'transition']),
      modality: z.enum(['run', 'jog', 'walk', 'stand', 'hike']),
      terrain: z.enum(['flat', 'uphill', 'downhill', 'rolling']).optional(),
      length: z.string(),
      pace: z.string().nullable(),
      pace_mode: z.enum(['target', 'ceiling', 'floor']).optional(),
      zone: z.string().optional(),
      rpe: z.number().optional(),
      advance: z.enum(['auto', 'manual']),
      note: z.string().optional(),
    })),
  })),
}) satisfies z.ZodType<unknown>

function mainSetDescription(row: SessionCatalogueRow | null | undefined, session: Session): string {
  // SC-08b — a v2 session carries the set RESOLVED FOR THIS RUNNER, so it takes
  // precedence over anything derived from the shared row. The row's v1 text is
  // generic by construction ("4 × 1000m @ 5K pace"); the derived set has this
  // runner's actual paces in it.
  //
  // Everything below stays exactly as it was for v1 rows — D-03: old shapes are
  // never silently reinterpreted.
  if (session.derived_set) {
    const parsed = DerivedSetSchema.safeParse(session.derived_set)
    if (parsed.success) return `${describeDerivedSet(parsed.data)}.`
    // Malformed derived set: fall through to the v1 path rather than render
    // nothing. INV-PLAN-DERIVED-SET catches it at generation.
  }

  if (!row) {
    // Fallback: use catalogue purpose if available, else zone-only generic.
    return session.label ?? 'Quality main set.'
  }
  const m = row.main_set_structure as Record<string, unknown>
  if (m.type === 'repeats' && typeof m.reps === 'number' && m.work && m.recovery) {
    const w = m.work as { duration_mins?: number; distance_m?: number; pace_target?: string; zone?: string }
    const r = m.recovery as { duration_mins?: number; duration_secs?: number; type?: string }
    const workStr = w.distance_m ? `${w.distance_m}m` : w.duration_mins ? `${w.duration_mins} min` : 'main'
    const targetStr = w.pace_target ? ` @ ${w.pace_target} pace` : w.zone ? ` ${w.zone}` : ''
    const recStr = r.duration_secs ? `${r.duration_secs}s` : r.duration_mins ? `${r.duration_mins} min` : ''
    return `${m.reps} × ${workStr}${targetStr}, ${recStr} ${r.type ?? 'jog'} recovery.`
  }
  if (m.type === 'continuous' && typeof m.duration_mins === 'number') {
    return `${m.duration_mins} min sustained at ${m.zone ?? 'target zone'}.`
  }
  if (m.type === 'progression') {
    return `${m.duration_mins ?? '—'} min progression: ${m.zone_start ?? 'Z2'} → ${m.zone_end ?? 'Z3'}.`
  }
  if (m.type === 'fartlek') {
    return `Free-play surges. Pick a tree, run hard, jog easy until breathing returns.`
  }
  return row.purpose
}
