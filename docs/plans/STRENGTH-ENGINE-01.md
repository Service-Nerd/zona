# STRENGTH-ENGINE-01 — build plan

**What:** a separate, PAID strength & conditioning engine that reads the run plan and never writes it.
**Architecture:** `docs/architecture/ADR-024-strength-engine.md` · diagram `ADR-024-strength-engine-hld.svg`.
**Evidence:** `docs/investigations/strength-conditioning-research-2026-10-16.md`, `strength-split-research-2026-10-16.md`.
**Rulings:** `docs/decisions/strength-engine-boards-2026-10-16.md`. **Status (2026-10-16):** Phase 0 nearly done; nothing built.

## Decided

| | |
|---|---|
| Goals | Injury resilience (designed for, never claimed) · finishing the plan · performance |
| Focus | Running-focused **and** general, both v1 |
| Sessions | 30 / 45 / 60 min, RAMP warm-up included |
| Split | Engine chooses from strength days: 1 FB (maintenance) · 2 FB×2 · 3 FB×2 + upper/core · 4 U/L×2 (proposed, §6a) |
| Placement | Heavy legs follow §7: after quality, else easy day 48 h clear, else upper/core. Never skipped |
| Core | Most sessions, ≥2 exposures/wk. Upper body placed by the split |
| Catalogue | 80+ exercises, by muscle group and equipment, unilateral emphasis for running focus |
| Dose | Sets/reps/RIR are variables from a prescription model, never on the exercise |
| Tier | PAID; **admin-only first** via `STRENGTH_RELEASE`, not a tier check |
| Media | Licensed animations (e.g. WorkoutLabs ~$1,200/yr). No embedded YouTube |
| AI | Engine deterministic. AI drafts the catalogue for review (~$1–3 once); optional Haiku weekly note (<1¢/runner/month) |
| Storage | Own tables, cascade-deleted with the account |
| Success | Share of starters completing ≥1 session/week over 4 weeks |

## Phases

| Phase | Build | Gate before it starts | Exit |
|---|---|---|---|
| **0. Doctrine** | Strength seat rules on the §6a split table and the numbers (ACSM 2026 now read) · `StrengthPrinciples.md` v1 · `STRENGTH_CONFIG` · `docs/contracts/strength-engine.md` · `FEATURE_GATES` free strength line removed (SLT ruled wholly paid) | — | Rulings recorded |
| **1a. Skeleton** | `packages/strength` types, `StrengthProfile`, `RunContext`; `lib/strength-bridge` adapter; boundary test (no imports either way) | Phase 0 | Bridge runs over the run-plan corpus |
| **1b. Catalogue** | 80+ entries (pattern × equipment × level, unilateral + bilateral, core, upper push/pull, `avoid_with` injury tags). AI drafts, a person and the strength seat review every entry | 1a | Coverage check: no gap in the grid |
| **1c. Engine** | Split chooser · placement (§7 slots) · prescription model (RIR, phase dose, deload/taper) · time packer (supersets) | 1b | Plans generate for every profile |
| **1d. Validator** | `validateStrengthPlan()` invariants, each falsified; liveness mutations; sweep over the run-plan corpus | 1c | **Zero violations across the sweep** |
| **1e. Plumbing** | Migration (`strength_plans`, `strength_completions`, cascade) · API routes behind `canUseStrength` · admin-only | 1d | Founder (admin) gets a plan JSON |
| **2. App** | Design Board first. Wizard questions, Today sub-card under the run, session screen, per-set logging; optional Haiku weekly note | 1e + Design Board ruling | Founder tests on a device |
| **3. Media** | Licence animations, wire every entry | Vendor contract (SLT) | Every entry animated |
| **4. Learn** | Progression from logged sets/RIR; v2 load signal into the run engine (Coaching Board first) | Logged data exists | Board ruling |
| **Release** | Flip `STRENGTH_RELEASE` to `'paid'` | December cohort mid-plan · SLT | Paid + trial can use it |

## Not decided

Exact numbers (strength seat, Phase 0) · whether strength counts toward run fatigue (v2, board) · media vendor and
cost (SLT) · screens (Design Board) · conversion impact (no commercial seat; unanswered).
