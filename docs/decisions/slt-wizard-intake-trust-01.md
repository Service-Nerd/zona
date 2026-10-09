# SLT — WIZARD-INTAKE-TRUST-01 (2026-10-09)

**Brief:** should the wizard refuse, or query, an intake it can already see is impossible?
**Tier: FREE**, unanimous. `INV-INPUT-LONGEST-LE-WEEKLY` guards the generation path, which is
FREE for 5K/10K/HM. Gating input sanity behind PAID would mean knowingly building worse plans
for free users — against *"gate richness, never access."*

## 🔴 The submission was wrong about the mechanism, and the correction reframed the sitting

I filed both items as "race name and date are free text". **They are not.** Both volume inputs
are collected by a **`Ruler`** (continuous slider: `WEEKLY_KM` 0–160 step 5, `LONGEST_RUN`
0–60 step 1) on **two separate one-question-per-screen steps** (`weekly-volume`, then
`longest-run`, per CI-1). The legacy `WEEKLY_KM_CHIPS` / `LONGEST_RUN_CHIPS` survive only for
draft restore, which is why the live values (10, 5, 0, 20, 6) are not chip values.

**Sutherland's reframing, which the board adopted:**

> *"One question per screen is a lovely pattern and it has a cost nobody priced: it removes
> the only moment a person would have caught themselves. On one screen, '15 a week' and
> 'longest run 25km' look silly. On two screens they are two reasonable answers."*

So the contradiction is **a consequence of the flow**, not of careless runners. And both
sliders reach **0**, which is how two plans were built for runners who said they run nothing.

## Evidence put to the board (measured on all 34 live plans)

**Item A — race name and date.** 8 plans name the London Marathon in 6 spellings
("London Marathon" ×3, "London Marathon " ×2, "London marathon ", "London Mara ",
"London maratgon"). 🔴 **The dates disagree: 2027-04-25 ×4, 2027-04-24 ×3, 2027-05-17 ×1.**
London 2027 is Sunday 25 April — so **4 of 8 are wrong**: three on the Saturday, one 22 days
late. `generator_input.race_date` equals `meta.race_date` on all, so the engine is faithful.
Other live values in that column: `"Target Race"` ×3 (the literal placeholder
`INV-PLAN-NO-PLACEHOLDER-COPY` was written to ban — it does not scan `meta.race_name`),
`"Ar"`, `"X"`, `"Training"`, `"Random half"`, and `"Fuji Marathon "` at 21.1 km.

**Item B — impossible intake.** 3 live plans have `longest_recent_run_km > current_weekly_km`
(20 v 10, 6 v 5, 5 v 0) and **2 have `current_weekly_km = 0`**. `INV-INPUT-LONGEST-LE-WEEKLY`
(§18, §10) throws in dev/test and **only logs in production**, so the plan is built anyway.
The 20-v-10 plan is the one the Coaching Board sat on today (`LR-TAPER-BUMP-01`).

🔴 **AND ITEM B WAS ALREADY THIS BOARD'S RULING.** `SUBFLOOR-COHERENCE-01` — *"SLT ruled
BUILD 2026-09-19 (wizard validation, not coaching)"* — says *"worth asking the wizard to
reconcile the two answers rather than generating from an inconsistent pair."* **Unbuilt for 20
days.** I triaged it tonight as a new finding without recognising it. Fried: *"that's not a
prioritisation problem, that's an item nobody could see."*

## Seats

- **Sutherland** — reframed the cause (above). On the date list: *"you'd be buying a
  maintenance liability to solve a problem your own data says is mostly a WEEKDAY error."* The
  nudge is also kinder than a lookup: it lets the runner be right.
- **Fried** — Item B is a bug, not a feature. Date list: **no** — *"a subscription to somebody
  else's data, forever, so that we can be clever about eight plans."* Explicit kill on any
  version that becomes a validation *programme*: **two checks, one afternoon.**
- **Hutchinson** — coaching correctness not in question; §18/§10 already legislate it and the
  engine obeys by logging, which is the defect. 🥇 **Names the strongest finding in the room,
  and it is neither item as filed:** the 2027-05-17 runner **arrives at London mid-build,
  carrying peak-phase fatigue.** Also wants it on record that marathon-adjacent plans were
  built from a declared **zero** — §111's floor should refuse that, not a slider accept it.
- **Wood** — the right kind of intervention (context, not motivation). ⚠️ **Kill-threat
  condition: NOT a blocking modal.** Friction at the highest-abandonment point in the product,
  for a population already unsure it belongs. **In-flow confirmation with both numbers
  visible.** Needs **no new screen**.
- **Zhuo** — 🛑 **stopped the sitting and routed**: three of the four asks decide what a
  screen shows, and this board has no designer. Settles scope and tier only. Success condition
  stated before design: **zero new plans with `longest > weekly`, zero with `weekly = 0` not
  refused** — both observable in tomorrow's digest.

## ⚡ Conflicts

- **Sutherland vs the submission** on what Item A is. He is right; my framing survived only
  because the numbers were in the brief.
- **Hutchinson vs the agenda.** The 2027-05-17 plan is the most serious thing in the room and
  is neither item as filed. ✅ **Resolved in the sitting:** 17 May 2027 is a Monday, so the
  weekday check catches it — **4 of 4 wrong dates**, not 3 of 4.
- **No conflict on tier.** All five: FREE.

## ✅ Ruling

| | |
|---|---|
| **Item A — weekday confirmation** | **BUILD.** Free, no data dependency, catches 4 of 4 |
| **Item A — major-race date list** | **DON'T BUILD.** Ongoing maintenance liability |
| **Item B** | **BUILD, re-scoped** — folded into `SUBFLOOR-COHERENCE-01`; one surface, one item |
| **`current_weekly_km = 0`** | a **refusal**, not a slider value |

**Both are one build.** Fried's bound stands: two checks, an afternoon.

**Routed DOWN to the Design Board** before implementation — treatment, placement, copy.
Wood's no-modal condition and `ux-principles.md` already narrow it.
**Routed DOWN to the Coaching Board** — whether `weekly = 0` is a §111 refusal changes what
the engine refuses.

**Priority:** below the two founder-gated live remediations, above the rest. It prevents new
bad plans; the remediations fix existing runners.

## 🚨 MUST/NEVER

No violations. Two traps named: **no modal** (Wood would kill it; `ux-principles.md` permits
them only for destructive confirmation), and **no hardcoded numerics** — any threshold lands
beside `WIZARD_VOLUME_RULER` in `GENERATION_CONFIG`.

## ⚠️ Risks to existing features

Touches the CI-1 wizard flow and `zona_wizard_draft` sessionStorage.
⚠️ **`INV-INPUT-LONGEST-LE-WEEKLY` must keep LOGGING rather than throwing in production.** If
the wizard blocks the pair, the invariant becomes the backstop, not the gate — changing its
severity would start refusing saves for inputs already in the field.

## ⚠️ The seat that is not at this table

**No seat priced churn or conversion.** Traynor's commercial seat is stood down and his
standing objection applies: *what is the traffic?* — 34 plans, 47 user_settings rows, 5 on
trial, 1 of them 6 days quiet on day 6 of 14. Every ranking here is a judgement about
plausibility, not evidence.
