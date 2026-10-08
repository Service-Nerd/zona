// ADJUST-ENGINE-DEAD-01 — the single owner of "a week as seven ordered day-slots".
//
// 🔴 WHY THIS FILE EXISTS. For three and a half months — 2026-06-26 to 2026-10-08 —
// `checkAdjustmentTriggers` threw on **every real plan**, so the adaptive engine produced
// nothing at all. Measured: **31 of 31 live plans, 100%.**
//
//   checkAdjustmentTriggers: currentWeekSessions[0] (mon) is not a valid session object
//   days-with-a-session in week 1:  1×1 · 2×2 · 3×13 · 4×10 · 5×2 · 6×3
//
// **No real plan carries seven days of sessions.** `Week.sessions` is
// `Partial<Record<Day, Session>>` — the TYPE has always said a day is optional — and
// `generateRulePlan` simply omits a rest day's key.
//
// 🥇 BOTH HALVES OF THE DEFECT CAME FROM ONE COMMIT, `a2673172`, titled *"RESHAPE-FIX-WAVE1
// — correctness foundation"*, and each is documented as if the other behaved differently:
//
//   route.ts:271          `DAY_ORDER.map(d => week.sessions[d] ?? null)`, commented
//                         "a null sentinel preserves the slot … so the length-7 invariant
//                          in checkAdjustmentTriggers can assert structure"
//   planAdjustment.ts:194 throws on any null slot, commented
//                         "rest days are stored as {type:'rest', …} not null"
//
// **One side sends the sentinel; the other treats the sentinel as the failure.** Neither
// comment is wrong about itself. Nobody compared them. The last `plan_adjustments` row in
// production is dated **three days** after that commit.
//
// ⚠️ IT WAS DOUBLE-SILENT, which is why it survived: the route 500s BEFORE
// `recordAdjustmentCheck` (so `last_adjustment_check_at` is NEVER for 42 of 44 users), and
// every client caller is `void authedFetch(...)` with no `res.ok` — the unchecked-response
// class. The PAID gate then hid what was left: a free runner 403s before reaching the throw.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 THE FIX IS AT THE BOUNDARY, AND DOCTRINE IS WHY, NOT CONVENIENCE.
//
// §64 as amended by **GEN-FIX-09 (2026-08-06)**: *"a rest day is the absence of a session,
// not a session"* — and it names **two equally valid representations**:
//
//   1. an explicit `type: 'rest'` entry (the maintenance block emits these deliberately,
//      because there the rest day is a PRESCRIPTION, not a gap)
//   2. fewer than seven training days in the week (how `generateRulePlan` always worked)
//
// Converting (2) into (1) is therefore **lossless and sanctioned**, which is what makes
// this the right seam. The engine's assertion is CORRECT and stays: `{...null}` is `{}` in
// JavaScript, so a null slot would flow through all eleven `sessions.map(s => ({...s}))`
// consumers as a typeless empty object and corrupt a reshape silently. **The assertion was
// protecting against exactly that. The caller was the bug.**
//
// ⚠️ AND §64's OWN HISTORY IS THIS DEFECT POINTING THE OTHER WAY. `weekHasRestDay` once
// accepted only representation (1), so *"every generated plan failed this invariant once
// per non-season week — invisible because validatePlan throws in dev/test but logs in
// production. **The engine was right; the rule was wrong.**"* Same two representations,
// same asymmetry, same silence, recorded two months before this one and never carried
// across. → the `REMEDY APPLIED TO ONE TWIN` class.
import type { Day } from './days'
import { DAY_ORDER } from './days'
import type { Session, Week } from '@/types/plan'

/**
 * A rest day that means **"nothing is prescribed here"**.
 *
 * ⚠️ DELIBERATELY NOT the same object as `lib/plan/maintenance.ts`'s rest day, which
 * carries `detail: 'Rest day.'` because in a maintenance block the rest IS the
 * prescription (§64 representation 1, used as intended). This one fills a GAP, and a gap
 * has no copy to show the runner. Two meanings, two objects, one of them owned here.
 */
export function restSession(): Session {
  return { type: 'rest', label: 'Rest', detail: null } as unknown as Session
}

/** True when this slot is a rest day under EITHER §64 representation. */
export function isRestSlot(s: Session | null | undefined): boolean {
  return s == null || (s as { type?: string }).type === 'rest'
}

/**
 * A week's sessions as exactly seven entries, **mon=0 … sun=6**, every slot a real
 * `Session` object. An absent day becomes `restSession()`.
 *
 * This is the only correct input for `checkAdjustmentTriggers`, which asserts seven
 * non-null slots, and the only correct input for anything else indexing a week by day
 * position. **Never hand-roll `DAY_ORDER.map(d => week.sessions[d] ?? null)` again** — that
 * expression is what killed the engine, and by the time it was found there were already
 * two copies of it.
 */
export function orderedWeekSessions(week: Pick<Week, 'sessions'>): Session[] {
  const sessions = (week?.sessions ?? {}) as Partial<Record<Day, Session>>
  return DAY_ORDER.map(d => sessions[d] ?? restSession())
}
