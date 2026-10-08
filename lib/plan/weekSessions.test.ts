// ADJUST-ENGINE-DEAD-01 — the adaptive engine threw on every real plan for 3½ months.
//
// 🔴 THE SHAPE OF THE DEFECT, AND WHY THE EXISTING TESTS WERE ALL GREEN THROUGHOUT:
// every fixture in the suite hand-builds a SEVEN-DAY week. Real plans do not have one.
// Measured 2026-10-08 across all 31 live plans:
//
//   days-with-a-session in week 1:  1×1 · 2×2 · 3×13 · 4×10 · 5×2 · 6×3
//   checkAdjustmentTriggers THREW:  31 of 31  (100%)
//
// So the regression test that matters is NOT "does a well-formed week work" — that passed
// all along. It is **"does a week with MISSING DAYS work"**, which is every real week.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { orderedWeekSessions, restSession, isRestSlot } from './weekSessions'
import { checkAdjustmentTriggers } from '@/lib/coaching/planAdjustment'
import { weekHasRestDay } from './invariants'
import { DAY_ORDER } from './days'

/** A real three-day week: the single most common shape in production (13 of 31 plans). */
const THREE_DAY_WEEK = {
  sessions: {
    wed: { type: 'easy',    label: 'Easy run', detail: '6.6km easy', distance_km: 6.6 },
    fri: { type: 'quality', label: 'Tempo',    detail: '4km tempo',  distance_km: 8.0 },
    sun: { type: 'easy',    label: 'Long run', detail: '14km',       distance_km: 14.0 },
  },
} as never

const baseInput = (sessions: ReturnType<typeof orderedWeekSessions>) => ({
  currentWeekN: 3, totalWeeks: 12, currentWeekSessions: sessions,
  linkedKm: 0, offPlanKm: 0, plannedKm: 28.6, priorWeeksKm: [],
  hrInZoneData: [], efTrendPct: null, adjustmentsThisWeek: 0,
})

describe('orderedWeekSessions — seven real slots, mon→sun', () => {
  it('🔴 THE DEFECT: a three-day week no longer makes the engine throw', () => {
    // This is the assertion that fails on the pre-fix code, and the ONLY one that would
    // have caught the live bug. `DAY_ORDER.map(d => week.sessions[d] ?? null)` throws here.
    expect(() => checkAdjustmentTriggers(baseInput(orderedWeekSessions(THREE_DAY_WEEK)))).not.toThrow()
  })

  it('returns exactly 7 slots, none null, in mon→sun order', () => {
    const out = orderedWeekSessions(THREE_DAY_WEEK)
    expect(out).toHaveLength(7)
    expect(out.every(s => s != null && typeof (s as { type: string }).type === 'string')).toBe(true)
    // Position is the contract: the engine indexes by it.
    expect(DAY_ORDER[2]).toBe('wed')
    expect((out[2] as { label: string }).label).toBe('Easy run')
    expect((out[4] as { label: string }).label).toBe('Tempo')
    expect((out[6] as { label: string }).label).toBe('Long run')
  })

  it('the four absent days become explicit rest, not null', () => {
    const out = orderedWeekSessions(THREE_DAY_WEEK)
    const rest = [0, 1, 3, 5].map(i => out[i] as { type: string })
    expect(rest.every(s => s.type === 'rest')).toBe(true)
  })

  // ⚠️ `{...null}` is `{}` in JavaScript — a typeless object that would flow through all
  // ELEVEN positional `sessions.map(s => ({...s}))` consumers in the engine and corrupt a
  // reshape with no error. The engine's assertion was protecting against exactly that, so
  // it stays; this is the proof the caller now satisfies it rather than the proof it was
  // relaxed.
  it('🔴 a null slot STILL throws, because the assertion is correct', () => {
    const withNull = orderedWeekSessions(THREE_DAY_WEEK)
    withNull[0] = null as never
    expect(() => checkAdjustmentTriggers(baseInput(withNull))).toThrow(/not a valid session object/)
  })

  it('a genuinely empty week is seven rest days, not a crash', () => {
    const out = orderedWeekSessions({ sessions: {} } as never)
    expect(out).toHaveLength(7)
    expect(out.every(s => (s as { type: string }).type === 'rest')).toBe(true)
    expect(() => checkAdjustmentTriggers(baseInput(out))).not.toThrow()
  })

  it('tolerates a missing `sessions` object entirely', () => {
    expect(orderedWeekSessions({} as never)).toHaveLength(7)
  })

  it('a full seven-day week is untouched — the case that always passed', () => {
    const full = { sessions: Object.fromEntries(DAY_ORDER.map(d => [d, { type: 'easy', label: d }])) } as never
    const out = orderedWeekSessions(full)
    expect(out.map(s => (s as { label: string }).label)).toEqual([...DAY_ORDER])
  })
})

describe('the materialised rest day satisfies §64, which is what makes this lossless', () => {
  // GEN-FIX-09 (2026-08-06) amended §64: a rest day is EITHER an explicit `type:'rest'`
  // entry OR fewer than seven training days. Converting the second into the first is
  // therefore sanctioned, not a workaround — and `weekHasRestDay` is the live proof,
  // because it accepts both and must keep accepting this one.
  it('weekHasRestDay still holds on the normalised array', () => {
    expect(weekHasRestDay(orderedWeekSessions(THREE_DAY_WEEK))).toBe(true)
  })

  it('…and on the raw sparse array it was written for', () => {
    expect(weekHasRestDay(DAY_ORDER.map(d => (THREE_DAY_WEEK as { sessions: Record<string, unknown> }).sessions[d] as never))).toBe(true)
  })

  it('isRestSlot reads BOTH §64 representations', () => {
    expect(isRestSlot(null)).toBe(true)
    expect(isRestSlot(undefined)).toBe(true)
    expect(isRestSlot(restSession())).toBe(true)
    expect(isRestSlot({ type: 'easy' } as never)).toBe(false)
  })

  it('the gap rest day carries NO copy, unlike maintenance’s prescribed rest', () => {
    // §64: the maintenance block's rest day IS a prescription and says 'Rest day.'. A gap
    // has nothing to tell the runner, so `detail` is null. Two meanings, two objects.
    expect((restSession() as { detail: unknown }).detail).toBeNull()
    const maint = readFileSync(join(process.cwd(), 'lib/plan/maintenance.ts'), 'utf8')
    expect(maint).toContain("detail: 'Rest day.'")
  })
})

describe('no caller hand-rolls the mapping any more', () => {
  const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('🔴 the route uses the owner, and the null sentinel is GONE', () => {
    const src = read('app/api/adjust-plan/route.ts')
    expect(src).toContain('orderedWeekSessions(')
    // The exact expression that killed the engine.
    expect(src).not.toMatch(/week\.sessions as Record<string, unknown>\)\[d\] \?\? null/)
    expect(src).not.toContain('DAY_ORDER_LOCAL')
  })

  it('the backtest harness uses it too — there were TWO copies by the time this was found', () => {
    const src = read('scripts/backtest-adjustment-triggers.ts')
    expect(src).toContain('orderedWeekSessions(week)')
    expect(src).not.toContain("malformed week")
  })

  it('the engine’s inline rest object is the owner’s — it was the third copy', () => {
    const src = read('lib/coaching/planAdjustment.ts')
    expect(src).toContain('restSession()')
    expect(src).not.toMatch(/toSession \?\? \{ type: 'rest', label: 'Rest', detail: null \}/)
  })

  // ⚠️ COMMENTS STRIPPED FIRST, AND THE FIRST VERSION OF THIS ARM DID NOT — it matched
  // the route's own comment, which QUOTES the dead expression so the next reader knows what
  // was wrong. A guard firing on prose that records a defect is this repo's recorded
  // `an ownership arm matching its own comment` class (2026-10-01, one of three that day),
  // and CLAUDE.md notes that a guard which fires on ordinary work gets switched off, which
  // it treats as equivalent to having no guard. Line numbers are irrelevant here, so a
  // plain filter is enough; the pre-commit hook does the same thing while preserving them.
  const stripComments = (src: string) => src
    .split('\n')
    .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')

  it('⚠️ and nothing new reintroduces the pattern', () => {
    // Bounded to the two files that legitimately order a week by day. A third would be a
    // fourth copy, which is the whole class this owner exists to end.
    for (const f of ['app/api/adjust-plan/route.ts', 'scripts/backtest-adjustment-triggers.ts']) {
      expect(stripComments(read(f))).not.toMatch(/\.map\(\s*d\s*=>\s*\(?\s*week\.sessions/)
    }
  })

  it('…and the strip does not blind it: the dead expression in CODE still fails', () => {
    // 🔴 The trap in the fix. Proving the filter removes prose is worthless unless it is
    // also proved NOT to remove code — the hook's own test table carries the same pair
    // ("code after a comment on the same line still blocks").
    const asCode = "  const x = DAY_ORDER.map(d => (week.sessions as Record<string, unknown>)[d] ?? null)"
    expect(stripComments(asCode)).toMatch(/\.map\(\s*d\s*=>\s*\(?\s*week\.sessions/)
    expect(stripComments("  // DAY_ORDER.map(d => (week.sessions)[d] ?? null)")).not.toMatch(/week\.sessions/)
  })
})

describe('🔴 THE ONE SHAPE THAT NEVER THREW, and my RCA overstated it', () => {
  // CORRECTION, 2026-10-08, same day as the fix. I reported "the adaptive engine has thrown
  // on every check since 2026-06-26". Measured across ALL 31 live plans and ALL 468 of their
  // weeks: **0 weeks carry seven populated days** (max 6, on 46 weeks), so the claim holds
  // for every one of them. But it is NOT universal, and the evidence was in production the
  // whole time: `last_adjustment_check_at` for the founder's own account reads **2026-09-11
  // with foundChange=false** — a stamp written at `adjust-plan/route.ts:362`, which sits
  // AFTER the detector returns. The detector completed that day. It did not throw.
  //
  // §64 explains it: the post-race MAINTENANCE block emits representation (1), an explicit
  // `type: 'rest'` entry, for every non-training day — `maintenance.ts` builds
  // `restDays = TRAINING_DAYS.filter(d => !trainingDays.includes(d))` and fills each one. So
  // **a maintenance week has all seven keys and sails through the assertion.**
  //
  // ⚠️ The honest claim is therefore: dead for every RACE plan, alive for a maintenance
  // plan — and all 31 current plans are race plans, which is why the measurement read as
  // universal. **My first measurement looked at week 1 of each plan; the route reads the
  // CURRENT week.** Same population error, one index deep.
  it('a maintenance-shaped week already satisfies the assertion, unchanged', () => {
    const maint = {
      sessions: Object.fromEntries(DAY_ORDER.map((d, i) => [
        d, i % 2 === 0 ? { type: 'easy', label: 'Easy run', distance_km: 6 }
                       : { type: 'rest', label: 'Rest', detail: 'Rest day.' },
      ])),
    } as never
    const out = orderedWeekSessions(maint)
    expect(out).toHaveLength(7)
    expect(() => checkAdjustmentTriggers(baseInput(out))).not.toThrow()
    // And the owner is a no-op on it: nothing was absent, so nothing was materialised.
    expect(out.filter(s => (s as { detail?: string }).detail === 'Rest day.')).toHaveLength(3)
  })

  it('…which is why maintenance.ts keeps its OWN rest object', () => {
    // `restSession()` here carries `detail: null` because it fills a GAP. Maintenance's
    // carries 'Rest day.' because there the rest IS the prescription. Two meanings, and
    // this is the arm that stops someone unifying them for tidiness.
    const maint = readFileSync(join(process.cwd(), 'lib/plan/maintenance.ts'), 'utf8')
    expect(maint).toContain("detail: 'Rest day.'")
    expect(maint).toMatch(/restDays\s*=\s*TRAINING_DAYS\.filter/)
  })
})

