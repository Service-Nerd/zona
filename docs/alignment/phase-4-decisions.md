# Phase 4 — Decisions Log

Decisions made autonomously during Phase 4 polish. Low-risk or medium-risk calls logged here.

| # | Task | Decision | Reasoning | Risk |
|---|------|----------|-----------|------|
| 1 | T2 | Moved Phase 1 and Phase 2 alignment docs to /docs/historical/ | Completed phases, no active cross-references by path | Low |
| 2 | T2 | Moved doc-updates-required.md to historical | Planning doc for Phases 1-2, all priority items executed | Low |
| 3 | T2 | Moved pending-adjustment-debug.md to historical | Investigation for parked feature, findings captured in plan-adjustments-parked.md | Low |
| 4 | T2 | Moved design-audit.md to historical | April 19 audit of System B palette, now retired — stale truth | Low |
| 5 | T4 | BenchmarkUpdateScreen entry point placed in "Your training" section, grouped with plan button | Benchmark is a training-related action, not a profile action. Two-row card matches race prep section pattern | Low |
| 6 | T7 | Hero adverb fatigue aware: only overrides easy/recovery/run, not quality/intervals | Hard sessions should stay hard regardless of fatigue trend — heavy fatigue doesn't change race intent | Low |
| 7 | T7 | First name in hero: "Russ, you run" — uses firstName prop already passed | Existing prop, zero new data. Friendly without being over-familiar | Low |
| 8 | T7 | Injury notes only added for achilles, knee, shin splints (top 3 from chip list) | Other injuries (back, hip, plantar) don't have specific running-form advice at this level; would need more precision | Low |
| 9 | T10 | CoachScreen loading: static placeholder divs accepted (not canonical shimmer) | Loading state IS present and functional. Shimmer refactor would require redesigning the whole CoachScreen report card — out of Phase 4 scope | Low |
| 10 | T10 | No functional empty/loading/error state gaps found in active screens | All screens have at minimum: loading guard, error inline, empty state message | Low |
