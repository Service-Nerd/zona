import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// HK-FREE-INGEST-LINE-01 (SLT, 2026-10-07) — the row lands for everyone, the
// coaching does not.
//
// The route used to 403 a free runner BEFORE storing anything, contradicting DS-06
// forty lines above it: "logging is free, richer analysis stays gated downstream".
// A free runner could TYPE a run by hand and we stored it forever, while the same
// run measured by their watch was discarded — and irreversibly, because the client
// looks back 30 days.
//
// ⚠️ SOURCE-SHAPED, AND THAT IS A LIMIT. The route needs auth, a tier lookup, a
// service-role client and `waitUntil`; `vitest.config.ts` is `environment: 'node'`
// and none of that can be stood up here. So this proves the GATE IS IN THE RIGHT
// PLACE and that every trigger carries it. It does not prove the route runs.

const SRC = readFileSync('app/api/health/ingest/route.ts', 'utf8')

/** Everything in the route body before the first analysis trigger. */
const beforeFirstTrigger = SRC.slice(0, SRC.indexOf('canAnalyse'))

describe('HK-FREE-INGEST-LINE-01 — a free runner keeps their run history', () => {
  it('the route does NOT 403 a free runner before storing', () => {
    // The regression: a tier check that returns before the upsert.
    expect(SRC).not.toContain("return NextResponse.json({ error: 'Subscription required' }, { status: 403 })")
  })

  it('the tier is resolved as a FLAG, not an early return', () => {
    expect(SRC).toContain("const canAnalyse = isFeatureAllowed('activity_intelligence', tier)")
  })

  it('🔴 EVERY analysis trigger carries the gate — not just the obvious one', () => {
    // The one-twin trap: this route has THREE triggers (autoMatchAndAnalyse plus two
    // triggerHrRefreshAnalysis calls on the dedup and same-uuid paths). Gating one
    // would hand free users the paid read by a different door.
    const triggers = SRC.match(/waitUntil\(\s*(?:triggerHrRefreshAnalysis|\n)/g) ?? []
    const gated    = SRC.match(/if \(canAnalyse\) waitUntil\(/g) ?? []
    expect(triggers.length, 'trigger count changed — re-check the gate on each').toBeGreaterThanOrEqual(2)
    expect(gated.length, 'an analysis trigger is missing the canAnalyse gate').toBe(3)
  })

  it('no analysis trigger fires before the gate is resolved', () => {
    expect(beforeFirstTrigger).not.toContain('autoMatchAndAnalyse(')
    expect(beforeFirstTrigger).not.toContain('triggerHrRefreshAnalysis(userId')
  })

  it('DS-06 manual entry is untouched and still branches BEFORE the tier lookup', () => {
    const manual = SRC.indexOf("source === 'manual'")
    const tier   = SRC.indexOf('const tier = await getUserTier')
    expect(manual).toBeGreaterThan(-1)
    expect(manual, 'the manual branch must still precede the tier lookup').toBeLessThan(tier)
  })

  it('the genuinely PAID surfaces keep their own gates', () => {
    // Richness stays gated at its own route. This ruling moved ONE gate, not four.
    for (const f of [
      'app/api/weekly-report/route.ts',
      'app/api/phase-summary/route.ts',
      'app/api/health/samples/route.ts',
    ]) {
      expect(readFileSync(f, 'utf8'),
        `${f} lost its activity_intelligence gate — richness must stay paid`,
      ).toContain("isFeatureAllowed('activity_intelligence'")
    }
  })
})
