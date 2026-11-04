# Incident — the boot telemetry fixed that morning fabricated a `false` that afternoon

**Date found:** 2026-11-04 · **Live since:** 2026-11-04 (hours; `04bbb30f`, same day) · **Triage:** Systemic
**Fix commit:** `1c83ffb7` · **Catalogue class:** NEW — **ABSENCE WRITTEN AS A VALUE**

---

## Symptom

Reading the first rows produced by that morning's own ship (`BOOT-STALL-DIAGNOSE-01`, which added `hidden` and
`stage` so a stalled boot could be told apart from a suspended webview), **three `boot_stalled` rows had arrived
after the deploy**:

| row | `hidden` | `stage` | reads as |
|---|---|---|---|
| 1 | `true` | set | honest — webview backgrounded |
| 2 | `true` | set | honest — **suspended 36 minutes** |
| 3 | `false` | **absent** | *either* a genuine not-hidden hang *or* a client still serving the pre-fix bundle |

Row 3 was the only candidate hang in the data, and it was the one row the new field could not speak about.

## What was actually wrong

`app/api/ops/boot-report/route.ts` — two fields written as `body.native === true` and `body.hidden === true`.

`x === true` is **not a boolean coercion**. It asks *“did the caller say true?”* and then stores the answer as
though the question had been *“what did the caller say?”* So `undefined` and a measured `false` collapse to the
same byte, and **absence is laundered into a fact.** A pre-fix client sends no `hidden` at all; the route wrote
`false` for it.

The convention was already in the file, one line above: `elapsed_ms` coerces nonsense to `null`, never `0`.

## Why it survived

- **It was invisible by construction.** The column was populated on every row. There is no missing value to
  notice, no error, no log — a fabricated `false` is indistinguishable from a measured one by definition, which
  is the whole defect.
- **It was live for about four hours**, so almost nothing could have caught it in time. What would have caught it
  is not a check but a *naming*: the morning's commit called its own defect class **“a hardcoded constant”**
  (`elapsed_ms` had been handed `BOOT_STALL_MS`). Named that way, `=== true` three lines below does not match.
  Named at the level that generalises — **a value where a measurement should be** — it matches immediately.
  **`false` is a value.**
- **A test passed that encoded the defect.** `lib/ui/bootWatchdog.test.ts` had an arm that posted no `hidden` and
  asserted `hidden: false`. It was green, and it was asserting the bug.

## Blast radius

| dimension | finding |
|---|---|
| Other producers | **`native` carried the identical expression** and measured `true` on **130 of 130** rows — the fabricated `false` had never once been written. Fixed anyway: same expression, not same luck |
| Sibling fields | `err_kind` and `stage` keep drop-when-invalid **deliberately** — absence there means *not applicable*, not *unanswered*. Different meaning, different shape |
| Stored rows | 130 rows: `hidden` 126 absent / 3 true / 1 false. The 126 are honest (older route, key absent); the 1 is the ambiguous one |
| Readers | `lib/ops/recordOpsEvent.ts` is the file a developer reads before writing SQL against this table, and said nothing about the three states — so `detail->>'hidden' = 'false'` would have miscounted. Reconciled in the same commit |
| Contracts | `docs/contracts/api/boot-report.md`, `docs/contracts/api/ops-events.md` — three-state tables per field |
| Docs | 🔴 **The same disease reached the documentation, where no test goes.** A guessed cutoff of “~12:50 UTC” was written into a contract so a human could separate the ambiguous rows — **a clock time standing in for a measurement, inside the ship whose entire subject is that.** Caught by code review, not by me. The discriminator is the value, not a date. Review also found `native` documented as symmetric with `hidden` without checking; it is not (present on every row since `a05441ec`) |
| Engine / prescription | none — no file under `lib/plan/` changed |
| External | the daily ops digest is a cloud routine outside this repo; `hidden: null` is new to it (see Follow-ups) |

## Fix

One owner, `boolOrNull`, for both fields:

```ts
const boolOrNull = (v: unknown) => typeof v === 'boolean' ? v : null
```

**`null` rather than dropping the key**, deliberately: a dropped key is exactly what the *previous* version wrote,
so omitting it moves the ambiguity one layer out instead of removing it. Three readable states, all distinguishable
in SQL: **key absent** = the pre-2026-11-04 route · **`null`** = this route, client sent nothing · **`true`/`false`**
= a fact.

## Regression defence

`lib/ui/bootWatchdog.test.ts` — **47 → 54 arms.** The arm that encoded the defect was corrected, and a new block
`BOOT-STALL-HIDDEN-ABSENT-01 — absence is null, never a fabricated boolean` adds seven, including:

- the **discrimination** arm: a client that sends `false` and a client that sends nothing must not produce the same row
- non-boolean junk (`'yes'`, `0`, `{}`) → `null`, not `false`
- `toHaveProperty('hidden')`, so the key is **present and null** rather than quietly dropped

## Catalogue

- [x] **NEW class — ABSENCE WRITTEN AS A VALUE.** Row added to the `zona-debug` catalogue in the same commit as
      this write-up, per that skill's own rule.

## Follow-ups

- **The daily ops digest** (`project_daily_digest_routine.md`) is a cloud routine, not repo code, so nothing here
  can update it. `hidden: null` is a new state to it and a predicate of the form `detail->>'hidden' = 'false'` now
  misses the nulls. 🔴 **Founder's to change** — flagged, not chased.
- Nothing else deliberately left.
