/**
 * IA-QR-01 — regenerate public/appstore-qr.svg from BRAND.appStore.url.
 *
 * Run: node scripts/generate-appstore-qr.mjs   (needs `qrcode` available)
 *
 * ⚠️ WHY A COMMITTED ASSET AND NOT A RUNTIME LIBRARY. The QR encodes ONE
 * string that changes roughly never. A runtime dependency would put a
 * generator in the client bundle, on every page load, to redraw a constant.
 * The cost of the static asset is that it can go stale against
 * BRAND.appStore.url, and that cost is paid by `lib/marketing/appStoreQr.test.ts`,
 * which re-encodes the current URL and fails if the committed file does not
 * match. A generated artifact with no check is just a stale artifact nobody
 * has noticed yet.
 *
 * The SVG is monochrome and uncoloured on purpose: it inherits `currentColor`
 * so the page's --ink token owns it, and no hex enters a committed asset.
 */
import { writeFileSync } from 'node:fs'
import QRCode from 'qrcode'

export const APPSTORE_URL = 'https://apps.apple.com/app/id6767516424'

export async function qrSvg(url) {
  const svg = await QRCode.toString(url, {
    type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#000000', light: '#0000' },
  })
  // Strip the fixed size and the literal colour so the page controls both.
  return svg
    .replace(/ width="\d+" height="\d+"/, '')
    .replace(/#000000/g, 'currentColor')
    .replace('<svg ', '<svg role="img" aria-label="App Store QR code" ')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const svg = await qrSvg(APPSTORE_URL)
  writeFileSync(new URL('../public/appstore-qr.svg', import.meta.url), svg)
  console.log('wrote public/appstore-qr.svg for', APPSTORE_URL, `(${svg.length} bytes)`)
}
