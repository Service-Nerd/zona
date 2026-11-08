import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// CHARITY-FAQ-RUNWAY-01 — /charity-runners IS FOR ANY CHARITY'S RUNNERS, AND IT
// HAD ALREADY BEEN FIXED FOR THIS ONCE.
//
// 🔴 THE REGRESSION, AND IT WAS MINE. On 2026-10-01 I added an FAQ answer reading
// "if you are setting this up in October for an April race there is no reason for a
// MARATHON BLOCK to start yet" — the timeline and the distance of the one charity
// whose codes happened to go out that morning. The page's own header records it
// being rewritten TWICE IN ONE DAY on founder calls, 2026-09-11, for exactly this:
//
//   "It was marathon-only in its URL, title, FAQs and CTAs. Charity places are most
//    often 10K and half marathon, with marathons and the odd ultra on top, so a
//    distance-shaped page turned most of its own audience away at the headline."
//
// ⚠️ THAT FIX WAS PROSE WITH NO CHECK, so it held exactly as long as someone
// remembered, which this repo records as not being a rule at all. Three weeks.
//
// ⚠️ IT GUARDS THE ANSWERS, NOT THE WHOLE FILE. The page legitimately links to a
// `marathon-16-week` plan and offers a "Half marathon" card: naming the distances it
// SUPPORTS is the opposite of assuming the reader's. What must not happen is an
// ANSWER telling a 10K runner about their marathon.

const PAGE = join(__dirname, '..', '..', 'app', 'charity-runners', 'page.tsx')

/** Every FAQ answer, derived from the source rather than hand-listed. */
function answers(): string[] {
  const src = readFileSync(PAGE, 'utf8')
  // Array.from, not spread: this repo's tsconfig names no `target` (CLAUDE.md
  // § TypeScript). No `s` flag either, so `.` cannot cross a line: one answer, one
  // source line, which is how the file is written.
  // A template literal counts too (CHARITY-PLAN-PREREQ-01 interpolates the plans' start points): reading only
  // single quotes let that answer leave the population this test guards.
  return Array.from(src.matchAll(/^    a: (['`])(.*)\1,$/gm)).map(m => m[2])
}

/**
 * The one answer allowed to name a month or a season, with its reason.
 *
 * ⚠️ It illustrates the TWELVE-MONTH MECHANIC ("redeem in December and it runs to the
 * following December"), not the reader's own race. An exemption without a reason
 * becomes a place to hide the next one, so it matches a specific phrase rather than
 * an index: re-ordering the FAQ must not silently widen it.
 */
const CALENDAR_EXEMPT = 'Redeem in December and it runs to the following December'

describe('/charity-runners does not assume the reader’s distance', () => {
  it('finds the answers at all — an empty population passes every arm below', () => {
    expect(answers().length).toBeGreaterThanOrEqual(9)
  })

  it('no answer speaks of THE reader’s marathon', () => {
    // "half marathon" is a distance name and stays legal. "your marathon", "a
    // marathon block", "the marathon" presume what the reader signed up for.
    const bad = answers()
      .filter(a => /\b(your|a|the)\s+marathon\b/i.test(a.replace(/half\s+marathon/gi, '')))
      .map(a => a.slice(0, 90))
    expect(bad, 'charity places are most often 10K and half marathon').toEqual([])
  })

  it('no answer dates the reader’s race to a month or a season', () => {
    const MONTHS = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i
    const SEASONS = /\b(spring|summer|autumn|winter)\b/i
    const bad = answers()
      .filter(a => !a.includes(CALENDAR_EXEMPT))
      .filter(a => MONTHS.test(a) || SEASONS.test(a))
      .map(a => a.slice(0, 90))
    expect(bad, 'a charity runner’s race can be in any month; say "months off", not "April"').toEqual([])
  })

  it('the calendar exemption still matches something, so it cannot rot into a blanket pass', () => {
    // If the illustrative sentence is reworded, the exemption must be re-examined
    // rather than silently covering a new offender.
    expect(answers().some(a => a.includes(CALENDAR_EXEMPT)),
      `the exempt phrase is gone from the page; delete the exemption or update it`).toBe(true)
  })
})

/**
 * CHARITY-AUDIENCE-HEADINGS-01 (2026-11-08) — THE GUARD ABOVE COVERS THE SURFACE WHERE THE
 * DEFECT RECURRED AND NOT THE SURFACE WHERE IT ORIGINALLY LIVED.
 *
 * 🔴 The page's own header records the 2026-09-11 rewrite in as many words: *"It was
 * marathon-only in its URL, title, FAQs and CTAs."* Four surfaces; the arms above read
 * **one** of them. The FAQ arms exist because I regressed the answers three weeks later — so
 * the check was built where the second failure happened, which is the natural place to build
 * it and the wrong place to stop.
 *
 * 📐 **RE-MEASURED 2026-11-08: the headings, hero, metadata and CTAs are CLEAN today.** The
 * only single-distance names outside the FAQ answers are the `DISTANCES` plan cards and the
 * plan slugs, both of which are the page naming what it SUPPORTS — the opposite of assuming
 * the reader's race. So this is a gate over correct copy, not a fix. **Stated because a gate
 * shipped over a clean surface reads like a fix, and the next reader should know nothing moved.**
 *
 * 🔑 WHAT VIOLATION CLASS IT FINDS. A heading, eyebrow, page title or OG title that names
 * ONE distance — which is the original defect exactly, and **invisible to the possessive rule
 * above**: *"Free marathon coaching for charity runners"* contains no *your / a / the*, so the
 * answers' own test would pass it. A heading naming one distance turns away the readers of the
 * other three, and charity places are most often 10K and half marathon.
 *
 * ⚠️ A RANGE IS NOT A DISTANCE CLAIM. The body says *"5K through ultra"*, which is the page
 * being inclusive, so the single-distance rule is scoped to HEADINGS and METADATA and the
 * looser possessive rule covers the body. Two surfaces, two rules, both named.
 *
 * ⚠️ EXEMPT BY REGION, NEVER BY PATTERN — the item's own instruction, and it matters: a
 * pattern permitting "Marathon" would also permit it in an `<H2>`. The `DISTANCES` array and
 * the `START` plan-slug block are cut out by their source bounds.
 */
describe('/charity-runners headings and metadata name no single distance', () => {
  const src = readFileSync(PAGE, 'utf8')

  /** A source region, cut out by its own bounds. Returns '' if the anchor is gone, which the
   *  population arm then catches rather than silently widening the scan. */
  function region(startAnchor: string, endAnchor: string): string {
    const a = src.indexOf(startAnchor)
    if (a < 0) return ''
    const b = src.indexOf(endAnchor, a)
    return b < 0 ? '' : src.slice(a, b + endAnchor.length)
  }

  const DISTANCES_BLOCK = region('const DISTANCES = [', ']')
  const START_BLOCK = region('const START = {', '}')
  const FAQS_BLOCK = region('const FAQS:', '\n]')

  /** Headings, eyebrows and the h1 — extracted from the source, not listed.
   *  ⚠️ The h1's text spans lines, so `[\s\S]` and a lazy close; `.` would not reach it. */
  function headings(): string[] {
    const out: string[] = []
    for (const tag of ['h1', 'H2', 'Eyebrow']) {
      const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g')
      for (const m of Array.from(src.matchAll(re))) out.push(m[1]!.replace(/\s+/g, ' ').trim())
    }
    return out
  }

  /** The metadata strings a search result and a share card show. */
  function metadataStrings(): string[] {
    const block = region('export const metadata', '})')
    return Array.from(block.matchAll(/(['\`])((?:(?!\1)[^\\])*)\1/g)).map(m => m[2]!)
      .filter(v => v.length > 12 && !v.startsWith('/'))
  }

  const SINGLE_DISTANCE = /\b(marathon|half[-\s]marathon|10\s?k|5\s?k|50\s?k|100\s?k|ultra)\b/i

  it('population: every region and surface this block depends on still exists', () => {
    // Each anchor, or the scan quietly covers more or less than it claims.
    expect(DISTANCES_BLOCK, 'the DISTANCES plan-card array').not.toBe('')
    expect(START_BLOCK, 'the START plan-slug block').not.toBe('')
    expect(FAQS_BLOCK, 'the FAQS array (owned by the arms above)').not.toBe('')
    expect(headings().length, 'headings found').toBeGreaterThanOrEqual(10)
    expect(metadataStrings().length, 'metadata strings found').toBeGreaterThanOrEqual(4)
    // And the exemptions must be REAL: the plan cards do name distances, which is why they
    // are cut out. An exemption over a region that holds no offender is decoration.
    expect(SINGLE_DISTANCE.test(DISTANCES_BLOCK), 'the DISTANCES block must actually name distances').toBe(true)
  })

  it('\u{1F534} no heading or eyebrow names a single distance', () => {
    const bad = headings().filter(h => SINGLE_DISTANCE.test(h))
    expect(
      bad,
      'The page was marathon-only in its title and CTAs once, and a heading naming one '
      + 'distance turns away the readers of the other three — charity places are most often '
      + `10K and half marathon. Name the distances in the plan CARDS, not the heading:\n${bad.join('\n')}`,
    ).toEqual([])
  })

  it('\u{1F534} no page title, description or OG string names a single distance', () => {
    const bad = metadataStrings().filter(v => SINGLE_DISTANCE.test(v))
    expect(
      bad,
      'This is the surface the 2026-09-11 rewrite was about — the URL and title. A search '
      + `result naming one distance loses the other three audiences before the click:\n${bad.join('\n')}`,
    ).toEqual([])
  })

  it('the slug stays distance-neutral', () => {
    // The URL was half the original defect and the fix is load-bearing: a distance in the
    // path cannot be rewritten later without losing the links.
    expect(src).toMatch(/path: '\/charity-runners'/)
    expect(SINGLE_DISTANCE.test('/charity-runners')).toBe(false)
  })

  it('no CTA or body copy outside the FAQ speaks of THE reader\'s race', () => {
    // The looser rule, over everything the arms above do not own. A RANGE is fine here;
    // what is not is presuming which one the reader signed up for.
    let rest = src
    for (const block of [DISTANCES_BLOCK, START_BLOCK, FAQS_BLOCK]) rest = rest.replace(block, '')
    // Comments are prose ABOUT the rule and quote the offending phrases verbatim — three of
    // them do, including the header. HOOK-RGBA-COMMENTS-01, for the fourth time.
    rest = rest
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
    const bad = Array.from(
      rest.replace(/half[-\s]marathon/gi, '').matchAll(/\b(your|a|the)\s+marathon\b/gi),
    ).map(m => rest.slice(Math.max(0, m.index! - 50), m.index! + 40).replace(/\s+/g, ' '))
    expect(bad, 'charity places are most often 10K and half marathon').toEqual([])
  })
})
