# STRENGTH-NOTE-01 — the weekly strength coach note (2026-10-17)

**Input:** founder instruction, verbatim: *"Yes I want the optional coach note."* (ADR-024 §6b, priced at
<1¢/runner/month on Haiku.) **Tier:** PAID, behind the strength release gate (admin-only until release).

## Analysis
- **Change:** one AI-written sentence or two about the runner's strength week, cached per week, optional and
  silent on failure (ADR-006).
- **Reuse:** the `plan-weekly-note` pattern end to end: `guardAiRequest` (auth body + rate limit), `callAnthropic`
  (the one owner, logged to `ai_call`), `buildVoiceHeader` (house voice, no em dash, banned phrases), Haiku,
  `CoachNoteBlock` with `aiGenerated` (AIMark provenance). New: surface `strength-weekly-note`, a prompt builder,
  an output guard.
- **Storage:** a `weekly_notes jsonb` column on `strength_plans`, keyed `"<week_n>:<hash of the week's sessions>"`,
  so a re-placed week never shows a note about sessions it no longer has. Added to `20261016_strength_plans.sql`,
  which is **not yet applied**, so no third migration.
- **Consumers:** the strength session screen only. Website: none. Push: none.
- **Risks → mitigation:** an outcome claim (*"prevents injury"*, *"makes you faster"*): the prompt forbids it AND
  `parseStrengthNote` refuses a note that makes one, so a model slip shows nothing rather than a claim. A note
  that tells the runner to change the prescription: forbidden in the prompt; the note cannot touch the plan.

## 🧭 Design Board (short sitting) — SHIP
Placement: **the strength session screen, under the tiles**, as the existing `CoachNoteBlock` labelled *"This
week"* with `aiGenerated`. **Not on Today** (Today already shows the session; a second line there would say it
twice) and **not on Plan** (the run's weekly note owns that screen's coach card). Absent, loading or failed =
nothing renders: no skeleton, no placeholder. The note simply arrives (calm, not broken).

## 🏃 Coaching Board (short sitting) — CORRECT WITH AMENDMENT
The note describes the week; it never prescribes. **Amendment (Blagrove, Hutchinson):** no claim about what
strength *does* for running or injury, and no instruction to add or cut work. Willy: if the week is
`legs_limited_by_run_week`, the note may say legs were kept to the safe days, never that the runner should add
them back. Mechanical: `strengthNoteRules.test.ts`.

**Acceptance:** a cached note per week; a failed or refused call renders nothing; the claim filter is falsified.
