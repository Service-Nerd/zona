// COACH-SEEN-MOMENTS-01 — one earned sentence, placed on its evidence (Design Board 2026-10-30, ui-patterns.md § Earned
// line). The sentence is ink (6t-g: a hue is never small text); the 6px moss dot is the only colour. No motion, no
// AIMark (rule-based copy), never a badge. The caller decides whether it is earned; this only draws it.

/** The dot's diameter. A mark, not an icon. */
export const EARNED_DOT_PX = 6

export default function EarnedLine({ text }: { text: string }) {
  return (
    <div data-earned-line style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
      <span
        aria-hidden="true"
        style={{
          width: `${EARNED_DOT_PX}px`, height: `${EARNED_DOT_PX}px`, borderRadius: '50%',
          background: 'var(--moss)', flexShrink: 0, transform: 'translateY(-2px)',
        }}
      />
      <span style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
        {text}
      </span>
    </div>
  )
}
