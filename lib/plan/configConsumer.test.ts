import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { GENERATION_CONFIG } from './generationConfig'
import { PLAN_SIGNATURES } from './planSignatures'
import { SESSION_FORMAT } from './sessionFormat'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import * as COACHING_CONSTANTS from '@/lib/coaching/constants'

/**
 * THE SIBLING GAP. `configPrincipleSync.test.ts` proves every GENERATION_CONFIG
 * key has a PRINCIPLE. Nothing proved any key has a CONSUMER.
 *
 * So a key could be authored, ratified by the Coaching Board, documented in
 * CoachingPrinciples.md, pass the sync test — and be read by nothing. That is
 * not hypothetical; it is the single most expensive failure class in this repo's
 * history, and it has now landed three times:
 *
 *   §1  INTENSITY_DISTRIBUTION  — declared in MINUTES, engine counted SESSIONS.
 *       Wrong for four months. CD-19: "the table was read by an offline script
 *       and by no engine code, and no invariant referenced it. The value being
 *       wrong was downstream of it never being exercised."
 *   §17 quality_categories_focus — the 10K signature declared ['vo2max',
 *       'threshold'] while the engine hardcoded 'threshold'. Half the declared
 *       focus was unreachable (SC-07/CD-16).
 *   §5  SPECIFICITY_BY_PHASE    — declared peak 60% specific since R23, read by
 *       NOTHING. 10K peak delivered 0%, the exact inverse, invisibly, until it
 *       was measured by hand on 2026-09-07 (§93).
 *
 * Each was found by a human noticing. This test is the mechanism that means the
 * fourth one is found by CI.
 *
 * A constant nothing reads is not configuration. It is a comment with a type
 * annotation — and it is worse than a comment, because it implies a switch that
 * does not exist. Changing MAX_HR_FORMULA to 'fox' would do precisely nothing.
 */

const ROOTS = ['lib', 'app', 'components', 'scripts']
const SELF = ['generationConfig.ts', 'planSignatures.ts']

/**
 * 🔴 NOT A CONSUMER, AND IT BROKE THIS TEST BY EXISTING.
 *
 * `tableColumns.ts` is a committed snapshot of the DATABASE schema
 * (SELECT-COLUMN-GATE-01). It lists every column of every table as a bare
 * string — including `difficulty_tier`, `typical_duration_min` and
 * `typical_duration_max` on `session_catalogue`, three fields this file
 * legitimately has on its unconsumed-debt register.
 *
 * This check is SUBSTRING-BASED, which its own header says is biased toward
 * passing. So the moment that snapshot landed, three dead fields read as wired
 * and the register was told to shrink — a gate flipping another gate green by
 * mentioning a name. Excluded, because a schema dump is a description of the
 * database, not a read of the config.
 */
const NOT_CONSUMERS = ['contracts/tableColumns.ts']

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (!/node_modules|\.next|\.git/.test(p)) sourceFiles(p, out)
    } else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
      if (NOT_CONSUMERS.some(x => p.endsWith(x))) continue
      out.push(p)
    }
  }
  return out
}

/**
 * DECLARATIVE — permanent, legitimate non-consumers.
 *
 * These record a decision that is implemented STRUCTURALLY rather than read at
 * runtime. They are not debt and will never be wired; the entry exists so a
 * reader can tell "deliberately declarative" from "quietly dead", which is the
 * whole distinction this file was written to make visible.
 *
 * The bar for adding one: flipping the value could not change behaviour even in
 * principle, because the behaviour is expressed in code shape rather than in a
 * branch on this value. If flipping it SHOULD change behaviour, it is debt.
 */
const DECLARATIVE: Record<string, string> = {
  MAX_HR_FORMULA:
    "§14 — Tanaka is implemented directly in maxHrGuard.ts. There is no second formula to select between, so this names the choice rather than making it.",
  USE_PACE_RANGES_NOT_POINTS:
    "§11 — every pace is produced by paceBandStr, which returns a band. A points mode does not exist to switch to.",
  EASY_RUN_ZONE_CAP:
    "§12 — the easy ceiling IS the Z2 top by construction (zones.zone2Ceiling). The string names that relationship; it does not choose it.",
  DISPLAY_ZONE_SOURCE:
    "§84 — display reads session.zone, enforced by INV-PLAN-DISPLAY-ZONE-MATCHES-WORK. The alternative (a type→zone map) is the defect §84 removed, not a supported mode.",
  DELOAD_PLACEMENT:
    "§87 — the four sub-rules are implemented in deloadCadence.ts's re-anchoring walk, which cannot express them as independent toggles (§87 records that rules 1 and 3 are jointly unsatisfiable by a naive shift). Kept as the board's ratified record of WHY that walk has its shape.",
}

/**
 * UNWIRED — debt, not amnesty. Each of these SHOULD have a consumer and does not.
 * Removing one is progress. Adding one needs a reason in the commit message.
 */
const UNWIRED: Record<string, string> = {
  // Empty, and worth keeping empty. The one entry this register opened with —
  // LR_BUILD_Z2_CEILING_SEGMENT_PCT — was resolved the same day by deleting the
  // numeric and correcting §24c to describe the whole-run cue that actually
  // ships, rather than inventing a 10% segment to justify a constant.
}

describe('Configuration Singularity — every numeric has a consumer, not just a principle', () => {
  const keys = Object.keys(GENERATION_CONFIG)
  const files = ROOTS.flatMap(r => sourceFiles(r))
    .filter(f => !SELF.some(x => f.endsWith(x)))
    .map(f => ({ f, text: readFileSync(f, 'utf8') }))

  // A consumer is a reference from code that actually runs in the product.
  // Tests and one-off scripts do not count: a key read only by its own test is
  // exactly the shape §5 had, and calling that "consumed" would defeat the check.
  const isProductCode = (f: string) =>
    !/\.test\.|\.spec\.|^scripts\//.test(f) && !f.includes('/__')

  // Substring match, deliberately crude and deliberately BIASED TOWARD PASSING:
  // a key named in a comment counts as consumed. That is the right bias for a
  // gate — it cannot produce a false accusation, only miss a real orphan — and
  // it is the same trade configPrincipleSync makes. Every orphan it DID report
  // was verified by hand before being wired, deleted or registered.
  const consumersOf = (key: string) =>
    files.filter(({ f, text }) => isProductCode(f) && text.includes(key)).map(({ f }) => f)

  it('no NEW config key ships without a consumer', () => {
    const orphans = keys.filter(k =>
      !(k in DECLARATIVE) && !(k in UNWIRED) && consumersOf(k).length === 0)

    expect(orphans, [
      'These GENERATION_CONFIG keys are read by no product code.',
      'A key nothing reads cannot affect a runner, however carefully it was ratified —',
      'and it will read as load-bearing to the next person who finds it.',
      'Wire it, delete it, or add it to DECLARATIVE with the reason it can never be wired.',
    ].join('\n')).toEqual([])
  })

  it('the DECLARATIVE list stays honest — nothing on it has quietly gained a consumer', () => {
    // A stale exemption is how a register becomes a lie. Same rule the principle
    // sync test applies to its own debt: entries must be removed once satisfied.
    const nowWired = Object.keys(DECLARATIVE).filter(k => consumersOf(k).length > 0)
    expect(nowWired, 'these are wired now — remove them from DECLARATIVE').toEqual([])
  })

  it('the UNWIRED debt register only shrinks', () => {
    const stillUnwired = Object.keys(UNWIRED).filter(k => consumersOf(k).length === 0)
    expect(stillUnwired.length, 'debt must not grow').toBeLessThanOrEqual(Object.keys(UNWIRED).length)

    const fixed = Object.keys(UNWIRED).filter(k => consumersOf(k).length > 0)
    expect(fixed, 'these now have consumers — delete them from UNWIRED').toEqual([])
  })

  /**
   * PLAN_SIGNATURES — the same check, and it found the worse half.
   *
   * §17 names this table as the authority for per-distance plan shape. Scanned
   * 2026-09-07: **12 of 14 fields had no product consumer.** Only `min_weeks` and
   * `quality_categories_focus` were read. The table that supposedly makes a 5K
   * plan differ from a 100K plan was 86% decorative — and §24b/SC-07's history
   * shows exactly how that survives, because a declared-and-unread field looks
   * identical to a working one.
   *
   * The cause is not carelessness: PLAN_SIGNATURES is largely a v1 design
   * document that the R23 rebuild superseded with GENERATION_CONFIG, and only
   * half of it was deleted. §17 kept pointing at all of it.
   */
  const SIG_SUPERSEDED: Record<string, string> = {
    long_run_cap_minutes:
      'Superseded by GENERATION_CONFIG.LONG_RUN_CAP_MINUTES, which is wired and enforced by INV-PLAN-LONG-CAP-MINS.',
    taper_final_session:
      'Superseded by GENERATION_CONFIG.TAPER_QUALITY_PER_WEEK, which drives both taper length and its session sequence.',
    sessions_per_week_default:
      'Superseded by the runner\'s own WeekGrid answer (days_available). A per-distance default would override a stated constraint, which §18 forbids.',
    ideal_weeks:
      'Superseded by DISTANCE_CONFIGS.idealWeeks in length.ts, which is what calcPlanLength actually reads. Its sibling `max_weeks` WAS listed here and is now live (§97) — calcPlanLength reads it for a §89-gated runner, which is what stopped their surplus weeks becoming a §57 foundation block. Removing it from this register is the register working.',
    // SIG-ULTRA-UNBUILT-01 (Coaching Board 2026-09-10) reclassified these three
    // from SIG_UNBUILT: they are not debt, they are DELIVERED by a shipped
    // principle and the flag merely duplicates it decoratively — the same status
    // as long_run_cap_minutes above.
    peak_includes_race_pace:
      'Delivered by §16 — the HM peak long run carries race pace via the hm_pace_long_run catalogue row, selected in the peak long-run path. The flag causes nothing; the principle does. ⚠️ CITATION CORRECTED 2026-09-14: this said §24d, which governs the FINISH-GOAL 5K/10K negative-split finish and has nothing to do with HM. The field was moved OUT of the debt register in 2026-09-10 on the strength of a principle that does not cover it — and HM was in fact rendering the overlay on 0 of 18 sessions at the time (RACE-PACE-OVERLAY-REACH-01). A register is only as good as its citations.',
    peak_includes_mp_long_runs:
      'Delivered by §16 — the MARATHON peak long run carries MP via the mp_long_run row. Same shape as above, and the half that was genuinely working. Citation corrected from §24d 2026-09-14.',
    mp_long_run_frequency_weeks:
      'Delivered by §47 — "no two consecutive peak long runs" already alternates the peak MP long runs to ~every 2 weeks. A distinct BUILD-phase MP cadence would be a NEW commitment (not intended); until then this is superseded, not owed.',
  }

  // BOARD-RATIFIED but UNBUILT. SIG-ULTRA-UNBUILT-01 (2026-09-10) ruled each of
  // these a REAL coaching commitment the engine must one day honour — they may
  // NOT be deleted. The build is SLT-gated on ultra acquisition (50K/100K are
  // PAID with, currently, zero users), so they stay declared and tracked here
  // rather than shipped. Two siblings the same ruling STRUCK — fuelling_practice_
  // from_week (absolute-week anchor, wrong shape per §44 — re-spec as a §24e long-
  // run cue) and night_run_optional (unbuildable, no time-of-day, ADR-011) — were
  // removed from PLAN_SIGNATURES entirely and so are absent from this register.
  const SIG_UNBUILT: Record<string, string> = {
    back_to_back_from_phase:
      'BOARD-RATIFIED commitment (SIG-ULTRA-UNBUILT-01). §24e names back-to-backs as the defining ultra adaptation; the back_to_back_long row exists but the declared start PHASE is not read, so ultras get them only if the rotation happens to pick them. Wire with Willy\'s three guards (counts as the week\'s peak long-run stimulus for §47; never adjacent to a deload; both days Z2). Build SLT-gated.',
    back_to_back_frequency_weeks:
      'BOARD-RATIFIED commitment (SIG-ULTRA-UNBUILT-01). The governed cadence (50K every 3 wk / 100K every 2 wk from build) the wiring above must honour. Build SLT-gated.',
    time_on_feet_sessions_in_peak:
      'BOARD-RATIFIED commitment (SIG-ULTRA-UNBUILT-01). The time_on_feet row exists; the declared 100K peak count of 2 is the ratified dose, not yet enforced. Build SLT-gated.',
  }

  it('PLAN_SIGNATURES — no field is silently dead', () => {
    const sigFields = Array.from(new Set<string>(
      Object.values(PLAN_SIGNATURES).flatMap(sig => Object.keys(sig))))
    const orphans = sigFields.filter(k =>
      !(k in SIG_SUPERSEDED) && !(k in SIG_UNBUILT) && consumersOf(k).length === 0)

    expect(orphans, [
      'These PLAN_SIGNATURES fields are read by no product code.',
      '§17 names this table as the authority for per-distance plan shape, so a dead',
      'field here reads as a shipped behavioural difference that does not exist.',
    ].join('\n')).toEqual([])
  })

  it('PLAN_SIGNATURES — the superseded and unbuilt registers only shrink', () => {
    const revived = [...Object.keys(SIG_SUPERSEDED), ...Object.keys(SIG_UNBUILT)]
      .filter(k => consumersOf(k).length > 0)
    expect(revived, 'these now have consumers — remove them from their register').toEqual([])
  })

  it('the distance paywall reads the signature, not a second hardcoded list', () => {
    // free_tier_available used to be duplicated as a `paid:` boolean in
    // GeneratePlanScreen. They agreed, so nothing was broken — but the screen was
    // the real authority for who pays while §17 claimed the signature was.
    // Changing the documented source of truth would not have moved the paywall.
    expect(consumersOf('free_tier_available').some(f => f.includes('GeneratePlanScreen')))
      .toBe(true)
    // And the derivation must still produce the commercial split we intend.
    expect(PLAN_SIGNATURES['5K'].free_tier_available).toBe(true)
    expect(PLAN_SIGNATURES['10K'].free_tier_available).toBe(true)
    expect(PLAN_SIGNATURES['HM'].free_tier_available).toBe(true)
    expect(PLAN_SIGNATURES['MARATHON'].free_tier_available).toBe(false)
    expect(PLAN_SIGNATURES['50K'].free_tier_available).toBe(false)
    expect(PLAN_SIGNATURES['100K'].free_tier_available).toBe(false)
  })

  it('FALSIFICATION — the check can actually go red', () => {
    // A gate nobody has watched fail is a gate nobody can trust. Prove the
    // detector finds an orphan by asking it about a key that cannot exist.
    const invented = 'ZZZ_KEY_THAT_NOTHING_READS'
    expect(consumersOf(invented)).toEqual([])
    // ...and prove it does NOT report a false orphan for a key that is plainly used.
    expect(consumersOf('MAX_WEEKLY_VOLUME_INCREASE_PCT').length).toBeGreaterThan(0)
  })
})

/**
 * CONFIG-CONSUMER-01 — the same check, on the surfaces the first scan never saw.
 *
 * The scan above covers GENERATION_CONFIG and PLAN_SIGNATURES. The doctrine is
 * wider than that: CLAUDE.md names six configuration surfaces, and the three
 * pieces of decorative config found on 2026-09-13 were in NONE of the two
 * covered ones — `intensity_zones` and `fuel_every_mins` are session-catalogue
 * ROW fields, and `ZONE_DISCIPLINE_BANDS` lives in `lib/coaching/constants.ts`.
 * A check that proves a principle for half the surfaces is a check that tells
 * you the other half is fine.
 *
 * Measured when this block was written — three real orphans, none of them
 * cosmetic:
 *
 *   · `HR_ZONE_TOLERANCE_BPM` was declared 3 and read by nothing, while
 *     `zoneRules.hitSessionZone` hardcoded `const tolerance = 2` for the same
 *     job. Two owners, one question, and the NAMED one was dead. Fixed by
 *     wiring it at the shipped value.
 *   · `SESSION_FORMAT.LONG_RUN_PEAK.race_pace_distances` declared the race-pace
 *     long run for ['HM','MARATHON'] and was read by nothing; the real gate was
 *     a label substring that matched only the marathon row's name, so HM
 *     rendered the overlay on **0 of 18** peak race-specific long runs
 *     (RACE-PACE-OVERLAY-REACH-01).
 *   · The two long-run rows declared their own 65/35 and 60/40 split against
 *     §16's 20 — a second, contradicting number, read by nothing.
 *
 * ⚠️ TWO DELIBERATE LIMITS, stated so nobody reads more safety into this than
 * it carries. (1) It scans TOP-LEVEL row fields, not the nested shapes inside
 * `main_set_structure` — those vary per row type and would need a per-type
 * scan. (2) Like the scan above it is substring-based and biased toward
 * passing: a key named only in a comment counts as consumed, and a key read
 * only by a DEAD function in the same module counts as consumed. That second
 * one is real and has a name — `ZONE_DISCIPLINE_BANDS` is read by
 * `classifyZoneDiscipline`, which has no call sites, so this check passes it.
 */
describe('Configuration Singularity — the surfaces the first scan did not cover', () => {
  const files = ROOTS.flatMap(r => sourceFiles(r)).map(f => ({ f, text: readFileSync(f, 'utf8') }))
  const isProductCode = (f: string) =>
    !/\.test\.|\.spec\./.test(f) && !f.startsWith('scripts/') && !f.includes('/__')

  /**
   * Strip a declaration's own object/array literal out of its module's text.
   *
   * The scan above excludes the declaring FILE wholesale. That is right for
   * `generationConfig.ts`, which is nothing but the declaration — and wrong for
   * `sessionFormat.ts`, which also exports `sessionSplit` / `mainSetMinutes` /
   * `durationForMainSet`, the shared helpers that ARE the product consumer and
   * are themselves read by `invariants.ts` and `sessionComposer.ts`. Excluding
   * the whole module reported `quality_warmup_min_mins` as dead when
   * `sessionSplit` reads it on every quality session in the app.
   *
   * So: drop the literal, keep the rest of the module.
   */
  function withoutDeclaration(text: string, name: string): string {
    // Matches either the VALUE declaration (`export const X = {` / `= [`) or the
    // TYPE that shapes it (`export interface X {`). A field named in the
    // interface that types the rows is not a consumer of that field — it is
    // part of the declaration. Missing this made the whole catalogue scan
    // vacuous: `difficulty_tier` looked wired because `SessionCatalogueRow`
    // declares it, forty lines above the array.
    const m = text.match(new RegExp(
      `export (?:const ${name}\\s*(?::[^=]*)?=\\s*[{[]|interface ${name}\\s*\\{)`))
    if (!m || m.index === undefined) return text
    const start = m.index + m[0].length - 1
    const open = text[start]
    const close = open === '{' ? '}' : ']'
    let depth = 0
    for (let i = start; i < text.length; i++) {
      if (text[i] === open) depth++
      else if (text[i] === close) {
        depth--
        if (depth === 0) return text.slice(0, m.index) + text.slice(i + 1)
      }
    }
    return text
  }

  /** Consumers of `key`, with `declFile`'s own declarations excluded. */
  const consumersIn = (key: string, declFile: string, declNames: string[]) =>
    files
      .filter(({ f }) => isProductCode(f))
      .filter(({ f, text }) =>
        (f.endsWith(declFile)
          ? declNames.reduce((t, n) => withoutDeclaration(t, n), text)
          : text).includes(key))
      .map(({ f }) => f)

  const SF_DECL = ['SESSION_FORMAT']
  const ROW_DECL = ['V1_SESSION_CATALOGUE', 'SessionCatalogueRow']

  it('the stripper actually strips — a silent regex miss makes every scan vacuous', () => {
    // This is not paranoia, it is the bug this block shipped with for an hour.
    // `withoutDeclaration` returns the text UNCHANGED when its pattern does not
    // match, so a rename would turn every assertion below green by making every
    // key look consumed by its own declaration. Assert each strip removed real
    // bytes, and that a field it owns is genuinely gone afterwards.
    const sf = readFileSync('lib/plan/sessionFormat.ts', 'utf8')
    const sfStripped = SF_DECL.reduce((t, n) => withoutDeclaration(t, n), sf)
    expect(sfStripped.length, 'SESSION_FORMAT literal not stripped').toBeLessThan(sf.length)
    expect(sfStripped.includes('cooldown_pct: ')).toBe(false)

    const cat = readFileSync('lib/plan/sessionCatalogueData.ts', 'utf8')
    const catStripped = ROW_DECL.reduce((t, n) => withoutDeclaration(t, n), cat)
    expect(catStripped.length).toBeLessThan(cat.length * 0.5)
    expect(catStripped.includes('difficulty_tier'),
      'the row INTERFACE still declares it — the type strip is not working').toBe(false)
  })

  // ── SESSION_FORMAT — §16, a hard-trigger doctrine file ────────────────────
  const SF_DECLARATIVE: Record<string, string> = {
    main_pct:
      "§16 — `sessionSplit` computes the main set as the RESIDUAL (total − warm-up − cool-down), because `quality_warmup_min_mins` is a floor and the split is therefore not a fixed fraction. 80 names that residual in the common case; flipping it to 70 could not change a byte.",
  }

  const SF_SUPERSEDED: Record<string, string> = {
    race_pace_distances:
      "Superseded by the catalogue rows' own `distance_eligibility` (RACE-PACE-OVERLAY-REACH-01, Coaching Board 2026-09-14). The overlay is gated on the row declaring `main_set_structure.type === 'long_run_with_segment'`, and only `hm_pace_long_run` (HM) and `mp_long_run` (MARATHON) do — so the distance restriction is enforced by the rows' eligibility, not by re-reading this list. Kept as §16's readable statement of scope.",
  }

  const SF_UNWIRED: Record<string, string> = {
    // Real debt, and it meets the file's own bar: flipping `final_third` to
    // 'Z3' SHOULD change the warm-up, and does not.
    first_third:
      "§16 declares a three-stage warm-up zone progression (Z1 → Z1_to_Z2 → Z2). `sessionComposer` writes the string 'Z1→Z2' and a prose sentence directly, in its own vocabulary. Wiring needs a mapping from these tokens to display strings.",
    middle_third: 'See first_third — same declaration, same gap.',
    final_third:  'See first_third — same declaration, same gap.',
  }

  const sfKeys = Array.from(new Set(
    Object.values(SESSION_FORMAT).flatMap(v => Object.keys(v as object))))

  it('SESSION_FORMAT — no key is silently dead', () => {
    const orphans = sfKeys.filter(k =>
      !(k in SF_DECLARATIVE) && !(k in SF_SUPERSEDED) && !(k in SF_UNWIRED) &&
      consumersIn(k, 'lib/plan/sessionFormat.ts', SF_DECL).length === 0)

    expect(orphans, [
      'These SESSION_FORMAT keys are read by no product code.',
      '§16 says every run has this shape, so a dead key here reads as a structural',
      'guarantee that is not made. race_pace_distances sat here and HM got nothing.',
    ].join('\n')).toEqual([])
  })

  it('SESSION_FORMAT — its registers only shrink', () => {
    const revived = [...Object.keys(SF_DECLARATIVE), ...Object.keys(SF_SUPERSEDED), ...Object.keys(SF_UNWIRED)]
      .filter(k => consumersIn(k, 'lib/plan/sessionFormat.ts', SF_DECL).length > 0)
    expect(revived, 'these are wired now — remove them from their register').toEqual([])
  })

  it('the warm-up floor is NOT reported dead — the same-module helper counts', () => {
    // Guards the `withoutDeclaration` narrowing itself. Excluding the whole
    // module reported this key as an orphan while `sessionSplit` read it on
    // every quality session. A fix to a checker needs its own check.
    expect(consumersIn('quality_warmup_min_mins', 'lib/plan/sessionFormat.ts', SF_DECL).length)
      .toBeGreaterThan(0)
  })

  // ── Session catalogue ROW FIELDS — where two of the three 09-13 orphans lived ──
  const ROW_DECLARATIVE: Record<string, string> = {
    difficulty_tier:
      "§98 ruled it explicitly: \"Tier is a description, not a lever.\" A `difficulty_tier` selection bias is one of FOUR levers that were built, measured and failed, and the section exists to stop the fifth attempt. The selector must not read it — being unread is the ratified design, not debt.",
  }

  const ROW_UNWIRED: Record<string, string> = {
    typical_duration_min:
      'The catalogue schema declares a duration band per row (`session-catalogue.md`), and sizing comes entirely from GENERATION_CONFIG + `sessionFormat`. So a row can ship well outside its own declared band with nothing to say so — e.g. an `hm_pace_long_run` (declared 75–130 min) sized to 45. A warn-level band check is the obvious wiring.',
    typical_duration_max: 'See typical_duration_min — the other half of the same band.',
  }

  const rowFields = Array.from(new Set(
    V1_SESSION_CATALOGUE.flatMap(r => Object.keys(r as object))))

  it('session catalogue — no ROW FIELD is silently dead', () => {
    const orphans = rowFields.filter(k =>
      !(k in ROW_DECLARATIVE) && !(k in ROW_UNWIRED) &&
      consumersIn(k, 'lib/plan/sessionCatalogueData.ts', ROW_DECL).length === 0)

    expect(orphans, [
      'These session-catalogue row fields are read by no product code.',
      'ADR-010 makes this table the authority for what the engine may prescribe;',
      '`intensity_zones` and `fuel_every_mins` both sat dead here until 2026-09-13.',
    ].join('\n')).toEqual([])
  })

  it('session catalogue — its registers only shrink', () => {
    const revived = [...Object.keys(ROW_DECLARATIVE), ...Object.keys(ROW_UNWIRED)]
      .filter(k => consumersIn(k, 'lib/plan/sessionCatalogueData.ts', ROW_DECL).length > 0)
    expect(revived, 'these are wired now — remove them from their register').toEqual([])
  })

  // ── lib/coaching/constants.ts — the scoring + load numerics ────────────────
  const COACHING_UNWIRED: Record<string, string> = {
    // Empty, and it took a fix to get there: HR_ZONE_TOLERANCE_BPM was declared
    // 3, read by nothing, and shadowed by a hardcoded 2 in zoneRules.
  }

  const coachingKeys = Object.keys(COACHING_CONSTANTS).filter(k => /^[A-Z][A-Z0-9_]*$/.test(k))

  it('lib/coaching/constants.ts — no coaching numeric is silently dead', () => {
    // Every key here is declared one at a time rather than inside one object,
    // so the declaration-stripping above does not apply: the file is nothing
    // but declarations and its own comments.
    const orphans = coachingKeys.filter(k =>
      !(k in COACHING_UNWIRED) &&
      !files.some(({ f, text }) =>
        isProductCode(f) && !f.endsWith('lib/coaching/constants.ts') && text.includes(k)))

    expect(orphans, [
      'These coaching constants are read by no product code outside their own file.',
      'CLAUDE.md names this file as a config surface, so a dead numeric here is a',
      'tuning knob that is not connected to anything — and the danger is not that',
      'it does nothing, but that a second, hardcoded answer is doing the job',
      'somewhere else. That is exactly what HR_ZONE_TOLERANCE_BPM was.',
    ].join('\n')).toEqual([])
  })

  it('there are more coaching keys than the ones already known-good', () => {
    // A scan that silently found nothing to scan would pass every assertion
    // above. Same guard the measurement scripts carry.
    expect(coachingKeys.length).toBeGreaterThan(20)
    expect(sfKeys.length).toBeGreaterThan(10)
    expect(rowFields.length).toBeGreaterThan(10)
  })

  it('FALSIFICATION — each new scan can actually go red', () => {
    expect(consumersIn('ZZZ_NOTHING_READS_THIS', 'lib/plan/sessionFormat.ts', SF_DECL)).toEqual([])
    expect(consumersIn('ZZZ_NOTHING_READS_THIS', 'lib/plan/sessionCatalogueData.ts', ROW_DECL)).toEqual([])
    // ...and does not falsely accuse keys that are plainly wired.
    expect(consumersIn('strides_count', 'lib/plan/sessionFormat.ts', SF_DECL).length).toBeGreaterThan(0)
    expect(consumersIn('phase_eligibility', 'lib/plan/sessionCatalogueData.ts', ROW_DECL).length).toBeGreaterThan(0)
  })
})
