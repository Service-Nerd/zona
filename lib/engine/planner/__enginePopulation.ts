// FREE — test support. ADR-027 B4f.
//
// 🔴 THE ENGINE'S POPULATION IS TWO PLACES NOW, AND THIS EXISTS BECAUSE I PINNED IT TO ONE THREE
// TIMES. Each L3 brick moves code out of `ruleEngine.ts`, and every arm that COUNTS something in the
// old engine then goes red for a relocation it should not care about:
//   · B4b moved 3 `deloadWeeks.has(` reads → `deloadCadence.test.ts`'s pin of 6 read 3
//   · B4d moved one `strength` type-test → `deliveredVolume.test.ts`'s pin of 12 read 11
//   · B4f moved §45/§52/§6's cap passes → three arms at once
// **A count scoped to one file cannot tell a relocation from a deletion**, which is the one thing
// those pins exist to distinguish. The population follows the strangler; the totals stay pinned.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

/**
 * A comment is prose (HOOK-RGBA-COMMENTS-01). Line count is preserved so positions still line up.
 *
 * 🔴 ONE ORDERED PASS, NOT BLOCK-THEN-LINE, AND THE FIRST CUT OF THIS FUNCTION GOT IT WRONG.
 * Replacing `/* … *\/` first and `//` second means a `//` comment containing a `/*` opens a block
 * that runs to the next `*\/` — blanking real code in between. 📐 Measured when code review
 * falsified it: **248 code lines across 21 files under `lib/`**, 20 of them in `generationConfig.ts`
 * from a single comment, and a planted `deloadWeeks.has(` inside the blanked window left
 * `deloadCadence.test.ts` GREEN at 6 while the same line outside it went red at 7.
 * **A guard reading through a broken stripper is a claim about what the stripper could see.**
 * `scripts/lib/strip-comments.py` paid for this exact defect (405 lines across 11 files, including a
 * 231-line contiguous window) and its own suite records it; this is that fix in TypeScript.
 *
 * 🔻 ITS LIMITS, STATED RATHER THAN DISCOVERED LATER, and they are the Python owner's too: quote
 * state is per LINE, so a `/*` inside a multi-line template literal's continuation lines reads as
 * code; and a regex ending in `//` reads as a line comment. Both are false BLANKS, which is the
 * better trade than a guard that fires on prose. Lexing either properly needs a parser.
 */
export const stripComments = (src: string): string => {
  let out = ''
  let inBlock = false
  for (const line of src.split('\n')) {
    if (out) out += '\n'
    let i = 0
    let kept = ''
    let quote: string | null = null
    while (i < line.length) {
      const two = line.slice(i, i + 2)
      if (inBlock) {
        if (two === '*/') { inBlock = false; kept += '  '; i += 2 } else { kept += ' '; i += 1 }
        continue
      }
      if (quote) {
        kept += line[i]
        if (line[i] === '\\') { kept += line[i + 1] ?? ''; i += 2; continue }
        if (line[i] === quote) quote = null
        i += 1
        continue
      }
      if (line[i] === '"' || line[i] === "'" || line[i] === '`') { quote = line[i]; kept += line[i]; i += 1; continue }
      // Whichever opener comes FIRST wins — that is the whole fix.
      if (two === '//') { kept += ' '.repeat(line.length - i); i = line.length; continue }
      if (two === '/*') { inBlock = true; kept += '  '; i += 2; continue }
      kept += line[i]; i += 1
    }
    out += kept
  }
  return out
}

/** Every tracked file the race-plan engine is spread across: the old planner plus L3.
 *  ⚠️ From `git ls-files`, never `readdirSync` — a directory listing counts untracked scratch
 *  probes, which once produced a confidently wrong diagnosis. */
export function engineSources(root = process.cwd()): { path: string; code: string }[] {
  const planner = execSync("git ls-files 'lib/engine/planner/*.ts'", { cwd: root, encoding: 'utf8' })
    .trim().split('\n').filter(f => f && !f.endsWith('.test.ts'))
  if (planner.length < 4) throw new Error(`engineSources found only ${planner.length} L3 modules — the glob is broken`)
  // ⚠️ IT DOES NOT COUNT ITSELF. This file is test support, not engine code, and its header cites
  // the very shapes the arms count (`deloadWeeks.has(`, `isLongRun(`) as evidence — so leaving it in
  // the population makes a guard fire on prose about the guard. Found by code review.
  return ['lib/plan/ruleEngine.ts', ...planner.filter(f => !f.endsWith('__enginePopulation.ts'))]
    .map(path => ({ path, code: stripComments(readFileSync(join(root, path), 'utf8')) }))
}

/** The whole engine as one stripped string, for counting a shape across it. */
export const engineCode = (root = process.cwd()): string =>
  engineSources(root).map(s => s.code).join('\n')

/** A named region inside whichever engine file holds it, BY LINES not characters: `stripComments`
 *  blanks comment text while preserving length, so a character window over a well-commented
 *  function is mostly blanks (measured: a 500-char window reached 6 lines in). */
export function engineRegion(marker: string, lineCount: number, root = process.cwd()): string {
  for (const { code } of engineSources(root)) {
    const lines = code.split('\n')
    const i = lines.findIndex(l => l.includes(marker))
    if (i >= 0) return lines.slice(i, i + lineCount).join('\n')
  }
  throw new Error(`engineRegion: "${marker}" is in no engine file — the region this arm reads is gone`)
}
