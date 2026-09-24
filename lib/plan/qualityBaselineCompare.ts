// qualityBaselineCompare.ts — the single owner of "is this quality run WORSE
// than the committed baseline?" (BINGE-BUCKET-CROSS-01, 2026-09-24).
//
// 🔴 WHY IT IS A MODULE AND NOT SIX LINES INSIDE THE SCRIPT. It was six lines
// inside the script, it had no test, and it failed the build on an IMPROVEMENT.
//
// `SWEEP-W1W2-LONG-CAP-01` capped the week-1/2 long run. One beginner
// marathoner — 42.2 km, 35 km/week, longest 14 km, 3 days, age 52 — went from a
// worst single session of **75% of its week to 74%**. `auditPlanQuality` emits
// `BINGE-SEVERE-75` at >=75% and `BINGE-WEEK` below, so that plan moved out of
// the severe bucket and into the milder one: `BINGE-SEVERE-75` 20 -> 19,
// `BINGE-WEEK` 281 -> 282. The comparator checked each code independently, saw
// `+1` on one of them, and exited 1. **`npm run verify` was red on main for a
// change that made a runner's plan better.**
//
// ⚠️ THE FAILURE MODE IS THE ONE THIS REPO KEEPS RECORDING, INVERTED. A gate
// that cries wolf gets disabled, and this one cried wolf about progress. It also
// hid a real signal: for as long as it sat red, the next genuine regression
// would have looked exactly the same.
//
// ── THE RULE ─────────────────────────────────────────────────────────────────
//
// Codes that are severity BUCKETS OF ONE PREDICATE are compared as a family, by
// CUMULATIVE SUM from the most severe down. For `[SEVERE, MILD]` that is two
// comparisons: `SEVERE` alone, and `SEVERE + MILD`. So
//
//   severe rises                    -> cum[0] rises  -> FAIL (correct)
//   total rises                     -> cum[1] rises  -> FAIL (correct)
//   severe -1, mild +1 (improved)   -> cum[0] falls, cum[1] equal -> pass
//   severe -1, mild +2 (net worse)  -> cum[1] rises  -> FAIL (correct)
//
// A family cannot be used to launder a regression: every prefix must hold.
//
// ⚠️ MEMBERSHIP IS DECLARED, NOT INFERRED. Two codes sharing a prefix are not
// automatically a family — `DAYS-SHORT` / `DAYS-SHORT-SILENCED` share one and are
// NOT ordered severities (the silenced arm is `watched` and never reaches the
// tally at all). Guessing from names is how a real regression gets absorbed.

/** Ordered severity buckets of a single predicate, MOST SEVERE FIRST. */
export const SEVERITY_FAMILIES: readonly (readonly string[])[] = [
  // auditPlanQuality P4 — `shPct >= 75 ? 'BINGE-SEVERE-75' : 'BINGE-WEEK'`.
  // One predicate, one plan, exactly one of the two codes. Their sum is the
  // number of plans with a session over §52's share cap at all.
  ['BINGE-SEVERE-75', 'BINGE-WEEK'],
]

export type Summary = Record<string, Record<string, number>>

const inAFamily = new Set(SEVERITY_FAMILIES.flat())

/**
 * Returns one human-readable line per regression. Empty means no regression.
 * `generated` is inverted on purpose: FEWER plans generated is the bad direction.
 */
export function compareToBaseline(summary: Summary, base: Summary): string[] {
  const worse: string[] = []

  for (const [cohort, codes] of Object.entries(summary)) {
    for (const [code, n] of Object.entries(codes)) {
      if (code === 'generated') {
        const b = base[cohort]?.[code] ?? 0
        if (n < b) worse.push(`${cohort}/${code}: ${b} -> ${n} (FEWER plans generated)`)
        continue
      }
      if (inAFamily.has(code)) continue   // handled below, as a family
      const b = base[cohort]?.[code] ?? 0
      if (n > b) worse.push(`${cohort}/${code}: ${b} -> ${n} (+${n - b})`)
    }

    for (const family of SEVERITY_FAMILIES) {
      // Only score a family this cohort actually reports, so a cohort that never
      // produces the predicate is not compared against absent baseline keys.
      if (!family.some(c => codes[c] !== undefined || base[cohort]?.[c] !== undefined)) continue
      let now = 0, then = 0
      for (const code of family) {
        now += codes[code] ?? 0
        then += base[cohort]?.[code] ?? 0
        if (now > then) {
          const label = family.indexOf(code) === 0 ? code : `${family.slice(0, family.indexOf(code) + 1).join('+')}`
          worse.push(`${cohort}/${label}: ${then} -> ${now} (+${now - then})`)
          break   // one line per family; the deeper sum adds nothing once it fails
        }
      }
    }
  }
  return worse
}
