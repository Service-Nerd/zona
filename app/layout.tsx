import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ZONA — Effort-first training',
  description: "Slow down. You're not Kipchoge.",
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ZONA',
  },
}

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('rts_theme') || 'light';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = t === 'dark' || (t === 'auto' && prefersDark);
    var r = document.documentElement;
    r.setAttribute('data-theme', isDark ? 'dark' : 'light');
    if (isDark) {
      r.style.setProperty('--bg', '#0B132B');
      r.style.setProperty('--card-bg', '#162040');
      r.style.setProperty('--border-col', '#1e2e55');
      r.style.setProperty('--text-primary', '#F7F9FB');
      r.style.setProperty('--text-secondary', '#A0AEC0');
      r.style.setProperty('--text-muted', '#3A506B');
      r.style.setProperty('--nav-bg', '#0B132B');
      r.style.setProperty('--accent', '#5BC0BE');
      r.style.setProperty('--accent-amber', '#F2C14E');
      r.style.setProperty('--input-bg', '#162040');
    } else {
      r.style.setProperty('--bg', '#F7F9FB');
      r.style.setProperty('--card-bg', '#ffffff');
      r.style.setProperty('--border-col', '#E2E8F0');
      r.style.setProperty('--text-primary', '#0B132B');
      r.style.setProperty('--text-secondary', '#3A506B');
      r.style.setProperty('--text-muted', '#94A3B8');
      r.style.setProperty('--nav-bg', '#F7F9FB');
      r.style.setProperty('--accent', '#5BC0BE');
      r.style.setProperty('--accent-amber', '#F2C14E');
      r.style.setProperty('--input-bg', '#F7F9FB');
    }
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
      <body>{children}</body>
    </html>
  )
}
