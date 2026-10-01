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

  // S1 (Design Board 2026-09-22) — the sheet COVERS the nav.
  //
  // 🔴 THIS TEST USED TO ASSERT THE OPPOSITE RULE AND COULD NOT ENFORCE IT. It
  // read `expect(src).toContain('paddingBottom')`, which `paddingBottom: 0`
  // satisfies just as well as `paddingBottom: navH`. So the rule the reversal
  // overturned had a green tick with nothing behind it for nine days — the
  // `--section-gap` class again, found while reversing the rule it guarded.
  it('the backdrop reserves NOTHING at the bottom — the panel covers the nav', () => {
    const i = src.indexOf("position: 'fixed', inset: 0, zIndex: Z_LAYERS.sheet")
    expect(i, 'the backdrop style block').toBeGreaterThan(-1)
    const backdrop = src.slice(i, i + 600)
    expect(backdrop).toMatch(/paddingBottom:\s*0\b/)
    // The specific thing that is gone: reserving the measured nav height, which
    // left the nav visible, scrimmed at 40% ink, and wired to dismiss.
    expect(backdrop).not.toMatch(/paddingBottom:\s*`\$\{navH\}px`/)
  })

  it('but the measured nav height is still CONSUMED — by the height bound', () => {
    // It no longer positions anything. It keeps a tall sheet's own content out
    // of the home-indicator strip, which is why the context still exists.
    expect(src).toContain('useNavHeight')
    expect(src).toMatch(/maxHeight:[^\n]*\$\{navH\}px/)
  })

  it('the panel clears the home indicator itself, now that the nav does not', () => {
    // Same doctrine as A4: the safe-area inset is a reserved strip, ADDED, never
    // spent as content padding. Without this the close bar the standing rule
    // puts at the panel's bottom sits under the home bar.
    const i = src.indexOf("borderRadius: '20px 20px 0 0'")
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 700)).toContain("paddingBottom: 'env(safe-area-inset-bottom, 0px)'")
  })

  it('a sheet covers the nav; it does NOT become a screen (Silvanto, binding)', () => {
    // maxHeightVh 88 is load-bearing, not a default. A sheet whose content
    // cannot fit at 88vh is evidence the content belongs on a screen.
    expect(src).toMatch(/maxHeightVh\s*=\s*88/)
    expect(src).not.toMatch(/maxHeightVh\s*=\s*100/)
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

describe('SHEET-ARIA-LABEL-01 — a dialog cannot ship without a name', () => {
  it('🔴 the prop is REQUIRED in the type, not merely conventional', () => {
    // The compiler is the gate; this arm holds the gate shut. Re-adding the `?` is a
    // one-character edit that every existing call site survives, so nothing else would
    // notice. `ariaLabel?: string` is what this item was filed about.
    const src = read('components/shared/Sheet.tsx')
    expect(src, 'ariaLabel went back to optional — a dialog can ship unnamed again')
      .toMatch(/\n\s*ariaLabel:\s*string\n/)
    expect(src, 'ariaLabel must still reach the dialog element')
      .toMatch(/aria-label=\{ariaLabel\}/)
    expect(src, 'the dialog role must still be there — a name with no role names nothing')
      .toMatch(/role="dialog"/)
  })

  it('🔴 every call site passes a NON-EMPTY name, and the population is derived', () => {
    // ⚠️ THE MEASUREMENT CAME FIRST AND CORRECTED THE ITEM: it was filed as "four sheets
    // exist and whether each passes one is not asserted anywhere". There are ELEVEN call
    // sites, ten of them runner-reachable, and all eleven already passed a label — so the
    // copy decision the item reserved for the Design Board had already been made, well,
    // on every surface. What was missing was the compiler and this arm.
    const files = execSync("git grep -l '<Sheet' -- 'app/**/*.tsx' 'components/**/*.tsx'",
      { encoding: 'utf8', cwd: ROOT }).trim().split('\n')
      // 🔴 THE EXACT PATH, NOT A SUFFIX. `/Sheet\.tsx$/` was the first cut and it excluded
      // `HrCalibrationSheet.tsx`, `ModifyPlanSheet.tsx` and `RaceResultSheet.tsx` — three
      // real call sites — because every one of them ends in "Sheet.tsx". The check would
      // have been narrower than it claimed while reporting a derived population, which is
      // the defect class the item it belongs to was filed about. Sixth instance in this
      // session of "bound the region, never grep the name".
      .filter(f => f !== 'components/shared/Sheet.tsx' && !/\.test\./.test(f))
    expect(files.length, 'the Sheet call-site derivation collapsed').toBeGreaterThanOrEqual(8)

    // 🔴 BRACE-AWARE, BECAUSE `[^>]*` STOPS AT THE `>` IN `=>`. The first cut read the
    // props as `/<Sheet\b([^>]*)>/` and reported `DashboardClient:5610` as having no
    // ariaLabel. It has one — but `onClose={() => setLoadSheetOpen(false)}` comes first,
    // so the prop slice ended four characters in. It failed in the safe direction here
    // and that is luck, not design: the slice was simply not the props.
    const propsOf = (src: string, at: number): string => {
      let i = at, depth = 0
      for (; i < src.length; i++) {
        const c = src[i]
        if (c === '{') depth++
        else if (c === '}') depth--
        else if (c === '>' && depth === 0 && src[i - 1] !== '=') break
      }
      return src.slice(at, i)
    }

    const offenders: string[] = []
    let sites = 0
    for (const f of files) {
      const src = read(f)
      for (const m of Array.from(src.matchAll(/<Sheet\b/g))) {
        sites++
        const props = propsOf(src, m.index! + m[0].length)
        const lit = /ariaLabel="([^"]*)"/.exec(props)
        const expr = /ariaLabel=\{([^}]*)\}/.exec(props)
        const line = src.slice(0, m.index!).split('\n').length
        if (!lit && !expr) { offenders.push(`${f}:${line} — <Sheet> with no ariaLabel`); continue }
        // An empty string satisfies the compiler and names nothing: `aria-label=""` is
        // exactly as useless to a screen reader as no attribute, and tsc cannot see it.
        if (lit && lit[1]!.trim() === '') offenders.push(`${f}:${line} — ariaLabel="" names nothing`)
        if (expr && expr[1]!.trim() === "''") offenders.push(`${f}:${line} — ariaLabel={''} names nothing`)
      }
    }
    expect(sites, 'no <Sheet> call sites found at all — the regex stopped matching')
      .toBeGreaterThanOrEqual(10)
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

describe('no below-nav bottom-sheet overlay exists anywhere in the UI', () => {
  it('every flex-end fixed overlay with a scrim sits on the sheet/guide layer', () => {
    // The sheet signature: a full-viewport fixed overlay, bottom-anchored, with
    // an rgba scrim. Scan the whole UI tree and assert none carries a z-index
    // below the nav. (Charts, rulers and the marketing frame use flex-end for
    // layout but have no fixed scrim, so they are not matched.)
    // GATE-GLOB-SHORT-01 — see the note on the other four gates that shared this glob.
    const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      // ⚠️ THE PATH FILTER IS NOT OPTIONAL. Dropping the pathspec without re-adding it
      // made this scan the WHOLE REPO and fail instantly on a non-UI file — caught in
      // seconds, and a good reminder that "widen the population" and "remove the bound"
      // are different operations.
      .filter(f => /^(app|components)\/.*\.tsx$/.test(f))
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
