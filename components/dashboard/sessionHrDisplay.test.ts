import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getSessionHRDisplay } from './dashboardHelpers'
import { sessionHRBand, hrBandForZoneString, prescribedHrBand } from '@/lib/coaching/zoneRules'

// EFFORT-GOVERNED-HR-DISPLAY-01 — the displayed HR number derives from the PRESCRIPTION.
//
// §84 has required this since 2026-09-04 ("the zone a runner SEES ... MUST NOT derive from the
// coarse session.type slot") and names `hrBandForZoneString` as the owner of the live band. Two
// of the four display surfaces obeyed it and two did not, and because both of the two print the
// zone LABEL beside the number, a VO2max session rendered `Zone 4–5 · 151–163 bpm` — honest
// label, number a whole band below it, which is §84's own named harm.
//
// 📐 81 of 2,433 live sessions across 28 of 43 runners rendered a contradicted number.
//
// ⚠️ THESE ARMS PIN THE CEILING-VS-RANGE RULE TO THE PRESCRIPTION'S TOP ZONE, NOT THE TYPE.
// That is the only form that gets all three live shapes right at once, and re-deriving it from
// the session type is the regression to guard: it would hand a `Zone 1` shakeout the Zone 2
// ceiling again, and collapse a `Zone 2–3` long run back to a cap that `SEGMENTED-LR-HR-01`
// ruled against.
const RHR = 50, MAX = 190

describe('getSessionHRDisplay — the prescription owns the number (§84)', () => {
  it('a VO2max session reads its Zone 4–5 band, not the Z3 band its type maps to', () => {
    const s = { type: 'quality', zone: 'Zone 4–5', hr_target: '158–185 bpm' }
    const got = getSessionHRDisplay(s, RHR, MAX, undefined)
    const z45 = hrBandForZoneString('Zone 4–5', RHR, MAX)!
    expect(got).toBe(`${z45.lo}–${z45.hi}`)
    // The defect, stated as a relation rather than a number: the old path was a band lower.
    const byType = sessionHRBand('quality', RHR, MAX)!
    expect(byType.lo).toBeLessThan(z45.lo)
    expect(got).not.toBe(`${byType.lo}–${byType.hi}`)
  })

  it('a Zone 1 shakeout reads a LOWER ceiling than the Zone 2 one it used to get', () => {
    const got = getSessionHRDisplay({ type: 'easy', zone: 'Zone 1' }, RHR, MAX, undefined)
    const z1 = hrBandForZoneString('Zone 1', RHR, MAX)!
    const z2 = hrBandForZoneString('Zone 2', RHR, MAX)!
    expect(got).toBe(`< ${z1.hi}`)
    expect(z1.hi).toBeLessThan(z2.hi)
  })

  it('a Zone 2–3 segmented long run reads a RANGE, not a cap (SEGMENTED-LR-HR-01)', () => {
    const got = getSessionHRDisplay({ type: 'easy', zone: 'Zone 2–3', hr_target: '< 153 bpm' }, RHR, MAX, undefined)
    const band = hrBandForZoneString('Zone 2–3', RHR, MAX)!
    expect(got).toBe(`${band.lo}–${band.hi}`)
    expect(got).not.toContain('<')
  })

  it('the ceiling form keys on the PRESCRIPTION, not the session type', () => {
    // A quality-typed session prescribed at Z2 is still a cap; an easy-typed session
    // prescribed into Z3 is still a range. Both would be wrong if the type decided.
    expect(getSessionHRDisplay({ type: 'quality', zone: 'Zone 2' }, RHR, MAX, undefined)).toMatch(/^< \d+$/)
    expect(getSessionHRDisplay({ type: 'easy', zone: 'Zone 3' }, RHR, MAX, undefined)).toMatch(/^\d+–\d+$/)
  })

  it('a plain Zone 2 easy run is unchanged — the common case does not move', () => {
    const got = getSessionHRDisplay({ type: 'easy', zone: 'Zone 2' }, RHR, MAX, undefined)
    const byType = sessionHRBand('easy', RHR, MAX)!
    expect(got).toBe(`< ${byType.hi}`)
  })

  it('a legacy session with no stored zone falls back to the type-derived band (§84 graceful degradation)', () => {
    const got = getSessionHRDisplay({ type: 'quality' }, RHR, MAX, undefined)
    const byType = sessionHRBand('quality', RHR, MAX)!
    expect(got).toBe(`${byType.lo}–${byType.hi}`)
  })

  it('race day keeps its deliberately broad race-effort band with no zone or target', () => {
    const got = getSessionHRDisplay({ type: 'race' }, RHR, MAX, undefined)
    const byType = sessionHRBand('race', RHR, MAX)!
    expect(got).toBe(`${byType.lo}–${byType.hi}`)
  })

  it('delivers §14’s %MaxHR fallback where the Karvonen path gives nothing', () => {
    // A runner with a max HR and no resting HR. `sessionHRBand` returns null for them;
    // `hrBandForZoneString` carries the %MaxHR formula §14 already ratifies.
    expect(sessionHRBand('quality', null, MAX)).toBeNull()
    const got = getSessionHRDisplay({ type: 'quality', zone: 'Zone 4–5' }, null, MAX, undefined)
    expect(got).toMatch(/^\d+–\d+$/)
  })

  it('with no live HR data at all it reads the baked target, bpm stripped', () => {
    expect(getSessionHRDisplay({ type: 'quality', zone: 'Zone 4–5', hr_target: '158–185 bpm' }, null, null, undefined))
      .toBe('158–185')
  })

  it('with no HR data and no target, an easy-family session reads the plan’s Z2 ceiling', () => {
    expect(getSessionHRDisplay({ type: 'easy' }, null, null, 145)).toBe('< 145')
  })

  it('a session that prescribes no zone at all reads nothing', () => {
    expect(getSessionHRDisplay({ type: 'strength' }, RHR, MAX, undefined)).toBeNull()
    expect(getSessionHRDisplay({ type: 'rest' }, RHR, MAX, undefined)).toBeNull()
  })
})

describe('every call site hands over the SESSION, never its type', () => {
  // 🔴 THE DEFECT WAS A SIGNATURE, SO THIS IS THE ARM THAT HOLDS IT SHUT. The owner cannot
  // read `session.zone` if a caller only gives it `session.type`, and that is exactly how two
  // surfaces drifted from the other two for fourteen months. A caller passing `.type` would be
  // a type error today — but the owner is `{ type?, zone?, hr_target? }`, so a caller could
  // still hand it a hand-built object and lose the zone, which compiles.
  const FILES = [
    'components/dashboard/SessionPopupInner.tsx',
    'components/dashboard/TodayScreen.tsx',
  ]
  it('finds every call and none of them narrows the session', () => {
    let calls = 0
    for (const f of FILES) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      // Bound the region at the call's own parentheses rather than grepping the file:
      // a name match anywhere else in a 2,000-line component is not a call.
      const re = /getSessionHRDisplay\(\s*([^,)]+)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        calls++
        const firstArg = m[1].trim()
        expect(firstArg, `${f}: first argument to getSessionHRDisplay`).not.toMatch(/\.(type|zone|hr_target)\b/)
      }
    }
    // An allow-by-default arm is not a check: if the regex stops matching, this fails.
    expect(calls).toBe(3)
  })
})

describe('prescribedHrBand — the owner the prompts read too', () => {
  it('labels with the PRESCRIPTION, which is what the AI prompt repeats', () => {
    // ADR-015's amendment: a number handed to the model is user-facing the moment the model
    // repeats it. `analyse-run` sent `zoneForSessionType(type).label`, so the prompt told the
    // model a VO2max session was prescribed at "Zone 3".
    expect(prescribedHrBand({ type: 'quality', zone: 'Zone 4–5' }, RHR, MAX)!.label).toBe('Zone 4–5')
  })

  it('the heat ceiling the limiter reads is the session\u2019s own top, not a lower band\u2019s', () => {
    const vo2 = prescribedHrBand({ type: 'quality', zone: 'Zone 4–5' }, RHR, MAX)!
    const byType = sessionHRBand('quality', RHR, MAX)!
    // The false-heat case: an avg HR inside the prescribed band but above the OLD ceiling.
    const avgHr = byType.hi + 6
    expect(avgHr).toBeGreaterThan(byType.hi + 5)   // would have fired the heat branch
    expect(avgHr).toBeLessThanOrEqual(vo2.hi)      // yet is inside what the plan prescribed
    expect(vo2.hi).toBeGreaterThan(byType.hi)
  })

  it('falls back to the type band and ITS label when a legacy session stored no zone', () => {
    const got = prescribedHrBand({ type: 'quality' }, RHR, MAX)!
    expect(got.label).toBe('Zone 3')
    expect(got.ceilingForm).toBe(false)
  })

  it('reads nothing for a session that prescribes no zone, and nothing without HR data', () => {
    expect(prescribedHrBand({ type: 'strength' }, RHR, MAX)).toBeNull()
    expect(prescribedHrBand({ type: 'quality', zone: 'Zone 4–5' }, null, null)).toBeNull()
    expect(prescribedHrBand(null, RHR, MAX)).toBeNull()
  })
})

describe('no surface derives a session HR band from the session TYPE any more', () => {
  // §84 is fourteen months old and was still being violated by four call sites, so the rule
  // gets a gate rather than a sentence. `sessionHRBand('easy', …)` with a LITERAL type is a
  // different question (what is this runner's Z2 ceiling?) and stays legal.
  const FILES = [
    'app/api/analyse-run/route.ts',
    'app/api/post-run-reframe/route.ts',
    'components/dashboard/SessionPopupInner.tsx',
    'components/dashboard/TodayScreen.tsx',
    'components/dashboard/dashboardHelpers.ts',
  ]
  it('finds no sessionHRBand call fed a session\u2019s type', () => {
    const offenders: string[] = []
    for (const f of FILES) {
      // ⚠️ COMMENT LINES ARE PROSE AND MUST NOT FIRE. `SessionPopupInner` deliberately
      // RECORDS the old call in a comment, with the ZONE-SHEET-01 measurement beside it, and a
      // gate that reads the comment about the defect as the defect is `HOOK-RGBA-COMMENTS-01`.
      // ⚠️ The limit is stated rather than lexed: whole-line comments only. A call sharing a
      // line with a trailing comment is still code and still checked.
      const src = readFileSync(join(process.cwd(), f), 'utf8')
        .split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      const re = /sessionHRBand\(\s*([^,)]+)/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const firstArg = m[1].trim()
        if (/\.type\b/.test(firstArg) || firstArg === 'sessionType') offenders.push(`${f}: ${firstArg}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
