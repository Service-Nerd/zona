// GTM-SITE-03 — the founder story may not be told twice.
//
// It appears on two surfaces: `/about` on the web and `FounderNoteScreen` in the
// app. The TREATMENT divergence is deliberate and must survive — the web page
// carries a photograph because a charity vetting a stranger needs a face; the
// in-app note has none, because there the voice is the asset. This test does not
// touch that. It guards the NARRATIVE, which was drifting:
//
//   /about : "A plateau that WOULD NOT move" · "easy days WERE NOT easy, hard
//            days WERE NOT hard, AND everything ended..."
//   app    : "A plateau that WOULDN'T move" · "easy days WEREN'T easy. Hard
//            days WEREN'T hard. Everything ended... — medium-hard on Monday"
//
// Same story, two files, two wordings, no way to tell which was canonical. And
// the thesis line was hardcoded in both with DIFFERENT apostrophe entities
// (`&rsquo;` vs `&apos;`), so one sentence rendered as two different characters.
//
// A written rule would not have held this — the repo has watched the canonical
// host, the config-principle sync and the deload cadence all drift while a doc
// said they should not. So it is a test.
//
// If this fails: put the words in `lib/marketing/founderStory.ts` or
// `BRAND.coreTruth` and render them from there. Do not re-inline.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FOUNDER_STORY } from './founderStory'
import { BRAND } from '@/lib/brand'

const SURFACES = ['app/about/page.tsx', 'app/dashboard/FounderNoteScreen.tsx'] as const

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

/** Strip code comments — an explanatory comment quoting the old copy is fine. */
const codeOnly = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

/** Apostrophes vary by entity; compare on the letters that carry the meaning. */
const flatten = (s: string) =>
  s.toLowerCase().replace(/&rsquo;|&apos;|&#39;|[’']/g, '').replace(/\s+/g, ' ')

describe('GTM-SITE-03 — one founder story, one owner', () => {
  it('both surfaces render from the shared owner', () => {
    for (const rel of SURFACES) {
      expect(codeOnly(read(rel)), `${rel} must import FOUNDER_STORY`).toContain('FOUNDER_STORY')
    }
  })

  it('neither surface hardcodes the narrative', () => {
    // A distinctive fragment of each paragraph — enough to catch a re-inline,
    // short enough to survive a legitimate reword in the owner.
    const fragments = [
      FOUNDER_STORY.opener,
      'heart rate spiking before the warm-up',
      'the diagnosis took embarrassingly long',
      'so the runner built a tool',
    ].map(flatten)

    for (const rel of SURFACES) {
      const body = flatten(codeOnly(read(rel)))
      for (const frag of fragments) {
        expect(body, `${rel} hardcodes "${frag.slice(0, 40)}…" — render it from FOUNDER_STORY`).not.toContain(frag)
      }
    }
  })

  it('neither surface hardcodes the core truth — it is BRAND.coreTruth', () => {
    const truth = flatten(BRAND.coreTruth)
    for (const rel of SURFACES) {
      expect(flatten(codeOnly(read(rel))), `${rel} hardcodes the core truth`).not.toContain(truth)
      expect(codeOnly(read(rel)), `${rel} must render BRAND.coreTruth`).toContain('coreTruth')
    }
  })

  it('the core truth is parameterised and uses a typographic apostrophe', () => {
    expect(BRAND.coreTruth).toBe('You’re trying hard. That’s the problem.')
    expect(BRAND.coreTruth).not.toContain("'")
  })

  it('the story is non-empty and ordered', () => {
    expect(FOUNDER_STORY.paragraphs.length).toBe(3)
    expect(FOUNDER_STORY.paragraphs.every(p => p.trim().length > 40)).toBe(true)
  })
})
