import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HEART_RATE_TITLE, HEART_RATE_SUB, PLAN_ADJUSTMENTS_TITLE } from './meDoors'
import { PREFERENCES_TITLE } from './PreferencesScreen'

// ME-DOORS-01 — 🔴 A DOOR MUST NOT RESTATE ITS OWN TITLE INSIDE ITSELF.
//
// Found by the founder's question "have we verified?", not by a test, and it was in TWO of
// the three doors:
//
//   • `Plan adjustments` — a VERBATIM `<SectionLabel>Plan adjustments</SectionLabel>` under
//     a `ScreenHeader` reading `Plan adjustments`.
//   • `Heart rate` — `HRZonesSection`'s own card header, `Heart rate zones`, under a
//     `ScreenHeader` reading `Heart rate`.
//
// ⚠️ NEITHER WAS A MISTAKE WHEN IT WAS WRITTEN. The HR card's comment said *"parallels Race
// benchmark row: title + sublabel framing"* — correct while the card sat among other cards
// on an index. **A relocation can make correct code wrong without touching it**, which is
// why a move needs its own check and not just a passing suite.
//
// 🔴 AND IT IS THE DENSITY THE RULING EXISTS TO REMOVE. `ME-PURPOSE-01`'s whole argument is
// that Me made the runner sort things; a screen that says its name twice has done it again,
// one level down.
//
// This arm is the CLASS, not the two instances: it derives the doors from the source.

const SRC = () => readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')

/** Each `activeSection` door's body, bounded — the early return only, never the file. */
const doors = (): { name: string; body: string }[] => {
  const src = SRC()
  const out: { name: string; body: string }[] = []
  // ⚠️ BOTH RETURN FORMS. The four pre-existing doors return a COMPONENT on one line with
  // padded alignment (`'quit')           return <QuitTab …`); the three added here return a
  // fragment. A regex that only matched `return (` found 3 of 7 and the population arm
  // caught it — which is the only reason this gate is not measuring half the doors.
  const re = /if \(activeSection === '([a-z-]+)'\)\s+return /g
  const starts: { name: string; at: number }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) starts.push({ name: m[1], at: m.index })
  expect(starts.length, 'no activeSection doors found — re-anchor this gate').toBeGreaterThanOrEqual(7)
  const anchor = src.indexOf('const hasPlan = !!(plan?.meta?.race_name)')
  expect(anchor, 'the index anchor moved').toBeGreaterThan(-1)
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].at : anchor
    out.push({ name: starts[i].name, body: src.slice(starts[i].at, end) })
  }
  return out
}

/** The doors this ship owns, and the title each one's ScreenHeader shows. */
const TITLED: Record<string, string> = {
  'preferences': PREFERENCES_TITLE,
  'heart-rate': HEART_RATE_TITLE,
  'plan-adjustments': PLAN_ADJUSTMENTS_TITLE,
}

describe('ME-DOORS-01 — a door says its name once', () => {
  it('finds every door, and the three this ship owns among them', () => {
    const names = doors().map(d => d.name)
    for (const k of Object.keys(TITLED)) expect(names, `door ${k} is missing`).toContain(k)
  })

  it('🔴 no door repeats its own title in its body', () => {
    const offenders: string[] = []
    for (const { name, body } of doors()) {
      const title = TITLED[name]
      if (!title) continue
      // Strip the ScreenHeader line itself — that is where the title BELONGS — and comments,
      // which explain the rule and would otherwise trip it.
      const inner = body
        .split('\n')
        .filter(l => !l.includes('ScreenHeader'))
        .filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('{/*'))
        .join('\n')
      if (inner.includes(`>${title}<`) || inner.includes(`>${title} `)) {
        offenders.push(`${name}: repeats "${title}" inside its own screen`)
      }
    }
    expect(offenders, 'a door restates its own title:\n' + offenders.join('\n')).toEqual([])
  })

  // ⚠️ THE SUBLABEL WAS RELOCATED, NOT DELETED. Removing a duplicate title is right;
  // removing the sentence that explained the screen would be a silent copy cut hiding
  // inside a layout fix.
  it('the HR sublabel survived the header it lived in', () => {
    expect(HEART_RATE_SUB).toContain('Training zones set from your resting and max HR')
    expect(SRC(), 'the door does not carry the relocated sublabel').toContain('HEART_RATE_SUB')
    expect(SRC(), 'the old card header came back').not.toContain('>Heart rate zones<')
  })
})
