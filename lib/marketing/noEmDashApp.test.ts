// BRAND-EMDASH-APP-01 — the em-dash rule, in the app.
//
// The rule is `brand.md`'s and it is SITE-WIDE; the existing guard
// (`noEmDash.test.ts`) only covered marketing surfaces, and `CLAUDE.md` asserted
// an "app-side exception" that does not exist in that section. The founder
// settled the scope on 2026-09-22:
//
//   "no EMDASH in test or spoken word. In descriptions for sessions it's ok.
//    I just don't want it in sentences."
//
// So this guards SENTENCES the runner reads or hears, and nothing else.
//
// ⚠️ THE RAW COUNT WAS 544 AND QUOTING IT WOULD HAVE BEEN MISLEADING. Most of it
// is invariant messages, AI prompt text and dev logging, none of which a runner
// ever sees. The runner-facing subset was **48 sentences across 13 files**, plus
// 27 bare `—` placeholders which are typography, not prose. Measure the subset
// that matters before reporting a number.
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const EM = '—'

/** Runner-facing by construction. Guarded WHOLESALE rather than by a file list:
 *  a hand-maintained list of guarded files is blind to the file nobody added to
 *  it, which this repo has recorded as a class of its own. */
// 🔴 `lib/ui` ADDED 2026-10-07 (HEALTH-SYNC-STALENESS-01 / MATCH-EMPTY-CAUSE-01).
// Extracting runner-facing copy into an OWNER MODULE is the right move and it moved
// those sentences OUT OF THIS GUARD'S POPULATION. `matchEmptyCopy` and
// `connectionStaleCopy` are read by the runner on the link picker and the Connections
// screen, and the day they were written this file could not see either of them.
// "The checker's population excludes the cases at risk", caused by a refactor that was
// otherwise correct. Added clean: all 5 arms stayed green, so there was no debt to
// declare, and the next sentence that lands in a `lib/ui` owner is covered on the way in.
// 🔴 `lib/coaching` ADDED 2026-10-31 (KIT-READ-EMDASH-01). The founder's screenshot of Kit's weekly read
// showed *"Easy HR is up since May — 138 to 154 — but you were running faster too."* The model did not write
// it: `trendSentence.ts` did, and so did 29 more runner-facing sentences in this folder (adjustment notes,
// post-run lines, week voice, zone explanations, race-result lines). Same class as `lib/ui` on 2026-10-07:
// the copy lived in an owner module this guard could not see.
// 🔴 `lib/plan` ADDED 2026-11-05 — `SITE-ENGINE-EMDASH-01`, AND IT HELD 27
// RUNNER-FACING SENTENCES THAT NEITHER COPY GATE COULD SEE. `noEmDash` reads
// MARKETING files; this one read `components`, `app/dashboard`, `lib/ui` and
// `lib/coaching`. **The plan ENGINE — which writes every session label, coach
// note and step note a runner reads — was in neither.** It surfaced only when
// `SITE-SESSION-STEPS-01` put the app's session structure on a public page and
// engine copy arrived somewhere a gate was looking.
//
// ⚠️ MEASURED BY GENERATING, NOT BY GREPPING. 89 string literals in the two
// engine files carry an em dash; the RUNNER-FACING subset is **48 distinct
// strings across the nine published plans** — the same discipline CLAUDE.md
// records for the 544-vs-48 count. Of those: 27 sentences (fixed), 12 labels,
// 6 plan captions, 3 bare placeholders.
const SURFACES = ['components', 'app/dashboard', 'lib/ui', 'lib/coaching', 'lib/plan']
/** Model INPUT, never rendered. Its exemplars are guarded separately by `exemplarHygiene.test.ts`. */
const SKIP_DIRS = ['lib/coaching/prompts']

/** 🔻 `lib/plan` FILES THAT PRODUCE NO RUNNER-FACING COPY, each with its reason.
 *
 *  ⚠️ FILE-SCOPED, NOT PATTERN-SCOPED, AND THAT IS THE SAFER DIRECTION HERE. A
 *  pattern broad enough to clear 150 invariant messages would also clear a real
 *  sentence that happened to match it. A file list can only ever be wrong about
 *  the files it names, and every one of these is checked below by the arm that
 *  asserts the list has not grown silently.
 *
 *  ⚠️ MEASURED, NOT ASSERTED: the runner-facing subset was taken by GENERATING
 *  all nine published plans and walking every rendered string (48 with an em
 *  dash). Not one came from a file on this list. */
const DEV_FACING: Record<string, string> = {
  'lib/plan/invariants.ts': 'validatePlan() violation messages. They throw in dev/test and console.error in production; CLAUDE.md exempts invariant messages by name',
  'lib/plan/planShapeInvariants.ts': 'the same, for plan shape',
  'lib/plan/baseBuildValidate.ts': 'the same, for base-build blocks',
  'lib/plan/planQuality.ts': 'the quality scorecard, printed by npm run review:coaching',
  'lib/plan/principleCoverage.ts': 'principle-to-invariant coverage report, developer-facing',
  'lib/plan/invariantLiveness.ts': 'the mutation battery\'s own descriptions of what it breaks',
  'lib/plan/useCaseEnvelope.ts': 'measurement-corpus case descriptions',
  'lib/plan/charityCohort.ts': 'measurement-corpus persona descriptions',
  'lib/plan/supersede.ts': 'an ops error message with a table name in it',
  'lib/plan/generationConfig.ts': 'config commentary; the runner-facing numerics carry no prose',
  // AI prompt text — model INPUT, never rendered. Same reason as
  // lib/coaching/prompts, which SKIP_DIRS already covers.
  'lib/plan/enrich.ts': 'AI prompt text: model input, never rendered',
  'lib/plan/enrichMaintenance.ts': 'AI prompt text: model input, never rendered',
  'lib/plan/freeIntro.ts': 'AI prompt text: model input, never rendered',
  // 🔴 THE ONE THAT MUST KEEP ITS EM DASHES. Its KEYS are the superseded copy
  // verbatim — the exact strings production stamped into plan_json — and they
  // are what a stored plan is matched against. Rewriting a key would silently
  // stop the repair it exists to perform.
  'lib/plan/supersededNotes.ts': 'the map KEYS are the old copy by construction; changing one breaks the repair of a stored plan',
}

/** Not a sentence the runner reads, so out of scope by the founder's own words.
 *  Each entry names WHY, because an exemption without a reason becomes a place
 *  to hide the next one. */
const EXEMPT = [
  { match: /^\s*—+\s*$/,          why: 'bare placeholder / divider — typography, not prose' },
  { match: /^\[[a-z-]+\]/i,            why: 'console log, prefixed [tag] — developer-facing' },
  { match: /You are a .*coach reviewing/i, why: 'AI prompt text — model input, never rendered' },
  { match: /\?\?\s*'\u2014'/,              why: "the `?? '—'` no-value fallback inside a template — typography" },
  { match: /^APNs |timed out \u2014 push/,   why: 'console log; the tag is a bare word, not a [prefix]' },

  // ── `lib/plan` (SITE-ENGINE-EMDASH-01, 2026-11-05) ────────────────────────
  // ⚠️ A LABEL IS NOT A SENTENCE, and this one is also LOAD-BEARING. ADR-018
  // keeps a legacy fallback that matches a catalogue row's `name` against
  // `session.label`, so renaming a label can silently break the join that tells
  // a session which row it came from. The founder's rule is about sentences;
  // `noEmDash.test.ts`'s own header already declared engine labels out of scope
  // ("Easy run — Zone 2") for exactly this reason.
  { match: /^(?:\$\{[^}]*\}|[A-Z])[^.!?]*\u2014[^.!?]*$/,  why: 'engine LABEL or week caption, no sentence punctuation: "Easy run — Zone 2", "Build — raising the ceiling", "Standard plan — 5km, 12 weeks". ADR-018 joins a row to a session BY LABEL, so these are coupled as well as non-prose' },
  { match: /§/,                       why: 'invariant / rule message, developer-facing (CLAUDE.md exempts invariant messages by name)' },
  { match: /requires derivable|re-read after/, why: 'invariant message continued onto its own literal' },
  // 🔴 THE MIS-PAIRING EXEMPTION IS DELETED, NOT KEPT (code review, 2026-11-09). It read
  // `/^[\s,:;{}()\[\]]*(?:\n|$)/` and existed to clear the artefacts the old REGEX produced.
  // The scanner produces none, so it cleared 0 literals — and left reachable: with `noInterp`
  // added below, **any multi-line template whose first line is just an interpolation** matched
  // it, so `` `${runnerName}\n  You went hard today — ease off tomorrow.` `` became exempt and
  // was not before. ⚠️ **An exemption whose cause is gone is not inert, it is a hole waiting
  // for a shape nobody is thinking about** — and its stated rationale is the very sentence this
  // commit records as false.
]

/** NOEMDASH-JSX-TEXT-01 — exemptions for the JSX-TEXT pass, kept separate from the
 *  string-literal ones because they are a different kind of thing: these are marks
 *  BETWEEN VALUES, not punctuation inside a sentence. The founder's words are the test:
 *  *"I just don't want it in sentences."* A label joining two rendered values is not a
 *  sentence, and replacing its dash would turn a separator into bad grammar. */
const EXEMPT_JSX = [
  { match: /^[\s\u2014:/0-9]*$/,                     why: 'bare placeholder, no value yet (`—`, `—:——`, `— / 10`)' },
  { match: /^\{[^}]+\}\s*\u2014\s*\{[^}]+\}$/,        why: 'separator joining two interpolated VALUES: `{label} — {day}`' },
  { match: /^\{[^}]+\}x\s*\u2014\s*\{[^}]+\}$/,       why: 'same, with a unit suffix: `{ratio}x — {label}`' },
]

/** Blank what is not prose, PRESERVING LENGTH so reported line numbers stay honest.
 *  Order matters: strings before line comments, or a `//` inside a string eats the rest
 *  of the line; and `(?<!:)` so `https://` is not read as the start of a comment. */
const blankNonProse = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, m => ' '.repeat(m.length))
     .replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
     .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, m => ' '.repeat(m.length))
     .replace(/(?<!:)\/\/[^\n]*/g, m => ' '.repeat(m.length))

/** 🔴 THE HALF THIS GUARD COULD NOT SEE UNTIL 2026-09-29.
 *
 *  `offenders()` scans STRING LITERALS. A great deal of runner-facing copy is JSX TEXT
 *  between tags, which is not a literal — so the guard was correct about everything it
 *  looked at and blind to 35 shipped sentences: "Later — still flexible", "Set to your
 *  goal — adjust to what you ran.", "Where your week actually went — by zone."
 *
 *  ⚠️ `CLAUDE.md` described this guard as covering *"every string literal under
 *  components/ and app/dashboard/"*, which was EXACTLY TRUE and is not the same claim as
 *  *"every sentence the runner reads"*, which is what the rule says. The doc described
 *  the MECHANISM, the rule described the INTENT, and nobody compared them. Same shape as
 *  the micro-label doc that matched none of its three implementations.
 *
 *  A JSX text node is the run between `>` and the next `<` once comments and string
 *  literals are blanked. Deliberately a generous heuristic: a TS generic like
 *  `Array<string>` yields a region too, which is harmless, because the question asked of
 *  each region is "does this contain an em dash", not "is this JSX". */
function jsxOffenders(): string[] {
  const bad: string[] = []
  for (const root of SURFACES) {
    for (const f of files(join(process.cwd(), root))) {
      const rel = f.slice(process.cwd().length + 1)
      if (DEV_FACING[rel]) continue
      const raw = readFileSync(f, 'utf8')
      if (!raw.includes(EM)) continue
      const blanked = blankNonProse(raw)
      for (const m of Array.from(blanked.matchAll(/>([^<>]*)</g))) {
        if (!m[1]!.includes(EM)) continue
        // Report the RAW span, not the blanked one, so the message is readable.
        const text = raw.slice(m.index! + 1, m.index! + m[0]!.length - 1).replace(/\s+/g, ' ').trim()
        if (EXEMPT_JSX.some(e => e.match.test(text))) continue
        const line = raw.slice(0, m.index).split('\n').length
        bad.push(`${f.replace(process.cwd() + '/', '')}:${line}  ${text.slice(0, 70)}`)
      }
    }
  }
  return bad
}

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (SKIP_DIRS.some(d => p === join(process.cwd(), d))) continue
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

/** Comments are exempt by the rule itself, so they are blanked (not removed —
 *  blanking preserves offsets, which keeps reported line numbers honest). */
// `blankComments` is DELETED (code review, 2026-11-09). The scanner skips comments itself,
// so it had no call sites — and the comment keeping it alive claimed the reported line text
// came from it, which was false: it comes from `raw`. `noUnusedLocals` is unset, so nothing
// else would have said so.

/**
 * 🔴 THE REGEX SWALLOWED REAL LITERALS, AND THE EXEMPTION BELOW CLAIMED IT COULD NOT
 * (EMDASH-LIB-COPY-01, 2026-11-09).
 *
 * `LIT` was a regex. Its template alternative does not exclude newlines, so a template
 * literal containing a NESTED template inside `${…}` — `` ?? `${paceFade}s/km` `` in
 * `limiter.ts` — pairs the wrong backticks, and so does any trailing `//` comment carrying
 * one (only LINE-LEADING comments were blanked). When that happens the regex consumes the
 * span between the mismatched quotes, and **every genuine literal inside it never produces
 * a match at all.**
 *
 * ⚠️ THE OLD EXEMPTION SAID: *"Safe in the direction that matters: a real offender always
 * has the mark ON its own reported line, so this can only ever clear an artefact."* **That
 * is false, and it is false in the direction that matters.** A swallowed literal is never
 * iterated, so there is no report to exempt and no line to test. The author measured the
 * artefacts (three in `ruleEngine.ts`) and not the absences.
 *
 * 📐 MEASURED: the regex reported **23,291** "literals" across 373 files where a real
 * scanner finds **14,597** — so ~37% of its output was mis-paired spans — and **44 em-dash
 * literals in non-exempt files were invisible**, 43 of them in `ruleEngine.ts`. Most are
 * week captions the EXEMPT list clears by design once it can see them; **four were live
 * runner-facing sentences**, including `hard_pref_note`, which `planRationaleNotes()`
 * renders to the runner under the heading "Hard sessions".
 *
 * 🔑 SO THE FIX IS A SCANNER, NOT A BETTER REGEX. One pass, real state: comments, then
 * strings, with `${…}` nesting tracked so a template inside a template cannot mis-pair.
 * `ENUMERATE THE ABSENCE, NOT JUST THE VALUES.`
 */
function stringLiterals(src: string): Array<{ at: number; text: string }> {
  const out: Array<{ at: number; text: string }> = []
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') { const j = src.indexOf('\n', i); i = j < 0 ? n : j; continue }
    if (c === '/' && src[i + 1] === '*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? n : j + 2; continue }
    if (c === '"' || c === "'" || c === '`') {
      const q = c
      let j = i + 1
      const buf: string[] = []
      while (j < n) {
        const d = src[j]
        if (d === '\\') { buf.push(src.slice(j, j + 2)); j += 2; continue }
        // A `${…}` holds CODE, which may contain its own template. Walk it by brace
        // depth so the nested backticks are never read as this literal's terminator.
        if (q === '`' && d === '$' && src[j + 1] === '{') {
          let depth = 1
          buf.push('${'); j += 2
          while (j < n && depth > 0) {
            if (src[j] === '{') depth++
            else if (src[j] === '}') depth--
            buf.push(src[j]); j++
          }
          continue
        }
        if (d === q) break
        if (d === '\n' && q !== '`') break   // an unterminated quote is not a literal
        buf.push(d); j++
      }
      out.push({ at: i, text: buf.join('') })
      i = j + 1
      continue
    }
    i++
  }
  return out
}

function offenders(): string[] {
  const bad: string[] = []
  for (const root of SURFACES) {
    for (const f of files(join(process.cwd(), root))) {
      const rel = f.slice(process.cwd().length + 1)
      if (DEV_FACING[rel]) continue
      const raw = readFileSync(f, 'utf8')
      if (!raw.includes(EM)) continue
      // The scanner skips comments itself.
      for (const lit of stringLiterals(raw)) {
        // 🔴 A CSS COMMENT INSIDE A `<style>{`…`}</style>` TEMPLATE IS COMMENT TEXT, AND THE
        // SCANNER CANNOT KNOW THAT — to a TypeScript scanner it is string CONTENT, correctly.
        // Surfaced the day the scanner replaced the regex: `GeneratingCeremony.tsx`'s shimmer
        // block carries a 6-line `/* … */` explaining a retired colour. **Blanked rather than
        // the LINE exempted**, so a real sentence elsewhere in the same template is still
        // caught — `HOOK-RGBA-COMMENTS-01`, one layer in.
        // 🔴 AND AN ESCAPED EM DASH IS SIX ASCII CHARACTERS, SO `includes(EM)` COULD NOT SEE
        // IT (found while writing the meta-note repair, 2026-11-09). `'\\u2014'` in TS source
        // renders an em dash to the runner and reads as `\`, `u`, `2`, `0`, `1`, `4` to a
        // string search — **a way to write the forbidden mark and pass the guard**. Measured
        // across `app/`, `components/` and `lib/`: 2 live instances outside this file, one a
        // bare placeholder (exempt below) and one in `app/post-run-preview/`, which is outside
        // this guard's SURFACES. No offender inside the population, and the hole is one line.
        const decoded = lit.text.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        const t = decoded.replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
        if (!t.includes(EM)) continue
        // 🔴 REPORT THE LINE OF THE EM DASH, NOT OF THE LITERAL'S START, and
        // test the SENTENCE AROUND IT rather than the whole extract.
        //
        // `LIT` is a regex, so across a template boundary it can pair the
        // closing backtick of one literal with the opening backtick of the
        // next and swallow the code between. The old reporting then blamed a
        // line reading `: null` or `,` for a dash that is real and lives
        // further down — three such reports existed in `ruleEngine.ts`, and the
        // first instinct was to exempt the mangled text, which would have
        // exempted whatever real string was hiding behind it.
        //
        // ⚠️ THE EXEMPTION TEST NARROWS WITH IT. Matching `§` against a
        // 400-character swallowed span would clear any sentence that happened
        // to share it; matched against the one line the dash is actually on, it
        // clears a rule reference and nothing else.
        // `lit.at` is the OPENING QUOTE and `t` excludes it, so the offset needs the +1
        // (code review, 2026-11-09). Without it an em dash on a template's first content
        // character resolves to the PREVIOUS line — and `around`, the string the exemption
        // list is matched against, is then the wrong line entirely. No live instance today.
        const at = lit.at + 1 + Math.max(0, t.indexOf(EM))
        const line = raw.slice(0, at).split('\n').length
        const around = (raw.split('\n')[line - 1] ?? t).trim()
        // ⚠️ TEST THE EXEMPTIONS AGAINST AN INTERPOLATION-FREE FORM TOO (2026-11-09). The
        // caption rule is `[^.!?]*—[^.!?]*$` — no sentence punctuation — and a `${…}` holding
        // a PROPERTY ACCESS puts a dot inside the caption: `Standard plan — ${input.race_distance_km}km,
        // ${totalWeeks} weeks` is a caption by every reading and was reported as a sentence
        // because of the dot in `input.race_distance_km`. **Matching the effect, not the
        // spelling:** a dot inside an interpolation is code, not prose.
        const noInterp = t.replace(/\$\{[^}]*\}/g, '{}').trim()
        if (EXEMPT.some(e => e.match.test(around) || e.match.test(t.trim()) || e.match.test(noInterp))) continue
        bad.push(`${f.replace(process.cwd() + '/', '')}:${line}  ${around.slice(0, 80)}`)
      }
    }
  }
  return bad
}

describe('BRAND-EMDASH-APP-01 — no em dash in a sentence the runner reads', () => {
  it('scans a real corpus — an empty sweep is not a pass', () => {
    const n = SURFACES.reduce((a, r) => a + files(join(process.cwd(), r)).length, 0)
    expect(n, 'files scanned').toBeGreaterThan(50)
  })

  it('🔴 no em dash in any runner-facing string', () => {
    expect(offenders(), 'em dash in runner-facing copy — use a colon, comma, semicolon or full stop').toEqual([])
  })

  it('🔴 no em dash in JSX TEXT either — the half this guard could not see', () => {
    expect(jsxOffenders(),
      'em dash in runner-facing JSX text. Use a colon, comma, semicolon or full stop')
      .toEqual([])
  })

  it('the JSX pass reads a real corpus, and a separator is NOT a sentence', () => {
    // An empty population passes every other arm in this file, so prove the scanner
    // finds text at all — and prove the exemption is doing work rather than swallowing
    // the set. A `/.*/` exemption would pass the arm above and fail this one.
    const probe = blankNonProse('<div>a \u2014 b</div><span>{x} \u2014 {y}</span>')
    expect(Array.from(probe.matchAll(/>([^<>]*)</g)).length).toBeGreaterThanOrEqual(2)
    expect(EXEMPT_JSX.some(e => e.match.test('{session.label} \u2014 {dayLabel}'))).toBe(true)
    expect(EXEMPT_JSX.some(e => e.match.test('Later \u2014 still flexible'))).toBe(false)
  })

  /**
   * 🔴 THE ARM THAT KEEPS THE HOLE SHUT (EMDASH-LIB-COPY-01, 2026-11-09).
   *
   * It is BEHAVIOURAL, not a source assertion, because a source assertion passes on a
   * comment. The shape that broke the old regex was a TEMPLATE INSIDE A TEMPLATE's `${…}`:
   * the regex paired the inner backticks with the outer ones and consumed everything
   * between, so every real literal in that span produced no match at all.
   *
   * ⚠️ FALSIFIED BOTH WAYS before this shipped: with the em dash restored the scanner reports
   * `ruleEngine.ts:9990`, and with the OLD REGEX restored alongside it the suite is **GREEN
   * with a live offender in the tree.** That second run is the finding.
   */
  it('🔴 the literal scanner survives a template nested inside an interpolation', () => {
    const src = [
      'const a = `outer ${x ?? `inner`} tail`',
      "const b = 'a real sentence \u2014 with an em dash'",
    ].join('\n')
    const lits = stringLiterals(src).map(l => l.text)
    // The nested template must not swallow what follows it.
    expect(lits).toContain('a real sentence \u2014 with an em dash')
    // And the outer template is ONE literal whose text keeps its interpolation.
    expect(lits.some(t => t.startsWith('outer ${') && t.endsWith(' tail'))).toBe(true)
  })

  it('a trailing line comment carrying a backtick does not swallow the next literal', () => {
    // The other mis-pairing source: only LINE-LEADING comments were blanked, so a trailing
    // `// see `foo`` broke pairing for the rest of the file.
    const src = [
      'const a = 1  // see `someIdentifier` for why',
      "const b = 'another sentence \u2014 here'",
    ].join('\n')
    expect(stringLiterals(src).map(l => l.text)).toContain('another sentence \u2014 here')
  })

  it('🔴 an em dash written as a `\\u2014` ESCAPE is still an em dash', () => {
    // Six ASCII characters to a string search, one forbidden mark to the runner.
    const src = "const a = 'you went hard today\\u2014ease off tomorrow'"
    const lit = stringLiterals(src)[0]!.text
    expect(lit.includes('—'), 'the RAW literal cannot contain the mark').toBe(false)
    const decoded = lit.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    expect(decoded.includes('—'), 'decoded, it must').toBe(true)
  })

  it('en dashes in RANGES are correct and must survive', () => {
    // brand.md is explicit: `6:30–7:30 /km`, `Zone 4–5`, `RPE 1–10`. A guard that
    // swept both would do more damage than the thing it prevents.
    const zones = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    expect(zones).toContain('–')
  })
})
