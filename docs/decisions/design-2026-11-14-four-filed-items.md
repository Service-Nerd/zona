# Design Board — 2026-11-14, the four items routed "design, then the founder's words"

Convened because the founder delegated the wording on all four (*"You decide the words"*), which
removed the tail blocker and left the design question as the only thing in the way.

Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins.

---

## 🔍 Settled-ground scan — and it ends one item before any seat speaks

| Row | Date | Bearing |
|---|---|---|
| **An affordance is withheld when the ACTION cannot succeed, not when the DATA is missing** (`BASEBUILD-ADJUST-DOOR-01`) | 2026-10-10 | **Settles `NO-RUNNER-CHECKPOINT-LOG-DATE-01` outright** |
| **All five states ship together: loading, empty, error, data, edge** | STANDING | `USER-SETTINGS-TELL-THE-RUNNER-01` is a breach of an existing rule, not a new question |
| `NO-RUNNER-TURNED-AWAY-01` amendment: *"One runner-facing name, 'Base building' (Collins); renaming foundation weeks filed as `FOUNDATION-NAME-COLLAPSE-01`"* | 2026-10-24 | The scope of the naming question, and Collins already won it for the staged phase |
| `ME-HISTORY-ERROR-DEADEND-01` — `EmptyState` + one action for a failed LOAD | 2026-10-16 | Near but not it: a failed **save** leaves correct data on screen |

---

## 📐 Measurements taken before the sitting, not after

| | Measured |
|---|---|
| Plans declaring benchmark weeks that hold **no benchmark session** | **6 of 14** live plans (`INV-PLAN-RECALIBRATION-HAS-SESSION`, error severity — and `npm run audit:stored` already reports all 6) |
| Time-trial sessions across all 43 live plans | **15**, in 8 plans |
| `MeScreen`'s error channels | **1**, and it is account deletion |
| Runner-typed `user_settings` writes at `severity: 'log'` with no channel | **4** — HR sheet Save, units, metric, birth year |
| `ManualRunModal` date control | takes a `sessionDate` **prop**; no picker. Off-plan log is dated **now** |
| Foundation weeks live | **21 across 7 plans, every one labelled "Foundation N"** — the `curve === 'ramp'` branch that emits `Base N` reaches no live plan |
| `phase: 'foundation'` vs `phase: 'base_build'` | different jobs in code: foundation weeks carry **negative `n`** and fill a runway before a plan that already exists; `base_build` **is** the whole plan until a checkpoint passes on observed volume |

---

## 1. `NO-RUNNER-CHECKPOINT-LOG-DATE-01` — 🔴 NO RULING REQUIRED. SETTLED GROUND.

**The question as filed:** does "Log a run" need a date picker, or should the no-runs state offer
more base building instead?

**Chair:** neither, and this board does not need to sit on it. `BASEBUILD-ADJUST-DOOR-01` ruled on
2026-10-10 that **an affordance is withheld when the action cannot succeed.** `ManualRunModal`'s
off-plan log is dated *now*; the checkpoint reads base-building weeks that are over by the time the
card appears. So the action cannot succeed, and the current state — Apple Health, or a later race —
is the standing rule being honoured. **The withholding is correct and was correct when it shipped.**

⚠️ A date picker is a separate, additive proposal, and it has **no measured demand**: it would make
the affordance succeed, which is the only thing that would reopen this. Nobody has asked for it and
no live runner has hit the state with a run to backdate. **Filed closed, not built.**

**Collins:** *"Then the item was a question about a button, and the answer was already written down
four weeks earlier. Close it."*

---

## 2. `USER-SETTINGS-TELL-THE-RUNNER-01` — 🟢 SHIP WITH AMENDMENT

**Chair:** the standing rule already requires an error state, so the only open question is **where a
failed SAVE renders** — which is genuinely not answered anywhere, because every error pattern we
have is for a failed LOAD. `ME-HISTORY-ERROR-DEADEND-01` gives an `EmptyState` with a retry, and
that is wrong here: on a failed save **the data is still on screen and still correct**, so replacing
the screen with an empty state would destroy what the runner just typed.

**🩹 the inversion Wroblewski names:** *"The two writes that CAN report a failure are the two the
runner never asked for — `push_permission_seen` and `connect_runs_seen`, where the cost of a lost
write is that a card reappears. The four they typed with their thumbs have nothing. That is exactly
backwards, and it is backwards in the same direction as `PROFILE-NAME-WRITE-01`: 44 of 46 rows had
an empty `first_name` while the greeting read the right name off auth metadata for months."*

**✋ Silvanto:** *"The sentence already exists and is already decided —
`settingsWriteFailureMessage`. One string, one voice. What is missing is a place to put it. Put it
**under the control that failed**, in `--danger`, at the documented small size, and leave the value
where it is. A row that failed to save must not look like a row that did."*

**🎓 Sierra:** *"The runner has to be able to act. The sentence says *'It's still set on this
device, not on your account'* — that is honest and it tells them the one thing that matters, which
is that the push and the emails will disagree with the screen. No retry button: the retry is
flipping the toggle again, which they already know how to do."*

**🎪 Collins:** *"Four rows gaining a red line each is four chances to look broken. But the
alternative is lying by omission on data the runner typed. Take the line."*

**Ruling: SHIP WITH AMENDMENT.** Inline, beneath the failing control, `--danger`, the existing
sentence, value untouched, no retry affordance. The amendment: **the message clears when the next
write to the same field succeeds**, so a transient failure does not leave a permanent red line on a
row that is now correct.

---

## 3. `TT-SKIPPED-VISIBILITY-01` — 🟢 SHIP WITH AMENDMENT, and the measurement moved the item

**The item said:** *"1 of 27 rebuildable live plans would lose every benchmark."*
**Measured today: 6 of 14 live plans that DECLARE benchmark weeks hold no benchmark session.** That
is not a hypothetical about a rebuild; it is six runners whose plan metadata promises a timed 5K
that does not exist in it. `INV-PLAN-RECALIBRATION-HAS-SESSION` is error-severity and
`audit:stored` has been reporting all six.

**Chair:** two different things were bundled in one item and they get different answers.

**(a) The data defect is not ours.** A plan whose `meta` declares a week it did not place is a
claim/computation mismatch — ⚙️ no board, and it cannot be repaired in place because a rewrite of a
live plan is refused by `regenRefusalReason`. It is already in the stored-plan debt register, which
is where it belongs.

**(b) Telling the runner is ours, and the surface is NOT the one the item proposed.** The item
offered *"a plan note or the Today benchmark tile"*.

**✋ Silvanto, and this is the reason for the amendment:** *"A plan note is where we put things the
runner may read. The benchmark tile is where they go to look for the thing. If the benchmark is
gone, the honest place to say so is **the place they will look for it** — not a sentence
somewhere else on the plan."*

**📱 Wroblewski:** *"And it must not be a new surface. The tile exists; give it its absent state.
Five states ship together — this is the empty one, and it has never been built."*

**🎓 Sierra:** *"It has to say what it costs them, not that a scheduler failed. They will finish the
block on the paces they started with. That is the fact."*

**🎪 Collins:** *"Say it once, in the one place, and do not put it on the plan page as well. Two
sentences about a missing session is more presence than the session had."*

**Ruling: SHIP WITH AMENDMENT.** The benchmark tile gains its **absent** state. One sentence. No
plan note, no Today eyebrow, no second surface. ⚠️ **Scoped to a plan that DECLARES a
recalibration week and holds none** — never to a plan that was never going to have one, which is 29
of 43 live plans and would be a sentence about nothing.

---

## 4. `FOUNDATION-NAME-COLLAPSE-01` — 🔴 DON'T SHIP. Collins loses, and the measurement is why.

**The question:** should foundation weeks also be called "Base building"?

**🎪 Collins (filing position):** one runner-facing name everywhere.

**Chair, with the code in front of the board:** they are **different jobs**, and the measurement is
unambiguous. `phase: 'foundation'` weeks carry **negative `n`** — they sit *before* a race plan that
already exists, filling a runway for a runner who already has a base. `phase: 'base_build'` **is**
the entire plan for a runner who does not yet have one, and it ends at a checkpoint on observed
volume. One name would make "Base building" mean both *"the weeks before your plan starts"* and
*"the whole plan until you are allowed to start one"* — and it would collapse them hardest for the
staged runner, who cannot yet run and for whom the distinction is the entire proposition.

**🎓 Sierra:** *"The staged runner is the one who has spent a lifetime not clearing hurdles. Telling
them their plan and someone else's warm-up share a name is not a simplification for them."*

**📐 And the inconsistency Collins would have been right about does not reach anybody:**
`foundationBlock.ts:751` emits `Base ${position}` when `curve === 'ramp'` and `Foundation
${position}` otherwise — but **all 21 live foundation weeks across 7 plans read "Foundation N"**.
The ramp branch reaches no live plan.

**🎪 Collins, recorded:** *"Then I withdraw the live claim and keep the principle. If that ramp
branch ever ships to a runner, two names inside one block is mine again."*

**Ruling: DON'T SHIP.** Two names, because there are two jobs. ⚠️ **Recorded as a live risk, not a
closed one:** the `curve === 'ramp'` branch can emit `Base N` on a `phase: 'foundation'` week, and
if it ever reaches a runner this returns as a defect rather than a naming preference.
