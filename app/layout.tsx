import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '@doinghardthingsbadly — Training Hub',
  description: 'Race to the Stones 100km · 11 July 2026 · Make-A-Wish UK',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
