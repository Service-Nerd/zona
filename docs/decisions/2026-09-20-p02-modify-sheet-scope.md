# P-02 — Modify-plan sheet: board ruling and design scope

**Date:** 2026-09-20 · **Status:** scoped, not built.
P-02's own filing says **"Coaching Board required before scoping, not merely before approval."**
This is that scoping. The build is the next unit of work and is deliberately not started here.

---

## 1. Coaching Board — the intensity question

**Question:** may a runner set the intensity distribution directly (80/20 → 90/10) as a primary
control in the sheet?

**Conflict scan.** Touches **§1** (`INTENSITY_DISTRIBUTION`, measured in **sessions, plan-wide**,
CD-19), **§110** (`hard_session_relationship: 'avoid'` is a **floor**, not an off switch), **§79**
(`user_declared_level` raises intensity only, never tonnage), **§8** (quality sessions per week).

- **Seiler.** 80/20 is a session-count observation. At four running days, 80/20 and 90/10 are 0.8
  and 0.4 quality sessions: **the control does not quantise.** It is illusory at the volumes most
  of this product's runners train at and consequential only at the top, which is the worst
  possible distribution of a lever's effect.
- **Willy.** Asymmetric. Dialling intensity *down* is safe; dialling it *up* is the injury vector,
  and self-selects for the runner least likely to stop.
- **McMillan.** The runners who go looking for this control are the ones who should not have it.
- **Hutchinson (chair).** It inverts the product's own thesis. Zonna exists because runners blur
  their zones; a ratio dial hands back the judgement we removed.

**⚖️ RULING — INCORRECT for a raw ratio. This is a veto.**

**CORRECT, and the constructive half:** the runner's legitimate preference already has a governed
expression. **`hard_session_relationship`** (`avoid | neutral | love | overdo`) is already a
`GeneratorInput` field, already ruled under §110, and shapes intensity **through** the
constitution rather than around it. The sheet may expose that. **No new numeric, no new
authority, no new invariant.**

---

## 2. What the sheet may edit

All already on `GeneratorInput`. **No new plan fields.**

| Group | Rows |
|---|---|
| **Your week** | `days_available` · `days_cannot_train` · `preferred_long_run_day` · `max_weekday_mins` |
| **Your body** | `injury_history` · `hard_session_relationship` · `terrain` |
| **The race** | `race_date` |
| **Careful now** | Start a new plan (destructive; existing MeScreen treatment, not a second pattern) |

**Grouping is by CONSEQUENCE, not by data type** — that is the teardown's actual idea. "Your week"
changes how the week is shaped; "Your body" changes what is prescribed into it; "The race" moves
everything. Headings use `SectionLabel` (pattern 17), which already carries this exact job on
MeScreen, rather than inventing a quieter variant for one screen.

---

## 3. Design decisions

**Nav — ours must differ from the competitor's, and the rule is already written.** They put
*Cancel* top-right. `ux-principles.md`: *"Slide-up sheets: mirrored nav bar at bottom, not top."*
The sheet arrives through `components/shared/Sheet.tsx` (SHEET-PRESENT-01), which already owns the
portal, `Z_LAYERS.sheet`, the measured nav inset, animation, backdrop, Escape, scroll lock, focus
trap and the drag pill. **Nothing here re-invents a bottom sheet.**

Two bottom-bar states:

- **Nothing changed** — a single full-width `Close`. No disabled Apply sitting there implying the
  runner has failed to do something.
- **N changes pending** — `Apply N changes` (moss, full width) with `Discard` beneath as the muted
  secondary. Never a disabled primary as the resting state.

**A pending edit reads in MOSS, and the value moves from `--mute` to `--ink`.** Not amber: amber is
coaching-warning voice and an unapplied edit is not a warning. Not `--danger`. A small moss dot on
the row plus the value darkening is enough; the count in the bottom bar carries the total, so the
row does not need a badge.

**Per-row Pro lock.** Extend the wizard's existing treatment (`CardSelect` `locked` +
`lockLabel="PAID"`) rather than invent a settings-row variant: one lock language across the
product. The row stays visible and readable — gate richness, never access — and tapping it opens
the paywall, exactly as the distance tile does.

---

## 4. Hard constraints carried into the build

1. **Apply must go through `savePlanForUser`.** Never write `plan_json` directly: nine routes once
   bypassed it and persisted unvalidated plans (SAVE-VALIDATE-01).
2. **`PLAN-WEEK-COLLISION-01` is this feature's failure mode, and it is already handled.**
   `supersedeWeekKeyedRows` is gated on `isRaceIdentityChange` (`race_name|race_date`). So editing
   days / cap / long-run day / injuries / terrain **preserves** completions (same race, the
   runner's history carries), and editing the **race date** supersedes them (a different block).
   ⚠️ **That behaviour is inherited, not re-implemented** — and a test must assert both directions,
   because this is the exact operation that put a 94%-pre-completed plan in front of a real runner.
3. **Reuse `AdjustmentDiff`.** It already does diff-before-apply with two live call sites. The
   brief's "always show the diff" is half-built, not unbuilt.
4. **Reuse ADR-012's thresholds** (day-of-week moves, session-type swaps, >15% trims, >15% week
   volume) — do not restate them. ⚠️ And exercise the magnitude path on a **duration-anchored**
   (beginner) plan: SESSION-KM-01/02 records that the >15% threshold was unreachable for beginners
   because their sessions carry `duration_mins` and no `distance_km`.
5. **Batch in component state; no migration in v1.** The filing proposes a persisted
   not-yet-applied edit set. That is an enhancement (surviving app close), not the value, and it
   would be a **third** migration awaiting a production apply. v1 batches in memory and applies in
   one go, which satisfies "nothing regenerates until Apply".
6. **`verify:parity` must prove an untouched plan is byte-identical.**

---

## 5. Copy

The **pattern** was approved by the SLT today (`2026-09-20-copy-patterns.md` §3): *second person
implied, present tense, states the blast radius, no benefit claim.* The ruling is explicit —
"approve the pattern and the rows follow" — so the subtitles are written inside it, not escalated.

⚠️ **Hard rule 7 applies to every one.** A subtitle describing a consequence the engine does not
produce is a claim. *"Shift the whole plan forward or back"* must be what actually happens, and
each subtitle is checked against the engine before it ships.
