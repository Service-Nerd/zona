import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import QRCode from 'qrcode'
import { BRAND } from '@/lib/brand'

/**
 * IA-QR-01 — the committed QR encodes the CURRENT App Store URL.
 *
 * ⚠️ THE WHOLE POINT. A generated artifact checked into a repo with nothing
 * watching it is a stale artifact nobody has noticed yet, and this one fails
 * in the worst possible way: a QR that still scans, still looks right, and
 * sends people to the wrong place or to nothing. Nobody on the team will ever
 * scan it. So the test re-encodes BRAND.appStore.url with the same settings
 * the generator uses and compares.
 *
 * Regenerate with: node scripts/generate-appstore-qr.mjs
 */

const ROOT = path.resolve(__dirname, '../..')
const FILE = path.join(ROOT, 'public/appstore-qr.svg')

async function expected(url: string) {
  const svg = await QRCode.toString(url, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#000000', light: '#0000' },
  })
  return svg
    .replace(/ width="\d+" height="\d+"/, '')
    .replace(/#000000/g, 'currentColor')
    .replace('<svg ', '<svg role="img" aria-label="App Store QR code" ')
}

describe('app store QR', () => {
  it('matches the current BRAND.appStore.url', async () => {
    const committed = fs.readFileSync(FILE, 'utf8')
    expect(
      committed,
      'public/appstore-qr.svg is stale: run `node scripts/generate-appstore-qr.mjs`',
    ).toBe(await expected(BRAND.appStore.url))
  })

  it('would notice a different URL (the failure mode is a QR that still scans)', async () => {
    const other = await expected('https://apps.apple.com/app/id0000000000')
    expect(other).not.toBe(fs.readFileSync(FILE, 'utf8'))
  })

  it('carries no hardcoded colour, so --ink owns it', () => {
    const svg = fs.readFileSync(FILE, 'utf8')
    expect(svg).toContain('currentColor')
    expect(svg).not.toMatch(/#[0-9a-f]{3,8}/i)
  })

  it('is hidden below the desktop breakpoint, in CSS not JavaScript', () => {
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    expect(css).toMatch(/\.qr-desktop-only\s*\{\s*display:\s*none/)
    expect(css).toMatch(/@media \(min-width: 1024px\)/)
    const cmp = fs.readFileSync(path.join(ROOT, 'components/marketing/AppStoreQr.tsx'), 'utf8')
    expect(cmp).toContain('qr-desktop-only')
    expect(cmp, 'a width check in JS causes hydration mismatch and layout shift')
      .not.toMatch(/innerWidth|matchMedia|useState|useEffect/)
  })
})
