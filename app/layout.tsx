import type { Metadata } from 'next'
import './globals.css'
import './styles/polish-tokens.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import CapacitorBoot from '@/components/CapacitorBoot'
import { BRAND } from '@/lib/brand'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.appStoreSubtitle}`,
  description: BRAND.tagline,
  // viewport-fit=cover is REQUIRED for iOS to expose env(safe-area-inset-*) to
  // CSS — without it those insets resolve to 0, so the fixed bottom nav and the
  // scroll-container padding can't clear the home indicator (nav renders under
  // it). The app already consumes env(safe-area-inset-bottom) throughout.
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
  openGraph: {
    title: BRAND.name,
    description: BRAND.appStoreSubtitle,
    siteName: BRAND.name,
    images: [{ url: `${APP_URL}/api/og`, width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — ${BRAND.appStoreSubtitle}`,
    description: BRAND.tagline,
    images: [`${APP_URL}/api/og`],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: BRAND.name,
  },
}

// Theme initialisation retired — see ADR-008. Single light theme; no data-theme needed.
// const themeScript = `...`

const polishMode = process.env.NEXT_PUBLIC_POLISH_MODE === 'true'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-polish={polishMode ? 'on' : 'off'}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* theme-color is browser-chrome, not CSS — can't read a custom property,
            so it reuses the warm-slate bg literal single-sourced in lib/brand.ts
            (same non-CSS-surface exception as the OG image). Value === --bg. */}
        <meta name="theme-color" content={BRAND.og.bg} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><ErrorBoundary>{children}</ErrorBoundary><CapacitorBoot /></body>
    </html>
  )
}
