// Coaching Board 2026-10-23 (GTM-SEO-COMPARE-01 page 6, CORRECT WITH AMENDMENT). The page first said "one hard session
// a week" (untrue for 21% of plans) and gave unqualified "keep one run a week properly hard" advice that §110 Am.2
// withholds from beginners. The per-week ceiling is now read from §8's config; this file holds the copy to that.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getArticle, MAX_HARD_SESSIONS_PER_WEEK } from './articles'
import { cohortGrid, COHORT_PLAN_START } from '../plan/cohortGrid'
import { generateRulePlan } from '../plan/ruleEngine'

const article = getArticle('why-your-easy-runs-arent-easy')!
const text = JSON.stringify(article.body)
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five']

describe('page 6 — what it says about hard sessions matches the engine', () => {
  it('states the ceiling in words derived from QUALITY_SESSIONS_PER_WEEK_MAX', () => {
    expect(text).toContain(`never has more than ${WORDS[MAX_HARD_SESSIONS_PER_WEEK]} hard sessions in a week`)
    expect(text).toContain(`no week has more than ${WORDS[MAX_HARD_SESSIONS_PER_WEEK]} hard ones`)
  })
  it('the source interpolates the ceiling rather than typing it', () => {
    // Bounded to page 6's own entry: page 8 (2026-10-30) carries the same ruled wording, so a file-wide count of 1 broke.
    const file = fs.readFileSync(path.join(__dirname, 'articles.ts'), 'utf8')
    const at = file.indexOf("slug: 'why-your-easy-runs-arent-easy'")
    const src = file.slice(at, file.indexOf('// ── COMPARISON 7', at))
    expect(at).toBeGreaterThan(0)
    expect(src.match(/never has more than \$\{NUMBER_WORDS\[MAX_HARD_SESSIONS_PER_WEEK\]\}/g)?.length).toBe(1)
    expect(src.match(/no week has more than \$\{NUMBER_WORDS\[MAX_HARD_SESSIONS_PER_WEEK\]\}/g)?.length).toBe(1)
  })
  it('no per-week count the engine does not guarantee', () => {
    expect(text).not.toMatch(/one hard session a week|one or two hard/)
  })
  it('🔴 nor anywhere else the runner reads it: the charity page and the FAQ owner said it until 2026-10-29', () => {
    const roots = ['app', 'components', 'lib']
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f)
        if (fs.statSync(p).isDirectory()) { if (f !== 'node_modules') walk(p); continue }
        if (!/\.(ts|tsx)$/.test(f) || /\.test\./.test(f)) continue
        // Strings only: a comment recording the old wording is history, not copy.
        const strings = fs.readFileSync(p, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l))
        if (strings.some(l => /one hard session a week/.test(l))) hits.push(p)
      }
    }
    for (const r of roots) walk(path.join(__dirname, '../..', r))
    expect(hits).toEqual([])
  })
  it('the "harder work" advice carries the beginner qualifier (§110 Am.2, Willy binding)', () => {
    expect(text).toContain('If you are new to running, easy running alone will make you faster for a while')
    expect(text).toContain('If you have been running a while, keep one run a week properly hard')
  })
  it('generated plans never put more quality sessions in a week than the page says', () => {
    const grid = cohortGrid()
    let weeks = 0, worst = 0
    for (let i = 0; i < grid.length; i += 401) {
      let plan: any
      try { plan = generateRulePlan(grid[i], 'paid', COHORT_PLAN_START) } catch { continue }
      for (const w of plan.weeks) {
        const n = (Object.values(w.sessions).flat() as any[]).filter(s => s && ['quality', 'intervals', 'tempo', 'hard'].includes(s.type)).length
        weeks++; worst = Math.max(worst, n)
      }
    }
    expect(weeks).toBeGreaterThan(1000)
    expect(worst).toBeLessThanOrEqual(MAX_HARD_SESSIONS_PER_WEEK)
  })
})
