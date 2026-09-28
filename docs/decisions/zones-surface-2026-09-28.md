# Training Zones surface — Design Board + Coaching Board, 2026-09-28

Two sittings on one question, and a measurement taken *after* the rulings that moved the
scope. Recorded because the rulings stand and the build does not follow from them directly.

---

## The question

Founder, with three competitor screenshots: *"They put their hr zones under a sub menu
which also does pace. Can we do that? Should we do that? I like that. Can we link off the
coach page? Should we?"*

## Design Board — ZONES-SURFACE-01 — SHIP WITH AMENDMENT

**Yes to the surface, no to Coach.**

- **Entered from Me, replacing the existing zone rows.** Collins: **fourteen surfaces
  already render zone information**; a fifteenth that explains the other fourteen "is not
  a screen, that is an admission". So it consolidates rather than adds.
- 🔴 **Not Coach.** `screen-architecture.md` lists *"Profile or settings"* under Coach's
  **does not belong**, and **Coach is paid-only while zone content is FREE** — linking it
  there strands free runners from their own zones.
- **Lead with the ceiling** at display size ("not faster than"), rest as rows. Silvanto:
  the reference elevates one number and it happens to be our proposition.
- **Toggle defaults to what the data supports; never an empty tab** (Wroblewski).
- 🔴 **Our labels. Z3 is the grey zone, not "Tempo"** — Collins' argument, adopted. A
  reference table that tells you *where not to live* is the most on-brand object in the
  app, and a competitor selling encouragement cannot ship it.

## Coaching Board — ZONES-BEGINNER-BANDS-01 — CORRECT WITH AMENDMENT

🔴 **The premise was conflated.** §24b is the only section naming `marathonPaceStr` /
`hmPaceStr` and it governs long-run **segments** on time-targeted **5K/10K** plans — while
gating selection on those very fields. **The band is the switch.** The engine applies the
null to every beginner regardless of distance, so **a beginner training for a marathon has
no marathon pace band**, justified by a 5K/10K long-run rule.

**Ruled:** four bands, silence where the other two would be. **Do not un-null the fields**
— that would start prescribing §24b segments to beginners, a load change arriving through
a UI ticket (Willy). McMillan's dissent preserved; Sims' §13 caveat recorded.

---

## 🔴 Why it was not built, and what changed after the rulings

The brief told the Design Board *"we already compute six pace bands"*. **True of the
engine; false of the client.**

| Finding | Measured |
|---|---|
| `lib/plan/ruleEngine` may not cross into a client bundle | `BUNDLE-BOUNDARY-01` — *"generate on the server and pass data"* |
| `/api/race-times` already owns the VDOT-resolution chain (five signal states) | It is **PAID** (`race_time_estimates`), while zones are **FREE** |
| 🔴 `meta.vdot` presence across **all 21 stored plans** | **10 present, 11 absent** — tracking `meta.benchmark` exactly |

**The third one changes the design.** The pace ceiling the board ruled should *lead* the
screen is unavailable to **52% of runners**. That is not a defect — no benchmark, no
derived paces — but it means the HR Z2 ceiling is not a fallback, it is the **equal-status
twin** of the pace ceiling. *"Not above 145 bpm"* is the same sentence as *"not faster than
13:12"*, and for half the population it is the only one available.

**The rulings stand.** The build is re-specified with this measurement in `backlog.md`.

## What still has to be decided at build time

1. How the pace maths reaches the client: extract the band derivation into a pure module
   both the engine and the client can import, or a new FREE route. **Extracting is
   preferred** — a second producer of pace bands is the duplication class this repo keeps
   paying for.
2. Whether refactoring the VDOT chain out of a PAID route to serve a FREE one needs the
   SLT. Probably not — no tier changes — but it is a paid route being opened up.
