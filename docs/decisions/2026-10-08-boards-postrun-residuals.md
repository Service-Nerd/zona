# Two sittings, 2026-10-08 — the post-run residuals

Both items came out of `POSTRUN-JOURNEY-01`'s residual list. **Both were filed as one kind
of question and turned out to be another**, which is the only thing they have in common and
is worth recording as a pattern in its own right.

| Item | Filed as | What it was |
|---|---|---|
| `READ-DIRECTION-OVERCLAIM-01` | 🏃 a wording question about the word *"most"* | **a scoring defect**: half the score is measured against the wrong band for every quality session |
| `LINK-PICKER-ALREADY-LINKED-01` | 🧭 a question about a list filter | **a heading that lies**, plus a severed ⚙️ defect that can silently relink a run |

---

## 🏃 Coaching Board — `READ-DIRECTION-OVERCLAIM-01`

**Full record:** `docs/canonical/coaching-rulings.md`.

**Split ruling.** ⛔ **INCORRECT as scoped** on the filed question — neither candidate fix
ships, because both would have closed the item and left the defect. ✅ **CORRECT on what
the conflict scan found.**

### The finding, in one line

**`hr_in_zone_pct` means `hr_in_zone_2_pct`, it IS the HR discipline score verbatim, and HR
discipline is half of §108's composite — so a correctly-executed progressive tempo cannot
score above about 33.**

### Measured, mechanically

- `lib/strava.ts:112` — `const ceiling = zones.zone2Ceiling ?? …`, under its own comment
  *"Z2-anchored counts — legacy fields"*. **Unconditional, every session type.**
- `lib/coaching/sessionScore.ts:76` — `if (hrInZonePct !== null) return Math.round(Math.min(100, hrInZonePct))`.
  Verified in production: `hr_discipline_score === round(hr_in_zone_pct)` on **100% of rows**.
- `grep 'session.type' lib/coaching/sessionScore.ts` → **empty.**
- Catalogue row 7 (`progressive_tempo`): *"continuous, **3 equal thirds (E ceiling → Z2-Z3
  transition → T target)**"* — **two of three thirds are designed above the Z2 ceiling.**

**The founder scored 32** on a split of 29.0% below / 32.3% in / 38.7% above — almost exactly
thirds. **He ran the session as prescribed and the engine graded it a failure, then narrated
that failure back to him.** The card's own label asserts it: *"32% in your **prescribed
zone**"*. It is not his prescribed zone. It is Zone 2.

### Why no aggregate would ever have caught it

77 of 77 analysed rows with HR are easy-type, mean 79% in-zone, where Z2-anchoring is
**correct**. ⚠️ **The population barely contains the sessions where the measure is wrong.**
`run_analysis.session_type` is null on all of them, because the stamp only landed 2026-10-07.
**The founder found it by running one tempo.**

### Binding conditions

1. ⛔ **Willy, close to a veto:** do **not** repoint `hr_above_ceiling_pct` or
   `hr_in_zone_pct`. `limiter.ts:203` reads them as a Z2 overload signal
   (`PACING_HOT_PCT_THRESHOLD`); re-anchoring per session type would make a correct tempo
   read as *"ran hot"*. **Add a prescription-relative field; do not redefine the columns.**
2. ⛔ **Sims:** the **below-floor** bucket must not score as indiscipline on a session whose
   own structure prescribes a below-band opening third. 29% below is in the founder's row.

### Unresolved, and recorded as unresolved

**Seiler vs McMillan on the remedy's shape.** Seiler wants a prescription-relative in-band
percentage per session type. McMillan holds a tempo's compliance question is binary — *did
you reach the work and hold it* — and that a percentage-in-band model will mislead on
intervals, where recovery jogs are *supposed* to fall out of band. **Settled by the
distribution of `strava_activities.hr_bpm_histogram` across the prescribed band. Nobody has
looked**, and live data cannot settle it yet.

### ↗️ Escalated to the SLT, and the board does not decide it

The remedy changes `total_score` on live rows, and the founder explicitly **kept** the score
(*"i got 83% on my garmin last night … gives a sense im going in the right direction"*).
**Score composition is his and the SLT's.** Hutchinson carries it.

⚠️ **Artifact to ship first even if the rest waits:** an invariant that *every catalogue row,
executed as its own `main_set_structure` prescribes, must be able to reach a passing HR
discipline score.* Checkable from the catalogue alone, needs no live data, and **goes red
today on row 7.**

### ✅ Second routed question, settled

**Which axis owns "Short."** when the runner chose duration and the axes disagree:
**CORRECT AS SHIPPED.** §66 Am. 1 already governs, and withholding the verdict where they
contradict asserts nothing §66 does not. 📐 **22% disagreement (2 of 9 both-axes live rows)
is too high to pick an axis silently and too low to justify a new principle** — but both
seats noted the number is the interesting part: **one in five analysed runs is judged on an
axis the runner did not choose.** Revisit as a principle above nine rows.

---

## 🧭 Design Board — `LINK-PICKER-ALREADY-LINKED-01`

**Full record:** `docs/canonical/design-rulings.md`.

**Split ruling.**

### 1. 🔴 A defect severed: `LOG-UPDATE-SILENT-RELINK-01`

`handleMarkComplete:466` — `if (autoMatch) { void saveCompletion('complete', autoMatch.activity); return }`,
and **`resolveAutoMatch` never checks completion status** (`sessionAutoMatch.ts:56-73`). So on
an already-linked session, *"Update log"* **writes immediately with no picker, no confirmation
and no visible change**, overwriting the link IDs — and **if the match resolves to a different
activity the session is silently relinked to a different run.**

🧭 Zhuo: *"a button labelled 'Update log' that performs a write with no confirmation and no
visible change is not a design preference, it is a defect."* Restores ADR-012 and the
modals-for-destructive-only rule, so ⚙️ **no board**, filed separately.

### 2. ⚖️ INSUFFICIENT EVIDENCE on the filed question

Two coherent shapes, no basis to choose. **The missing artefact is named: the founder on a
device.** Six runners have ever logged a run, so no behavioural measurement exists and
inventing one would be the three-card proof band again.

### 3. ✅ SHIP WITH AMENDMENT — shipped in this commit

A linked session may not be headed *"Link an activity / Optional, select from recent runs."*
It **states what it has, in the past tense**, before offering to change it. **Unanimous and
independent of the unresolved split** — it is the half the founder actually complained about.

Artifacts: pattern (`ux-principles.md` § the already-done state is a sixth state) · constant
(`lib/ui/linkPickerCopy.ts`) · check (`linkPickerCopy.test.ts`, **falsified three ways**:
revert the heading, narrow the id read to Strava only, drop the change-offer) · register row.

### ⛔ Veto: none, and the reason is the finding

Silvanto declined **explicitly**: the behaviour the item flagged as suspicious — the picker
keeping the already-linked run so it can render `--moss-soft` — is **compliance** with
`BUTTON-COMPONENT-01` (*the moss active fill is the only selected affordance*). Removing it
would delete the only signal that says *this is the one you have*. **The state must be said,
not removed.** The filter at `SessionPopupInner.tsx:372` is untouched and an arm now holds it.

### Unresolved, and recorded as unresolved

🎪 **Collins:** the list should not exist in this state. *"Linked to your 9.9km run,
Wednesday. Wrong one?"* — and **"Wrong one?" is already live** on the auto-match suggestion
fifty lines up. *"You wrote the right control and did not reuse it on the state that needs it
most."*

📱✋ **Wroblewski + Silvanto:** keep the list, fix the headings, bring **remove** onto this
surface — unlink lives on `SessionScreen`, so *the one thing a runner here might want is the
one thing absent*. Wroblewski counted the current path at **four actions to confirm what the
previous screen already said**.

⚠️ **Chair's note: the two converge if "Wrong one?" opens exactly Wroblewski's list**, so this
is a sequencing question. Recorded unresolved rather than merged, because the first screen the
runner sees differs.

---

## What neither sitting settled

- **Whether the engine's HR discipline measure changes at all** — that is the founder's and
  the SLT's, because it moves a number he has said he values.
- **Whether the link picker's list should exist on a linked session** — needs him on a device.
- **Where unlink lives.** `UX-POSTRUN-01` put it on `SessionScreen`; Wroblewski's objection
  that the destructive action is absent from the surface offering the constructive one is
  recorded and **not ruled on**.

⚠️ **Nothing has run on a device.**
