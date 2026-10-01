/**
 * BUTTON-GEOMETRY-01 — every button's rendered BOX, measured and baselined.
 *
 * 🔴 WHY THIS EXISTS. On 2026-09-25 a migration onto shared button classes
 * changed the SIZE of 20 of 32 converted controls — range -19px to +4px, radii
 * -10 to +4 — and `tsc`, the ownership gate, the render tests and 3,527 suite
 * tests were ALL GREEN through it. The founder found it by looking at the app.
 *
 * Every check we had asked "does this control use the right owner?". None asked
 * "does it still render the same box?". That is a new failure class and it is
 * in the debug catalogue: **a refactor that normalises a distribution.**
 *
 * ⚠️ THE SYNTAX HID IT. `min-height: 48px` alone is a FLOOR. `min-height: 48px`
 * WITH `padding: 15px 20px` and `font-size: 14px` is a BOX, because padding and
 * line-height set the height and the minimum never binds. We wrote a floor and
 * shipped a box (Wroblewski, ADR-023 sitting).
 *
 * Same idiom as `cohort:shape` and `measure:fitness`: compute, compare against a
 * committed baseline, and a MOVE is not automatically wrong — it is automatically
 * something to DECLARE with a number before shipping. Re-baseline with
 * `npm run button:geometry -- --write` and say in the commit which control moved
 * and why. Never re-baseline to turn a test green.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export interface Box {
  /** Effective min-height in px from the size class, or null if none. */
  floor: number | null
  /** Vertical padding from the call site, px. */
  padY: number | null
  /** font-size px. */
  font: number | null
  /** `measureAll({ all: true })` only: is this control on the shared system?
   *  Absent in the default (filtered) measurement, so the baseline never holds it. */
  onSystem?: boolean
  /** Style constants spread into this tag that could not be resolved (imported).
   *  Present only when non-empty, so it does not churn every baseline entry. */
  unreadable?: string[]
  /** border-radius px, or a token name. */
  radius: string | null
  /** Computed height: floor if it binds, else padY*2 + line-box. */
  height: number | null
  /**
   * 🔴 WIDTH, ADDED AFTER THE FOUNDER FOUND THE BUG THIS FILE MISSED.
   * The Apple Health chip read "huge" mostly because the conversion gave it
   * `fullWidth` — which it never had — and it stretched a `space-between` row.
   * This harness measured height, padding, font and radius and **never width**,
   * so the single most visible geometry change in the batch was outside it.
   * The falsification that supposedly proved it caught `fullWidth` went red for
   * an unrelated reason (removed size classes), and I read that as coverage.
   * `'full'` = stretches, `'auto'` = intrinsic, or an explicit px.
   */
  width: string | null
}

const ROOT = process.cwd()

/** Size classes and the floor each declares. Read from globals.css, never
 *  hardcoded — a checker sharing the producer's list is blind to that list. */
export function sizeFloors(css: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of Array.from(css.matchAll(/\.((?:btn|icon-btn)--[a-z-]+)\s*\{([^}]*)\}/g))) {
    // `([0-9.]+)px` missed a bare `min-height: 0`, so `.btn--inline-chip`
    // silently inherited `.btn--compact`'s 44 and read correct by accident.
    const mh = m[2]!.match(/min-height:\s*([0-9.]+)(?:px)?\s*[;}]/)
    if (mh) out[m[1]!] = parseFloat(mh[1]!)
  }
  return out
}

/**
 * A class whose `::after` carries an invisible hit area, and the height of it.
 *
 * ⚠️ WITHOUT THIS THE NUMBER IS RIGHT BY ACCIDENT. `.btn--inline-chip` paints a
 * 29px pill and carries a 44px target on `::after`, because padding cannot grow
 * a FILLED control's target without growing the pill. The harness first reported
 * it as 44 only because `min-height: 0` has no `px` and the regex fell through
 * to `.btn--compact`'s floor. Right answer, wrong mechanism — which is exactly
 * the kind of coincidence that stops being true the next time someone edits it.
 */
export function overlayTargets(css: string): Record<string, number> {
  const out: Record<string, number> = {}
  // 🔴 ANY CLASS, WITH OR WITHOUT A MODIFIER — it was `(?:btn|icon-btn)--[a-z-]+`
  // (2026-09-25). `.switch::after` carries a 44px hit area and matched neither
  // half: wrong prefix AND no `--modifier`. Adding switches to the measured set
  // without this would have reported a CORRECT 26px control as breaching the
  // 44px floor — a false positive, which this repo records as the fastest way
  // to get a gate switched off. Third population bug in this harness today.
  for (const m of Array.from(css.matchAll(/\.([a-z][a-z0-9-]*(?:--[a-z-]+)?)::after\s*\{([^}]*)\}/g))) {
    const h = m[2]!.match(/height:\s*([0-9.]+)px/)
    if (h) out[m[1]!] = parseFloat(h[1]!)
  }
  return out
}

/**
 * Vertical padding a CLASS contributes, so a control whose hit area is grown by
 * the stylesheet is measured honestly.
 *
 * ⚠️ WITHOUT THIS THE INLINE MARK READS AS A 15px TARGET AND IS A FALSE
 * POSITIVE. `SessionSteps`' ringed "i" is 15px of GLYPH with 14.5px of class
 * padding either side — 44px of target, exactly as ICON-BUTTON-01 amendment 3
 * ruled. Baselining it as debt would have recorded a sanctioned design as a
 * violation, which is how a register's reason column becomes noise.
 */
export function classPadY(css: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of Array.from(css.matchAll(/\.((?:btn|icon-btn)--[a-z-]+)\s*\{([^}]*)\}/g))) {
    // ⚠️ NOT `(?:^|;)\s*padding` — that required a semicolon immediately before
    // the declaration and silently missed it the moment a COMMENT was inserted
    // above the line, reporting a 44px target as 15px. Strip comments, then
    // match the declaration on its own.
    const body = m[2]!.replace(/\/\*[\s\S]*?\*\//g, '')
    const p = body.match(/(?:^|[;{])\s*padding:\s*([0-9.]+)px/m)
    if (p) out[m[1]!] = parseFloat(p[1]!)
  }
  return out
}

function tags(src: string, tag: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  const re = new RegExp('<' + tag + '(?=[\\s>])', 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let i = re.lastIndex, depth = 0
    while (i < src.length) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
      i++
    }
    out.push({ line: src.slice(0, m.index).split('\n').length, text: src.slice(m.index, i + 1) })
  }
  return out
}

/**
 * A px literal for `prop`, LAST occurrence wins.
 *
 * ⚠️ LAST, NOT FIRST, and this was a real defect found by its own test. In a
 * CSS-in-JS object a later key beats an earlier one, which is exactly what
 * `style={{ ...common, padding: '4px' }}` means. The first cut read the FIRST
 * match, so once `expandStyleSpreads` inserted the constant's declarations the
 * constant's padding beat the call site's override: the harness reported 12px
 * where the browser paints 4px. **Fifth modelling bug found in this file before
 * trusting it, and the pattern holds — every one was a plausible reading of the
 * source that the browser disagrees with.**
 */
const num = (t: string, prop: string): number | null => {
  const all = Array.from(t.matchAll(new RegExp(prop + ":\\s*'?([0-9.]+)px", 'g')))
  const m = all[all.length - 1]
  return m ? parseFloat(m[1]!) : null
}

/**
 * The classes a control actually renders with.
 *
 * 🔴 A SOURCE SCAN SEES NO `className` ON A COMPONENT USAGE, and that blinded
 * the first cut of this harness to 45 of 98 controls — in the very check written
 * to catch a geometry change. `<Button variant="primary">` computes its classes
 * INSIDE the component, so the props are the only signal here.
 *
 * ⚠️ This mirrors the components' own mapping, which is a second copy of a list
 * and therefore the hazard this repo keeps recording. It is bounded two ways:
 * the constructed names must EXIST in `globals.css` (a rename breaks loudly, see
 * `buttonGeometry.test.ts`), and the mapping is props->name only — it never
 * restates a VALUE, which stays read from the stylesheet.
 */
function renderedClasses(tag: string, name: string): string {
  const explicitCls = tag.match(/className=[{"`']([^"`'}]*)/)?.[1] ?? ''
  // 🔴 A `<Switch>` USAGE CARRIES NO GEOMETRY AT ALL, and that is the point of
  // the component — but it meant the first cut measured all three as
  // `{height: null}`, which the 44px floor arm SKIPS (`b.height !== null`).
  // They were counted in the total and measured by nothing: a hollow entry that
  // reads as covered. Third time today a check's population looked complete and
  // was not. `.switch` is unconditional, so it is named here directly.
  if (name === 'Switch') return `switch ${explicitCls}`
  if (name !== 'Button' && name !== 'IconButton') return explicitCls
  const prop = (p: string) => tag.match(new RegExp(p + '="([a-z-]+)"'))?.[1] ?? null
  if (name === 'Button') {
    const variant = prop('variant') ?? 'primary'
    const size = prop('size') ?? 'regular'
    return `btn btn--${variant} btn--${size} ${explicitCls}`
  }
  const shape = prop('shape') ?? 'bare'
  const inline = /\binlineMark\b/.test(tag)
  return `icon-btn icon-btn--${shape} icon-btn--${inline ? 'inline-mark' : 'regular'} ${explicitCls}`
}

/**
 * BUTTON-GEOMETRY-SPREAD-01 — EXPAND `...CONST` IN A `style` OBJECT BEFORE MEASURING.
 *
 * 🔴 The harness reads LITERALS: `padding:`, `fontSize:`, `minHeight:`. The moment
 * a call site does the right thing and hoists its style into a constant, those
 * values vanish from the tag text and the box is measured from whatever is left,
 * silently. Wave 1a produced exactly this: a control reported `font: 12 -> null`
 * with its box provably unchanged, because the value now arrived via
 * `...MICRO_LABELS.eyebrow`.
 *
 * ⚠️ MEASURED 2026-10-01: TEN measured tags carry a style spread
 * (`CardSelect` x2, `MeScreen`, `CoachByline`, `DashboardClient`,
 * `onboarding-preview` x3, and two more). **Most are filtered out TODAY by
 * `onSystem`**, which is why there is no live exposure yet — and is exactly why
 * this must be fixed BEFORE `TAP-TARGET-FLOOR-01` drops that filter. Dropping it
 * first would hand the floor arm ten controls whose padding it cannot see.
 *
 * Same-file `const NAME = { ... }` is expanded. An IMPORTED constant is not
 * followed: that needs module resolution, and a half-done resolver that returns
 * partial values is worse than one that admits it cannot read the object. Those
 * are marked `unreadable` and counted, so the population cannot shrink quietly.
 */
/**
 * The inline border WIDTH in px, 0 when absent or not a px literal.
 *
 * Reads `border:` / `borderWidth:` / `borderTop|Bottom:`. A token-valued border
 * (`border: '1px solid var(--line)'`) still yields its width, which is the part
 * that moves a box; the colour is irrelevant here.
 */
export function borderWidth(tag: string): number {
  const m = tag.match(/border(?:Width)?:\s*'([^']+)'/)
  if (!m) return 0
  const px = m[1]!.match(/(\d+(?:\.\d+)?)px/)
  if (!px) return 0
  // `border: 'none'` and `border: 0` read as 0 via the px miss above.
  return parseFloat(px[1]!)
}

export function expandStyleSpreads(tagText: string, src: string): { text: string; unresolved: string[] } {
  const styleM = tagText.match(/style=\{\{([\s\S]*)/)
  if (!styleM) return { text: tagText, unresolved: [] }

  const unresolved: string[] = []
  let text = tagText

  for (const m of Array.from(styleM[1]!.matchAll(/\.\.\.([A-Za-z_$][\w$]*)/g))) {
    const name = m[1]!
    const body = constObjectBody(src, name)
    if (body === null) { unresolved.push(name); continue }
    // Append the constant's own declarations so the existing literal readers see
    // them. Appending, never prepending: an inline value after the spread must
    // keep winning, which is what JS object spread does.
    text = text.replace('style={{', `style={{ ${body} ,`)
  }
  return { text, unresolved }
}

/** The body of a same-file `const NAME = { ... }`, brace-matched. Null if absent. */
function constObjectBody(src: string, name: string): string | null {
  const re = new RegExp('const\\s+' + name + '\\s*(?::[^=]+)?=\\s*\\{')
  const m = src.match(re)
  if (!m || m.index === undefined) return null
  let i = m.index + m[0].length
  let depth = 1
  const start = i
  while (i < src.length && depth > 0) {
    const c = src[i]!
    if (c === '{') depth++
    else if (c === '}') depth--
    i++
  }
  return depth === 0 ? src.slice(start, i - 1) : null
}

export function boxOf(tag: string, floors: Record<string, number>, padFromClass: Record<string, number> = {}, name = 'button', overlays: Record<string, number> = {}): Box {
  const cls = renderedClasses(tag, name)
  // 🔴 RESOLVE BY CSS SOURCE ORDER, NOT CLASSNAME ORDER. Equal-specificity
  // class selectors are decided by which is declared LAST in the stylesheet —
  // not by the order the author happened to type them in `className`. Reading
  // the className left-to-right reported `.btn--inline-target`'s `min-height:0`
  // as winning when `.btn--compact`'s 44px actually did, so this file said 29px
  // while the device showed 44px and the founder saw the difference.
  // `floors` is built by iterating the stylesheet, so its key order IS source
  // order: the last matching key wins.
  const present = new Set(cls.split(/\s+/))
  let floor: number | null = null
  let classPad = 0
  let overlay = 0
  for (const c of Object.keys(floors)) if (present.has(c)) floor = floors[c]!
  for (const c of Object.keys(padFromClass)) if (present.has(c)) classPad = padFromClass[c]!
  for (const c of Object.keys(overlays)) if (present.has(c)) overlay = overlays[c]!

  const explicit = num(tag, 'minHeight') ?? num(tag, 'height')

  // Last-wins, for the same reason as `num` above.
  const padAll = Array.from(tag.matchAll(/padding:\s*'([^']+)'/g))
  const padM = padAll[padAll.length - 1]
  let padY: number | null = null
  if (padM) {
    const first = padM[1]!.split(/\s+/)[0]!
    if (first.endsWith('px')) padY = parseFloat(first)
  }
  const font = num(tag, 'fontSize')
  const radAll = Array.from(tag.matchAll(/borderRadius:\s*'?([^,'}]+)/g))
  const radM = radAll[radAll.length - 1]
  const radius = radM ? radM[1]!.trim() : null

  // 🔴 THIS APP IS `box-sizing: border-box` GLOBALLY (`globals.css` `*` rule),
  // and the first cut of this file assumed content-box. Under border-box,
  // padding sits INSIDE the declared height: `min-height: 52px` with
  // `padding: 15px` is a 52px button, not an 82px one. Getting that backwards
  // reported the two restored ceremony CTAs as 82px.
  //
  // ⚠️ AND IT HAS A CONSEQUENCE BEYOND THIS FILE: an explicit `height` smaller
  // than its own padding does NOT grow into a bigger hit area under border-box.
  // See ICON-BUTTON-01's inline-mark exception — filed as its own defect
  // (`INLINE-MARK-BORDER-BOX-01`) rather than quietly patched here.
  const line = Math.round((font ?? 14) * 1.2)
  // ⚠️ AN INLINE PADDING OVERRIDES THE CLASS, IT DOES NOT ADD TO IT. Summing
  // them reported a restored 50px control as 80px — the harness inventing a
  // regression that did not exist, which is the failure mode that makes a gate
  // get switched off. Class padding counts only when the call site is silent.
  const effPad = padY !== null ? padY : classPad
  const padBox = effPad * 2 + line          // what padding alone produces
  const declared = explicit ?? floor ?? null
  const painted = declared !== null ? Math.max(declared, padBox)
    : (padY !== null || classPad > 0) ? padBox : null
  // The TARGET is what `:262` governs. An overlay can exceed the painted box.

  // BUTTON-GEOMETRY-BORDER-01 — THE HARNESS MODELLED PADDING, CLASSES,
  // STYLESHEET ORDER AND WIDTH, AND NEVER PARSED `border` AT ALL.
  //
  // Under `box-sizing: border-box` that is CORRECT for any control with a floor
  // or an explicit height: the border paints inside and the outer box cannot
  // move. It is WRONG for a content-sized one, where the border adds to the
  // outer box on both edges.
  //
  // 📐 Measured 2026-09-26: six classes carry `border: 1px` and are
  // content-sized in their own block (`.btn--secondary`, `.btn--soft`,
  // `.btn--destructive`, `.icon-btn--circle`, `.icon-btn--square`,
  // `.nav-bar--floating`) and **every one composes with a size class that
  // floors**, so there is no live exposure today. `ICON-EDGE-01` added a border
  // to two of them and a browser confirmed 44x44, `geometry moved: 0`.
  //
  // ⚠️ SO THE HARNESS IS RIGHT TODAY AND STRUCTURALLY BLIND. The first bordered
  // control written WITHOUT a size class moves and it prints `moved: 0`, which
  // is the sentence this repo has recorded more than any other.
  //
  // Only the content-sized path adds it, so this changes no box that is floored.
  const borderPx = borderWidth(tag)
  const paintedWithBorder = painted === null ? null
    : (declared !== null ? painted : painted + borderPx * 2)
  const height = paintedWithBorder === null ? (overlay || null) : Math.max(paintedWithBorder, overlay)

  const explicitW = tag.match(/width:\s*'([^']+)'/)?.[1] ?? null
  const width = /\bfullWidth\b/.test(tag) || cls.split(/\s+/).includes('btn--full')
    ? 'full' : explicitW ?? 'auto'

  return { floor, padY, font, radius, height, width }
}

/**
 * BUTTON-GEOMETRY-KEY-02 — A KEY STABLE TO REORDERING.
 *
 * 🔴 THE HISTORY MATTERS, BECAUSE BOTH PREVIOUS KEYS FAILED AND IN OPPOSITE
 * DIRECTIONS.
 *
 *   `file:line:tag` — inserting ONE line re-keyed every control below it, the
 *   comparison skipped all of them (`if (!was) continue`) and the gate printed
 *   `moved: 0`. **A false PASS**, which is the worst outcome available.
 *
 *   `file#tag<ordinal>` — reordering blocks within a file re-keys without any
 *   box changing. `ME-DOORS-01` moved blocks in `DashboardClient` and this
 *   harness reported TWO controls moved while the geometry MULTISET was
 *   identical, 82 controls both sides: `Button63` and `Button65` had swapped.
 *   **A false ALARM**, and an alarm that is routinely re-baselined is an alarm
 *   that stops being read, which this repo records as equivalent to no check.
 *
 * So the key is the control's own IDENTITY where it has one: `aria-label`, else
 * its literal text, else a `key=` prop, else its `className`. The ordinal stays
 * as the last resort AND as a disambiguator, because two identical controls in
 * one file are genuinely indistinguishable from source and must not collide.
 */
export function keyFor(file: string, tag: string, text: string, ordinal: number): string {
  const ident =
    text.match(/aria-label=["'`]([^"'`{]{2,40})/)?.[1] ??
    text.match(/\bkey=\{?["'`]([^"'`{]{2,40})/)?.[1] ??
    text.match(/\btitle=["'`]([^"'`{]{2,40})/)?.[1] ??
    text.match(/className=["'`]([^"'`{]{2,40})/)?.[1] ??
    null
  const slug = ident
    ? ident.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
    : null
  // The ordinal is retained even when an identity exists: `aria-label` is not
  // unique in this codebase (several screens have two "Back" controls) and a
  // colliding key silently overwrites a measurement, which is a shrinking
  // population wearing a stable key.
  return slug ? `${file}#${tag}[${slug}]${ordinal}` : `${file}#${tag}${ordinal}`
}

/**
 * TAP-TARGET-FLOOR-01 — `{ all: true }` DROPS THE `onSystem` FILTER.
 *
 * 🔴 WHY THE DEFAULT IS STILL FILTERED. The baseline exists to catch a
 * CONVERSION changing a box, so it measures the converted population; widening
 * it would churn the baseline with 106 hand-rolled controls no conversion
 * touches.
 *
 * 🔴 WHY THE FLOOR ARM MUST NOT USE THAT DEFAULT. The 44px floor
 * (`ui-patterns.md:262`, iOS HIG) governs **every** control a thumb can hit, and
 * the hand-rolled population is the one most likely to violate it — so
 * measuring only the converted set made the arm **structurally incapable of
 * finding a violation**, since every converted control carries a size class
 * that floors at 44 by construction. **Measured 2026-10-01 with the filter
 * dropped: 262 controls against 156, and 21 under the floor, the smallest
 * 18px.** The arm had been green over every one of them since it was written.
 *
 * ⚠️ THIS HAD TO WAIT FOR `BUTTON-GEOMETRY-SPREAD-01`. Ten of the newly visible
 * tags carry a style spread, and until same-file constants were expanded their
 * padding was invisible — so dropping the filter first would have measured ten
 * controls from whatever was left of their style objects.
 */
export function measureAll(opts: { all?: boolean } = {}): Record<string, Box> {
  const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')
  const floors = sizeFloors(css)
  const padFromClass = classPadY(css)
  const overlays = overlayTargets(css)
  const files: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) {
        if (['node_modules', '.next', 'ios', '__fixtures__'].includes(e.name)) continue
        walk(rel)
      } else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) files.push(rel)
    }
  }
  walk('app'); walk('components')
  const out: Record<string, Box> = {}
  for (const f of files.sort()) {
    const src = readFileSync(join(ROOT, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''))
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, m => m.replace(/[^\n]/g, ''))
    // 🔴 KEYED BY ORDINAL, NOT BY LINE (2026-09-25). The key was
    // `file:line:tag`, and the comparison skips any current key the baseline
    // does not hold — so INSERTING ANYTHING re-keyed every control below it and
    // the whole file silently dropped out of the check. It did not report a
    // move; it reported nothing, which reads identically to "nothing moved".
    // That is this repo's most-recorded failure shape, in the very harness
    // written to stop a silent regression.
    //
    // ⚠️ An ordinal still shifts when a control is ADDED or REMOVED mid-file,
    // so it is better, not perfect — which is why the coverage arm below is
    // the actual defence: it fails when baseline entries stop matching at all.
    const seen: Record<string, number> = {}
    for (const tag of ['button', 'a', 'Link', 'Button', 'IconButton', 'Switch']) {
      for (const { text } of tags(src, tag)) {
        const onSystem = /className=[^\n]*\b(btn|icon-btn|switch)\b/.test(text) ||
                         tag === 'Button' || tag === 'IconButton' || tag === 'Switch'
        if (!onSystem && !opts.all) continue
        const { text: expanded, unresolved } = expandStyleSpreads(text, src)
        const n = (seen[tag] = (seen[tag] ?? 0) + 1)
        const box = boxOf(expanded, floors, padFromClass, tag, overlays)
        if (unresolved.length) box.unreadable = unresolved.sort()
        // Only in `all` mode, so the committed baseline's shape is unchanged.
        if (opts.all) box.onSystem = onSystem
        out[keyFor(f, tag, text, n)] = box
      }
    }
  }
  return out
}

const BASELINE = join(ROOT, 'components/ui/__fixtures__/buttonGeometry.json')

if (process.argv[1]?.includes('button-geometry')) {
  const now = measureAll()
  if (process.argv.includes('--write')) {
    writeFileSync(BASELINE, JSON.stringify(now, null, 2) + '\n')
    console.log(`baseline written: ${Object.keys(now).length} controls`)
    process.exit(0)
  }
  if (!existsSync(BASELINE)) {
    console.error('no baseline — run with --write')
    process.exit(2)
  }
  const base: Record<string, Box> = JSON.parse(readFileSync(BASELINE, 'utf8'))
  const moved: string[] = []
  for (const [k, b] of Object.entries(now)) {
    const was = base[k]
    if (!was) continue                       // new control; the gate reports adds separately
    if (JSON.stringify(was) !== JSON.stringify(b)) {
      moved.push(`${k}\n    was ${JSON.stringify(was)}\n    now ${JSON.stringify(b)}`)
    }
  }
  const under = Object.entries(now).filter(([, b]) => b.height !== null && b.height < 44)
  console.log(`controls on the system: ${Object.keys(now).length}`)
  console.log(`geometry moved:         ${moved.length}`)
  console.log(`below the 44px floor:   ${under.length}`)
  if (moved.length) console.log('\n' + moved.join('\n'))
  if (under.length) console.log('\nUNDER 44px:\n' + under.map(([k, b]) => `  ${k} = ${b.height}`).join('\n'))
  process.exit(moved.length || under.length ? 1 : 0)
}
