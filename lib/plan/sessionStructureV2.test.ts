import { describe, it, expect } from 'vitest'
import { StructureV2Schema, isV2Structure, PACE_ANCHORS } from './sessionStructureV2'
import { resolveMainSet, describeDerivedSet, type ResolveContext } from './resolveMainSet'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'

/**
 * SC-08b — the v2 session structure.
 *
 * The 2026-08-19 catalogue audit scored the v1 structure against six things a
 * coach would want to prescribe and got **4 NO, 2 PARTIAL, 0 YES** — no session
 * in its Task E could be expressed at all.
 *
 * These tests ARE the score. Each of the six cases is built as data and
 * resolved, so "expressible" is demonstrated rather than asserted.
 *
 * Contract: docs/contracts/data/session-structure-v2.md
 */

const CTX: ResolveContext = {
  anchors: {
    E: '6:00–7:15 /km',
    T: '5:04–5:19 /km',
    I: '4:28–4:39 /km',
    M: '5:30–5:45 /km',
    goal: '4:25–4:35 /km',
  },
  easyPaceStr: '6:00–7:15 /km',
}

const parse = (o: unknown) => {
  const r = StructureV2Schema.safeParse(o)
  if (!r.success) throw new Error(`schema rejected: ${JSON.stringify(r.error.issues)}`)
  return r.data
}

describe('SC-08b — the six cases the v1 structure could not express', () => {
  it('CASE 1 (was NO) — pyramid / ladder: rep lengths differ within one set', () => {
    // v1: a repeat set has ONE work step and a count. Two rep lengths needed two
    // sets, which reads as two workouts; three or more was unrepresentable.
    const s = parse({
      version: 2,
      sizing: { scaling: 'fixed' },   // a ladder's shape IS the session
      blocks: [{
        repeat: 1,
        label: 'ladder up',
        steps: [1, 2, 3, 4].flatMap(mins => ([
          { role: 'work', modality: 'run', length: { kind: 'duration', secs: mins * 60 },
            target: { kind: 'pace', anchor: 'T', mode: 'target' } },
          { role: 'recovery', modality: 'jog', length: { kind: 'duration', secs: 60 },
            target: { kind: 'pace', anchor: 'E', mode: 'floor' } },
        ])),
      }],
    })
    const d = resolveMainSet(s, CTX)
    const workLengths = d.blocks[0].steps.filter(x => x.role === 'work').map(x => x.length)
    expect(workLengths).toEqual(['1 min', '2 min', '3 min', '4 min'])
  })

  it('CASE 2 (was NO) — nested set: several differently-paced steps inside one repeat', () => {
    // v1: one work step per set. "3 × (3 min at threshold + 1 min at interval
    // pace)" had no representation at all.
    const s = parse({
      version: 2,
      sizing: { scaling: 'reps' },
      blocks: [{
        repeat: 3,
        steps: [
          { role: 'work', modality: 'run', length: { kind: 'duration', secs: 180 },
            target: { kind: 'pace', anchor: 'T', mode: 'target' } },
          { role: 'work', modality: 'run', length: { kind: 'duration', secs: 60 },
            target: { kind: 'pace', anchor: 'I', mode: 'target' } },
          { role: 'recovery', modality: 'jog', length: { kind: 'duration', secs: 120 },
            target: { kind: 'none' } },
        ],
      }],
    })
    const d = resolveMainSet(s, CTX)
    expect(d.blocks[0].repeat).toBe(3)
    const paces = d.blocks[0].steps.filter(x => x.role === 'work').map(x => x.pace)
    expect(paces).toEqual(['5:04–5:19 /km', '4:28–4:39 /km'])
    expect(new Set(paces).size, 'two different targets inside one repeat').toBe(2)
  })

  it('CASE 3 (was PARTIAL) — the RECOVERY step carries its own pace', () => {
    // v1: recovery had a duration and a free-text word. "Jog the recovery no
    // slower than 6:30" was unsayable.
    const s = parse({
      version: 2,
      sizing: { scaling: 'reps' },
      blocks: [{
        repeat: 4,
        steps: [
          { role: 'work', modality: 'run', length: { kind: 'distance', m: 1000 },
            target: { kind: 'pace', anchor: 'I', mode: 'target' } },
          { role: 'recovery', modality: 'jog', length: { kind: 'duration', secs: 120 },
            target: { kind: 'pace', anchor: 'E', mode: 'floor' } },
        ],
      }],
    })
    const d = resolveMainSet(s, CTX)
    const rec = d.blocks[0].steps.find(x => x.role === 'recovery')!
    expect(rec.pace).toBe('6:00–7:15 /km')
    expect(rec.pace_mode, 'a floor, not a band to hit').toBe('floor')
    expect(describeDerivedSet(d)).toContain('no slower than')
  })

  it('CASE 4 (was PARTIAL) — typed recovery genuinely differs', () => {
    // v1: the type word existed but nothing consumed it — walking recovery and
    // jogged recovery produced IDENTICAL plan output. `modality` is a closed set
    // and reaches the runner.
    const mk = (modality: string) => parse({
      version: 2, sizing: { scaling: 'reps' },
      blocks: [{ repeat: 3, steps: [
        { role: 'work', modality: 'run', length: { kind: 'duration', secs: 180 },
          target: { kind: 'pace', anchor: 'I', mode: 'target' } },
        { role: 'recovery', modality, length: { kind: 'duration', secs: 120 },
          target: { kind: 'none' } },
      ] }],
    })
    const walk = describeDerivedSet(resolveMainSet(mk('walk'), CTX))
    const jog = describeDerivedSet(resolveMainSet(mk('jog'), CTX))
    const stand = describeDerivedSet(resolveMainSet(mk('stand'), CTX))
    expect(new Set([walk, jog, stand]).size, 'three modalities, three outputs').toBe(3)
  })

  it('CASE 5 (was NO) — hill reps: landmark, effort-only, standing rest, mirrored descent', () => {
    // The hardest case, and the one SC-09 needs. Five separate v1 gaps: no
    // run-to-a-landmark step, no way to say "no pace, effort governs", no third
    // step in a rep, no prescribed descent, no per-step terrain.
    //
    // NOTE: no `advance: manual` — CD-17a struck it. McMillan: "you are asking a
    // runner to interact with their watch at the top of every rep while
    // breathing hard."
    const s = parse({
      version: 2,
      sizing: { scaling: 'reps' },
      blocks: [
        { repeat: 1, label: 'to the hill', steps: [
          { role: 'transition', modality: 'run', length: { kind: 'to_landmark', landmark: 'hill_base' },
            target: { kind: 'pace', anchor: 'E', mode: 'ceiling' } },
        ] },
        { repeat: 8, label: 'reps', steps: [
          { role: 'work', modality: 'run', terrain: 'uphill', grade_pct: [4, 8],
            length: { kind: 'duration', secs: 45 },
            target: { kind: 'effort', rpe: 8 } },
          { role: 'recovery', modality: 'stand', length: { kind: 'open' }, target: { kind: 'none' } },
          { role: 'recovery', modality: 'jog', terrain: 'downhill',
            length: { kind: 'mirror', of: 'previous_work' },
            target: { kind: 'pace', anchor: 'E', mode: 'ceiling' },
            note: 'Controlled on the way down — the descent is where the damage happens.' },
        ] },
      ],
    })
    const d = resolveMainSet(s, CTX)
    expect(d.blocks[0].steps[0].length).toBe('to the bottom of the hill')

    const rep = d.blocks[1].steps
    expect(rep[0].pace, 'effort-governed: NO pace').toBeNull()
    expect(rep[0].rpe).toBe(8)
    expect(rep[0].terrain).toBe('uphill')
    expect(rep[1].modality).toBe('stand')
    expect(rep[1].length).toBe('until ready')
    expect(rep[2].terrain).toBe('downhill')
    expect(rep[2].length, 'descent mirrors the climb').toContain('45s')
    expect(rep[2].pace_mode).toBe('ceiling')
  })

  it('CASE 6 (was NO) — a pace as a CEILING rather than a band', () => {
    const s = parse({
      version: 2, sizing: { scaling: 'fixed' },
      blocks: [{ repeat: 1, steps: [
        { role: 'work', modality: 'run', length: { kind: 'duration', secs: 900 },
          target: { kind: 'pace', anchor: 'E', mode: 'ceiling' } },
      ] }],
    })
    expect(resolveMainSet(s, CTX).blocks[0].steps[0].pace_mode).toBe('ceiling')
    expect(describeDerivedSet(resolveMainSet(s, CTX))).toContain('no faster than')
  })
})

describe('SC-08b — the rules that make it safe', () => {
  it('a row can never contain a pace — targets name an anchor', () => {
    const bad = { version: 2, sizing: { scaling: 'reps' }, blocks: [{ repeat: 3, steps: [
      { role: 'work', modality: 'run', length: { kind: 'duration', secs: 180 },
        target: { kind: 'pace', anchor: '4:30 /km', mode: 'target' } },
    ] }] }
    expect(StructureV2Schema.safeParse(bad).success, 'a literal pace must not parse').toBe(false)
    expect(PACE_ANCHORS).not.toContain('4:30 /km')
  })

  it('an anchor this runner does not have degrades to no pace, never a made-up one', () => {
    // A beginner has no marathon pace; `goal` exists only for a time target.
    const s = parse({
      version: 2, sizing: { scaling: 'fixed' },
      blocks: [{ repeat: 1, steps: [
        { role: 'work', modality: 'run', length: { kind: 'duration', secs: 600 },
          target: { kind: 'pace', anchor: 'M', mode: 'target' } },
      ] }],
    })
    const beginner = resolveMainSet(s, { anchors: { E: '7:00 /km' } })
    expect(beginner.blocks[0].steps[0].pace).toBeNull()
  })

  it('rejects malformed structures rather than resolving them', () => {
    expect(StructureV2Schema.safeParse({ version: 2, sizing: { scaling: 'reps' }, blocks: [] }).success).toBe(false)
    expect(StructureV2Schema.safeParse({ version: 2, sizing: { scaling: 'reps' },
      blocks: [{ repeat: 0, steps: [] }] }).success).toBe(false)
  })
})

describe('SC-08b — migration posture (D-03)', () => {
  it('exactly the ruled rows are v2; everything else stays v1', () => {
    // ADR-019 Phase 1 shipped with this asserting NO row was v2 — a v2 row IS
    // prescription, so the first belonged to a board ruling rather than an
    // infrastructure commit. SC-09 (CD-17a) is that ruling and `hill_reps` is
    // that row.
    //
    // Kept as an ALLOWLIST rather than deleted: migrating a row changes what a
    // runner is told to do, so it must be a deliberate act with a ruling behind
    // it. A row migrated without one fails here.
    const RULED_V2 = new Set([
      'hill_reps',           // SC-09 / CD-17a
      'vert_hike_repeats',   // CAT-ULTRA-THIN-01 — power hiking for ultras
      'threshold_ladder',    // audit §E.5, unblocked by v2 case 1
      'intervals_classic',   // SC-08 vo2max (Coaching Board 2026-08-21)
      'intervals_short',     // SC-08 vo2max
      'intervals_long',      // SC-08 vo2max
    ])
    for (const row of V1_SESSION_CATALOGUE) {
      expect(
        isV2Structure(row.main_set_structure),
        `${row.id}: v2 status must match its board ruling`,
      ).toBe(RULED_V2.has(row.id))
    }
  })

  it('isV2Structure only says yes when the row says version 2', () => {
    expect(isV2Structure({ type: 'repeats', reps: 5 })).toBe(false)
    expect(isV2Structure({ version: 1 })).toBe(false)
    expect(isV2Structure(null)).toBe(false)
    expect(isV2Structure({ version: 2, sizing: { scaling: 'reps' }, blocks: [] })).toBe(true)
  })
})

describe('SC-08b — the derived set reaches the runner', () => {
  it('the composer renders the resolved set, not the row generic', async () => {
    const { composeSession } = await import('./sessionComposer')
    const s = parse({
      version: 2, sizing: { scaling: 'reps' },
      blocks: [{ repeat: 4, steps: [
        { role: 'work', modality: 'run', length: { kind: 'distance', m: 1000 },
          target: { kind: 'pace', anchor: 'I', mode: 'target' } },
        { role: 'recovery', modality: 'jog', length: { kind: 'duration', secs: 120 },
          target: { kind: 'none' } },
      ] }],
    })
    const derived = resolveMainSet(s, CTX)

    const structure = composeSession({
      session: {
        type: 'quality', label: 'Long VO2max', detail: null,
        duration_mins: 50, zone: 'Zone 4–5',
        catalogue_id: 'intervals_long',
        derived_set: derived,
      } as never,
      catalogueRow: V1_SESSION_CATALOGUE.find(r => r.id === 'intervals_long'),
    })

    expect(structure).toBeTruthy()
    // The v1 row would render "4 × 1000m @ 5K pace" — generic. The derived set
    // carries THIS runner's numbers.
    expect(structure!.main.description).toContain('4:28–4:39 /km')
    expect(structure!.main.description).not.toContain('@ 5K pace')
  })

  it('a v1 session is unaffected — the old path still renders', async () => {
    const { composeSession } = await import('./sessionComposer')
    // tempo_cruise is still v1 (the vo2max rows migrated in SC-08); its v1 repeats
    // structure renders through the old path with no derived set.
    const structure = composeSession({
      session: {
        type: 'quality', label: 'Cruise intervals', detail: null,
        duration_mins: 45, zone: 'Zone 3–4', catalogue_id: 'tempo_cruise',
      } as never,
      catalogueRow: V1_SESSION_CATALOGUE.find(r => r.id === 'tempo_cruise'),
    })
    expect(structure!.main.description).toContain('10 min')
  })
})
