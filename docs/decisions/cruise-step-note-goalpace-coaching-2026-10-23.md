# Coaching Board — CRUISE-STEP-NOTE-GOALPACE-01 (2026-10-23)

**Trigger:** `lib/plan/sessionCatalogueData.ts` (doctrine file, hard) and §33. The proposal changes no number and no
session the engine selects; it changes what a step tells the runner. Convened because the words carry a coaching
claim (which intensity this is), and coaching owns the meaning (`ownership-map.md`: design owns the encoding, coaching
owns the meaning). The founder owns the words.

**Proposed change.** When §22 goal-paces a row, its work-step notes must describe goal-pace work, never the row's
threshold intent.

## Measured before the sitting

1-in-7 sample of the cohort grid (5,664 plans), every work-step note on a `stimulus: 'race_pace'` session, by row:

| Row | Goal-paced sessions | Work-step note the runner reads | Verdict |
|---|---|---|---|
| `tempo_cruise` | 996 (5K, 10K, HM, MP) | "Threshold effort — comfortably hard, not a race pace." | **Contradicts**: names the wrong intensity and denies the session's purpose |
| `tempo_cruise_short` | 847 (5K, 10K) | same | **Contradicts** |
| `progressive_tempo` | 1,113 (10K, HM, MP) | third step: "Threshold now. It should feel harder than the same pace would feel fresh." | **Contradicts**: at HM and MP, goal pace is below threshold |
| `threshold_mile_repeats` | 510 (10K, HM, MP) | "Threshold, held. Rep three should look like rep one." | **Contradicts**: names threshold |
| `threshold_pyramid` | 508 | "Rung one…", "Up one.", "The top. Same pace as the first rung, not faster.", "One to finish. Do not race it." | Fine: structural, no intensity claim |
| `threshold_ladder` | 646 | "The long rung. If the pace is going, it goes here…" | Fine |
| `tempo_continuous` | 802 | "Sustainable. Same pace at the end as at the start." | Fine |
| `goal_pace_sharpener`, `beginner_goal_pace_reps`, `beginner_goal_pace_blocks`, `tenk_pace_intervals`, `hm_pace_intervals`, `mp_blocks`, `tenk_race_simulation` | — | already written for goal pace | Fine |

**3,466 goal-paced sessions** across four rows tell the runner the wrong intensity, against the item's 1,843 (which
counted two rows). The two extra rows came from measuring every note, not grepping for the one phrase.

**Why it was never caught.** §33 requires that when the engine relabels a session "the voice MUST be replaced — not
appended", and `INV-PLAN-COACH-NOTES-MATCH-INTENT` enforces it on `coach_notes`. Step notes arrived later with the v2
structure (ADR-019) and the engine copies them from the row unchanged. The check reads `coach_notes` only, so the
session-level voice was replaced correctly (Harvey's card reads "5K-pace work. Target 4:24 /km") while the step under
it still says threshold. The principle was right; its enforcement covered the field that existed when it was written.

## Conflict scan

- **§33** — directly. This is §33's own rule, unextended to a field added after it. Amend, do not contradict.
- **§22** and **§22 Am.3** — the rename is what creates the mismatch; not changed. Am.3's beginner reps row already
  carries a goal-pace note.
- **§83 Am.** — goal-paced work carries the zone its pace sits in. A threshold step note on a Zone 4–5 card is the
  copy half of the same incoherence §83 Am. fixed for the zone. Consistent.
- **§85** — mixed-anchor rows are excluded from the override. Checked: `progressive_tempo` is deliberately NOT mixed
  (`hasMixedWorkAnchors` ignores E-anchored ramp steps), so it IS goal-paced. No conflict.
- **§40b / effort-governed rows** — excluded from the override, so out of scope.
- **ADR-019** (session structure v2) — step notes are part of the row. Adding an optional goal-pace note to a step is
  additive, like the rest of v2.
- **Brand / em dash (CLAUDE.md)** — the founder ruled session descriptions may use em dashes and sentences may not.
  The proposed lines carry none.

No section contradicted.

## The board

**🏃 Hutchinson (chair).** This is not cosmetic. The step note is the text in front of the runner during the rep,
which makes it the most-read line of the session. "Not a race pace" on a session whose whole job is race pace undoes
§22 in the runner's head. The defect is the twin of one we have already fixed, so the ruling is an extension of §33,
not a new principle.

**📊 Seiler.** The harm runs in both directions and that is the useful finding. At 5K, goal pace sits above threshold:
"comfortably hard" invites a runner to hold back from the pace the plan prescribes. At HM and marathon, goal pace sits
below it: "Threshold now", on a marathon-pace progression, invites a runner to push into the band §1 exists to keep
them out of. One sentence, two opposite errors. Measure it per distance at build so the fix is shown to reach both.

**🎯 McMillan.** Keep what the notes do well. The structural lines ("Rep three should look like rep one", "Same pace at
the end as at the start") are good coaching at any pace and should survive. Only the intensity claim changes. And
do not make the runner learn anything: they should not see two vocabularies for the same session.

**🩹 Willy.** No load change, so nothing from this seat on injury. One condition: whatever replaces "comfortably
hard" on 5K reps must not tell a beginner to push. The beginner row's "Controlled, not flat out" is the right register.

**⚕️ Sims.** No objection from this seat.

**💪 Blagrove.** Not a strength question. Silent.

## Recorded disagreements

**Per-row notes or one engine-written note.** McMillan prefers a goal-pace note authored on each affected step, so
each row keeps its own voice. Hutchinson considered one synthesised note (the engine already synthesises §33's
coach-note voice) and set it aside on McMillan's point: a synthesised line would also overwrite the pyramid's and
ladder's structural notes, which are correct as they are. Settled for per-row notes, applied only on goal-paced
sessions. Nothing would reopen it short of a fifth row needing one.

## Ruling

**CORRECT WITH AMENDMENT.** §33 extends to step notes. A row that §22 can goal-pace, and whose work-step note names an
intensity, carries an optional **goal-pace note** on that step. The engine uses it on goal-paced sessions and the
row's own note otherwise. Structural notes with no intensity claim stay as they are.

**Proposed words, for the founder (the board rules on meaning, the founder on words):**

| Row | Step | Now | Proposed at goal pace |
|---|---|---|---|
| `tempo_cruise`, `tempo_cruise_short` | work | "Threshold effort — comfortably hard, not a race pace." | "Goal pace. Even splits, and the last rep no faster than the first." |
| `threshold_mile_repeats` | work | "Threshold, held. Rep three should look like rep one." | "Goal pace, held. Rep three should look like rep one." |
| `progressive_tempo` | third work step | "Threshold now. It should feel harder than the same pace would feel fresh." | "Goal pace now. It will feel harder than it would fresh; hold it, don't chase it." |

## Required artifacts

1. **Principle** — §33 Amendment: step notes are part of the voice and are replaced with it.
2. **Numeric** — none. A copy field, not a coaching number; stated rather than invented.
3. **Checks** —
   - extend `INV-PLAN-COACH-NOTES-MATCH-INTENT` with a step-note arm: on a `race_pace` session no work-step note
     names threshold or says "not a race pace" (row in `plan-invariants.md`, made to fire on the shape that ships
     today);
   - a catalogue test whose population is derived from the catalogue (every row the override can reach, not a list):
     any T-anchored work step whose note names an intensity must carry a goal-pace note.
4. **Measure at build:** goal-paced sessions with a contradicting step note, 3,466 → 0, per distance (Seiler); no
   change to `cohort:shape`, `measure:fitness` or `verify:parity` session hashes beyond the note text, because no
   prescription moves.

**`measure:fitness` not run for the ruling:** nothing the engine prescribes changes. Stated, so it is not mistaken for
skipped.

## SLT escalation

None.

## Reaches existing plans?

No. A catalogue change reaches new plans only. e49ea589's patch (GOALPACE-5K-01) would carry the old note on three
sessions; if the founder wants it fixed for him, the patch is re-run after this ships.
