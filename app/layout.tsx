import type { Metadata } from 'next'
import './globals.css'
import './styles/polish-tokens.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { BRAND } from '@/lib/brand'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://rts-training-hub.vercel.app'

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.appStoreSubtitle}`,
  description: BRAND.tagline,
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
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
        <meta name="theme-color" content="#F3F0EB" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><ErrorBoundary>{children}</ErrorBoundary></body>
    </html>
  )
}
