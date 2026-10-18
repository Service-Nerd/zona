# ADR-025 — Same-day sessions: AM / PM slots (ACCEPTED, built 2026-10-17)

**Status:** PROPOSED 2026-10-17; all four phases built 2026-10-17 (Coaching Board §126, SLT FREE, Design Board SHIP WITH AMENDMENT). Live since 2026-10-18 (migration applied and verified; deployed). **Item:** `SESSION-SLOTS-01`.
**Founder, verbatim:** *"we should have an AM and PM slot per day so we can have a run and weight session on the same
day or actually double runs if someone chose to move a run to double up a day. Realise that one requires full impact
analysis and a proper architect plan and review."*

## 1. The finding that shapes everything

Measured from the code (inventory 2026-10-17: 57 non-test files index `week.sessions` by day; 5 database unique keys
on `(week_n, session_day)` or `(session_date)`):

- **The plan has one session per day by TYPE**: `Week.sessions: Partial<Record<DayKey, Session>>` (`types/plan.ts:369`),
  `Session.id = 'w{N}-{day}'`, the Zod schema, and the engine's exclusive day allocation.
- 🔑 **But storage is keyed by where a session is DEFINED, not where it is SHOWN.** Completions, run analysis,
  reflections and metric overrides all key on `originalDay` (`lib/plan/effectiveSessions.ts:15`: *"the completion
  key"*). A run moved from Tuesday onto Wednesday keeps the key `tue` in every table.
- **So a double created by a MOVE does not collide in storage.** It collides in exactly one place: the effective-week
  resolver (`resolveEffectiveSessions`), whose collision guard turns "move onto an occupied day" into a **swap** by
  design (EFFSESS-COLLISION-01), and in everything downstream that reads one session per displayed day.
- **Run + strength on one day already exists** (strength is its own engine and store, ADR-024; Today and Plan draw it
  beside the run). What is missing there is only the **AM / PM label**, which S4 already decides: strength is after
  the run.

## 2. Options

| | Option | Cost | Verdict |
|---|---|---|---|
| A | **Slot-qualified keys in the plan** (`'wed'` and `'wed:pm'`) | Every `DAY_KEYS` loop silently ignores the PM slot; plan JSON changes shape (D-03) | Keep for later: needed only if the ENGINE ever prescribes doubles |
| B | **`Week.sessions` becomes an array** of `{ day, slot, session }` | Breaks all 57 files and every stored plan in one go | Rejected: a big bang with no protecting type error at each site |
| **C** | **Doubles come only from the runner's move; the plan JSON is unchanged.** `session_overrides` gains a slot; the effective week becomes `Record<DayKey, EffectiveSession[]>` | One additive column; one owner changes type; consumers move behind it | ✅ **Recommended** |

**Why C:** it matches the founder's case (a runner moves a run to double up a day), it needs no plan-JSON version, no
engine change and no completion migration (§1), and changing the owner's RETURN TYPE turns every consumer into a
compile error, so no consumer can silently read "one session" after the change. Option A stays available if the
engine ever prescribes doubles (that is a Coaching Board question, not this ADR).

## 3. Data contract (Option C)

- **`session_overrides.new_slot text null check (new_slot in ('am','pm'))`.** Null = the day's only session (today's
  meaning). Additive migration; existing rows unchanged. **Add the missing unique key** `(user_id, week_n,
  original_day) WHERE superseded_at IS NULL`: one-row-per-original-day is a convention today, enforced only by a
  client delete-then-insert.
- **One owner, new shape:** `resolveEffectiveDay(week, overrides): Record<DayKey, EffectiveSession[]>`, ordered AM
  then PM. A move onto an occupied day with `new_slot` set lands as a double instead of a swap. Without a slot,
  today's swap behaviour is unchanged. `resolveEffectiveSessions` is **removed**, not kept beside it (D-08).
- **`getSessionsForDate(weeks, date, overrides): ResolvedSession[]`** replaces `getSessionForDate` (one owner, ADR-016
  semantics: `[]` before-start / after-end / gap / empty).
- **`EffectiveSession.slot: 'am' | 'pm' | null`.**
- **Unchanged:** plan JSON, `Session.id`, `session_completions` and every other `(week_n, session_day)` key (they key
  on `originalDay`), `strength_completions`.
- **Strength:** no data change. `RunContext.RunDay.role` takes the HARDEST role of the day's runs (race > long >
  quality > easy), so heavy-leg placement still sees a quality PM after an easy AM. Strength's label is `pm` on a run
  day (S4: after the run).

## 4. Consumers that must move behind the owner (from the inventory; each is a compile error after §3)

| Layer | Sites | What changes |
|---|---|---|
| Effective week | `effectiveSessions.ts` + **2 hand-rolled copies** (`TodayScreen.tsx:844-854`, `PlanCalendar.tsx:451-463`) with bare overwrites | The copies are deleted first (Phase 0); they already drop a session on a collision |
| Date resolution | `getSessionForDate` callers: push `send-daily:250`, `pre-session-readiness:72`, `runContext.ts:65` | Arrays; push names both sessions; readiness targets the hard one |
| Auto-match | `autoAnalyse.ts:133-138` first-match-and-break, `sessionAutoMatch.ts` dates by original day | Assign the day's activities to the day's sessions in start-time order (AM activity to AM slot) |
| Today | hero, `DateStrip` (one dot), RPE nudges | Two sessions on one day (Design Board) |
| Plan | `DayRow` one row per day, move/swap flow | A day holds two rows; moving onto a taken day offers **Swap** or **Do both (AM / PM)** (Design Board) |
| Coach / weekly report | counts by `Object.entries(sessions)` | Unchanged in count (sessions are not added, only moved); recheck "due to date" |
| Daily note, widget | one `todaySession` | Two sessions, or the next one |
| Adjust / reshape | 7-length positional arrays (`planAdjustment`, `applyAdjustmentDays`) | **Untouched**: they edit the stored plan, which has no doubles. The reorder check gains a "not into a double" guard |

## 5. Rules — RULED 2026-10-17 (Coaching Board, CORRECT WITH AMENDMENT)

**The ruling** (`docs/decisions/same-day-doubles-coaching-2026-10-17.md`): both runs easy or recovery; never the long
run, quality/structured, race or 5K TT; no double in race week; advise ≥6 h apart (advice only); over the weekday cap
allowed with a note; no strength on a two-run day; copy says eat between, never "extra training". The questions as
first put, kept for the record:

1. **Which doubles are allowed?** Proposed: easy + easy, easy + recovery. **Never** a double containing the long run
   or a quality session (§7's 48 h between stressors cannot hold inside one day).
2. **Minimum gap between the two runs** (S4 uses ≥3 h / ideally 6 h for strength; a run double needs its own number).
3. **Weekday time limit** (`max_weekday_mins`, §81): two sessions on a capped weekday may exceed the day budget. Warn,
   or refuse?
4. **§64 rest days:** moving a run off a day frees it; a week can gain a rest day. Fine, but stated.
5. New invariant on the **effective** week (overrides applied), not only the stored plan: `INV-EFFECTIVE-NO-HARD-DOUBLE`.

## 6. Phasing (each phase ships alone; nothing visible until Phase 3)

| Phase | What | Gate |
|---|---|---|
| **0. Prerequisites** ✅ *done 2026-10-17* | Delete the two hand-rolled effective maps (route through the owner) · fix three pre-existing defects: readiness ignores overrides, `handleMove`'s delete differs from its client filter, auto-match dates a moved session by its original day | `verify:parity` IDENTICAL; each defect gets a fail-before test |
| **1. Owner + data** ✅ *code done 2026-10-17; migration applied 2026-10-18, verified in production* | Migration (`new_slot` + unique key), `resolveEffectiveDay` / `getSessionsForDate`, every consumer compiles against arrays with **single-session behaviour** | No visible change; journey test unchanged |
| **2. Rules** ✅ *built 2026-10-17 (engine side, unreachable until Phase 3 writes `new_slot`)* | Coaching Board ruling (§5) → principle + numeric + invariant | Board ruling recorded |
| **3. UI** ✅ *built 2026-10-17* | Design Board: Today two-session day, Plan two rows, the Swap / Do both choice, AM/PM labels. Strength's label stays unchanged (no strength on a two-run day) | Pattern + check + register row; 375px |
| **4. Consumers** ✅ *built 2026-10-17* | Auto-match (both sessions AM first; a done half is skipped, since the server holds UTC start times, not a local time of day), push copy (`doubleAdvice()`), daily note (`todayDouble`), readiness (the hard session, else the first), missed-session prompt (first open session). **Widget keeps `soleSession`** (native struct, one session: shows AM) | Each consumer: a test with a double day (`doubleConsumers.test.ts`, `autoAnalyse.test.ts`) |

## 7. Architect review (zona-architectural-principles)

- **D-08 / D-16 (one owner):** passes only after Phase 0. Two hand-rolled effective maps exist today and both fail
  the collision case the owner was fixed for. They are deleted, not adapted.
- **D-03 (versioned behaviour):** passes. The plan JSON shape does not change.
- **INV-PLAN-001 (plan JSON is the source of session definitions):** passes. A double is an override, not a new
  session.
- **INV-TIME-001 / ADR-016:** the owner changes from "the session" to "the sessions"; `[]` keeps the no-send meaning.
- **M-009 (migrations):** one additive migration; ledger entry.
- **M-011 / GOV-006 (contracts first):** `docs/contracts/api/session-overrides.md` and the effective-week contract
  are written before Phase 1 code.
- **D-20 (tier):** moving a session is FREE today. Whether doubling is FREE or PAID is an SLT call.
- **N-004 (no modals):** the Swap / Do both choice must be inline (the existing move-target UI), not a popup.

## 8. Risks

| Risk | Mitigation |
|---|---|
| A consumer keeps reading one session and silently drops the PM one | The owner's return type changes, so every consumer fails to compile until it handles an array |
| Auto-match links the PM activity to the AM session | Order by activity start time; a test with two runs on one date |
| Two hard sessions in one day slip through | Phase 2 invariant on the EFFECTIVE week; the move UI only offers doubles the rule allows |
| Strength places heavy legs before a hard PM run | RunDay role = the hardest of the day's runs (§3) |
| Scope creep to engine-prescribed doubles | Out of scope; Option A, and a separate Coaching Board question |

## 9. What this ADR does not settle
Whether doubles are FREE or PAID (SLT); which doubles are coaching-correct (Coaching Board); how a two-session day looks
on Today and Plan (Design Board); and engine-prescribed doubles, which this deliberately does not enable.
