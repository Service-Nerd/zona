// ACT-FREE-TEASE-01 — the free post-run card as RENDERED. SLT + Design Board 2026-11-12.
//
// ⚠️ TWO POPULATIONS, DELIBERATELY. The component arms render it; the last block reads
// `DashboardClient.tsx` as SOURCE, because `PostRunScreen` is a 700-line function inside a
// 14k-line client component that needs auth, Supabase and a browser, and `vitest.config.ts` is
// `environment: 'node'`. A source-shaped arm is weaker than a render and is declared as such —
// what it can still prove is the thing that was actually wrong: that the branch exists at all.

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import FreeRunReadCard from './FreeRunRead'
import { freeRunRead } from '@/lib/coaching/freeRunRead'
import { BRAND } from '@/lib/brand'
import type { RunEffortRow } from '@/lib/coaching/runEffort'

const row = (z1: number, z2: number, z3: number, z45: number): RunEffortRow =>
  ({ hr_pct_z1: z1, hr_pct_z2: z2, hr_pct_z3: z3, hr_pct_z4_5: z45 })
const GREY  = row(3, 10, 64, 23)
const NO_HR = row(null as never, null as never, null as never, null as never)

const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&#x27;|&apos;/g, "'").replace(/&#x2019;/g, '’').replace(/\s+/g, ' ').trim()
const card = (p: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement(FreeRunReadCard, { onUpgrade: () => {}, ...p } as never))

describe('FreeRunReadCard — all five states', () => {
  it('absent draws nothing at all', () => {
    expect(card({ read: freeRunRead(null) })).toBe('')
  })

  it('loading is a skeleton and never a guessed number', () => {
    const h = card({ read: freeRunRead(null), loading: true })
    expect(h).toContain('data-free-run-read="loading"')
    expect(text(h)).toBe('This run')
    // ⚠️ BOUND TO THE RENDERED TEXT, NOT THE MARKUP. The first cut asserted the HTML held no
    // '%' and went red on `width:32%` — a skeleton bar's CSS, not a number on screen. "Bound
    // the region, never grep the file", in the test written by the person who keeps recording it.
    expect(text(h)).not.toMatch(/\d/)
  })

  it('🔑 loading OUTRANKS absent, so the card cannot pop in after a blank beat', () => {
    // `freeRunRead(null)` is `absent` both for "the read has not returned" and "no run linked".
    // The caller tells them apart; this asserts the component honours the order.
    expect(card({ read: freeRunRead(null), loading: true })).not.toBe('')
  })

  it('measured leads with the number, then the fact, then what is withheld, then one link', () => {
    const h = card({ read: freeRunRead(GREY) })
    const t = text(h)
    expect(h).toContain('data-free-run-read="measured"')
    expect(t).toContain('64%')
    expect(t).toContain('of this run was in Zone 3.')
    expect(t).toContain(`${BRAND.coachName}’s read turns this into one thing to do next. That part is Pro.`)
    expect(t).toContain('Unlock the read')
    // Metric pair, the documented way round: value above label (`ui-patterns.md`).
    expect(t.indexOf('64%')).toBeLessThan(t.indexOf('of this run'))
    // One tap target, not two.
    expect((h.match(/<button/g) ?? []).length).toBe(1)
  })

  it('🔴 no heart rate offers NOTHING TO BUY — the honesty arm', () => {
    // An iPhone-only runner cannot buy heart rate from us (ADR-011 §5). A CTA here would be
    // selling something that could not help, to the runner least able to tell.
    const h = card({ read: freeRunRead(NO_HR) })
    expect(h).toContain('data-free-run-read="no_hr"')
    expect(h).not.toContain('<button')
    expect(text(h)).toContain('No heart rate on this one')
    expect(text(h)).not.toContain('Unlock')
  })
})

describe('🔴 the rail is NEUTRAL on every state, and that is the ruling not the styling', () => {
  // P-01's pair draws moss for "held the zone" and amber for "cooked it". Hutchinson's SLT
  // condition withholds the verdict, and a moss-or-amber rail IS the verdict in colour — the one
  // channel a copy review would never check. A later "make it consistent with P-01" tidy-up is
  // exactly what this exists to stop.
  for (const [name, read] of [['measured', freeRunRead(GREY)], ['no_hr', freeRunRead(NO_HR)]] as const) {
    it(`${name} paints no P-01 colour`, () => {
      const h = card({ read })
      expect(h).not.toContain('var(--moss)')
      expect(h).not.toContain('var(--warn)')
      // ⚠️ AND NO RAIL AT ALL. A neutral rail was the first answer and it rendered INVISIBLE —
      // `var(--line)` on a card bordered in `var(--line)`. A device carrying nothing is
      // decoration; the absence of the rail is what reads as "no verdict" beside the cards that
      // have one. Asserted by the absence of the absolutely-positioned span, not by its colour.
      expect(h).not.toContain('position:absolute')
    })
  }

  it('the one moss in the card is the TEXT LINK, which is a control and not a verdict', () => {
    const h = card({ read: freeRunRead(GREY) })
    expect(h).toContain('var(--moss-strong)')
  })
})

describe('🔴 the branch exists on the screen that had nothing (source-shaped, declared)', () => {
  const CLIENT = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')

  it('PostRunScreen renders it for a runner WITHOUT paid access', () => {
    // The defect was that every read branch on that screen was `hasPaidAccess &&`, so the screen
    // ended. This asserts the complement is present and reaches the card.
    // ⚠️ The comment between the guard and the element is the HR-pending note, added by code
    // review; the arm reads the guard and the element, not the gap between them.
    expect(CLIENT).toMatch(/\{!hasPaidAccess && \([\s\S]{0,900}?<FreeRunReadCard/)
  })

  it('it is fed the OWNER, never a second copy of the rule', () => {
    expect(CLIENT).toMatch(/read=\{hrPendingState \? freeRunRead\(null\) : freeRunRead\(zoneRow \?\? null\)\}/)
    // 🔴 AND IT MUST GATE ON `hrPendingState` LIKE EVERY PAID BRANCH DOES. Without it an Apple
    // Watch run whose HR has not landed yet tells the runner there is no heart rate on it, to
    // someone wearing a watch, and never corrects itself.
    expect(CLIENT).toMatch(/loading=\{zoneRow === undefined \|\| !!hrPendingState\}/)
    // No hand-written zone arithmetic at the call site.
    expect(CLIENT).not.toMatch(/hr_pct_z1 \?\? 0\) \+ \(\w*\.?hr_pct_z2/)
  })

  it('its paywall door is distinctly attributed (OPS-FUNNEL-02)', () => {
    expect(CLIENT).toContain("openUpgrade('post_run')")
  })

  it('🔴 hydration RE-RUNS once link-activity has written the row', () => {
    // Without this the staged path leaves the card permanently empty for a FREE runner: the
    // single-shot hydration effect runs before the link lands, resolves `zoneRow` to null, and
    // none of its deps changes afterwards. The paid path hides it behind an analysis poll;
    // nothing polls for a free runner. Found by code review.
    expect(CLIENT).toMatch(/\bsetLinkSettledAt\(Date\.now\(\)\)/)
    expect(CLIENT, 'the hydration effect must depend on it or the re-run never happens')
      .toMatch(/\}, \[sessionDay, weekN, supabase, linkedActivity, linkSettledAt\]\)/)
  })

  it('🔑 the header does not claim a call site that does not exist', () => {
    // It claimed `SessionScreen`'s reflect view *"which is why the markup gate renders both"* —
    // and SessionScreen has no call site; it keeps `LockedCoachingPreview`. A header describing
    // the build I intended rather than the one I shipped.
    const SRC = readFileSync('components/shared/FreeRunRead.tsx', 'utf8')
    const header = SRC.slice(0, SRC.indexOf('import '))
    expect(header).toMatch(/ONE RUNNER-FACING CALL SITE, NOT TWO/)
    const sites = (CLIENT.match(/<FreeRunReadCard/g) ?? []).length
    expect(sites, 'DashboardClient should mount it exactly once').toBe(1)
  })

  it('and the zone columns ride the select that was ALREADY there — no extra round trip', () => {
    const selects = Array.from(CLIENT.matchAll(/\.select\('([^']*hr_pct_z1[^']*)'\)/g)).map(m => m[1]!)
    expect(selects.length).toBeGreaterThan(0)
    const postRun = selects.find(s => s.includes('reported_distance_m'))
    expect(postRun, 'the post-run hydration select should carry the split').toBeTruthy()
    expect(postRun).toContain('hr_pct_z4_5')
  })
})

describe('LockedCoachingPreview no longer tells a linked runner we have no runs', () => {
  const CLIENT = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  const SRC    = readFileSync('components/dashboard/LockedCoachingPreview.tsx', 'utf8')

  it('the sentence branches on whether a run is linked', () => {
    expect(SRC).toMatch(/\bhasLinkedRun\b/)
    expect(SRC).toContain('He needs your runs first')
    expect(SRC).toMatch(/doesn’t read your runs on the free plan/)
  })

  it('and the screen that knows passes it', () => {
    expect(CLIENT).toMatch(/<LockedCoachingPreview[^>]*hasLinkedRun=\{!!linkedActivityId\}/)
  })

  it('the coach name comes from BRAND, not typed in', () => {
    expect(SRC).toContain('BRAND.coachName')
    // Bound to the rendered sentences, not the file: the comments above them discuss "Kit".
    const sentences = Array.from(SRC.matchAll(/^\s+[?:] `(.+)`\}?$/gm)).map(m => m[1]!)
    expect(sentences.length).toBe(2)
    for (const s of sentences) expect(s, s).not.toMatch(/\bKit\b/)
  })
})

// ── ACT-FIRSTRUN-01 — the sample read in onboarding ─────────────────────────
describe('the example mode shows somebody else’s run, and says so first', () => {
  const EX = { eyebrow: 'An example, not your runs', next: 'what happens next' }

  it('🔴 the declaration REPLACES the eyebrow, so it is the first thing read', () => {
    const t = text(card({ read: freeRunRead(GREY), example: EX }))
    expect(t.startsWith('An example, not your runs')).toBe(true)
    expect(t).not.toContain('This run')
  })

  it('🔴 and it carries NO paywall link — there is nothing locked in a full-access trial', () => {
    const h = card({ read: freeRunRead(GREY), example: EX })
    expect(h).not.toContain('<button')
    expect(text(h)).not.toContain('Unlock the read')
    // The lock sentence is replaced, not merely hidden: a runner mid-trial is not being sold to.
    expect(text(h)).not.toContain('That part is Pro')
    expect(text(h)).toContain('what happens next')
  })

  it('the number and the sentence are the real ones, from the real owner', () => {
    const t = text(card({ read: freeRunRead(GREY), example: EX }))
    expect(t).toContain('64%')
    expect(t).toContain('of this run was in Zone 3.')
  })

  it('without the prop it is the runner’s own card again — the default cannot leak', () => {
    const t = text(card({ read: freeRunRead(GREY) }))
    expect(t.startsWith('This run')).toBe(true)
    expect(t).toContain('That part is Pro')
  })
})

describe('🔴 onboarding renders it from the SHARED demo runner, not a copy', () => {
  const SRC = readFileSync('components/dashboard/OrientationScreen.tsx', 'utf8')
  const DEMO = readFileSync('lib/marketing/demoSurfaces.ts', 'utf8')

  it('OrientationScreen mounts the real card', () => {
    expect(SRC).toContain('<FreeRunReadCard')
    expect(SRC).toContain('freeRunRead(')
  })

  it('and feeds it DEMO_FIRST_READ, which is a REFERENCE into the marketing data', () => {
    expect(SRC).toMatch(/\bDEMO_FIRST_READ\b/)
    // By reference, so the app and the website describe the same runner on the same day.
    expect(DEMO).toMatch(/export const DEMO_FIRST_READ = DEMO_EFFORT_RUNS\[0\]!/)
    // No zone percentages typed into the screen.
    const typed = SRC.match(/hr_pct_z[0-9_]+:\s*\d/g) ?? []
    expect(typed, 'a zone percentage was typed into onboarding instead of read from the owner').toEqual([])
  })

  it('🔑 the example is DECLARED, and a card without the declaration cannot render there', () => {
    expect(SRC).toMatch(/example=\{\{/)
    expect(SRC).toContain('An example, not your runs')
  })

  it('and the sample run is a GREY one, because that is the run the product exists to name', () => {
    const first = DEMO.slice(DEMO.indexOf('export const DEMO_EFFORT_RUNS'))
    const line = first.split('\n').find(l => l.includes("date: '2026-03-02'"))
    expect(line, 'the first demo run moved — DEMO_FIRST_READ now points at something else').toBeTruthy()
    expect(line).toContain("kind: 'grey'")
  })
})
