/**
 * GATE-FALSIFY-01 (a) — the hollow-check lint.
 *
 * 🔴 "FALSIFY ANY NEW CHECK BEFORE TRUSTING IT GREEN" IS STATED THREE TIMES IN
 * THIS REPO AND ENFORCED ZERO TIMES — in `CLAUDE.md`, in the `build` skill's
 * Phase 2, and in `zona-debug`'s exit criteria. Counted in `docs/build-log.md`:
 * **"hollow" × 15, "inert" × 23, "substring" × 11.** That is the exact shape of
 * every other rule this repo has had to mechanise: a rule that holds only while
 * someone remembers is not a rule.
 *
 * The pattern is identical every time: **the check passes for a reason other than
 * the one in its name.** This file catches the two shapes that are statically
 * detectable. It does not and cannot catch the general case.
 *
 * ⚠️ WHY THIS LINT IS NARROW ON PURPOSE. A gate that cries wolf gets deleted,
 * which this repo has recorded as equivalent to having no gate. The rule was
 * calibrated against real usage before it was written:
 *   · "test file reads source"        → 50 hits, 27 of them FALSE
 *     (`expect(fields).toContain('benchmark')` is ARRAY MEMBERSHIP, not a
 *      substring assertion — the bias does not apply)
 *   · receiver assigned from readFileSync → 23 hits, 0 false
 *   · positive assertions only            → 19 hits, and that is the rule
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

/** Every test file in the collected roots.
 *
 *  ⚠️ THIS FILE EXCLUDES ITSELF, and that is not a convenience. Its falsification
 *  block contains DELIBERATE SPECIMENS of both shapes as string literals, and the
 *  detectors read file TEXT — so scanning itself would flag its own evidence and
 *  the gate could never be green. The specimens are exercised directly by the
 *  falsification cases below, which is stronger than scanning them anyway. */
const SELF = 'lib/hollowTestShapes.test.ts'

function testFiles(): string[] {
  return execSync(
    `grep -rl "" --include="*.test.ts" --include="*.test.tsx" lib app components 2>/dev/null || true`,
  ).toString().split('\n').filter(Boolean).filter(f => f !== SELF)
}

/** Variables in this file assigned from `readFileSync` — i.e. holding SOURCE TEXT. */
export function sourceTextVars(src: string): Set<string> {
  const out = new Set<string>()
  // exec loop rather than matchAll: iterating a RegExpStringIterator needs
  // `downlevelIteration`, which this tsconfig does not set (TS2802).
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^\n]*readFileSync/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.add(m[1]!)
  return out
}

/**
 * SHAPE 1 — `expect(<source text>).toContain('<identifier>')`.
 *
 * 🔴 ELEVEN RECORDED MISSES. `toContain('onStartNewPlan')` passes against
 * `onStartNewPlanX`, so the assertion survives exactly the rename it exists to
 * catch — which is how it was found (PLANVERB-01, the fifth substring-bias miss
 * in one day). `toMatch(/\bname\b/)` is strictly narrower and fails on the rename.
 *
 * ⚠️ POSITIVE ASSERTIONS ONLY. Substring bias makes a positive `toContain` too
 * WEAK (it passes when it should not) and a negative `.not.toContain` too STRONG
 * (it fails when it should not). Only the first is hollow; flagging the second
 * would have produced 4 false alarms and taught everyone to ignore this file.
 */
export function substringBiasHits(src: string): { line: number; recv: string; arg: string }[] {
  const vars = sourceTextVars(src)
  const hits: { line: number; recv: string; arg: string }[] = []
  src.split('\n').forEach((line, i) => {
    if (/hollow-ok:/.test(line)) return
    const m = line.match(
      /expect\(\s*([A-Za-z_$][\w$]*)[^)]*\)\s*(\.not)?\s*\.toContain\(\s*['"`]([A-Za-z_$][\w$]*)['"`]\s*\)/,
    )
    if (!m || m[2] || !vars.has(m[1]!)) return
    hits.push({ line: i + 1, recv: m[1]!, arg: m[3]! })
  })
  return hits
}

/**
 * SHAPE 2 — code after an assertion that the assertion has already made unreachable.
 *
 * The shape written on 2026-09-24 and nearly shipped:
 *
 *     expect(got).toBeNull()
 *     if (got !== null) { expect(...)  }   // can never run
 *
 * **Two checks by appearance, one in fact.** It reads as a belt-and-braces
 * falsification and is a single assertion with decoration after it.
 */
export function deadAfterAssertHits(src: string): { line: number; subject: string }[] {
  const lines = src.split('\n')
  const hits: { line: number; subject: string }[] = []
  for (let i = 0; i < lines.length - 1; i++) {
    if (/hollow-ok:/.test(lines[i]!) || /hollow-ok:/.test(lines[i + 1]!)) continue
    const a = lines[i]!.match(/expect\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\.(toBeNull|toBeUndefined)\(\s*\)/)
    if (!a) continue
    // ⚠️ THE ASSERTION MUST BE UNCONDITIONAL, and this clause is here because the
    // first cut of this detector FALSE-FIRED on `stridesCarrierOwner.test.ts`:
    //
    //     if (warned) expect(carrier).toBeNull()
    //     if (carrier !== null) expect(warned).toBe(false)
    //
    // The second line is perfectly reachable — the assertion above it only ran
    // when `warned` was true. A guarded assertion constrains nothing about the
    // other branch, and flagging it is exactly the crying-wolf that gets a gate
    // switched off. Caught by running this lint across the repo before shipping it.
    if (/^\s*(if|\}?\s*else)\s*\(/.test(lines[i]!) || /\?\s*expect/.test(lines[i]!)) continue
    const subj = a[1]!
    // The very next non-blank line branching on that same subject being non-null.
    let j = i + 1
    while (j < lines.length && lines[j]!.trim() === '') j++
    const nxt = lines[j] ?? ''
    const esc = subj.replace(/\$/g, '\\$')
    if (new RegExp(`if\\s*\\(\\s*${esc}\\s*(!==?\\s*(null|undefined)|\\))`).test(nxt)) {
      hits.push({ line: j + 1, subject: subj })
    }
  }
  return hits
}

/**
 * SHAPE 3 — an `it()` whose ONLY assertions are `.not.toThrow()` on a call that
 * takes NO ARGUMENTS.
 *
 * 🔴 THE INCIDENT, 2026-09-24. `guidesGate.test.ts` carried this, under this title:
 *
 *     it('a comparison article does not need them, because prices are not coaching', () => {
 *       expect(() => guideArticles()).not.toThrow()
 *     })
 *
 * A test named for comparisons and `principleRefs`, asserting neither, in the
 * file that enforces the Coaching Board's principle-citation rule. It would have
 * passed in **every possible state** of the thing its title describes. Found only
 * by opening the file to lean on it for a ruling.
 *
 * ⚠️ WHY ZERO-ARGUMENT IS THE WHOLE RULE, AND IT WAS MEASURED BEFORE IT WAS
 * WRITTEN. The obvious heuristic — "the only assertion is `not.toThrow()`" —
 * gives **18 hits in this repo and roughly 17 of them are correct tests**,
 * because in this codebase THROWING IS THE DOMAIN SIGNAL: `generateRulePlan`
 * throws on a designed refusal and on an error-severity violation, and
 * `validateInputFields` throws on a rejected input. So "accepts a plausible
 * runner", "ADMITS the same runner when the runway is long enough" and "the plan
 * generates and validates" are all precisely expressed by `not.toThrow()`.
 *
 * The distinction is the ARGUMENT:
 *
 *   expect(() => f(x)).not.toThrow()   asserts something about `x`. It
 *                                       discriminates: some inputs throw.
 *   expect(() => f()).not.toThrow()    has no input. NOTHING VARIES, so it
 *                                       cannot discriminate between the state
 *                                       the title claims and its opposite.
 *
 * Measured across all 18: every legitimate one passes arguments, none is
 * zero-arg. **0 false positives.** Same discipline as shape 1, which started at
 * 50 hits with 27 wrong and was narrowed twice — a gate that cries wolf gets
 * switched off, which this repo has recorded as equivalent to having no gate.
 *
 * ⚠️ The escape hatch covers the real exception: a zero-arg call reading module
 * state the test itself mutated. Rare, and it must say so.
 */
export function vacuousNoThrowHits(src: string): { line: number; title: string; expr: string }[] {
  const lines = src.split('\n')
  const hits: { line: number; title: string; expr: string }[] = []
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i]!.match(/^(\s*)it(?:\.\w+)?\(\s*[`'"](.+?)[`'"]\s*,/)
    if (!head) continue
    const indent = head[1]!.length
    let body = ''
    let escaped = /hollow-ok:/.test(lines[i]!)
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*\}\)/.test(lines[j]!) && (lines[j]!.match(/^\s*/)![0].length <= indent)) break
      if (/hollow-ok:/.test(lines[j]!)) escaped = true
      body += lines[j] + '\n'
    }
    if (escaped) continue
    const expects = (body.match(/expect\(/g) ?? []).length
    const noThrow = (body.match(/\.not\.toThrow\(/g) ?? []).length
    if (expects === 0 || expects !== noThrow) continue
    // exec loop, not matchAll — see `sourceTextVars` above: spreading a
    // RegExpStringIterator needs `downlevelIteration`, which this tsconfig does
    // not set (TS2802). The file says so and I wrote matchAll anyway.
    const exprs: string[] = []
    const re = /expect\(\s*\(\)\s*=>\s*([\s\S]*?)\)\s*\.not\.toThrow/g
    let m: RegExpExecArray | null
    while ((m = re.exec(body)) !== null) exprs.push(m[1]!.trim().replace(/\s+/g, ' '))
    if (!exprs.length) continue
    // A bare `f()` / `a.b()` with nothing between the parentheses.
    if (!exprs.every(e => /^[\w.$]+\(\s*\)$/.test(e))) continue
    hits.push({ line: i + 1, title: head[2]!, expr: exprs[0]! })
  }
  return hits
}

describe('GATE-FALSIFY-01 — hollow test shapes', () => {
  it('no positive toContain() of a bare identifier against source text', () => {
    const offenders: string[] = []
    for (const f of testFiles()) {
      const src = readFileSync(f, 'utf8')
      for (const h of substringBiasHits(src)) {
        offenders.push(
          `${f}:${h.line} — expect(${h.recv}).toContain('${h.arg}') also passes against '${h.arg}X'. ` +
          `Use toMatch(/\\b${h.arg}\\b/), or mark it \`// hollow-ok: <reason>\`.`,
        )
      }
    }
    expect(offenders, `\n${offenders.join('\n')}\n`).toEqual([])
  })

  it('no branch that a preceding assertion has made unreachable', () => {
    const offenders: string[] = []
    for (const f of testFiles()) {
      const src = readFileSync(f, 'utf8')
      for (const h of deadAfterAssertHits(src)) {
        offenders.push(
          `${f}:${h.line} — \`if (${h.subject} …)\` cannot run: the line above asserts it is null/undefined. ` +
          `Two checks by appearance, one in fact.`,
        )
      }
    }
    expect(offenders, `\n${offenders.join('\n')}\n`).toEqual([])
  })

  /**
   * 🔴 THE LINT FALSIFIES ITSELF, against the REAL incidents rather than invented
   * cases. This repo has shipped a "new check" that could not fire more than once
   * — and `/ship`'s own § warns: *"falsify a new check against the incident that
   * caused it, not against a case you invent."*
   */
  it('no it() whose only assertions are not.toThrow() on a zero-arg call', () => {
    const offenders: string[] = []
    for (const f of testFiles()) {
      for (const h of vacuousNoThrowHits(readFileSync(f, 'utf8'))) {
        offenders.push(`${f}:${h.line}  "${h.title}"  ->  expect(() => ${h.expr}).not.toThrow()`)
      }
    }
    expect(offenders, offenders.length
      ? `Hollow: a zero-arg call has no input, so this asserts nothing about the title's claim.\n`
        + `${offenders.join('\n')}\n`
        + `Assert the property the title names, or mark it \`// hollow-ok: <reason>\`.`
      : '').toEqual([])
  })

  describe('FALSIFICATION — all three detectors fire on the incidents that caused them', () => {
    it('catches PLANVERB-01: toContain(onStartNewPlan) passing against onStartNewPlanX', () => {
      const incident = [
        `const SCREEN = readFileSync('x', 'utf8')`,
        `expect(SCREEN).toContain('onStartNewPlan')`,
      ].join('\n')
      expect(substringBiasHits(incident)).toHaveLength(1)
      // And the substring bias is real, not theoretical:
      expect('onStartNewPlanX'.includes('onStartNewPlan')).toBe(true)
      expect(/\bonStartNewPlan\b/.test('onStartNewPlanX')).toBe(false)
    })

    it('catches the 2026-09-24 case: an if() after toBeNull()', () => {
      const incident = [
        `const got = eventAtIso({})`,
        `expect(got).toBeNull()`,
        `if (got !== null) { expect(Date.parse(got)).toBeLessThan(before) }`,
      ].join('\n')
      expect(deadAfterAssertHits(incident)).toHaveLength(1)
    })

    it('catches the 2026-09-24 case: guidesGate.test.ts asserting nothing it was named for', () => {
      const src = [
        `  it('a comparison article does not need them, because prices are not coaching', () => {`,
        `    expect(() => guideArticles()).not.toThrow()`,
        `  })`,
      ].join('\n')
      const hits = vacuousNoThrowHits(src)
      expect(hits).toHaveLength(1)
      expect(hits[0]!.expr).toBe('guideArticles()')
    })

    it('does NOT fire on the 18 legitimate not.toThrow tests — throwing IS the domain signal', () => {
      // Verbatim shapes from the repo. `generateRulePlan` throws on a designed
      // refusal, `validateInputFields` on a rejected input, so "accepts" and
      // "admits" are exactly what not.toThrow() expresses. All pass arguments.
      const src = [
        `  it('accepts a plausible runner', () => {`,
        `    expect(() => validateInputFields(OK)).not.toThrow()`,
        `  })`,
        `  it('and still builds for a runner at the floor', () => {`,
        `    expect(() => generateRulePlan(base({ longest_recent_run_km: 5 }), 'paid', START)).not.toThrow()`,
        `  })`,
        `  it('does not throw on junk', () => {`,
        `    expect(() => schemaCodesFor(junk as never)).not.toThrow()`,
        `  })`,
      ].join('\n')
      expect(vacuousNoThrowHits(src)).toEqual([])
    })

    it('does NOT fire when a real assertion sits alongside it', () => {
      const src = [
        `  it('builds, and the arc is right', () => {`,
        `    expect(() => build()).not.toThrow()`,
        `    expect(build().weeks).toHaveLength(12)`,
        `  })`,
      ].join('\n')
      expect(vacuousNoThrowHits(src)).toEqual([])
    })

    it('honours the escape hatch for a zero-arg call over test-mutated state', () => {
      const src = [
        `  it('the fixture swap does not break the selector', () => {`,
        `    expect(() => selector()).not.toThrow()   // hollow-ok: the module state is swapped in beforeEach`,
        `  })`,
      ].join('\n')
      expect(vacuousNoThrowHits(src)).toEqual([])
    })

    it('does NOT fire on array membership — the 27 false positives that shaped the rule', () => {
      const arrayCase = [
        `const src = readFileSync('x', 'utf8')`,
        `const fields = parse(src)`,
        `expect(fields).toContain('benchmark')`,
      ].join('\n')
      expect(substringBiasHits(arrayCase)).toEqual([])
    })

    it('does NOT fire on the safe direction, .not.toContain', () => {
      const negative = [
        `const SRC = readFileSync('x', 'utf8')`,
        `expect(SRC).not.toContain('resetPasswordForEmail')`,
      ].join('\n')
      expect(substringBiasHits(negative)).toEqual([])
    })

    it('honours the escape hatch, which must carry a reason', () => {
      const exempt = [
        `const SRC = readFileSync('x', 'utf8')`,
        `expect(SRC).toContain('foo')   // hollow-ok: asserting the literal prefix, not the identifier`,
      ].join('\n')
      expect(substringBiasHits(exempt)).toEqual([])
    })
  })
})
