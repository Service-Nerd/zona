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
} from './watchedSignals'

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
    expect(CODE).toContain('watchedSignals().map')
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
