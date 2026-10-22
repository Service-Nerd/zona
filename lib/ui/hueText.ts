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
const NEUTRAL = new Set(['var(--ink)', 'var(--ink-2)', 'var(--mute)', 'var(--mute-2)', 'var(--text-primary)', 'var(--text-secondary)', 'var(--text-muted)'])

export function hueText(hue: string | null | undefined): string {
  if (!hue) return 'var(--ink-2)'
  if (NEUTRAL.has(hue) || hue.endsWith('-strong)')) return hue
  return TEXT_SHADE[hue] ?? 'var(--ink-2)'
}
