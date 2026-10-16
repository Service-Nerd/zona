# Design Board — STRENGTH-ENGINE-01 Phase 2: strength across the whole app (2026-10-16)

**Trigger:** a new screen (strength session), a new Me door + sub-page, and a new pattern (a second session on
a day) — hard. **Tier:** PAID, admin-only until release. **Brief (founder, verbatim):** *"consider the big picture
and overall user experience not just isolated to the strength piece… They need to gel, not contradict and not
say the same thing twice. We don't want clutter for clutter sake and look towards a slick interface."*

## 🔍 Settled-ground scan
Touched, none reversed: **Me is an index** (`ME-PURPOSE-01`: a door is allowed, nothing inline) · **type accent, not
flood** · **one job per screen** · **S3 one CTA vocabulary** · **7a Today's primary action does not dock** · **13a a
pushed screen pins its header** · **the 44px tap floor** (`TAP-TARGET-DECISIONS-01`) · **three micro-labels only** ·
**ICON-RULE-01** (no new icons) · `--s-strength` already a token. No prior ruling on a second session in a day.

## 📐 Evidence (code, measured 2026-10-16)
- One session per day key everywhere: Today `sessions` (TodayScreen:813), DateStrip one dot, PlanCalendar `DayRow`.
- Contradictions a bolt-on would ship: the rest hero *"Do nothing. It helps."* (TodayScreen:1344), the TD-CLOSE "Rest
  day" card, the daily push rest line (`voiceLines.ts:23`), the daily-note prompt — all on a strength day.
- The legacy run-engine `type:'strength'` session renders through the run path, *"Log this run"* (TodayScreen:916):
  **1 of 36 live plans, all in past weeks**, so no overlap with the new engine.
- `SessionScreen` / `SessionPopupInner` are run-shaped (zone card, pace, auto-match, run feedback, skip reasons).
- ⚠️ Not measured: nothing has been seen on a device.

## Seats
**🧭 Zhuo.** Success, stated first: **(1)** no surface says rest on a day that holds a strength session; **(2)** no
strength fact appears twice on one screen; **(3)** Today → first exercise in one tap. D is a **new screen**, not a
variant: a variant is a branch in every run block (zone, pace, auto-match), which is two products in one file. It
mirrors the anatomy and shares the primitives, so it reads as the same app.

**✋ Silvanto.** On a run day the run is the decision; strength is visibly second: a compact row, no hero, no zone,
no "Hold the zone" eyebrow. On a strength-only day the hero is earned, and it should use the hero the app already
has: duration in ink, the adverb in moss. The code already carries the adverb *"with weights"*; reuse it. No media
placeholder: an empty animation box is a broken promise on every row. **No veto**: one existing token, no new size.

**🎓 Sierra.** E's own argument kills more than per-set logging: **an RPE nobody reads is decorative too**, and asking
a question the app ignores teaches the runner it does not listen. Log done or skipped, one tap, and ask for effort
when Phase 4 reads it. The cue-on-tap is the part that makes them better at lifting; keep it one tap deep. "In
reserve" is jargon to most runners; the words are the founder's, but say it plainly.

**📱 Wroblewski.** Setup is seven questions; order them by weight (focus, how often, how long, kit, experience,
days off, bone health) and default the last three so most runners answer four. One CTA. On the session screen the
actions sit at the end of the content, as on a run, not docked (7a). Skip is one tap with an Undo, not a reasons
sheet: there is no strength skip reason anything reads. The Today row must clear the 64px session-card floor.

**🎪 Collins.** Taxonomy: four kinds, and the engine really does make four, so keep them, but the titles must not say
"+ core": core is in nearly every session, and printing it on every one is saying the same thing four times. Titles:
**Full body · Lower body · Upper body · Mobility.** On the Plan week I wanted the day rail **split in two colours**,
run and strength, readable at a glance with no words. **Lost**: Wroblewski: a 34px rail split into 17px halves is
not legible, and colour alone fails colour-blind runners. The text mark stands.

## ⚡ Recorded disagreements
- **Collins vs Wroblewski/Silvanto — split rail on the Plan day row.** Collins lost. What would move the room: a device
  test showing the split rail legible at arm's length and paired with a non-colour cue.

## ⛔ Veto check
None. No palette or type regression: `--s-strength` exists; sizes come from the frozen app set.

## ⚖️ Ruling: SHIP WITH AMENDMENT
| | Ruled |
|---|---|
| **A Today** | Run day: the run stays the hero; strength is ONE compact row beneath today's session (session-card pattern, `--s-strength` rail, no zone), with the after-run gap said once, on that row. Strength-only day: the hero becomes the strength session (duration ink + *"with weights."* moss); the rest hero, the TD-CLOSE rest card and the RestDayCard do not render. |
| **A′ Push + daily note** | Same rule: a strength-only day never gets the rest line; the daily-note prompt is told there is strength today. |
| **B DateStrip** | The dot is the run; a strength-only day gets a strength dot (filled when done). No second dot. |
| **C Plan day row** | Strength-only day: a normal row with the strength rail and its title. Run + strength: the run row plus a quiet trailing "Strength" text mark. No second row, no split rail. |
| **D Session screen** | New screen `strength-session`, SessionScreen anatomy (pinned header, BackButton, eyebrow, compact title, chip), Duration · Exercises tiles, blocks in the SessionSteps visual language, exercise rows with dose and rest, cues on tap, **no media placeholder**. Actions at the end of content: **Mark complete** (primary), **Skip** (ghost, with Undo). |
| **E Logging** | **Done or skipped only.** No RPE, no per-set logging until Phase 4 reads them (amended from "done + RPE"). |
| **F Setup** | Me door **Strength** under *Your training* (admin-only), a Me sub-page, seven questions in weight order, the last three defaulted; injuries read-only from the run plan; honest notes once, here, as field notes. One CTA. |
| **G Coach** | Unchanged in v1. |
| **H Re-placement** | The server re-places strength silently when the run week changes (strength is not run prescription; ADR-012 does not apply). |
| **Titles** | Full body · Lower body · Upper body · Mobility (amended: no "+ core"). |

## 📦 Artifacts
1. **Pattern** — `ui-patterns.md` § "A second session on a day" and § "Strength session screen".
2. **Constant** — `STRENGTH_KIND_TITLE` (`lib/strength-bridge/display.ts`), the single owner of the four titles and
   the dose line; no copy in components.
3. **Checks** — `strengthToday.markup.test.ts` (strength-only day renders no rest copy; run day renders exactly one
   strength row), `strengthSessionScreen.markup.test.ts` (no zone, no media placeholder, cues one tap deep),
   push/day-note arm; each falsified.
4. **Register row** — `design-rulings.md`.

## ↗️ Routing
Copy to the **founder** (the RIR phrasing, the strength-only push line, the setup prompts). No outcome claim on any
surface, so no Coaching Board.

## ⚠️ What this does not settle
Feel on a device · media (Phase 3) · effort logging and progression (Phase 4) · the final words.
