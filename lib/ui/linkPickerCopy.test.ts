// LINK-PICKER-ALREADY-LINKED-01 — the gate for the Design Board's 2026-10-08 amendment.
//
// Behavioural on the copy owner, source-shaped on the wiring, and the split is
// deliberate: the decision is a pure function and can be called, but the component it
// renders in lives inside a `'use client'` module that `environment: 'node'` cannot
// mount. Same limit, same declaration, as `postRunPaceWired.test.ts`.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { linkPickerCopy } from './linkPickerCopy'

const EMPTY_STATE_SUBTITLE = 'Optional, select from recent runs'

describe('linkPickerCopy — the state is stated before the action is offered', () => {
  it('UNLINKED is unchanged: the original copy was written for this state and is right', () => {
    expect(linkPickerCopy(false)).toEqual({
      eyebrow: 'Link an activity',
      subtitle: EMPTY_STATE_SUBTITLE,
    })
  })

  // 🔴 THE DEFECT, as an assertion. This is what the founder read on a linked session.
  it('LINKED never renders the empty-state instruction', () => {
    const withName = linkPickerCopy(true, 'Morning Run')
    const without  = linkPickerCopy(true, null)
    for (const c of [withName, without]) {
      expect(c.subtitle).not.toBe(EMPTY_STATE_SUBTITLE)
      expect(c.subtitle).not.toContain('Optional')
      expect(c.eyebrow).not.toBe('Link an activity')
    }
  })

  it('LINKED states it in the past tense and names the run when known', () => {
    const c = linkPickerCopy(true, 'Morning Run')
    expect(c.eyebrow).toBe('Linked run')
    expect(c.subtitle).toBe('This session is linked to Morning Run. Pick another to change it.')
  })

  // ⚠️ The pool is windowed, so a missing name is NORMAL, not an error. It must read as
  // a complete sentence: never "linked to your ." and never a bare placeholder.
  it('a missing name still reads as a complete sentence', () => {
    const c = linkPickerCopy(true, null)
    expect(c.subtitle).toBe('This session is already linked. Pick another to change it.')
    expect(c.subtitle).not.toMatch(/\s\.|undefined|null|—/)
  })

  it('still offers the change, because the board did NOT remove the list', () => {
    // Collins argued for removing it; that position is recorded UNRESOLVED and needs
    // the founder on a device. This arm exists so a future edit cannot quietly
    // implement his half under cover of this ruling.
    for (const name of ['Morning Run', null]) {
      expect(linkPickerCopy(true, name).subtitle).toContain('Pick another to change it')
    }
  })

  it('no em dash in any branch: these are sentences the runner reads', () => {
    const all = [linkPickerCopy(false), linkPickerCopy(true, 'Run (Strava)'), linkPickerCopy(true, null)]
    for (const c of all) {
      expect(c.eyebrow + c.subtitle).not.toContain('—')
    }
  })
})

describe('the picker renders the owner, not a literal', () => {
  const SRC = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')

  it('imports the owner and renders both halves from it', () => {
    expect(SRC).toContain("from '@/lib/ui/linkPickerCopy'")
    expect(SRC).toContain('{pickerCopy.eyebrow}')
    expect(SRC).toContain('{pickerCopy.subtitle}')
  })

  it('the hardcoded empty-state heading is GONE from the component', () => {
    // It may only reach the screen via the owner's unlinked branch now.
    expect(SRC).not.toContain(`>${EMPTY_STATE_SUBTITLE}<`)
    expect(SRC).not.toContain('>Link an activity<')
  })

  it('the linked state is derived from BOTH id columns, not just Strava', () => {
    // ADR-011: HealthKit is the SOR and is the common case. Reading only
    // `strava_activity_id` would leave every HK-linked session reading as unlinked,
    // which is the same defect in a narrower population.
    expect(SRC).toContain('completion?.apple_health_uuid ?? completion?.strava_activity_id')
  })

  it('the claimed-filter that KEEPS the linked run is untouched', () => {
    // `BUTTON-COMPONENT-01`: the moss active fill is the only selected affordance, so
    // the linked run must stay in the list to carry it. Silvanto declined to veto on
    // the grounds that this line is COMPLIANCE, not the bug the item took it for.
    expect(SRC).toContain("r.id !== completion?.strava_activity_id && r.id !== completion?.apple_health_uuid")
  })
})
