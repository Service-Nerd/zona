# `LOG-ONE-INTENTION-01` — one way to say "I ran"

**Status:** PLAN. Nothing built. **Filed 2026-09-27.**
**Origin:** Collins, `SESSION-ACTION-COLLAPSE-01` (September) — *"'Match a run' and 'Log manually'
are the same intention — I did this run — differing only in whether we can find the data."* Held
out of scope then; re-raised by the founder on his own device 2026-09-27: *"We have a Log manually
CTA. Do we actually need that? … It doesn't make that clear."*
**Board:** 🧭 DESIGN BOARD (lead) · 🏃 COACHING BOARD (one clause) · ⚙️ no SLT — no tier moves.

---

## The end goal, in one sentence

**The runner says "I ran". The app answers "which run".** It never asks them to choose between two
words for the same thing.

### What that means concretely

| | Today | End state |
|---|---|---|
| **Today screen** | "Log this session" (moss) **+** "Log manually" (white) | **One** button |
| **Session screen** | "Match a run" + "Log manually" + "Skip" | One button **+** "Skip" |
| **Post-run** | "Looks like this one?" · "Wrong one?" · "Log manually" · "Skip" | A run card you confirm or change |
| **Manual modal** | "Log without activity" / "Confirm complete" | One verb |
| **Rest day** | 🔴 **nothing** | The same one button |

**Seven strings exist today for one intention:** `Log this session` · `Log this run` ·
`Log manually` · `Match a run` · `Log without activity` · `Looks like this one?` · `Wrong one?`
(`Skip` is a different intention and stays.)

---

## 🥇 Most of the decision logic ALREADY EXISTS — do not rebuild it

**This is the single most important thing in this plan.** `DashboardClient.tsx →
handleMarkComplete()` already does what the end state describes:

```
if (!isRun)      → reflect                     // non-run sessions
if (autoMatch)   → saveCompletion(activity)    // we found the run: use it
else             → view = 'complete'           // we didn't: show the picker
```

**The branch is built and correct. The UI ignores it and offers the choice anyway.** So the work
is mostly *deletion plus routing*, not a new engine. Anyone scoping this as "rebuild the logging
flow" has misread it, and that misreading is why it looks too big to start.

⚠️ **`ManualRunModal` is also already session-aware** — it takes `sessionKey`, `sessionName` and
`plannedDistanceKm` and pre-fills the prescription. It is not a separate feature; it is the
no-match branch of the same flow, wearing a different name.

---

## Phases

### Phase 0 — the prerequisite, and it is not design

**Measure the auto-match hit rate.** The whole premise is *"the app usually knows which run"*, and
on 2026-09-27 that is **unmeasurable**: 6 real completions since 1 August, and the only account
with volume (111 completions, 0 linked) is seeded.

🔴 **Do not build Phase 2 or 3 before this number exists.** The value of collapsing the choice is
directly proportional to how often the app can answer it. If the match lands 90% of the time, this
is a clear win. If it lands 30%, we have added a screen to the common path.

**Unblocks when:** real runners log for ~2 weeks. Re-run the probe in `weeklyActualLoad.ts`'s
header against `session_completions` with an activity id.

### Phase 1 — close the hole, independent of everything above *(= option (b))*

**Ship regardless of Phase 0, because it is broken at any hit rate.**

On a rest day `showSessionHero = isRunDay || isStrengthDay` is false, so **no log control renders
at all** — on a 3-day plan that is **4 of 7 days**. There is no way to record an unprescribed run.

- Entry point on `RestDayCard`, plus a row under the session on run days.
- 🏃 **Coaching Board already ruled the semantics** (`LOG-OFFPLAN-01`, 2026-09-27): an off-plan
  run is an **observation, not an intervention** — it counts toward actual load and shadow load,
  never toward the auto-trimming ratio. **The engine side is already shipped.** This is the UI.
- ⚠️ **~Half of this is deleted by Phase 3** — the rest-day entry survives, the session row is
  replaced. Worth paying: it closes a live hole now.

### Phase 2 — one label per moment (no flow change)

Pure copy and hierarchy. Low risk, shippable alone, and it makes Phase 3's diff small.

- Collapse the seven strings to **one verb** per surface.
- `LINK-HIERARCHY-01` already ruled the preference (linking is materially better coaching under
  ADR-011, because a manual log carries **no HR stream**), so the primary must be the linked path
  and the manual path must be visibly secondary — **not a peer**.
- 👤 **FOUNDER owns the verb.** Locked-string territory. Candidate: *"Log today's run"* / *"I ran"*.

### Phase 3 — the collapse

- **Today:** one button. It calls the existing branch.
- **Session:** one button **+ Skip**. `Skip` stays separate — Sierra, on the record: *"'Skip'
  beside 'Log manually' at equal weight quietly suggests skipping is a normal outcome."*
- **No match:** the manual form opens **directly**, not behind a "we found nothing" screen. 🔴 This
  is the clause that decides whether Phase 3 helps or hurts the no-device runner.
- Retire `view === 'complete'` as a *destination the user chooses*; it becomes a *state the flow
  enters*.

---

## What must be true before Phase 3 ships

| # | Condition | How it is answered |
|---|---|---|
| 1 | The match hit rate is known | Phase 0 |
| 2 | The run is present **at the moment of the tap** | 🔴 **DEVICE ONLY.** `syncOnAppOpen` runs at app-open and on pull-to-refresh, and ingest + match are async. If the runner opens and taps in two seconds, is the row there? Nothing has ever run on a device |
| 3 | A runner whose runs never reach HealthKit loses nothing | They have no HK row, so they always take the no-match branch. Condition 3 of Phase 3 is what protects them — **one extra tap is a regression for the population ADR-011 §5 says exists** |
| 4 | A mock-up exists | Collins already ruled **mock-up before code**; `LINK-HIERARCHY-01` clause (6) |

---

## Risks

| Risk | Mitigation |
|---|---|
| 🔴 **This is the core loop.** A wrong step means a run is not logged | Phase 2 first (copy only, no flow change), then Phase 3 behind the mock-up |
| The no-match path gains a screen | Phase 3 condition 3 — the manual form opens **directly** |
| `handleMarkComplete`'s branch is subtler than it reads (`autoMatch` is high-confidence only; medium is deliberately ignored — *"wrong link is worse than a picker tap"*) | Do not widen the confidence gate as part of this. It is a **Coaching Board** question about what counts as completing a session (`MATCH-LIST-WINDOW-01` is already filed) |
| Seven labels means seven call sites; a missed one leaves a twin | **Grep for the SHAPE of the fix, not the symptom** — `/zona-debug` Exit criterion 3. This repo has recorded **nine** "remedy applied to one twin" |
| A gate anchored on today's labels goes blind after the rename | **Three guards in this area already anchor on things the next defect did not have** (`<IconButton` tags; `onClick={onBack}`). Anchor any new check on the *component*, not the string |

---

## Open — founder

1. **The verb.** Locked-string territory.
2. **Phase 1 now, or wait and do 1+3 together?** Recommendation: **now** — 4 of 7 days is a live hole.
3. **A device.** Condition 2 cannot be answered any other way.

## Not in scope

Widening the auto-match confidence gate · the candidate list's missing date filter
(`MATCH-LIST-WINDOW-01`, Coaching Board) · anything about what the engine prescribes.
