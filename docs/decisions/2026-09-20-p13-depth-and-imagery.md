# Decision note — P-13: visual depth, illustration and imagery

**Date:** 2026-09-20 · **Owner:** Russ · **Status:** PROPOSED, awaiting sign-off
**Gate:** §4A — design system. **Depends on:** P-01. **Feeds:** P-06, P-11.

---

## First, a correction to the brief

The brief's framing is *"this is the item that stops Zonna looking like flat cards on beige."*
**Half of that premise is already wrong**, and the audit should correct it before you decide.

**Elevation tokens exist, are already warm-tinted, and are already close to what the brief
proposes.** `globals.css:74–75`:

```
--shadow-card:   0 1px 2px rgba(26,26,26,.04), 0 10px 28px -10px rgba(26,26,26,.10);
--shadow-lifted: 0 1px 2px rgba(26,26,26,.05), 0 18px 42px -14px rgba(26,26,26,.16);
```

The brief suggests *roughly* `0 1px 2px rgba(26,26,26,0.04), 0 4px 12px rgba(26,26,26,0.05)`. Ours
is the same first layer and a longer, softer second. Both are tinted on `26,26,26` — the warm ink —
not a neutral grey-blue, which is the mistake the brief warns about and which we already avoided.
Radii exist too: `--radius-sm|md|lg|xl` at 10/14/18/22px.

**So: do not design a new elevation system. Confirm the one we have and use it.**

## What is actually proposed

Three parts, and they are separable.

### (a) Sweep the hardcoded values onto the tokens

**26 hardcoded `rgba()` values and 3 hex values are live** in `app/` and `components/`, several of
them the palette at alpha — `rgba(107,142,107,…)` is `--moss`, `rgba(61,38,0,…)` is `--coach-ink`.
Examples: `AdjustmentDiff.tsx:52,89` · `PendingAdjustmentBanner.tsx:142` ·
`RaceTimesCard.tsx:147,277,392` · `DashboardClient.tsx` at eight sites ·
`CoachByline.tsx:57,76` (`#5A7C5A`, `#9A6F2A`, `#FFFFFF`).

### (b) Close the enforcement gap — the part that makes (a) stick

⚠️ **`.githooks/pre-commit` checks hex only.** Four style checks: hardcoded hex, banned fonts,
`setProperty`, four specifically banned values. **No rgba rule. No shadow rule. No radius rule.**
And `.github/workflows/verify.yml` says in its own header that it covers correctness and leaves
style to the hook.

**That is why 26 hardcoded colours are live: nothing has ever looked.** You named palette regression
as the single biggest source of wasted development time on this project; the guard has a hole
exactly where the leak is.

⚠️ There is also a **stale, unused hook** at `.git/hooks/pre-commit` that differs from the versioned
one and does not run (`core.hooksPath=.githooks`). It will mislead the next person who reads it.
Delete it.

### (c) Commission a line-art illustration style

**This is the genuine gap.** Their ceremony carries line art — stick figures running a rising and
falling curve, *which is the volume curve* (`IMG_7180`). Ours carries a skeleton: functional, cold.
Our Coach empty states are text-only. **There is no illustration style in the product at all.**

Used in at least two places so it is a system and not a one-off: the generating ceremony (P-06) and
the Coach empty states.

## What it changes

(a) and (b) change nothing visible — they make the current look enforceable.
(c) adds an asset class and a commissioning relationship. **No engine impact in any part.**

## Alternatives considered and rejected

- **Skip (b), just do the sweep.** Rejected on this repo's own record: a rule that holds only while
  someone remembers is not a rule, and we have re-learned that with decorative config, the eslint
  rule that was installed but never configured, and the `cap sync` plugin wipe. **Sweeping without
  the gate means doing it again in six months.**
- **Buy an illustration pack.** Cheaper, and it would look like everyone else's — the same mistake
  as the palette. The value in theirs is that the drawing *is the volume curve*; a stock pack cannot
  know that.
- **Photography instead of illustration for empty states.** Photography carries the model-release
  problem (§6) into twelve more surfaces. Illustration does not. Keep photography to the launch
  screen, where §6's non-identifiable rule already answers it.
- **New shadow tokens.** Rejected above — ours are good and already warm.

## What it costs to reverse

- **(a) Sweep:** trivially reversible and nobody would. Tokens to values is a worse state.
- **(b) Hook:** one file. If it proves noisy, loosen or delete. ⚠️ The real risk is a **noisy** rule,
  not a strict one — this repo has recorded twice that a guard which fires on ordinary work gets
  switched off, which is the same as having no guard. The rgba rule must not fire on legitimate
  scrims and overlays; it needs an escape with a stated reason, not a blanket ban.
- **(c) Illustration:** the expensive one to reverse, because it is commissioned work and a style
  commitment. Once two surfaces carry it, a third that does not looks broken. **Commission one
  piece, use it in one place, and look at it before commissioning the set.**

## If approved, what must ship with it

1. Every one of the 26 rgba and 3 hex instances resolves to a token, **or** carries a stated reason.
2. **The hook is proven to go RED on a new hardcoded rgba, shadow and radius before it is trusted
   green.** Non-negotiable — this repo has shipped a green tick with nothing behind it more than
   once.
3. The stale `.git/hooks/pre-commit` is removed.
4. The illustration style is documented in `ui-patterns.md` and used in two places.

## Recommendation

**Split the approval.**

**(a) and (b) need no design taste and should proceed on their own** — they are enforcement, they
close GAP-08 and GAP-09, and they protect everything else on the roadmap. I would treat them as
ordinary engineering rather than a gated design decision.

**(c) is the gated part** and should wait for P-01, because an illustration style drawn before the
semantic colour pair is settled will have to be redrawn.
