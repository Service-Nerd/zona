// UNITS-PROSE-01 — runner-facing PROSE honours the km/mi preference.
//
// 🔴 The engine welds `km` into sentences at GENERATION time and stores them in
// `plan_json`. Measured 2026-09-23: **100% of 1,167 generated plans** and **19
// of 19 stored plans** carry at least one, including **101 of 888 sessions** in
// `coach_notes` and **16 of 19 plans** in `meta.notes`.
//
// ⚠️ THE FIRST MEASUREMENT OF THIS SAID ZERO, AND IT WAS THE INSTRUMENT. The
// production query used `\d\s*km\b`, and in **Postgres POSIX regex `\b` is a
// BACKSPACE CHARACTER, not a word boundary** (`\y` is). It matched nothing and
// returned a clean zero, which was reported to the founder and written into the
// debt register as "real but unrealised". A clean zero from a broken pattern is
// indistinguishable from a clean zero from clean data.
//
// ⚠️ CONVERTED AT THE READ, NEVER AT THE PRODUCER. Three reasons, any one
// sufficient: every stored plan already carries it; the toggle is MUTABLE after
// generation; and the producer strings stay byte-identical so §44's
// `REFUSAL_NAMES_NEXT_STEP` and every prose matcher keep passing (this repo
// broke 8 prose matchers across 5 files once by editing refusal strings).

import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { isDesignedRefusal } from './designedRefusal'
import { planRationaleNotes, PLAN_RATIONALE_MAX_WORDS } from './planRationale'
import { convertDistanceString, convertPaceString, formatDistance, formatDuration } from '@/lib/format'
import { composeSession } from './sessionComposer'
import { catalogueRowFor } from './catalogueLink'
import { buildStepGroups, resolveDisplayFigures } from './sessionSteps'
import { inferLimiter } from '@/lib/coaching/limiter'

const STRIDE = 149 // prime, avoids aligning with any grid axis

/** The meta fields `planRationaleNotes` can surface, plus session coach notes. */
interface Collected { metaNotes: string[]; coachNotes: string[]; refusals: string[] }

function collect(): Collected {
  const grid = cohortGrid()
  const out: Collected = { metaNotes: [], coachNotes: [], refusals: [] }
  for (let i = 0; i < grid.length; i += STRIDE) {
    let plan
    try {
      const raw = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      plan = composePlanWithFoundation(raw, grid[i], COHORT_PLAN_START, 'add').plan
    } catch (e) {
      if (isDesignedRefusal(e)) out.refusals.push(e instanceof Error ? e.message : String(e))
      continue
    }
    // Read through the SINGLE OWNER the screen calls, not a hand-picked field
    // list — a note added to that owner later is covered by construction.
    for (const n of planRationaleNotes(plan.meta)) out.metaNotes.push(n.text)
    for (const w of plan.weeks) for (const s of Object.values(w.sessions)) {
      for (const n of (s?.coach_notes ?? [])) if (typeof n === 'string') out.coachNotes.push(n)
    }
  }
  return out
}

const c = collect()

describe('UNITS-PROSE-01 — the corpus reaches the case', () => {
  it('produces prose that actually contains kilometres', () => {
    // A guard that never sees its own case is green for the wrong reason.
    const withKm = [...c.metaNotes, ...c.coachNotes].filter(s => /\d\s*km\b/.test(s))
    expect(withKm.length, 'no generated prose contains km — this suite cannot see the defect').toBeGreaterThan(50)
  })
  it('produces refusals at all', () => {
    expect(c.refusals.length).toBeGreaterThan(5)
  })
})

describe('UNITS-PROSE-01 — no kilometre survives conversion to miles', () => {
  for (const [name, list] of [['plan-rationale notes', c.metaNotes], ['coach notes', c.coachNotes], ['refusals', c.refusals]] as const) {
    it(`${name}`, () => {
      const survivors = list
        .map(s => convertDistanceString(s, 'mi') as string)
        // `/km` is PACE and belongs to convertPaceString — excluded by design.
        .filter(s => /\d\s*km\b/.test(s.replace(/\/\s*km\b/g, '')))
      expect(survivors.slice(0, 5), `${survivors.length} strings still name kilometres to a miles reader`).toEqual([])
    })
  }

  // ⚠️ WHAT THIS CANNOT SEE, stated because green here is not "the prose is
  // right". A figure with NO unit attached — "wants nearer 53", implicitly km —
  // is invisible to a regex and survives conversion looking like a plain
  // number. Two such companions existed and were LABELLED at the producer
  // (`ruleEngine.ts`, "nearer N km") so this gate could see them. A third would
  // pass here silently. It is found by reading, not by this test.
  it('the km path is the identity — a km reader sees exactly what was generated', () => {
    for (const s of [...c.metaNotes, ...c.coachNotes, ...c.refusals]) {
      expect(convertDistanceString(s, 'km')).toBe(s)
    }
  })
})

describe('UNITS-PROSE-01 — the preference may not change WHAT the runner is told', () => {
  it('planRationaleNotes returns the same notes, in the same order, in both units', () => {
    // 🔴 THE WORD BUDGET IS WHY THIS EXISTS. `planRationaleNotes` caps by word
    // count, and conversion changes word counts ("38km" is one word, "23.6 mi"
    // is two). Converting BEFORE the cap would silently give a miles reader
    // FEWER notes than a km reader for the same plan — a units-dependent
    // difference in what the runner is told, which is worse than the defect.
    const grid = cohortGrid()
    let compared = 0
    for (let i = 0; i < grid.length; i += STRIDE) {
      let plan
      try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
      const km = planRationaleNotes(plan.meta, 'km')
      const mi = planRationaleNotes(plan.meta, 'mi')
      expect(mi.map(n => n.label)).toEqual(km.map(n => n.label))
      compared++
    }
    expect(compared, 'nothing compared').toBeGreaterThan(50)
  })
})

// ── Properties the CORPUS CANNOT REACH, asserted directly ────────────────────
//
// 🔴 BOTH OF THESE WERE HOLLOW WHEN FIRST WRITTEN, AND ONLY FALSIFYING FOUND IT.
// Two deliberate breakages — making the converter eat `/km`, and moving the
// conversion above the word cap — left the corpus suite **fully green**, because
// the generated prose fields contain no pace strings and the word budget never
// binds in this sample. A property that the corpus happens not to exercise is
// not tested by a corpus. It is asserted here, on constructed input.
describe('UNITS-PROSE-01 — properties the corpus does not reach', () => {
  it('🔴 leaves PACE alone — `/km` belongs to convertPaceString', () => {
    // If this ever goes green while the exclusion is removed, a miles runner is
    // shown a pace divided by 1.609 — a number that is not any pace at all.
    expect(convertDistanceString('easy at 6:30–7:30 /km', 'mi')).toBe('easy at 6:30–7:30 /km')
    expect(convertDistanceString('5:53 /km or slower', 'mi')).toBe('5:53 /km or slower')
    // …while a DISTANCE in the same sentence still converts.
    expect(convertDistanceString('run 10 km at 6:30 /km', 'mi')).toBe('run 6 mi at 6:30 /km')
  })

  it('🔴 prose agrees with the CARD, not with a second rounding rule', () => {
    // 🔴 THE FIRST CUT OF THE CONVERTER USED `exact: true` THROUGHOUT and put
    // "9.9 mi" in a note beside "10mi" on the card — the exact disagreement
    // ADR-015's amendment (BUG-KIT-DECIMALS-01) exists to stop, where prompt
    // and card differed on 50.4% of prescribed distances. Asserted against
    // `formatDistance`, the producer, never against a copy of its rule.
    for (const km of [16, 50, 42.195, 10, 1, 3]) {
      const card = formatDistance(km, 'mi')
      expect(convertDistanceString(`${km} km`, 'mi'), `${km}km disagrees with the card`)
        .toBe(`${card!.replace('mi', '')} mi`)
    }
  })

  it('🔴 never asserts zero — a sub-unit figure keeps its kilometres', () => {
    // UNITS-SUBUNIT-01's rule, applied to prose: "0.05 km" must not become
    // "0 mi", which would tell the runner the stride covers nothing.
    expect(convertDistanceString('0.05 km stride', 'mi')).toBe('0.05 km stride')
    expect(convertDistanceString('First 0.6 km at Zone 2.', 'mi')).toBe('First 0.4 mi at Zone 2.')
  })

  it('🔴 the word budget cannot drop a note for a MILES reader only', () => {
    // ⚠️ SIZED SO THE KM SIDE KEEPS **TWO** NOTES. The first version of this
    // test put the km side over budget too, so both sides returned ONE note and
    // it passed no matter what the code did. Asserted explicitly below, because
    // a comparison between two identical wrong answers is not a test.
    //
    // Each "38km" is ONE word and converts to "23.6 mi", TWO. Three figures per
    // note, so the converted pair gains six words: 65 words in km, 71 in miles,
    // against a 70-word budget. If conversion ran before the cap, the miles
    // reader would silently lose the second note.
    const filler = (n: number) => Array.from({ length: n }, () => 'word').join(' ')
    const meta = {
      volume_constraint_note: `Your biggest week reaches 38km and 41km and 44km. ${filler(47)}`,
      long_run_shortfall_note: 'Your longest run reaches 29km against 31km and 33km.',
    } as unknown as Parameters<typeof planRationaleNotes>[0]

    const km = planRationaleNotes(meta, 'km')
    const mi = planRationaleNotes(meta, 'mi')
    // The guard against a trivial pass: the km side must be exercising the
    // budget with room for exactly two notes.
    expect(km.length, 'fixture mis-sized — the km side must keep two notes').toBe(2)
    expect(mi.length, 'a miles reader was shown fewer notes than a km reader').toBe(2)
    expect(mi.map(n => n.label)).toEqual(km.map(n => n.label))
    // And the conversion really happened — otherwise this passes trivially.
    expect(mi.some(n => /\d+(\.\d+)? mi\b/.test(n.text)), 'nothing converted').toBe(true)
    expect(mi.every(n => !/\d\s*km\b/.test(n.text)), 'a kilometre survived').toBe(true)
  })
})

// ── UNITS-DURATION-01 — a DIFFERENT rule from units ─────────────────────────
//
// ⚠️ `${duration_mins} min` is unit-independent, so it is not a km/mi question
// at all. It breaches a different ADR-015 contract: `formatDuration` locks
// `45 min` / `1h 18`, never a bare `78m` and never `172 min`.
//
// 🔴 MEASURED 2026-09-23 across 48,547 sessions: the session card's MAIN-SET
// header read 60+ raw minutes on **21,062 of them (43.4%)**, to a maximum of
// **172 min** — which ADR-015 says is `2h 52`.
//
// 🥇 THE REGISTER LISTED ELEVEN DURATION SITES AND TEN OF THEM CANNOT FIRE.
// `sessionComposer`'s descriptions and `buildStepGroups`' rows produced **zero**
// values ≥60 in the same corpus, because a rep or a warm-up is minutes by
// construction. Only the session-level header is long enough to break the rule.
// **Measuring which entries were reachable is what found the one that
// mattered**, and it is why this was one edit rather than eleven.
describe('UNITS-DURATION-01 — an hour or more reads as hours', () => {
  const grid = cohortGrid()
  const figures: string[] = []
  for (let i = 0; i < grid.length; i += STRIDE) {
    let plan
    try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    for (const w of plan.weeks) for (const s of Object.values(w.sessions)) {
      if (!s || s.type === 'rest') continue
      const st = composeSession({ session: s as never, catalogueRow: catalogueRowFor(s as never) })
      if (!st) continue
      const f = resolveDisplayFigures(st, { metric: 'duration', units: 'km', sessionDistanceKm: s.distance_km ?? null })
      figures.push(f.warmup, f.mainSet, f.mainEasy, f.cooldown, f.racePace ?? '')
    }
  }

  it('the corpus reaches the case — sessions of an hour or more exist', () => {
    // Without this the assertion below is green on a corpus of short sessions.
    expect(figures.some(v => /\dh\b/.test(v)), 'no figure reached an hour — this cannot see the defect').toBe(true)
  })

  it('🔴 no card figure states 60 or more raw minutes', () => {
    const raw = figures.filter(v => {
      const m = /(?<![\d.])(\d+)\s*min\b/.exec(v)
      return m != null && Number(m[1]) >= 60
    })
    expect(raw.slice(0, 5), `${raw.length} figures state 60+ raw minutes`).toEqual([])
  })

  it('agrees with formatDuration, the ADR-015 owner — never a second rule', () => {
    for (const mins of [45, 59, 60, 78, 96, 172]) {
      const own = formatDuration(mins)
      expect(own, `${mins} min`).toBeTruthy()
      if (mins >= 60) expect(own).toMatch(/h/)
      else expect(own).toMatch(/min/)
    }
  })
})

describe('UNITS-DURATION-01 — the limiter hypothesis is a DISPLAY surface', () => {
  // `reasoning` is interpolated verbatim into the sessionFeedback prompt, so a
  // number in it becomes user-facing the moment the model repeats it.
  const base = {
    units: 'km' as const, sessionType: 'long', actualAvgHr: null, prescribedHrCeiling: null,
    hrAboveCeilingPct: null, hrBelowFloorPct: null, streamSummary: null, paceFadeSummary: null,
    tempC: null, rpe: 8, fatigueTag: null, recentHighFatigueCount: 0,
    actualDistKm: 18, plannedDistKm: 22, injuryFlagged: false,
  }

  it('names the shortfall in the reader’s units', () => {
    expect(inferLimiter({ ...base, units: 'mi' } as never)?.reasoning).toContain('mi short')
    expect(inferLimiter(base as never)?.reasoning).toContain('km short')
  })

  it('🔴 a RATE is converted, not merely relabelled', () => {
    // ⚠️ THE FIRST VERSION OF THIS TEST WAS HOLLOW AND FALSIFYING FOUND IT.
    // It wrapped the assertions in `if (r && /s\//.test(r.reasoning))`, and the
    // fixture named the field `fadeSecPerKm` (it is `paceFadeSecPerKm`) with a
    // value of 15 against a threshold of 20 — so `inferLimiter` returned null,
    // the conditional swallowed it, and deliberately breaking the rate
    // conversion left the test GREEN. **A conditional assertion is an assertion
    // that can decline to run.**
    const fade = {
      ...base, units: 'mi' as const, sessionType: 'easy',
      paceFadeSummary: {
        paceFadeSecPerKm: 25,            // ≥ LIMITER.MUSCULAR_PACE_FADE_SEC (20)
        firstHalfAvgPaceSecPerKm: 330,
        backHalfAvgPaceSecPerKm: 355,
        sparse: false,
      },
      rpe: null, actualDistKm: 10, plannedDistKm: 10,
    }
    const r = inferLimiter(fade as never)
    // No conditional: the branch must be REACHED, or this proves nothing.
    expect(r?.category, 'the pace-fade branch was not reached — the fixture is the instrument').toBe('muscular')
    // The trap: `25s/km` contains `/km`, so a blanket suffix rename yields
    // `25s/mi` — which is not any rate at all. 25 s/km is ~40 s/mi.
    expect(r!.reasoning, 'the rate kept its km number under a /mi label').not.toMatch(/\b25s\/mi\b/)
    expect(r!.reasoning).toMatch(/\b40s\/mi\b/)
    // …and the two PACE clocks converted as well, through their own owner.
    expect(r!.reasoning).not.toMatch(/\/km/)
  })
})


// ─────────────────────────────────────────────────────────────────────────────
// PACE-UNITS-STEPS-01 — the SESSION STEPS card states pace in the reader's unit.
//
// 🔴 The founder switched to miles, opened a session, and read km. PACE-UNITS-01
// had fixed the pace TILE that morning; the step rows under it were never in
// scope. Measured on one 17-week marathon plan: **36 of 38 step rows** and
// **2 of 2 race-pace segment lines** still said `/km`, beside an amount this same
// module had already converted — `~0.1mi · 5:30–6:00 /km`.
//
// 🥇 WHY THE GUARD MISSED IT, AND IT IS THE POINT OF PUTTING THE GATE HERE. This
// file already imported `resolveDisplayFigures` and walked `buildStepGroups`'
// rows — on the SAME DAY, for the raw-minutes rule, pinned at `units: 'km'`. The
// audit reached the exact rows and asked them a different question. A list of
// PROSE fields plus DISTANCE figures has no entry for the pace clause, because
// the pace clause is neither. **An audit is only as wide as its list**, recorded
// here for the third time this week.
//
// ⚠️ This asserts the GUARANTEE (nothing the card shows states /km while the
// reader is on miles), never the MECHANISM. A test that mirrors `convertPaceString`
// would pass against a broken producer — the `tierResolution.test.ts` flaw.
describe('PACE-UNITS-STEPS-01 — no step row states /km to a miles runner', () => {
  const rows: { label: string; text: string }[] = []
  let rowsWithPace = 0
  const grid = cohortGrid()
  for (let i = 0; i < grid.length; i += STRIDE) {
    let plan
    try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    for (const w of plan.weeks) for (const s of Object.values(w.sessions)) {
      if (!s || s.type === 'rest') continue
      const st = composeSession({ session: s as never, catalogueRow: catalogueRowFor(s as never) })
      if (!st) continue
      const ds = (s as { derived_set?: { version?: number; blocks?: unknown[] } }).derived_set
      if (ds?.version === 2 && Array.isArray(ds.blocks) && ds.blocks.length) {
        const groups = buildStepGroups(ds as never, {
          metric: 'distance', units: 'mi',
          formatDist: (km) => formatDistance(km, 'mi', { exact: true }) ?? `${km}mi`,
        })
        for (const g of groups) for (const r of g.rows) {
          if (/\d:\d{2}/.test(r.detail)) rowsWithPace++
          rows.push({ label: `W${w.n} ${r.role}`, text: `${r.amount} · ${r.detail}` })
        }
      }
      // The race-pace segment line the component builds (SessionSteps.tsx).
      const seg = (st as { race_pace_segment?: { pace_target?: string } }).race_pace_segment
      if (seg?.pace_target) {
        rowsWithPace++
        rows.push({ label: `W${w.n} race-pace segment`, text: convertPaceString(seg.pace_target, 'mi') ?? seg.pace_target })
      }
    }
  }

  it('the corpus reaches the case — step rows carrying a pace exist', () => {
    // Without this, "no row says /km" is green on a corpus of RPE-only rows.
    expect(rowsWithPace, 'no step row carried a pace — this gate cannot see the defect').toBeGreaterThan(50)
  })

  it('🔴 no figure the step card shows states /km', () => {
    const bad = rows.filter(r => /\/\s*km\b/.test(r.text))
    expect(bad.slice(0, 5).map(r => `${r.label}: ${r.text}`)).toEqual([])
    expect(bad).toHaveLength(0)
  })

  it('🔴 no row mixes units — an mi amount beside a km pace', () => {
    // The shape the founder actually saw. Stated separately because a module
    // that converted NEITHER would pass a same-unit check and still be wrong.
    // ⚠️ THIS LINE READ `/\bmi\b/` AND COULD NEVER FIRE — there is no word
    // boundary between the digit and the unit in `0.1mi`, so the amount half of
    // the test matched nothing and the assertion was decoration. Caught by
    // falsifying, not by reading. Sixth substring/boundary miss this week.
    const mixed = rows.filter(r => /\d\s*mi\b/.test(r.text) && /\/\s*km\b/.test(r.text))
    expect(mixed.slice(0, 5).map(r => `${r.label}: ${r.text}`)).toEqual([])
  })
})
