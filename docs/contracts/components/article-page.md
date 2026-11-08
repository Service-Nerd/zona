# `ArticlePage` — contract

**Component:** `components/marketing/ArticlePage.tsx`

The shared renderer for every long-form marketing article — comparisons and guides.
**10 importers: the most-imported uncontracted component in the tree.**

⚠️ **Written 2026-11-08 (`CONTRACT-COVERAGE-03`).** 📐 **And the item's "highest reach first"
list ranked it SIXTH at 6 importers** — re-derived live it is **first at 10**. The list was from
2026-10-02 and had gone stale in the direction that matters.

## Prop interface

```typescript
interface ArticlePageProps {
  article: MarketingArticle
}
```

🔴 **One prop, and the restraint is the design.** Everything that varies between articles lives
in the `MarketingArticle` data in `lib/marketing/articles.ts` — slug, meta, H1, date, blocks.
**A second prop would be the first step toward per-article layout**, which is exactly what the
header comment forbids.

## What is DELIBERATELY ABSENT

No author avatar · no tags or category chips · no reading-time badge · no related-posts strip ·
no share buttons · no hero image.

🔴 **Not an oversight.** Those read as content-marketing tooling and work against the register
this site holds. **If a future article needs one, that is a decision to take on purpose — and
it is a Design Board decision, not a prop added here.**

## Invariants

1. 🔴 **`kind` drives the breadcrumb, the hub link AND the structured data, together.**
   A guide resolves to `GUIDE_HUB` / "Guides" / `guidesArePublished()`; a comparison to
   `COMPARISON_HUB` / "Comparisons" / always published. ⚠️ **The JSON-LD hardcoded
   `'Comparisons'` and `/comparisons` until 2026-09-21**, so a guide's structured data told
   crawlers it sat under the comparison hub — **worse than a wrong visible breadcrumb, because
   nobody sees it.** The two must be derived from the same `hub` object.
2. **Guides can be unpublished and comparisons cannot.** `guidesArePublished()` gates the guide
   hub link; a reader must never be sent to a hub that 404s.
3. **Inline text links only — `LINK_STYLE`, no button or CTA styling in this content type.**
   `--moss-strong` (not `--moss`) at weight 600 with an underline, which is
   `ACCENT-TEXT-CONTRAST-01`'s rule for small accent text.
4. **Internal routes go through `next/link`, absolute URLs stay plain `<a>`** — decided by
   `span.href.startsWith('/')` in `renderSpans`. The repo's internal-nav pattern.
5. ⚠️ **`APP_URL` falls back to the committed `'https://www.zonna.run'`** and
   `NEXT_PUBLIC_APP_URL` is deliberately unset (`GTM-SITE-01`). `www` is the only host that
   serves 200; the apex 307-redirects. A canonical or JSON-LD URL built on the apex publishes a
   redirect to every crawler.
6. **Layout primitives are lifted from `/plans`** — `SiteHeader`, `SiteFooter`, the section
   width and the type scale — so this content type carries the same visual weight as the rest of
   the site rather than inventing a third measure.
7. **Every colour and size is a token.** `--fs-lead-lg`, `--ink-2`, `--space-5`, `maxWidth: 640`
   for the measure.

## Consumers

10 article routes under `app/`, plus `articleMetadata(article)` exported from the same file,
which the routes use for their `generateMetadata`. ⚠️ **That second export is why the gate reads
this component's props from the DEFAULT-export destructure** rather than the first named
function it finds — the `Sheet.tsx` lesson in `componentContracts.test.ts`.

## Gates

`lib/contracts/componentContracts.test.ts` · `lib/marketing/articles.test.ts` (an ungrouped
guide fails) · `lib/marketing/comparisons.test.ts` (meta title < 60, description < 155) ·
`lib/marketing/noEmDash.test.ts` · `lib/ui/accentText.test.ts`.
