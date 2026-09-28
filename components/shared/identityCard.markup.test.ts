import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import {
  IdentityCard,
  IDENTITY_NAME_FIELD_ID,
  IDENTITY_NAME_LABEL,
  IDENTITY_NAME_PLACEHOLDER,
} from './IdentityCard'
import { BRAND } from '@/lib/brand'

// PROFILE-IDENTITY-01 (Design Board, 2026-09-28) — the name is shown and changed in one
// place, the surname is retired, and the email is a value rather than a field.
//
// 🔴 THE REGRESSION SURFACE IS WIDER THAN THE COMPONENT, which is why this file asserts
// source facts as well as rendered ones. The change deletes a shared component
// (`ProfileSection`), removes an exported interaction (`focusProfileNameField`), rewrites
// a save path, and alters what `profileInitials` returns.
//
// ⚠️ ONE MEASURED CONTAINMENT, recorded because the first estimate was wrong: this does
// NOT change "every avatar in the app". `profileInitials` has exactly ONE production
// consumer — `DashboardClient.tsx:1023` — whose result feeds this card. The arm below
// asserts that containment so a second consumer cannot appear unnoticed.

const card = (props: Partial<React.ComponentProps<typeof IdentityCard>> = {}) =>
  html(React.createElement(IdentityCard, {
    initials: 'R', firstName: 'Russell', tierLabel: 'Pro',
    onSaveName: async () => true, ...props,
  }))

const tracked = (glob: string): string[] =>
  execSync(`git ls-files ${glob}`, { encoding: 'utf8' }).split('\n').filter(Boolean)

const appAndComponents = () =>
  [...tracked('"app/**/*.tsx"'), ...tracked('"components/**/*.tsx"')]
    .filter(f => !f.includes('.test.'))

describe('PROFILE-IDENTITY-01 — the identity card renders', () => {
  it('shows the name as an editable field, not as static text', () => {
    const m = card()
    expect(m).toContain(`id="${IDENTITY_NAME_FIELD_ID}"`)
    expect(m).toContain('value="Russell"')
  })

  // 🔴 WROBLEWSKI'S RULING, AS A TEST. "The Save button is the tell — it exists because
  // this is a FORM, and a form is the right shape for three fields and the wrong shape
  // for one." Commit is on blur or Enter.
  it('has NO save button', () => {
    expect(card()).not.toMatch(/<button/i)
  })

  // The §20 missing-name pattern was REWRITTEN, not amended: it used to be a tappable row
  // with a chevron whose only job was to scroll to a form field elsewhere on the screen.
  // That field no longer exists, so the empty state is now the same field, empty.
  it('the empty state is the same field, not a chevron row', () => {
    const m = card({ firstName: '' })
    expect(m).toContain(`id="${IDENTITY_NAME_FIELD_ID}"`)
    expect(m).toContain(`placeholder="${IDENTITY_NAME_PLACEHOLDER}"`)
    expect(m).not.toMatch(/<svg/)          // the chevron is gone
    expect(m).toContain(BRAND.coachName)   // "…will use it."
  })

  // 🔴 THE DEFECT I SHIPPED AND THEN SAW. The placeholder was `BRAND.name`, carried
  // over from the old form field where a "First name" LABEL sat above it. There is no
  // label here, so a grey product name in the name slot reads as a value the app already
  // holds — which is the exact failure §36 was written to record. It was invisible in
  // review and obvious the moment `/me-preview` was rendered.
  it('the empty state prompts rather than showing something that looks like a value', () => {
    expect(IDENTITY_NAME_PLACEHOLDER.toLowerCase()).not.toContain(BRAND.name.toLowerCase())
    expect(IDENTITY_NAME_PLACEHOLDER).toMatch(/name/i)
  })

  it('the field is labelled for a screen reader', () => {
    const m = card()
    expect(m).toContain(`for="${IDENTITY_NAME_FIELD_ID}"`)
    expect(m).toContain(IDENTITY_NAME_LABEL)
  })

  it('is read-only until focused, so a stray tap cannot start an edit silently', () => {
    expect(card()).toMatch(/readonly/i)
  })
})

describe('PROFILE-IDENTITY-01 — what the change removed, across the app', () => {
  it('no surname field survives anywhere', () => {
    const offenders = appAndComponents().filter(f => {
      const src = readFileSync(f, 'utf8')
      return /profile-last-name|autoComplete="family-name"|>Last name</.test(src)
    })
    expect(offenders, 'the surname was retired from the profile').toEqual([])
  })

  // The component and its exported focus helper are deleted.
  //
  // ⚠️ COMMENTS ARE STRIPPED FIRST, AND THAT IS DELIBERATE RATHER THAN A LOOSENING.
  // The first cut of this arm grepped whole files and failed on two lines that were both
  // COMMENTS — one genuinely stale (fixed), one a deliberate historical note in
  // `IdentityCard` explaining what it replaced and why. Recording what was deleted is how
  // this repo documents itself; a LIVE reference is the defect. Bound the region, never
  // grep the file.
  it('no LIVE reference to the retired ProfileSection or focusProfileNameField', () => {
    const offenders = appAndComponents().filter(f => {
      const code = readFileSync(f, 'utf8')
        .split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')
      return /ProfileSection|focusProfileNameField/.test(code)
    })
    expect(offenders).toEqual([])
  })

  // ⚠️ THE ARM THAT PROTECTS THE APPLE HANDOFF. Sign in with Apple returns a surname on
  // the very first authorization and NEVER AGAIN. We stopped asking for it; we must not
  // start overwriting it. A save that wrote `last_name: ''` would destroy it silently and
  // irrecoverably, and nothing else in the app would notice.
  it('the name save writes first_name and never touches last_name', () => {
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    const at = src.indexOf('onSaveName={async')
    expect(at, 'the save handler moved — re-anchor this arm').toBeGreaterThan(-1)
    const handler = src.slice(at, at + 700)
    expect(handler).toContain('first_name')
    expect(handler, 'writing last_name here would destroy what Apple gave us')
      .not.toContain('last_name')
  })

  // The containment claim, asserted rather than assumed. If a second surface starts
  // drawing initials it must be a deliberate act, because the one-letter ruling now
  // applies to it too.
  it('profileInitials still has exactly one production consumer', () => {
    const consumers = appAndComponents()
      .filter(f => /profileInitials\s*\(/.test(readFileSync(f, 'utf8')))
    expect(consumers).toEqual(['app/dashboard/DashboardClient.tsx'])
  })

  // 🔴 M-6 AND M-7, ASSERTED BECAUSE THE REFERENCE SCREENSHOT CONTAINS BOTH.
  // The competitor profile this borrowed its name treatment from carries a week streak,
  // three cumulative totals and a merchandising wall directly beneath the name. Both
  // patterns are permanently killed, and the screenshot will be looked at again.
  it('no streak or cumulative total appears on the identity card', () => {
    const src = readFileSync('components/shared/IdentityCard.tsx', 'utf8')
    const code = src.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/streak|TOTAL DISTANCE|totalDistance/i)
  })
})
