# Coaching Board — STRENGTH-RECOVERY-01 re-sitting (2026-10-17)

**Why re-sat:** two premises of the morning's ruling (`strength-engine-boards-2026-10-16.md` § STRENGTH-RECOVERY-01)
were found false at build.
1. *"A same-day lightening … applies silently with a visible reason, as the run version does."* The run version does
   **not** apply silently: `buildReadinessAdjustment` sets `requiresConfirmation: true`, and §59's surface is
   *"User accepts → softening applied; user rejects → row reverts."*
2. *"Heavy legs become upper body and core."* True by subtraction for a full-body session. A lower + core session has
   no upper-body work, so reaching "upper + core" means **adding** exercises it never had.

## 🔍 Conflict scan
- **§59 (pre-session readiness), surface paragraph:** the runner decides. The original ruling's "silently" contradicted it.
- **§59 RHR noise-hardening:** a lone RHR bump is already a known false positive; another reason the runner decides.
- **S3 (never skip, convert):** written for PLACEMENT (too few legal heavy days), where building an upper day is the
  point. It is not a licence to build a new session on the day.
- **S6 (dose):** the deload factor (0.6) is the reused dose. **S8:** no plyometrics on an eased day.
- **ADR-012:** a recovery ease is `high` magnitude (`reshapeMagnitude.ts`): confirmed, never silent.

## Seats
**🏃 Hutchinson.** The run asks because §59 says the runner decides, and a wrong ease teaches them to ignore the signal.
Strength cannot be the one place it does not ask. And on point 2: "subtract only" means what it says. A session you
did not have is not a lighter version of the one you did.
**💪 Blagrove.** Agreed. On a bad night, upper-body work is not free: sleep loss costs strength everywhere, not just in
the legs. Lower + core keeps its core and its calf work at the deload dose; that is still ten useful minutes, and the
habit survives. Full-body keeps its upper and core work, lighter.
**🎯 McMillan.** One question, one answer. If the run card is on screen, its answer covers the strength session too.
"Run it anyway" and then a lighter gym session would read as the app ignoring them. On a day with no run card, the
strength session asks the same question itself.
**🩹 Willy.** Calf and soleus work stays at the deload dose if the session had it. Never added if it did not.
**⚕️ Sims.** This helps the luteal case more than any threshold: a runner who knows her cycle can say "do it anyway".
Recorded again: cycle-aware thresholds stay moot without cycle data.
**📊 Seiler.** No objection; strength is outside §1.

## ⚖️ Ruling: CORRECT WITH AMENDMENT (supersedes the two premises; the rest of the morning's ruling stands)
1. **The runner decides, as for a run (§59).** A strength ease is proposed, never applied silently. On a day with a run
   ease card, the runner's answer covers both sessions (one change, one reason). On a day with no run ease, the strength
   session carries the same question. How it looks is the Design Board's (`READINESS-SURFACE-01` item 2).
2. **Subtract only, literally.** An eased session holds **only exercises the original held**, never more sets or reps
   on any of them, and no plyometrics. Heavy legs: the lower-body lifts go, except calf/soleus work, which stays at the
   deload dose; whatever upper and core work the session had stays, at the deload dose. So full-body becomes upper +
   core + calf; lower + core becomes core + calf. Every other session drops to the deload set count.
3. **Storage is not this board's**, but the rule above needs a stored answer (the runner's yes), so "derive on read
   from health samples" alone is not enough. Architecture, at build.

## 📦 Artifacts
1. Principle — `StrengthPrinciples.md` **S13** (new).
2. Numeric — `STRENGTH_CONFIG.RECOVERY_SET_FACTOR` (= `DELOAD_SET_FACTOR`, named so it can diverge by ruling).
3. Invariant — `S-RECOVERY-SUBTRACT-ONLY` (`packages/strength/validate.ts → recoveryEaseViolations`).

## ↗️ SLT escalation
None.
