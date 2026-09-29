import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dashboardSource } from '@/lib/testing/dashboardSources'

// PTR-SUBPAGE-01 — pull-to-refresh belongs to the four nav roots, not to a door off one.
//
// 🔴 `screen` IS NOT THE ONLY NAVIGATION AXIS, AND THE RULE ONLY KNEW ABOUT ONE. The hub
// gated the gesture on `screen === 'today' | 'plan' | 'coach' | 'me'`, with a comment saying
// detail screens must not have it because they own no refreshable data. Correct when
// written. `ME-DOORS-01` then introduced a SECOND axis: a Me sub-page is an `activeSection`
// inside `MeScreen`, and `screen` stays `'me'` throughout. All EIGHT doors inherited it.
//
// 👤 The founder named four in one message: *"Something broken and common questions is still
// pull down to refresh, so is plan history and plan adjustments."*
//
// ⚠️ THE RULE DID NOT CHANGE; THE SET OF SCREENS DID. Same shape as the ScreenHeader
// default that was only ever overridden by the screens it could not hurt.

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

describe('PTR-SUBPAGE-01 — the gesture does not leak into Me’s doors', () => {
  it('🔴 the gate reads the open door, not just the screen', () => {
    const src = code(dashboardSource())
    const i = src.indexOf('const pullToRefreshEnabled')
    expect(i, 'the gate moved — re-anchor this').toBeGreaterThan(-1)
    // Bound by the statement, never a byte budget: to the end of that declaration.
    const end = src.indexOf('\n\n', i)
    const gate = src.slice(i, end > i ? end : i + 400)
    expect(gate, 'a bare `screen === \'me\'` re-enables the gesture on all eight doors')
      .not.toMatch(/screen === 'me'\s*\)/)
    expect(gate, 'the gate must consider which door is open')
      .toContain("meActiveSection === 'main'")
  })

  it('🔴 MeScreen actually reports its door upward', () => {
    // A gate reading state nothing writes is the inert half of this defect.
    const src = code(dashboardSource())
    expect(src, 'the hub never receives the door').toContain('onActiveSectionChange={setMeActiveSection}')
    const me = code(readFileSync('components/dashboard/MeScreen.tsx', 'utf8'))
    expect(me, 'MeScreen declares the prop but never fires it')
      .toContain('onActiveSectionChange?.(activeSection)')
  })

  it('🔴 the reporter sits ABOVE every early return (React #310 is recorded here)', () => {
    // MeScreen returns early for each door, so a hook below one is conditional. This app
    // has already shipped that crash once.
    const me = readFileSync('components/dashboard/MeScreen.tsx', 'utf8')
    const fn = me.indexOf('function MeScreen({')
    const effect = me.indexOf('onActiveSectionChange?.(activeSection)', fn)
    const firstReturn = me.indexOf('if (activeSection ===', fn)
    expect(effect, 'the reporter is missing').toBeGreaterThan(-1)
    expect(firstReturn).toBeGreaterThan(-1)
    expect(effect, 'the reporter sits below an early return — conditional hook')
      .toBeLessThan(firstReturn)
  })

  it('the four nav roots keep the gesture', () => {
    const src = code(dashboardSource())
    const i = src.indexOf('const pullToRefreshEnabled')
    const end = src.indexOf('\n\n', i)
    const gate = src.slice(i, end > i ? end : i + 400)
    for (const s of ["'today'", "'plan'", "'coach'", "'me'"]) {
      expect(gate, `${s} lost the pull gesture`).toContain(s)
    }
  })
})
