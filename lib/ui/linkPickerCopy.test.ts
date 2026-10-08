// LINK-PICKER-ALREADY-LINKED-01 — the gate for the Design Board's 2026-10-08 amendment.
//
// Behavioural on the copy owner, source-shaped on the wiring, and the split is
// deliberate: the decision is a pure function and can be called, but the component it
// renders in lives inside a `'use client'` module that `environment: 'node'` cannot
// mount. Same limit, same declaration, as `postRunPaceWired.test.ts`.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { linkPickerCopy, linkedRunDescriptor } from './linkPickerCopy'

const EMPTY_STATE_SUBTITLE = 'Optional, select from recent runs'

describe('linkPickerCopy — shape (b), ruled by the founder 2026-10-08', () => {
  it('UNLINKED is unchanged, and the list IS the screen', () => {
    expect(linkPickerCopy(false)).toEqual({
      eyebrow: 'Link an activity',
      subtitle: EMPTY_STATE_SUBTITLE,
      changeLabel: null,     // null = nothing to reveal, the list is already shown
    })
  })

  // 🔴 THE DEFECT, as an assertion. This is what the founder read on a linked session.
  it('LINKED never renders the empty-state instruction', () => {
    for (const c of [linkPickerCopy(true, '9.9km run, Wednesday'), linkPickerCopy(true, null)]) {
      expect(c.subtitle).not.toBe(EMPTY_STATE_SUBTITLE)
      expect(c.subtitle).not.toContain('Optional')
      expect(c.eyebrow).not.toBe('Link an activity')
    }
  })

  it('🎪 LINKED states what it has and hides the list behind "Wrong one?"', () => {
    const c = linkPickerCopy(true, '9.9km run, Wednesday')
    expect(c.eyebrow).toBe('Linked run')
    expect(c.subtitle).toBe('Linked to your 9.9km run, Wednesday.')
    // A non-null changeLabel is what makes the list start hidden.
    expect(c.changeLabel).toBe('Wrong one?')
  })

  // ⚠️ The label is DELIBERATELY the one already live on the auto-match suggestion.
  // Collins: "You wrote the right control and did not reuse it on the state that needs
  // it most." A second string for the same job is how a vocabulary drifts.
  it('reuses the existing affordance rather than inventing a second one', () => {
    const inner = readFileSync(join(process.cwd(), 'components/dashboard/SessionPopupInner.tsx'), 'utf8')
    // It appears as the auto-match escape AND is now returned by the owner.
    expect(inner).toContain('Wrong one?')
    expect(linkPickerCopy(true, 'x').changeLabel).toBe('Wrong one?')
  })

  it('a missing descriptor still reads as a complete sentence', () => {
    const c = linkPickerCopy(true, null)
    expect(c.subtitle).toBe('This session is already linked.')
    expect(c.subtitle).not.toMatch(/\s\.|undefined|null|\u2014/)
    // ⚠️ And it STILL offers the change, so a pool that does not hold the run cannot
    // strand the runner with a statement and no way out.
    expect(c.changeLabel).toBe('Wrong one?')
  })

  it('no em dash in any branch: these are sentences the runner reads', () => {
    for (const c of [linkPickerCopy(false), linkPickerCopy(true, '5km run, Monday'), linkPickerCopy(true, null)]) {
      expect(c.eyebrow + c.subtitle + (c.changeLabel ?? '')).not.toContain('\u2014')
    }
  })
})

describe('linkedRunDescriptor — distance and day, never the activity name', () => {
  // 🥇 NOT A STYLE CHOICE. `ACTIVITY-NAME-WRITER-01` records that `name` is set to
  // `Run (${sourceName})` — the app that WROTE the workout — so it renders as
  // "Run (Connect)" above a subtitle saying "Apple Health". Naming the run by what the
  // runner DID sidesteps that filed defect instead of quoting it into a new surface.
  it('builds the Collins line from distance and weekday', () => {
    expect(linkedRunDescriptor('9.9km', '2026-10-07T13:45:00.000Z')).toBe('9.9km run, Wednesday')
  })

  it('degrades a step at a time and never to a fragment', () => {
    expect(linkedRunDescriptor('9.9km', null)).toBe('9.9km run')
    expect(linkedRunDescriptor(null, '2026-10-07T13:45:00.000Z')).toBe('run from Wednesday')
    expect(linkedRunDescriptor(null, null)).toBeNull()
  })

  it('an unparseable date is absent, not "Invalid Date"', () => {
    expect(linkedRunDescriptor('9.9km', 'not-a-date')).toBe('9.9km run')
  })

  it('takes the distance ALREADY FORMATTED, so units have one owner', () => {
    // ADR-015 / INV-FMT-001: `lib/format.ts` owns every distance string. This module
    // must not grow a second opinion about km vs miles.
    expect(linkedRunDescriptor('6.1mi', '2026-10-07T13:45:00.000Z')).toBe('6.1mi run, Wednesday')
  })
})

describe('the picker renders the owner, not a literal', () => {
  const SRC = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')

  it('imports the owner and renders both halves from it', () => {
    expect(SRC).toContain("from '@/lib/ui/linkPickerCopy'")
    expect(SRC).toContain('{pickerCopy.eyebrow}')
    expect(SRC).toContain('{pickerCopy.subtitle}')
  })

  it('🎪 the list is gated on the reveal, not rendered by default', () => {
    // Shape (b). `showRunList` is true when nothing is linked (changeLabel null) or once
    // the runner taps through, so an UNLINKED session still gets the list immediately.
    expect(SRC).toContain('const showRunList = pickerCopy.changeLabel == null || pickerRevealed')
    expect(SRC).toContain('{showRunList && (loadingClaimed ? (')
    // And the reveal control exists and sets the state.
    expect(SRC).toContain('onClick={() => setPickerRevealed(true)}')
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

// LINK-PICKER-SELECTION-UNWIRED-01 — the linked run must be IDENTIFIABLE on the screen.
//
// 🔴 FOUNDER, 2026-10-08: "It doesn't do what you think it does now." He was right, and
// my description of the current behaviour to him was wrong. `setSelectedActivity` had
// exactly ONE caller — a user's tap — so on an already-linked session the state was null
// and FOUR consumers read as "never logged": no row highlighted, no `aria-pressed`, no
// AIMark hint, the CTA reading "Just mark it done" instead of "Confirm complete", and
// "Enter it manually" offered to a runner whose run was already attached.
//
// ⚠️ IT ALSO FALSIFIED THE CLAIMED-FILTER'S OWN STATED REASON, and a board premise with
// it: `:372` keeps the already-linked activity "so it can render as selected", and
// Silvanto declined to veto on the grounds that keeping it was compliance with
// `BUTTON-COMPONENT-01`'s moss-fill rule. There was no moss fill. The filter was doing
// its half of a two-part feature whose other half was never wired.
describe('LINK-PICKER-SELECTION-UNWIRED-01 — the existing link seeds the selection', () => {
  const SRC = readFileSync(join(process.cwd(), 'components/dashboard/SessionPopupInner.tsx'), 'utf8')

  it('an effect seeds selectedActivity from the completion', () => {
    expect(SRC).toMatch(/const linkedId = completion\?\.apple_health_uuid \?\? completion\?\.strava_activity_id/)
    expect(SRC).toContain('setSelectedActivity((prev: any) => prev ?? linked)')
  })

  it('it reads BOTH id columns, so a HealthKit link is not left unseeded', () => {
    // ADR-011 makes HealthKit the SOR and the common case; a Strava-only read would
    // leave most linked sessions looking unlogged, which is the same defect narrowed.
    const i = SRC.indexOf('const linkedId =')
    const decl = SRC.slice(i, SRC.indexOf('\n', i))
    expect(decl).toContain('apple_health_uuid')
    expect(decl).toContain('strava_activity_id')
  })

  it('🔴 it SEEDS and never re-asserts, so the runner keeps control', () => {
    // `prev ?? linked` is the whole safety property: a runner who taps another row, or
    // taps the linked row to clear it, must not have the selection snap back on the next
    // render. An unconditional `setSelectedActivity(linked)` would make the list unusable.
    expect(SRC).not.toMatch(/if \(linked\) setSelectedActivity\(linked\)/)
    expect(SRC).toContain('prev ?? linked')
  })

  it('and it does nothing when the session carries no link', () => {
    const i = SRC.indexOf('const linkedId =')
    const after = SRC.slice(i, i + 300)
    expect(after).toContain('if (linkedId == null) return')
  })
})

