import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CHECK_PARAMS, checkParam } from './checkParams'
import { INVARIANT_CODES } from '@/lib/plan/invariants'
import { V1_SESSION_CATALOGUE } from '@/lib/plan/sessionCatalogueData'

/**
 * ADR-027 B3 rows D2/D3 (Coaching Board 2026-11-22) — the check parameters and the row attributes.
 *
 * ── WHAT THESE ARMS ARE FOR ─────────────────────────────────────────────────────────────────────
 * The whole point of the sitting's D rows is OWNERSHIP: every number here existed in two or three
 * modules at once and nothing held the copies equal. So the arms that earn this file are the ones
 * that would go red if a second copy came back, and the ones that pin each value, because "no value
 * changes" was the ruling's own condition and a rename that moves a number is not a rename.
 *
 * 🔻 WHAT THEY DO NOT CHECK, stated rather than discovered later:
 *  · They do not say any value is coaching-CORRECT. §85's band and §30's RPE are prescription and
 *    are named as such in the module; whether they are right is the board's, not a gate's.
 *  · The tree sweep is a REGEX over source, so a copy written as `30 / 10` or read from a variable
 *    passes. It catches the shape that actually recurred (a bare literal or a local `const`), which
 *    is the shape all seven original declarations had.
 *  · They do not prove the two checkers AGREE on a plan — `verifierAgreement.test.ts` owns that,
 *    finding for finding, and it is why this change can be shown inert at all.
 */

const SRC = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

/**
 * Comment text blanked, line numbers preserved: searching for a hardcoded number otherwise finds the
 * COMMENT ABOUT it, which is `HOOK-RGBA-COMMENTS-01` and this repo has paid for it from both sides.
 *
 * 🔴 THE FIRST CUT WAS A PER-LINE `.replace(/\/\/.*$/)` PLUS A SAME-LINE `/*…*\/`, WHICH MEANT EVERY
 * CONTINUATION LINE OF A JSDOC BLOCK CAME OUT AS CODE — measured by code review: **109 lines of
 * comment prose containing digits** survived as "code" across the two swept files, in the arm this
 * file calls its regression catcher. One ORDERED pass now, carrying block state across lines, which
 * is `scripts/lib/strip-comments.py`'s own hard-won shape.
 *
 * ⚠️ Its two known limits, asserted rather than remembered (the arm below): a `//` inside a STRING
 * is treated as a comment opener, and a template literal spanning lines is not tracked. Both are
 * false BLANKS — they can only make the sweep miss a copy, never make it fire on prose — and that
 * is the trade `strip-comments.py` records as the right one.
 */
function code(src: string): string {
  let inBlock = false
  return src.split('\n').map(line => {
    let out = '', i = 0, quote: string | null = null
    while (i < line.length) {
      const two = line.slice(i, i + 2)
      if (inBlock) {
        if (two === '*/') { inBlock = false; i += 2 } else i++
        continue
      }
      if (quote) {
        if (line[i] === '\\') { out += '  '; i += 2; continue }
        if (line[i] === quote) quote = null
        out += line[i]; i++
        continue
      }
      if (two === '/*') { inBlock = true; i += 2; continue }
      if (two === '//') break
      if (line[i] === '"' || line[i] === "'" || line[i] === '`') quote = line[i]
      out += line[i]; i++
    }
    return out
  }).join('\n')
}

const CHECKERS = ['lib/plan/invariants.ts', 'lib/engine/verifier/verifyPlan.ts']

describe('ADR-027 D2/D3 — the check-parameter catalogue', () => {
  it('🔴 every entry names a REAL rule, and none is fictional', () => {
    // A parameter table keyed by a rule id nobody raises reads as tracked and governs nothing —
    // the `CONSTANTS_DEBT` fictional-entry arm, in another register.
    const unknown = Object.keys(CHECK_PARAMS).filter(id => !(INVARIANT_CODES as readonly string[]).includes(id))
    expect(unknown, 'CHECK_PARAMS entry for a rule that is not in INVARIANT_CODES').toEqual([])
    expect(Object.keys(CHECK_PARAMS).length).toBe(6)
  })

  it('🔴 pins every value, because "no value changes" was the ruling\'s condition', () => {
    // Read from the literals the two checkers held before the move. A rename that moves a number
    // is not a rename, and nothing else in the suite would say which way it moved.
    expect(checkParam('INV-PLAN-LABEL-MATCHES-PACE', 'vo2_pace_tolerance_pct')).toBe(5)
    expect(checkParam('INV-PLAN-LABEL-MATCHES-PACE', 'threshold_pace_tolerance_pct')).toBe(3)
    expect(checkParam('INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD', 'faster_than_t_min_pct')).toBe(0)
    expect(checkParam('INV-PLAN-OVER-UNDER-MEAN-NEAR-THRESHOLD', 'faster_than_t_max_pct')).toBe(3)
    expect(checkParam('INV-PLAN-RACE-WEEK-SHAKEOUT-CAP', 'max_rpe')).toBe(3)
    expect(checkParam('INV-PLAN-5K10K-LR-PACE-CAP', 'vdot_discount')).toBe(0.97)
    expect(checkParam('INV-PLAN-INJURY-CAP-DELIVERED', 'delivered_rounding_tolerance_pct')).toBe(10)
    expect(checkParam('INV-PLAN-DELIVERED-RAMP', 'delivered_rounding_tolerance_pct')).toBe(10)
  })

  it('🔴 absence is never a value — a missing parameter throws rather than defaulting', () => {
    // A silent 0 turns every rounding artefact into a finding; a silent Infinity turns the rule off.
    // Both read as the rule working.
    expect(() => checkParam('INV-PLAN-LABEL-MATCHES-PACE', 'no_such_param')).toThrow(/no parameter/)
    expect(() => checkParam('INV-PLAN-NOT-A-RULE', 'max_rpe')).toThrow(/no parameter/)
  })

  it('🔴 every parameter is READ by a checker — a parameter nothing consults is decorative config', () => {
    // The failure class this repo has paid for three times (§1's INTENSITY_DISTRIBUTION,
    // §5's SPECIFICITY_BY_PHASE, ZONE_DISCIPLINE_BANDS). Substring-based and biased toward passing,
    // exactly as `configConsumer.test.ts` declares of itself.
    // 🔴 THE FIRST CUT KEYED ON THE PARAMETER NAME ALONE, and two of the six entries share the name
    // `delivered_rounding_tolerance_pct` — so replacing §94's read with a bare `10` left this arm
    // GREEN, which code review falsified. A name shared by two rules identifies neither: the pair is
    // the claim. Every parameter appears as a literal (rule, name) pair in at least one checker; the
    // verifier passes `R` for two rules, and for both of those the old checker spells the pair out.
    const all = CHECKERS.map(SRC).join('\n')
    const unread: string[] = []
    for (const [rule, entry] of Object.entries(CHECK_PARAMS)) {
      for (const name of Object.keys(entry.values)) {
        const pair = new RegExp(`checkParam\\(\\s*'${rule}'\\s*,\\s*'${name}'`)
        if (!pair.test(all)) unread.push(`${rule}.${name}`)
      }
    }
    expect(unread, 'parameter declared and read by neither checker, as a (rule, name) pair').toEqual([])
  })

  it('🔴 names every entry slack or prescription, so the two never blur', () => {
    // Slack tunes what the CHECKER flags; prescription is doctrine with no § yet. Only the second
    // set can be adopted into GENERATION_CONFIG, and the distinction is the whole argument for this
    // module existing rather than those keys going straight into the coaching config.
    for (const [rule, entry] of Object.entries(CHECK_PARAMS)) {
      expect(entry.note, `${rule}'s note must open "slack" or "prescription"`).toMatch(/^(slack|prescription) — /)
    }
  })

  it('🔴 the comment stripper blanks a JSDOC BODY, and its two limits are cases not memories', () => {
    // The arm that makes the sweep below mean anything. The first cut was per-line and left every
    // continuation line of a block comment as "code" — 109 prose lines with digits across the two
    // swept files — so a comment ABOUT a tolerance read as a declaration of one.
    const block = ['/**', ' * DELIVERED_ROUNDING_TOLERANCE_PCT = 10 in prose', ' */', 'const keep = 1'].join('\n')
    expect(code(block)).not.toMatch(/= 10/)
    expect(code(block), 'live code after the block must survive').toMatch(/const keep = 1/)
    // Code AFTER a closing `*/` on the same line is code, not prose.
    expect(code('/* x */ const a = 10')).toMatch(/const a = 10/)
    // A number inside a STRING is code, not prose (the other direction of HOOK-RGBA-COMMENTS-01).
    expect(code("const s = 'tolerance 10'")).toMatch(/tolerance 10/)
    // A `//` inside a STRING is not a comment opener — quote state wins, so a URL survives. (The
    // regex version this replaced got this wrong too; measured, not assumed.)
    expect(code("const u = 'http://x' + 10")).toMatch(/10/)
    // An apostrophe inside a JSDoc body does not open a quote: block state wins over quote state.
    expect(code(['/**', " * it's 10 here", ' */', 'const k = 10'].join('\n'))).toMatch(/const k = 10/)
    // 🔻 BOTH LIMITS BELOW ARE MEASURED, AND BOTH ARE FALSE BLANKS — they can only make the sweep
    // MISS a copy, never make it fire on prose, which is the trade `strip-comments.py` records as
    // the right one after two attempts at the other direction were reverted on measurement.
    // LIMIT 1: a `/*` inside a regex character class opens a block comment.
    expect(code('const re = /[/*]/ ; const a = 10')).not.toMatch(/const a = 10/)
    // LIMIT 2: quote state is line-scoped, so a `//` on a template literal's CONTINUATION line cuts.
    expect(code(['const t = `a', 'b // 10', '`'].join('\n'))).not.toMatch(/10/)
  })

  it('🔴 no checker declares its own copy of these numbers any more', () => {
    // The arm that would catch the regression. Each pattern is the SHAPE the original declaration
    // had: a bare comparison against the literal, or a local `const NAME = literal`.
    const banned: { re: RegExp; what: string }[] = [
      { re: /DELIVERED_ROUNDING_TOLERANCE_PCT\s*=\s*10\b/, what: 'the 10% delivered rounding tolerance' },
      { re: /RACE_WEEK_SHAKEOUT_MAX_RPE(_LITERAL)?\s*=\s*3\b/, what: "§30's shakeout RPE cap" },
      // 🔴 THESE TWO WERE THE WHOLE RAMP ARM AND A MUTATION WALKED PAST THEM: re-introducing the
      // ceiling as `const FOUNDATION_WEEK_TO_WEEK_CEILING = 1.10` matched neither, because one
      // looked for the OLD NAME and the other for one particular spelling of the multiplication.
      // A name is not a number. The third pattern reads the VALUE in any `= 1.1` form, and the
      // positive arm below is what actually binds the ramp to its config key.
      { re: /FOUNDATION_WEEK_TO_WEEK_LITERAL/, what: "§57's ramp literal (it reads FOUNDATION_WEEKLY_INCREASE_PCT now)" },
      { re: /weekly_km\s*\*\s*1\.10?\b/, what: "§57's ramp written out as a multiplier" },
      { re: /=\s*1\.10?\s*$/m, what: "§57's ramp assigned as a bare 1.1" },
      { re: /vdot\s*\*\s*0\.97\b/, what: "§24b's VDOT discount" },
      { re: /deltaPct\s*>\s*3\b|\bd\s*>\s*3\s*\?/, what: "§85's over-under band" },
      { re: /expected\s*>\s*0\.0[53]\b|\/\s*expected\s*>\s*0\.0[53]\b|\/\s*e\s*>\s*0\.0[53]\b/, what: "§19's ±5% / ±3% pace tolerances" },
    ]
    const hits: string[] = []
    for (const f of CHECKERS) {
      const src = code(SRC(f))
      for (const { re, what } of banned) if (re.test(src)) hits.push(`${f}: ${what}`)
    }
    expect(hits, 'a check parameter declared outside CHECK_PARAMS').toEqual([])
  })
})

describe('ADR-027 D3 — the row lists became row attributes', () => {
  /** Every non-test source file under lib/ and app/, so the sweep's population is walked, not listed. */
  function sources(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) sources(p, acc)
      else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
        if (!/\.test\.(ts|tsx)$/.test(e.name)) acc.push(p)
      }
    }
    return acc
  }

  it('🔴 `sized_from_steps` carries the PRODUCER\'s four rows, which is what makes the move inert', () => {
    // The producer listed four; both checkers listed two. The attribute is the producer's, because
    // two board rulings (CB-HMPACE-SIZING-01, MP-BLOCKS-ONE-BLOCK-01) put the other two there on
    // purpose — so the producer's list was the true statement and the checkers' was the stale copy.
    expect(V1_SESSION_CATALOGUE.filter(r => r.sized_from_steps).map(r => r.id).sort())
      .toEqual(['hm_pace_intervals', 'mp_blocks', 'threshold_ladder', 'threshold_pyramid'])
  })

  it('🔴 §88\'s two memberships, and `float_is_run` is a SUBSET of `continuous_vo2`', () => {
    // The containment is the rule: §88 states the float-is-run condition inside intervals_rolling's
    // own sentence, and a 30-30 jogs its recovery (a first cut applied it to both and the sweep
    // returned 46 violations, all of them "Thirty-thirty" being a 30-30).
    const cont = V1_SESSION_CATALOGUE.filter(r => r.continuous_vo2).map(r => r.id).sort()
    const run = V1_SESSION_CATALOGUE.filter(r => r.float_is_run).map(r => r.id).sort()
    expect(cont).toEqual(['intervals_30_30', 'intervals_rolling'])
    expect(run).toEqual(['intervals_rolling'])
    expect(run.every(id => cont.includes(id)), 'a float-is-run row must be a continuous-VO2 row').toBe(true)
  })

  it('🔴 no module anywhere re-declares one of the three lists', () => {
    // Keyed on the ROW IDS, not on the old constant names: renaming a set would have slipped past a
    // name-based sweep, and a set is how all three of these were written in the first place.
    const files = sources(join(process.cwd(), 'lib')).concat(sources(join(process.cwd(), 'app')))
    const banned: { re: RegExp; what: string }[] = [
      { re: /new Set\(\[[^\]]*'threshold_pyramid'[^\]]*\]\)/, what: 'the fixed-shape row list' },
      { re: /new Set\(\[[^\]]*'intervals_rolling'[^\]]*'intervals_30_30'[^\]]*\]\)/, what: "§88's continuous-VO2 row list" },
      { re: /new Set\(\[\s*'intervals_rolling'\s*\]\)/, what: "§88's float-is-run row list" },
    ]
    const hits: string[] = []
    for (const f of files) {
      const src = code(readFileSync(f, 'utf8'))
      for (const { re, what } of banned) if (re.test(src)) hits.push(`${f.replace(process.cwd() + '/', '')}: ${what}`)
    }
    expect(hits, 'a row list written out in code instead of read from the row').toEqual([])
    // The population must be non-empty or the loop proves nothing.
    expect(files.length, 'the sweep selected no files').toBeGreaterThan(300)
  })

  it('🔴 and each of the three attributes is READ, in every module that used to hold its list', () => {
    // A row attribute nobody reads is the same inert thing as a decorative config key, and the move
    // would look applied while the stale copy went on governing.
    const producer = SRC('lib/plan/ruleEngine.ts')
    expect(code(producer)).toMatch(/sized_from_steps/)
    expect(code(SRC('lib/plan/invariants.ts'))).toMatch(/sized_from_steps/)
    expect(code(SRC('lib/engine/verifier/verifyPlan.ts'))).toMatch(/sized_from_steps/)
    for (const f of CHECKERS) {
      expect(code(SRC(f)), `${f} must read continuous_vo2`).toMatch(/continuous_vo2/)
      expect(code(SRC(f)), `${f} must read float_is_run`).toMatch(/float_is_run/)
    }
  })

  it('🔴 §57\'s ramp ceiling is DERIVED from FOUNDATION_WEEKLY_INCREASE_PCT in both checkers', () => {
    // The positive half of the ramp rule, and the one that binds. The sitting's instruction was
    // "the ramp reads the existing constant" — so the claim is not "the old literal is gone", it is
    // "the ceiling comes from the config key". Asserted against the SOURCE because the two
    // expressions are in different modules and no runtime value distinguishes 1.10 from 1 + 10/100.
    for (const f of CHECKERS) {
      const src = code(SRC(f))
      expect(src, `${f} must derive the foundation ramp from FOUNDATION_WEEKLY_INCREASE_PCT`)
        .toMatch(/1\s*\+\s*GENERATION_CONFIG\.FOUNDATION_WEEKLY_INCREASE_PCT\s*\/\s*100/)
    }
  })

  it('🔻 records the blind spot the wider membership exposes, so it cannot be mistaken for closed', () => {
    // CHECK-FIXED-SHAPE-DISTANCE-STEP-01. Both checkers price a fixed-shape main set from CLOSED
    // step lengths and return null on a distance step, so the two rows added to their reach are
    // still not priced — measured: a 999-minute duration on an `hm_pace_intervals` session raises
    // 0 findings in either checker, where the same mutation on a `threshold_pyramid` raises 22.
    // ⚠️ THIS ARM FAILS WHEN THE BLIND SPOT IS CLOSED, on purpose: closing it changes a stated
    // duration a runner reads (15 of 20 corpus sessions understate by 10.6-26.4 min), which is a
    // board matter, and this is the one place that says so.
    const rows = V1_SESSION_CATALOGUE.filter(r => r.sized_from_steps)
    const distanceStepRows = rows.filter(r => JSON.stringify(r.main_set_structure).includes('"distance"')).map(r => r.id).sort()
    expect(distanceStepRows, 'the fixed-shape rows priced from distance steps').toEqual(['hm_pace_intervals', 'mp_blocks'])
  })
})
