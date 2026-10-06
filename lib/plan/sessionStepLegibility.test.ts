// SESSION-STEP-LEGIBILITY-01 — Design Board, 2026-10-06, SHIP WITH AMENDMENT.
//
// The founder opened his own session and could not tell what to do. Three
// mechanisms each hid part of the instruction, and this gate holds all three
// shut across the real corpus rather than on a hand-built fixture:
//
//   1. `DerivedStep.note` had a WRITER and NO READER — 5,152 of 6,014 rendered
//      steps (85.7%) carried a coaching instruction that reached no screen.
//   2. A pace ceiling printed as `≤` over the whole band — 2,499 steps (41.6%),
//      against `design-rulings.md` CD-11/§12 ("never a ≤ symbol, which reads
//      backwards for pace") and with the SIGN inverted (ADR-019: ceiling means
//      "no faster than", which on a pace NUMBER is ≥).
//   3. A bare `M:SS` in the amount column — 202 steps (3.4%), the glyph
//      ambiguity ADR-015 §1 retired ("never a lone 78m").
//
// ⚠️ WHAT THIS DOES NOT PROVE. It asserts the STRINGS the display model emits.
// It cannot see layout: the row geometry was measured separately on
// `/copy-preview` at 320 and 375 (role column 53–72px at 320, which is why the
// board's first shape was not buildable), and nothing has run on a device.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { buildSessionRows, resolveDisplayFigures, isV2DerivedSet } from './sessionSteps'
import { composeSession } from './sessionComposer'
import { formatDistance } from '@/lib/format'
import type { GeneratorInput } from '@/types/plan'

interface Row { kind: string; role: string; amount: string; detail: string; note?: string }

/**
 * EVERY ROW THE CARD RENDERS, for EVERY session type, through the component's own
 * producer (`buildSessionRows`) — never a composition this test invents.
 *
 * 🔴 THE FIRST VERSION OF THIS FILE ASSERTED OVER `buildStepGroups`, WHICH IS THE
 * v2 MAIN SET AND NOTHING ELSE. Measured: **1,974 of 16,919 sessions (11.7%)**.
 * It saw no easy run and no long run (14,221 sessions), no 5K time trial (422),
 * no race week (302), and none of the warm-up, strides or cool-down rows of ANY
 * session — all of which render through the same `StepRowView` that was changed.
 * The founder asked whether the other session types had been regression-tested;
 * they had not, and the gate written for the defect could not have told anyone.
 *
 * Both unit systems, because `targetClause` converts and the ceiling reduction
 * reads the unit back out of the converted string.
 */
function rendered(stride: number, units: 'km' | 'mi') {
  const grid = cohortGrid() as GeneratorInput[]
  const out: { row: Row; srcNote?: string; label: string; type: string; section: string; sid: string; blockKey?: string }[] = []
  let sid = 0
  for (let i = 0; i < grid.length; i += stride) {
    let p
    try { p = generateRulePlan(grid[i]!, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    for (const w of (p as { weeks: { sessions?: Record<string, unknown> }[] }).weeks) {
      for (const s of Object.values(w.sessions ?? {})) {
        const sess = s as { derived_set?: unknown; label?: string; type?: string }
        if (!sess) continue
        const structure = composeSession({ session: sess as never })
        if (!structure) continue
        const opts = {
          metric: 'distance' as const, units,
          formatDist: (km: number) => formatDistance(km, units, { exact: true }) ?? '\u2014',
        }
        const figures = resolveDisplayFigures(structure, { ...opts, sessionDistanceKm: undefined })
        const rows = buildSessionRows(structure, sess.derived_set, { ...opts, figures, raceSegmentDetail: '' })
        let blockIdx = -1
        const steps = isV2DerivedSet(sess.derived_set)
          ? sess.derived_set.blocks.flatMap(b => b.steps)
          : []
        let mainIdx = 0
        const key = `${units}#${sid++}`
        for (const r of rows) {
          const src = r.section === 'main' && steps.length ? steps[mainIdx++] : undefined
          if (r.section === 'main' && r.startsGroup) blockIdx++
          out.push({ row: r.row as Row, srcNote: src?.note, label: sess.label ?? '?', type: sess.type ?? '?', section: r.section, sid: key,
            ...(r.section === 'main' ? { blockKey: `${key}#b${blockIdx}` } : {}) })
        }
      }
    }
  }
  return out
}

const ROWS = rendered(131, 'km')
const ROWS_MI = rendered(131, 'mi')
const ALL = [...ROWS, ...ROWS_MI]


describe('SESSION-STEP-LEGIBILITY-01 — a step row says what to do, on EVERY session type', () => {
  it('the population covers every session type and both unit systems', () => {
    expect(ALL.length).toBeGreaterThan(10000)
    const types = new Set(ALL.map(r => r.type))
    // easy (incl. long runs), quality, hard (the 5K time trial), race.
    for (const t of ['easy', 'quality', 'hard', 'race']) {
      expect(types.has(t), `no ${t} session in the sample — the gate is back to covering 11.7%`).toBe(true)
    }
    const sections = new Set(ALL.map(r => r.section))
    for (const sec of ['warmup', 'main', 'cooldown']) {
      expect(sections.has(sec), `no ${sec} rows — these render through the same StepRowView`).toBe(true)
    }
  })

  it('every step that HAS a note renders it, in full and untruncated', () => {
    const withNote = ALL.filter(r => r.srcNote)
    expect(withNote.length, 'the corpus must actually contain notes').toBeGreaterThan(500)
    const dropped = withNote.filter(r => r.row.note !== r.srcNote)
    expect(dropped.map(r => `${r.label}: ${r.srcNote}`).slice(0, 3),
      `${dropped.length} step(s) lost or altered their coaching note. Wroblewski's condition is ` +
      'binding: nothing is truncated to fit the card.').toEqual([])
  })

  it('NO rendered detail contains ≤ or ≥, on any section or type — CD-11/§12', () => {
    const bad = ALL.filter(r => /[≤≥]/.test(r.row.detail))
    expect(bad.map(r => `${r.type}/${r.section} ${r.label}: ${r.row.detail}`).slice(0, 3),
      'A pace qualifier must come from the ratified owner (easyPaceAsCeiling / paceAsFloor), ' +
      'which renders "5:53 /km or slower". An operator on a pace number is inverted, and on a ' +
      'BAND it is meaningless.').toEqual([])
  })

  it('NO rendered amount is a bare unitless M:SS, on any section or type — ADR-015 §1', () => {
    const bad = ALL.filter(r => /^~?\d+:\d{2}$/.test(r.row.amount))
    expect(bad.map(r => `${r.type}/${r.section} ${r.label}: amount="${r.row.amount}"`).slice(0, 3),
      'The amount column shows distance on its sibling rows, so a bare "9:20" reads as a pace. ' +
      'ADR-015 §1 retired exactly this glyph ambiguity.').toEqual([])
  })

  it('NO row renders an empty role, an empty amount, or a broken value', () => {
    // The refactor that put every row behind one producer could have dropped a
    // field silently on a path the v2 gate never visited — which is most of them.
    const bad = ALL.filter(r =>
      // An EMPTY role is legitimate on a work step that carries a note (Am. 2):
      // the note IS the role. Every other empty field is still a defect.
      (!r.row.role?.trim() && !(r.row.kind === 'work' && r.row.note)) || !r.row.amount?.trim()
      || /undefined|NaN|null|\[object/i.test(`${r.row.role}|${r.row.amount}|${r.row.detail}|${r.row.note ?? ''}`))
    expect(bad.map(r => `${r.type}/${r.section} ${r.label}: role="${r.row.role}" amount="${r.row.amount}" detail="${r.row.detail}"`).slice(0, 5),
      'A row is missing a field or rendering a broken value.').toEqual([])
  })

  it('EVERY SESSION renders a warm-up, a main set AND a cool-down row', () => {
    // ⚠️ THIS ARM WAS HOLLOW ON ITS FIRST WRITE AND FALSIFICATION CAUGHT IT.
    // It asserted an AGGREGATE (`warmup rows > 1000`). Deleting the warm-up run
    // from the producer entirely left the gate GREEN, because `strides` also
    // pushes warm-up rows and the aggregate stayed above the threshold. A count
    // across the corpus cannot see a section missing from a SESSION.
    const perSession = new Map<string, { sections: Set<string>; label: string; type: string }>()
    for (const r of ALL) {
      const e = perSession.get(r.sid) ?? { sections: new Set<string>(), label: r.label, type: r.type }
      e.sections.add(r.section)
      perSession.set(r.sid, e)
    }
    expect(perSession.size, 'no sessions rendered at all').toBeGreaterThan(5000)
    const incomplete = Array.from(perSession.values())
      .filter(e => !(e.sections.has('warmup') && e.sections.has('main') && e.sections.has('cooldown')))
    expect(incomplete.map(e => `${e.type} "${e.label}" has only [${Array.from(e.sections).join(', ')}]`).slice(0, 5),
      `${incomplete.length} session(s) lost a section. Every session the card renders has all three.`).toEqual([])
  })

  it('NO multi-row block renders the SAME role on every row — "Hard x3" is never right', () => {
    // 🔴 THE FOUNDER'S ORIGINAL COMPLAINT, and the measurement that settled it:
    // of 1,597 multi-row blocks, 373 (23.4%) rendered one role on every row and
    // every one was "Hard" — while **373 of 373 (100.0%) had DISTINCT notes,
    // DISTINCT targets and DISTINCT lengths.** ZERO were a genuine rep set, so
    // the word was never correct: it always covered three different things.
    //
    // ⚠️ Scoped to blocks whose steps actually DIFFER, because a true n× rep set
    // repeating one label IS correct — the repeat bar carries the count.
    const byBlock = new Map<string, { roles: string[]; details: string[]; label: string; type: string }>()
    for (const r of ALL) {
      if (r.section !== 'main' || !r.blockKey) continue
      const e = byBlock.get(r.blockKey) ?? { roles: [], details: [], label: r.label, type: r.type }
      e.roles.push(r.row.role); e.details.push(`${r.row.amount}|${r.row.detail}|${r.row.note ?? ''}`)
      byBlock.set(r.blockKey, e)
    }
    const multi = Array.from(byBlock.values()).filter(b => b.roles.length > 1)
    expect(multi.length, 'no multi-row blocks in the sample').toBeGreaterThan(200)
    const bad = multi.filter(b =>
      new Set(b.roles).size === 1 && b.roles[0] !== '' && new Set(b.details).size > 1)
    expect(bad.map(b => `${b.type} "${b.label}": ${b.roles.length}× "${b.roles[0]}"`).slice(0, 5),
      `${bad.length} block(s) render one role over structurally DIFFERENT steps. The note is the role.`).toEqual([])
  })

  it('a RECOVERY step ALWAYS keeps its role — it is the only modality signal on the row', () => {
    // S4's lesson: a rule, not a list. "Jog", "Walk", "Stand", "Hike", "Jog down"
    // tell the runner not to run it; a recovery row reading only "2 min" does not.
    const bad = ALL.filter(r => r.row.kind === 'rest' && !r.row.role?.trim())
    expect(bad.map(r => `${r.type}/${r.section} ${r.label}: amount="${r.row.amount}"`).slice(0, 5),
      'a recovery step lost its verb').toEqual([])
  })

  it('a WORK step with NO note keeps its role — 10.1% of work steps', () => {
    const bad = ALL.filter(r => r.row.kind === 'work' && !r.row.note && !r.row.role?.trim())
    expect(bad.map(r => `${r.type}/${r.section} ${r.label}: amount="${r.row.amount}"`).slice(0, 5),
      'a work step with nothing to say lost its role AND has no note — the row says nothing').toEqual([])
  })

  it('a MILES reader never sees a /km pace, and vice versa', () => {
    // PACE-UNITS-STEPS-01's defect, re-asserted across every type: the ceiling
    // reduction reads the unit back out of the converted string, so a conversion
    // that runs in the wrong order silently re-labels the number.
    const kmLeak = ROWS_MI.filter(r => /\/km/.test(`${r.row.detail}`))
    const miLeak = ROWS.filter(r => /\/mi/.test(`${r.row.detail}`))
    expect(kmLeak.map(r => `${r.type}: ${r.row.detail}`).slice(0, 3), 'a miles reader was shown /km').toEqual([])
    expect(miLeak.map(r => `${r.type}: ${r.row.detail}`).slice(0, 3), 'a km reader was shown /mi').toEqual([])
  })
})
