'use client'

// ProfileSection — the name + email card on the Me screen.
//
// Lifted out of DashboardClient (PROFILE-NAME-01) so it can be rendered at
// /me-preview. This card is behind auth and three taps deep; the only way to
// SEE its states was to be signed in as someone with that state, which is how
// the founder's own name shipped as the placeholder and read as stored data.
//
// ui-patterns.md § Form Fields & Pickers → TextField (objective, typed values).

import type React from 'react'
import { useState, useEffect } from 'react'
import { BRAND } from '@/lib/brand'
import { TextField } from '@/components/shared/TextField'

// Field ids, named once. Two jobs: pair each `<label>` with its input (the
// labels were decorative text before, so a screen reader read the fields as
// unlabelled), and give the identity card above a target to focus when the
// runner taps "Add your name". Exported so the prompt and the field cannot
// point at different elements.
export const PROFILE_FIRST_NAME_FIELD_ID = 'profile-first-name'
export const PROFILE_LAST_NAME_FIELD_ID  = 'profile-last-name'
export const PROFILE_EMAIL_FIELD_ID      = 'profile-email'

/** Focus the first-name field, wherever it is on the page. Used by the identity
 *  card's "Add your name" prompt — no modal, no second screen for one input
 *  (UI principle: no popups).
 *
 *  The focus is deferred past the scroll on purpose: on iOS, focusing first
 *  raises the keyboard, which resizes the viewport mid-scroll and leaves the
 *  field off-screen. `preventScroll` then stops the second, competing jump. */
export function focusProfileNameField() {
  const el = document.getElementById(PROFILE_FIRST_NAME_FIELD_ID) as HTMLInputElement | null
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  window.setTimeout(() => el.focus({ preventScroll: true }), 320)
}

export function ProfileSection({ firstName, lastName, email, onSave }: {
  firstName: string; lastName: string; email: string
  onSave: (fn: string, ln: string, em: string) => void
}) {
  const [fn, setFn] = useState(firstName)
  const [ln, setLn] = useState(lastName)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setFn(firstName) }, [firstName])
  useEffect(() => { setLn(lastName) }, [lastName])

  // Email is read-only — it's the auth identity, owned by the OAuth provider.
  // Changing it requires a re-verification flow we don't have, so the field
  // is shown for orientation only ("which account am I logged in with?").
  const isDirty = fn !== firstName || ln !== lastName
  const isValid = fn.trim().length > 0 || ln.trim().length > 0

  async function handleSave() {
    if (!isValid) return
    setSaving(true)
    await onSave(fn.trim(), ln.trim(), email)
    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 2000)
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '10px',
    color: 'var(--mute)', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 'var(--space-2)', display: 'block',
  }

  return (
    <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
        <div>
          <label htmlFor={PROFILE_FIRST_NAME_FIELD_ID} style={labelStyle}>First name</label>
          {/* Placeholders are the PRODUCT's name standing in for a person's, so
              the field shows its shape without looking like a stored value.
              See BRAND.surnamePlaceholder for why neither half is a literal. */}
          <TextField id={PROFILE_FIRST_NAME_FIELD_ID} type="text" placeholder={BRAND.name} value={fn} onChange={setFn} autoComplete="given-name" />
        </div>
        <div>
          <label htmlFor={PROFILE_LAST_NAME_FIELD_ID} style={labelStyle}>Last name</label>
          <TextField id={PROFILE_LAST_NAME_FIELD_ID} type="text" placeholder={BRAND.surnamePlaceholder} value={ln} onChange={setLn} autoComplete="family-name" />
        </div>
      </div>
      <div>
        <label htmlFor={PROFILE_EMAIL_FIELD_ID} style={labelStyle}>Email</label>
        <TextField id={PROFILE_EMAIL_FIELD_ID} type="email" value={email} onChange={() => {}} readOnly />
      </div>
      <button className="btn btn--secondary btn--regular btn--full"
        onClick={handleSave}
        disabled={!isDirty || !isValid || saving} style={{ padding: '11px', background: saved || (isDirty && isValid) ? 'var(--moss-soft)' : 'var(--bg)', border: `1px solid ${saved || (isDirty && isValid) ? 'var(--moss-mid)' : 'var(--line)'}`, borderRadius: '8px', cursor: isDirty && isValid ? 'pointer' : 'not-allowed', fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase', color: saved || (isDirty && isValid) ? 'var(--moss)' : 'var(--mute)' }}
      >
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save profile'}
      </button>
    </div>
  )
}
