import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P-10 / GAP-04 — the web runner had no route, and was told to take one.
 *
 * Coach's `no-source` state said *"Connect Apple Health or Strava"* to EVERY
 * user and offered a "Connect a source" button. On web both halves are false:
 * Apple Health is an iOS-only Capacitor plugin, and both `CONNECT-FIRST` and
 * `CONNECT-01` `return` early off-native, so the button was never rendered and
 * the instruction had nothing behind it.
 */
const DASH = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
const HOOK = readFileSync(join(process.cwd(), 'lib/useIsNative.ts'), 'utf8')

describe('P-10 — the no-source copy tells the truth per platform', () => {
  it('reads the real files', () => {
    expect(DASH).toContain('Nothing to coach from yet.')
    expect(HOOK).toContain('export function useIsNative')
  })

  it('the web sentence does not instruct an impossible action', () => {
    expect(DASH).toContain('Your runs come from Apple Health, which needs the iOS app.')
  })

  it('⚠️ the web sentence does not name Strava', () => {
    // The Strava application is Inactive at Strava's end
    // (STRAVA-APP-INACTIVE-01, founder action), so naming it as a web route
    // would be the SECOND false instruction on the same screen.
    const block = DASH.slice(DASH.indexOf('Nothing to coach from yet.'), DASH.indexOf('Waiting on your first run.'))
    const webLine = block.split('\n').find(l => l.includes('needs the iOS app')) ?? ''
    expect(webLine).not.toMatch(/strava/i)
  })

  it('the CTA is withheld on web, not just relabelled', () => {
    // A button that cannot work is worse than no button.
    expect(DASH).toContain('emptyCta      = isNative && onConnect')
  })

  it('the WEB sentence is the safe default for the first frame', () => {
    // `useIsNative` starts false, so native renders as web for one frame. An
    // iOS runner briefly seeing the app mentioned is harmless; the reverse
    // would hide the only route from the person who actually has it.
    expect(HOOK).toContain('useState(false)')
    expect(HOOK).toContain('IT STARTS `false` AND THAT IS DELIBERATE')
    expect(DASH).toContain('THE FLASH RULE') // restated where the copy is chosen
  })
})

describe('P-10 — the platform flag has one owner, and says which one', () => {
  it('no component keeps its own render-time platform useState', () => {
    // Two did. A third was about to be written for this item.
    const copies = DASH.split('const [isNative, setIsNative] = useState(false)').length - 1
    expect(copies, 'only the platform-GATED FETCH may keep its own; render flags use the hook').toBe(1)
  })

  it('the hook does not overclaim what it owns', () => {
    // "Single owner of the flag" is not "single owner of the sequence". The
    // remaining site is a Supabase-reading effect that uses the platform check
    // as an early exit; routing it through the hook would change behaviour to
    // satisfy a tidiness claim.
    expect(HOOK).toContain('SINGLE OWNER OF THE RENDERING FLAG')
    expect(HOOK).toContain('ONE SITE DELIBERATELY DOES NOT USE THIS')
  })
})
