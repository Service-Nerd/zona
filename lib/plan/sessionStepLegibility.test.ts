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
import { readFileSync } from 'fs'
import { join } from 'path'
import { generateRulePlan } from './ruleEngine'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { buildSessionRows, resolveDisplayFigures, isV2DerivedSet, NO_PACE_QUALIFIER, targetClause } from './sessionSteps'
import { composeSession } from './sessionComposer'
import { formatDistance } from '@/lib/format'
import type { GeneratorInput } from '@/types/plan'

interface Row { kind: string; role: string; amount: string; amountValue: string; amountUnit: string; amountIsEstimate: boolean; target: string; secondary: string; detail: string; note?: string }

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
  const out: { row: Row; srcNote?: string; srcPace?: string | null; srcRole?: string; sessionHasDistance?: boolean; label: string; type: string; section: string; sid: string; blockKey?: string }[] = []
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
        const rows = buildSessionRows(structure, sess.derived_set, { ...opts, figures, raceSegmentTarget: '', raceSegmentSecondary: '' })
        let blockIdx = -1
        const steps = isV2DerivedSet(sess.derived_set)
          ? sess.derived_set.blocks.flatMap(b => b.steps)
          : []
        let mainIdx = 0
        const key = `${units}#${sid++}`
        for (const r of rows) {
          const src = (r.section === 'main' && steps.length ? steps[mainIdx++] : undefined) as { note?: string; pace?: string | null; role?: string } | undefined
          if (r.section === 'main' && r.startsGroup) blockIdx++
          out.push({ row: r.row as Row, srcNote: src?.note, srcPace: src ? (src.pace ?? null) : undefined, srcRole: src?.role,
            sessionHasDistance: structure.main.distance_km != null,
            label: sess.label ?? '?', type: sess.type ?? '?', section: r.section, sid: key,
            ...(r.section === 'main' ? { blockKey: `${key}#b${blockIdx}` } : {}) })
        }
      }
    }
  }
  return out
}

const ROWS = rendered(131, 'km')
const ROWS_MI = rendered(131, 'mi')

/**
 * 🔴 THE ULTRA CORPUS, AND WHY IT IS A SEPARATE FUNCTION.
 *
 * `cohortGrid` cannot generate a 50K or 100K plan — a documented limit it shares
 * with the liveness baseline — so **4 of the 30 catalogue rows were outside this
 * gate by construction**: `vert_hike_repeats`, `ultra_race_sim`,
 * `back_to_back_long`, `time_on_feet`. The sweep above reports 84,108 sessions
 * and 23 of 30 rows, and a reader naturally takes that for "every session type".
 *
 * ⚠️ IT WAS NOT, AND THE GAP HELD A LIVE DEFECT. The founder asked *"did we check
 * all session types are consistent?"*; reaching these four found
 * `vert_hike_repeats`' walk-back-down rendering a 10-minute row with **no target
 * at all**, against §21b Am. 3's guarantee that every row carries one. Its sibling
 * `stand` step was fine purely because its LENGTH parses as text.
 */
function renderedUltra(units: 'km' | 'mi') {
  const base = {
    athlete_name: 'Athlete', age: 38, race_name: 'Test', primary_metric: 'distance' as const,
    plan_start: COHORT_PLAN_START, race_date: '2027-06-06', goal: 'finish',
    resting_hr: 55, max_hr: 184, recent_quality_training: 'regular',
    hard_session_relationship: 'neutral', injury_history: [] as string[],
    days_available: 5, days_cannot_train: [] as string[], terrain: 'trail',
  }
  const out: typeof ROWS = []
  for (const km of [50, 100]) for (const level of ['intermediate', 'experienced'])
  for (const cwk of [50, 80]) {
    const input = { ...base, race_distance_km: km, fitness_level: level, current_weekly_km: cwk,
      longest_recent_run_km: Math.max(3, Math.round(cwk * 0.4)) } as unknown as GeneratorInput
    let p
    try { p = generateRulePlan(input, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    for (const w of (p as { weeks: { sessions?: Record<string, unknown> }[] }).weeks) {
      for (const s of Object.values(w.sessions ?? {})) {
        const sess = s as { derived_set?: unknown; label?: string; type?: string; distance_km?: number }
        if (!sess) continue
        const structure = composeSession({ session: sess as never })
        if (!structure) continue
        const opts = { metric: 'distance' as const, units,
          formatDist: (km2: number) => formatDistance(km2, units, { exact: true }) ?? '\u2014' }
        const figures = resolveDisplayFigures(structure, { ...opts, sessionDistanceKm: sess.distance_km ?? undefined })
        const rows = buildSessionRows(structure, sess.derived_set, { ...opts, figures, raceSegmentTarget: '', raceSegmentSecondary: '' })
        const steps = isV2DerivedSet(sess.derived_set) ? sess.derived_set.blocks.flatMap(b => b.steps) : []
        let mainIdx = 0
        for (const r of rows) {
          const src = (r.section === 'main' && steps.length ? steps[mainIdx++] : undefined) as { note?: string; pace?: string | null; role?: string } | undefined
          out.push({ row: r.row as never, srcNote: src?.note, srcPace: src ? (src.pace ?? null) : undefined, srcRole: src?.role,
            sessionHasDistance: structure.main.distance_km != null,
            label: sess.label ?? '?', type: sess.type ?? '?', section: r.section, sid: `ultra-${units}` })
        }
      }
    }
  }
  return out
}

const ULTRA = [...renderedUltra('km'), ...renderedUltra('mi')]
const ALL = [...ROWS, ...ROWS_MI, ...ULTRA]


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
    // 🔴 THE ULTRA ARM. `cohortGrid` cannot generate a 50K/100K plan, so four
    // catalogue rows sat outside this gate by construction and one of them was
    // shipping a row with NO TARGET. An empty ultra corpus passes every other arm
    // in this file, so its presence is asserted, not assumed.
    expect(ULTRA.length, 'the ultra corpus is EMPTY — the generator refused every input, so 4 ' +
      'catalogue rows are unchecked again (vert_hike_repeats, ultra_race_sim, back_to_back_long, time_on_feet)')
      .toBeGreaterThan(500)
    const ultraLabels = new Set(ULTRA.map(r => r.label))
    expect(Array.from(ultraLabels).some(l => /climb|hike/i.test(l)),
      'no climb/hike session in the ultra corpus — vert_hike_repeats is the row that was broken').toBe(true)
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

  it('EVERY row carries a TARGET — warm-up, strides, main set and cool-down alike', () => {
    // 🔴 Founder: "any changes we make need to apply to all types of sessions and
    // the warm up and cool down. The look and feel has to be the same." The five
    // hand-built rows had no DerivedStep behind them and carried free text; they
    // are the ones that drifted. A `rest` row whose only target is the literal
    // "rest" is excluded — that IS its target.
    const silent = ALL.filter(r => !r.row.target?.trim())
    expect(silent.map(r => `${r.type}/${r.section} "${r.label}" ${r.row.amount}`).slice(0, 5),
      `${silent.length} row(s) render no target. The target is line two, first, on every row.`).toEqual([])
  })

  it('ONE zone notation everywhere — never Z2-Z3 beside Zone 2', () => {
    // Measured: session.zone was already "Zone N" across 16,384 strings; step.zone
    // was the 2.2% outlier at 373 × "Z2-Z3", abbreviated AND hyphenated.
    const abbrev = ALL.filter(r => /\bZ\d\b/.test(`${r.row.target} ${r.row.secondary}`))
    expect(abbrev.map(r => `${r.type} "${r.label}": ${r.row.target}`).slice(0, 5),
      'an abbreviated zone reached a row. Render every zone through lib/format.ts formatZone.').toEqual([])
  })

  it('the component puts a gap between a number and a WORD unit', () => {
    // ⚠️ A DATA ASSERTION CANNOT SEE THIS. `row.amount` is already "8 min"; the
    // jamming happened at RENDER, because the value and unit are two spans and
    // `splitAmount` trims. The first cut shipped "8min" and "13min" and I found it
    // by looking at the card, not by a test — so the test asserts the component.
    const card = readFileSync(join(__dirname, '..', '..', 'components', 'shared', 'SessionSteps.tsx'), 'utf8')
    // ⚠️ The source holds the ESCAPE `\u2009`, not the character, so looking for
    // the character fails on a file that is doing the right thing. Match the
    // fragment as written, with no regex gymnastics.
    const hasBranch = card.includes('test(row.amountUnit)')
    const hasThinSpace = card.includes(String.fromCharCode(92) + 'u2009') || card.includes(String.fromCharCode(0x2009))
    expect(hasBranch && hasThinSpace,
      'SessionSteps no longer inserts a thin space before a word unit, so a number and its ' +
      'unit will render jammed together ("8min").').toBe(true)
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
  // ── §21b Am. 4 — Design Board 2026-10-06 (evening re-sitting) ──────────────
  //
  // The founder read step 4 of his own Progressive tempo as a bug. The number
  // was RATIFIED (sessionCatalogueData.ts, Coaching Board 2026-09-03: "rather
  // than a false-precision pace"); what was missing is any statement that the
  // absence is deliberate. These three arms hold the rule, the exclusion and the
  // second producer shut.

  it('a WORK step with no pace says the absence is deliberate, and one with a pace never does', () => {
    const mainWork = ALL.filter(r => r.section === 'main' && r.srcPace !== undefined && r.srcRole === 'work')
    expect(mainWork.length, 'no v2 work steps in the sample').toBeGreaterThan(500)

    const silent = mainWork.filter(r => !r.srcPace && !r.row.target.includes(NO_PACE_QUALIFIER))
    expect(silent.map(r => `${r.label}: "${r.row.target}"`).slice(0, 3),
      `${silent.length} work step(s) carry no pace and do not say so, so a ratified refusal to ` +
      'prescribe a pace renders identically to a failed computation.').toEqual([])

    // The other direction, which is the one that rots: over-applying it.
    const noisy = mainWork.filter(r => r.srcPace && r.row.target.includes(NO_PACE_QUALIFIER))
    expect(noisy.map(r => `${r.label}: "${r.row.target}"`).slice(0, 3),
      `${noisy.length} step(s) HAVE a pace and still claim they do not.`).toEqual([])

    // ⚠️ Population arm. An empty set passes both arms above (the class the
    // 2026-09-25 review named four times in one day), so prove both halves exist.
    expect(mainWork.filter(r => !r.srcPace).length, 'no no-pace work steps reached the sample').toBeGreaterThan(50)
    expect(mainWork.filter(r => r.srcPace).length, 'no paced work steps reached the sample').toBeGreaterThan(200)
  })

  it('EVERY row of EVERY session carries a target \u2014 \u00a721b Am. 3\u2019s guarantee', () => {
    // 🔴 THIS WAS FALSE AND THE GATE COULD NOT SEE IT. `vert_hike_repeats`'
    // walk-back-down is authored `target: { kind: 'none' }` and its length is a
    // MIRROR, which parses as a duration \u2014 so `buildRow`'s rest fallback, which
    // was conditioned on the length parsing as TEXT, did not fire and the runner
    // got a 10-minute row with an empty second line. Its sibling `stand` step was
    // fine only because "until ready" happens to parse as text. **The two differ
    // in how their LENGTH parses, which has nothing to do with having a target.**
    const blank = ALL.filter(r => !r.row.target)
    expect(blank.map(r => `${r.label} [${r.section}]: ${r.row.amount}`).slice(0, 3),
      `${blank.length} row(s) render with no target. The target is line two on every row of every ` +
      'session (\u00a721b Am. 3); a recovery with nothing prescribed says "rest".').toEqual([])
  })

  it('a progression\u2019s middle third names its ramp, and leads with a distance like its siblings', () => {
    // §8 Am. (Coaching Board, 2026-10-07). The founder raised this three times
    // from his own card: the middle third led with `9:20 min` between two rows
    // leading with kilometres, because a zone target resolved to no pace and so
    // no distance could be derived.
    const zoneSteps = ALL.filter(r => r.section === 'main' && r.srcRole === 'work' && /Zone \d/.test(r.row.target))
    const ramps = ALL.filter(r => r.section === 'main' && r.srcRole === 'work' && /\u2192/.test(r.row.target))
    expect(ramps.length, 'no transitions rendered at all \u2014 the zone target is resolving to nothing again').toBeGreaterThan(200)

    // Every rendered ramp RISES. A `X \u2192 Y` where Y is slower instructs the
    // runner to slow down through a step whose note says "let it rise" \u2014 the
    // defect the first implementation had on 7 of 941, plus 61 degenerate.
    const secs = (t: string) => { const [m, x] = t.split(':').map(Number); return (m ?? 0) * 60 + (x ?? 0) }
    const notRising = ramps.filter(r => {
      const m = r.row.target.match(/(\d+:\d{2})\s*\u2192\s*(\d+:\d{2})/)
      return !m || secs(m[1]!) <= secs(m[2]!)
    })
    expect(notRising.map(r => `${r.label}: ${r.row.target}`).slice(0, 3),
      `${notRising.length} ramp(s) do not rise. A transition that is flat or backwards must be WITHHELD ` +
      '(it degrades to the zone band), never drawn.').toEqual([])

    // And it now leads with the runner's chosen metric, like rows 3 and 5.
    const stillMinutes = ramps.filter(r => /^(min|h|hr|hrs)$/i.test(r.row.amountUnit) && r.sessionHasDistance !== false)
    expect(stillMinutes.map(r => `${r.label}: ${r.row.amount}`).slice(0, 3),
      `${stillMinutes.length} ramp row(s) still lead with minutes on a distance-anchored session.`).toEqual([])

    // ⚠️ COVERAGE, NOT JUST CORRECTNESS \u2014 AND THIS ARM EXISTS BECAUSE A
    // FALSIFICATION PASSED. Reverting to the T band's SLOW edge produces 61
    // degenerate ramps, which the rise guard then WITHHOLDS, so nothing wrong
    // ships and every other arm stays green: the damage is that 68 steps quietly
    // lose their ramp and go back to the state the founder complained about.
    // **A guard that silently absorbs a regression hides it.** The declared
    // degradations are 7 of 941 (0.74%); the slow-edge version is 7.2%.
    const degraded = zoneSteps.length / (zoneSteps.length + ramps.length)
    expect(degraded, `${zoneSteps.length} of ${zoneSteps.length + ramps.length} zone steps have NO ramp ` +
      '(declared: an absent anchor per \u00a724b, or a ramp that would not rise per PROGRESSION-GOAL-INVERTED-01). ' +
      'Above 5% means the resolution is failing for a reason nobody declared.').toBeLessThan(0.05)
  })

  it('a RECOVERY step never carries the qualifier', () => {
    // Deliberate exclusion: "Jog", "Walk", "Stand" are already instructions by
    // effort and have never carried a pace, so the qualifier would be noise on
    // every one of them. §21b Am. 2's lesson — a RULE, with its exclusion named.
    //
    // ⚠️ THE CORPUS HALF OF THIS ARM IS VACUOUS TODAY AND IT IS SAID OUT LOUD.
    // Measured: of 5,536 non-work steps, **5,303 carry a pace and 233 carry
    // neither a zone nor an RPE** — so `targetClause` returns early or returns
    // '' for every one, and removing the role guard changes NOTHING. Falsifying
    // by deleting the guard left this green, which is how the hollowness was
    // found. The guard is a declared defence against a future catalogue row, the
    // same shape as `paceAsFloor` (0 of 6,014 steps). **The direct assertion
    // below is the falsifiable half** and goes red the moment the guard is
    // removed; the corpus half becomes live by itself if a recovery step ever
    // gains a zone.
    const recovery = ALL.filter(r => r.srcRole && r.srcRole !== 'work')
    expect(recovery.length, 'no recovery steps in the sample').toBeGreaterThan(200)
    const tagged = recovery.filter(r => r.row.target.includes(NO_PACE_QUALIFIER))
    expect(tagged.map(r => `${r.label}: "${r.row.target}"`).slice(0, 3),
      `${tagged.length} recovery step(s) carry the qualifier.`).toEqual([])

    const zonedRecovery = { role: 'recovery', modality: 'jog', length: '2 min', pace: null, zone: 'Z1', advance: 'auto' }
    expect(targetClause(zonedRecovery as never, 'km'),
      'a recovery step with a zone and no pace took the qualifier — the role guard is gone.').toBe('Zone 1')
    const zonedWork = { role: 'work', modality: 'run', length: '2 min', pace: null, zone: 'Z1', advance: 'auto' }
    expect(targetClause(zonedWork as never, 'km'),
      'the same step as WORK did not take it — the guard is inverted or the rule is off.')
      .toBe(`Zone 1 \u00b7 ${NO_PACE_QUALIFIER}`)
  })

  it('a session with no distance of its own never shows a DERIVED distance on a step', () => {
    // 🔴 The step rows were the only figure on the card in kilometres: the card
    // total, both section headers and both bookends come from
    // `resolveDisplayFigures` and were minutes, while `buildStepGroups` derived
    // km from each step's own pace. 795 quality_continuous sessions.
    //
    // ⚠️ A step's OWN prescription is untouched — a `400 m` rep still reads
    // `400 m`. Only a DERIVED figure is suppressed, which is exactly what
    // `amountIsEstimate` marks.
    const durationOnly = ALL.filter(r => r.sessionHasDistance === false)
    expect(durationOnly.length, 'no duration-anchored sessions in the sample').toBeGreaterThan(100)
    const derived = durationOnly.filter(r => r.row.amountIsEstimate && /^(km|mi|m)$/i.test(r.row.amountUnit))
    expect(derived.map(r => `${r.label}: ${r.row.amount}`).slice(0, 3),
      `${derived.length} step(s) invented a distance on a session the plan never prescribed in distance.`).toEqual([])
  })
})
