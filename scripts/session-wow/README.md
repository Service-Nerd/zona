# Session screens prototype — evaluation kit (SESSION-SCREENS-WOW-01)

The 2026-10-21 prototype of the Design Board's ruling (Zone Trace, logged hero, silhouette, step rows, closing marks).
Saved as `.txt` so it is never compiled or routed in the app. **No run data is committed:** the prototype read four
real heart-rate traces, de-identified (seconds from start and bpm only), into a `runs.json` beside the page in a
throwaway worktree. Re-extract them the same way (read-only, service role) before re-running; never commit them.

To run: in a throwaway worktree (see `scripts/strength-media/README.md` step 3 for the setup), copy this file to
`app/session-wow-preview/page.tsx`, put `runs.json` next to it (`{ runs: [{ session_type, zone, band: {lo, hi},
distance_km, moving_time_s, avg_hr, verdict, hr_in_zone_pct, hr_above_ceiling_pct, samples: [[secs, bpm], ...] }] }`),
`npx next dev -p 3100`, open `/session-wow-preview`.
