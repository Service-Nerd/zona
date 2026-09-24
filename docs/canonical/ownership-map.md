# Ownership map — who rules on what

**Status:** Ratified 2026-09-22 by the founder.
**Authority:** ADR-017 (Coaching Board) · ADR-023 (Design Board).
**This file is the SINGLE OWNER of the ownership question.** Every other document
references it. None of them restate it.

---

## Why this file exists, and why it is one file

Zonna now has three governing bodies and a founder. Before this file, the question
*"whose decision is this?"* was answered in whichever document you happened to open —
and this repo has measured, three times, what that produces:

| Duplicated thing | Copies | What it cost |
|---|---|---|
| The six restraint rules (*no popups*, *one job per screen*, *restraint = progress*…) | **4** — `brand.md`, `ux-principles.md`, `CLAUDE.md`, `ui-patterns.md` | Already diverged: **`CLAUDE.md` omits the destructive-confirmation exception**, so read alone it bans modals outright |
| The session colour map | **10** non-generated places | `--s-long` was declared in three of them and **unreachable for every engine-generated plan** (PLAN-LONGRUN-COLOUR-01) |
| The coaching doctrine file list | **hook: 8 · `CLAUDE.md`: 7, twice** | `sessionCatalogueData.ts` — what the engine may prescribe — was outside the guard for **four months** (SC-00), and was named nowhere in `CLAUDE.md` until 2026-09-22 |

That is D-16 (no parallel semantics) three times over. **So this file is the owner and
nothing copies it.** If you find ownership asserted anywhere else, that copy is the
defect.

---

## ⚖️ The seam rule — ratified 2026-09-22

> ## Design owns the encoding. Coaching owns the meaning. The SLT owns the price.

This resolves the cases where one artefact carries two bodies' concerns, without a
case-by-case argument each time. It is **not** a new idea: it is the generalisation of
what P-01 already did, where the Design Board re-pointed `--moss` to mean *"held the
zone"* while the Coaching Board kept `ZONE_DRIFT_ABOVE_CEILING_PCT = 20`.

**Worked:** a colour that means "you went too hard" — design chooses the hue, the token
and where it appears; coaching chooses the threshold at which it applies; the SLT
chooses whether seeing it is FREE or PAID.

---

## The four owners at a glance

| | Coaching Board | Design Board | SLT | Founder |
|---|---|---|---|---|
| **Rules on** | Is it coaching-**correct**? | Is it right for the **person using it**? | Should we **build** it, for whom, at what tier? | Brand identity and anything with his name on it |
| **Chair** | Hutchinson | Zhuo | — | — |
| **Register** | `coaching-rulings.md` | `design-rulings.md` | `docs/decisions/` | — |
| **Authority** | ADR-017 | ADR-023 | — | `brand.md` |
| **Veto** | ✅ **INCORRECT binds the SLT absolutely** | ❌ None over the SLT. Silvanto holds a scoped veto *inside* the board on palette/type regression | Can overturn a design ruling on commercial grounds, **recorded** | Final on brand identity |
| **Convening** | Hook-enforced, both tool paths | Hook-enforced, both tool paths | Invoked at the backlog gate | — |

**The dual hats.** Hutchinson chairs the Coaching Board **and** holds an SLT seat. Zhuo
chairs the Design Board **and** holds an SLT seat (taken from Traynor, 2026-09-22). That
is the escalation mechanism in both directions: a chair who is present at the table she
escalates to.

---

## 🏃 What the Coaching Board owns

**The principle: what the engine DECIDES.**

### Doctrine files — editing one IS a coaching ruling

⚠️ **Eight files, not seven.** `CLAUDE.md` said seven in two places until 2026-09-22.

| File | What it governs |
|---|---|
| `docs/canonical/CoachingPrinciples.md` | The constitution. **125** numbered sections |
| `lib/plan/generationConfig.ts` | Every coaching numeric. **207** top-level keys |
| `lib/plan/planSignatures.ts` | Per-distance plan shape |
| `lib/plan/sessionFormat.ts` | Universal warm-up / main / cool-down structure |
| `docs/canonical/session-catalogue.md` | What the engine is allowed to prescribe |
| `lib/plan/sessionCatalogueData.ts` | ⚠️ **The runtime source** of that catalogue. Added to the guard 2026-08-20 after four months outside it |
| `docs/canonical/zone-rules.md` | HR zone calculation |
| `docs/canonical/coaching-rules.md` | Scheduling, week layout, guard rails |

### Their artefacts — three per CORRECT ruling, one commit

1. **Principle** — a section in `CoachingPrinciples.md`, with the *why*
2. **Numeric** — the named constant in `GENERATION_CONFIG` (or sibling config)
3. **Mechanical check** — the invariant in `validatePlan()` + a row in `plan-invariants.md`

Plus a row in `coaching-rulings.md` (**32** standing rulings) and a decision note.

> ⚠️ **On the invariant count.** `plan-invariants.md` carries ~135 registry rows; a naive
> grep of unique `INV-` ids disagrees with the code by a handful, but that gap is a
> **measurement artefact** (wrapped lines truncate ids mid-token), not a reconciliation
> failure. `npm run verify:invariants` is the authority. Do not quote a grep count at a
> board.

### Also theirs, wherever it appears

- **Any claim about outcomes, physiology, or what training does — on ANY surface,
  including marketing.** Precedent: **W-03**, where a homepage commitments block was a
  coaching question and was killed as one.
- **Thresholds behind a visual encoding** (the seam rule's second clause).

### Not theirs

Display and formatting (ADR-015) · coaching *copy* and voice (`brand.md`) · defect fixes
restoring documented intent · build cost, tier and roadmap order (SLT).

---

## 🧭 What the Design Board owns

**The principle: what the runner SEES and DOES.** Ratified 2026-09-22.

### Doctrine files — editing one IS a design ruling

| File | What it governs |
|---|---|
| `docs/canonical/ui-patterns.md` | Component constitution. **24** sections |
| `docs/canonical/ux-principles.md` | Flow, states, interaction doctrine |
| `docs/canonical/screen-architecture.md` | What job each screen does |
| `docs/canonical/design-rulings.md` | Their own ruling register. **62** rows |
| `app/globals.css` | The token layer. **146** custom properties |
| **Customer email** — the programme, not a file yet | **Design Board, Sierra's seat standing.** Added 2026-09-24: until then **NOTHING owned email**, and two emails had shipped in which **22 of 30 recipients got a countdown with no fact in it**. Sierra's seat because the question the programme keeps failing is hers: is the runner getting better, or is the app asking for money? ⚠️ **The doctrine file does not exist yet** — the plan is a PROPOSAL at `docs/decisions/design-2026-09-24-email-programme-proposal.md`, **awaiting full SLT approval before build**, and graduates to `docs/canonical/` a section at a time as things ship. Until it does, there is nothing for `design-guard.py` to watch |

Plus a **hard trigger on any new screen, shared component or marketing section** — there
is no pattern for a surface that does not exist yet, so one is being authored whether or
not anyone says so.

### Their artefacts — three per SHIP ruling, one commit

1. **Pattern** — a section in `ui-patterns.md` / `ux-principles.md` / `screen-architecture.md`
2. **Token or named constant** — in `globals.css` or a named constant. Never a literal
3. **Mechanical check** — one of the **32** design/markup tests, **or** an explicit
   *"not mechanically checkable because…"*

Plus a row in `design-rulings.md` and a decision note.

⚠️ **The check is falsified before it is trusted.** Break the thing it guards and watch
it go red. This repo has shipped a green tick with nothing behind it more than once.

### Also theirs — ratified 2026-09-22

| Artefact | Ruling |
|---|---|
| **ADR-007 (palette) · ADR-008 (single theme)** | **Amendable by Design Board ruling.** An ADR amendment is a recorded decision, not a quiet edit |
| **`lib/format.ts`** — ADR-015 display formatting (`45 min` / `1h 18`, never `78m`) | **Design Board.** It is a display decision that previously belonged to no board at all |
| **`promptDistanceFormatters`** — the AI layer as a display surface (ADR-015 am. 2026-09-11) | **Design Board**, same reason. A number handed to the model is user-facing the moment the model repeats it |
| **AIMark provenance** — mark only genuine model output | **Design Board.** ⚠️ Flagged honestly: this is an *honesty* rule as much as a design one. It sits here because `ui-patterns.md` defines it and design tests enforce it. **Founder may pull it back** |
| **Whether a copy string EXISTS, and where it sits** | **Design Board.** How it *sounds* is `brand.md`'s |

### Not theirs

What the engine prescribes · any outcome or physiology claim, on any surface · tier,
price, roadmap order · locked brand strings and voice.

---

## 💼 What the SLT owns

FREE/PAID line · pricing · build cost · roadmap order and sequencing · whether to fund an
alternative when a board rules against something.

**And the overturn power:** the SLT may overturn a Design Board ruling on commercial
grounds. ⚠️ **Every overturn is recorded in `design-rulings.md` with its commercial
reason**, so a pattern of design losing to cost becomes a visible fact rather than an
accumulating feeling. It may **not** overturn a Coaching Board INCORRECT.

⚠️ **Traynor's commercial seat is stood down (2026-09-22), recallable.** No seat now
prices churn or conversion. Recall trigger: revenue, a measurable trial-to-paid rate, a
redeemed-code funnel, or meaningful installs.

---

## 👤 What the founder owns

- **The three locked taglines**, `BRAND.voiceAnchor`, `BRAND.name` — never rephrased
- **Voice and tone** (`brand.md` § Tone of Voice, the voice-anchor table, Correction /
  Reframe / Adjustment voices)
- **Positioning, audience, competitor framing** (`brand.md`)
- Anything carrying his personal brand or the charity partnership's name

---

## The seam cases, resolved

Applying **design owns the encoding, coaching owns the meaning, the SLT owns the price**:

| Case | Design | Coaching | SLT |
|---|---|---|---|
| **Session colour map** (10 places) | The hex, the token, where the accent appears | **Which session is which type**, and `isLongRun()`'s definition | — |
| **moss = held the zone / amber = cooked it** (P-01) | The pair, and that it renders on completion states only | `ZONE_DRIFT_ABOVE_CEILING_PCT = 20` | That amber is only *visible* to PAID |
| **Zone bar / ZoneRings** | The mark, the geometry, the arc-fill choice | The five-zone model and the band boundaries | — |
| **A marketing page making a training claim** | Structure, hierarchy, where it sits | **The claim itself** (W-03) | Whether it sells |
| **Upgrade prompts** | How the prompt looks and where it appears | — | **The rule**: behaviour-triggered, never calendar-triggered |
| **A session card's prescribed pace** | How the number is formatted and laid out | The number | — |

---

## 🟢 RATIFIED 2026-09-22 — the restraint rules

**The six rules transferred from `brand.md` to the Design Board by founder ruling.**

*No popups · one job per screen / no dashboards, no noise · calm guidance, not alerts ·
restraint = progress · back arrow top-left · slide-up sheets · no red in the training UI.*

| | |
|---|---|
| **Single owner** | `docs/canonical/ux-principles.md` § Screen Design Principles |
| **Amendable by** | Design Board ruling — three artifacts + a row in `design-rulings.md` |
| **Reference only** | `brand.md`, `CLAUDE.md`, `ui-patterns.md` |
| **Guarded by** | `lib/marketing/restraintRulesOwnership.test.ts` |

**Three divergences were repaired by the transfer**, all of which existed because four
documents each held a copy:

1. 🔴 **`CLAUDE.md` banned modals outright** — it had lost *"modals only for destructive
   confirmations (delete, disconnect); never for information."*
2. 🔴 ***"Empty means calm, not broken"*** existed in `brand.md` and was dropped by two of
   the other three copies.
3. 🔴 ***"No red in the training UI"*** existed in `brand.md` alone.

> ⚠️ **The guard was HOLLOW on its first write, and the reason is recorded because it is
> the repo's most repeated defect class.** The check did `indexOf('no popups')` and tested
> that one line — but the blockquote *explaining* the old divergence quotes the exception,
> so the first match was prose, it passed, and restoring the real defect to the real
> bullet did **not** turn it red. It now scans every list bullet stating the rule, and was
> re-falsified against the genuine defect. **Fifth substring-bias miss in this repo:
> bound the region, never grep the file.**

---

## Maintenance

**This file is the single owner.** ADR-017, ADR-023, both board skills, the SLT skill and
`CLAUDE.md` reference it and must not restate it.

When a board's scope changes, it changes **here**, in the same commit as the ruling. A
process whose memory depends on someone remembering to write it down has no memory —
that sentence is in `coaching-rulings.md` because the Coaching Board proved it.
