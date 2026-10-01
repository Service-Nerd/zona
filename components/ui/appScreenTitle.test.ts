import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// SUBPAGE-TYPE-SCALE-01 — a pushed screen's title comes from the documented role.
//
// 🔴 THE RULE HAS BEEN WRITTEN DOWN THE WHOLE TIME AND NOTHING ENFORCED IT.
// `ui-patterns.md` § type scale: **Screen title — `--font-ui` / 800 / 26px**. Nine pushed
// screens diverged anyway: five at 22px in `--font-brand`, two at 28px, and two that
// HAND-COPIED the right values instead of using the owner. `typeScale.test.ts` exists and
// is **marketing-only** — the app has never had a type-scale gate, which is the whole
// reason this drifted.
//
// ⚠️ IT READS `rem` AS WELL AS `px`, AND THAT IS NOT DEFENSIVE PROGRAMMING. My own analysis
// of this defect scanned for `px` only and therefore could not see `UpgradeScreen`'s title
// at `1.75rem` — I reported the screen's ✓ GLYPH as its title instead, and told the founder
// it was "the only title rendering at weight 400". Both halves were wrong. A unit the check
// cannot read is a screen the check cannot see.

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

/** 🔴 DERIVED, NEVER LISTED — BACK-HEADER-OWNER-01, 2026-10-01.
 *
 * This was a hardcoded list of SIX files, and that is the whole reason four hand-rolled
 * titles survived it: `DashboardClient` and `MeScreen` hold five pushed surfaces between
 * them and neither was on the list. Same shape as `sectionSurfaces.test.ts` opening
 * `const HOME = 'app/page.tsx'` — **an audit is only ever as wide as its list.**
 *
 * A pushed screen is defined by what it RENDERS: a back arrow, in any of the three
 * wrappers that place one, or a `ScreenHeader` handed `onBack`. Add a pushed screen and
 * it is in scope on the way in, with nobody remembering to add it.
 */
const pushedPopulation = (): string[] =>
  execSync("git ls-files 'app/**/*.tsx' 'components/**/*.tsx'", { encoding: 'utf8' })
    .trim().split('\n')
    .filter(f => !/\.test\.tsx?$|-preview\/|sticky-probe\//.test(f))
    .filter(f => !(f in NOT_PUSHED))
    .filter(f => {
      const src = code(readFileSync(f, 'utf8'))
      return /<(BackButton|FloatingBackButton|PinnedBackHeader)\b/.test(src)
          || /<ScreenHeader[\s\S]{0,400}?onBack/.test(src)
    })

/** ⚠️ A FILE THAT PLACES A BACK ARROW AND IS NOT A PUSHED SCREEN. Each declared with its
 *  reason, and the arm below fails if one stops qualifying — a stale exemption is a lie.
 *  The first three are the primitives themselves; the last two are named in
 *  `FloatingBackButton`'s own doc and gated by `floatingBackButton.test.ts`. */
const NOT_PUSHED: Record<string, string> = {
  'components/shared/BackButton.tsx':
    'the arrow primitive itself. It has no title because it is not a screen.',
  'components/shared/FloatingBackButton.tsx':
    'the floating placement wrapper. Renders an arrow and nothing else.',
  'components/shared/PinnedBackHeader.tsx':
    'the pinned-band placement wrapper. Its title arrives through `children`.',
  'components/ui/ScreenHeader.tsx':
    'the tab-root header primitive, and the owner of the title role it renders.',
  'app/dashboard/RecalibrationTile.tsx':
    'a TILE, not a pushed screen: it owns no scroller and has no screen title.',
  'components/shared/ModifyPlanConfirm.tsx':
    'a confirm surface, not a pushed screen. Named in FloatingBackButton\'s own doc.',
}

/** ⚠️ A LINE UNDER A TITLE THAT IS NOT A SUBTITLE. The same declared-by-name discipline as
 *  `NOT_TITLES`, and it exists for the reason the sub arm's own comment gives:
 *  **consistency stops where the role changes.** */
const NOT_SUBTITLES: Record<string, string> = {
  'app/dashboard/GeneratePlanScreen.tsx:subtitle':
    'the wizard step\'s INSTRUCTION, at 14px with `lineHeight: 1.55` — the sentence the ' +
    'runner must read to answer the question in the title above it. The documented sub role ' +
    'is 12px/0.04em, which is a LABEL: it has no line-height because it is one line. ' +
    'Shrinking the only sentence telling someone what to enter, on the screen with more copy ' +
    'per step than any other, to make a type table tidy, is the regression SUBPAGE-TYPE-SCALE-01 ' +
    'already refused on `Redeem` and `Upgrade`.',
}

const PUSHED = pushedPopulation()

/** ⚠️ BIG NUMBERS ARE NOT TITLES, AND EACH ONE IS DECLARED RATHER THAN GUESSED AT.
 *
 *  🔴 The first cut of the arm below flagged all three, which is the SAME over-reach as my
 *  analysis of this defect: treat every large font as a heading and you sweep in the data
 *  the screen exists to show. I considered a heuristic — "an interpolated value is data,
 *  literal text is a title" — and rejected it, because `FaqScreen`'s title IS interpolated
 *  (`{FAQ_SUBTITLE}`), so that rule would blind the check to the exact kind of title this
 *  ship just converted. A short declared list with reasons is honest; a clever predicate
 *  that is wrong in one direction is not. */
const NOT_TITLES: Record<string, string> = {
  'app/dashboard/UpgradeScreen.tsx:PRICING.monthly':
    'the monthly PRICE. A number the screen exists to show, not the name of the screen.',
  'app/dashboard/UpgradeScreen.tsx:PRICING.annual':
    'the annual PRICE. Same reason as the monthly one directly above it.',
  'app/dashboard/BenchmarkUpdateScreen.tsx:meta.vdot':
    'the runner\'s VDOT, rendered large because it is the result. Not a heading.',

  // ── Added 2026-10-01 (BACK-HEADER-OWNER-01) when the population stopped being a
  //    hardcoded six-file list. Every one read and classified; none silenced by a
  //    predicate. ⚠️ THREE OF THEM SHARE A SHAPE THAT IS DOCUMENTED NOWHERE —
  //    a centred full-screen ask at 22-24px in `--font-brand` at weight 500-600, where
  //    every documented heading is 800. Filed as `INTERSTITIAL-TITLE-ROLE-01`, not
  //    quietly normalised here: a role nobody has ruled on is not mine to invent.
  'app/dashboard/GeneratePlanScreen.tsx:score':
    'the readiness SCORE. A number the screen exists to show, like the VDOT above.',
  'app/dashboard/DashboardClient.tsx:Your plan is ready.':
    'the RETIRED welcome screen (CLAUDE.md: trigger commented out). An interstitial ceremony headline, not a pushed-screen title.',
  'app/dashboard/DashboardClient.tsx:connect.ask':
    'the connect-runs full-screen ask: a centred interstitial with a wordmark, no back arrow and no title row. INTERSTITIAL-TITLE-ROLE-01.',
  'app/dashboard/DashboardClient.tsx:notify.ask':
    'the notification-permission ask, the same interstitial shape as connect.ask directly above it. INTERSTITIAL-TITLE-ROLE-01.',
  'app/dashboard/DashboardClient.tsx:content.title':
    'the ScreenGuide coach-mark panel — a hand-rolled slide-up, so `sheetRegions` cannot see it, but a sheet title by shape.',
  'app/dashboard/DashboardClient.tsx:raceName':
    'the RACE NAME on Plan, ruled by this board at A3 (design-rulings.md:514). The screen title is "Your plan", rendered by ScreenHeader two lines above it.',
}

/** 🔴 A `<Sheet>` REGION IS NOT A PUSHED SCREEN, AND THIS IS A BOUND RATHER THAN SIX
 *  EXEMPTIONS. `SUBPAGE-TYPE-SCALE-01` bounded its scope to pushed-screen titles in as
 *  many words — *"sheet titles, card headlines and Coach insight headings are not swept
 *  in"* — and while the population was a hardcoded six-file list that bound cost nothing,
 *  because none of those files opened a sheet. Deriving the population put
 *  `DashboardClient` in scope, which holds three pushed screens AND three sheets, and the
 *  arm promptly reported two sheet titles as hand-rolled screen titles.
 *
 *  **Bound the region, never grep the file** — recorded five times in this repo now. */
const sheetRegions = (src: string): Array<[number, number]> => {
  const out: Array<[number, number]> = []
  for (const m of Array.from(src.matchAll(/<Sheet[\s>]/g))) {
    const close = src.indexOf('</Sheet>', m.index!)
    out.push([m.index!, close < 0 ? src.length : close])
  }
  return out
}
const inSheet = (regions: Array<[number, number]>, at: number): boolean =>
  regions.some(([a, b]) => at >= a && at <= b)

describe('SUBPAGE-TYPE-SCALE-01 — pushed-screen titles come from the owner', () => {
  it('the documented role is still what the owner renders', () => {
    // The pattern layer and the token layer in the same pass — the `--surface-moss-wash`
    // lesson: a rule and its token can live in different files and never meet.
    const css = readFileSync('app/globals.css', 'utf8')
    const rule = /\.screen-header__title\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule, 'the title role lost its size').toMatch(/font-size:\s*26px/)
    expect(rule, 'the title role lost its weight').toMatch(/font-weight:\s*800/)
    expect(rule, 'the title role must use --font-ui').toMatch(/var\(--font-ui\)/)
    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    expect(doc, 'the documented row and the CSS must agree')
      .toMatch(/Screen title \| `--font-ui` \| 800 \| 26px/)
  })

  it('🔴 no pushed screen hand-rolls a title, in px OR rem', () => {
    const offenders: string[] = []
    for (const f of PUSHED) {
      const src = code(readFileSync(f, 'utf8'))
      const sheets = sheetRegions(src)
      for (const m of Array.from(src.matchAll(/style=\{\{([^{}]*)\}\}/g))) {
        if (inSheet(sheets, m.index!)) continue
        const obj = m[1]!
        const px = /fontSize:\s*'(\d+)px'/.exec(obj)
        const rem = /fontSize:\s*'([\d.]+)rem'/.exec(obj)
        const size = px ? Number(px[1]) : rem ? Math.round(Number(rem[1]) * 16) : null
        if (size === null || size < 20) continue
        // A glyph is not a title. The ✓ in a 56px circle is the thing my own analysis
        // mistook for one, so it is excluded by its CONTAINER, not by its size.
        if (/borderRadius:\s*'50%'/.test(obj)) continue
        const after = src.slice(m.index! + m[0].length, m.index! + m[0].length + 40)
        const body = after.replace(/<[^>]*>/g, '').replace(/[>\s]/g, '')
        if (body.length <= 2) continue
        // 🔴 VERBATIM, NORMALISED THE SAME WAY ON BOTH SIDES — and this line was the
        // hollow one. It used to read `body.includes(token.split('.').pop())`, which is
        // fine for `PRICING.monthly` and catastrophic for a declaration that ends in a
        // FULL STOP: `'Your plan is ready.'.split('.').pop()` is the EMPTY STRING, and
        // `body.includes('')` is true of everything. One declaration written with a
        // sentence in it silenced every offender in the largest file in the app,
        // sheet titles included. Found by falsifying the `<Sheet>` bound: that mutation
        // should have gone red and did not, and the bound was not the thing at fault.
        const declared = Object.keys(NOT_TITLES).find(k => {
          const at = k.indexOf(':')
          return f === k.slice(0, at) && body.includes(k.slice(at + 1).replace(/\s/g, ''))
        })
        if (declared) continue
        offenders.push(`${f}: ${size}px${rem ? ' (declared in rem)' : ''} — ${body.slice(0, 24)}`)
      }
    }
    expect(offenders,
      'a hand-rolled screen title; use className="screen-header__title":\n' + offenders.join('\n'))
      .toEqual([])
  })

  it('every declared not-a-title is still there (a stale exemption is a lie)', () => {
    for (const [k, why] of Object.entries(NOT_TITLES)) {
      // ⚠️ The same `split('.').pop()` hole lived here too, where it asserted
      // `toContain('')` — a declaration that could never go stale because the check
      // could never fail. Raw token against raw source.
      const at = k.indexOf(':')
      const src = code(readFileSync(k.slice(0, at), 'utf8'))
      expect(src, `${k} is declared as not-a-title but is gone — delete the row`)
        .toContain(k.slice(at + 1))
      expect(why.length, `${k}'s reason is too thin`).toBeGreaterThan(30)
    }
    for (const [k, why] of Object.entries(NOT_SUBTITLES)) {
      const [file, token] = k.split(':')
      const src = code(readFileSync(file!, 'utf8'))
      expect(src, `${k} is declared as not-a-subtitle but is gone — delete the row`)
        .toContain(token!)
      expect(why.length, `${k}'s reason is too thin`).toBeGreaterThan(30)
    }
  })

  it('🔴 every pushed screen actually USES the owner', () => {
    // The inverse. Deleting a title passes the arm above by having nothing to find.
    // ⚠️ Either role counts: `--compact` is the same owner for a title in a chrome row.
    for (const f of PUSHED) {
      const src = code(readFileSync(f, 'utf8'))
      expect(src, `${f} renders no screen title at all`).toContain('screen-header__title')
    }
  })

  it('the derived population is real, and every NOT_PUSHED exemption still qualifies', () => {
    // 🔴 THE POPULATION IS THE CHECK. A derivation that quietly returns nothing is the
    // hollow-green this repo has shipped more than once, so the floor is asserted, and
    // the five surfaces that were INVISIBLE to the old hardcoded list are named.
    expect(PUSHED.length, 'the pushed-screen derivation collapsed').toBeGreaterThanOrEqual(8)
    for (const f of [
      'app/dashboard/DashboardClient.tsx',       // session detail, post-run, reshape
      'components/dashboard/MeScreen.tsx',       // delete account, plan history
      'app/dashboard/GeneratePlanScreen.tsx',    // wizard step, plan preview
    ]) {
      expect(PUSHED, `${f} must be in scope — it was not, and that is this item`).toContain(f)
    }
    for (const [f, why] of Object.entries(NOT_PUSHED)) {
      const src = code(readFileSync(f, 'utf8'))
      expect(src, `${f} is declared not-a-pushed-screen but places no arrow — delete the row`)
        .toMatch(/<(BackButton|FloatingBackButton|PinnedBackHeader)\b|BackButton\b/)
      expect(why.length, `${f}'s reason is too thin`).toBeGreaterThan(30)
    }
  })

  it('the COMPACT role is documented, and the doc matches the CSS', () => {
    // The token layer and the pattern layer in the same pass — `--surface-moss-wash`.
    const css = readFileSync('app/globals.css', 'utf8')
    const rule = /\.screen-header__title--compact\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule, 'the compact role lost its size').toMatch(/font-size:\s*20px/)
    expect(rule, 'the compact role lost its weight').toMatch(/font-weight:\s*800/)
    expect(rule, 'the compact role must use --font-ui').toMatch(/var\(--font-ui\)/)
    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    expect(doc, 'the compact row is missing from the documented type scale')
      .toMatch(/Screen title, compact \| `--font-ui` \| 800 \| 20px/)
  })

  it('🔴 no title in a CHROME ROW is hand-rolled, at any size', () => {
    // ⚠️ THE REGION IS BOUNDED, NOT GREPPED — recorded four times in this repo, and the
    // reason this is a separate arm rather than a lower threshold on the one above. A
    // blanket `fontSize >= 16 && fontWeight >= 700` sweep over a whole file pulls in sheet
    // titles, card headlines and a 17px voice anchor — exactly the over-reach that made my
    // own analysis of SUBPAGE-TYPE-SCALE-01 wrong twice. So this looks only INSIDE a chrome
    // row: the window after a `pinned-chrome` class or a `<PinnedBackHeader`.
    //
    // 🔴 WHY A SIZE FLOOR OF 16 HERE AND 20 THERE. The compact role is 20px, so the arm
    // above (>= 20) could never have seen the session-detail title at 16px/700 — a screen's
    // own name rendering below `Card primary`'s neighbour and invisible to the only gate
    // that cared.
    const offenders: string[] = []
    for (const f of PUSHED) {
      const src = code(readFileSync(f, 'utf8'))
      for (const anchor of Array.from(src.matchAll(/pinned-chrome|<PinnedBackHeader/g))) {
        const win = src.slice(anchor.index!, anchor.index! + 1200)
        for (const m of Array.from(win.matchAll(/style=\{\{([^{}]*)\}\}/g))) {
          const obj = m[1]!
          const px = /fontSize:\s*'(\d+)px'/.exec(obj)
          const rem = /fontSize:\s*'([\d.]+)rem'/.exec(obj)
          const size = px ? Number(px[1]) : rem ? Math.round(Number(rem[1]) * 16) : null
          const w = /fontWeight:\s*(\d+)/.exec(obj)
          if (size === null || size < 16 || !w || Number(w[1]) < 700) continue
          const body = win.slice(m.index! + m[0].length, m.index! + m[0].length + 40)
            .replace(/<[^>]*>/g, '').replace(/[>\s]/g, '')
          offenders.push(`${f}: ${size}px/${w[1]} in a chrome row — ${body.slice(0, 24)}`)
        }
      }
    }
    expect(offenders,
      'a hand-rolled title in a chrome row; use className="screen-header__title--compact":\n'
      + offenders.join('\n'))
      .toEqual([])
  })

  it('the SUBTITLE role is documented too, and the doc matches the CSS', () => {
    // 🔴 THE SUB ROLE SHIPPED ON EIGHT SCREENS AND WAS NEVER IN THE TABLE. It existed only
    // in `globals.css`, so it could not be cited in review — and two screens duly hand-rolled
    // a 13px and a 14px subtitle beside it. A role that lives only in a stylesheet is a role
    // nobody can point at.
    const css = readFileSync('app/globals.css', 'utf8')
    const rule = /\.screen-header__sub\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule, 'the sub role lost its size').toMatch(/font-size:\s*12px/)
    expect(rule, 'the sub role lost its colour').toMatch(/var\(--mute\)/)
    const doc = readFileSync('docs/canonical/ui-patterns.md', 'utf8')
    expect(doc, 'the sub role is missing from the documented type scale')
      .toMatch(/Screen subtitle \| `--font-ui` \| 400 \| 12px/)
  })

  it('🔴 no pushed screen hand-rolls a SUBTITLE beside the owner', () => {
    // ⚠️ BOUNDED TO REAL SUBTITLES, and the bound is the point. A LEAD PARAGRAPH IS NOT A
    // SUBTITLE: `Redeem` and `Upgrade` carry 15px `--ink-2` copy under their titles, which is
    // Body/description doing its job, and forcing it to 12px `--mute` would be a regression.
    // So this looks for the SHAPE of a subtitle — small, muted — directly after a title.
    const offenders: string[] = []
    for (const f of PUSHED) {
      const src = code(readFileSync(f, 'utf8'))
      for (const m of Array.from(src.matchAll(/className="screen-header__title"/g))) {
        // 🔴 SEARCH FROM AFTER THE TITLE ELEMENT CLOSES, NOT FROM THE TITLE MATCH.
        // The first cut looked for the next `style={{` after `className="screen-header__title"`
        // — and a title that carries its OWN style attribute (`marginBottom`) matched itself.
        // The arm then found no `fontSize` on it and skipped, so re-hand-rolling a 13px muted
        // subtitle beside the owner passed. It was hollow, and the falsification caught it.
        const closes = src.indexOf('</', m.index!)
        if (closes < 0) continue
        const nxt = src.indexOf('style={{', closes)
        if (nxt < 0 || nxt - closes > 400) continue
        const obj = src.slice(nxt + 8, src.indexOf('}}', nxt))
        const px = /fontSize:\s*'(\d+)px'/.exec(obj)
        const rem = /fontSize:\s*'([\d.]+)rem'/.exec(obj)
        const size = px ? Number(px[1]) : rem ? Math.round(Number(rem[1]) * 16) : null
        if (size === null) continue
        const muted = /color:\s*'var\(--mute\)'/.test(obj)
        if (size <= 14 && muted) {
          const body = src.slice(src.indexOf('}}', nxt) + 2, src.indexOf('}}', nxt) + 60)
            .replace(/<[^>]*>/g, '').replace(/[>\s{}]/g, '')
          const declared = Object.keys(NOT_SUBTITLES).find(k => {
            const [file, token] = k.split(':')
            return f === file && body.includes(token!)
          })
          if (declared) continue
          offenders.push(`${f}: ${size}px muted line under a title (${body.slice(0, 20)}) — use className="screen-header__sub"`)
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('scans a real corpus (an empty sweep is not a pass)', () => {
    const all = execSync("git ls-files 'app/**/*.tsx' 'components/**/*.tsx'", { encoding: 'utf8' })
      .trim().split('\n')
    expect(all.length).toBeGreaterThan(50)
    for (const f of PUSHED) expect(all, `${f} left the tree`).toContain(f)
    for (const f of Object.keys(NOT_PUSHED)) expect(all, `${f} left the tree`).toContain(f)
  })
})
