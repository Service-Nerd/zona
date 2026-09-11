// Regenerates every PWA / favicon PNG in public/icons/ from the source SVGs.
//
// BRAND-08-pwa. These PNGs had been hand-generated once (2026-04-29, the Vetra
// rebrand) and then drifted: the iOS *native* app icon was regenerated from the
// new concentric-rings mark on 2026-05-13 but this set was left on the old
// ring-and-dot design, so browser tabs and Add-to-Home-Screen showed a brand we
// had already abandoned twice. A script exists so the next mark change is one
// command, not a manual pass that silently half-happens.
//
//   node scripts/generate-pwa-icons.mjs
//
// WEBSITE ONLY. The iOS app is a Capacitor shell loading the web app from
// Vercel; its app icon is a separate native asset
// (ios/App/App/Assets.xcassets/AppIcon.appiconset/). Nothing here reaches it.
//
// sharp is not a direct dependency — it arrives via @capacitor/assets (declared,
// ^3.0.5). If that is ever dropped, this script fails loudly rather than
// silently skipping.

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error(
    '[generate-pwa-icons] sharp not resolvable.\n' +
    'It ships transitively via @capacitor/assets. Run `npm install`, or add\n' +
    'sharp as a devDependency if @capacitor/assets has been removed.',
  )
  process.exit(1)
}

const ICONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const SRC = join(ICONS, 'source')

// --bg from app/globals.css. Used to flatten the Apple touch icon: iOS applies
// its OWN squircle mask, so an icon that already carries transparent rounded
// corners gets masked twice and the corners render black. Apple's guidance is a
// square, fully opaque image — let the OS do the rounding.
const TOKEN_BG = '#F3F0EB'

/** src: which source SVG · flatten: bake onto TOKEN_BG and drop the alpha channel */
const TARGETS = [
  // Standard "any purpose" set + favicons — light mark, rounded corners kept.
  { file: 'favicon-16x16.png',           size: 16,  src: 'zonna-icon-light.svg' },
  { file: 'favicon-32x32.png',           size: 32,  src: 'zonna-icon-light.svg' },
  { file: 'icon-72x72.png',              size: 72,  src: 'zonna-icon-light.svg' },
  { file: 'icon-96x96.png',              size: 96,  src: 'zonna-icon-light.svg' },
  { file: 'icon-128x128.png',            size: 128, src: 'zonna-icon-light.svg' },
  { file: 'icon-144x144.png',            size: 144, src: 'zonna-icon-light.svg' },
  { file: 'icon-152x152.png',            size: 152, src: 'zonna-icon-light.svg' },
  { file: 'icon-180x180.png',            size: 180, src: 'zonna-icon-light.svg' },
  { file: 'icon-192x192.png',            size: 192, src: 'zonna-icon-light.svg' },
  { file: 'icon-384x384.png',            size: 384, src: 'zonna-icon-light.svg' },
  { file: 'icon-512x512.png',            size: 512, src: 'zonna-icon-light.svg' },

  // Dark-scheme variants — referenced by prefers-color-scheme consumers.
  { file: 'icon-192x192-dark.png',       size: 192, src: 'zonna-icon-dark.svg' },
  { file: 'icon-512x512-dark.png',       size: 512, src: 'zonna-icon-dark.svg' },

  // Android maskable — 20% safe-zone padding baked into the source, fills to the
  // canvas edge. Must be opaque: the OS crops it to an arbitrary shape.
  { file: 'icon-maskable-192x192.png',   size: 192, src: 'zonna-icon-maskable.svg', flatten: true },
  { file: 'icon-maskable-512x512.png',   size: 512, src: 'zonna-icon-maskable.svg', flatten: true },

  // Apple touch icon — opaque and square on purpose. See TOKEN_BG above.
  { file: 'apple-touch-icon.png',        size: 180, src: 'zonna-icon-light.svg', flatten: true },
]

const svgCache = new Map()
async function loadSvg(name) {
  if (!svgCache.has(name)) svgCache.set(name, await readFile(join(SRC, name)))
  return svgCache.get(name)
}

let failed = 0
for (const { file, size, src, flatten } of TARGETS) {
  try {
    // density scales the SVG rasteriser so small sizes stay crisp rather than
    // being rendered at 1024 and downsampled through a blurry box filter.
    let pipeline = sharp(await loadSvg(src), { density: Math.ceil((size / 1024) * 72 * 4) })
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })

    if (flatten) pipeline = pipeline.flatten({ background: TOKEN_BG })

    await writeFile(join(ICONS, file), await pipeline.png({ compressionLevel: 9 }).toBuffer())
    console.log(`  ✓ ${file.padEnd(28)} ${size}x${size}  ${src}${flatten ? '  (opaque)' : ''}`)
  } catch (err) {
    failed++
    console.error(`  ✗ ${file} — ${err.message}`)
  }
}

console.log(
  failed
    ? `\n[generate-pwa-icons] ${failed} of ${TARGETS.length} FAILED`
    : `\n[generate-pwa-icons] ${TARGETS.length} icons written from ${SRC}`,
)
process.exit(failed ? 1 : 0)
