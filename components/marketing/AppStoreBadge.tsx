// GTM-08 — App Store badge for the marketing one-pager.
// Renders a "coming soon" pill while BRAND.appStore.url is empty (pre-approval),
// then a live "Download on the App Store" link once the URL is set. Apple mark
// is an inline SVG (currentColor) so it inherits the pill's text colour — no
// external asset, no hardcoded hex. Dark pill via --ink token.

import { BRAND } from '@/lib/brand'

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.2-1.12 2.98-.84.94-2.2 1.66-3.32 1.57-.14-1.1.4-2.27 1.07-3 .76-.84 2.16-1.46 3.2-1.5.04.32.04.63.04.95h.05zM20.9 17.06c-.55 1.27-.82 1.84-1.53 2.96-.99 1.57-2.39 3.52-4.12 3.54-1.54.01-1.93-1-4.02-.99-2.08.01-2.52.99-4.06.98-1.73-.02-3.06-1.78-4.05-3.35-2.77-4.4-3.06-9.56-1.35-12.3 1.21-1.95 3.12-3.09 4.92-3.09 1.83 0 2.98 1 4.5 1 1.47 0 2.36-1 4.48-1 1.6 0 3.3.87 4.5 2.38-3.96 2.17-3.32 7.82.31 9.32z"/>
    </svg>
  )
}

export function AppStoreBadge() {
  const live = Boolean(BRAND.appStore.url)
  const label = live ? BRAND.appStore.liveLabel : BRAND.appStore.comingSoonLabel

  const pill = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 18px',
        background: 'var(--ink)',
        color: 'white',
        borderRadius: 'var(--radius-md, 8px)',
        fontSize: '14px',
        fontWeight: 600,
        lineHeight: 1,
        opacity: live ? 1 : 0.85,
      }}
    >
      <AppleMark />
      {label}
    </span>
  )

  if (!live) {
    return <span style={{ display: 'inline-block' }}>{pill}</span>
  }

  return (
    <a href={BRAND.appStore.url} style={{ textDecoration: 'none', display: 'inline-block' }}>
      {pill}
    </a>
  )
}
