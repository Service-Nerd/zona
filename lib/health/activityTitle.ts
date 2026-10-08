// ACTIVITY-NAME-WRITER-01 — what a logged run's `name` column actually MEANS.
//
// 🔴 Lives here, beside the activity log, and NOT in `lib/ui/linkPickerCopy.ts`
// where it started: the question is about the provenance of a stored field, and
// both a UI component and the server-side auto-link writer need the answer.
// `lib/coaching/` importing `lib/ui/` to get it would be the wrong direction.
/**
 * ACTIVITY-NAME-WRITER-01 — does this run carry a title the RUNNER wrote?
 *
 * 🔴 Only a Strava activity does. Strava asks for a name ("Morning Run", "Parkrun
 * PB"), so that string is the runner's own and earns the prominent line in a list.
 * An Apple Health workout has no name field at all, so `lib/health/adapter.ts` used
 * to synthesise one from `sourceName` — **the app that wrote the workout** — and the
 * picker rendered "Run (Connect)" above a subtitle reading "Apple Health". Two true
 * statements that read as a contradiction, and a generic label in the loudest slot.
 *
 * ⚠️ THE SOURCE IS THE TEST, NEVER THE STRING, and this is the whole reason the
 * predicate lives here instead of inline. The adapter fix only reaches rows ingested
 * AFTER it deploys; every HealthKit row already stored still carries its fabricated
 * `Run (Garmin Connect)`. A predicate that sniffed the name would keep rendering all
 * of those. Reading `source` is correct for both the old rows and the new ones.
 *
 * The `=== 'Run'` arm is a second, narrower guard: a Strava activity genuinely named
 * "Run" is a default Strava assigns, not a decision, so it carries no information
 * the detail line does not already give.
 */
export function runnerAuthoredTitle(
  source: string | null | undefined,
  name: string | null | undefined,
): string | null {
  if (source === 'apple_health') return null
  const trimmed = name?.trim()
  if (!trimmed || trimmed === 'Run') return null
  return trimmed
}
