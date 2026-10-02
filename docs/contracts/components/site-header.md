# Contract — SiteHeader

**Authority**: This document defines the marketing site's single header: its props, and the
two things about it that are deliberate and not guessable from the code. Any change to its
props must update this document in the same commit — `lib/contracts/componentContracts.test.ts`
compares the two prop-for-prop, both directions.

**Component:** `components/marketing/SiteHeader.tsx`

```typescript
interface SiteHeaderProps {
  /** Which nav section is current, so the header can mark it. `null` on pages
   *  that are in no section (home, legal, support). */
  current?: SiteSection   // 'plans' | 'pricing' | 'comparisons' | 'guides' | null
}
```

## Why there is only one prop, and why the obvious second one was removed

🔴 **`width` was a prop and that was the defect.** The first version took the page's CONTENT
width (1100 on the homepage, 760 elsewhere) so the header would match it. In use that meant a
reader walking from `/` to `/plans` watched the whole bar snap narrower. **Consistent layout
with an inconsistent span still reads as broken.** It is now the exported constant
`SITE_WIDTH = 1100`, shared with `SiteFooter`, **deliberately not a defaulted prop** so no call
site can reintroduce the drift.

🔴 **`current` is a prop rather than `usePathname()` for one reason: this stays a server
component.** The SLT ruling behind the header (Wood) is *"a sticky header is structural, an
animated one is decorative"* — no shadow, no gradient, no scroll listener, no motion, **no
client-side JS.** Reaching for the pathname hook would make the site's chrome a client
component on every page to save one prop at eight call sites.

## What this component owns, and what it must not be given

| | |
|---|---|
**Wordmark size** | `sm` (20px) **everywhere, no call-site override.** The bar it replaced rendered the wordmark at 20px on the homepage and 32px elsewhere, and the homepage wordmark **was not a link at all.** A wordmark that changes size as you navigate was the most brand-damaging thing on the site |
**The nav set** | A module constant, not a prop. Four items, each added against the same written test — *"the menu exists for sections people cannot otherwise find"* |
**The bottom edge** | `--line`, and this is a **ruled divergence from the app**, not drift. `.pinned-chrome` reveals `--chrome-edge` on scroll; a scroll-revealed edge needs a listener and client JS, which the ruling above forbids. ⚖️ `SITE-HEADER-EDGE-01` (Design Board, 2026-10-01), **permanent** |

⚠️ **Do not add a `variant`, a `compact`, or a `width`.** Every one of those re-opens the
divergence this component exists to close. The legal pages previously had no header at all,
so anyone landing on `/privacy` from search hit a dead end: the fix was one header, not a
configurable one.

## What this contract does not cover

The **content column** inside each page is still per-page (760 for reading measure on
articles, 1100 on the homepage) — that is page content, not chrome, and it is correct for it
to differ. Nothing here has been seen on a device.
