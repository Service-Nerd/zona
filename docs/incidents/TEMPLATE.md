# Incident — [short title]

**Date found:** YYYY-MM-DD · **Live since:** [date or "unknown"] · **Triage:** Systemic
**Fix commit:** `<sha>` · **Catalogue class:** [existing class, or "NEW — <name>"]

> Write one of these for any **Systemic + silent** bug. Not for trivial or contained
> fixes — a template nobody can face writing gets skipped, which defeats it.
> The section that matters most is *Why it survived*. The fix is usually the easy part.

---

## Symptom

What the user saw, in their words if possible. Include the surfaces that disagreed.

## What was actually wrong

The mechanism, at `file:line`. Not the symptom restated — the defect.

## Why it survived

**The important section.** Zonna's bugs are almost never crashes; they are silent.
Answer specifically:

- What made this invisible? (silent catch, unchecked response, degraded fallback,
  passing type check, plausible-looking output)
- How long was it live, and what would have caught it sooner?
- Did any check pass that *should* have failed? Why did it pass?

## Blast radius

What else the fix touched, across the eight dimensions in the `zona-debug` skill.
Name the ones that were clear, don't just list the ones that bit.

## Fix

What changed, and why that option over the alternatives.

## Regression defence

The test that now fails-before / passes-after, at `path`. If the class genuinely
isn't unit-testable, say so and name what stands in its place.

## Catalogue

- [ ] Is this an **existing** class in the `zona-debug` catalogue? Name it.
- [ ] Is it a **new** class? Then add a row to that table **in this commit** — that
      loop is the only thing keeping the catalogue from decaying into generic advice.

## Follow-ups

Anything deliberately left. Link the backlog entry so it doesn't evaporate.
