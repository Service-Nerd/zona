// Coaching Board 2026-10-30 (GTM-SEO-COMPARE-01 page 8, CORRECT WITH AMENDMENT). The draft compared max-HR and
// heart-rate-reserve zones at the SAME percentages and concluded they disagree; with the bands the engine actually uses
// (§14, GENERATION_CONFIG.ZONES.Z2) they land close. It also said "one hard session a week" and gave the hard-run advice
// without §110 Am.2's beginner qualifier. This file holds the page to the ruling.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getArticle, ZONE2_EXAMPLE, MAX_HARD_SESSIONS_PER_WEEK } from './articles'
import { GENERATION_CONFIG } from '../plan/generationConfig'

const article = getArticle('what-is-zone-2-running')!
const text = JSON.stringify(article.body)
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five']

describe('page 8 — what is zone 2 running', () => {
  it('exists, and links pages 3 and 6 and guide 1', () => {
    expect(article).toBeTruthy()
    for (const href of ['/why-your-easy-runs-arent-easy', '/best-running-app-for-beginners', '/guides/should-easy-runs-feel-this-slow']) {
      expect(text).toContain(`"href":"${href}"`)
    }
  })

  it('🔴 the zone example uses the engine\'s own zone 2 bands, never one band on both bases', () => {
    const z2 = GENERATION_CONFIG.ZONES.Z2
    expect(ZONE2_EXAMPLE.maxPct).toEqual(z2.maxhr_pct)
    expect(ZONE2_EXAMPLE.reservePct).toEqual(z2.karvonen_pct)
    expect(ZONE2_EXAMPLE.maxPct).not.toEqual(ZONE2_EXAMPLE.reservePct)
    expect(text).toContain(`${z2.maxhr_pct[0]} to ${z2.maxhr_pct[1]} percent of maximum`)
    expect(text).toContain(`${z2.karvonen_pct[0]} to ${z2.karvonen_pct[1]} percent of heart rate reserve`)
  })

  it('the published figures are the arithmetic, worked from 188 and 48', () => {
    expect(ZONE2_EXAMPLE.byMax).toEqual([132, 150])
    expect(ZONE2_EXAMPLE.byReserve).toEqual([132, 146])
    expect(text).toContain('that is 132 to 150 beats per minute')
    expect(text).toContain('it is 132 to 146')
    // The draft's mismatched-band figures cannot come back.
    expect(text).not.toMatch(/113 to 132|only just touch|more than the width of the zone/)
  })

  it('the source interpolates the figures rather than typing them', () => {
    const src = fs.readFileSync(path.join(__dirname, 'articles.ts'), 'utf8')
    const i = src.indexOf("slug: 'what-is-zone-2-running'")
    const entry = src.slice(i, src.indexOf('// ── GUIDE 1', i))
    expect(entry).toContain('${ZONE2_EXAMPLE.byMax[0]}')
    expect(entry).not.toMatch(/132 to 150|132 to 146|£\d/)
  })

  it('no per-week hard-session count the engine does not guarantee', () => {
    expect(text).not.toMatch(/one hard session a week|one or two hard/)
    expect(text).toContain(`no week has more than ${WORDS[MAX_HARD_SESSIONS_PER_WEEK]} hard ones`)
  })

  it('the hard-run advice carries the beginner qualifier (§110 Am.2, Willy binding)', () => {
    expect(text).toContain('If you are new to running, easy running alone will make you faster for a while')
    expect(text).toContain('If you have been running a while, keep one run a week properly hard')
  })

  it('pages 6 and 3 link back to page 8', () => {
    for (const slug of ['why-your-easy-runs-arent-easy', 'best-running-app-for-beginners']) {
      expect(JSON.stringify(getArticle(slug)!.body), slug).toContain('"href":"/what-is-zone-2-running"')
    }
  })
})
