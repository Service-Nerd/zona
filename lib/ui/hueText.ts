// ACCENT-TEXT-VARIABLE-01 (Design Board 2026-10-22, 6t-h). The ONE owner of "this hue, as small text": a hue that has a
// ratified text shade uses it (`--moss-strong`, `--s-race-strong`, `--s-recov-strong`, `--warn-strong`, each ≥ 4.5:1 on
// `--card`), any other hue falls back to `--ink-2`. The hue itself belongs on the mark (rail, dot, tint, border).
//
// For a site whose colour is computed (a status, a phase, a rail), so the text cannot drift to a hue that fails AA.
const TEXT_SHADE: Record<string, string> = {
  'var(--moss)': 'var(--moss-strong)',
  'var(--accent)': 'var(--moss-strong)',
  'var(--s-race)': 'var(--s-race-strong)',
  'var(--session-race)': 'var(--s-race-strong)',
  'var(--s-recov)': 'var(--s-recov-strong)',
  'var(--session-recovery)': 'var(--s-recov-strong)',
  'var(--session-green)': 'var(--s-recov-strong)',
  'var(--warn)': 'var(--warn-strong)',
  'var(--danger)': 'var(--danger-strong)',
}
/** Neutral text colours pass through unchanged. */
const NEUTRAL = new Set(['var(--ink)', 'var(--ink-2)', 'var(--mute)', 'var(--text-primary)', 'var(--text-secondary)', 'var(--text-muted)'])
/** 6t-j: `--mute-2` (1.90:1) is never text, so a computed colour that resolves to it becomes `--mute`. */
const FAINT: Record<string, string> = { 'var(--mute-2)': 'var(--mute)', 'var(--text-dim)': 'var(--mute)' }

export function hueText(hue: string | null | undefined): string {
  if (!hue) return 'var(--ink-2)'
  if (FAINT[hue]) return FAINT[hue]
  if (NEUTRAL.has(hue) || hue.endsWith('-strong)')) return hue
  return TEXT_SHADE[hue] ?? 'var(--ink-2)'
}

// A11Y-APP-TEXT-SWEEP-01 (Design Board 2026-10-22, 6t-j). The ONE owner of "text ON a hue fill" (a zone badge's
// numeral, a filled chip): white or ink, whichever measures higher on that hue. The fill stays the hue. Measured from
// globals.css by `accentText.test.ts`, which fails if a hue token is missing here or the pick is not the better one.
// ⚠️ `--s-cross` clears neither (white 4.05, ink 4.30): ink is the better, and it is AA only as large text.
const INK_ON = new Set([
  '--moss', '--accent', '--teal', '--zona-teal', '--green', '--orange', '--orange-bright', '--zone-held',
  '--warn', '--amber', '--accent-amber', '--yellow', '--zone-drifted',
  '--s-quality', '--session-quality', '--s-inter', '--session-intervals', '--coral',
  '--s-race', '--session-race', '--s-cross', '--session-cross',
])
export function onHue(fill: string): 'var(--card)' | 'var(--ink)' {
  const name = /^var\((--[a-z0-9-]+)\)$/.exec(fill)?.[1] ?? ''
  return INK_ON.has(name) ? 'var(--ink)' : 'var(--card)'
}
