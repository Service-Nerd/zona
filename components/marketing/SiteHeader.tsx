// GTM-SITE-01 — the marketing site's single header. New pattern; add to
// ui-patterns.md § Marketing Site Chrome.
//
// WHY THIS EXISTS. Before this there were five hand-written headers and three
// pages with none at all, and they disagreed on nearly everything:
//
//   page              wordmark   linked to /   width   right side
//   /                 20px       NO            1100    Free plans, Comparisons
//   /plans            32px       yes            760    Get the app
//   /compare          32px       yes            760    Get the app
//   plan spokes       32px       yes            760    Plans, Get the app
//   articles          32px       yes            760    Get the app
//   support/privacy   20px       yes             —     "← Back", no nav
//   /terms            20px       yes             —     "← Back", no nav
//
// The wordmark changing size as you navigate (20 -> 32 -> 20) is the most
// brand-damaging thing that was on the site, and the homepage wordmark was not
// even a link. Legal pages had no route back into the site at all, so anyone
// landing on /privacy from search hit a dead end.
//
// DESIGN NOTES (frontend-design skill + SLT review):
// - Wordmark is `sm` (20px) EVERYWHERE. That is the documented header step in
//   Wordmark.tsx ("sticky page-header wordmarks"). One size, no exceptions, no
//   callsite override.
// - "Pop" is presence, not decoration: the header is sticky so it never leaves,
//   carries one point of moss (the App Store pill), and marks the current
//   section. Wood's constraint from the review: a sticky header is structural, an
//   animated one is decorative. So no shadow, no gradient, no scroll listener,
//   no motion — and no client-side JS.
// - Active state is a prop, not `usePathname`, so this stays a server component.
// - `width` matches the CONTENT width of the page it sits on (the homepage is a
//   1100px layout, everything else is 760px). The chrome itself — wordmark size,
//   link set, order, alignment — is identical everywhere, which is the actual
//   consistency requirement. A 760px header floating over 1100px content would
//   be a different kind of wrong.

import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'

export type SiteSection = 'plans' | 'comparisons' | null

/** The nav. Two items on purpose (Fried, SLT review): a menu exists because
 *  there are two content sections people cannot otherwise find, not because
 *  sites have menus. */
const NAV: Array<{ href: string; label: string; section: SiteSection }> = [
  { href: '/plans', label: 'Plans', section: 'plans' },
  { href: '/comparisons', label: 'Comparisons', section: 'comparisons' },
]

export function SiteHeader({
  current = null,
  width = 760,
}: {
  current?: SiteSection
  width?: number
}) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <nav
        style={{
          maxWidth: width,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }} aria-label={`${BRAND.name} home`}>
          <Wordmark size="sm" />
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          {NAV.map(item => {
            const active = current === item.section
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  fontSize: 14,
                  fontWeight: active ? 700 : 600,
                  color: active ? 'var(--moss)' : 'var(--ink-2)',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.label}
              </Link>
            )
          })}

          {/* The single button in the chrome, and the only colour in it. */}
          <a
            href={BRAND.appStore.url}
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: 'var(--card)',
              background: 'var(--moss)',
              padding: '8px 14px',
              borderRadius: 999,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Get the app
          </a>
        </div>
      </nav>
    </header>
  )
}
