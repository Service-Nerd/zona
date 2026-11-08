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
3. ⚠️ **`color: 'white'` IS A HARDCODED COLOUR AND IT IS THE ONLY ONE IN THE TREE.** 📐 Measured
   2026-11-08 across 376 files: the only bare palette keyword in `app/` or `components/` is this
   line. It passes every guard — the hex and `rgba()` checks in `.githooks/pre-commit` and
   `npm run sweep:colours` match numeric forms, so a CSS colour **keyword** walks past both.
   It is white text on a `--ink` pill, which is correct, and **there is no token for
   "text on ink"**: `--card` is #FFFFFF but means a card surface, so using it here would be
   semantically wrong. 🔻 **Filed as `GUARD-COLOUR-KEYWORD-01`** rather than fixed here, because
   inventing a token is a Design Board call and adding a guard arm whose only instance needs an
   immediate exemption is a guard that proves nothing.

## Gates

`lib/contracts/componentContracts.test.ts` · `lib/marketing/noEmDash.test.ts` (both labels are
marketing copy) · `npm run sweep:colours` — ⚠️ which does **not** cover invariant 3, by the
measurement above.
