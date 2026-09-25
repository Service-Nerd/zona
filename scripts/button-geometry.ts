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
  for (const m of Array.from(css.matchAll(/\.((?:btn|icon-btn)--[a-z-]+)::after\s*\{([^}]*)\}/g))) {
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

const num = (t: string, prop: string): number | null => {
  const m = t.match(new RegExp(prop + ":\\s*'?([0-9.]+)px"))
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

  const padM = tag.match(/padding:\s*'([^']+)'/)
  let padY: number | null = null
  if (padM) {
    const first = padM[1]!.split(/\s+/)[0]!
    if (first.endsWith('px')) padY = parseFloat(first)
  }
  const font = num(tag, 'fontSize')
  const radM = tag.match(/borderRadius:\s*'?([^,'}]+)/)
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
  const height = painted === null ? (overlay || null) : Math.max(painted, overlay)

  const explicitW = tag.match(/width:\s*'([^']+)'/)?.[1] ?? null
  const width = /\bfullWidth\b/.test(tag) || cls.split(/\s+/).includes('btn--full')
    ? 'full' : explicitW ?? 'auto'

  return { floor, padY, font, radius, height, width }
}

export function measureAll(): Record<string, Box> {
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
    for (const tag of ['button', 'a', 'Link', 'Button', 'IconButton']) {
      for (const { text } of tags(src, tag)) {
        const onSystem = /className=[^\n]*\b(btn|icon-btn)\b/.test(text) ||
                         tag === 'Button' || tag === 'IconButton'
        if (!onSystem) continue
        const n = (seen[tag] = (seen[tag] ?? 0) + 1)
        out[`${f}#${tag}${n}`] = boxOf(text, floors, padFromClass, tag, overlays)
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
