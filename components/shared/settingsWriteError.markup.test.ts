import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import SettingsWriteError from './SettingsWriteError'
import { settingsWriteFailureMessage } from '@/lib/supabase/userSettingsWrite'

// USER-SETTINGS-TELL-THE-RUNNER-01 — Design Board 2026-11-14, SHIP WITH AMENDMENT.
//
// 🩹 The inversion that caused it: the two `user_settings` writes that COULD report a failure
// were the two the runner never asked for, where a lost write only makes a card reappear. The
// four they TYPED had no channel at all, while every server surface — daily push, trial
// emails, coach prompts — reads the table the screen failed to write.
//
// ⚠️ THE ARMS BELOW ARE ABOUT A FAILED **SAVE**, NOT A FAILED LOAD. `ME-HISTORY-ERROR-DEADEND-01`
// gives a failed load an `EmptyState` with a retry; doing that here would replace the screen and
// destroy the value the runner just typed.
const src = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('SettingsWriteError — the sentence, where the ruling put it', () => {
  it('renders nothing at all with no message: no element, no reserved space', () => {
    expect(html(React.createElement(SettingsWriteError, { message: null }))).toBe('')
  })

  it('renders the shared sentence in --danger, and does not invent its own words', () => {
    const msg = settingsWriteFailureMessage('heart rate')
    // ⚠️ `renderToStaticMarkup` escapes the apostrophe in "Couldn't" to `&#x27;`, so comparing
    // the raw sentence fails on a component that is rendering it correctly. Unescape, then
    // compare against the owner's output — never against a copy of the words.
    const out = html(React.createElement(SettingsWriteError, { message: msg })).replace(/&#x27;/g, "'")
    expect(out).toContain(msg)
    // ⛔ DANGER-TEXT-CONTRAST-01: the base `--danger` is 4.36:1 on `--bg-soft` and fails AA on
    // the ground it sits on. An error message is the ruling's own named worst case.
    expect(out).toContain('var(--danger-strong)')
    expect(out).not.toMatch(/var\(--danger\)/)
    // The words belong to `settingsWriteFailureMessage`, so the voice is decided once.
    expect(src('components/shared/SettingsWriteError.tsx')).not.toMatch(/Couldn.t save/)
  })

  it('offers no retry control — the retry is using the control again (Sierra)', () => {
    const out = html(React.createElement(SettingsWriteError, { message: 'x' }))
    expect(out).not.toContain('<button')
  })
})

describe('the four runner-typed writes each have a channel, or a declared reason', () => {
  const dash = () => src('app/dashboard/DashboardClient.tsx')

  it('the HR sheet save is tell_the_runner and its verdict reaches the sheet', () => {
    expect(dash()).toContain("{ what: 'heart rate', severity: 'tell_the_runner' }")
    // The sheet must HOLD on a failure: closing before the write resolves is why there was
    // nowhere to put an error in the first place.
    expect(src('components/shared/HrCalibrationSheet.tsx')).toMatch(/if \(ok === false\) return false/)
    expect(src('components/dashboard/HRZonesSection.tsx')).toMatch(/SettingsWriteError/)
  })

  it('both preference toggles are tell_the_runner and report under the control', () => {
    expect(dash()).toContain("{ what: 'unit preference', severity: 'tell_the_runner' }")
    expect(dash()).toContain("{ what: 'session display', severity: 'tell_the_runner' }")
    const prefs = src('components/shared/PreferencesScreen.tsx')
    expect((prefs.match(/<SettingsWriteError /g) ?? []).length).toBe(2)
  })

  it('only an explicit false is a failure — undefined from a void handler is not', () => {
    // 🔴 Truthiness here would make every legacy caller start showing an error on a write that
    // SUCCEEDED, which is louder and more wrong than the silence this item fixed.
    for (const f of ['components/shared/PreferencesScreen.tsx', 'components/dashboard/HRZonesSection.tsx']) {
      expect(src(f), f).toMatch(/ok === false/)
      expect(src(f), f).not.toMatch(/if \(!ok\)/)
    }
  })

  it('birth year stays `log`, and the reason is written where the call is', () => {
    // A declared limit, not an omission: SAVE-LATENCY-01 made this write fire-and-forget, so by
    // the time it resolves the wizard has moved on and there is no control to sit a message
    // under. A `tell_the_runner` with no `onError` degrades silently to `log`.
    expect(dash()).toContain("{ what: 'year of birth', severity: 'log' }")
    expect(dash()).toMatch(/STAYS `log`, DECLARED NOT OVERLOOKED/)
  })
})
