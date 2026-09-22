import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * DESIGN-V3 — the surface rules the v3 handoff was held to.
 *
 * ⚠️ THE HANDOFF ASKED FOR THINGS THE SITE HAD ALREADY DECIDED AGAINST, and
 * the decisions were hours old when it arrived. All three were confirmed with
 * the founder rather than assumed, and all three are checked here, because a
 * decision that lives only in a chat is a decision the next handoff reverses.
 *
 *  1. TWO full-bleed ink bands. `ui-patterns.md` § Dark Ground: "Exactly one
 *     near-black section per marketing page... A second dark section would
 *     make it a dark theme; don't" (ADR-008). The identical request had
 *     already been refused during the Miles teardown (W-10).
 *  2. Alternating warm bands. § Section grounds (W-08, the same day): "The
 *     marketing site does not alternate band colours", with a note saying in
 *     as many words that the proposal should not "be re-imported from the
 *     next teardown". It was, from a different source.
 *  3. A paper-grain overlay. That is W-11, killed by the SLT unanimously on
 *     2026-09-21 and marked "do not re-propose".
 */

const ROOT = path.resolve(__dirname, '../..')
const src = (f: string) =>
  fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const HOME = 'app/page.tsx'

/**
 * Source index of an `<Eyebrow>` by its TEXT, tolerant of its props.
 *
 * ⚠️ These assertions used to read `home.indexOf('<Eyebrow>Honestly</Eyebrow>')`
 * and they went red on SITE-BEAT-01 — a change that moved nothing, reordered
 * nothing and reversed no ruling. It added a `beat` prop. **What these tests
 * are guarding is the ORDER of the page's beats, and the tag's attribute list
 * is not part of that claim.** Same shape as the prose matchers that broke when
 * four refusal strings were retuned for tone: anchor on the thing the rule is
 * about, never on incidental syntax around it.
 */
const eyebrowAt = (code: string, text: string) =>
  code.search(new RegExp(`<Eyebrow\\b[^>]*>\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<`))

/** Every marketing component, read from disk rather than listed — a hand-written
 *  list is the "only as wide as its list" failure this repo keeps recording. */
const MARKETING_FILES = fs.readdirSync(path.join(ROOT, 'components/marketing'))
  .filter(f => /\.tsx?$/.test(f))
  .map(f => `components/marketing/${f}`)

describe('marketing section surfaces', () => {
  it('uses at most ONE dark ground on the homepage', () => {
    const home = src(HOME)
    const viaSection = Array.from(home.matchAll(/surface="dark"/g)).length
    const viaToken = Array.from(home.matchAll(/background:\s*'var\(--ground\)'/g)).length
    expect(viaSection + viaToken, 'a second near-black band makes it a dark theme (ADR-008)').toBeLessThanOrEqual(1)
  })

  it('does not alternate warm bands', () => {
    // W-08: --bg-soft is an inset area and an input field, not a section
    // ground. `Section surface="inset"` exists for surfaces that legitimately
    // have one; the homepage is not one of them.
    expect(src(HOME)).not.toContain('surface="inset"')
  })

  it('ships no paper-grain overlay', () => {
    for (const f of [HOME, 'app/globals.css', 'app/layout.tsx']) {
      const code = src(f)
      expect(code, `${f} reintroduces W-11`).not.toMatch(/feTurbulence|fractalNoise/)
    }
  })

  it('Section offers the four surfaces and maps them to real tokens', () => {
    // ⚠️ FOUR keys, THREE page grounds. `card` was added 2026-09-22 (Design
    // Board sitting one) because `ui-patterns.md` has documented the white
    // spotlight as one of the three grounds since W-08, and this component
    // could not express it — so the homepage hand-rolled a raw background
    // instead. `inset` is the FOURTH key and is NOT a page ground: brand.md
    // says so in those words, and spending it as one is the band alternation
    // W-08 killed. The test below still forbids it on the homepage.
    const sec = src('components/marketing/Section.tsx')
    for (const s of ['page', 'card', 'inset', 'dark']) expect(sec).toContain(`${s}:`)
    for (const t of ['--bg)', '--card)', '--bg-soft)', '--ground)']) expect(sec).toContain(t)
    // No hardcoded colour may enter the surface map.
    expect(sec).not.toMatch(/#[0-9a-f]{3,8}/i)
  })

  /**
   * ⚠️ THE MOSS WASH IS GONE, AND THE CHECK BECAME THE OPPOSITE OF ITSELF.
   *
   * `--surface-moss-wash` (#E7EDE4) framed the hero evidence card for one
   * day. This test used to scope it to that one file. The founder queried it
   * on sight — "the new graph card with the green shadow: not sure the site
   * looks consistent with that" — and the reason was already written down:
   * W-08 had reduced the site to THREE grounds, each spent once, and the
   * wash was a fourth, used once, and the only tinted surface anywhere.
   *
   * The frame is now the documented inset (`--bg-soft` + a hairline,
   * `ProductStill`'s pattern). So the rule to enforce is no longer "keep it
   * scoped" but "it does not come back" — including as a fresh hex, which is
   * how a removed token usually returns.
   */
  it('every marketing surface uses the shared Section, not a raw <section>', () => {
    // SITE-WAVE-1a-ii, 2026-09-22. Before this, <Section> was imported by ONE
    // surface out of eleven — the homepage — and every other page hand-rolled
    // its sections, its rhythm and its padding. Pages that do not share the
    // mechanism cannot share the result, which is why "make them consistent"
    // had nowhere to start.
    //
    // ⚠️ THIS IS THE ENABLER, NOT THE FIX. Adoption was deliberately ZERO
    // VISUAL DELTA: width="full" + rhythm="none" reproduce each page's existing
    // padding exactly. What it buys is that `surface=` now EXISTS on every
    // page, so wave 1b can spend a ground. It could not before.
    // ⚠️ THE FIRST VERSION OF THIS WAS A HAND-WRITTEN LIST OF SEVEN PAGE FILES,
    // and it passed while `SameWeekTwice.tsx` still rendered a raw <section> —
    // because that is a COMPONENT, and components were not on the list. "An
    // audit is only ever as wide as its list" is recorded in this repo about a
    // different check that missed a whole category the same way.
    // So: the marketing components are READ FROM DISK, not enumerated.
    const PAGES = [
      'app/page.tsx',
      'app/plans/page.tsx',
      'app/pricing/page.tsx',
      'app/about/page.tsx',
      'app/charity-runners/page.tsx',
    ]
    const COMPONENTS = fs.readdirSync(path.join(ROOT, 'components/marketing'))
      .filter(f => f.endsWith('.tsx') && f !== 'Section.tsx')
      .map(f => `components/marketing/${f}`)
    const SURFACES = [...PAGES, ...COMPONENTS]
    for (const f of SURFACES) {
      const code = src(f)
      // A raw <section ...> with attributes. `</section>` is not matched, and a
      // bare <section> with no attributes is not what this is guarding against.
      expect(code, `${f} still hand-rolls a raw <section> instead of using <Section>`)
        .not.toMatch(/<section\s+[a-zA-Z]/)
      // A component with no sections at all does not need the import — the
      // rule is "no RAW sections", not "everything must use Section".
      if (/<Section[\s>]/.test(code)) {
        expect(code, `${f} uses <Section> but does not import it`)
          .toContain("from '@/components/marketing/Section'")
      }
    }
  })

  it('PROOF PRECEDES MECHANISM on the homepage', () => {
    // Design Board sitting two, 2026-09-22 — the ruling in one sentence.
    //
    // The page front-loaded mechanism and back-loaded proof: the hero made a
    // claim, three consecutive feature sections explained how the product
    // works, and only at 52% did the page SHOW the claim was true. The founder
    // stopped reading at screen 2.5 of 14.8. He never reached it.
    //
    // Sierra: `SameWeekTwice` is the only section where the reader learns to
    // SEE something, and a competitor whose proposition is encouragement
    // structurally cannot print it. It now sits at screen 3.4 (23%).
    //
    // ⚠️ Bound to SOURCE ORDER, not a pixel position: a percentage would move
    // every time any section's length changed, and a guard that fires on
    // unrelated edits gets switched off.
    const home = src('app/page.tsx')
    const proof = home.indexOf('<SameWeekTwice />')
    expect(proof, 'the homepage no longer renders the proof section').toBeGreaterThan(-1)

    // Every section that EXPLAINS the mechanism must come after it.
    for (const eyebrow of ['Personalised, not generic', 'How it goes']) {
      const mech = eyebrowAt(home, eyebrow)
      expect(mech, `the "${eyebrow}" section has gone`).toBeGreaterThan(-1)
      expect(proof, `"${eyebrow}" now precedes the proof — sitting two ruled the opposite`)
        .toBeLessThan(mech)
    }
    // And the recognition beat still precedes the proof: problem, then evidence.
    expect(eyebrowAt(home, 'The problem')).toBeLessThan(proof)
  })

  it('the cuts and merges from sitting two hold', () => {
    // Design Board sitting two, 2026-09-22 — nine content sections became six.
    const home = src('app/page.tsx')

    // 1. "Three things, done with restraint" — the SECTION is cut.
    expect(home, 'the "Three things" section has returned')
      .not.toMatch(/<SectionTitle[^>]*>\s*Three things,/)

    // 2. 🔴 BUT ITS CONTENTS SURVIVED, AND THIS IS THE IMPORTANT HALF.
    // The settled-ground scan caught that cutting the section wholesale would
    // delete ZoneRings from the site. The register says: "Dropping ZoneRings —
    // REVERSED, retained. One of three components in the homepage trio,
    // literally one third of the product's public face." Dropping it recreates
    // PLAN-LONGRUN-COLOUR-01 — the site promising what the app no longer has.
    expect((home.match(/<ProductStill/g) || []).length,
      'the ProductStill trio is no longer three').toBe(3)
    // ⚠️ A BOUNDED MATCH, NOT toContain. The first version of this line was
    // `.toContain('<ZoneRings')` — which passes for `<ZoneRingsX`, so renaming
    // the component away would NOT have turned it red. That is the exact
    // `toContain('<PlanCalendar')` / `<PlanCalendarX` trap this repo has
    // already recorded, reproduced here while writing the guard against it.
    expect(home, 'ZoneRings has been dropped from the homepage — see the register')
      .toMatch(/<ZoneRings[\s/>]/)

    // 3. The two refusal sections are ONE section.
    //
    // ⚠️ THIS ASSERTION USED TO ANCHOR ON `surface="card"`, because the refusal
    // band held the white spotlight when sitting two merged them. 1b-iii moved
    // the spotlight to the proof and this check went red — correctly. It was
    // encoding a premise that a later ruling changed. Anchor on the MERGE
    // itself, which is what sitting two actually ruled, not on the ground that
    // happened to be underneath it at the time.
    const restraint = eyebrowAt(home, 'The restraint')
    const honestly = eyebrowAt(home, 'Honestly')
    expect(restraint, '"The restraint" has gone').toBeGreaterThan(-1)
    expect(honestly, '"Honestly" has gone').toBeGreaterThan(-1)
    expect(restraint, 'the refusal order flipped').toBeLessThan(honestly)
    // No </Section> between them: they are one section, not two adjacent ones.
    expect(home.slice(restraint, honestly), 'the refusal sections have been split apart again')
      .not.toContain('</Section>')
  })

  it('the white spotlight marks the PROOF, and there is still exactly one', () => {
    // Design Board 1b-iii, 2026-09-22. ui-patterns.md §257 AMENDED, not
    // contradicted: it read "the white band is spent on 'Probably not for you
    // if…'; anti-qualification is the most distinctive thing on the site".
    // That was true of a page whose proof sat at 52%. Sitting two moved the
    // proof to 24% and the premise stopped being true — we changed it ourselves.
    //
    // The page has exactly ONE movable ground change: W-09 binds the close to
    // last, and W-08 permits one white spotlight, "a spotlight, not a rhythm".
    // Spent at 63% it left the first two thirds one uninterrupted ground, which
    // is the founder's measured complaint. It now marks the only section that
    // teaches the reader anything.
    const proof = src('components/marketing/SameWeekTwice.tsx')
    expect(proof, 'the proof section has lost the white spotlight')
      .toMatch(/surface="card"/)

    // ⚠️ STILL EXACTLY ONE. A second white band is the alternation W-08 killed.
    const all = [...MARKETING_FILES, 'app/page.tsx']
      .map(f => (src(f).match(/surface="card"/g) || []).length)
      .reduce((a, b) => a + b, 0)
    expect(all, 'more than one white spotlight — W-08 permits exactly one').toBe(1)
  })

  it('the homepage has a heading HIERARCHY, not eight equal announcements', () => {
    // 1b-iii. Before this every section heading was --fs-h2, so a reader had no
    // way to know the proof mattered more than the FAQ.
    //
    // ⚠️ SIZE AND TAG ARE SEPARATE, and conflating them was a real defect here:
    // the first cut demoted BOTH, which turned standalone sections into <h3>
    // subordinate to whatever preceded them, and inverted the refusal band so
    // its subordinate heading led. A tag is an outline claim; a size is a
    // design one. `sub` makes both; `minor` makes only the second.
    const home = src('app/page.tsx')
    expect(home, 'SectionTitle has lost its weight prop').toMatch(/weight\?: 'lead' \| 'minor' \| 'sub'/)
    expect(home, 'size and tag have been conflated again').toMatch(/const H = weight === 'sub' \? 'h3' : 'h2'/)

    // The two headings that sit INSIDE a merged section are subordinate.
    expect((home.match(/weight="sub"/g) || []).length,
      'a merged section\'s second heading is no longer subordinate').toBeGreaterThanOrEqual(1)
    // And at least one section is quieter without claiming subordination.
    expect((home.match(/weight="minor"/g) || []).length,
      'nothing is demoted by size alone any more').toBeGreaterThanOrEqual(1)
  })

  it('every acquisition surface makes an IN-BODY download ask', () => {
    // SITE-WAVE-2, Design Board sitting one, 2026-09-22.
    //
    // ⚠️ IN-BODY, NOT TOTAL. Header and footer carry an App Store link on every
    // page, so a naive count says every page converts. The real measure is
    // whether a page asks IN ITS OWN CONTENT — and /guides and /comparisons,
    // the two SEO acquisition hubs, had ZERO. Per the founder's ruling that
    // plans and guides are the traffic channel and the app is the conversion,
    // the pages built to catch traffic were the only ones not converting it.
    //
    // My first audit of this reported "six pages have no CTA" because the grep
    // missed <AppStoreBadge> and BRAND.appStore.url. Match the COMPONENT.
    const SURFACES = [
      'components/marketing/ArticleHub.tsx',  // /guides and /comparisons
      'components/marketing/SameWeekTwice.tsx', // the proof, on the homepage
      'components/marketing/PlanPage.tsx',
      'app/pricing/page.tsx',
      'app/plans/page.tsx',
    ]
    for (const f of SURFACES) {
      expect(src(f), `${f} makes no in-body download ask`)
        .toMatch(/<AppStoreBadge|BRAND\.appStore\.url/)
    }
  })

  it('the proof section carries the CTA, and it is not a card on a card', () => {
    // The homepage had in-body links at screen 0.6 then nothing until 13.3 — a
    // 12.7-screen dead zone — while sitting two put the most persuasive section
    // at 24%. The CTA now sits at the end of the proof (screen 5.1), which cuts
    // the largest gap to 8.3.
    //
    // ⚠️ AND IT MUST NOT BE THE CARD PATTERN. 1b-iii gave the proof the white
    // spotlight, so the band is already --card; the in-body CTA card used
    // everywhere else would be a white box on a white ground.
    const proof = src('components/marketing/SameWeekTwice.tsx')
    const badge = proof.indexOf('<AppStoreBadge')
    expect(badge, 'the proof section has lost its CTA').toBeGreaterThan(-1)

    // ⚠️ BOUND TO THE CTA'S OWN WRAPPER, NOT THE FILE. The first version grepped
    // the whole component for `background: 'var(--card)'` and failed on correct
    // code — this section legitimately contains two white comparison cards
    // ("Run on feel" / "Run to the ceiling"). Seventh time in this session that
    // an unbounded match has produced a wrong answer. Look at the 240 characters
    // that actually wrap the badge.
    const wrapper = proof.slice(Math.max(0, badge - 240), badge)
    expect(wrapper, 'the proof CTA has grown a --card wrapper on an already-white band')
      .not.toMatch(/background:\s*'var\(--card\)'/)
  })

  it('the App Store QR code stays dead', () => {
    // 🔴 KILLED 2026-09-22 by founder instruction (design-rulings.md).
    //
    // ⚠️ THIS CHECK EXISTS BECAUSE REMOVING THE FEATURE REMOVED ITS TEST.
    // `appStoreQr.test.ts` went with the component, which left nothing at all
    // asserting the decision — the same shape as a kill recorded in prose and
    // then quietly undone. This file already guards W-11's paper grain and the
    // moss wash; the QR belongs beside them.
    //
    // The rationale, so it cannot return as "but it helps desktop visitors":
    // a QR code on a page already being read on a phone asks the visitor to
    // photograph their own screen. It only ever worked from desktop, and the
    // desktop visitor is the one least likely to install right now.
    for (const f of ['app/page.tsx', 'components/marketing/SiteFooter.tsx']) {
      expect(src(f), `${f} reintroduces the App Store QR`).not.toMatch(/AppStoreQr|appstore-qr/i)
    }
  })

  it('footer column labels are not <h2> — they do not compete with content sections', () => {
    // Design Board sitting one, 2026-09-22. Four footer labels rendered at 11px
    // sat at the SAME outline level as the page's content sections, which a
    // crawler and a heading-navigation user both have to wade through.
    // `<nav aria-label>` already names each group, so the heading is for
    // navigation, not identification.
    expect(src('components/marketing/SiteFooter.tsx')).not.toMatch(/<h2[\s>]/)
  })

  it('the hardware caveat follows the proof, it does not gate it', () => {
    // Design Board sitting one. BRAND.hrRecommendation sat in the hero's LEFT
    // column, which on mobile put a HARDWARE REQUIREMENT above the evidence
    // card — the one asset a competitor cannot copy. A caveat before the proof
    // reads as a condition of believing the claim; after it, as a practical
    // note. Same words, different job.
    //
    // ⚠️ Bound to the hero region, not the whole file: the FAQ further down
    // legitimately mentions an Apple Watch, and grepping the file would pass on
    // that and prove nothing.
    const page = src('app/page.tsx')
    const hero = page.slice(0, page.indexOf('Facts band'))
    const proof = hero.indexOf('<HeroTrace />')
    const caveat = hero.indexOf('BRAND.hrRecommendation')
    expect(proof, 'the hero no longer renders HeroTrace').toBeGreaterThan(-1)
    expect(caveat, 'the hero no longer renders the hardware caveat').toBeGreaterThan(-1)
    expect(caveat, 'the caveat has moved back above the proof card').toBeGreaterThan(proof)
  })

  it('no tinted surface returns to make one card special', () => {
    for (const f of ['app/globals.css', 'app/page.tsx',
                     'components/marketing/HeroTrace.tsx', 'components/marketing/Section.tsx']) {
      expect(src(f), `${f} reintroduces the moss wash token`).not.toContain('--surface-moss-wash')
    }
    // The hex itself, and its near neighbours, in any marketing component.
    for (const f of MARKETING_FILES) {
      expect(src(f), `${f} hardcodes the retired wash colour`).not.toMatch(/#E7EDE4/i)
    }
  })

  it('the hero card is framed as an INSET, the pattern ProductStill documents', () => {
    const hero = src('components/marketing/HeroTrace.tsx')
    const i = hero.indexOf("background: 'var(--bg-soft)'")
    expect(i, 'the frame should use the inset ground').toBeGreaterThan(-1)

    // ⚠️ SCOPE IT TO THE INSET'S OWN STYLE OBJECT. A file-level
    // `toContain("border: '1px solid var(--line)'")` passed with the inset's
    // border deleted, because the white card INSIDE it carries an identical
    // border two lines further down — so the check could not go red, which
    // deleting the border proved. Third substring-bias miss today; the fix
    // is always to bound the region rather than to grep the file.
    const frame = hero.slice(i, hero.indexOf('}}', i))
    expect(frame, 'an inset carries exactly one hairline of its own')
      .toContain("border: '1px solid var(--line)'")
  })

  it('a full-bleed Section wraps its content in the page column — SITE-MEASURE-EDGE', () => {
    // 🔴 THE DEFECT THE EDGE MEASUREMENT COULD NOT SEE. `Section width="full"`
    // opts out of the frame so a band can manage its own width — the white
    // spotlight, the proof. Anything placed inside it that is NOT re-wrapped in
    // `--measure-page` therefore renders full-bleed. The ProductStill trio was
    // moved into the mechanism band by sitting two and landed as a SIBLING of
    // the page-column wrapper, so at 1440px it spanned **24-1412** while every
    // other band sat in the 1100px column at 168.
    //
    // ⚠️ IT SURVIVED A MEASUREMENT AIMED STRAIGHT AT IT. The edge audit
    // collected elements carrying a `max-width` and took the smallest left edge;
    // this grid has no max-width at all, so the band reported its neighbour's
    // 168 and read as correct. **A measurement that only looks at elements
    // WITH the property cannot find the element that is MISSING it.**
    //
    // ⚠️ ANCHORED ON CODE, NOT ON A COMMENT. The first cut anchored on the
    // trio's `THE PRODUCTSTILL TRIO` comment marker — and `src()` STRIPS
    // COMMENTS, so it failed on correct code with "the marker has moved". Two
    // tests in a row now written against a version of the file the helper does
    // not hand back.
    //
    // `gap: '18px 24px'` is the trio grid's own declaration and appears exactly
    // once in the file, so the 200 characters before it are the grid's opening
    // and whatever wraps it. `--measure-page` appears many times overall; a
    // file-wide grep would pass on any of them.
    const home = src(HOME)
    const grid = home.indexOf("gap: '18px 24px'")
    expect(grid, 'the trio grid declaration has moved — re-anchor this test').toBeGreaterThan(-1)
    expect(home.slice(Math.max(0, grid - 260), grid),
      'the trio must sit inside the page column, or it renders full-bleed')
      .toContain('var(--measure-page)')
  })
})
