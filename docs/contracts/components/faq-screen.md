# Contract — FaqScreen

**Authority**: This document defines the prop interface and rendering contract for the in-app
FAQ. Any change to props must update this document in the same commit.

**Component:** `components/shared/FaqScreen.tsx`

---

## Prop Interface

```typescript
export interface FaqScreenProps {
  onBack: () => void
  /** Hands off to the contact screen. A FAQ that cannot say "this did not help" is a wall. */
  onContact?: () => void
}
```

⚠️ **No content prop, deliberately.** The questions come from `lib/faq.ts` and nowhere else.
This component renders; it never declares a question.

---

## Content ownership

`lib/faq.ts` is the **single owner** of every question-and-answer pair. `FaqScreen` renders
`APP_FAQS`; `/support` renders `WEB_FAQS` (product-scoped only, because the page's own prose
already answers the account half).

**Two declared exclusions**, asserted exactly so a fifth set fails the build:
`app/charity-runners/page.tsx` (code-specific entries, and the source the Coaching-Board-cleared
answers were lifted from) and `lib/marketing/plans.ts` (`extraFaqs` bound to one plan's page).

🔴 **There were FOUR existing FAQ sets, not the three the analysis named.** The single-owner gate
found `plans.ts`, which lives in **data**, not a page.

---

## Markup

`ui-patterns.md` § FAQ disclosure — native `<details>`/`<summary>`, zero-JS. ⚠️ The `+` → `×`
rotation is owned by `globals.css` (`details[open] > summary > span[aria-hidden]`), so the marker
**must** stay a direct `aria-hidden` span child of `summary`. No class, no local rule. Summary
carries a 44px minimum target via padding.

⚠️ **No `FAQPage` JSON-LD.** Google retired FAQPage rich results in **May 2026**; we already ship
the dead schema in two places (`SEO-SCHEMA-STALE-01`).

---

## ⚖️ Sierra's binding condition

Every entry in `lib/faq.ts` carries `shouldBeObviousOn` — **the screen that should have answered
it without being asked**. Not rendered, and not decoration: *"a FAQ is a patch over a product
that isn't obvious."* It keeps the list readable as a **defect log** rather than furniture, and
an arm fails if a product question omits it. **When a screen is fixed, its question leaves.**

---

## Governance

Design Board `FAQ-01` (2026-09-29). Gated by `lib/faq.test.ts`.
