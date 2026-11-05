// GTM-SITE-02 item 3 — the homepage must show the product, not a drawing of it.
//
// The homepage spent months rendering `MockSessionCard`, `MockReflectCard` and
// `MockCoachNoteCard`: hand-written CSS imitations of app surfaces. They drifted,
// which is the whole reason this item existed. The coach mock painted its rail
// in `--moss` while the real `CoachNoteBlock` uses `--warn`, so the marketing
// site was showing a coach note in the colour that does not mean "coach".
//
// Nothing stops the next person re-adding one, which is what this guards.
// It also pins the two places the site states the SAME session twice: the
// device shot (`PhoneFrame`, hand-built by necessity) and the SessionCard on
// the homepage. Those are two hand-maintained copies of one claim, and that is
// exactly the shape of every content drift this repo has shipped.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatDistance } from '@/lib/format'
import { DEMO_WEEK, DEMO_ZONE_WEEK } from './demoSurfaces'

const ROOT = process.cwd()
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** HTML entities the marketing pages use for characters JSX cannot hold bare. */
function decode(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&middot;/g, '·')
}

describe('the homepage renders real app components', () => {
  const page = read('app/page.tsx')

  // 🔴 ZONERINGS LEFT THIS LIST 2026-11-05 — `SITE-EFFORT-RECORD-01`, Design
  // Board, on a FOUNDER OVERRULE of a row the register had REVERSED. The
  // homepage trio's third still is now `EffortRecord`.
  //
  // ⚠️ THE ROW IT OVERRULES IS NOT DEAD AND MUST NOT BE READ AS DEAD.
  // *"Dropping ZoneRings — REVERSED, retained. One of three components on the
  // marketing homepage's ProductStill trio: literally one third of the public
  // face."* That row has already caught one attempt to spend this slot. It is
  // overruled HERE, for this slot, by the founder, and recorded as an overrule
  // in `design-rulings.md` — not quietly deleted because a test went red.
  //
  // ⚠️ AND ZONERINGS IS STILL ON THE SITE, which is why this is a swap of
  // EVIDENCE rather than the deletion the row forbids: it renders in
  // `TabbedPhone`'s Coach tab, in the device directly above the trio. The arm
  // below asserts exactly that, so "retained on the marketing site" stays
  // mechanically true rather than becoming a claim in a comment.
  it.each([
    ['SessionCard', '@/components/shared/SessionCard'],
    ['CoachNoteBlock', '@/components/shared/CoachNoteBlock'],
    ['EffortRecord', '@/components/shared/EffortRecord'],
  ])('imports the real %s', (name, from) => {
    expect(
      page.includes(from),
      `app/page.tsx no longer imports ${name} from ${from}. If the product visual ` +
      `was replaced with hand-written markup, that is the drift this item removed.`,
    ).toBe(true)

    // An import that nothing mounts is the same as no import.
    expect(page, `${name} is imported but never rendered`).toMatch(new RegExp(`<${name}[\\s/>]`))
  })

  it('ZoneRings is still on the marketing site, in the device', () => {
    // The register retains ZoneRings as a third of the public face. The founder
    // overruled WHERE it sits, not WHETHER it ships. If this goes red, the
    // component really has been dropped from the site and the row is breached.
    const phone = read('components/marketing/TabbedPhone.tsx')
    expect(phone, 'ZoneRings has left the marketing site entirely — that is the '
      + 'REVERSED row in design-rulings.md, not the 2026-11-05 overrule, which '
      + 'moved it out of the trio and kept it in the device.')
      .toMatch(/<ZoneRings[\s/>]/)
  })

  it('has no hand-drawn imitation of an app surface', () => {
    const mocks = page.match(/^function Mock\w+/gm) ?? []
    expect(
      mocks,
      `app/page.tsx defines ${mocks.join(', ')}. Marketing surfaces render the real ` +
      `shared component instead: none of them is a client component and none needs a ` +
      `handler, so a server page can mount them directly. See lib/marketing/demoSurfaces.ts.`,
    ).toEqual([])
  })
})

/**
 * SITE-SESSION-STEPS-01 (Design Board, 2026-11-05) — the PLAN PAGES too.
 *
 * 🔴 THIS GATE GOVERNED THE HOMEPAGE AND NOTHING ELSE, and that is how the plan
 * pages kept a 2026-09 session structure under 47 green marketing gates. The
 * file above opens `const page = read('app/page.tsx')` and every arm reads
 * `page`. The hand-drawn imitation it was written to stop — `MockSessionCard`
 * and friends — had an exact analogue on `/plans/[slug]`: a local `MainSet`
 * that drew its own step rows while `components/shared/SessionSteps` existed.
 *
 * ⚠️ IT WAS NOT THE SAME DEFECT, AND THE DIFFERENCE IS WHY NOBODY SAW IT. The
 * homepage mocks drifted in their CONTENT (the coach mock painted its rail
 * `--moss` where the real block uses `--warn`). `MainSet` took its grammar from
 * the real `stepParts()`, so its WORDS could not drift — only its SHAPE did,
 * and no check in this repo looks at shape. **A component that cannot drift in
 * content can still drift in form.**
 *
 * ⚠️ THE INLINE `MainSet` IS DELIBERATELY STILL THERE and is not a violation.
 * The board amended this ruling on rendered evidence: mounting the full
 * structure under all 13 quality sessions took the page from 15.7 to 26.0
 * phone screens. One exemplar in its own band, compact rows in the week table
 * — progressive disclosure, which is two JOBS, not two definitions of one.
 */
describe('the plan pages render the real session structure', () => {
  const planPage = read('components/marketing/PlanPage.tsx')

  it('imports and mounts the real SessionSteps', () => {
    expect(
      planPage.includes("@/components/shared/SessionSteps"),
      'PlanPage no longer imports the real SessionSteps. A local re-drawing of '
      + 'the session structure is the drift this item removed.',
    ).toBe(true)
    expect(planPage, 'SessionSteps is imported but never rendered').toMatch(/<SessionSteps[\s/>]/)
  })

  it('shows the structure EXACTLY ONCE, which is the board amendment', () => {
    // ⚠️ ASSERTS THE COUNT, NOT THE PRESENCE. "SessionSteps is on the page" is
    // true of the version the board rejected on measurement (13 of them, +10.3
    // phone screens). The amendment is a QUANTITY, so the check is a quantity.
    expect(planPage.split('<SessionSteps').length - 1,
      'SessionSteps must be mounted once. The board ruled one exemplar after '
      + 'measuring 13 of them at 26.0 phone screens against 15.7.').toBe(1)
    expect(planPage.split('<SessionStructureBlock').length - 1,
      'the exemplar wrapper should have exactly one call site plus its definition').toBe(1)

    // 🔴 A SOURCE COUNT IS NOT A RENDER COUNT, and code review caught that the
    // rejected version PASSES this if written as one JSX site inside the
    // day-row loop. One occurrence rendered 13 times is the thing the board
    // measured at 26.0 phone screens. So: the call site must be OUTSIDE the
    // per-session map. Bound the region rather than grepping the file — the
    // week table is everything after the "week by week" heading.
    const tableStart = planPage.indexOf('The plan, week by week')
    expect(tableStart, 'the week-table heading has moved — re-anchor').toBeGreaterThan(-1)
    const mount = planPage.indexOf('<SessionStructureBlock')
    expect(mount, 'the exemplar is not mounted').toBeGreaterThan(-1)
    expect(mount,
      'the exemplar is mounted INSIDE the week table, so it renders once per '
      + 'quality session rather than once per page. That is the version the '
      + 'board rejected on measurement (15.7 -> 26.0 phone screens).')
      .toBeLessThan(tableStart)
  })

  it('does not re-draw a step row beside the component that owns it', () => {
    // `MainSet` may keep its compact rows. What it may not do is grow a second
    // per-phase card stack: that would be two answers to one question again.
    // ⚠️ COMMENTS STRIPPED. `read()` does not strip them, so this arm ran over
    // prose and passed today only because the single mention is "Warm up" with
    // a space. Any future comment naming a phase would have failed the build on
    // correct code — the trap `typeScale`, `spacingScale` and the pre-commit
    // hook each hit, now four times in this repo.
    const code = planPage
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    const phases = /Warm-?up|Cool-?down/gi
    const inPlanPage = (code.match(phases) ?? []).length
    expect(inPlanPage,
      'PlanPage names the session phases itself. Those headers belong to '
      + 'SessionSteps; naming them here is the start of a second drawing.').toBe(0)
  })
})

describe('the two stills of the same session agree', () => {
  it('the device shot and the homepage card show the same run', () => {
    const frame = decode(read('components/marketing/PhoneFrame.tsx'))
    const tuesday = DEMO_WEEK[0]

    expect(
      frame.includes(tuesday.detail),
      `PhoneFrame no longer contains "${tuesday.detail}". The device shot and the ` +
      `SessionCard beside it are presented as the same runner's session, so if one ` +
      `changes the other has to. Update DEMO_WEEK[0] or PhoneFrame, not just one.`,
    ).toBe(true)

    // Deliberately NOT a literal. ADR-015 makes lib/format.ts the sole owner of
    // every distance string a runner reads, and this still is hand-built, so it
    // is the file most likely to drift away from it. It did: it read "8 km"
    // while the app renders "8km".
    const distance = formatDistance(tuesday.distanceKm, 'km')!
    expect(
      frame.includes(distance),
      `PhoneFrame does not show "${distance}" for the same session. That is what ` +
      `formatDistance() emits, and the device shot is a picture of a screen that ` +
      `calls it. Do not hand-write a different distance format here.`,
    ).toBe(true)

    // The check above is not enough on its own and was briefly wrong: the still
    // shows the same distance TWICE (the 56px hero and the session card), so
    // "the correct string appears somewhere" still passed while one of the two
    // had drifted back to "8 km". Only the absence of the wrong shape catches
    // that, so assert on every renderable line instead.
    const strays = frame
      .split('\n')
      .map((text, i) => ({ text, line: i + 1 }))
      .filter(l => !l.text.trim().startsWith('//'))
      .filter(l => /\d\s+(km|mi)\b/.test(l.text))
      .map(l => `  PhoneFrame.tsx:${l.line}  ${l.text.trim().slice(0, 100)}`)

    expect(
      strays,
      `PhoneFrame hand-writes a distance with a space before the unit:\n${strays.join('\n')}\n` +
      `formatDistance() emits "8km", never "8 km" (ADR-015).`,
    ).toEqual([])
  })
})

describe('the demo data is coherent', () => {
  it('the zone week sums to 100%', () => {
    const { z1, z2, z3, z45 } = DEMO_ZONE_WEEK.pct
    expect(z1 + z2 + z3 + z45).toBe(100)
  })

  // The product's argument is that the grey middle is hard to stay out of. A
  // demo week with zero Z3 would be showing a week nobody has.
  it('is an honest week, not a perfect one', () => {
    expect(DEMO_ZONE_WEEK.pct.z2).toBeGreaterThan(60)
    expect(DEMO_ZONE_WEEK.pct.z3).toBeGreaterThan(0)
  })

  it('uses more than one session colour', () => {
    expect(new Set(DEMO_WEEK.map(s => s.type)).size).toBeGreaterThan(1)
  })
})

/**
 * DESIGN-V3 — a marketing SCREEN must be the app's screen.
 *
 * ⚠️ THE GAP THIS CLOSES, and it is the one the checks above could not see.
 * Everything before this pins the CONTENT of a mockup: the distance string,
 * the zone percentages, the fact that a hand-written card has not come back.
 * None of it can tell you that a screen shows a FEATURE THE APP DOES NOT
 * HAVE.
 *
 * `TabbedPhone`'s first cut shipped exactly that. Built from the v3 design
 * handoff's description rather than from the product, its Coach screen drew
 * four horizontal zone bars, asserted "Target is 80%. Last week: 62%." — a
 * sentence that appears nowhere in the app — and omitted Kit's weekly read.
 * Its Plan screen invented a summary row and left out the Plan Arc. Every
 * test passed, because none of them was looking at whether it was real.
 *
 * ⚠️ AND THE FIRST VERSION OF **THIS** CHECK PINNED THE WRONG ANSWER TOO.
 * It was written against the SECOND cut, which was rebuilt from
 * `screen-architecture.md` — a document about what BELONGS on a screen, not
 * about what the screen IS. It therefore required `SessionCard` and
 * `CoachNoteBlock` on the Plan and Coach tabs and was perfectly green over a
 * Plan screen with no WEEKS on it, which is the one thing the real Plan
 * screen is made of. A gate written from a doc inherits the doc's distance
 * from the code.
 *
 * So this no longer hardcodes a component list at all. **It reads
 * `DashboardClient`.** For each screen it slices the real screen function out
 * of the app and requires that every component the marketing still claims to
 * show is actually rendered there, and that the components the real screen
 * leads with are present in the still. If the app's Plan screen stops
 * rendering the weeks, this fails; if the marketing still drifts from it,
 * this fails.
 */
describe('DESIGN-V3 — marketing screens render the real app', () => {
  const tabbed = read('components/marketing/TabbedPhone.tsx')
  const dash = read('app/dashboard/DashboardClient.tsx')

  /** The source of one top-level `function <name>(` through to the next one. */
  function screenSource(name: string): string {
    const open = dash.indexOf(`\nfunction ${name}(`)
    expect(open, `${name} should exist in DashboardClient`).toBeGreaterThan(-1)
    const next = dash.indexOf('\nfunction ', open + 1)
    return dash.slice(open, next > -1 ? next : undefined)
  }

  /**
   * What each marketing tab must show, and the app screen it is claiming to
   * be. Every entry is verified in BOTH directions below, so neither list can
   * quietly become aspirational.
   */
  const SCREENS: { tab: string; appScreen: string; components: string[] }[] = [
    // The weeks ARE the Plan screen. `PlanCalendar` renders the Past / Now /
    // Next / Later week cards; the arc is what the screen opens with.
    { tab: 'Plan',  appScreen: 'PlanScreen',  components: ['PlanArc', 'PlanCalendar'] },
    // Coach leads with Kit's weekly read and pictures the week with rings.
    { tab: 'Coach', appScreen: 'CoachScreen', components: ['CoachByline', 'ZoneRings'] },
  ]

  /**
   * `<Name` followed by a JSX boundary. ⚠️ A plain `toContain('<PlanCalendar')`
   * is satisfied by `<PlanCalendarX`, so the first cut of this check passed
   * when the app screen was mutated to prove it could fail. Substring
   * matching is biased toward passing — the same trap `configConsumer.test.ts`
   * documents — and a gate that cannot go red is not a gate.
   */
  const renders = (src: string, c: string) => new RegExp(`<${c}[\\s/>]`).test(src)

  it.each(SCREENS)('$tab shows what $appScreen shows', ({ appScreen, components }) => {
    const app = screenSource(appScreen)
    for (const c of components) {
      expect(renders(app, c), `${appScreen} should render ${c} — if it no longer does, the marketing still is now fiction`)
        .toBe(true)
      expect(renders(tabbed, c), `the marketing ${appScreen.replace('Screen', '')} tab should render the real ${c}`)
        .toBe(true)
    }
  })

  it('renders the shared components rather than redrawing them', () => {
    // Every component the still renders must be imported from the app's own
    // tree, never defined locally. A local `function PlanArc` would satisfy
    // the check above and be a drawing.
    for (const c of SCREENS.flatMap(s => s.components)) {
      expect(tabbed, `${c} must be imported, not redrawn`).toMatch(
        new RegExp(`import (\\\\{ )?${c}.*from '@/components/`)
      )
      expect(tabbed).not.toMatch(new RegExp(`^\\\\s*function ${c}\\\\b`, 'm'))
    }
  })

  it('puts the rings INSIDE Kit’s read, as the app does', () => {
    // CoachScreen's own comment: "THE WEEK, PICTURED — one card with the read,
    // not a second one." The rings take `chromeless` for exactly this. A
    // second bordered card under the read is a bug the product already fixed.
    expect(read('app/dashboard/DashboardClient.tsx')).toContain('chromeless')
    expect(tabbed, 'ZoneRings in the Coach still must be chromeless — one card, not two')
      .toMatch(/<ZoneRings[^>]*chromeless/)
  })

  it('takes the plan from the engine and the figures from demoSurfaces', () => {
    // The weeks are generated, not transcribed — the same call the published
    // plan pages make. It happens on the SERVER (see demoPlanScreen.ts); this
    // file is a client component and must only receive the data.
    const code = tabbed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(tabbed).toContain('DemoPlanScreen')
    expect(code, 'the engine must not be imported into a client bundle')
      .not.toContain('generateRulePlan')
    for (const d of ['DEMO_ZONE_WEEK', 'DEMO_COACH_NOTE']) {
      expect(code, `${d} is the shared figure; a local copy would drift`).toContain(d)
    }
  })

  it('hand-draws no primitive that already exists as a component', () => {
    // The first cut hand-drew zone bars while components/shared/ZoneBar.tsx
    // calls itself "the canonical zone-visualisation primitive".
    const code = tabbed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code, 'a hand-drawn zone bar is a redrawn primitive').not.toMatch(/width:\s*`?\$\{?\s*z\.pct/)
    expect(code, 'zone percentages belong to ZoneRings, not to a local array').not.toMatch(/const ZONES\b/)
  })

  it('asserts no metric the product does not state', () => {
    const code = tabbed.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    // The exact fabrication that shipped. Kept as a literal because the
    // failure was a specific invented sentence, not a category.
    expect(code).not.toContain('Target is 80%')
    // A week count typed by hand would drift from the generated plan, and
    // DATE-DST-01 means the engine itself can return one week short.
    expect(code, 'read the week count from the plan, never type it').not.toMatch(/of 1[26]\b/)
  })

  it('opens on Today, because Today is the product\u2019s argument', () => {
    // The homepage phone must land on Today. Plan and Coach are what the app
    // ALSO does; Today is "one job per screen" made visible, and it is the
    // screen the hero copy is about. Checked on the page, not just on the
    // component's default, because a stray `initial` prop would be invisible
    // to a default-value assertion.
    expect(tabbed).toMatch(/initial\s*=\s*'Today'/)
    const page = read('app/page.tsx')
    const tag = page.match(/<TabbedPhone[^>]*\/?>/)
    expect(tag, 'the homepage should render TabbedPhone').not.toBeNull()
    expect(tag![0], 'do not pass `initial` on the homepage \u2014 it must open on Today')
      .not.toMatch(/\binitial\b/)
  })

  it('reuses the Today still rather than redrawing it', () => {
    // The one screen the first cut got right, because it was reused.
    expect(tabbed).toContain('TodayStill')
    expect(tabbed).not.toMatch(/function TodayStill\b/)
  })
})
