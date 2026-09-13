import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { Z_LAYERS } from '@/lib/ui/zLayers'

// SHEET-PRESENT-01 — the presentation contract, enforced.
//
// Seven hand-rolled sheets each invented their own z-index; five sat below the
// bottom nav (100 / 200 / 2000) and the founder could not see the panel that
// opened over them. The fix is one <Sheet> primitive; these tests make copying
// the old pattern back a build failure, not a device-only regression nobody can
// reproduce.

const ROOT = join(__dirname, '..', '..')

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

describe('Sheet primitive is the single owner of sheet presentation', () => {
  const src = read('components/shared/Sheet.tsx')

  it('renders through a portal so it escapes the scrolling content container', () => {
    expect(src).toContain('createPortal')
  })

  it('takes its z-index from the shared ladder, never a hardcoded number', () => {
    expect(src).toContain('Z_LAYERS.sheet')
    // No four-digit zIndex literal (the old 2000/4000/4001 guesses).
    expect(src).not.toMatch(/zIndex:\s*\d{3,}/)
  })

  it('rests on the nav by reserving the measured nav height', () => {
    expect(src).toContain('useNavHeight')
    expect(src).toContain('paddingBottom')
  })
})

describe('every migrated sheet goes through the primitive', () => {
  const migrated = [
    'components/shared/ZoneInfoSheet.tsx',
    'components/shared/TrendCard.tsx',
    'components/training/RaceResultSheet.tsx',
    'app/dashboard/DashboardClient.tsx',
    'app/dashboard/GeneratePlanScreen.tsx',
  ]

  for (const file of migrated) {
    it(`${file} imports the Sheet primitive`, () => {
      expect(read(file)).toMatch(/import Sheet(?:,|\s)/)
    })

    it(`${file} no longer hardcodes a sub-nav sheet z-index`, () => {
      const src = read(file)
      // The exact defect: the below-nav guesses the seven copies used.
      expect(src).not.toMatch(/zIndex:\s*(100|200|2000)\b/)
    })
  }
})

describe('no below-nav bottom-sheet overlay exists anywhere in the UI', () => {
  it('every flex-end fixed overlay with a scrim sits on the sheet/guide layer', () => {
    // The sheet signature: a full-viewport fixed overlay, bottom-anchored, with
    // an rgba scrim. Scan the whole UI tree and assert none carries a z-index
    // below the nav. (Charts, rulers and the marketing frame use flex-end for
    // layout but have no fixed scrim, so they are not matched.)
    const files = execSync('git ls-files "app/**/*.tsx" "components/**/*.tsx"', {
      cwd: ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
      .filter(f => !f.endsWith('.test.tsx') && !f.endsWith('Sheet.tsx'))

    const offenders: string[] = []
    for (const f of files) {
      const src = read(f)
      // Find each fixed overlay style block and inspect its neighbourhood.
      const re = /position:\s*'fixed'[\s\S]{0,240}?/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const window = src.slice(m.index, m.index + 260)
        const isSheet = window.includes("alignItems: 'flex-end'") && /background:\s*(visible \?\s*)?'rgba\(/.test(window)
        if (!isSheet) continue
        const z = window.match(/zIndex:\s*(\d+)/)
        if (z && Number(z[1]) < Z_LAYERS.nav) {
          offenders.push(`${f}: zIndex ${z[1]} < nav ${Z_LAYERS.nav}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
