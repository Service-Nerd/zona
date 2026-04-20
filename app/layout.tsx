import type { Metadata } from 'next'
import './globals.css'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const metadata: Metadata = {
  title: 'Zona — Effort-first training',
  description: "Slow down. You're not Kipchoge.",
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Zona',
  },
}

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('rts_theme') || 'light';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = t === 'dark' || (t === 'auto' && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0B132B" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body><ErrorBoundary>{children}</ErrorBoundary></body>
    </html>
  )
}
