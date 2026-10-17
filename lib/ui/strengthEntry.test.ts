import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * STRENGTH-ENTRY-01 (Design Board + SLT, 2026-10-17) — strength's three doors.
 *
 * 🔴 THIS IS A MOVE, so it carries a move's check (`/build` § 5b). The setup used to be a Me
 * section, which can only return to Me. It is now the dashboard's `strength-setup` screen,
 * opened from Me, the modify sheet and the rest card, and its back goes to whichever opened it.
 * Every arm below asserts where something GOES, not that it renders.
 */
const strip = (f: string) => readFileSync(f, 'utf8')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(l => l.replace(/^\s*\/\/.*$/, '')).join('\n')
const dash = strip('app/dashboard/DashboardClient.tsx')
const me = strip('components/dashboard/MeScreen.tsx')
const wizard = strip('app/dashboard/GeneratePlanScreen.tsx')

describe('the setup moved out of Me, and nothing still points at the old home', () => {
  it('Me has no strength section any more (a stale section would be a second, unreachable owner)', () => {
    expect(me).not.toMatch(/activeSection === 'strength'/)
    expect(me).not.toMatch(/'strength'>\('main'\)/)
    expect(me).not.toMatch(/StrengthSetupScreen/)
  })
  it('Me\'s door calls out to the dashboard', () => {
    expect(me).toMatch(/onClick=\{strength\.onOpen\}/)
    expect(dash).toMatch(/onOpen: \(\) => openStrengthSetup\('me'\)/)
  })
  it('the screen says its title ONCE and backs out to whichever door opened it', () => {
    const at = dash.indexOf("screen === 'strength-setup'")
    expect(at).toBeGreaterThan(-1)
    const block = dash.slice(at, dash.indexOf("screen === 'me'", at))
    expect(block.match(/<ScreenHeader/g) ?? []).toHaveLength(1)
    expect(block).toMatch(/onBack=\{\(\) => setScreen\(strengthSetupOrigin\)\}/)
    expect(block).toMatch(/<StrengthSetupScreen/)
  })
  it('🔴 it is mounted only where strength is available (a move must not cross the release gate)', () => {
    expect(dash).toMatch(/screen === 'strength-setup' && strength\.status !== 'off'/)
  })
  it('all three doors open it, each naming itself as the origin', () => {
    for (const origin of ['me', 'plan', 'today']) expect(dash, origin).toMatch(new RegExp(`openStrengthSetup\\('${origin}'\\)`))
  })
  it('the modify-sheet door is offered only to a runner who can have strength', () => {
    expect(dash).toMatch(/strengthDoor=\{strength\.status === 'none' \|\| strength\.status === 'ready' \? \{/)
  })
})

describe('the wizard asks once, and never at the run plan\'s expense', () => {
  it('the step is offered only to a runner with strength available and not set up', () => {
    expect(dash).toMatch(/strengthOffer=\{strength\.status === 'none'\}/)
  })
  it('it sits after the weekday cap, and only when offered', () => {
    expect(wizard).toMatch(/'your-week', 'weekday-ceiling'\)\n\s*if \(offerStrength\) steps\.push\('strength'\)/)
    expect(wizard.match(/getStepSequence\(!!hasPaidAccess, goal\)/g) ?? [], 'a caller that forgot the offer').toEqual([])
  })
  it('🔴 strength is saved AFTER the run plan saves, and is not awaited', () => {
    const at = wizard.indexOf('await onPlanSaved(planRef.current)')
    const strengthAt = wizard.indexOf('onStrengthChosen?.(strengthChoice)')
    expect(at).toBeGreaterThan(-1)
    expect(strengthAt).toBeGreaterThan(at)
    expect(wizard.slice(strengthAt - 20, strengthAt)).not.toMatch(/await/)
    // Inside the try, so a failed run-plan save never builds strength for a plan that does not exist.
    expect(wizard.indexOf('} catch (err) {', at)).toBeGreaterThan(strengthAt)
  })
  it('the step is optional: skipping it proceeds and means no strength', () => {
    expect(wizard).toMatch(/case 'strength':\s+return true/)
  })
})
