# Design Board — `CTA-INLINE-PAINT-02`: the policy for the 51 inline Button overrides, by species

**Date:** 2026-11-20 · **Board:** Design Board
**Trigger:** backlog item; the sitting the item routes to. Soft trigger (visible deltas on app screens when paid).
**Question:** the 51 call sites that override a Button-owned property inline sort into species. Rule
what each species should do. **Not** 51 individual rulings.
**Tier:** n/a (app chrome, every tier)

## Analysis, before any seat spoke

### Re-derived

| Item says | Re-measured 2026-11-20 |
|---|---|
| 51 call sites | **51** — the register (`components/ui/buttonInlineOverride.test.ts` `BASELINE`) sums to 51, and an independent pass with the same depth-aware reader over every `<Button>` in `app/` + `components/` (174 elements) finds 51 |
| across 23 files | **23 register entries, 21 files carrying an override** — two entries (`AppleHealthConnectionRow`, `CoachTeaser`) are held at 0 |
| zero are pure redundant restatements | **Confirmed: 0.** **19** sites carry a redundant background (`none`/`transparent` on `ghost`/`quiet`, `var(--card)` on `secondary`), and **every one of the 19 also carries geometry** |

Method: `npx tsx scripts/board-evidence-cta-inline-paint-02.ts` (read-only; copies the gate's reader
because importing a vitest file outside the runner executes it) plus a classification pass over its
per-site output. Variant read from the tag; a conditional variant (`variant={x ? 'primary' : 'secondary'}`)
is treated as filled.

### The species, measured (property frequency: padding 44 · fontSize 32 · borderRadius 23 · background 22 · minHeight 12 · height 4)

| Species | Sites | What they set |
|---|---|---|
| **A. Named off-palette paint** | **2** | `MeScreen` Strava connect, `background: var(--strava)` only (ruled a named partner-brand exception, `design-rulings.md` Connections sitting); login's Apple sign-in, `background: var(--ink)` **plus** radius 10 / 14px / `13px 16px` |
| **B. State paint inline** | **1** | `HRZonesSection` save button: `background` switches across `--teal-dim` (a System-B legacy alias) / `--accent-soft` / `--bg` by saved/valid state, plus radius 8 / 12px / `11px` |
| **C. `ghost`/`quiet` with their own geometry** | **30** | mostly text-shaped controls: padding `0` / vertical-only (`6px 0` ×6, `4px 0`, `14px 0`…), type 10–13px or `inherit`, their own tap floor (`minHeight: 32px` ×5, `TAP_TARGET_MIN_PX` ×4, `height: 44px`); a minority row-shaped (`14px 16px` ×3, `12px 14px`, `14px 18px`). 17 of the 19 redundant backgrounds live here. Includes `BackButton`'s recorded zero padding |
| **D. Filled CTA re-sized off the scale** | **18** | radius 10 / 12 / 14 / `--radius-md` on a `regular` button (whose radius is `--radius-lg`), padding 13–16px, type 12 / 13 / 15px, heights 46 / 50 / 52px: the wizard-Continue hybrid `BUTTON-INLINE-OVERRIDE-01` was written against, in 18 places |

Off-scale type inside the 51: **11px ×3, 10px ×1** (all C), **13px ×7**, **15px ×4**.

**Not measured:** any rendered geometry or tap box for these 51 at 375pt; nothing on a device.

### Settled-ground scan

- **`BUTTON-INLINE-OVERRIDE-01` (2026-09-27)** — *"Add a variant or size rather than overriding at
  the call site."* The register is debt, frozen; this sitting is how it shrinks.
- **`GHOST-AFFORDANCE-01` (2026-09-25)** — a primary action on its screen takes a surface; `ghost` is
  reserved for in-sentence / dense-row; one label, one treatment; *"a control that declares its own
  alignment keeps it"*. Governs species C.
- **`CTA-COMPACT-SCOPE-01` (2026-10-14)** — `compact` means side-by-side rows, not "small". Governs D.
- **`TAP-TARGET-DECISIONS-01`** — a shared primitive clears the 44px floor itself; `.btn--inline-target`
  is a small visual with a big hit area (`::after`, 44px). Governs C's tap floors.
- **`MICRO-LABEL-DRIFT-01` "11px is not a level"** and **`ADJUST-JOURNEY-TYPE-01`** (13px is not a role;
  11px is migration, not a ruling). Governs the 10/11/13px sites.
- **Connections sitting — `--strava` recorded as a NAMED partner-brand exception.** Governs A.
- **`BUTTON-COMPONENT-01`** — the moss active fill is the only selected affordance. Governs B.
- **`CTA-COMPACT-SCOPE-01`'s own limit line** — *"if it survives this fix too, the buttons are not the
  problem."* Recorded so this sitting is not read as a third attempt at "the CTAs look dated".
- Token layer: `.btn--regular`, `.btn--compact`, `.btn--inline-target`, `.btn--ghost`, `.btn--quiet`
  read in `app/globals.css` in the same pass. No conflict between layers.

## The sitting

**🧭 Zhuo (chair).** Four species, and only one of them is a design question nobody has answered.
A is answered (named exceptions), B and D are drift against rulings that exist, and C is the one
the system has no shape for: thirty text-shaped controls each inventing the same thing. I will rule
a policy per species and refuse to rule individual sites.

**✋ Silvanto.** D is the one that shows. Eighteen filled buttons at four radii and three type sizes,
on the screens a runner opens most (`SessionPopupInner`, the wizard, Today). That is not a set of
exceptions, it is a scale nobody is using. Convert them to the two sizes that exist. The 10 and 11px
labels are type regressions against a named rule, and I would veto a proposal to keep them; here
nobody proposes keeping them, so the policy simply migrates them.

**🎓 Sierra.** Only one thing from my seat: the Strava and Apple buttons are the runner recognising
someone else's door. They are right as they are. Do not make them ours.

**📱 Wroblewski.** C is my species. Five of them set `minHeight: 32px` with vertical padding of
6px and no `::after` on `.btn` or `.btn--ghost`: a 32px box in source (not rendered), below the floor `TAP-TARGET-DECISIONS-01` sets. The mechanism that
fixes that already exists: `.btn--inline-target` keeps a small visual and a 44px `::after`. A text
control is the same idea without the chip. If the thirty share one geometry, that is one size, with
the hit area built in, and every one of them stops re-declaring it. If they do not share one, I
want to know before anyone authors a size.

**🎪 Collins.** Two things. Thirty ghosts with hand-set geometry is `GHOST-AFFORDANCE-01`'s
*"absence dressed as restraint"* again, and some of the row-shaped ones (`14px 16px` on Me) are rows
that should probably have a surface; the build should re-read those against that ruling, not just
re-size them. And do not author more than one size for C. Two sizes plus one for text is a system;
two plus four is the habit again.

### ⚡ Recorded disagreement
Collins (re-read C's row-shaped ghosts for a surface) vs Wroblewski (size them, do not restyle them,
in this pass). **The chair split it:** the six row-shaped C sites are re-read against
`GHOST-AFFORDANCE-01` when their screen is paid; the text-shaped ones are sized only. Neither lost.

### ⛔ Veto check
Silvanto named the rule he would veto under (`MICRO-LABEL-DRIFT-01`, a proposal to keep 10/11px on
a control) and found no such proposal. **Not exercised.**

## ⚖️ Ruling — SHIP WITH AMENDMENT (policy by species)

| Species | Policy |
|---|---|
| **A. Named off-palette paint (2)** | **Stays, and leaves the debt count.** The paint is a named exception: recorded in the register **by file, property and value with its reason**, not as debt. Only the paint is exempt: the Apple button's radius / type / padding are geometry and follow D |
| **B. State paint inline (1)** | **Drift; a defect fix, no new variant.** State is expressed by switching to an existing variant (the moss fill is the only selected affordance, `BUTTON-COMPONENT-01`); the System-B alias goes with it |
| **C. Ghost/quiet with their own geometry (30)** | **The variant stays; the geometry moves into at most ONE new size for a text control**, which carries the 44px hit area the way `.btn--inline-target` does, **and only if the build measures that a majority of the 30 share its geometry**. Off-scale type (10/11/13px) migrates to the scale. Redundant backgrounds are deleted in the same edit (they move no count alone). The six row-shaped sites are re-read against `GHOST-AFFORDANCE-01` when their screen is paid. `BackButton`'s recorded zero padding is a named exception like A |
| **D. Filled CTA re-sized (18)** | **Drift; conform to `regular`, or `compact` only in a side-by-side row** (`CTA-COMPACT-SCOPE-01`). **No new size is authored from these values.** A site whose override is load-bearing must name the reason, and becomes a named exception rather than debt |

**Execution condition (binding):** paid **per screen, not as one sweep**, each screen rendered at
375pt before and after, with the register lowered in the same commit. D and C change what the
runner sees on the most-used screens; the founder has twice reported the CTAs, so a screen batch
goes to him on a device before the next batch.

### 📦 Required artifacts (the build carries them)
1. **Pattern** — `ui-patterns.md` § Button: the four species and their policy; the text-control size
   if (and only if) the measurement justifies it.
2. **Token / constant** — at most one new size class in `app/globals.css` (text control, with the
   `::after` hit area); no new variant; no literal values at call sites.
3. **Mechanical check** — `buttonInlineOverride.test.ts` gains a **named-exception list** (file +
   property + value + reason), asserted exact both ways like `OVERLIMIT_BY_FILE`, so the debt number
   counts drift only; the existing grow/shrink arms keep ratcheting. **Falsified** by adding an
   unnamed `background` override (red) and by deleting a named exception's call site (stale, red).
4. **Register row** — below.

### ↗️ Routing
None. No tier, prescription or coaching claim.

### 🚨 MUST/NEVER
No hardcoded values in components; no new palette; 44px floor kept; no em dashes in labels.

### ⚠️ What this does not settle
- **Nothing was rendered or felt.** The species are classified from source; the C size is conditional
  on a geometry measurement this sitting did not take.
- The register counts call sites, so paying one property of a multi-property site moves nothing;
  the count is a lagging measure of this policy, not a progress bar.
- **Nothing schedules the work.** This rules what each species should do, not when.
