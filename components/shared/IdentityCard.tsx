'use client'

// IdentityCard — the top card on the Me screen: who is signed in, on what tier,
// and the one place the runner's name is both SHOWN and CHANGED.
//
// PROFILE-IDENTITY-01 (Design Board, 2026-09-28), SHIP WITH AMENDMENT, on a founder
// instruction with a competitor screenshot as the reference.
//
// ── 🔴 WHAT THIS REPLACED, AND WHY IT WAS THE PROBLEM ───────────────────────
// The name was DISPLAYED here and EDITED in a form card further down the same screen.
// Zhuo: *"a value shown in one place and changed in another is the thing worth fixing."*
// The old missing-name state was a tappable row whose only job was to scroll you to that
// form (`focusProfileNameField`, now deleted). Editing in place removes the trip.
//
// ⚠️ NO SAVE BUTTON, AND THAT IS A RULING RATHER THAN A SIMPLIFICATION. Wroblewski:
// *"the Save button is the tell — it exists because this is a FORM, and a form is the
// right shape for three fields and the wrong shape for one."* Commit happens on blur or
// Enter. Escape cancels.
//
// 🔴 THE ERROR STATE IS DESIGNED, NOT INHERITED, and it was his blocking condition.
// Editing commits to the network. A Save button at least gives the runner something to
// press again; an inline field gives them nothing unless we build it. So a failed save
// REVERTS the value and says so, rather than leaving a typed name on screen that is not
// the name we hold.
//
// ── ⚠️ WHAT WAS DELIBERATELY NOT TAKEN FROM THE REFERENCE ───────────────────
// The competitor screen this borrows its name treatment from carries, directly beneath
// the name, a **week streak and three cumulative totals**, and below that a merchandising
// wall with a price. Both are already killed permanently:
//   · **M-6** — a week streak or any cumulative total on the profile. Wood: a streak
//     punishes the rest day this product defends, and a competitor shipping it is not
//     evidence.
//   · **M-7** — the merchandising profile, kill re-examined and STANDS.
// Recorded here as well as in the register because the screenshot will be looked at
// again, and the name treatment is the only part of it worth having.

import type React from 'react'
import { useState, useRef, useEffect } from 'react'
import { BRAND } from '@/lib/brand'
import { StatusBadge } from './StatusBadge'
import { tierBadgeFor } from '@/lib/tierBadge'
import type { TierReason } from '@/lib/trial'

/** Named once so the label and the input cannot point at different elements. */
export const IDENTITY_NAME_FIELD_ID = 'identity-first-name'
/** The accessible label. Visually hidden: the card's shape is the label. */
export const IDENTITY_NAME_LABEL = 'Your first name'
/** Shown when the save fails. Short, no apology, says what happened to their typing. */
export const IDENTITY_SAVE_FAILED = 'Could not save that. Your name is unchanged.'
/** 🔴 AN INSTRUCTION, NOT A NAME, AND THE FIRST CUT GOT THIS WRONG.
 *  It was `BRAND.name`, carried over from the old form field where a "First name" LABEL
 *  sat above it and the placeholder only had to show the field's shape. There is no label
 *  here, so a grey product name in the name slot reads as a value the app already holds —
 *  which is precisely the failure §36 exists to record ("a grey 'Your name' ... it read as
 *  a value the app already held"). Caught by rendering `/me-preview`, not by review. */
export const IDENTITY_NAME_PLACEHOLDER = 'Add your name'

type Mode = 'rest' | 'editing' | 'saving' | 'failed'

/**
 * 🔴 THE PENCIL, ADDED AFTER THE FOUNDER LOOKED AT IT: *"the name on me profile
 * doesn't have a pencil so we don't know you can edit."*
 *
 * The board left this open deliberately. Silvanto asked for the bare field FIRST — *"a
 * pencil beside an editable name is decoration explaining what the type should already
 * say"* — and the chair recorded that it had not been seen on a device. It has now, and
 * the bare version does not read as editable. **That is the evidence the ruling was
 * waiting for, not an override of it.**
 *
 * ⚠️ IT APPEARS BESIDE A VALUE AND NEVER BESIDE THE PROMPT. **M-2 is Silvanto's own
 * amendment** and licenses exactly this: an icon on a row that carries a current value.
 * The empty state already says "Add your name", which is an instruction — a pencil there
 * would explain a sentence that explains itself.
 */
function EditGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"
      style={{ flexShrink: 0, color: 'var(--mute)' }}>
      <path d="M11.5 2.5a1.4 1.4 0 0 1 2 2L5 13l-2.5.5L3 11l8.5-8.5Z"
        stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function IdentityCard({ initials, firstName, tierLabel, tierReason, onSaveName }: {
  /** Already resolved by the caller — see the fallback chain in `profileInitials`. */
  initials: string
  firstName: string
  /** ⚠️ LEGACY. Superseded by `tierReason`, which distinguishes all five states.
   *  Kept only so `/me-preview` can drive the card without a resolver. */
  tierLabel: string
  /** TIER-BADGE-01 — the resolved access reason. `null` while resolving: render nothing. */
  tierReason?: TierReason | null
  /** Resolves false if the write failed. The card reverts and says so. */
  onSaveName: (name: string) => Promise<boolean>
}) {
  // ⚠️ `tierReason` is the real input. `tierLabel` survives ONLY so the fixture page can
  // drive every state without standing up a tier resolver; a runner never takes that path.
  const badge = tierBadgeFor(tierReason) ?? (tierLabel ? { label: tierLabel, tone: 'none' as const } : null)
  const [mode, setMode] = useState<Mode>('rest')
  const [draft, setDraft] = useState(firstName)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Set while committing so the blur that follows Enter cannot fire a second save.
  const committing = useRef(false)

  useEffect(() => { setDraft(firstName) }, [firstName])
  useEffect(() => {
    if (mode === 'editing') inputRef.current?.focus()
  }, [mode])

  async function commit() {
    if (committing.current) return
    const next = draft.trim()
    if (next === firstName.trim()) { setMode('rest'); return }
    if (!next) { setDraft(firstName); setMode('rest'); return }
    committing.current = true
    setMode('saving')
    const ok = await onSaveName(next)
    committing.current = false
    if (ok) { setMode('rest'); return }
    // Revert rather than leave a value on screen that is not the value we hold.
    setDraft(firstName)
    setMode('failed')
  }

  function cancel() {
    setDraft(firstName)
    setMode('rest')
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)',
    padding: '16px', border: '1px solid var(--line)',
    display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
  }

  const nameType: React.CSSProperties = {
    fontFamily: 'var(--font-brand)', fontSize: '17px', fontWeight: 500,
    color: 'var(--ink)', lineHeight: 1.2,
  }

  const subType: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
    marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  }

  const editing = mode === 'editing' || mode === 'saving'

  return (
    <div style={cardStyle}>
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--moss)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-brand)', fontSize: '16px', fontWeight: 600, color: 'var(--card)', flexShrink: 0 }}>
        {initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* ⚠️ The input is ALWAYS rendered at the same size and position as the resting
            text. Silvanto: "a name that jumps when you touch it is the thing people
            remember about a screen." Only the border changes. */}
        <label htmlFor={IDENTITY_NAME_FIELD_ID} style={{
          position: 'absolute', width: '1px', height: '1px', overflow: 'hidden',
          clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
        }}>
          {IDENTITY_NAME_LABEL}
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <input
          id={IDENTITY_NAME_FIELD_ID}
          ref={inputRef}
          value={draft}
          readOnly={!editing}
          disabled={mode === 'saving'}
          placeholder={IDENTITY_NAME_PLACEHOLDER}
          autoComplete="given-name"
          enterKeyHint="done"
          onChange={e => setDraft(e.target.value)}
          onFocus={() => { if (mode !== 'saving') setMode('editing') }}
          onBlur={() => { if (mode === 'editing') void commit() }}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); void commit(); inputRef.current?.blur() }
            if (e.key === 'Escape') { cancel(); inputRef.current?.blur() }
          }}
          style={{
            ...nameType,
            flex: 1, minWidth: 0, padding: '2px 6px', margin: '-2px -6px',
            background: 'transparent',
            border: '1px solid',
            borderColor: editing ? 'var(--moss-mid)' : 'transparent',
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
            // ⚠️ The affordance is the field itself, not an icon. Silvanto asked for the
            // bare version to be tried before a pencil is added, and it has not been seen
            // on a device.
            cursor: editing ? 'text' : 'pointer',
          }}
        />
        {/* Only beside a VALUE (M-2), and gone while editing — once the field is focused
            the caret says what the pencil was there to say. */}
        {!editing && firstName && <EditGlyph />}
        </div>
        {/* 🔴 TIER-BADGE-01 — THE TIER USED TO BE PROSE. It rendered as 12px --mute
            subtext, the SAME treatment as the coach sentence beside it, so the one piece
            of state on this card read as a second clause. It is a STATUS now.
            ⚠️ `badge` is null while the tier resolves and nothing renders — defaulting
            would flash "FREE" at a paying subscriber on every open. */}
        <div style={{ ...subType, display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
          {mode === 'failed'
            ? <span style={{ color: 'var(--danger)' }}>{IDENTITY_SAVE_FAILED}</span>
            : (
              <>
                {badge && <StatusBadge label={badge.label} tone={badge.tone} />}
                {!firstName && <span>{`${BRAND.coachName} will use it.`}</span>}
              </>
            )}
        </div>
      </div>
    </div>
  )
}
