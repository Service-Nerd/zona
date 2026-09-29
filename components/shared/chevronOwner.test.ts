import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { Chevron } from './Chevron'

// CHEVRON-OWNER-01 (2026-09-28) — the affordance has ONE home, and it can travel.
//
// 🔴 THIS IS THE THIRD TIME. `ACTION-ROW-01` exists because the chevron was a local `const`
// in the Me screen and the Plan screen could not reach it, so its tile shipped with no
// affordance at all. Its own comment: *"A PATTERN THAT IS A LOCAL VARIABLE CANNOT TRAVEL."*
//
// ⚠️ THE REMEDY MOVED IT INTO `ActionRow.tsx` — AS A LOCAL `const` INSIDE `ActionRow.tsx`.
// One level up, same trap. So when `DashboardClient`'s compact `row()` helper gained a tap
// target it could not reach the chevron either, and rendered a `<button>` styled
// identically to the static `<div>`. Five rows shipped like that, `Benchmark` included.
//
// The founder caught it both times, in almost the same words. This file is what makes the
// third time fail loudly instead.

// 🔴 GATE-GLOB-SHORT-01 (2026-09-29): `git ls-files "app/**/*.tsx"` returns 129 files;
// the truth is 134. git's `**/` requires at least one directory level, so every file
// sitting DIRECTLY under `app/` or `components/` was invisible to this gate — including
// `app/page.tsx`, the marketing homepage. Measured: 0 additional violations today, so the
// blind spot was LATENT, not costly. Fixed in all five gates that shared it rather than
// only the one that found it.
const tracked = (): string[] =>
  execSync('git ls-files', { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(f => /^(app|components)\/.*\.tsx$/.test(f))
    .filter(f => !f.includes('.test.'))

const OWNER = 'components/shared/Chevron.tsx'

describe('CHEVRON-OWNER-01 — one chevron, reachable', () => {
  it('renders a chevron path', () => {
    const m = html(React.createElement(Chevron))
    expect(m).toMatch(/<svg/)
    expect(m).toContain('M6 3L11 8L6 13')
  })

  it('is decorative — it never announces itself', () => {
    expect(html(React.createElement(Chevron))).toContain('aria-hidden="true"')
  })

  // 🔴 THE ARM THAT STOPS A FOURTH INSTANCE. A second copy of the path is a second
  // affordance that will drift, and — worse — a copy that some other surface cannot reach,
  // which is the failure twice over.
  it('no surface re-declares the chevron path', () => {
    const offenders = tracked()
      .filter(f => f !== OWNER)
      .filter(f => /M6 3L11 8L6 13/.test(readFileSync(f, 'utf8')))
    expect(offenders, 'import { Chevron } from shared/Chevron instead of redrawing it').toEqual([])
  })

  // ⚠️ AND THE ARM THAT MATTERS MORE, because the one above only catches a COPY. This
  // catches the original failure: a control that is tappable and looks static.
  it('every tappable row in the Me summary carries the affordance', () => {
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    const at = src.indexOf('const row = (label: string')
    expect(at, 'the row() helper moved — re-anchor this arm').toBeGreaterThan(-1)
    // Bound the region: the helper only, not the whole 12,000-line file.
    const helper = src.slice(at, src.indexOf('\n          }\n', at))
    expect(helper, 'row() renders a <button> when given onTap').toContain('onTap ? (')
    expect(helper, 'a tappable row must be distinguishable from a static one')
      .toContain('<Chevron />')
  })
})
