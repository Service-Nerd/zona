# API Contract — /api/og/session-complete-card

**Method:** GET
**Auth:** Supabase session cookie (`getUserFromRequest`). Returns 401 otherwise.
**Tier:** All tiers (the card itself is FREE structure / PAID detail — paid users render State A with zone bar, free users render State B with RPE only).
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
| Session type, chip label, ZoneBar zone | `plans.plan_json` → week `n` → `sessions[session_day].type` |
| Date stamp | `session_completions.updated_at` |
| Zone % (State A) | `run_analysis.hr_in_zone_pct` for the same slot; rounded to integer |
| RPE / fatigue chip | `session_completions.{rpe, fatigue_tag}` |
| Completion copy | `lib/coaching/completionCopy.ts → getCompletionCopy(sessionType)` — shared with the in-app card |
| Voice anchor stamp | `BRAND.voiceAnchor` |
| Brand statement (conditional) | `BRAND.brandStatement`, rendered only when `computeLedger().advancedThisWeek === true` (mirrors DOCTRINE-01's in-app conditional) |
| Wordmark | `BRAND.name`, double-letter moss via `splitOnDoubleLetter` from `lib/brand-og.ts` |
| Colours | `BRAND.og.*` + resolved hex for session/fatigue colours (CSS custom properties don't resolve in next/og) |

## Render states

| State | Trigger | Anatomy |
|---|---|---|
| **A** | `run_analysis.hr_in_zone_pct` is non-null | `TIME IN ZONE` eyebrow + big % digit + 5-segment ZoneBar (one segment filled in the prescribed zone colour) + fatigue chip + completion copy |
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
