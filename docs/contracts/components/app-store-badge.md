# `AppStoreBadge` — contract

**Component:** `components/marketing/AppStoreBadge.tsx`

The App Store pill on the marketing site. **8 importers.**

⚠️ **Written 2026-11-08 (`CONTRACT-COVERAGE-03`, highest-reach first).**

```typescript
interface AppStoreBadgeProps {
}
```

🔴 **It takes no props, and that is the contract.** Every call site renders the same pill, and
**the one thing that varies is read from `BRAND`, not passed in** — so a page cannot show a
"Download" badge while the app is unapproved, which is the failure mode a `live` prop would
make possible on eight surfaces at once.

## The two states, and what switches them

| `BRAND.appStore.url` | renders | wrapper |
|---|---|---|
| empty (pre-approval) | `BRAND.appStore.comingSoonLabel`, pill at `opacity: 0.85` | a plain `<span>` — **not a link** |
| set | `BRAND.appStore.liveLabel` | an `<a href>` with `textDecoration: 'none'` |

🔴 **The coming-soon state is NOT a disabled link, it is not a link at all.** No `href`, no
`aria-disabled`, nothing for a crawler or a screen reader to follow to a page that does not
exist yet. Switching it to a styled-but-dead anchor would be a dead end on every marketing page.

## Invariants

1. **Both labels come from `BRAND.appStore.*`** — never written at a call site, so approval
   flips all eight surfaces in one edit to `lib/brand.ts`.
2. **The Apple mark is an inline SVG with `fill="currentColor"` and `aria-hidden="true"`**, so it
   inherits the pill's text colour and is announced once (by the label) rather than twice.
   No external asset, no second network request, no hardcoded hex in the path.
3. ✅ **`color: 'var(--card)'` — FIXED 2026-11-09 (`GUARD-COLOUR-KEYWORD-01`), and this clause
   was WRONG about why it could not be.** It read: *"there is no token for 'text on ink': `--card`
   is #FFFFFF but means a card surface, so using it here would be semantically wrong."*
   🔴 **`globals.css` had already settled it the other way, in a comment beside `--on-ground`:**
   *"The wordmark's light/moss lockups sit on dark at **PURE white (--card)**, not on the warm
   --on-ground."* So `--card` is the documented choice for a mark on dark, with precedent in the
   same stylesheet. `--card` is #FFFFFF, so the substitution is **zero-pixel** — no Design Board
   question, because no token had to be invented.
   📐 **The measurement stands and was the useful part:** across 376 files this was the ONLY bare
   palette keyword, and it passed every guard, because the hex and `rgba()` rules in
   `.githooks/pre-commit` and `npm run sweep:colours` match NUMERIC forms — a CSS colour
   **keyword** walked past both. It was found by writing this contract, not by a guard.
   ✅ **Now gated in both places**: `colour-guards.sh` owns a `keyword` rule, the commit hook and
   the tree sweep both read it (**sweep-only would have made the sweep STRICTER than the hook**,
   inverting the owner's stated invariant), and it shipped with **zero exemptions** because the
   one instance was converted first. 8 new cases across the two shell suites, both directions:
   a comment is prose, a variant named `'red'` is not a declaration, `transparent` and
   `currentColor` are legal CSS.

## Gates

`lib/contracts/componentContracts.test.ts` · `lib/marketing/noEmDash.test.ts` (both labels are
marketing copy) · `npm run sweep:colours` — ⚠️ which does **not** cover invariant 3, by the
measurement above.
