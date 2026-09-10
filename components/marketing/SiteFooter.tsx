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
// `BRAND.brandStatement` sits above the links. Per CLAUDE.md that is the voice
// moment ("You can't outrun your easy days") and the privacy footer is named as
// one of its homes, so this placement is doctrine, not decoration.

import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { SITE_WIDTH } from '@/components/marketing/SiteHeader'

const LINKS: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/plans', label: 'Plans' },
  { href: '/comparisons', label: 'Comparisons' },
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
        <p
          style={{
            fontFamily: 'var(--font-brand)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--ink-2)',
            margin: '0 0 16px',
          }}
        >
          {BRAND.brandStatement}
        </p>

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
