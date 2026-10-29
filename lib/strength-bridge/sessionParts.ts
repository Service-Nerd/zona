// STRENGTH-SESSION-PARTS-01 (Design Board 2026-10-28 E) — the single owner of how a strength session is cut into the
// parts a runner reads and, from build 6, does: *Warm-up · Part 1 … Part N · Cool-down*.
//
// A part is one lift, or a superset (every item sharing a `superset` tag). Measured 2026-10-28 over 53,330 sessions:
// 14,593 pairs cross a block (an accessory paired with a core move), so parts are built across the training blocks in
// order of each pair's first item, never inside one block. Client-safe: no Node imports.

import type { BlockRole, Prescription, StrengthSession } from '@/packages/strength'

export type PartKind = 'warmup' | 'cooldown' | 'superset' | Exclude<BlockRole, 'warmup' | 'mobility'>

export interface PartItem extends Prescription { role: BlockRole }

export interface SessionPart {
  kind: PartKind
  items: PartItem[]
  /** The rounds the runner counts: the most sets any item carries (1,580 of 55,968 pairs measured unequal). */
  rounds: number
  /** Rest after a round: the longest of the part's rests, as `estimateMinutes` counts a superset (S10). */
  rest_s: number
}

const PREP: Partial<Record<BlockRole, 'warmup' | 'cooldown'>> = { warmup: 'warmup', mobility: 'cooldown' }

function part(kind: PartKind, items: PartItem[]): SessionPart {
  return { kind, items, rounds: Math.max(...items.map(i => i.sets)), rest_s: Math.max(...items.map(i => i.rest_s)) }
}

/** Every item lands in exactly one part, in the session's order; a superset's items stay together. */
export function sessionParts(session: Pick<StrengthSession, 'blocks'>): SessionPart[] {
  const out: SessionPart[] = []
  const byTag = new Map<string, SessionPart>()
  for (const b of session.blocks) {
    if (!b.items.length) continue
    const prep = PREP[b.role]
    if (prep) { out.push(part(prep, b.items.map(i => ({ ...i, role: b.role })))); continue }
    for (const it of b.items) {
      const item = { ...it, role: b.role }
      if (!it.superset) { out.push(part(b.role as PartKind, [item])); continue }
      const open = byTag.get(it.superset)
      if (open) { Object.assign(open, part('superset', [...open.items, item])); continue }
      const p = part(b.role as PartKind, [item])
      byTag.set(it.superset, p)
      out.push(p)
    }
  }
  return out
}

/** The training parts, numbered from 1 (warm-up and cool-down carry no number). */
export function trainingParts(parts: SessionPart[]): SessionPart[] {
  return parts.filter(p => p.kind !== 'warmup' && p.kind !== 'cooldown')
}

/**
 * The effort a session is said at once, in the tile: the most common RIR over its reps-based training items (ties
 * to the lower, the harder ask). Null when nothing reps-based carries one (mobility, an all-timed session). Measured
 * 2026-10-28: 37% of training sessions mix RIRs (a light-leg or novice item at 3 beside mains at 2), so a part whose
 * effort differs says its own (`partEffort`).
 */
export function sessionEffort(parts: SessionPart[]): number | null {
  const counts = new Map<number, number>()
  for (const p of trainingParts(parts)) for (const i of p.items) if (i.reps != null && i.rir != null) counts.set(i.rir, (counts.get(i.rir) ?? 0) + 1)
  if (!counts.size) return null
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

/** A part's own effort when it differs from the session's: `[low, high]`, or null when it matches or has none. */
export function partEffort(p: SessionPart, session: number | null): [number, number] | null {
  const rirs = Array.from(new Set(p.items.filter(i => i.reps != null && i.rir != null).map(i => i.rir as number))).sort((a, b) => a - b)
  if (!rirs.length || (rirs.length === 1 && rirs[0] === session)) return null
  return [rirs[0], rirs[rirs.length - 1]]
}
