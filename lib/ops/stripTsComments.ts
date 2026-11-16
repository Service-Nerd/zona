/**
 * THE single owner of "blank the comments in this TypeScript source, leave the code alone".
 *
 * 📐 WHY IT EXISTS, measured 2026-11-16 (`TEST-STRIP-COMMENTS-OWNER-01`): **27 test files declared
 * their own `stripComments` and ~40 more filtered lines with `startsWith('//')`** — 75 files doing
 * one job at **different capability**. That is not untidiness. A source-reading guard can only see
 * what its stripper lets through, so two guards written to the same rule enforce different rules:
 *   · an inline `startsWith('//')` filter cannot see a TRAILING comment at all, so a value in one
 *     reads as code and the guard fires on prose (`HOOK-RGBA-COMMENTS-01`, which this repo records
 *     as how a guard gets switched off, i.e. as equivalent to having no guard);
 *   · a naive `//`-matcher treats the `//` in a URL or a regex as an opener and blanks real code.
 * On 2026-11-16 a `fatigueScale` arm broke on exactly the first of those.
 *
 * 🔑 THE IMPLEMENTATION IS NOT NEW. It is moved verbatim from `lib/plan/pinnedClock.test.ts`, which
 * is the one version with a falsified defect history, and that file imports it back and re-exports
 * it — so its own both-directions arms still prove this code rather than a copy of it. Two defects
 * are already paid for here and must not be re-introduced:
 *   1. **A regex literal holding a quote** (`/it\'s/`) opened a string state nothing closed, so
 *      every `//` after it read as string content and comments stopped being stripped — **51 of 649
 *      scanned files**. Regex literals are skipped, recognised by the token that precedes them.
 *   2. **A value inside a STRING is code, not prose.** String, template and regex contents are
 *      copied through untouched; only comment bodies are removed.
 *
 * ⚠️ LIMITS, stated so a future fix is deliberate rather than a surprise. Quote state is tracked
 * per character but regex detection is a HEURISTIC on the preceding token, which is the standard
 * one and cannot be exact without a parser: a `/` after an identifier reads as division, so a regex
 * in that position is mis-lexed. Getting it wrong costs a false BLANK, never a false pass, which is
 * the deliberate trade — the same one `scripts/lib/strip-comments.py` settled on for the shell
 * guards, and for the same reason.
 */

/** Blanks comment bodies without touching string, template or REGEX contents. */
export function stripTsComments(src: string): string {
  let out = '', i = 0
  // A `/` starts a regex only in expression position; after a value it is division. Standard
  // heuristic: look back at the last non-space character.
  const EXPR_BEFORE = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '\n', '+', '-', '*', '%', '<', '>', '~', '^'])
  const q = { s: false, d: false, t: false }
  let lastSig = '\n'
  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    const inStr = q.s || q.d || q.t
    if (!inStr && c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (!inStr && c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue }
    if (!inStr && c === '/' && EXPR_BEFORE.has(lastSig)) {
      // A regex literal: copy it verbatim, honouring escapes and character classes, so a quote
      // inside cannot leak into the string state.
      out += c; i++
      let cls = false
      while (i < src.length) {
        const r = src[i]
        if (r === '\\') { out += r + (src[i + 1] ?? ''); i += 2; continue }
        if (r === '\n') break
        out += r; i++
        if (r === '[') cls = true
        else if (r === ']') cls = false
        else if (r === '/' && !cls) break
      }
      lastSig = '/'
      continue
    }
    if (c === '\\' && inStr) { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
    if (!q.d && !q.t && c === "'") q.s = !q.s
    else if (!q.s && !q.t && c === '"') q.d = !q.d
    else if (!q.s && !q.d && c === '`') q.t = !q.t
    if (!/\s/.test(c) || c === '\n') lastSig = c
    out += c; i++
  }
  return out
}
