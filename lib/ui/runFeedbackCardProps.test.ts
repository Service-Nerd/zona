import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// POSTRUN-CONTEXT-TWIN-01 + POSTRUN-METRIC-PREF-01 — every RunFeedbackCard in the
// tree is handed the same context, or the build fails.
//
// 🔴 THE CARD HAD THREE CALL SITES AND THEY DID NOT AGREE, TWICE OVER, AND BOTH
// TIMES THE SHORTFALL WAS INVISIBLE. `POST-RUN-CONTEXT-01` added `driftContext` —
// the block-level count that makes one run mean something ("third of your last eight
// easy runs above the ceiling") — and passed it at the SessionScreen reflect view and
// in `/post-run-preview`, but not at `PostRunScreen`, the surface the feature is
// named after. `preferredMetric` was the same story one prop over.
//
// ⚠️ BOTH PROPS ARE OPTIONAL WITH A FALLBACK DEFAULT, WHICH IS THE WHOLE MECHANISM.
// Nothing errors, nothing warns, and the card renders perfectly: one line shorter, or
// one axis wrong. A defaulted optional prop is how a missing consumer looks like a
// finished one. The compiler cannot help, so this does.
//
// ⚠️ SOURCE-SHAPED, AND DECLARED AS SUCH — the same limit `postRunPaceWired.test.ts`
// records. `RunFeedbackCard` lives inside a 14k-line 'use client' module and
// `vitest.config.ts` is `environment: 'node'` with no jsdom, so no call site can be
// mounted here. This proves the WIRING. `/post-run-preview` is where the rendered
// sentence is looked at, by eye.
//
// ⚠️ AND THE CALL SITES ARE DISCOVERED, NEVER LISTED. A hand-maintained list of
// guarded files is blind to the file nobody added to it, which this repo has recorded
// as a class of its own — most recently when extracting copy into `lib/ui` moved it
// out of the em-dash guard's population. A fourth call site anywhere under `app/` or
// `components/` is picked up on the way in.

const ROOTS = ['app', 'components']

/** Every prop a RunFeedbackCard needs in order to say everything it can say. */
const REQUIRED_PROPS = [
  'analysis',
  // POST-RUN-CONTEXT-01: without it the card silently renders one line shorter.
  'driftContext',
  // POSTRUN-METRIC-PREF-01: without it the planned-vs-actual line speaks kilometres
  // to a runner who chose minutes.
  'preferredMetric',
] as const

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(p, out)
    } else if (/\.tsx$/.test(entry)) {
      out.push(p)
    }
  }
  return out
}

/** Blank comments so `<RunFeedbackCard` named in prose is not read as a call site,
 *  preserving length so slice offsets stay honest. */
const blankComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, m => ' '.repeat(m.length))
     .replace(/\/\*[\s\S]*?\*\//g, m => ' '.repeat(m.length))
     .replace(/(?<!:)\/\/[^\n]*/g, m => ' '.repeat(m.length))

type Site = { file: string; props: string }

function callSites(): Site[] {
  const sites: Site[] = []
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const src = blankComments(readFileSync(file, 'utf8'))
      let i = src.indexOf('<RunFeedbackCard')
      while (i !== -1) {
        // Bound the region at the element's own close. `/>` is used rather than `>`
        // because a lone `>` is also the tail of `=>`, which is how a prop reader in
        // this repo once stopped mid-element and read the wrong props.
        const end = src.indexOf('/>', i)
        expect(end, `${file}: unterminated <RunFeedbackCard`).toBeGreaterThan(-1)
        sites.push({ file, props: src.slice(i, end) })
        i = src.indexOf('<RunFeedbackCard', end)
      }
    }
  }
  return sites
}

describe('RunFeedbackCard call sites all carry the same context', () => {
  it('finds every call site in the tree', () => {
    const sites = callSites()
    // Three today: SessionScreen's reflect view, PostRunScreen, /post-run-preview.
    // This asserts a FLOOR, not the exact number, so adding a fourth site does not
    // fail here — it fails the arm below, which is the useful failure.
    expect(sites.length).toBeGreaterThanOrEqual(3)
    const files = new Set(sites.map(s => s.file))
    expect(files.has('app/dashboard/DashboardClient.tsx')).toBe(true)
  })

  it('every call site passes every required prop', () => {
    const missing: string[] = []
    for (const site of callSites()) {
      for (const prop of REQUIRED_PROPS) {
        // `prop={` — the prop must be given a value, not merely mentioned.
        if (!new RegExp(`\\b${prop}=\\{`).test(site.props)) {
          missing.push(`${site.file}: missing ${prop}`)
        }
      }
    }
    expect(missing).toEqual([])
  })

  it('PostRunScreen specifically, because it is the site that was wrong', () => {
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    const screen = src.indexOf('function PostRunScreen(')
    expect(screen, 'PostRunScreen not found — this check has stopped looking').toBeGreaterThan(-1)
    const card = src.indexOf('<RunFeedbackCard', screen)
    const props = src.slice(card, src.indexOf('/>', card))
    expect(props).toContain('driftContext={driftContext}')
    expect(props).toContain('preferredMetric={preferredMetric}')
  })

  it('and PostRunScreen is actually HANDED a drift context, not just forwarding null', () => {
    // The trap one level up: threading the prop through while the parent passes
    // nothing would satisfy the arm above and change nothing on screen. The parent
    // must call the same helper SessionScreen's render already calls.
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    const render = src.indexOf('<PostRunScreen')
    expect(render).toBeGreaterThan(-1)
    const props = src.slice(render, render + 1200)
    expect(props).toMatch(/driftContext=\{buildDriftContext\(/)
    expect(props).toContain('preferredMetric={preferredMetric}')
  })
})
