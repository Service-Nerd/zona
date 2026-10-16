import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * COPY-VOICE-01 — the site speaks as one person, because it is one person.
 *
 * ⚠️ THIS IS A TRUST ARGUMENT, NOT A STYLE PREFERENCE. /about's whole case is
 * "you are not being asked to trust a brand, you are being asked to trust
 * someone who will answer the email himself", and a charity vetting a
 * stranger is the reader it is written for. A corporate "we" three sections
 * away contradicts it. Before this, the founder story was told in the THIRD
 * person while the homepage said "that's how I know" in the first.
 *
 * ⚠️ TWO DELIBERATE EXCEPTIONS, both checked rather than excluded silently:
 *   · Code comments. They are not copy (brand.md says the same of em dashes).
 *   · Kit's coaching voice, where "the pattern we are trying to break" means
 *     the coach AND the runner. That is a collective first person, not a
 *     corporate one, and flattening it to "I" would make the coach sound like
 *     it is training alone.
 */

const ROOT = path.resolve(__dirname, '../..')

const SURFACES = [
  'app/page.tsx', 'app/plans', 'app/pricing', 'app/about', 'app/charity-runners',
  'app/support', 'components/marketing', 'lib/marketing',
]

/**
 * ⚠️ EXEMPTIONS ARE LISTED, NOT OMITTED. The first cut of this test named
 * four files inside lib/marketing instead of the directory, which "passed"
 * by not looking at demoSurfaces.ts at all while the comment above claimed
 * that file was a considered exception. A gate whose scope quietly excludes
 * its own hard case is the shape of a green tick with nothing behind it, and
 * this repo has enough of those.
 */
const EXEMPT = [
  // Pre-launch component, currently unmounted anywhere.
  'components/marketing/WaitlistForm.tsx',
  // Kit's coaching voice. "The pattern we are trying to break" means the
  // coach AND the runner: a collective first person, not a corporate one.
  // Flattening it to "I" would make the coach sound like it trains alone.
  'lib/marketing/demoSurfaces.ts',
]

/**
 * ⚠️ PHRASE-LEVEL EXEMPTIONS, for a "we" that is not the company speaking. Each is
 * an exact string, so the same word anywhere else in the same line still fails.
 * Added 2026-10-16 with `do-i-need-a-running-coach`; the file stays in scope.
 */
const EXEMPT_PHRASES = [
  // A coach's trading name, in the `COACH_MARKET` source data. Never rendered.
  "coach: 'We Run'",
  // ...and its pricing page, in the same row's `source`.
  'we-run.co.uk/',
  // Runners collectively, the founder included ("an app only knows what you log, and
  // most of us log pace and distance, not pain"). The collective first person the Kit
  // exemption above already recognises, not a company voice.
  'most of us log pace and distance',
]

function walk(rel: string): string[] {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return /\.tsx?$/.test(abs) ? [rel] : []
  return fs.readdirSync(abs).flatMap(c => walk(path.join(rel, c)))
}

/** Comments are not copy. Strip them before matching, every time. */
const codeOnly = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

const files = Array.from(new Set(SURFACES.flatMap(walk)))
  .filter(f => !f.includes('.test.') && !EXEMPT.includes(f))

describe('singular voice', () => {
  it('covers a real set of files', () => {
    expect(files.length).toBeGreaterThanOrEqual(14)
  })

  it('uses no corporate first-person plural in visible copy', () => {
    const hits: string[] = []
    for (const f of files) {
      codeOnly(fs.readFileSync(path.join(ROOT, f), 'utf8')).split('\n').forEach((line, i) => {
        const m = EXEMPT_PHRASES.reduce((l, ph) => l.split(ph).join(''), line).match(/\b(we|our|ours|us)\b/i)
        if (m) hits.push(`${f}:${i + 1}  …${line.trim().slice(0, 100)}`)
      })
    }
    expect(hits, `first-person plural in marketing copy:\n${hits.join('\n')}`).toEqual([])
  })

  it('tells the founder story in the first person', () => {
    const story = fs.readFileSync(path.join(ROOT, 'lib/marketing/founderStory.ts'), 'utf8')
    const code = codeOnly(story)
    expect(code, 'the story reverted to the third person').not.toContain('the runner built')
    expect(code).toContain("opener: 'I had a problem.'")
  })

  it('does not describe a race in the future that has already been run', () => {
    const code = codeOnly(fs.readFileSync(path.join(ROOT, 'lib/marketing/founderStory.ts'), 'utf8'))
    // "Started training for a 100K" was written before July 2026 and stayed on
    // the page after it. A dated fact needs to say its date.
    expect(code).not.toContain('Started training for')
    expect(code).toContain('July 2026')
  })
})
