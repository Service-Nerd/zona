import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { PreferencesScreen, PREFERENCES_TITLE, PREFERENCES_SUBTITLE } from './PreferencesScreen'

// ME-DOORS-01 (2026-09-28) — executing ME-PURPOSE-01. Three arms, each holding shut a
// decision that is invisible in review.

const screen = (p: Partial<React.ComponentProps<typeof PreferencesScreen>> = {}) =>
  html(React.createElement(PreferencesScreen, {
    preferredUnits: 'km', onUnitsChange: () => {},
    preferredMetric: 'distance', onMetricChange: () => {},
    ...p,
  }))

describe('ME-DOORS-01 — the Preferences door', () => {
  it('holds both display controls, labelled', () => {
    const m = screen()
    expect(m).toContain('Distance units')
    expect(m).toContain('Session display')
  })

  // 🔴 THE ARM THAT MATTERS. A free runner passes no `notifications` node. The screen must
  // render calmly rather than show a heading over nothing: *empty means calm, not broken*
  // (UI Principles). A heading with no card under it is the shape that reads as a bug.
  it('renders nothing where notifications would be, when there are none', () => {
    const m = screen()
    expect(m).not.toMatch(/Notification/i)
    expect(m).not.toMatch(/Push/i)
  })

  it('renders the notifications node when one is passed', () => {
    const m = screen({ notifications: React.createElement('div', null, 'PUSH-ROWS-HERE') })
    expect(m).toContain('PUSH-ROWS-HERE')
  })

  // ⚠️ THE ROW LABEL AND THE SCREEN TITLE ARE THE SAME STRING BY DEFINITION — the runner
  // taps a word and expects to arrive at it. Written out twice they drift, and each surface
  // still reads correctly on its own, which is why nobody notices.
  it('the door label is named once and reached by both surfaces', () => {
    const dash = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    for (const id of ['PREFERENCES_TITLE', 'PREFERENCES_SUBTITLE', 'PLAN_ADJUSTMENTS_TITLE']) {
      expect(dash, `${id} is not reached from DashboardClient`).toContain(id)
    }
    // ⚠️ `HEART_RATE_TITLE` LEFT THIS LIST ON ZONES-HR-SHEET-01 AND THE RULE FOLLOWED IT.
    // The HR door became a sheet on the zones screen, so the constant is reached from
    // `HrCalibrationSheet` instead. Asserted THERE rather than dropped — a title that stops
    // being checked anywhere is how two surfaces start drifting.
    const sheet = readFileSync('components/shared/HrCalibrationSheet.tsx', 'utf8')
    expect(sheet, 'the sheet must take its title from the owner').toMatch(/\bHEART_RATE_TITLE\b/)
    // and the literal must NOT be typed out beside the constant
    expect(dash, 'the title was hardcoded next to the constant').not.toContain("title=\"Preferences\"")
    expect(dash, 'the title was hardcoded next to the constant').not.toContain("title=\"Heart rate\"")
    expect(PREFERENCES_TITLE).toBe('Preferences')
    expect(PREFERENCES_SUBTITLE.length).toBeGreaterThan(10)
  })

  // ⚠️ NOTHING WAS REDESIGNED. The controls are the SAME components, moved. If a future
  // change makes this screen author its own control, the move stops being reviewable as
  // a move.
  it('uses the shared SegmentedControl, not a local one', () => {
    const src = readFileSync('components/shared/PreferencesScreen.tsx', 'utf8')
    expect(src).toContain("from '@/components/shared/SegmentedControl'")
    expect(src, 'a hand-rolled control appeared in a screen whose job was to relocate').not.toMatch(/<button/)
  })
})
