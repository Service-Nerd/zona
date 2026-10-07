// SUPERSEDED-NOTES-01 — a step note is CACHED in plan_json, so a copy fix reaches
// new plans only.
//
// 🔴 SECOND TIME IN TWO DAYS, AND I GOT IT WRONG AGAIN IN BETWEEN. The ramp had the
// same shape (`backfillLegacyRamp`), I wrote the rule into `ui-patterns.md` —
// *"when a fix lands in the engine, ask what an existing plan will do"* — and then
// told the founder these strings "are read at render, so they'll reach your
// existing plan." Measured against the live table: **336 notes stamped, 46 stale**
// (30 "cruise set", 11 "just past threshold", 5 bare "VO2max effort.").
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { SUPERSEDED_NOTES, currentNote } from './supersededNotes'

const CATALOGUE = readFileSync(join(__dirname, 'sessionCatalogueData.ts'), 'utf8')
const NORM = (s: string) => s.replace(/[‘’]/g, "'")

describe('SUPERSEDED-NOTES-01 — a rewritten note reaches a plan that already exists', () => {
  it('every replacement is the CURRENT catalogue wording', () => {
    // Without this the map rots into a third source of copy: the catalogue says one
    // thing, new plans carry it, and old plans are repaired to something else.
    const stale = Object.entries(SUPERSEDED_NOTES).filter(([, to]) => !CATALOGUE.includes(NORM(to).replace(/'/g, "\\'")) && !CATALOGUE.includes(to))
    expect(stale.map(([, to]) => to),
      'a replacement is no longer what the catalogue says. The map repairs plans toward ' +
      'copy that does not exist any more.').toEqual([])
  })

  it('every superseded ORIGINAL is gone from the catalogue', () => {
    // The inverse: if an "old" string is still live, the map is replacing current copy.
    const live = Object.keys(SUPERSEDED_NOTES).filter(from => CATALOGUE.includes(from))
    expect(live, 'a note in the superseded map is still the catalogue’s wording — ' +
      'the map would silently rewrite a current note.').toEqual([])
  })

  it('APOSTROPHE FORM does not decide whether a runner gets the fix', () => {
    // 🔴 Four stored steps read `don't` with a STRAIGHT apostrophe while the source
    // writes it curly. The first version of the map missed all four, and I only saw
    // it by running against production rather than a fixture.
    const curly = 'Three minutes at VO2max effort. Even splits — don’t blow rep one.'
    const straight = curly.replace(/’/g, "'")
    expect(currentNote(curly)).not.toBe(curly)
    expect(currentNote(straight), 'the straight-apostrophe form of a stored note was not repaired')
      .toBe(currentNote(curly))
  })

  it('an unknown note passes through untouched', () => {
    expect(currentNote('Hold back. This is the part that makes the last third honest.'))
      .toBe('Hold back. This is the part that makes the last third honest.')
    expect(currentNote(undefined)).toBeUndefined()
  })
})
