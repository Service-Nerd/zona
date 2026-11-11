// §18 / §10 — a self-reported longest run cannot exceed the whole week's volume.
//
// 🔑 ONE OWNER, CALLED BY THE SCREEN AND THE SERVER, which is `benchmarkCheck.ts`'s
// pattern and its stated reason: *"the screen and the server refuse the same thing."*
// The predicate was inline in `INV-INPUT-LONGEST-LE-WEEKLY` and the wizard that collects
// both numbers never compared them, so the only thing the invariant achieved was to make
// the plan permanently invalid after the fact.
//
// 📐 Measured 2026-11-11 against stored plans: **2 of 43 trip this**, and the item that
// filed it said 2. ⚠️ A third plan has `longest 5 km > weekly 0 km` and does NOT trip it:
// the rule is guarded on `weekly > 0` so the meta-empty validation path self-skips. **Both
// counts are right about different populations** — the raw comparison finds 3, the rule
// finds 2 — and the guard is deliberately mirrored here rather than tightened, because a
// screen that refuses what the server accepts is a second answer, not a stricter one.
//
// ⚖️ Coaching Board 2026-11-11 (WIZARD-CONTRADICTORY-VOLUME-01) REFUSED the item's own
// proposed fix: *"accept the larger number as the weekly floor"*. Willy: *"the single long
// run is the fact; the week is not."* A runner who ran 20 km once off a 10 km week has a
// longest of 20 and a weekly of 10; promoting the week to 20 invents tonnage they never
// ran, and §2's 10% ramp would then build from a false base. **The wizard asks again. It
// does not silently pick a winner.**

/** The one predicate. `null` when the pair is consistent or cannot be judged. */
export function volumePairProblem(
  weeklyKm: number | null | undefined,
  longestRunKm: number | null | undefined,
): 'longest_exceeds_weekly' | null {
  const weekly = weeklyKm ?? 0
  const longest = longestRunKm ?? 0
  // Guarded on weekly > 0, exactly as the invariant is: see the note above.
  return weekly > 0 && longest > weekly ? 'longest_exceeds_weekly' : null
}

/**
 * What the runner reads on the step. One sentence, states the two numbers back, no blame.
 *
 * ⚠️ No em dash: a sentence the runner reads (founder, 2026-09-22).
 * ⚠️ It names the LEVER, per §44's habit: the runner can fix either number, and the copy
 * does not tell them which one was wrong, because we do not know.
 */
export function volumePairMessage(weeklyKm: number, longestRunKm: number): string {
  return `A single run of ${longestRunKm} km will not fit inside a ${weeklyKm} km week. `
    + 'Adjust either number.'
}
