// BUTTON-INLINE-OVERRIDE-01 — a Button's own properties are not set at the call
// site (Design Board, founder device review 2026-09-27).
//
// **Founder, standing ask: "Lets ensure we are using shared where we can."**
//
// 📐 MEASURED THE DAY THIS SHIPPED: **35 of 143 `<Button>` instances (24.5%)
// overrode the component's own properties inline** — `padding` ×32,
// `borderRadius` ×25, `fontSize` ×23, and **`background` ×16, which is the one
// property the variant exists to own.** The sharpest single case was the
// wizard's Continue, a hybrid nothing in the system produces:
//
//   | | `.btn--regular` | wizard Continue |
//   |---|---|---|
//   | padding | `15px 20px` | `15px` |
//   | radius | `--radius-lg` | **`--radius-md`** — that is `compact`'s |
//   | font-size | `14px` | **`15px`** — exists nowhere in the scale |
//
// That is what "does not have our standardised CTAs" looks like in source.
//
// ── A DEBT REGISTER, NOT A SWEEP ──────────────────────────────────────────
// Converting 35 call sites in one pass would be a large visible change nobody
// has looked at, and several are legitimately load-bearing. So this follows the
// pattern this repo already uses (`SWEEP-BASELINE-01`, the liveness baseline):
// **known debt is recorded and frozen; anything NEW fails the build.**
//
// ⚠️ AND THE HONEST LIMIT, because CLAUDE.md requires it: **a declared reason is
// not a fixed problem.** This register makes the debt visible and stops it
// growing. It does not shrink it, and nothing here schedules that. The count
// below is the number to watch going down.
//
// ⚠️ `letterSpacing` / `textTransform` are NOT flagged. The uppercase-with-
// tracking CTA is a real treatment used deliberately, and `.btn`'s own header
// records that forcing sentence case on every button was measured and wrong.
// Flagging them would fire on correct work, and a gate that cries wolf gets
// switched off — recorded twice in this repo as equal to having no gate.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

/** The properties `Button` + `globals.css` own. */
const OWNED = ['background', 'borderRadius', 'fontSize', 'padding', 'minHeight', 'height'] as const

/**
 * 🔴 FROZEN 2026-09-27. Lower a number when you convert a call site; never
 * raise one. A new entry here needs a reason in the commit message.
 */
const BASELINE: Record<string, number> = {
  // ⚠️ ADDED 2026-09-27, hours after this register was frozen, and the reason is
  // required by the rule above. `BackButton`'s captioned form is ONE button
  // containing the shared circle span plus its label, so it must zero
  // `.btn--compact`'s `padding: 12px 16px` — that padding around a 44px circle
  // renders a 68px control where every other back arrow in the app is 44px.
  // 🥇 The gate caught its own author within hours of shipping, which is the
  // most useful thing it has done so far.
  'components/shared/BackButton.tsx': 1,
  'app/auth/login/page.tsx': 1,
  'app/dashboard/BenchmarkUpdateScreen.tsx': 1,
  // 🔴 21 → 15 + 6, AND THE TOTAL IS CONSERVED (DASHBOARD-SCREEN-EXTRACT-02).
  // Six screens left DashboardClient carrying their inline overrides with them:
  // AppleHealthConnectionRow 1 + CoachTeaser 2 + HRZonesSection 1 + ManualRunModal 2
  // = 6, and the hub falls 21 → 15. 15 + 6 = 21.
  //
  // ⚠️ THE ARITHMETIC IS THE POINT. A register keyed by FILE cannot tell a
  // relocation from new debt, so the only honest way to re-baseline it after a move
  // is to show the total is unchanged. If these numbers had summed to 22, one of
  // them would be a real regression hiding inside a refactor.
  // DASHBOARD-SCREEN-EXTRACT-03: 15 → 12 + 3 (MeScreen), and 12 + 3 = 15.
  // Second conserved redistribution in two phases. The arithmetic is the only thing
  // that distinguishes a relocation from new debt in a file-keyed register.
  'app/dashboard/DashboardClient.tsx': 12,
  'components/dashboard/MeScreen.tsx': 3,
  'components/dashboard/AppleHealthConnectionRow.tsx': 1,
  'components/dashboard/CoachTeaser.tsx': 2,
  'components/dashboard/HRZonesSection.tsx': 1,
  'components/dashboard/ManualRunModal.tsx': 2,
  // CHARITY-CODE-CONTROL-01 (2026-09-28): 4 -> 3. The step-one redeem door was deleted
  // and its replacement is `RedeemCodeLink`, which carries its own treatment, so one
  // hand-styled inline Button left this file for good.
  'app/dashboard/GeneratePlanScreen.tsx': 3,
  'app/dashboard/RedeemCodeScreen.tsx': 2,
  'components/shared/NotificationBell.tsx': 1,
  'components/shared/PendingAdjustmentBanner.tsx': 1,
  'components/training/PostRaceReshapeCard.tsx': 1,
  'components/training/RaceResultSheet.tsx': 1,
  'components/training/ReflectionInput.tsx': 1,
}

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out.filter(f => !f.includes('preview'))
}

export function countOverrides(src: string): number {
  let n = 0
  for (const m of Array.from(src.matchAll(/<Button\b(?:(?!<Button)[\s\S])*?>/g))) {
    const style = m[0].match(/(?:^|\s)style=\{\{([\s\S]*?)\}\}/)?.[1]
    if (!style) continue
    if (OWNED.some(p => new RegExp(`(^|[\\s,{])${p}\\s*:`).test(style))) n++
  }
  return n
}

describe('BUTTON-INLINE-OVERRIDE-01', () => {
  it('🔴 no file gains a NEW inline override of a Button-owned property', () => {
    const grew: string[] = []
    for (const rel of tsxFiles()) {
      const n = countOverrides(strip(fs.readFileSync(path.join(ROOT, rel), 'utf8')))
      const allowed = BASELINE[rel] ?? 0
      if (n > allowed) {
        grew.push(`${rel}: ${n} inline overrides, baseline ${allowed}. ` +
          `A Button's padding/radius/font-size/background belong to its variant and size ` +
          `(globals.css .btn--*). Add a variant or size rather than overriding at the call site.`)
      }
    }
    expect(grew, grew.join('\n')).toEqual([])
  })

  it('🔴 the register SHRINKS or holds — a converted file must lower its number', () => {
    // Without this arm the baseline rots upward invisibly: someone converts a
    // call site, the count drops, and the slot silently becomes headroom for a
    // future violation. Same failure as a stale debt register anywhere else.
    const stale: string[] = []
    for (const [rel, allowed] of Object.entries(BASELINE)) {
      const full = path.join(ROOT, rel)
      if (!fs.existsSync(full)) { stale.push(`${rel}: baselined but gone — drop the entry`); continue }
      const n = countOverrides(strip(fs.readFileSync(full, 'utf8')))
      if (n < allowed) stale.push(`${rel}: now ${n}, baseline still ${allowed} — lower it to ${n}`)
    }
    expect(stale, stale.join('\n')).toEqual([])
  })

  it('🔴 the detector actually fires on the wizard-Continue shape', () => {
    // Falsified against the real case, not an invented one.
    expect(countOverrides(
      `<Button onClick={goNext} fullWidth style={{ padding: '15px', borderRadius: 'var(--radius-md)', fontSize: '15px' }}>Continue</Button>`
    )).toBe(1)
  })

  it('does NOT fire on layout-only style, which call sites legitimately own', () => {
    expect(countOverrides(
      `<Button variant="primary" fullWidth style={{ marginTop: 'var(--space-3)', flex: 1 }}>Log this session</Button>`
    )).toBe(0)
  })

  it('does NOT fire on the deliberate uppercase CTA treatment', () => {
    expect(countOverrides(
      `<Button variant="primary" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Match a run</Button>`
    )).toBe(0)
  })
})
