// RESHAPE-MOMENT-01 (Design Board, 2026-10-08) — the disclosure cannot drift from the engine.
//
// 🔴 THE DEFECT THIS REPLACES WAS A SYNC RULE ENFORCED BY A COMMENT:
//
//     SYNC RULE: keep in step with TriggerType in lib/coaching/planAdjustment.ts.
//     If you add or remove a trigger type, update this copy in the same commit.
//
// It had already failed. The union declared ELEVEN members; `'manual'` had no producer and
// could never fire, and two more are the runner telling us rather than us noticing — so the
// screen described a taxonomy the engine did not have. **A rule that holds only while
// someone remembers is not a rule** (CLAUDE.md), and this is the mechanism.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DETECTED_TRIGGER_TYPES, TRIGGER_TYPES } from './planAdjustment'
import {
  WATCHED_SIGNALS, WATCHED_SIGNAL_ORDER, WATCHED_SIGNAL_COUNT, watchedSignals,
  watchedSignalsByHorizon,
} from './watchedSignals'
import {
  ZONE_DRIFT_ABOVE_CEILING_PCT, LOAD_RATIO, SHADOW_LOAD_THRESHOLD_PCT,
  FATIGUE_ACCUMULATION_THRESHOLD, EF_DECLINE_THRESHOLD_PCT,
  FITNESS_SIGNAL_SESSION_THRESHOLD, LONG_RUN_SHORTFALL_COMPLETION_PCT, READINESS,
} from './constants'

describe('every signal the engine detects is described to the runner', () => {
  it('🔴 THE MECHANISM: a new detected trigger has no description and FAILS THE BUILD', () => {
    // The compiler enforces this through `Record<DetectedTrigger, …>`, and this arm states
    // it so the next reader knows it is deliberate rather than incidental.
    const described = Object.keys(WATCHED_SIGNALS).sort()
    expect(described).toEqual([...DETECTED_TRIGGER_TYPES].sort())
  })

  it('…and nothing is described that the engine does not detect', () => {
    // The inverse, which is the half that drifted: the old copy described runner-initiated
    // actions and a member with no producer as things "we watch for".
    for (const k of Object.keys(WATCHED_SIGNALS)) {
      expect(TRIGGER_TYPES as readonly string[]).toContain(k)
    }
    for (const k of ['skip_with_reason', 'session_reorder', 'manual']) {
      expect(Object.keys(WATCHED_SIGNALS)).not.toContain(k)
    }
  })

  it('the COUNT is derived, so no surface may type a number', () => {
    expect(WATCHED_SIGNAL_COUNT).toBe(DETECTED_TRIGGER_TYPES.length)
    expect(WATCHED_SIGNAL_COUNT).toBe(8)
    expect(WATCHED_SIGNAL_ORDER).toHaveLength(WATCHED_SIGNAL_COUNT)
  })

  it('the reading order is complete and has no duplicates', () => {
    expect([...WATCHED_SIGNAL_ORDER].sort()).toEqual([...DETECTED_TRIGGER_TYPES].sort())
    expect(new Set(WATCHED_SIGNAL_ORDER).size).toBe(WATCHED_SIGNAL_ORDER.length)
  })

  it('✋ nearest-horizon first — readiness before the efficiency trend', () => {
    // Silvanto's hierarchy-of-horizon rule. Readiness is checked before this morning's
    // session; EF decline is a trend over six runs. Alphabetical order would make the
    // runner do that sorting, which is the Coach screen's documented failure.
    const i = (t: string) => WATCHED_SIGNAL_ORDER.indexOf(t as never)
    expect(i('readiness_signal')).toBeLessThan(i('ef_decline'))
    expect(i('zone_drift')).toBeLessThan(i('fitness_signal'))
    expect(i('readiness_signal')).toBe(0)
  })
})

describe('the voice constraints are rulings, not taste', () => {
  const all = watchedSignals()
  const prose = all.map(s => `${s.label} ${s.detail}`).join(' ')

  it('🔴 no em dash: these are sentences the runner reads', () => {
    // `brand.md`, founder 2026-09-11. ⚠️ `noEmDashApp.test.ts` covers `components/` and
    // `app/dashboard/` only, so a string in `lib/coaching/` is OUTSIDE its population —
    // which is exactly how `planAdjustment.ts:417` still writes "Flagged — no auto-change
    // applied." to a runner. Asserted here because the app guard cannot see this file.
    expect(prose).not.toContain('—')
  })

  it('⚕️ SIMS’ CLAUSE (§124, mandatory): no sentence states a CAUSE', () => {
    // A decline detector may say what it MEASURED and what it CHANGED. The pattern these
    // detect is also how low energy availability presents, and the engine cannot diagnose
    // that. So no "because", no "due to", no explanation of why a number moved.
    for (const s of all) {
      expect(s.detail.toLowerCase(), `${s.type} explains a cause`)
        .not.toMatch(/\bbecause\b|\bdue to\b|\bmeans you\b|\bcaused\b|\bsign of\b/)
    }
  })

  it('🎓 SIERRA’S CLAUSE: no promises, no guarantees', () => {
    // The "commitments block" was killed under W-03 for being a promise where evidence was
    // wanted, and 7 of these 8 have never fired in production. These describe what is
    // LOOKED AT, never what is caught or prevented.
    for (const s of all) {
      expect(prose.toLowerCase(), `${s.type} promises an outcome`)
        .not.toMatch(/\bwe'll catch\b|\bguarantee\b|\bprevent\b|\bnever let\b|\balways\b/)
    }
  })

  it('💼 SLT: no merchandising — no tier language, no CTA', () => {
    // "A settings screen that merchandises", unanimous. Wood: Me is the lowest-frequency
    // surface, so the worst place for a conversion moment.
    expect(prose.toLowerCase()).not.toMatch(/upgrade|premium|unlock|free plan|subscri|try it/)
  })

  it('a label is a LABEL and a detail is a SENTENCE', () => {
    for (const s of all) {
      expect(s.label, `${s.type} label should not end in a full stop`).not.toMatch(/\.$/)
      expect(s.detail, `${s.type} detail should be a sentence`).toMatch(/\.$/)
      // Kept short on purpose: this is a scannable list, not a paragraph. The thing it
      // replaced was one 40-word run-on sentence.
      expect(s.detail.split(/\s+/).length, `${s.type} detail is too long`).toBeLessThanOrEqual(14)
    }
  })

  it('no motivational register', () => {
    expect(prose.toLowerCase()).not.toMatch(/crushing|smashed|beast|amazing|great job|you've got this/)
  })
})

describe('the screen renders the owner, and the disclosure is GONE', () => {
  const SRC = readFileSync(join(process.cwd(), 'components/dashboard/PlanAdjustmentsScreen.tsx'), 'utf8')
  const CODE = SRC.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n')

  it('🔴 the eight are ON the screen, not behind a chevron', () => {
    // ✋ "Density, not disclosure", twice on Silvanto's record. 📱 Wroblewski: this removes
    // a tap. Comments stripped first — this file quotes the dead state for the next reader.
    expect(CODE).toContain('watchedSignalsByHorizon().map')
    expect(CODE).not.toContain('adjustmentsDisclosureOpen')
    expect(CODE).not.toContain('setAdjustmentsDisclosureOpen')
  })

  it('…and the old run-on paragraph is gone with it', () => {
    expect(CODE).not.toContain('Recovery signals before hard sessions: resting HR, HRV, sleep')
  })

  it('no copy is typed into the component — it all comes from the owner', () => {
    for (const s of watchedSignals()) {
      expect(CODE).not.toContain(s.label)
      expect(CODE).not.toContain(s.detail)
    }
  })
})

describe('🎨 RESHAPE-MOMENT-04 — the figures are DERIVED, which is the whole integrity claim', () => {
  // 🔴 The first version of this block had no figures at all. The founder: "It's boring and
  // just a list of words. Make it stand out and sing about it." The house style says why:
  // `ui-patterns.md` § Metric Pair is "large numbers, small muted labels underneath; value
  // always dominates", and eight rows of prose have no value in them.
  //
  // ⚠️ These numbers are only printable because the Coaching Board ratified them the same
  // morning (§2 Am.5, §124, §109 Am.1). Printing an unratified threshold would assert a
  // precision nobody had defended, which is the three-card proof band's error.
  const all = watchedSignals()
  // Re-derived here: the `CODE` in the previous describe is block-scoped to it, and tsc
  // caught the reach rather than vitest, which would have failed at runtime.
  const SCREEN = readFileSync(join(process.cwd(), 'components/dashboard/PlanAdjustmentsScreen.tsx'), 'utf8')
    .split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n')

  it('🔴 EVERY signal carries a figure, and it matches its live constant', () => {
    // The arm that makes the screen quote the engine rather than describe it from memory.
    // If the board moves a threshold, this screen moves with it or this test fails.
    const expected: Record<string, string> = {
      readiness_signal:     `+${READINESS.RHR_ELEVATION_BPM} bpm`,
      zone_drift:           `${ZONE_DRIFT_ABOVE_CEILING_PCT}%`,
      acute_chronic_high:   `${LOAD_RATIO.flag}\u00d7`,
      shadow_load:          `${SHADOW_LOAD_THRESHOLD_PCT}%`,
      fatigue_accumulation: `${FATIGUE_ACCUMULATION_THRESHOLD} in a row`,
      ef_decline:           `\u2212${Math.abs(EF_DECLINE_THRESHOLD_PCT)}%`,
      fitness_signal:       `${FITNESS_SIGNAL_SESSION_THRESHOLD} sessions`,
      long_run_shortfall:   `${Math.round(LONG_RUN_SHORTFALL_COMPLETION_PCT * 100)}%`,
    }
    for (const s of all) {
      expect(s.figure, `${s.type} has no figure`).toBeTruthy()
      expect(s.figure, `${s.type}'s figure is not its live constant`).toBe(expected[s.type])
    }
  })

  it('…and no figure is a typed literal in the owner', () => {
    // ⚠️ A hand-typed "20%" would pass the arm above on the day it was written and drift
    // silently the day the board moved the threshold. The template literals are the point.
    const SRC = readFileSync(join(process.cwd(), 'lib/coaching/watchedSignals.ts'), 'utf8')
    const code = SRC.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
    // ⚠️ `figure: \`` with the backtick, NOT `figure:` alone — my first version counted the
    // INTERFACE declaration `figure: string` as a ninth figure and failed at 9 vs 8. A
    // checker's population error, in the checker written to prevent one.
    const figureLines = code.split('\n').filter(l => /^\s*figure:\s*`/.test(l))
    expect(figureLines).toHaveLength(WATCHED_SIGNAL_COUNT)
    for (const l of figureLines) {
      expect(l, `a figure is hardcoded: ${l.trim()}`).toMatch(/\$\{/)
    }
  })

  it('\u2212 is a real MINUS SIGN, not a hyphen', () => {
    // At 20px display weight a hyphen-minus reads as punctuation.
    const ef = all.find(s => s.type === 'ef_decline')!
    expect(ef.figure.startsWith('\u2212')).toBe(true)
    expect(ef.figure).not.toContain('-')
  })

  it('✋ the three horizons are complete, ordered nearest-first, and none is empty', () => {
    const groups = watchedSignalsByHorizon()
    expect(groups.map(g => g.key)).toEqual(['before', 'week', 'block'])
    expect(groups.flatMap(g => g.signals)).toHaveLength(WATCHED_SIGNAL_COUNT)
    for (const g of groups) expect(g.signals.length).toBeGreaterThan(0)
  })

  it('every signal is in exactly one horizon', () => {
    const seen = watchedSignalsByHorizon().flatMap(g => g.signals.map(s => s.type))
    expect(new Set(seen).size).toBe(seen.length)
  })

  it('🔴 the screen renders the metric pair: VALUE above label', () => {
    // `ui-patterns.md`: "Never put label above value. Value always dominates." The figure
    // must appear before its label in the markup, and at a larger size.
    const fig = SCREEN.indexOf('{sig.figure}')
    const lab = SCREEN.indexOf('{sig.label}')
    expect(fig).toBeGreaterThan(-1)
    expect(lab).toBeGreaterThan(fig)
    expect(SCREEN).toMatch(/fontSize: '20px', fontWeight: 700/)
    expect(SCREEN).toContain("fontVariantNumeric: 'tabular-nums'")
  })

  it('…and the horizon headings use the documented micro-label, not a hand-rolled one', () => {
    // MICRO-LABEL-DRIFT-01: "After the race" once existed at 10px AND 11px on two surfaces.
    expect(SCREEN).toContain('MICRO_LABELS.sectionLabel')
  })

  it('the figures stay SHORT enough to be a metric, not a sentence', () => {
    for (const s of all) {
      expect(s.figure.length, `${s.type}'s figure is too long to read as a value`).toBeLessThanOrEqual(11)
    }
  })
})
