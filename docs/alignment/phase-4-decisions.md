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
| 11 | Device test 2026-04-24 | Nav: Coach surfaced directly in nav bar for paid/trial users (Today\|Plan\|Coach\|More). Free users keep Today\|Plan\|More (Coach stays in More as teaser). | Coach is a paid-tier differentiator; hiding it under More reduced perceived value for paying users. | Low |
| 12 | Device test 2026-04-24 | Header strategy: Option B selected — Today screen keeps distinctive ZONA wordmark (it's the home, not a nav destination). Plan/Coach/Profile to converge on one pattern. Do not build until analysis complete. | Today is primary screen, wordmark is intentional brand moment. Other screens are secondary nav destinations and need consistency. | Low |
| 13 | Device test 2026-04-24 | Nav hidden during onboarding (screen === 'generate' + no plan). Prevents new users seeing Today/Plan/More before they have a plan. | Nav items are meaningless without a plan. Also fixes sticky CTA being obscured by nav bar. | Low |
| 14 | Device test 2026-04-24 | Wizard: Age field replaced with Date of Birth. Enables birthday messaging in future; eliminates annual recalculation. DOB stored in user_settings. | DOB is strictly more useful — same information + future personalisation without extra cost to user. | Low |
| 15 | Device test 2026-04-24 | Wizard: weekly km, longest run, max weekday session → structured chip selectors. Reduces free-text anxiety; faster completion. Rule engine receives mapped numeric values. Ultra runner ranges included (weekly 100km+, weekday sessions up to 3hrs). | Chips are faster and lower friction. Precision loss is acceptable — plan generator doesn't need exact values, ranges are sufficient. | Low |
| 16 | Device test 2026-04-24 | Wizard: target time and benchmark finish time → DurationPicker (stepper, same pattern as manual run log). | Free-text time entry is error-prone. Stepper validates format implicitly. | Low |
| 17 | Device test 2026-04-24 | Enricher prompt: banned frequency-based week labels ("Light", "Heavy", "Moderate"). Phase-based language only. | Calling a 3-day schedule "Light" judges the user — contradicts Zona's core positioning. | Low |
| 18 | Brand review 2026-04-24 | brandStatement updated to "You can't outrun your easy days." Removed from login footer (tagline already owns that space — two punchlines dilutes both). Kept on privacy footer and meta description. login footer now shows privacy link only. | Cleaner login. brandStatement earns its place on dry legal pages; redundant after the tagline on login. | Low |
| 19 | UX-03 2026-04-24 | Plan header: race name as title, "W{n} of {total} · {days} days to go" as sub. Replaces generic "Your plan" + separate countdown. | Race name as headline is more personal and differentiating — you're training for *your* race, not a generic plan. Consistent with coaching relationship framing. | Low |
| 20 | UX-03 2026-04-24 | Profile header: text back-arrow pattern (matches GeneratePlanScreen drill-down pattern). Title = first name. Sub = race + days if set. | Consistent drill-down pattern across all non-tab screens. Profile sub reinforces the race goal — the app knows who you are and what you're training for. | Low |
| 21 | UX-03 2026-04-24 | Coach header sub: "Russ · W5 of 18" (was "W5/18"). Consistent week format across Plan and Coach. | One format for week context throughout the app. | Low |
