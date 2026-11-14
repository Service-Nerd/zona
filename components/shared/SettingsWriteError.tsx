'use client'

/**
 * The sentence a runner sees when a setting they typed did not reach their account.
 *
 * 🧭 `USER-SETTINGS-TELL-THE-RUNNER-01` — Design Board 2026-11-14, SHIP WITH AMENDMENT.
 * Inline, **beneath the control that failed**, in `--danger`, with the value left exactly
 * where the runner put it.
 *
 * 🔴 WHY NOT THE EXISTING ERROR PATTERN. `ME-HISTORY-ERROR-DEADEND-01` gives a failed LOAD an
 * `EmptyState` with a retry. That is wrong for a failed SAVE: the data is still on screen and
 * still correct, so replacing the screen would destroy what they just typed. ✋ Silvanto:
 * *"a row that failed to save must not look like a row that did."*
 *
 * 🩹 And the inversion that made it necessary (Wroblewski): the two writes that COULD report a
 * failure were the two the runner never asked for, where a lost write just makes a card
 * reappear. The four they typed with their thumbs had nothing — while every SERVER surface
 * (daily push, trial emails, coach prompts) reads the table the screen failed to write.
 * `PROFILE-NAME-WRITE-01` is the measured precedent: 44 of 46 rows held an empty `first_name`
 * while the greeting read the right name off auth metadata for months.
 *
 * 🎓 No retry affordance (Sierra): the retry is flipping the control again, which they already
 * know how to do. The sentence's job is to say the server now disagrees with the screen.
 *
 * ⚠️ The words are NOT this component's. `settingsWriteFailureMessage` owns them, so the voice
 * is decided once — pass its output in.
 */
export default function SettingsWriteError({ message }: { message: string | null }) {
  // An empty population must not render: no message, no element, no reserved space.
  if (!message) return null
  return (
    <div
      role="status"
      style={{
        fontFamily: 'var(--font-ui)',
        fontSize: '12px',
        lineHeight: 1.5,
        // ⛔ `--danger-strong`, NOT `--danger`. DANGER-TEXT-CONTRAST-01 (Design Board,
        // 2026-10-02): the base token is 4.36:1 on `--bg-soft` and FAILS AA on the one ground
        // it actually sits on. ⚠️ And the ruling's own note says the first text it governs is
        // an ERROR MESSAGE — "the worst place in the product to carry no margin" — which is
        // exactly this component. `lib/ui/hueText.ts` maps the pair.
        color: 'var(--danger-strong)',
        marginTop: 'var(--space-2)',
      }}
    >
      {message}
    </div>
  )
}
