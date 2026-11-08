# `Wordmark` — contract

**Component:** `components/ui/Wordmark.tsx`

The brand wordmark with the NN-moss device. **8 importers** — the bottom bar, sticky page
headers, boot / splash / plan-ready moments, the OG image, the hero.

⚠️ **Written 2026-11-08 (`CONTRACT-COVERAGE-03`, highest-reach first).**

## Prop interface

```typescript
interface WordmarkProps {
  size?: WordmarkSize
  variant?: WordmarkVariant
  className?: string
  title?: string
  style?: React.CSSProperties
}
```

`WordmarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'` · `WordmarkVariant = 'default' | 'light' | 'moss'`

## Invariants

1. 🔴 **THE ACCENT POSITION IS DERIVED FROM `BRAND.name` AT RUNTIME, NEVER HARDCODED.**
   `splitOnDoubleLetter` finds the first run of two identical letters, case-insensitively, and
   preserves the original casing. **This is the rebrand defence:** the product has been Zona,
   then Vetra, now Zonna, and `CLAUDE.md` says it may rename again. ⚠️ **A name with no double
   letter falls back to plain text** — the device disappears and the wordmark still renders.
   That branch is the whole reason the derivation is safe to ship.
2. **Type is fixed by the spec and is not a call-site decision.** `var(--font-brand)`, weight
   800, `letter-spacing: -0.03em`, `line-height: 1`. ⚠️ `style` spreads **after** these, so a
   caller technically *can* override type — it exists for layout (margin, alignment) and
   overriding type through it is a palette/type regression in Silvanto's sense.
3. **Five sizes, and they map to real surfaces**, not an abstract scale: `xs` 14px bottom
   bar · `sm` 20px sticky headers · `md` 32px boot/splash/plan-ready · `lg` 48px OG and large
   brand moments · `xl` 56px hero.
4. ⚠️ **`light` and `moss` render IDENTICALLY, and that is deliberate.** Both target
   white-on-dark (`--card` base, `--on-card-mute` accent). They are kept as distinct semantic
   variants so a call site declares its intent rather than borrowing the other one's name —
   which is what lets them diverge later without touching eight call sites.
5. **`title` defaults to `BRAND.name`** on both branches, so the wordmark always has an
   accessible name even when a caller passes nothing.
6. **Every colour is a token.** 🔄 **The component's own header comment claimed otherwise until
   2026-11-08** — *"the only inline RGBA literal is the variant-specific NN tint on white
   surfaces; there is no token for 55% opacity white"*. `--on-card-mute` exists now and is used;
   the comment was true when written and had been false since. Corrected while writing this
   contract, which is the kind of thing writing a contract is for.

## Consumers

8, across the app and the marketing site. ⚠️ **Both surfaces render this same component**, so a
change here is an app change AND a website change — the consumer check `/build` § 4 asks for.

## Gates

`lib/contracts/componentContracts.test.ts` · `lib/ui/appTypeScale.test.ts` ·
`npm run sweep:colours`.

🔴 **AND INVARIANT 1 — THE REBRAND DEFENCE — IS UNGATED. Corrected by code review on the day
this was written.** The first version of this line cited the pre-commit hook as enforcing
*"brand strings must come from `BRAND`"*. **It does not:** the hook checks palette, fonts,
`setProperty` and direct `strava_activities` writes, and no test enforces a brand rule either.
📐 Measured while correcting it: **12 hardcoded brand-name literals in live runner-facing copy**
under `components/dashboard/`, `components/shared/`, `components/training/` and three preview
pages. 🔻 **Filed as `BRAND-HARDCODE-01`.** ⚠️ **A contract citing a gate that does not exist is
worse than citing none** — it reads as authoritative and is fiction, which is the exact failure
`COMPONENT-CONTRACT-GATE-01` was built for, committed in a contract. This component is itself
correct: it derives everything from `BRAND.name`.
