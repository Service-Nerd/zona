// LOG-OFFPLAN-02 + LOG-ONE-INTENTION-01 — one way to say "I ran" (2026-09-27).
//
// Founder, on his own device: *"We have a Log manually CTA. Do we actually need
// that? … It doesn't make that clear."* Collins had filed the same thing in
// September: *"'Match a run' and 'Log manually' are the same intention — I did
// this run — differing only in whether we can find the data."*
//
// ⚠️ THE ARMS HERE PROTECT TWO DIFFERENT KINDS OF THING and both matter:
//   • a CORRECTNESS property — an off-plan run must never write a completion;
//   • a VOCABULARY property — one intention, one verb, one button.
// The first is silent if it breaks (a phantom completion looks exactly like a
// real one). The second is loud but keeps coming back.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { resolveAutoMatch, sessionDateFor } from './sessionAutoMatch'

const ROOT = path.resolve(__dirname, '../..')
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')
const DASH = strip(fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8'))

describe('LOG-OFFPLAN-02 — an off-plan run writes the activity log and NOTHING else', () => {
  it('🔴 the off-plan branch never writes a completion or a score', () => {
    // 🔴 THE SILENT FAILURE THIS HOLDS SHUT. `session_completions` is keyed
    // `(user_id, week_n, session_day)` and the save path resolves
    // `sessionKey ?? todayKey`, so a completion written from an off-plan log
    // would mark a PRESCRIBED session done because the runner went for an extra
    // run — or invent one on a rest day. A phantom completion is invisible: it
    // looks exactly like a real one to every consumer.
    const i = DASH.indexOf('if (offPlan) {')
    expect(i, 'the off-plan branch is gone').toBeGreaterThan(-1)
    const branch = DASH.slice(i, DASH.indexOf('if (accumulate) {', i))
    expect(branch).toContain('/api/health/ingest')
    expect(branch, 'an off-plan run has no session to complete').not.toContain('upsertCompletion')
    expect(branch, 'an off-plan run has no prescription to be scored against')
      .not.toContain('/api/analyse-run')
  })

  it('🔴 it AWAITS the ingest — here the ingest IS the record', () => {
    // On the session path the completion is durable and the ingest supplements
    // it, so fire-and-forget loses enrichment. Here a dropped call loses the run
    // and looks identical to never having logged it.
    const i = DASH.indexOf('if (offPlan) {')
    const branch = DASH.slice(i, DASH.indexOf('if (accumulate) {', i))
    expect(branch).toMatch(/const res = await authedFetch\('\/api\/health\/ingest'/)
    expect(branch, 'a failed ingest must not report success').toContain('if (!res.ok)')
  })

  it('🔴 its manualUuid is unique per RUN, not deterministic per session', () => {
    // The session path uses `manual-w{n}-{day}` deliberately, so a re-log
    // upserts the same row. Reusing that here would make a second off-plan run
    // on the same day silently overwrite the first.
    const i = DASH.indexOf('if (offPlan) {')
    const branch = DASH.slice(i, DASH.indexOf('if (accumulate) {', i))
    expect(branch).toMatch(/manual-offplan-\$\{Date\.now\(\)\}/)
  })

  it('🔴 a rest day has a log control at all — it had none', () => {
    // `showSessionHero = isRunDay || isStrengthDay`, so the whole session block
    // never rendered on a rest day: 4 of 7 days on a 3-day plan.
    expect(DASH).toMatch(/onLogRun=\{\(\) => setShowOffPlanLog\(true\)\}/)
    expect(DASH, 'the modal must be opened in off-plan mode').toMatch(/showOffPlanLog && \(/)
    const modal = DASH.slice(DASH.indexOf('{showOffPlanLog && ('), DASH.indexOf('{showOffPlanLog && (') + 420)
    expect(modal, 'off-plan mode must be on').toMatch(/\boffPlan\b/)
    expect(modal, 'an off-plan run has no session key').toMatch(/sessionKey=\{null\}/)
  })

  it('"a run" on a rest day, never "this run" — there is no session to point at', () => {
    expect(DASH).toContain('Log a run')
  })
})

describe('LOG-ONE-INTENTION-01 — one intention, one verb, one button', () => {
  it('🔴 no live "Log manually" string survives anywhere', () => {
    expect(DASH, '"manually" names OUR plumbing, not the runner\'s act')
      .not.toContain('Log manually')
  })

  it('🔴 "Match a run" is gone — it was the same intention wearing another name', () => {
    expect(DASH).not.toContain('Match a run')
  })

  it('🔴 Today offers ONE log button, and it is "Log this run"', () => {
    expect(DASH).toContain('Log this run')
    expect(DASH, '"session" is the engine\'s noun; the runner ran')
      .not.toContain('Log this session')
  })

  it('🔴 the no-match path goes STRAIGHT to manual entry — the tap count cannot get worse', () => {
    // The condition the whole collapse turned on. A "we could not find a run"
    // screen would tax the runner whose runs never reach HealthKit (ADR-011 §5)
    // for OUR failure to find them.
    const i = DASH.indexOf('if (todayAutoMatch) {')
    expect(i, 'Today stopped branching on the match').toBeGreaterThan(-1)
    const handler = DASH.slice(i, i + 700)
    expect(handler, 'no match must open manual entry directly').toContain('setShowManualLog(true)')
  })

  it('🔴 manual entry is still REACHABLE from the picker — it moved, it was not deleted', () => {
    expect(DASH).toContain('Enter it manually')
  })

  it('🔴 ONE owner answers "which run is this" — no parallel classifier', () => {
    // The twelve lines were about to be copied into TodayScreen. The tier order
    // written three times, the deload cadence in five places, `sumWeeklyKm` by
    // hand in six — this repo's most expensive duplication class.
    const calls = (DASH.match(/findMatchCandidates/g) ?? []).length
    expect(calls, 'findMatchCandidates belongs to sessionAutoMatch.ts alone').toBe(0)
    expect((DASH.match(/resolveAutoMatch\(/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('resolveAutoMatch — the owner', () => {
  it('🔴 returns null for "we do not know", never throws', () => {
    expect(resolveAutoMatch(null, '2026-09-21', 'mon', [])).toBeNull()
    expect(resolveAutoMatch({}, undefined, 'mon', [{}])).toBeNull()
    expect(resolveAutoMatch({}, '2026-09-21', undefined, [{}])).toBeNull()
    expect(resolveAutoMatch({}, '2026-09-21', 'mon', [])).toBeNull()
  })

  it('offsets the session date by its day key', () => {
    expect(sessionDateFor('2026-09-21', 'mon')!.getDate()).toBe(21)
    expect(sessionDateFor('2026-09-21', 'sun')!.getDate()).toBe(27)
    expect(sessionDateFor('', 'mon')).toBeNull()
  })
})
