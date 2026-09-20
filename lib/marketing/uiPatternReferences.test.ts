import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P-10 — every `Reference:` in `ui-patterns.md` points at a file that exists.
 *
 * WHY. `RestraintCard` was deleted with zero render sites, and this document
 * still said **"Reference: `components/shared/RestraintCard.tsx`"**. It had
 * been unreachable since ZONE-VIS-02 superseded it in May 2026, so the
 * reference was already pointing at a component nobody rendered; deleting the
 * file would have turned a stale pointer into a broken one.
 *
 * ⚠️ A DESIGN SYSTEM'S REFERENCES ARE LOAD-BEARING. `ui-patterns.md` is the
 * authority the `frontend-design` skill reads before any UI work, and a
 * pattern that names a file which does not exist sends the next build looking
 * for a precedent it cannot find — or worse, recreating one. This repo already
 * records a design handoff whose component list was **44% fiction**.
 */
const DOC = readFileSync(join(process.cwd(), 'docs/canonical/ui-patterns.md'), 'utf8')

describe('P-10 — ui-patterns.md references resolve', () => {
  const refs = Array.from(DOC.matchAll(/`((?:components|app|lib)\/[^`]+\.tsx?)`/g)).map(m => m[1])

  it('finds references at all, so the sweep cannot pass by matching nothing', () => {
    expect(refs.length).toBeGreaterThan(15)
  })

  it('every referenced source file exists', () => {
    const missing = Array.from(new Set(refs)).filter(r => !existsSync(join(process.cwd(), r)))
    expect(
      missing,
      'ui-patterns.md points at a file that does not exist. Either the component moved and the doc '
      + 'did not, or it was deleted and the pattern needs the treatment RestraintCard got: say the '
      + 'component is gone, say where the anatomy still lives, and keep the section.',
    ).toEqual([])
  })

  it('RestraintCard specifically is recorded as deleted, not silently dropped', () => {
    // Its anatomy is still cited by ZoneWeekBlock's locked state (P-04), so
    // removing the section would lose a live precedent.
    expect(DOC).toContain('### 11. RestraintCard')
    expect(DOC).toContain('THE COMPONENT IS DELETED')
    expect(existsSync(join(process.cwd(), 'components/shared/RestraintCard.tsx'))).toBe(false)
  })
})
