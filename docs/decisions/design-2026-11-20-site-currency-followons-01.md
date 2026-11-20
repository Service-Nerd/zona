# Design Board — `SITE-CURRENCY-FOLLOWONS-01`: readiness check (no sitting)

**Date:** 2026-11-20 · **Outcome:** ⏸️ **NOT READY — nothing of its own to rule.** No sitting was held.

`SITE-CURRENCY-FOLLOWONS-01` is an umbrella: the remainder of `SITE-CURRENCY-REVIEW-01`
(`docs/decisions/site-currency-review-2026-11-05.md`, register row 2026-11-05). It carries no question
of its own; every follow-on has its own id. Re-derived from `docs/releases/backlog.md` lines 74–846
(the section, read in full) on 2026-11-20:

## The review's 8 findings

| # | Finding | State today |
|---|---|---|
| 1 | `SITE-MEASURE-THIRD-02` | ✅ shipped 2026-11-05 |
| 2 | `SITE-SPACE-GATE-02` | ✅ shipped 2026-11-05 |
| 3 | `SITE-TYPESCALE-POP-01` | ✅ shipped 2026-11-05 (inside `SITE-SPACE-GATE-02`'s commit) |
| 4 | three of eight screens shown | INSUFFICIENT EVIDENCE at the sitting; **subsumed by 5 and 6**, both shipped |
| 5 | `SITE-EFFORT-RECORD-01` | ✅ shipped 2026-11-05 (founder overrule) |
| 6 | `SITE-SESSION-STEPS-01` | ✅ shipped 2026-11-05, re-sat on rendered evidence |
| 7 | `PRICING-FREE-GATE-02` | ✅ shipped 2026-11-05 |
| 8 | `NO-RUNNER-TURNED-AWAY` on the site → `SITE-STAGED-PLAN-01` | ✅ shipped 2026-11-06 |

## Design-board follow-ons still open in the section

| Follow-on | State | Sat here? |
|---|---|---|
| `SITE-FREE-COLUMN-COPY-01` | open, ready | **Sat 2026-11-20 under its own id** (`design-2026-11-20-site-free-column-copy-01.md`) |
| `SITE-SUBMEASURE-SPRAWL-01` | open, ready | **Sat 2026-11-20 under its own id** (`design-2026-11-20-site-submeasure-sprawl-01.md`) |
| `SITE-SPACE-OVERLIMIT-01` | open, 🧭, its own id (19 instances across 7 files, re-measured 2026-11-08) | **No** — a separate filed item, not in this sitting's assignment; one item, one sitting |
| `TrendCard` on the site | 🧭 **blocked**, two named blockers | **No** — needs a **client-bundle number** for a page with `TrendCard` mounted (it is `'use client'` with 8 hooks; `clientBundleBoundary.test.ts`), which requires building it, and Sierra's transfer objection is unresolved |
| Effort-record placement (Collins) | ⚠️ recurring | **No** — blocked on `SITE-SCROLL-DEPTH-01`: no site analytics exist |

Shipped-and-closed in the same section, for completeness: `SITE-ENGINE-EMDASH-01`,
`SITE-BAND-RHYTHM-01` (2026-11-16), `SITE-FRAME-TAXONOMY-01` (DON'T SHIP, withdrawn 2026-11-16). The
section's 🏃 Coaching Board items are not website-review follow-ons and are outside this board.

## Why NOT READY

Nothing remains that is (a) owned by this umbrella rather than a separately-filed id and (b) rulable
today. The two blocked follow-ons each name a missing artefact that cannot be produced without
building code (a bundle number) or without data that does not exist (site analytics).

**Missing, precisely:** a client-bundle measurement of a marketing page with `TrendCard` mounted;
any site analytics for placement. Once `SITE-FREE-COLUMN-COPY-01` and `SITE-SUBMEASURE-SPRAWL-01`
carry their rulings, the umbrella holds only `SITE-SPACE-OVERLIMIT-01` (its own id) and the two
blocked follow-ons.

## What this does not prove
That the section is complete beyond its own bullets: items filed elsewhere that reference the
2026-11-05 review were not searched for.
