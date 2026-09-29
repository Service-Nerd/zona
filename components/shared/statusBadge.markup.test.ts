import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { StatusBadge, MICRO_LABEL } from './StatusBadge'
import { TIER_BADGE, tierBadgeFor } from '@/lib/tierBadge'

// TIER-BADGE-01 (Design Board, 2026-09-29) — the tier is a STATUS, not prose, and it is
// not a rank.
//
// 🔴 THE DEFECT: Me rendered three strings for five states, so a charity-comped runner, an
// admin and a paying subscriber all read "Pro". 500 Make-A-Wish codes ship this week.
//
// ⛔ SILVANTO'S BINDING AMENDMENT: the badge ships at `ui-patterns.md`'s documented micro-
// label (10px / 700 / uppercase / 0.08em) or not at all. Measured at the sitting: 36
// distinct combinations across 171 uses, at most 64 conforming. A shared component that
// codifies a 37th variant is "the version that spreads".

const render = (p: Partial<React.ComponentProps<typeof StatusBadge>> = {}) =>
  html(React.createElement(StatusBadge, { label: 'PRO', ...p }))

describe('TIER-BADGE-01 — the badge IS the documented micro-label', () => {
  it('renders at 10px / 700 / 0.08em / uppercase', () => {
    const m = render()
    expect(m).toContain('font-size:10px')
    expect(m).toContain('font-weight:700')
    expect(m).toContain('letter-spacing:0.08em')
    expect(m).toContain('text-transform:uppercase')
  })

  // 🔴 THE ARM THAT ENFORCES THE AMENDMENT. The constant is the contract: if someone
  // "tidies" it to 9px or 0.06em, this is the thing that says no.
  it('the constant matches ui-patterns.md, which is the rule Silvanto named', () => {
    expect(MICRO_LABEL.fontSize).toBe('10px')
    expect(MICRO_LABEL.fontWeight).toBe(700)
    expect(MICRO_LABEL.letterSpacing).toBe('0.08em')
    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    expect(doc, 'the documented Section label changed — re-ratify before changing the constant')
      .toContain('10px uppercase 0.08em')
  })

  // ⚠️ "Type accent, not flood" is STANDING. Colour lives on the text, never in a fill.
  it('has no background fill', () => {
    for (const tone of ['held', 'none'] as const) {
      expect(render({ tone }), `tone=${tone} painted a fill`).not.toMatch(/background/)
    }
  })
})

describe('TIER-BADGE-01 — a category marker, never a rank', () => {
  // 🔴 THE RULING'S HARD CONSTRAINT. "Celebrating the peak week" (Wood, binding) forbids
  // emphasis at a high point. The board: "the moment any tier is styled UP relative to
  // another it becomes celebration and the ruling is void."
  it('every tier renders at identical size, weight and tracking', () => {
    const geo = (s: string) => (s.match(/font-size:[^;"]+|font-weight:[^;"]+|letter-spacing:[^;"]+|text-transform:[^;"]+/g) ?? []).sort()
    const shapes = Object.values(TIER_BADGE).map(b => geo(render({ label: b.label, tone: b.tone })))
    const first = JSON.stringify(shapes[0])
    for (const s of shapes) {
      expect(JSON.stringify(s), 'a tier is styled differently — that is a rank, not a category').toBe(first)
    }
  })

  it('Free is not styled down — only its colour differs', () => {
    const free = render({ label: 'FREE', tone: 'none' })
    const pro = render({ label: 'PRO', tone: 'held' })
    expect(free.replace('FREE', 'X').replace(/color:[^;"]+/, ''))
      .toBe(pro.replace('PRO', 'X').replace(/color:[^;"]+/, ''))
  })

  // ⚠️ TWO tones, never five. "Five colours on one label is a legend" — and the ruling
  // says the colour says only whether access is currently held.
  it('uses exactly two colours across all five reasons', () => {
    const colours = new Set(Object.values(TIER_BADGE).map(b =>
      render({ label: b.label, tone: b.tone }).match(/color:([^;"]+)/)?.[1]))
    expect(colours.size, `expected 2 colours, got ${colours.size}`).toBe(2)
  })

  it('neither colour is a reserved token', () => {
    const m = Object.values(TIER_BADGE).map(b => render({ label: b.label, tone: b.tone })).join(' ')
    // --warn is coaching-only and --danger errors-only (CLAUDE.md).
    expect(m).not.toContain('--warn')
    expect(m).not.toContain('--danger')
  })
})

describe('TIER-BADGE-01 — five states, all distinct', () => {
  // 🔴 THE WHOLE POINT. grant === subscription is the live defect: 500 comped runners.
  it('every TierReason has its own word', () => {
    const labels = Object.values(TIER_BADGE).map(b => b.label)
    expect(new Set(labels).size, `labels collide: ${labels.join(', ')}`).toBe(labels.length)
  })

  it('a gifted place does not read as a subscription', () => {
    expect(TIER_BADGE.grant.label).not.toBe(TIER_BADGE.subscription.label)
  })

  // ⚠️ A DEFAULT WOULD BE A LIE. `tierReason` is null until resolveTier returns, and
  // defaulting to `none` flashes "FREE" at a paying subscriber on every open.
  it('renders nothing while the tier is still resolving', () => {
    expect(tierBadgeFor(null)).toBeNull()
    expect(tierBadgeFor(undefined)).toBeNull()
  })

  // ⚠️ POPULATION DERIVED FROM THE TYPE, not hand-listed. A new TierReason must fail here
  // rather than silently falling back to "Free" — telling someone with access they have none.
  it('covers every reason the resolver can return', () => {
    const src = readFileSync('lib/trial.ts', 'utf8')
    const decl = src.match(/export type TierReason = ([^\n]+)/)?.[1]
    expect(decl, 'TierReason declaration moved — re-anchor this arm').toBeTruthy()
    const re = /'([a-z]+)'/g
    const reasons: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(decl!)) !== null) reasons.push(m[1])
    expect(reasons.length).toBeGreaterThanOrEqual(5)
    for (const r of reasons) {
      expect(Object.keys(TIER_BADGE), `TierReason '${r}' has no badge`).toContain(r)
    }
  })
})

describe('TIER-BADGE-01 — it absorbed the divergent copies', () => {
  // 🔴 TWO hand-rolled status badges existed and had already drifted: the ledger's
  // `pending` (10/600/0.06em) and CardSelect's `lockLabel` (9/700/0.08em). That is the
  // chevron shape — a pattern held as a local constant cannot travel.
  const tracked = () => execSync('git ls-files "app/**/*.tsx" "components/**/*.tsx"', { encoding: 'utf8' })
    .split('\n').filter(Boolean).filter(f => !f.includes('.test.'))

  /**
   * ⚠️ A DECLARED REGISTER, NOT A NARROWED REGEX. The first run of the arm below found
   * THREE hits and every one was real. Two are out of this ruling's scope and are named
   * here with their reason rather than quietly excluded — narrowing a check until it
   * passes is how a green tick comes to mean nothing.
   *
   * The line drawn, and it is the one that decides what `StatusBadge` is for:
   * **a BADGE reports a state the runner is IN** (pro, gifted, locked, pending);
   * **an EYEBROW labels a REGION** (`This week`, `Mon · Week 3`). Different jobs.
   */
  const DECLARED: { file: string; why: string }[] = [
    { file: 'components/marketing/PhoneFrame.tsx',
      why: 'marketing mockup of iOS chrome at mockup scale — already exempted with the same reason in lib/marketing/typeScale.test.ts' },
    // ✅ `app/dashboard/DashboardClient.tsx` WAS declared here and is now CLEAN — its two
    //    stray eyebrows were converted by MICRO-LABEL-WAVE-1a. The stale arm below caught
    //    it within hours of this register being written, which is exactly what it is for:
    //    a declared exemption that outlives its reason silently re-permits the thing.
  ]

  it('no surface re-rolls one of the two shapes this component replaced', () => {
    const declared = new Set(DECLARED.map(d => d.file))
    const offenders: string[] = []
    for (const f of tracked()) {
      if (declared.has(f)) continue
      const s = readFileSync(f, 'utf8')
      if (/fontSize: '9px', fontWeight: 700, color: 'var\(--moss\)', letterSpacing: '0\.08em'/.test(s)) offenders.push(`${f} (lockLabel shape)`)
      if (/fontSize: '10px', fontWeight: 600,[\s\S]{0,80}letterSpacing: '0\.06em'/.test(s)) offenders.push(`${f} (pending shape)`)
    }
    expect(offenders, 'a divergent status badge came back:\n' + offenders.join('\n')).toEqual([])
  })

  // 🔴 AND THE ARM THAT STOPS THE REGISTER ROTTING. A declared exemption that has since
  // been cleaned must be REMOVED, or the register silently permits re-adding it.
  it('every declared exemption is still needed', () => {
    const stale = DECLARED.filter(d => {
      const s = readFileSync(d.file, 'utf8')
      return !/fontSize: '9px', fontWeight: 700, color: 'var\(--moss\)', letterSpacing: '0\.08em'/.test(s)
          && !/fontSize: '(10|11)px', fontWeight: 600,[\s\S]{0,90}letterSpacing: '0\.0[68]em'/.test(s)
    }).map(d => `${d.file} is clean now — drop it from DECLARED`)
    expect(stale, 'the exemption register is stale').toEqual([])
  })

  it('both former call sites now use the component', () => {
    expect(readFileSync('components/shared/CardSelect.tsx', 'utf8')).toMatch(/<StatusBadge\b/)
    expect(readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')).toMatch(/<StatusBadge label="pending"/)
  })
})
