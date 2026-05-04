// AICoachChip — the canonical "AI Coach" pill chip.
//
// Replaces the bare AIMark + eyebrow-label pattern on all AI-generated content.
// More legible than the standalone sparkle — communicates provenance to users
// who haven't yet built a mental model of the glyph alone.
//
// Design principles:
//   - Always moss on standard surfaces (--card, --bg-soft). Warn variant on --warn-bg.
//   - Working state changes text to "thinking…" + pulses the icon.
//   - Use AIMark internally. Never reimplement the glyph.
//   - Use only where content is genuinely model-generated (same rule as AIMark).
//
// Reference: docs/canonical/ui-patterns.md § AICoachChip (Pattern 19)

import AIMark from './AIMark'
import { BRAND } from '@/lib/brand'

interface AICoachChipProps {
  /** Animated pulse — use while AI is generating. Shows "thinking…" label. */
  working?: boolean
  /**
   * Surface colour variant.
   * 'moss' (default) — for --card and --bg-soft surfaces.
   * 'warn' — for --warn-bg surfaces (CoachNoteBlock, weekly report card).
   */
  color?: 'moss' | 'warn'
}

export default function AICoachChip({ working = false, color = 'moss' }: AICoachChipProps) {
  const isMoss    = color === 'moss'
  const textColor = isMoss ? 'var(--moss)' : 'var(--warn)'
  const bgColor   = isMoss ? 'rgba(107,142,107,0.10)' : 'rgba(184,133,58,0.15)'

  return (
    <span
      role="img"
      aria-label={working ? `${BRAND.coachName} thinking` : BRAND.coachName}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        gap:            '4px',
        fontFamily:     'var(--font-ui)',
        fontSize:       '11px',
        fontWeight:     600,
        color:          textColor,
        background:     bgColor,
        borderRadius:   '10px',
        padding:        '3px 8px',
        lineHeight:     1,
        flexShrink:     0,
        letterSpacing:  '0.01em',
      }}
    >
      <AIMark size={9} color={textColor} working={working} />
      {working ? 'thinking…' : BRAND.coachName}
    </span>
  )
}
