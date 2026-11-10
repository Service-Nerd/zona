/**
 * THE SINGLE OWNER of "split this argument list on top-level commas", for the source-reading
 * gates that need it.
 *
 * 🔴 WHY IT EXISTS: THREE QUOTE-TRACKING SCANNERS IN ONE DAY (2026-11-10). The colour guard's
 * comment stripper, `testClockIndependence`'s string blanker, and `componentContracts`'
 * `splitTopLevel` all had the same hole — a character scanner that tracks bracket depth but not
 * quote state. Each was found separately: the third by a both-directions arm, and a FOURTH
 * (`check-clock-drift`'s argument reader) by `/code-review`, in the same diff that fixed the
 * third. **A character scanner that does not track quotes is a character scanner with this bug
 * in it**, and writing a fourth copy is how it recurs.
 *
 * 📐 MEASURED when the fourth was found: across 218 engine-calling test files the hole changes
 * the count on **exactly one** file — `testClockIndependence.test.ts`, 6 against 4, because its
 * own case table holds `generateRulePlan(…)` inside string literals. No file dropped out of a
 * population, so it was latent in effect and real in kind.
 *
 * ⚠️ SCOPE, STATED. This splits; it does not blank. `testClockIndependence`'s `blankStrings`
 * does a different job (erase string CONTENTS, keep the quotes) and is deliberately not folded
 * in here — one owner per question, not one owner per character loop.
 */

/**
 * Split the inside of an argument list on commas at depth 0, ignoring commas, brackets and
 * closing parens that appear INSIDE a string literal. Returns the raw argument text, untrimmed;
 * the caller decides what to read out of each one.
 *
 * ⚠️ A backslash escapes the next character, so `'a\'b'` is one string. Quote state is tracked
 * across the whole input rather than per line, because an argument list legitimately spans
 * lines — unlike a `//` comment, which cannot.
 */
export function splitTopLevelArgs(inner: string): string[] {
  const parts: string[] = []
  let depth = 0, cur = '', quote: string | null = null
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!
    if (quote) {
      cur += ch
      if (ch === '\\') { if (i + 1 < inner.length) cur += inner[++i]; continue }
      if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; cur += ch; continue }
    if ('([{<'.includes(ch)) depth++
    else if (')]}>'.includes(ch)) depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts
}

/**
 * Read a CALL's arguments out of `src`, starting from the `(` that follows `name`. Brace-matched
 * and quote-aware, so a `)` inside a string cannot end the call early.
 *
 * ⚠️ BRACE-MATCHED, NEVER SLICED TO THE NEXT `)`. Guessing where a region ends is a defect this
 * repo paid for twice in one week — a reader that sliced to `\n})` depended on the caller's
 * indentation and failed on correct code.
 */
export function callArgs(src: string, name: string): string[][] {
  const out: string[][] = []
  const re = new RegExp(`\\b${name}\\s*(?:<[^>]*>)?\\s*\\(`, 'g')
  for (const m of Array.from(src.matchAll(re))) {
    const open = m.index! + m[0].length - 1
    let depth = 0, end = -1, quote: string | null = null
    for (let i = open; i < src.length; i++) {
      const c = src[i]!
      if (quote) { if (c === '\\') { i++; continue } if (c === quote) quote = null; continue }
      if (c === "'" || c === '"' || c === '`') { quote = c; continue }
      if (c === '(') depth++
      else if (c === ')') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end < 0) continue   // unbalanced: report nothing rather than a wrong answer
    out.push(splitTopLevelArgs(src.slice(open + 1, end)))
  }
  return out
}
