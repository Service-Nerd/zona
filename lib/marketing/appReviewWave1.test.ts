// App review wave 1 — the Design Board's rulings, held mechanically.
//
// Sitting three, 2026-09-22 (`design-rulings.md` § 6g). Source checks, and the
// file says so: these are vocabulary and geometry rules about strings and one
// padding declaration, and a rendered-DOM test would need the whole dashboard
// behind auth to assert them.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
/** Strip comments FIRST. Every rule here is about COPY, and this file's own
 *  rationale quotes the strings it bans. Eighth time this repo has met that. */
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const WIZARD = 'app/dashboard/GeneratePlanScreen.tsx'
const SHELL = 'app/dashboard/DashboardClient.tsx'

describe('S3 — one CTA vocabulary', () => {
  it('no wizard CTA label carries a directional arrow', () => {
    // Measured before the ruling: FOUR labels for one button — `Continue`,
    // `Continue →`, `Got it →`, `Skip this →` — arrow on some, not others.
    const src = strip(read(WIZARD))
    // Bound to the CTA label expression and STEP_META's `cta` entries, not the
    // whole file: `→` is legitimate elsewhere (a back chevron, a trend arrow).
    const ctas = Array.from(src.matchAll(/cta:\s*'([^']*)'/g)).map(m => m[1])
    const exprs = Array.from(src.matchAll(/ctaLabel\s*=[\s\S]{0,240}?\n\n/g)).map(m => m[0])
    const offenders = [
      ...ctas.filter(c => c.includes('→')),
      ...exprs.flatMap(e => Array.from(e.matchAll(/'([^']*→[^']*)'|"([^"]*→[^"]*)"/g)).map(m => m[1] ?? m[2])),
    ]
    expect(offenders, 'a CTA in a fixed position doing a fixed job does not need an arrow').toEqual([])
  })
})

describe('S4 — the optional-step affordance does not lie', () => {
  it('no button claims to SKIP, because `skipStep` is `goNext`', () => {
    const src = strip(read(WIZARD))
    // `skipStep() { goNext() }` — one line, no branch. It clears nothing and
    // records nothing, so answering the step and tapping it KEEPS the answer.
    expect(src).toMatch(/function skipStep\(\)\s*\{\s*goNext\(\)\s*\}/)
    // Therefore no affordance may say "Skip". Bounded to rendered text between
    // JSX tags, so the word may still appear in a subtitle explaining the step.
    const jsxText = Array.from(src.matchAll(/>\s*([A-Z][^<>{}]{2,40})\s*</g)).map(m => m[1].trim())
    expect(jsxText.filter(t => /^Skip\b/i.test(t)),
      'nothing is skipped — the button continues').toEqual([])
  })

  it('the affordance is still THERE, which is the amendment', () => {
    // Wroblewski's binding amendment: five of the six optional steps have no
    // FieldLabel to hang "optional" on, so removing it outright would strand a
    // runner who does not know the step is optional. Deleting this assertion to
    // "simplify" re-opens that.
    expect(strip(read(WIZARD))).toContain('Not sure, continue')
  })

  it('and it is not an em dash — brand.md bans them in copy SITE-WIDE', () => {
    // ⚠️ CLAUDE.md refers to an "app-side exception" in brand.md § Punctuation.
    // READ THAT SECTION: there is none. The only exclusions are en dashes in
    // ranges and code comments.
    const src = strip(read(WIZARD))
    const i = src.indexOf('Not sure')
    expect(src.slice(Math.max(0, i - 80), i + 80)).not.toContain('—')
  })
})

describe('A4 — the safe area is background, not padding', () => {
  it('the bottom nav pads its content symmetrically', () => {
    // Measured: `6px 0 max(12px, env(safe-area-inset-bottom))` gave 6px above
    // the icons and 34px below on any iPhone with a home indicator —
    // asymmetric by 28px, the void the founder reported.
    const src = strip(read(SHELL))
    const i = src.indexOf("background: 'var(--nav-bg)'")
    expect(i, 'the bottom nav declaration has moved — re-anchor this test').toBeGreaterThan(-1)
    const decl = src.slice(i, i + 400)
    const m = decl.match(/padding:\s*'(\d+)px 0 calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)'/)
    expect(m, `nav padding must be 'Npx 0 calc(Npx + env(safe-area-inset-bottom))', got: ${decl.slice(0, 160)}`).toBeTruthy()
    expect(m![1], 'top and bottom content padding must match').toBe(m![2])
    // The old shape spent the inset AS the padding rather than adding to it.
    expect(decl).not.toMatch(/padding:[^']*'[^']*max\(\d+px, env\(safe-area-inset-bottom\)\)/)
  })
})

describe('S2 — dismiss is never the CTA colour', () => {
  it('no dismiss CONTROL is painted `--moss`, across every app surface', () => {
    // `--moss` is the CTA colour. Spending the strongest colour in the system on
    // *dismiss* teaches the opposite of what it means. The founder named it:
    // "I don't think one of our key calls to action should be Close in big
    // green moss."
    //
    // ⚠️ THIS CHECK WAS WRONG TWICE BEFORE IT WAS RIGHT, and both ways.
    //  1. Its file list was hand-written and three files long. It MISSED the
    //     actual offender — a full-width `--moss` "Close" in
    //     `ModifyPlanSheet.tsx`, the exact button the founder complained about.
    //     "An audit is only ever as wide as its list." Now it reads the tree.
    //  2. It matched the WORD "close" anywhere on a line, and fired on
    //     `headline: 'Close. Bit of fine-tuning to do.'` — prose, not a control.
    //     Now the line must also carry a dismiss HANDLER.
    const files: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
        else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) files.push(rel)
      }
    }
    walk('app'); walk('components')

    // ⚠️ AND WRONG A THIRD TIME: matching the HANDLER NAME flagged Orientation's
    // "I'm ready" button, which is wired to an `onDismiss` prop and is the
    // primary action of that screen. **The property is the LABEL, not the
    // handler.** A button that SAYS Close is a dismiss whatever its callback is
    // called; a button that says "I'm ready" is not, whatever its callback is
    // called.
    // ⚠️ AND TOO NARROW A FOURTH TIME (S2-GATE-NARROW-01, 2026-09-22). The
    // list omitted every BACK form, and four full-width `--moss` buttons sat
    // behind that gap: "Back to training" (Upgrade), "Back to plan"
    // (Benchmark), "Back to today" (Recalibration) and a bare "Back" (the
    // reshape screen). **An audit is only ever as wide as its list** — the
    // third time this repo has written that sentence.
    //
    // `back to <anywhere>` is deliberately open-ended rather than a fixed set
    // of destinations: enumerating them is what made the list too narrow each
    // of the previous three times.
    const DISMISS_WORDS = /^(close|cancel|dismiss|not now|maybe later|no thanks|back|go back|back to [a-z ]+)$/i
    const offenders: string[] = []
    for (const f of files) {
      const src = strip(read(f))
      for (const m of Array.from(src.matchAll(/<button\b[\s\S]{0,900}?<\/button>/g))) {
        const block = m[0]
        const label = (block.match(/>\s*([^<>{}]{1,24}?)\s*<\/button>/) ?? [])[1]
        if (!label || !DISMISS_WORDS.test(label.trim())) continue
        // ⚠️ AND IT COULD ONLY SEE AN INLINE STYLE. `RecalibrationTile`
        // paints its dismiss through a local `primary(enabled)` helper, so
        // `background: 'var(--moss)'` never appeared in the button block and
        // the gate was structurally blind to it — the same shape as a checker
        // reading a different source from the producer. One hop of resolution:
        // if the style is an identifier or a call defined in this file, look
        // at THAT definition too. One hop, not a graph walk: unresolvable is
        // reported as unresolvable rather than guessed.
        let styled = block
        const ref = block.match(/style=\{([A-Za-z_$][\w$]*)\s*[({]?/)
        if (ref) {
          const decl = src.match(
            new RegExp('const\\s+' + ref[1] + '\\s*[=:][\\s\\S]{0,400}?\\n\\s*\\}'),
          )
          if (decl) styled += decl[0]
        }
        if (/background:[^;}]*var\(--moss\)/.test(styled)) offenders.push(`${f}: "${label.trim()}"`)
      }
    }
    expect(offenders, 'a dismiss control painted in the CTA colour').toEqual([])
  })
})
