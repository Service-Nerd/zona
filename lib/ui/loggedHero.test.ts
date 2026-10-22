import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🔴 SESSION-LOGGED-HERO-01 + POSTRUN-ZONE-TWICE-01 (Design Board 2026-10-22). ONE zone signal on every logged surface,
 * and it is the completion card:
 *   · post-run: How did it feel → the card → Kit's read (order chosen on UX grounds, delegated by the founder);
 *   · a reopened logged session, every tier: the card first once RPE exists, else one line that opens the fold;
 *   · Kit's card hides its own zone row wherever the card sits above it.
 * ⚠️ Source-shaped by necessity (`vitest.config.ts` is node, no jsdom), comments stripped, regions bounded.
 */
const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length))
const DC = strip(readFileSync('app/dashboard/DashboardClient.tsx', 'utf8'))
/** A top-level component's body: from its declaration to the next top-level declaration. */
function component(startMarker: string): string {
  const a = DC.indexOf(startMarker)
  expect(a, `${startMarker} not found`).toBeGreaterThan(-1)
  const rest = DC.slice(a + startMarker.length)
  const m = rest.search(/\n(export )?(async )?function [A-Z]/)
  // The last component in the file runs to the end of it.
  return DC.slice(a, m === -1 ? DC.length : a + startMarker.length + m)
}
/** Its render: the component's OWN return (exactly two spaces deep), never a nested one. */
const render = (body: string) => { const i = body.lastIndexOf('\n  return ('); expect(i).toBeGreaterThan(-1); return body.slice(i) }
const postRun = () => render(component('function PostRunScreen({'))
const sessionScreen = () => render(component('function SessionScreen({'))

describe('post-run: the number, then why', () => {
  it('🔴 How did it feel → the completion card → Kit\'s read', () => {
    const b = postRun()
    const feel = b.indexOf('How did it feel?'), card = b.indexOf('<SessionCompleteCard'), kit = b.indexOf('<RunFeedbackCard')
    expect(feel).toBeGreaterThan(-1)
    expect(card).toBeGreaterThan(feel)
    expect(kit).toBeGreaterThan(card)
  })
  it('🔴 Kit\'s card hides its zone row once the card is above it (no zone signal twice)', () => {
    expect(postRun()).toMatch(/<RunFeedbackCard\s+analysis=\{analysis\}\s+hideZoneSignal=\{rpe !== null\}/)
  })
})

describe('a reopened logged session leads with the run, for every tier', () => {
  it('🔴 the card comes before Kit\'s read AND before the locked preview', () => {
    const b = sessionScreen()
    const hero = b.indexOf('data-run-hero'), kit = b.indexOf('<RunFeedbackCard'), locked = b.indexOf('<LockedCoachingPreview')
    expect(hero).toBeGreaterThan(-1)
    expect(hero).toBeLessThan(kit)
    expect(hero).toBeLessThan(locked)
  })
  it('🔴 it is UNGATED: no tier check opens between the content start and the card', () => {
    const b = sessionScreen()
    const content = b.indexOf("<div style={{ padding: '0 16px' }}>"), hero = b.indexOf('data-run-hero')
    expect(content).toBeGreaterThan(-1)
    expect(b.slice(content, hero)).not.toContain('hasPaidAccess')
  })
  it('🔴 RPE before the read: without a felt score it asks, and the ask opens the existing fold', () => {
    const b = sessionScreen()
    expect(b).toMatch(/showRunHero && \(hasFelt \?/)
    expect(b).toMatch(/data-run-hero-ask[\s\S]{0,200}setBriefOpen\(true\)[\s\S]{0,40}How did it feel\?/)
  })
  it('Kit\'s card there hides its zone row only when the card is shown', () => {
    expect(sessionScreen()).toMatch(/hideZoneSignal=\{showRunHero && hasFelt\}/)
  })
  it('must not lose: the details fold, Up next, Unlink and the locked preview are all still here', () => {
    const b = sessionScreen()
    expect(b).toContain('Session details · tweak how it felt')
    expect(b).toContain('Up next')
    expect(b).toContain('Unlink this run')
    expect(b).toContain('<LockedCoachingPreview')
  })
})

describe('Kit\'s card with the zone row hidden', () => {
  const rfc = () => render(component('export function RunFeedbackCard('))
  it('🔴 the verdict line and the zone row are behind !hideZoneSignal; the score chip and Kit\'s read are not', () => {
    const b = rfc()
    expect(b).toMatch(/\{!hideZoneSignal && <div[\s\S]{0,400}\{voice\.headline\}/)
    expect(b).toMatch(/\{!hideZoneSignal && !isManual && zoneSignal != null && \(/)
    const chip = b.indexOf('{score}/100'), read = b.indexOf('Read of your run')
    expect(chip).toBeGreaterThan(-1)
    expect(read).toBeGreaterThan(-1)
    expect(b.slice(Math.max(0, chip - 300), chip)).not.toContain('hideZoneSignal &&')
  })
})
