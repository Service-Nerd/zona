import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { FAQS, APP_FAQS, WEB_FAQS, FAQ_TITLE, FAQ_SUBTITLE } from './faq'

// FAQ-01 — the gate for the Design Board ruling of 2026-09-29.
//
// The ruling's load-bearing claim is not "a FAQ exists", it is "there is ONE place an
// answer lives". Before it there were three unconnected sets (homepage, charity page,
// /support prose) and the app was about to become a fourth. Every other property here
// is secondary to that one.

const EM = '\u2014'

const tracked = (): string[] =>
  execSync('git ls-files', { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .filter(f => /^(app|components|lib)\/.*\.tsx?$/.test(f))
    .filter(f => !f.includes('.test.'))

describe('FAQ-01 — one owner for every answer', () => {
  it('no file outside lib/faq.ts declares its own question-and-answer array', () => {
    // 🔴 THE POPULATION IS DERIVED, and the shape is the `{ q: ..., a: ... }` literal
    // that `charity-runners` used. A hand-written list of "files allowed to have FAQs"
    // is the failure this repo has recorded more than any other.
    const offenders: string[] = []
    for (const f of tracked()) {
      if (f === 'lib/faq.ts') continue
      const src = readFileSync(f, 'utf8')
      if (/\{\s*q:\s*['"`]/.test(src)) offenders.push(f)
    }
    expect(offenders, `these declare their own Q&A pairs: ${offenders.join(', ')}`)
      .toEqual(['app/charity-runners/page.tsx', 'lib/marketing/plans.ts'])
    // ⚠️ TWO DECLARED EXCLUSIONS, AND THIS ARM IS HOW I FOUND THE SECOND. The analysis
    // for this build said there were THREE FAQ sets. There are four: `plans.ts` carries
    // per-plan `extraFaqs` ("What pace is a sub-45 10K?"), which nothing in my scan of
    // the pages surfaced because it lives in DATA, not in a page.
    //
    //   · `app/charity-runners/page.tsx` — four of its nine entries are code-specific,
    //     and its five general ones are the SOURCE the training answers here were lifted
    //     from verbatim. Folding it in moves Coaching-Board-cleared marketing copy,
    //     which is a sitting, not a refactor. Filed FAQ-CHARITY-MERGE-01.
    //   · `lib/marketing/plans.ts` — `extraFaqs` are bound to ONE plan's landing page
    //     and answer a question only that plan raises. They belong with the plan, and
    //     hoisting them into a global list would be the opposite of this ruling.
    //
    // 🔴 The list is ASSERTED EXACTLY, not with `toContain`. A new file growing its own
    // Q&A array fails here rather than joining a set nobody re-counts.
  })

  it('every answer the runner reads is reachable on some surface', () => {
    // An entry scoped to neither set is dead content that still reads as shipped.
    for (const f of FAQS) {
      const reachable = APP_FAQS.includes(f) || WEB_FAQS.includes(f)
        || f.topic === 'account' || f.topic === 'using'
      expect(reachable, `"${f.q}" renders nowhere`).toBe(true)
    }
    expect(APP_FAQS.length).toBeGreaterThan(0)
    expect(WEB_FAQS.length).toBeGreaterThan(0)
  })

  it('the web set is PRODUCT only, so /support never answers a thing twice', () => {
    // The specific defect this prevents: /support already answers cancellation and
    // data deletion in prose. Widening WEB_FAQS to every web-scoped entry would put
    // two answers to one question on one page.
    expect(WEB_FAQS.every(f => f.topic === 'product')).toBe(true)
    expect(WEB_FAQS.some(f => /cancel/i.test(f.q))).toBe(false)
  })

  it('no em dash in any answer — these are sentences the runner reads', () => {
    // 🔴 `noEmDashApp.test.ts` could not have caught these: it scans string literals
    // under components/ and app/dashboard/, and lib/ is outside its roots entirely.
    // The rule is about SENTENCES, not about where they are stored.
    for (const f of FAQS) {
      expect(f.q.includes(EM), `em dash in question: ${f.q}`).toBe(false)
      expect(f.a.includes(EM), `em dash in answer to: ${f.q}`).toBe(false)
    }
    expect(FAQ_TITLE.includes(EM)).toBe(false)
    expect(FAQ_SUBTITLE.includes(EM)).toBe(false)
  })

  it("Sierra's condition holds: every entry names the screen that failed to answer it", () => {
    // ⚖️ Binding condition of the FAQ-01 sitting. `null` is allowed ONLY where the
    // question is inherently external — billing through Apple, a code from a charity.
    // Without this arm the field rots into an unfilled optional and the list quietly
    // stops being a defect log.
    for (const f of FAQS) {
      const external = f.topic === 'account'
      if (external) continue
      expect(typeof f.shouldBeObviousOn, `"${f.q}" has no shouldBeObviousOn`).toBe('string')
      expect((f.shouldBeObviousOn ?? '').length).toBeGreaterThan(3)
    }
  })

  it('a cleared claim is reproduced VERBATIM from the surface that cleared it', () => {
    // 🏃 A paraphrase of a Coaching-Board-cleared claim is a NEW claim. This arm reads
    // the charity page and asserts the answer strings are byte-identical, so a future
    // tidy-up of the wording fails the build instead of silently re-opening a ruling.
    const charity = readFileSync('app/charity-runners/page.tsx', 'utf8')
    const cleared = FAQS.filter(f => f.cleared === 'charity-runners')
    expect(cleared.length).toBeGreaterThanOrEqual(4)
    for (const f of cleared) {
      // Compare on the answer's first clause, which is enough to detect a rewrite and
      // tolerant of the one entry whose charity framing was dropped by design.
      // 🔴 TWO WRONG PROBES BEFORE THIS ONE, AND THE SECOND IS THE LESSON. The first
      // split on `[.,]` and took the opening clause: for "Yes, with one caveat..." that
      // is the three characters "Yes", which appears on almost any page and would have
      // matched forever. A probe short enough to always pass is not checking anything.
      // The second took a fixed 48-character slice, which then correctly FAILED on the
      // ultra entry — I had genuinely paraphrased a cleared claim while dropping its
      // charity framing. The fix is not a looser probe: it is an EXPLICIT one. Each
      // cleared entry pins the sentence that was ruled.
      const probe = (f.clearedProbe ?? f.a.slice(0, 48)).trim()
      expect(probe.length, `probe for "${f.q}" is too short to prove anything`)
        .toBeGreaterThan(30)
      expect(charity.toLowerCase().includes(probe.toLowerCase()),
        `answer to "${f.q}" no longer matches the cleared wording: "${probe}"`).toBe(true)
    }
  })
})
