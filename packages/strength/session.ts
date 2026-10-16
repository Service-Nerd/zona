// STRENGTH-ENGINE-01 — building one session and fitting it to 30/45/60 min (S10).
//
// 30 minutes must be a real session (McMillan): the packer drops accessories
// before it trims sets, and it never shortens rest, because rest is part of
// the dose for heavy work.

import { CATALOGUE_BY_ID, HEAVY_LEG_PATTERNS, PATTERN_REGION } from './catalogue'
import { STRENGTH_CONFIG as C } from './config'
import { prescribe, type DoseContext } from './prescription'
import { eligible, selectExercise, type SelectionContext } from './select'
import type { Block, BlockRole, Focus, Pattern, Prescription, SessionKind, StrengthNote } from './types'

interface Slot { pattern: Pattern; role: BlockRole; priority: number }

const LOWER_RUNNING: Slot[] = [
  { pattern: 'plyometric', role: 'plyo', priority: 4 },
  { pattern: 'single_leg', role: 'main', priority: 1 },
  { pattern: 'hinge', role: 'main', priority: 1 },
  { pattern: 'calf', role: 'accessory', priority: 2 },
  { pattern: 'hip_abduction', role: 'accessory', priority: 3 },
]

/** Running and general share the lower body; general adds upper volume, never leg volume (ADR-024 rule 4). */
export const TEMPLATES: Record<Focus, Record<Exclude<SessionKind, 'mobility'>, Slot[]>> = {
  running: {
    full_body: [
      ...LOWER_RUNNING,
      { pattern: 'upper_pull', role: 'accessory', priority: 3 },
      { pattern: 'anti_rotation', role: 'core', priority: 2 },
      { pattern: 'upper_push', role: 'accessory', priority: 4 },
      { pattern: 'lateral_core', role: 'core', priority: 5 },
    ],
    lower_core: [
      ...LOWER_RUNNING,
      { pattern: 'squat', role: 'accessory', priority: 3 },
      { pattern: 'anti_rotation', role: 'core', priority: 2 },
      { pattern: 'lateral_core', role: 'core', priority: 4 },
    ],
    upper_core: [
      { pattern: 'upper_pull', role: 'main', priority: 1 },
      { pattern: 'upper_push', role: 'main', priority: 1 },
      { pattern: 'anti_rotation', role: 'core', priority: 2 },
      { pattern: 'anti_extension', role: 'core', priority: 2 },
      { pattern: 'hip_abduction', role: 'accessory', priority: 3 },
      { pattern: 'lateral_core', role: 'core', priority: 4 },
    ],
  },
  general: {
    full_body: [
      ...LOWER_RUNNING.filter(s => s.role !== 'plyo'),
      { pattern: 'upper_push', role: 'main', priority: 1 },
      { pattern: 'upper_pull', role: 'main', priority: 1 },
      { pattern: 'anti_extension', role: 'core', priority: 2 },
      { pattern: 'anti_rotation', role: 'core', priority: 4 },
    ],
    lower_core: [
      ...LOWER_RUNNING.filter(s => s.role !== 'plyo'),
      { pattern: 'squat', role: 'accessory', priority: 3 },
      { pattern: 'anti_extension', role: 'core', priority: 2 },
      { pattern: 'lateral_core', role: 'core', priority: 4 },
    ],
    upper_core: [
      { pattern: 'upper_push', role: 'main', priority: 1 },
      { pattern: 'upper_pull', role: 'main', priority: 1 },
      { pattern: 'upper_pull', role: 'accessory', priority: 2 },
      { pattern: 'upper_push', role: 'accessory', priority: 3 },
      { pattern: 'anti_extension', role: 'core', priority: 2 },
      { pattern: 'anti_rotation', role: 'core', priority: 3 },
      { pattern: 'lateral_core', role: 'core', priority: 4 },
    ],
  },
}

const WARMUP_ORDER = ['marching_high_knees', 'leg_swings', 'hip_circles', 'glute_bridge_activation', 'band_walk_warmup', 'worlds_greatest_stretch', 'inchworm', 'ankle_rocks']
const POTENTIATE = ['goblet_squat_ramp', 'a_skip']
const MOBILITY_ORDER = ['hip_flexor_stretch', 'calf_stretch_wall', 'pigeon_stretch', 'thoracic_rotation', 'hamstring_floss', 'ninety_ninety']

function workSeconds(p: Prescription): number {
  const w = p.reps != null ? p.reps * C.SECONDS_PER_REP : p.seconds != null ? p.seconds : (p.contacts ?? 0) * C.SECONDS_PER_CONTACT
  return p.per_side ? w * 2 : w
}

/** Estimated session minutes. Supersets count rest once per round (S10). */
export function estimateMinutes(blocks: Block[], warmupMinutes: number): number {
  let s = warmupMinutes * 60
  for (const b of blocks) {
    if (b.role === 'warmup') continue
    const done = new Set<string>()
    for (const it of b.items) {
      if (it.superset) {
        if (done.has(it.superset)) continue
        done.add(it.superset)
        const pair = blocks.flatMap(x => x.items).filter(x => x.superset === it.superset)
        const sets = Math.max(...pair.map(x => x.sets))
        s += sets * (pair.reduce((a, x) => a + workSeconds(x), 0) + Math.max(...pair.map(x => x.rest_s))) + pair.length * C.TRANSITION_S
      } else {
        s += it.sets * (workSeconds(it) + it.rest_s) + C.TRANSITION_S
      }
    }
  }
  return Math.round(s / 60)
}

export interface BuiltSession {
  kind: SessionKind
  heavy_legs: boolean
  blocks: Block[]
  estimated_minutes: number
  notes: StrengthNote[]
}

export function buildMobilitySession(sel: SelectionContext): BuiltSession {
  const items = MOBILITY_ORDER
    .map(id => CATALOGUE_BY_ID.get(id)!)
    .filter(e => eligible(e, sel))
    .map(e => prescribe(e, 'mobility', { profile: sel.profile, phase: 'race_week', weekIndex: sel.weekIndex }))
  const blocks: Block[] = [{ role: 'mobility', items }]
  return { kind: 'mobility', heavy_legs: false, blocks, estimated_minutes: estimateMinutes(blocks, 0), notes: [] }
}

export function buildSession(kind: Exclude<SessionKind, 'mobility'>, sel: SelectionContext, dose: DoseContext, plyoAllowed: boolean): BuiltSession {
  const minutes = sel.profile.session_minutes
  const warmupMinutes = C.WARMUP_MINUTES[minutes]
  const notes: StrengthNote[] = []
  const used = new Set<string>()

  type Chosen = { slot: Slot; item: Prescription }
  let chosen: Chosen[] = []
  for (const slot of TEMPLATES[sel.profile.focus][kind]) {
    if (slot.role === 'plyo' && !plyoAllowed) continue
    const lowerSlot = PATTERN_REGION[slot.pattern] === 'lower'
    const ex = selectExercise(slot.pattern, { ...sel, preferUnilateral: sel.preferUnilateral && lowerSlot }, used, slot.role === 'main')
    if (!ex) {
      if (slot.role === 'main') notes.push('pattern_unavailable')
      continue
    }
    used.add(ex.id)
    chosen.push({ slot, item: prescribe(ex, slot.role, dose) })
  }

  const isHeavy = (c: Chosen[]) => c.some(x => HEAVY_LEG_PATTERNS.includes(x.slot.pattern))
  const warmItems: Prescription[] = []
  const warmCount = minutes === 30 ? 4 : minutes === 45 ? 5 : 6
  for (const id of WARMUP_ORDER) {
    if (warmItems.length >= warmCount) break
    const e = CATALOGUE_BY_ID.get(id)!
    if (eligible(e, sel)) warmItems.push(prescribe(e, 'warmup', dose))
  }
  if (isHeavy(chosen)) {
    for (const id of POTENTIATE) {
      const e = CATALOGUE_BY_ID.get(id)!
      if (eligible(e, sel)) { warmItems.push(prescribe(e, 'warmup', dose)); break }
    }
  }

  const assemble = (c: Chosen[]): Block[] => {
    const order: BlockRole[] = ['plyo', 'main', 'accessory', 'core']
    const blocks: Block[] = [{ role: 'warmup', items: warmItems }]
    for (const role of order) {
      const items = c.filter(x => x.slot.role === role).map(x => ({ ...x.item }))
      if (items.length) blocks.push({ role, items })
    }
    // Pair accessory and core work into non-competing supersets.
    const pairable = blocks.filter(b => b.role === 'accessory' || b.role === 'core').flatMap(b => b.items)
    let tag = 0
    for (let i = 0; i + 1 < pairable.length; i += 2) {
      const a = CATALOGUE_BY_ID.get(pairable[i].exercise_id)!, b = CATALOGUE_BY_ID.get(pairable[i + 1].exercise_id)!
      if (PATTERN_REGION[a.pattern] !== PATTERN_REGION[b.pattern]) {
        const t = String.fromCharCode(65 + tag++)
        pairable[i].superset = t; pairable[i + 1].superset = t
      }
    }
    return blocks
  }

  let blocks = assemble(chosen)
  let est = estimateMinutes(blocks, warmupMinutes)
  // Over budget: drop the lowest-priority slot, but always keep one core item.
  while (est > minutes) {
    const coreCount = chosen.filter(c => c.slot.role === 'core').length
    const droppable = chosen
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.slot.priority > 1 && !(c.slot.role === 'core' && coreCount <= 1))
      .sort((a, b) => b.c.slot.priority - a.c.slot.priority || b.i - a.i)
    if (droppable.length) {
      chosen = chosen.filter((_, i) => i !== droppable[0].i)
    } else {
      const main = chosen.filter(c => c.slot.role === 'main' && c.item.sets > 2)
      if (!main.length) break
      main[main.length - 1].item = { ...main[main.length - 1].item, sets: main[main.length - 1].item.sets - 1 }
    }
    blocks = assemble(chosen)
    est = estimateMinutes(blocks, warmupMinutes)
  }
  // Under budget (a 60-minute session from a short template): add sets, then a
  // cooldown. Never in a taper or deload week, which are short on purpose, and
  // never on main lifts inside the technique block.
  if (dose.phase !== 'taper' && dose.phase !== 'deload') {
    const novice = dose.weekIndex < C.NOVICE_BLOCK_WEEKS[sel.profile.experience]
    const caps: Partial<Record<BlockRole, number>> = { main: novice ? 0 : C.MAIN_SETS_MAX, accessory: C.ACCESSORY_SETS_MAX, core: C.CORE_SETS_MAX }
    let grew = true
    while (est < minutes * C.FILL_TARGET && grew) {
      grew = false
      for (const role of ['main', 'accessory', 'core'] as BlockRole[]) {
        const c = chosen.find(x => x.slot.role === role && x.item.sets < (caps[role] ?? 0))
        if (!c) continue
        const trial = chosen.map(x => (x === c ? { ...x, item: { ...x.item, sets: x.item.sets + 1 } } : x))
        const t = estimateMinutes(assemble(trial), warmupMinutes)
        if (t > minutes) continue
        chosen = trial; blocks = assemble(chosen); est = t; grew = true
        break
      }
    }
    if (est < minutes * C.FILL_TARGET) {
      const cool: Prescription[] = []
      for (const id of MOBILITY_ORDER) {
        const e = CATALOGUE_BY_ID.get(id)!
        if (!eligible(e, sel)) continue
        const next = [...blocks, { role: 'mobility' as BlockRole, items: [...cool, prescribe(e, 'mobility', dose)] }]
        const t = estimateMinutes(next, warmupMinutes)
        if (t > minutes) break
        cool.push(prescribe(e, 'mobility', dose)); est = t
        if (est >= minutes * C.FILL_TARGET) break
      }
      if (cool.length) blocks = [...blocks, { role: 'mobility', items: cool }]
    }
  }
  return { kind, heavy_legs: isHeavy(chosen), blocks, estimated_minutes: est, notes }
}
