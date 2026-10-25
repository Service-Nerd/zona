# API Contract — /api/ops/boot-report

**Method:** POST
**Auth:** **Optional, on purpose.** A valid bearer attributes the row; without one it is anonymous. One of the stalls
this route records IS auth not resolving, so requiring a session would blind it to the failure it exists for.
**Rate limit:** `checkRateLimit('ops:boot:<ip>', 10, 3600)` (fails open, like every caller of it).
**Item:** BOOT-HANG-01 (2026-10-25).

## Request body

```json
{ "gate": "auth" | "settings" | "run_analysis" | "strava" | "error", "elapsed_ms": 12000, "native": true }
```

`gate` must be one of `BOOT_STALL_GATES` (`lib/ui/bootWatchdog.ts`). No free text is accepted, so an
unauthenticated caller can write nothing but a bounded number of `boot_stalled` rows.

## Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true }` | recorded `boot_stalled` with `{ gate, elapsed_ms, native }` |
| 400 | `{ error: 'Unknown gate' }` | gate missing or not in the list; nothing written |
| 429 | `{ ok: false }` | rate limit hit; nothing written |

## Caller

`lib/ops/reportBootStall.ts`, from `DashboardClient`'s boot watchdog (after `BOOT_STALL_MS`, gate = the first still
holding, from `stalledGate`) and from `fetchSettings()`'s catch (gate `error`, only before the app has opened). Plain
`fetch` with `keepalive`, never `authedFetch`, which would wait on the session being reported. The bearer is the access
token already received from `onAuthStateChange`, when there was one.

Tests: `lib/ui/bootWatchdog.test.ts` § POST /api/ops/boot-report.
