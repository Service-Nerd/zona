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
 *
 * 🔴 RESTATED 2026-10-14 — TEN NUMBERS WENT UP AND NOT ONE OF THEM IS A
 * REGRESSION. The reader above used to stop at the first `>`, which lives inside
 * `=>`, so every call site whose `style` followed an inline arrow handler counted
 * zero. Fixing it made **25 pre-existing overrides visible at once**: five files
 * understated, five with no entry at all.
 *
 * ⚠️ RAISING TEN NUMBERS IS EXACTLY WHAT LAUNDERING LOOKS LIKE, so it was
 * checked rather than asserted. The corrected reader run against the tree at the
 * FREEZE COMMIT (`4d405bc9`, 2026-09-27) totals **60**; this tree totalled **57**
 * before the Apply CTA below was paid and totals **56** after.
 * The debt is DOWN four over the period the register thought it was flat. Had
 * that comparison come back above 60, one of these numbers would be a real
 * regression hiding inside a reader fix, and the honest move would have been to
 * find it before touching a single figure here.
 *
 * ⚠️ WHAT THIS STILL DOES NOT PROVE: the register is keyed by FILE and counts
 * CALL SITES, so it cannot tell which site inside a file is which. The freeze
 * comparison is a total, not a per-site identity. A swap — one override paid and
 * a different one added in the same file — is invisible to both numbers.
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
  // 1 -> 3 (reader fix). Apple's black sign-in button plus two padding/font-size sites.
  'app/auth/login/page.tsx': 3,
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
  // DASHBOARD-SCREEN-EXTRACT-04: 12 → 5 + 4 (SessionPopupInner) + 3 (TodayScreen),
  // and 5 + 7 = 12. THIRD conserved redistribution in three phases. Across the whole
  // extraction the hub went 21 → 5 and not one override was created or removed.
  // 5 -> 10 (reader fix). The hub's remaining five were all arrow-handler sites.
  'app/dashboard/DashboardClient.tsx': 10,
  // 4 -> 12 (reader fix). THE LARGEST SINGLE BLIND SPOT: two thirds of this file's
  // overrides were invisible, every one of them behind an inline arrow handler.
  'components/dashboard/SessionPopupInner.tsx': 12,
  // 3 -> 4 (reader fix).
  'components/dashboard/TodayScreen.tsx': 3,   // 4 → 3: the recovery card's override is a plain secondary now (2026-10-18)
  // ME-BENCHMARK-DUP-01 (2026-09-29): 3 → 2. DEBT PAID, not a re-key — the duplicate
  // `Race benchmark` ghost Button was one of the three, so removing the door removed an
  // inline override with it. The stale arm is what demanded this number come down.
  // 🥇 1 → 0 on AppleHealthConnectionRow (CONNECTIONS-ROW-TWIN-01, 2026-10-07):
  // the chip's box and type moved INTO `.btn--inline-target`, where the
  // 2026-09-25 ruling put them, so the call site stopped re-declaring
  // `padding`/`fontSize`/`borderRadius` and its style prop is gone entirely.
  //
  // ⚠️ MeScreen HOLDS AT 2, AND I FIRST LOWERED IT TO 1 ON AN ASSUMPTION. Three
  // of the same properties came off the Strava Connect, but it still carries
  // `background: var(--strava)` — a NAMED partner-brand exception, not drift —
  // and the register counts a call site once however many properties it sets.
  // **Removing three of four overrides on a button moves this number by zero.**
  // The check caught the wrong figure immediately, which is the register working.
  // 2 -> 4 (reader fix). The two new ones are ghosts restating `background: none`.
  'components/dashboard/MeScreen.tsx': 4,
  'components/dashboard/AppleHealthConnectionRow.tsx': 0,
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
  // 🔴 FIVE FILES THAT HAD NO ENTRY AT ALL — allowed 0, carrying 6 between them,
  // and silent for the register's entire life. Not newly written: all five are
  // present at the freeze commit with the same counts.
  'components/shared/DayBudgetRows.tsx': 1,
  'components/shared/HrPendingStatusRow.tsx': 1,
  'components/shared/RaceTimesCard.tsx': 1,
  'components/shared/RedeemCodeLink.tsx': 1,
  'components/training/PlanCalendar.tsx': 2,
  // ✅ `components/shared/ModifyPlanSheet.tsx` is DELIBERATELY ABSENT. It was 1 at
  // the freeze and 1 until today, invisible the whole time; the founder saw it on a
  // device before this gate ever could. Paid in the same commit as the reader fix,
  // so it enters the register at 0 and must stay there.
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

/**
 * 🔴 THE TAG IS BOUNDED BY BRACE DEPTH, NOT BY THE FIRST `>` — AND IT WAS NOT
 * UNTIL 2026-10-14 (founder device review: *"buttons still don't look right in
 * terms of style and colour"*).
 *
 * The first cut matched `/<Button\b(?:(?!<Button)[\s\S])*?>/`, which stops at the
 * first `>` in the tag. **`onClick={busy ? undefined : () => …}` contains one, in
 * the arrow**, so the match ended before `style` and every such call site counted
 * ZERO. Proven by holding the markup fixed and changing only the handler: the
 * arrow form scored 0 and the identical plain-handler form scored 1.
 *
 * 📐 MEASURED: the broken reader saw **32** overrides. This one sees **57**.
 * **25 invisible, 44% of the real population** — six files with no baseline entry
 * at all, five baselined files understated.
 *
 * ⚠️ AND THE DEBT HAD NOT GROWN BEHIND IT, which is the only thing that makes
 * re-baselining honest rather than laundering. Running THIS reader against the
 * tree at the freeze commit (`4d405bc9`, 2026-09-27) totals **60** where the
 * register recorded 35; today it totals 57. The numbers below went UP because the
 * reader got better, not because the code got worse.
 *
 * ⚠️ SECOND INSTANCE OF A RECORDED CLASS. `CLAUDE.md` already carries *"a prop
 * reader stopping at the `>` in `=>`"* from 2026-10-01, in the design-guard. A
 * fixed class recurs in the next reader somebody writes: **bound the region, never
 * stop at a character that appears inside it.**
 */
export function countOverrides(src: string): number {
  let n = 0
  for (const m of Array.from(src.matchAll(/<Button\b/g))) {
    let i = m.index! + '<Button'.length
    let depth = 0
    let quote = ''
    while (i < src.length) {
      const c = src[i]
      // ⚠️ STRINGS ARE SKIPPED, AND THAT ARRIVED SECOND. The brace counter alone
      // still ended the tag on the `>` in `aria-label="next >"` — found by the
      // regression arm written for the ARROW case, which is the argument for
      // writing the sibling case rather than only the one that bit you.
      if (quote) { if (c === quote) quote = '' }
      else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
      i++
    }
    const style = src.slice(m.index!, i).match(/(?:^|\s)style=\{\{([\s\S]*)$/)?.[1]
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

  it('🔴 fires through an inline ARROW HANDLER — the `>` in `=>` is not the tag end', () => {
    // THE REGRESSION ARM. Hold the markup fixed and change only the handler. The
    // old reader scored the first of these 0 and the second 1, which is how
    // ModifyPlanSheet's Apply shipped `background: var(--moss)` (3.68:1, below AA)
    // past a gate whose baseline for that file was zero.
    const withArrow = `<Button variant="primary" fullWidth onClick={busy ? undefined : () => onApply(x)} style={{ padding: '14px', background: 'var(--moss)' }}>Apply</Button>`
    const withHandler = `<Button variant="primary" fullWidth onClick={handleApply} style={{ padding: '14px', background: 'var(--moss)' }}>Apply</Button>`
    expect(countOverrides(withArrow)).toBe(1)
    expect(countOverrides(withHandler)).toBe(1)
    expect(countOverrides(withArrow)).toBe(countOverrides(withHandler))
  })

  it('⚠️ a `>` inside a STRING prop does not end the tag either', () => {
    // The sibling of the arrow case, and the one a fix aimed only at `=>` misses.
    expect(countOverrides(
      `<Button aria-label="next >" style={{ padding: '10px' }}>Go</Button>`
    )).toBe(1)
  })

  it('two adjacent Buttons are counted separately, not swallowed as one tag', () => {
    // A depth-aware scan that ran past the first tag's close would count 1, and a
    // register that under-counts is the failure this whole file exists to stop.
    expect(countOverrides(
      `<Button style={{ padding: '4px' }}>A</Button><Button style={{ padding: '4px' }}>B</Button>`
    )).toBe(2)
  })

  it('does NOT fire on the deliberate uppercase CTA treatment', () => {
    expect(countOverrides(
      `<Button variant="primary" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Match a run</Button>`
    )).toBe(0)
  })
})
