import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '@doinghardthingsbadly — Training Hub',
  description: 'Race to the Stones 100km · 11 July 2026 · Make-A-Wish UK',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

// Blocking script — runs before paint, prevents theme flash
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('rts_theme') || 'dark';
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = t === 'dark' || (t === 'auto' && prefersDark);
    var r = document.documentElement;
    if (isDark) {
      r.style.setProperty('--bg', '#000');
      r.style.setProperty('--card-bg', '#0d0d0d');
      r.style.setProperty('--border-col', '#1c1c1c');
      r.style.setProperty('--text-primary', '#fff');
      r.style.setProperty('--text-secondary', '#c0c0c0');
      r.style.setProperty('--text-muted', '#777');
      r.style.setProperty('--nav-bg', '#000');
    } else {
      r.style.setProperty('--bg', '#f5f3ef');
      r.style.setProperty('--card-bg', '#fff');
      r.style.setProperty('--border-col', '#e8e3dc');
      r.style.setProperty('--text-primary', '#111');
      r.style.setProperty('--text-secondary', '#444');
      r.style.setProperty('--text-muted', '#888');
      r.style.setProperty('--nav-bg', '#f5f3ef');
    }
  } catch(e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
