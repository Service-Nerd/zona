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

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/plans', label: 'Plans' },
  { href: '/comparisons', label: 'Comparisons' },
  // GTM-CHARITY-01. In the FOOTER, not the nav — the nav stays two items by SLT
  // ruling, and the charity's own email is the real front door for this page.
  // This link exists so the page is inspectable and shareable by us: the
  // founder could not find his own page, which meant he could not QA it or
  // notice it rotting. A maintenance argument, not a traffic one.
  { href: '/charity-runners', label: 'Charity runners' },
  { href: '/support', label: 'Support' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
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
      <div style={{ maxWidth: SITE_WIDTH, margin: '0 auto', padding: '36px 24px 48px' }}>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 13 }}>
          {LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{ color: 'var(--mute)', textDecoration: 'none' }}>
              {l.label}
            </Link>
          ))}
        </div>

        <p style={{ fontSize: 12, color: 'var(--mute)', margin: '20px 0 0' }}>
          © {new Date().getFullYear()} {BRAND.name}
        </p>
      </div>
    </footer>
  )
}
