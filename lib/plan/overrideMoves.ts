// PLAN-MOVE-DELETE-01 — the ONE decision about which override rows a move replaces.
//
// `PlanCalendar.handleMove` used to compute this twice: a client filter (for the screen) and a
// database `.or(...)` (for the store), and they disagreed. The database also deleted rows with
// `original_day = newDay`, so moving a session onto a day whose OWN session had been moved away
// erased that other move in the store while the screen still showed it. The two now read this.

export interface OverrideRow { week_n: number; original_day: string; new_day: string; new_slot?: 'am' | 'pm' | null }

export function planMove(
  all: readonly OverrideRow[], weekN: number, originalDay: string, newDay: string,
  /** SESSION-SLOTS-01 — set only when the runner chose "Do both" (§126): the mover's half of the day. */
  slot: 'am' | 'pm' | null = null,
): { next: OverrideRow[]; removedOriginalDays: string[] } {
  // A double ("Do both", §126) JOINS the day's occupant, so a row landing the occupant on that day is
  // kept: replacing it would send the occupant home and the runner would see a move, not a double.
  const replaced = (o: OverrideRow) => o.week_n === weekN && (o.original_day === originalDay || (!slot && o.new_day === newDay))
  const removedOriginalDays = Array.from(new Set([originalDay, ...all.filter(replaced).map(o => o.original_day)]))
  const kept = all.filter(o => !replaced(o))
  const row: OverrideRow = slot ? { week_n: weekN, original_day: originalDay, new_day: newDay, new_slot: slot } : { week_n: weekN, original_day: originalDay, new_day: newDay }
  const next = newDay === originalDay ? kept : [...kept, row]
  return { next, removedOriginalDays }
}
