// STRENGTH-ENTRY-01 — the rest card's strength line (Design Board, Silvanto): an invitation is
// not Today's job, except on the rest card, which has nothing to execute. At most once a week,
// so it is said on ONE day: the week's first rest day. No storage and no dismiss state: the
// day itself is the rule, so it cannot drift between devices or reappear after a reinstall.

export function showsStrengthInvite(
  week: readonly { displayKey: string; type: string }[],
  selectedKey: string | null,
): boolean {
  if (!selectedKey) return false
  const first = week.find(e => e.type === 'rest')
  return !!first && first.displayKey === selectedKey
}
