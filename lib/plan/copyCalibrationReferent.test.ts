// COPY-CALIBRATION-REFERENT-01 — Coaching Board follow-on, 2026-10-07.
//
// Founder, after `STEP-NOTE-SELF-CONTAINED-01` shipped: *"Is there any way to do
// a scan or determine when those kinds of sentences would be presented in other
// scenarios?"* Yes — but not the obvious scan.
//
// 🔴 MATCHING SESSION NAMES WAS 97% NOISE. Deriving nouns from the catalogue and
// grepping every runner-facing string gave **3,920 hits across 748 plans**, and
// almost all were English: *"Time on feet is the point"* is not a reference to
// the `time_on_feet` session, and *"your race benchmark"* is the runner's own
// number. A gate that noisy gets switched off, which this repo records as
// equivalent to having no gate (NOISE-GATE-01, recorded twice).
//
// ✅ THE SIGNAL IS THE CONSTRUCTION, NOT THE NOUN. The defect is a sentence that
// calibrates effort against **an experience the runner may not have had**. So the
// test is: find every calibration, then check WHAT IT POINTS AT. Measured across
// **125,302 runner-facing strings from 748 plans**: 2,756 calibrations, and after
// the cruise-set fix every one points at the runner's own pace, their own effort,
// their own benchmark, or an earlier part of the session they are standing in.
//
// ⚠️ WHAT THIS DOES NOT COVER: AI enrichment. The model can write any sentence it
// likes and this reads rule-engine output only. `enrich.ts`'s prompts are the
// other half and are not gated here.
import { describe, it, expect } from 'vitest'
import { cohortGrid, COHORT_PLAN_START } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { Plan, GeneratorInput } from '@/types/plan'

const STRIDE = 131

/** Every string a runner can read — INCLUDING `derived_set` step notes, which the
 *  older `emittedCopyGlyphs` walker does not collect, and which is exactly where
 *  the cruise-set sentence lived for months. */
function runnerStrings(plan: Plan): { field: string; text: string }[] {
  const out: { field: string; text: string }[] = []
  for (const [k, v] of Object.entries(plan.meta ?? {})) if (typeof v === 'string') out.push({ field: `meta.${k}`, text: v })
  for (const wk of plan.weeks ?? []) {
    for (const f of ['theme', 'label'] as const) {
      const v = (wk as unknown as Record<string, unknown>)[f]
      if (typeof v === 'string') out.push({ field: `week.${f}`, text: v })
    }
    for (const s of Object.values(wk.sessions ?? {})) {
      const sn = s as unknown as Record<string, unknown> | null
      if (!sn || typeof sn !== 'object') continue
      for (const f of ['description', 'why', 'difficulty_note', 'weekday_overrun_note', 'run_walk_strategy'])
        if (typeof sn[f] === 'string') out.push({ field: `session.${f}`, text: sn[f] as string })
      for (const n of (sn.coach_notes as string[] | undefined) ?? [])
        if (typeof n === 'string') out.push({ field: 'session.coach_notes', text: n })
      const ds = sn.derived_set as { blocks?: { steps?: { note?: string }[] }[] } | undefined
      for (const b of ds?.blocks ?? []) for (const st of b.steps ?? [])
        if (typeof st.note === 'string') out.push({ field: 'step.note', text: st.note })
    }
  }
  return out
}

/** A sentence that calibrates effort by comparison. */
const CALIBRATION = [
  /\bsame\s+(?:effort|pace|feel(?:ing)?|rhythm|intensity)\s+as\s+([^.;]*)/i,
  /\bas\s+(?:hard|easy|fast|slow|comfortable)\s+as\s+([^.;]*)/i,
  /\b(?:harder|easier|faster|slower|quicker)\s+than\s+([^.;]*)/i,
  /\b(?:feels?|should feel|run it|treat it)\s+like\s+([^.;]*)/i,
  /\bas\s+you\s+(?:did|ran|felt)\s+([^.;]*)/i,
]

/**
 * A calibration fails when what it points at NAMES A SESSION.
 *
 * ⚠️ TWO FILTERS, AND BOTH ARE LOAD-BEARING. The construction alone is noise
 * (2,756 hits, nearly all legitimate: *"as hard as you can hold"*, *"slower than
 * feels right"*). The session noun alone is noise too (3,920 hits: *"Time on feet
 * is the point"* is English, *"your race benchmark"* is the runner's own number).
 * **A comparison WHOSE REFERENT is a session is the defect**, and nothing else is.
 *
 * ⚠️ I FIRST WROTE THIS AS AN ALLOW-LIST of self-referential targets and it flagged
 * 22 sentences, every one a false positive — 21 of them *"slower than feels
 * right"*. Widening an allow-list until it goes green is how a gate stops meaning
 * anything; the shape was wrong, not the width.
 *
 * Nouns are DERIVED from the catalogue, never hand-listed, plus the generic names
 * a runner would read as a session but the catalogue does not spell.
 */
const SESSION_NOUNS: RegExp = (() => {
  const fromCatalogue = (V1_SESSION_CATALOGUE as { name: string }[])
    .map(r => r.name.replace(/\s+\u2014.*$/, '').toLowerCase())
    .filter(n => n.length >= 6 && !/^time on feet$/.test(n))
  const generic = ['cruise set', 'cruise interval', 'tempo run', 'time trial', 'parkrun', 'fartlek', 'long run', 'race simulation']
  const all = Array.from(new Set([...fromCatalogue, ...generic]))
    .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(`\\b(?:${all.join('|')})s?\\b`, 'i')
})()

describe('COPY-CALIBRATION-REFERENT-01 — a comparison points at something the runner HAS', () => {
  const grid = cohortGrid() as GeneratorInput[]
  const found: { field: string; text: string; referent: string }[] = []
  let strings = 0, calibrations = 0
  for (let i = 0; i < grid.length; i += STRIDE) {
    let plan: Plan
    try { plan = generateRulePlan(grid[i]!, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch { continue }
    for (const { field, text } of runnerStrings(plan)) {
      strings++
      for (const re of CALIBRATION) {
        const m = text.match(re)
        if (!m) continue
        calibrations++
        const referent = (m[1] ?? '').trim()
        if (SESSION_NOUNS.test(referent)) found.push({ field, text, referent })
      }
    }
  }

  it('the corpus is real and contains calibrations', () => {
    expect(strings, 'no runner-facing strings — the walker has drifted').toBeGreaterThan(10000)
    expect(calibrations, 'no calibration sentences found at all, so the arm below is vacuous').toBeGreaterThan(200)
  })

  it('no calibration points at ANOTHER SESSION', () => {
    const uniq = Array.from(new Map(found.map(f => [f.text, f])).values())
    expect(uniq.map(f => `${f.field}: "${f.text}"  → points at: "${f.referent}"`),
      `${uniq.length} sentence(s) calibrate the runner against something outside their own ` +
      'experience. A runner who has never been prescribed that session cannot act on it — and ' +
      '`progressive_tempo`, where this was found, is eligible from BASE phase.').toEqual([])
  })
})
