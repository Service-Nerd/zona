import type { CSSProperties, ReactNode } from 'react'

/**
 * INLINE-ERROR-OWNER-01 (Design Board, 2026-10-16) — THE one-line error message under an
 * action: "Could not save that change. Try again."
 *
 * 🔴 WHY ONE OWNER. Six hand-written copies of this line existed (the change card, the
 * readiness card, the Adjust sheet, the wizard save bar, redeem code, Update Paces), three
 * added the same day, and they had already split on COLOUR: plain `--danger` measures
 * 4.36:1 on `--bg-soft` and 4.46:1 on `--warn-bg`, failing AA at 14px.
 * `--danger-strong` (minted for error TEXT by DANGER-TEXT-CONTRAST-01) passes on all four
 * grounds: 5.61 `--bg`, 5.27 `--bg-soft`, 5.38 `--warn-bg`, 6.38 `--card`.
 *
 * ⚠️ NOT `FieldReadback alert`. That is a field's VALUE slot showing a refusal, at the
 * readback's weight (600). This is a message under the actions (400). Same colour,
 * different job (Silvanto).
 *
 * `style` is for SPACING ONLY (margins, padding). The type and colour are this component's.
 */
export function InlineError({ children, align = 'left', style }: {
  children: ReactNode
  align?: 'left' | 'center'
  style?: Pick<CSSProperties, 'margin' | 'marginTop' | 'marginBottom' | 'padding'>
}) {
  return (
    <div role="alert" style={{
      fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 400, lineHeight: 1.5,
      color: 'var(--danger-strong)', textAlign: align, ...style,
    }}>
      {children}
    </div>
  )
}
