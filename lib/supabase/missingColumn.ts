// STRENGTH-LOG-REPS-01 — "this column does not exist yet", the one shape an unapplied migration takes on a write or a
// read. PostgREST answers PGRST204 when its schema cache lacks the column; Postgres answers 42703 (undefined_column).
// A caller uses it to keep the runner's data on the old columns and say so, never to swallow any other error.

export function isMissingColumn(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false
  return error.code === 'PGRST204' || error.code === '42703'
}
