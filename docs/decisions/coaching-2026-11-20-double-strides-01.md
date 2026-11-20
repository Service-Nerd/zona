# Coaching Board — 2026-11-20 — `DOUBLE-STRIDES-01`: may an "Easy run + strides" be half of a §126 double?

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims. Blagrove silent (no strength question: §126's
"no strength on a two-run day" is untouched).

**Trigger:** soft. No doctrine file edited in this sitting. The question is what §126 PERMITS, which is prescription,
so the board sits.
**Proposed change, one sentence:** §126 states that an easy run carrying §28's strides (or, for a beginner, §28 Am. 1's
hill strides) is an easy run for the purpose of a double.

---

## 📐 Analysis, before any seat spoke

**The item's mechanism, re-derived from code (not from the item).** `lib/plan/doubles.ts → doublable()` returns
false for a long run, a structured session (`isStructuredSession`: `type ∈ {quality, tempo, intervals, hard}`) or a
time trial, then admits `easy` / `recovery` by `coachingSessionType`. §28 places strides as a **coach note on an
easy run** and `neuromuscularLabel` appends `+ strides` to the label; `session.type` stays `'easy'` — §28 Am. 1 calls
that *"structurally incapable of counting as quality"*, by construction. So `canDouble` admits it, and
`moveChoices` offers "both" for it. **Item confirmed: the engine already allows it.** The independent checker
`effectiveDoubleViolations` reads `s.type` and `isHardDay`, and also admits it — producer and checker agree.

**Population, production, read-only** (`npx tsx scripts/board-evidence-hr-save-unedited-confirms-01.ts`, the
DOUBLE-STRIDES section):

| | item (2026-10-17) | 2026-11-20 |
|---|---|---|
| live plans | — | **43** |
| run sessions in those plans | — | **2,371** |
| sessions carrying strides | not stated | **403 (17.0%)**, in **38 of 43** plans |
| sessions carrying hill strides | — | **0** |
| live `session_overrides` rows | — | **16** |
| live doubles (`new_slot` set) | — | **0** — and **0 ever** |

So the question is real in reach (one run in six is a strides run, and the move flow offers it) and unexercised in
fact (no runner has made any double).

**Settled-ground scan** (`coaching-rulings.md`, `CoachingPrinciples.md`):
- **§126** (SESSION-SLOTS-01, 2026-10-17): both runs easy or recovery; never long, quality/structured, race or TT;
  no double in race week; ≥6 h advice; no strength. **Silent on strides** — the gap the item names.
- **§28** + **Am. 1** (CB-BEGINNER-HILLS-01): strides and hill strides are *one neuromuscular family*, a coach
  note on an easy run, `type` stays `easy`. **Am. 4**: beginner gate reads the resolved level.
- **§28 placement**: the stride run avoids the day before the long run and the day after quality. A *move* can
  already violate that today, with or without a double — that is the move flow's existing behaviour, not this item.
- **§7** spacing, **§1** session count: a double adds no session and no distance (§126 *"Why"*), so neither moves.
- **2026-11-12 triage** listed this item as needing a split; **the 2026-11-12 Wave-1 record says no split was
  needed** (`TODAY-DOUBLE-HEADLINE-01` is a separate, closed design item). Not re-raised.

**What the evidence can and cannot show.** It shows reach and the engine's current behaviour. It cannot show any
outcome: there are no doubles in production, and the literature on doubling in recreational runners is thin (§126
says so).

---

## 🔍 Conflict scan

Touches **§126** (clarifies, does not contradict), **§28 / Am. 1 / Am. 4** (relies on its "type stays easy"
construction), **§7** (no new stressor — see Willy). No contradiction found. Zone-model translation: not engaged.

---

### 🏃 Alex Hutchinson (Chair)
*"Twenty seconds at 5K effort, four times, with full recovery, is not a session in the physiological sense. §28
itself calls it an appendix to an easy run, and the engine encodes it that way. If we refused it in a double we would
be saying strides are hard enough to forbid but easy enough to schedule the day after a long run. The rule should
follow the stimulus, and the stimulus is neuromuscular and tiny."*

### 📊 Stephen Seiler
*"No objection. Strides do not move intensity distribution in any measured sense, and §1 counts sessions; this adds
none."*

### 🎯 Greg McMillan
*"This is the case doubles exist for: a runner whose Wednesday collapsed and who fits two easy runs into Thursday.
One of them had strides. Telling them they cannot because of eighty seconds of fast running is a rule they would
have to understand, not one they would experience. Do the strides in the run that has them; that is the whole
instruction."*

### 🩹 Rich Willy
*"The injury vector in a double is a hard run on tired tissue. Strides at full recovery are short and the volume is
negligible. My one condition is about hill strides: they are eccentric and tendon-loading, which is why we gave them
to beginners deliberately. On a two-run day I want them in the FIRST run, on fresher legs, not the second. Production
has zero hill-stride runs today, so this costs nothing now; I want it written before it matters."*

### ⚕️ Stacy Sims
*"No objection to the strides. §126 already carries my condition — eat between them — and that is the risk on a
two-run day, not twenty-second strides."*

---

### ⚡ Recorded disagreements
None on the ruling. Willy's hill-stride ordering was accepted by all seats; McMillan noted the app has no time of day
(ADR-011), so "first run" can only be **advice**, as §126's gap already is.

## ⚖️ Ruling — **CORRECT WITH AMENDMENT**

An easy run carrying strides **or hill strides** is an easy run for §126: it may be half of a double. **Amendment
(Willy):** when one half carries **hill strides**, the double's advice names that run as the one to do first. Advice
only, like §126's gap (ADR-011). Nothing is refused; `canDouble` already admits the pair, so **no prescription
changes**.

### 📦 Required artifacts (land with the build, not here)
1. **Principle** — §126 Amendment 1: strides and hill strides do not make a run structured (cites §28 Am. 1's
   construction); hill strides go in the first run, advice only.
2. **Numeric** — none. Stated, not invented.
3. **Check** — not a `validatePlan()` invariant: a double exists only in the EFFECTIVE week (moves applied), which
   `validatePlan` never sees. The build adds an arm to `lib/plan/doubles.test.ts` asserting `canDouble` and
   `effectiveDoubleViolations` both admit a `+ strides` / `+ hill strides` easy run, so a future change to
   `isStructuredSession` or the stride encoding cannot silently flip §126 (falsify by typing the stride run
   `quality`). The hill-strides advice line is copy → the strings go to the founder (brand), the ordering is ours.

### ↗️ Hand-offs
None to the SLT. The advice wording (if built) is 👤 FOUNDER copy.

## ⚠️ What this does not prove
No runner has made a double (0 ever), so nothing here is observed behaviour. That strides in a double are safe is
argued from dose and §28's construction, not measured.
