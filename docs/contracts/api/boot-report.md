# API Contract — /api/ops/boot-report

**Method:** POST
**Auth:** **Optional, on purpose.** A valid bearer attributes the row; without one it is anonymous. One of the stalls
this route records IS auth not resolving, so requiring a session would blind it to the failure it exists for.
**Rate limit:** `checkRateLimit('ops:boot:<ip>', 10, 3600)` (fails open, like every caller of it).
**Item:** BOOT-HANG-01 (2026-10-25), extended by BOOT-STALL-DIAGNOSE-01 and BOOT-STALL-HIDDEN-ABSENT-01 (both 2026-11-04).

## Request body

```json
{
  "gate": "auth" | "settings" | "run_analysis" | "strava" | "error",
  "elapsed_ms": 8431,
  "native": true,
  "hidden": false,
  "err_kind": "timeout" | "network" | "denied" | "unknown",
  "stage": "auth" | "settings" | "plan" | "readiness" | "analysis" | "taper"
}
```

| Field | |
|---|---|
| `gate` | one of `BOOT_STALL_GATES`. ⚠️ **The first 125 rows were 105 `settings` / 16 `error` / 4 `auth` / 0 `run_analysis` / 0 `strava`** (`BOOT_GATE_DISTRIBUTION_2026_11_04`). An earlier draft called those zeroes "structurally unreachable"; that was wrong, and `run_analysis` was reachable via a `PlanReadError` defect. **A zero is an observation, not a proof** |
| `elapsed_ms` | **a measurement.** It was handed the constant `BOOT_STALL_MS` until 2026-11-04, so 109 of the first 125 rows read exactly `12000`. Clamped to `BOOT_ELAPSED_MAX_MS`; nonsense becomes `null`, never `0` |
| `native` | `Capacitor.isNativePlatform()`. **`null` when the body did not say** — see below |
| `hidden` | the document went hidden at ANY point during the boot. **The discriminator between a backgrounded iOS launch and a genuine hang** — without it the two are the same row. **`null` when the body did not say** — see below |
| `err_kind` | `gate: 'error'` only. Why it threw, classified client-side by `bootErrKind` |
| `stage` | which of the six boot awaits was **in flight**, read from `bootStageRef` at report time. `gate` cannot say: it names the state still held, and `appReady` is set once at the very end of a boot containing six sequential awaits |

🔴 **`native` AND `hidden` ARE THREE-STATE, AND THE THIRD STATE IS THE POINT** (`BOOT-STALL-HIDDEN-ABSENT-01`,
2026-11-04). Both were written as `body.x === true`, which answers *"did the client say true?"* and then stores
the answer as though it were *"the client said false"* — so a body that never mentioned the field produced the
same row as one that measured `false`. Found hours after `BOOT-STALL-DIAGNOSE-01` shipped: of the three
post-deploy rows, two carried `hidden: true` **and** a `stage` (backgrounded launches, which is what the flag
was added to prove), and the third carried `hidden: false` and **no `stage`** — the exact shape of a client
still running the pre-fix bundle. **The one row that might have been a real hang was unreadable.** Now:

| In the row | `hidden` | `native` |
|---|---|---|
| **no key at all** | the pre-2026-11-04 route, which had no such field | **cannot happen** — written on every row since 2026-10-25 (`a05441ec`) |
| **`null`** | this route, and the reporter sent nothing or sent a non-boolean | same |
| **`true` / `false`** | a fact the client measured | same |

**Measured over all 130 rows on 2026-11-04, before the fix:** `native` is **`true` on 130 of 130**, so its
fabricated `false` has **never once been written** — the defect was latent there for its whole life, and is
fixed because it is the same expression, not because it had bitten (`FIX THE PAIR, NOT THE INSTANCE`). `hidden`
is **126 key-absent, 3 `true`, 1 `false`** — and **that single `false` is the row the defect made unreadable**:
it carries no `stage` either, which is exactly the shape of a client still serving the pre-fix bundle. Read a
`hidden: false` written between the deploy of `04bbb30f` and this fix as **unknown**; after it, a `null` says so
in the row itself and needs no date arithmetic.

⚠️ **`null`, not a dropped key**, because a dropped key is indistinguishable from an old-route row — omitting it
moves the ambiguity one layer out instead of removing it. This is the convention `elapsed_ms` already uses in the
same function (*"nonsense becomes `null`, never `0`"*), and the same defect class: **a fabricated value standing
in for a measurement nobody took.** `err_kind` and `stage` keep their drop-when-invalid shape deliberately —
absence there means **not applicable** (no error, no stage set), where absence here means the reporter did not
answer a question it is always asked.

🔴 **EVERY FIELD IS AN ENUM OR A BOOLEAN OR A CLAMPED NUMBER. No free text is accepted, from anyone.** Auth here
is optional by design, so an anonymous caller must not be able to write arbitrary strings into `ops_events` —
which is why `gate: 'error'` carries `err_kind` + `stage` rather than the obvious `err.message`. An unrecognised
`err_kind` or `stage` is **dropped, not stored**.

## Responses

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true }` | recorded `boot_stalled` with `{ gate, elapsed_ms, native, hidden }` — `native`/`hidden` **always present, `null` when the body did not say** (+ `err_kind`, `stage` when valid, dropped when not) |
| 400 | `{ error: 'Unknown gate' }` | gate missing or not in the list; nothing written |
| 429 | `{ ok: false }` | rate limit hit; nothing written |

## Caller

`lib/ops/reportBootStall.ts` takes a `BootStallReport`, from `DashboardClient`'s boot watchdog (after
`BOOT_STALL_MS`, gate = the first still holding, from `stalledGate`) and from `fetchSettings()`'s catch (gate
`error`, only before the app has opened). Plain `fetch` with `keepalive`, never `authedFetch`, which would wait on
the session being reported. The bearer is the access token already received from `onAuthStateChange`, when there
was one.

## The six bounded awaits

Everything between boot start and the main `setAppReady(true)` runs with the launch screen up, so every one of
these reported as `gate: 'settings'` before `stage` existed. Each is bounded by `withTimeout` at `BOOT_QUERY_TIMEOUT_MS` (`BOOT_STALL_MS * 5`), **plus the response-body
read for the two that return JSON** — `fetch` resolves on headers, so an unbounded `.json()` hangs the boot
exactly as the request does:

`auth` (`supabase.auth.getUser`) · `settings` (a seven-query `Promise.all`) · `plan` (`fetchPlanForUser`, which for
a legacy runner fetches a GitHub Gist) · `readiness` (`/api/pre-session-readiness`) · `analysis` (a second
seven-query `Promise.all`) · `taper` (`/api/recalibrate-taper`).

🔴 **THE BOUND IS A LEAK GUARD, NOT AN ATTRIBUTION MECHANISM, AND TWO EARLIER VALUES WERE WRONG.**
`BOOT_STALL_MS - 2_000` (so an attributable row beats the watchdog) and then `BOOT_STALL_MS` ("can only fire on a
boot already lost") **both destroy BOOT-HANG-01's self-heal**: the watchdog shows Try again at 12s but does not
abandon the boot, and `if (!bootReady)` stops guarding the stall screen the moment the boot finishes — so a
launch settling at 16s replaces Try again with the dashboard by itself. A bound at or below 12s rejects that
boot instead, never sets `appReady`, and strands a runner who would have been fine. The bound therefore sits far
beyond any boot a runner is still waiting for; its only job is to stop a genuinely dead promise holding on
forever. **Nobody has ever measured a real boot** — `elapsed_ms` was a constant — so lower it only from data.

⚠️ **The bound is PER-AWAIT; the watchdog is ABSOLUTE from mount.** Six awaits bounded at 12s each do not add up
to a 12s boot, so for any stage after the first the watchdog fires first by construction. Attribution therefore
comes from `bootStageRef`, which the watchdog reads — **not** from the bound winning a race it cannot win.

⚠️ A bound does not CANCEL the request; it stops the boot waiting on it. See `lib/async/withTimeout.ts`.

⚠️ **`readiness`, `analysis` and `taper` sit inside local `catch {}` blocks**, so a timeout there is swallowed and
the boot CONTINUES — the runner gets the app with that piece missing, which is the better outcome, and no row is
written because there was no stall.

⚠️ **`err_kind: 'timeout'` is not expected in practice.** The watchdog reports at 12s and both reporters latch, so
a bound firing at 60s is always second. `err_kind` earns its place on the FAST failures (`denied`, `network`),
which is what the 16 production `error` rows actually were.

## One row per boot failure

Both reporters (the watchdog and the boot's catch) latch on `bootReportedRef`; first one wins. ⚠️ **Before
2026-11-04 they did not**: measured over the first 125 rows, **10 of the 16 `error` rows had a `settings` row
from the same runner within 3 seconds** — the same failure counted twice, and two of a 10/hour per-IP budget
spent on one event. Treat `settings` counts from that period as inflated by roughly that much.

Tests: `lib/ui/bootWatchdog.test.ts` (54) and `lib/async/withTimeout.test.ts` (11). Seventeen mutations falsified —
thirteen for `BOOT-STALL-DIAGNOSE-01`, and four for `BOOT-STALL-HIDDEN-ABSENT-01`, named so the figure is
checkable rather than asserted: `hidden` back to `body.hidden === true` (**4 red**), `native` back to
`body.native === true` (**2 red**), `boolOrNull` returning `undefined` so the key is dropped instead of null
(**5 red**), and `boolOrNull` as `Boolean(v)` so junk coerces instead of nulling (**5 red**).
