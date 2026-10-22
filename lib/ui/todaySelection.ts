// TODAY-DAY-TAP-01 (RCA 2026-10-22). The Today strip's selected day: what it defaults to, and when it may be reset.
//
// The reset used to be keyed on the `sessions` array. That was harmless while `sessions` only changed with the week,
// and broke on 2026-10-17 when SESSION-SLOTS-01 made it depend on `completions`, which is a fresh `{}` on a week with
// nothing logged and a fresh object on every completions refresh. So a tap re-rendered, `sessions` was rebuilt, the
// "week changed" effect fired, and the selection snapped back to today: the strip stopped selecting anything.
// The key below is content, never identity, and it is built from the overrides-resolved days, which do not read
// completions at all, so logging a run can never take the runner's chosen day away.

export interface SelectableDay {
  displayKey: string
  today: boolean
  rawDate: Date
}

/** The day Today opens on: today, else the next day with a real session, else the last day that has one. */
export function defaultSelectedKey(
  sessions: readonly SelectableDay[],
  typeOf: (displayKey: string) => string | undefined,
  now: Date,
): string | null {
  const t = sessions.find(s => s.today)
  if (t) return t.displayKey
  const next = sessions.find(s => s.rawDate >= now && typeOf(s.displayKey) !== undefined && typeOf(s.displayKey) !== 'rest')
  if (next) return next.displayKey
  const last = [...sessions].reverse().find(s => typeOf(s.displayKey) !== undefined)
  return last?.displayKey ?? null
}

/** When this string changes, the selection resets to the default. The week, readiness, and each day's planned types. */
export function selectionResetKey(
  weekIndex: number,
  overridesReady: boolean,
  dayLists: Readonly<Record<string, readonly { type?: string }[]>>,
): string {
  const days = Object.keys(dayLists).sort().map(d => `${d}:${(dayLists[d] ?? []).map(e => e?.type ?? '').join('+')}`)
  return `${weekIndex}|${overridesReady ? 1 : 0}|${days.join(',')}`
}
