# API Contract — /api/og/session-complete-card

**Method:** GET
**Auth:** Supabase session cookie (`getUserFromRequest`). Returns 401 otherwise.
**Tier:** All tiers (the card itself is FREE structure / PAID detail — paid users render State A with zone bar, free users render State B with RPE only). **The Zone Trace is FREE** (SLT 2026-10-21): any tier with a rich Apple Health trace renders *A + trace*.
**Runtime:** `nodejs` (auth-admin reads aren't edge-safe; matches the sibling SHARE-01 route).

## Query params

| Param | Required | Meaning |
|---|---|---|
| `week_n` | yes | Plan week number for the session. Integer. |
| `session_day` | yes | Lowercase three-letter day key (`mon`, `tue`, etc.) of the session within the week. |

## Response

- **200 — `image/png`**, 1080 × 1920 (Instagram story aspect). Rendered via `next/og` `ImageResponse`.
- **401** — no authenticated user.
- **404** — no `session_completions` row for that `(user_id, week_n, session_day)`.
- **422** — missing or non-integer `week_n`, or missing `session_day`.

## Source data

| Field | Source |
|---|---|
| Session type, ZoneBar zone | `plans.plan_json` → week `n` → `sessions[session_day].type` |
| Chip label | `getSessionLabel(planSlot ?? sessionType)`: the whole slot, so `isLongRun` names a long run (`type: 'easy'`) "Long run" (SESSION-COMPLETE-LONG-LABEL-01) |
| Date stamp | `session_completions.updated_at` |
| Zone % (State A) | `run_analysis.hr_in_zone_pct` for the same slot; rounded to integer |
| RPE / fatigue chip | `session_completions.{rpe, fatigue_tag}` |
| **Zone Trace** (SESSION-SCREENS-WOW-01, 2026-10-21) | `session_completions.apple_health_uuid` → `strava_activities.raw_payload->hrSamples` (that one key, never the column) for the same user; band from the session's prescribed `zone` and `user_settings.{resting_hr, max_hr}`; sentence and share from `lib/coaching/zoneTrace.ts → buildRunTrace`, with `run_analysis.hr_above_ceiling_pct` deciding when present (§12 Am.3) |
| Completion copy | `lib/coaching/completionCopy.ts → getCompletionCopy(sessionType)` — shared with the in-app card |
| Voice anchor stamp | `BRAND.voiceAnchor` |
| Brand statement (conditional) | `BRAND.brandStatement`, rendered only when `computeLedger().advancedThisWeek === true` (mirrors DOCTRINE-01's in-app conditional) |
| Wordmark | `BRAND.name`, double-letter moss via `splitOnDoubleLetter` from `lib/brand-og.ts` |
| Colours | `BRAND.og.*` + resolved hex for session/fatigue colours (CSS custom properties don't resolve in next/og) |

**PLAN-WEEK-COLLISION-01 (2026-09-18).** Every read here filters
`superseded_at IS NULL`, so it sees the LIVE plan only. `week_n` is a
WITHIN-PLAN coordinate: a new race plan restarts numbering at 1, so an
unfiltered read serves the previous plan's rows for the same `week_n`.

## Render states

| State | Trigger | Anatomy |
|---|---|---|
| **A** | `run_analysis.hr_in_zone_pct` is non-null | `TIME IN ZONE` eyebrow + big % digit + 5-segment ZoneBar (one segment filled in the prescribed zone colour) + fatigue chip + completion copy |
| **A + trace** | the run has 100+ HR samples (`TRACE_MIN_SAMPLES`), a prescribed zone and a max HR | As A, with the **Zone Trace and its sentence in place of the ZoneBar**; the % is the analysis's, else the trace's own (the trace is FREE, so a free run reaches this state too) |
| **B** | no analysis row, or `hr_in_zone_pct` is null | `EFFORT` eyebrow + `RPE / 10` digit + fatigue chip + completion copy |

Both states render the same completion copy + voice-anchor stamp. The brand-statement footer is independent of state — gated only on the ledger.

## Client integration

`lib/share/shareSessionCompleteCard.ts → shareSessionCompleteCard({ weekN, sessionDay, onStatus })`:

1. Fetch the PNG via `authedFetch`.
2. iOS native: base64 the bytes, write to `Filesystem.Cache`, call `Share.share({ files: [fileUri] })`.
3. Web: try Web Share Level 2 (`navigator.canShare({ files })`); fall back to a transient `<a download>` anchor.
4. Status callback receives `{ kind: 'fetching' | 'sharing' | 'downloaded' | 'success' | 'cancelled' | 'error' }`.

The `SaveImageButton` component in `DashboardClient.tsx` wraps the call. Rendered **outside** the `SessionCompleteCard` surface in both the SessionPopupInner reflect view and PostRunScreen so the runner's own iOS-screenshot of the card frames the card cleanly.

## Notes

- **Same vocabulary as the in-app card.** Eyebrow strings, completion copy, fatigue chip palette, zone colours all read from the same modules. If the in-app card changes, this route reflects it without code edits.
- **Strava-independent.** State A activates whenever `run_analysis` is populated — either pipeline.
- **No new dependencies.** `@capacitor/share` + `@capacitor/filesystem` already installed from SHARE-01.
- **No watermark URL.** Card carries the wordmark + voice anchor + (conditionally) brand statement; deliberately no `zonna.run` URL to keep the design product-y not advertorial.


## Plan read — PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16)

The `plans` row is read through `readPlanJson` (`lib/planRead.ts`), the one owner of that query. It uses
`.maybeSingle()`, so a runner with **no plan is `null` with no error**, not the PostgREST 406 that made up 89
of 94 Supabase warnings in a day. It already used `.maybeSingle()`; it now goes through the shared read, with **no change in behaviour**.
