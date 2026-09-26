import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * STICKY-SCROLLER-01 — an `overflow-y: auto` box that can never overflow is not
 * a no-op. It is a SCROLLPORT, and `position: sticky` inside it pins to
 * something that never moves.
 *
 * 🔴 THE MEASURED DEFECT. `SessionScreen`'s header carried
 * `position: sticky; top: 0` and had **never once been sticky**. Its wrapper was
 * `min-height: 100%; overflow-y: auto` inside `PullToRefresh` — the real
 * scroller — so it could not overflow and could not scroll. Reproduced in a
 * browser: after an 800px scroll the header sat at **-800px**. The founder asked
 * for a pinned header on that screen, and the code already claimed to have one.
 *
 * ⚠️ THE IDIOM WAS COPIED MINUS THE DECLARATION THAT MADE IT WORK. The three
 * deliberate own-scroll-context screens in `DashboardClient` all use
 * **`height: 100dvh`** and genuinely scroll. Four others used
 * **`min-height: 100%`**. Nothing distinguished them by name.
 *
 * ⚠️ AND IT IS SILENT IN BOTH DIRECTIONS: nothing throws, nothing logs, the
 * header renders perfectly, and the only symptom is that it scrolls away — which
 * is what a non-sticky header does anyway. There is no failing state to notice.
 */
const ROOT = path.resolve(__dirname, '../..')

const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
    return p.endsWith('.tsx') ? [p] : []
  })

// Population walked, never listed — the class that produced six short checks
// this week. `app/` and `components/` in full.
const FILES = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]

describe('STICKY-SCROLLER-01', () => {
  it('🔴 no element declares a scrollport it can never fill', () => {
    // Bound the region to ONE style object: `{ ... }`, no nesting. A file-wide
    // grep would pair a `min-height` on one element with an `overflow` on
    // another — this repo has already shipped a regex that edited by pattern
    // rather than by position and mangled 32 unrelated elements.
    const offenders: string[] = []
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8')
      for (const m of Array.from(src.matchAll(/style=\{\{([^{}]*)\}\}/g))) {
        const obj = m[1]
        const declaresScroll = /overflowY:\s*'(auto|scroll)'/.test(obj)
        if (!declaresScroll) continue
        // A real scroller is HEIGHT-CONSTRAINED. `min-height` is not a height.
        const constrained = /(^|[^-\w])height:\s*'/.test(obj) || /maxHeight:\s*'/.test(obj) || /\bflex:\s*1\b/.test(obj)
        if (!constrained) {
          offenders.push(`${path.relative(ROOT, f)}:${src.slice(0, m.index).split('\n').length} — ${obj.trim().slice(0, 90)}`)
        }
      }
    }
    expect(offenders, `an unconstrained \`overflowY: auto\` is a scrollport that cannot scroll, and it CAPTURES position:sticky:\n${offenders.join('\n')}`)
      .toEqual([])
  })

  it('🔴 nothing reserves space for the nav twice', () => {
    // `PullToRefresh` is handed `bottomNavH + 16` and is the single owner of the
    // nav reserve. The session and post-run screens each added a hardcoded
    // `120px` for the same nav — **210px of dead ground**, measured in a browser,
    // and the founder's words were "a lot of empty space".
    //
    // ⚠️ Same class as the 46pt nav gap (`calc(lift + inset)`) and the CTA dock
    // that floated 167px above its card: a value the owner already accounts for,
    // added a second time by a call site that did not know.
    const offenders: string[] = []
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8')
      for (const m of Array.from(src.matchAll(/style=\{\{([^{}]*)\}\}/g))) {
        const obj = m[1]
        if (!/minHeight:\s*'100%'/.test(obj)) continue
        const pb = obj.match(/paddingBottom:\s*'(\d+)px'/)
        if (pb && Number(pb[1]) >= 60) {
          offenders.push(`${path.relative(ROOT, f)}:${src.slice(0, m.index).split('\n').length} — paddingBottom ${pb[1]}px on a full-height screen; PullToRefresh already reserves bottomNavH + 16`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('🔴 the shared scroll-state owner requires a scroller that actually scrolls', () => {
    // The arm that holds the FIX shut, not just the symptom. `useScrolledContainer`
    // shipped with the spec-shaped walk (nearest `overflow-y: auto`) and worked on
    // Plan and Coach BY LUCK — neither has an inert wrapper, and MeScreen does.
    const hook = fs.readFileSync(path.join(ROOT, 'lib/ui/useScrolledContainer.ts'), 'utf8')
    expect(hook, 'declaring `auto` is not scrolling — the walk must check it overflows')
      .toMatch(/scrollHeight\s*>\s*node\.clientHeight/)
  })
})
