# API Contract — /api/og/weekly-zone-card

**Method:** GET
**Auth:** Supabase session cookie (`getUserFromRequest`). Returns 401 otherwise.
**Tier:** Paid/trial only. Free users get 403 — the Coach tab renders an upsell card instead of calling this route.
**Runtime:** `nodejs` (not `edge`). The tenure caption reads `created_at` from the user `getUser()` returns. ⚠️ Until 2026-10-31 it called the auth admin API on a USER-scoped client (SEC-08), was refused, and the caption was always empty (`SHARE-WEEK-CARD-SOURCE-01`).

## Query params

| Param | Required | Meaning |
|---|---|---|
| `week_n` | no | Specific week to render. Defaults to the most recent generated weekly_report. |

## Response

- **200 — `image/png`**, 1080 × 1920 (Instagram story aspect). Rendered via `next/og` `ImageResponse`.
- **401** — no authenticated user.
- **403** — `getUserTier()` returned `free`.
- **404** — no generated live `weekly_reports` row, or no `run_analysis` row for that `week_n` carries `hr_in_zone_pct`. The Coach tab gates the Share button on `zone_discipline_score != null`.
- 🔴 **The week is selected on `run_analysis.week_n`.** `session_day` is the bare day (`tue`); until 2026-10-31 this route matched `session_day LIKE 'week_N_%'`, a format no row has ever had, and 404'd for every runner (`SHARE-WEEK-CARD-SOURCE-01`, gated by `lib/coaching/sessionDayShape.test.ts`).

## Source data

| Field | Source |
|---|---|
| Score | `weekly_reports.zone_discipline_score` (0–100) |
| Verdict line | Derived in-route from `dominant_flag` + score via `weeklyVerdictLine()`. Distinct from per-session `getVerdictVoice()`. |
| Wordmark | `BRAND.name` — moss-coloured double letter via `splitOnDoubleLetter()` (same vocabulary as the social OG route). |
| Voice anchor | `BRAND.voiceAnchor` (`"Hold the zone."`) |
| Tenure caption | `auth.users.created_at`, formatted `"Holding the zone since Mmm YYYY"`. **Suppressed entirely when the account was created in the current calendar month.** Hardcoded `MONTH_ABBREV` table (three-letter month) — no Intl locale dependency in the edge/og rendering. |
| Colours | `BRAND.og.*` — Warm Slate hex (no CSS custom props in the og runtime). |

**PLAN-WEEK-COLLISION-01 (2026-09-18).** Every read here filters
`superseded_at IS NULL`, so it sees the LIVE plan only. `week_n` is a
WITHIN-PLAN coordinate: a new race plan restarts numbering at 1, so an
unfiltered read serves the previous plan's rows for the same `week_n`.

## Tenure caption rules (canonical — never violate)

- Format: `"Holding the zone since Mmm YYYY"`. Three-letter month, four-digit year. No day, no time, no emoji.
- **Never** use the words `member`, `subscriber`, `anniversary`, `milestone` anywhere in the codebase as a result of this work. Verified by grep before merge.
- Tenure caption appears **only on the shareable card** — never in the app, never on Me, never on the founder note.
- Accounts created in the current calendar month → caption suppressed entirely. Generating "Holding the zone since May 2026" *in* May 2026 reads as hollow.

## Client share flow (`lib/share/shareWeeklyZoneCard.ts`)

1. Fetch the PNG via `authedFetch`.
2. iOS native (Capacitor):
   - Write base64 bytes to `Filesystem.Cache` with a timestamped filename.
   - Call `Share.share({ files: [fileUri], title, text })` — the iOS system sheet handles previewing.
   - User-cancellation surfaces as a thrown `cancel` error — treated as a soft outcome, no error toast.
3. Web (browser):
   - If `navigator.canShare({ files })` is true, use Web Share Level 2 with a `File` payload.
   - Else download the PNG via a transient `<a download>` anchor — the user attaches it to whatever client they want.

## Notes

- **Strava-independent.** `zone_discipline_score` is written by the rule engine from any analysis source — Strava or HealthKit. Day-one launches have HealthKit-only data; the card generates fine.
- **Cron-independent.** Pull-on-share — no scheduling. The weekly report itself is generated separately by the existing Sunday cron.
- **Per-week URL.** `?week_n=<n>` is supported for parity with future history surfaces (carousel etc., explicitly out of scope at v1).
- **Out of scope at v1:** 1200×630 social aspect, carousel of multiple weeks, custom themes, auto-share on Sunday.
