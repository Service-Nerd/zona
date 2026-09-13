# Coaching Board — charity-cohort fitness-for-audience review, 2026-09-13

**Trigger:** none — no doctrine file changed. Soft-trigger *review* ahead of the first
charity referral: does the existing prescription need to change for the incoming
population (first-timers running 10K / HM / marathon for a cause — low base, injuries
common, finish goals, sometimes compressed, often masters)?

**Question:** Are the delivered-volume `warn` residuals that cluster on the charity
profile (masters + injury + low base) acceptable to ship, or must one become an `error`
/ gain a lever before the referral?

**Ruling: CORRECT — fit to ship as-is.** No doctrine edit required. Two watch-items and
one SLT escalation recorded below.

---

## Evidence

11 named charity personas (`lib/plan/charityCohort.ts`), each generated and run through
`validatePlan`. **All pass with 0 error-severity violations, or refuse by design.** The
honesty layer (maintenance classification, long-run-shortfall notes) works well. The
`warn` residuals cluster on the charity profile:

| Persona | Residual(s) | The number underneath |
|---|---|---|
| T3 masters 10K + knee (55, 20km/wk) | `INJURY-CAP-DELIVERED`, `PEAK-NOT-BELOW-START`, `DELOAD-PHASE-POSITION` | +38% trimable = **8→11km, +3km absolute**; delivered peak 19km vs current 20km |
| M5 masters marathon (58, 30km/wk) | `DELIVERED-RAMP` +25% | **40→50km, +10km** wk13→14 |
| M3 returning marathon + knee | `BOUNCEBACK-BOUNDED` | post-deload delivered ≥ pre-deload |
| M1 first-timer marathon (15km/wk) | `DELOAD-PHASE-POSITION`, `DELIVERED-RAMP` +21% early | low base |
| M4 sub-4 marathon, 3-day | **by-design refusal** | §44 days-minimum |

---

## Conflict scan

Touches §2 (`DELIVERED-RAMP`), §12/§90 (`INJURY-CAP-DELIVERED`), §52 (race-anchored long
run — the reason these are `warn` not `error`), §87/§95 (`DELOAD-PHASE-POSITION`), §106
(`PEAK-NOT-BELOW-START`), §34 (honest residual). **No new conflict.** Every residual is
already named to a section and already ruled `warn`. The tighter healthy +20% cap was
**measured and rejected by this board on 2026-09-06** (+50pp of plans → "constrained" for
zero safety benefit) — settled, not reopened.

---

## Board

- **Hutchinson (chair):** T3's "+38% over a 5% cap" is +3km absolute on a low base — a
  percentage cap below ~15km trimable measures rounding, not physiology. Residuals are
  honest, named, and *post-fix* (RAMP-PRODUCER-01 halved the ramp-breach rate). The
  charity population makes them more *visible*, not more *wrong*. Ship.
- **Seiler:** not my lens (load, not distribution). M2's compressed 3-day marathon keeps
  quality minimal so the 80/20 session-count holds. No objection.
- **McMillan:** the warns are invisible to the runner; they see an honest, conservative
  plan. One flag: T3 peaking below current 20km can *feel* like a brake to a keen charity
  runner — correct for knee+masters, but the copy should say it's deliberate. Copy, not
  doctrine.
- **Willy:** the injury cap firing at +3km is a false alarm; the instrument is wrong at
  low volume, not the plan. **The real load event is M5** — a 58-year-old, no injury flag,
  +10km week-on-week; `DELIVERED-RAMP` is right to flag it (within the measured post-fix
  residual, not a blocker). An **absolute-km allowance alongside the % cap** would silence
  T3 and sharpen M5.
- **Sims:** for post-menopausal charity runners a plan that only ever *adds* load is the
  bigger risk (bone, tendon, RED-S). T3 holding volume steady is appropriately
  conservative, not under-prescribing — I'd defend it. Caveat: none of this is
  sex-differentiated (no gender input, ADR-011 — unbuildable now).

## Recorded disagreement

**McMillan vs Sims on T3's flat/below-current peak.** McMillan: mild under-prescription.
Sims: correct, even preferable, for masters/injured tissue. **Settles on:** observed
adherence + niggle/injury reports from the charity cohort once live. Preserved.

---

## Watch-items (not blockers)

1. **Low-volume absolute-km allowance** on the injury/ramp caps — removes false alarms
   like T3 (+3km) and sharpens real ones like M5 (+10km). A real but minor future change;
   convenes its own sitting and carries its own three artifacts. **Filed as
   `CHARITY-CAP-ABSFLOOR-01`.**
2. **DELOAD-POS2-01** (deload at phase position 2) remains open and appears on the charity
   marathons — already tracked.

## Artifacts

**N/A** — a CORRECT-as-is ruling changes no doctrine. (Watch-item 1 would carry the three
artifacts if pursued.)

## SLT escalation (commercial, not correctness)

**M4** — the engine correctly refuses to *promise* a sub-4 marathon on 3 days/week, but a
referred charity runner bounced at the door is a commercial event. SLT to decide the
charity-appropriate framing (offer the finish-goal plan warmly, not a bare refusal).
