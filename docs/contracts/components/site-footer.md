# Contract — SiteFooter

**Authority**: This document defines the marketing site's single footer. Any change to its
props must update this document in the same commit — `lib/contracts/componentContracts.test.ts`
compares the two prop-for-prop, both directions.

**Component:** `components/marketing/SiteFooter.tsx`

```typescript
interface SiteFooterProps {
}
```

🔴 **It takes no props, and that is the contract.** The link set is **identical on every page,
in one order, with one label per destination** — eleven call sites, zero configuration. Before
it existed there were four hand-written footers with different link sets and *different labels
for the same destination* ("Plans" on some, "Free plans" on others), and three legal pages with
no footer at all, so `/privacy`, `/terms` and `/support` had **no outbound internal links
whatsoever** — dead ends for a reader and for a crawler.

⚠️ **The current page is still listed rather than omitted.** Dropping the self-link is the
obvious polish and it is wrong: it made every footer subtly different, which is the thing this
component exists to stop.

> ⚠️ **Writing this contract required a change to the GATE, which is worth knowing before you
> write the next propless one.** `componentContracts.test.ts` read "no props" and "could not
> parse the props" as the same answer (`null`), and its caller asserts non-null — so
> **documenting a propless component turned the gate red.** An empty parameter list now returns
> `[]` while an unparseable one still returns `null`; the two states are decidable and are kept
> separate deliberately, because collapsing them would make every parser failure read as "no
> props" and silently stop comparing.

## NO BRAND STATEMENT HERE — deliberate, founder ruling (DIV-022, 2026-09-10)

The first version put `BRAND.brandStatement` above the links, on the reading that `CLAUDE.md`
names the "privacy footer" as one of its homes. In a **shared** footer that became the line
rendering on all 8 pages, and on the homepage it appeared **twice**, ~96px under the designed
48px closing voice moment. That is DIV-020's *"over-use degrades the asset"* at site scale.

**The footer's job is navigation and legal.** The voice moment is a deliberate, designed
placement — the homepage closing section, and a closing line on `/privacy`, its documented
home. Both are page-level decisions, not chrome.

## Shared with the header

`SITE_WIDTH` (1100) is imported from `SiteHeader`, not redeclared. One frame value for header
and footer on every page; see `site-header.md` for why it is a constant and not a prop.

## What this contract does not cover

The grid's responsive behaviour (`auto-fit` / `minmax(min(100%, 150px), 1fr)`) is chosen so a
375px screen collapses to one column rather than forcing a horizontal scroll — **measured in a
browser, not on a device.**
