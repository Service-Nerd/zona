# Benchmark entry and plausibility — two board sittings, 2026-10-16

**Items:** `BENCHMARK-INPUT-01` (Design Board) · `BENCHMARK-IMPOSSIBLE-01` (Coaching Board)
**Source:** the 2026-10-15 ops digest — a plan priced at VDOT 253.7.

## What happened
A runner typed **5:04**, their pace, as a 5K finish time. The engine computed VDOT 253.7 and
priced every pace in a London Marathon plan from it. Nothing checked a benchmark was possible,
and the field showed nothing that disagreed. A second live plan carried 182.6 (a 10K "in 14:00").

## Design Board — SHIP WITH AMENDMENT
One shared `BenchmarkFields` for the wizard and Update Paces; every value read back as the
decision (`5K in 25:20 · 5:04/km`); TT distance stays a decimal `TextField` (a Ruler cannot land
7.1 on a phone, which is the founder's own constraint). Impossible values replace the readback in
place; no modal, no confirmation. Full ruling: `docs/canonical/design-rulings.md`.

## Coaching Board — CORRECT WITH AMENDMENT
§55 Amendment 1: raw VDOT above 85 is refused (world records 85.3–85.6), and so is a future date.
One gate at generation and recalibration, plus `INV-PLAN-VDOT-PLAUSIBLE`. Update Paces now asks
when the race was run, because §42's staleness discount depends on it.

## Founder decisions
- Refusal copy: *"Bit quick for a human. Enter your finish time."* (chosen from five).
- Ruler declined: agreed.

## Not settled
- A wrong but possible benchmark (made visible, not blocked).
- A km + tenths wheel for the TT distance (Collins), pending a device.
- The two existing plans are not changed by this; contacting those runners is the founder's call.
