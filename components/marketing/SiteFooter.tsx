// GTM-SITE-01 — the marketing site's single footer. New pattern; add to
// ui-patterns.md § Marketing Site Chrome.
//
// Before this there were four hand-written footers with different link sets and
// different LABELS for the same destination ("Plans" on some, "Free plans" on
// others), plus three legal pages with no footer at all — so /privacy, /terms
// and /support had no outbound internal links whatsoever. Dead ends for a reader
// and for a crawler.
//
// The link set is now identical on every page, in one order, with one label per
// destination. The current page is still listed rather than omitted: dropping
// the self-link made every footer subtly different, which is the thing this
// component exists to stop.
//
// NO BRAND STATEMENT HERE, deliberately (DIV-022, founder ruling 2026-09-10).
//
// The first version put `BRAND.brandStatement` above the links, on the reading
// that CLAUDE.md names the "privacy footer" as one of its homes. Shipping it in
// a SHARED footer turned that into the line rendering on all 8 pages — and on
// the homepage it appeared TWICE, ~96px under the designed 48px closing voice
// moment. That is DIV-020's "over-use degrades the asset" at site scale.
//
// The footer's job is navigation and legal. The voice moment is a deliberate,
// designed placement: the homepage closing section, and a closing line on
// /privacy (its documented home). Both are page-level decisions, not chrome.

import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { SITE_WIDTH } from '@/components/marketing/SiteHeader'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'
import { guidesArePublished } from '@/lib/marketing/articles'

// W-10 (2026-09-21) — GROUPED, not lengthened. The link set and the labels are
// unchanged; only the arrangement is. Nine links in one undifferentiated
// 13px row gave the last thing every visitor sees no structure at all, and
// "Charity runners" sat between "Comparisons" and "Support" as though it were
// a peer of both.
//
// 🔴 IT IS NOT A DARK FOOTER, AND THAT IS A RULE RATHER THAN A PREFERENCE.
// `ui-patterns.md` § Dark Ground: "Exactly one near-black section per
// marketing page. It is a punctuation mark, not a theme (ADR-008). A second
// dark section would make it a dark theme; don't." The competitor this work
// came from closes on TWO dark bands. We close on one, and the footer's job is
// to be quiet underneath it.
//
// Weight here therefore comes from STRUCTURE: three named columns, the App
// Store badge given a home, and a real top rule. Not from darkness.
const GROUPS: Array<{ heading: string; links: Array<{ href: string; label: string }> }> = [
  {
    heading: 'Train',
    links: [
      { href: '/', label: 'Home' },
      { href: '/plans', label: 'Plans' },
      { href: '/pricing', label: 'Pricing' },
    ],
  },
  {
    heading: 'Read',
    links: [
      // W-01 — appears the day the guides hub opens, and not before. The hub
      // 404s until `GUIDES_MIN_TO_PUBLISH` is met, so a fixed link here would
      // advertise a dead page for however long the third guide takes. Driving
      // it off the same gate means nobody has to remember to add it.
      //
      // FOOTER, NOT HEADER, and that follows the existing rule rather than
      // making an exception to it: the nav is deliberately short by SLT
      // ruling, `/about` and `/charity-runners` are already footer-only for
      // that reason, and "Read" is exactly where a guide belongs.
      ...(guidesArePublished() ? [{ href: '/guides', label: 'Guides' }] : []),
      { href: '/comparisons', label: 'Comparisons' },
      { href: '/about', label: 'About' },
      // GTM-CHARITY-01. In the FOOTER, not the nav — the nav stays short by SLT
      // ruling, and the charity's own email is the real front door for this
      // page. This link exists so the page is inspectable and shareable by us:
      // the founder could not find his own page, which meant he could not QA it
      // or notice it rotting. A maintenance argument, not a traffic one.
      { href: '/charity-runners', label: 'Charity runners' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/support', label: 'Support' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
]

// Same single frame as the header — see SiteHeader's SITE_WIDTH note.
export function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--line)',
        marginTop: 36,
        background: 'var(--bg)',
      }}
    >
      <div style={{ maxWidth: SITE_WIDTH, margin: '0 auto', padding: '40px 24px 48px' }}>
        <div style={{
          display: 'grid',
          // The badge column is last on desktop and first-wrapping on a phone.
          // `auto-fit` + `min(100%, 150px)` keeps a 375px screen to one column
          // with the standard 24px gutter rather than forcing a horizontal
          // scroll, which is how the header once broke the whole document.
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
          gap: '28px 24px',
          alignItems: 'start',
        }}>
          {GROUPS.map(g => (
            <nav key={g.heading} aria-label={g.heading}>
              {/* <h3> for the same reason as the nav columns above. */}
              <h3 style={{
                fontFamily: 'var(--font-brand)',
                fontSize: 'var(--fs-eyebrow)', fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--mute)', margin: '0 0 12px',
              }}>
                {g.heading}
              </h3>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 9 }}>
                {g.links.map(l => (
                  <li key={l.href}>
                    <Link href={l.href} style={{ fontSize: 'var(--fs-body)', color: 'var(--ink-2)', textDecoration: 'none' }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* The badge has never had a home in the chrome. It renders nothing
              until the App Store URL exists, exactly as it does elsewhere, so
              this column is simply absent pre-approval rather than a gap. */}
          <div>
            {/* <h3> for the same reason as the nav columns above: a footer
                column label is for navigation, not for identifying a section of
                the page. */}
            <h3 style={{
              fontFamily: 'var(--font-brand)',
              fontSize: 'var(--fs-eyebrow)', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              color: 'var(--mute)', margin: '0 0 12px',
            }}>
              Get {BRAND.name}
            </h3>
            <AppStoreBadge />
          </div>
        </div>

        <p style={{
          fontSize: 'var(--fs-caption)', color: 'var(--mute)',
          margin: '36px 0 0', paddingTop: 20, borderTop: '1px solid var(--line)',
        }}>
          © {new Date().getFullYear()} {BRAND.name}
        </p>
      </div>
    </footer>
  )
}
