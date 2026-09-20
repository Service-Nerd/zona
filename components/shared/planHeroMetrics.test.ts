import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PAID_FEATURES } from '@/lib/marketing/pricing'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'

/**
 * P-06(c) — the hero metric panel on the plan preview.
 *
 * The preview gave the runner a week count, a start date and a race distance,
 * and nothing about the SHAPE of the block: how big the biggest week gets and
 * how far the whole thing runs were computable from the plan in front of them
 * and never shown.
 */
const PANEL_RAW = readFileSync(join(process.cwd(), 'components/shared/PlanHeroMetrics.tsx'), 'utf8')
const PANEL = PANEL_RAW
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
const WIZ = readFileSync(join(process.cwd(), 'app/dashboard/GeneratePlanScreen.tsx'), 'utf8')

describe('P-06(c) — the numbers are derived, never stored', () => {
  it('reads real files', () => {
    expect(PANEL).toContain('export default function PlanHeroMetrics')
    expect(WIZ).toContain('<PlanHeroMetrics')
  })

  it('computes peak and total from plan.weeks at render', () => {
    // A total written at generation goes stale the moment a plan is reshaped,
    // and "a value read mid-pipeline was stale by the time the runner saw it"
    // is a recorded failure class here.
    expect(PANEL).toContain('plan.weeks.map(w => w.weekly_km ?? 0)')
    expect(PANEL).toContain('Math.max(...weeklyKms)')
    expect(PANEL).toContain('reduce((a, b) => a + b, 0)')
  })

  it('reads no stored total off meta', () => {
    expect(PANEL).not.toMatch(/meta\.(total|peak)/)
  })

  it('formats distance through the ADR-015 owner, never by hand', () => {
    expect(PANEL).toContain('formatDistance(')
    // ⚠️ Narrowed to the actual PREF-SWEEP-01 defect: a unit glyph WELDED to an
    // interpolated value. The first cut banned the bare string 'km' and failed
    // on the `units: 'km' | 'mi'` TYPE ANNOTATION — a test that fails on a type
    // is one people delete.
    expect(PANEL).not.toMatch(/\$\{[^}]*\}\s*(km|mi)/)
  })

  it('the week count is not rendered twice', () => {
    // It moved into the panel; two renderings of one figure is how they drift.
    const start = WIZ.indexOf("appStep === 'preview'")
    const head  = WIZ.slice(start, start + 1400)
    expect(head).not.toContain('{weeks.length} weeks ·')
  })
})

describe('P-06(c) — the adaptation promise is gated and singly owned', () => {
  it('a FREE runner is not promised adaptation they do not get', () => {
    // Verified rather than assumed: dynamic_reshape_r20 is false for free.
    // This is the same class as the "full access" claim that was false for
    // weeks, and hard rule 7 forbids it.
    expect(isFeatureAllowed('dynamic_reshape_r20' as never, 'free')).toBe(false)
    expect(isFeatureAllowed('dynamic_reshape_r20' as never, 'trial')).toBe(true)
    expect(PANEL).toContain('canReshape && RESHAPE_ROW')
    expect(WIZ).toContain('canReshape={!!hasPaidAccess}')
  })

  it('the promise IS the /pricing row, not a second string saying the same thing', () => {
    const row = PAID_FEATURES.find(f => f.gate === 'dynamic_reshape_r20')
    expect(row, 'the reshape row must exist for the panel to have a promise').toBeTruthy()
    expect(PANEL).toContain("f.gate === 'dynamic_reshape_r20'")
    expect(PANEL).toContain('RESHAPE_ROW.detail')
    // A restatement here would be a second owner of one promise, outside both
    // guards that already cover that row.
    expect(PANEL).not.toContain(row!.detail)
  })

  it('makes no "no make-up runs" claim, which was never verified', () => {
    // The filing flagged it as a coaching claim needing checking against the
    // missed-session path first. It is not checked, so it is not said.
    expect(PANEL).not.toMatch(/make.?up runs?/i)
  })
})

describe('P-06(c) — took the idea, not the chrome', () => {
  it('no dark ground: that pattern is scoped to marketing pages', () => {
    // "Exactly one near-black section per MARKETING PAGE... a punctuation
    // mark, not a theme" — and ADR-008 is a single light theme.
    expect(PANEL).not.toContain('--ground')
    expect(PANEL).toContain("background: 'var(--card)'")
  })

  it('no decorative chrome', () => {
    // "No chrome. No stacked box-shadows. No gradient on gradient. No
    // decorative dividers." The ticket-notch and tonal wave were not taken.
    expect(PANEL).not.toMatch(/gradient|clip-path|boxShadow: '.*,.*'/)
  })

  it('value large, label small underneath — our specified hierarchy', () => {
    const v = PANEL.indexOf("fontSize: '22px'")
    const l = PANEL.indexOf("fontSize: '11px'")
    expect(v).toBeGreaterThan(-1)
    expect(l).toBeGreaterThan(v)
  })

  it('no hardcoded hex or font stack', () => {
    expect(PANEL).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(PANEL).toContain('var(--font-ui)')
  })
})
