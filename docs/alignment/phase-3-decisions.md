# Phase 3 — Autonomous Decisions Log

**Branch**: `redesign/phase-3-remaining-screens`
**Started**: 2026-04-23

---

## D-001 — Zone discipline score colour bands: three distinct states

**Decision**: CoachScreen zone discipline score uses `--moss` (80+), `--ink-2` (60–79), `--warn` (below 60) instead of the old `--teal` / `--accent` / `--amber` mapping.
**Why**: With the Warm Slate system, `--teal` and `--accent` both alias to `--moss`, making the middle band (60–79) visually identical to the top band (80+). Using `--ink-2` (warm dark grey) for the middle band restores the three-state hierarchy without adding a new colour.
**Applied to**: `DashboardClient.tsx` CoachScreen

---

## D-002 — GeneratingCeremony shimmer: replace rgba(91,192,190) with var(--moss-soft)

**Decision**: The shimmer CSS keyframe replaced `rgba(91,192,190,0.14)` (old teal hardcode) with `var(--moss-soft)`.
**Why**: D-09 doctrine — old palette values must not survive. The hardcoded old teal would have been a colour regression. `var(--moss-soft)` produces a subtle warm-green tint sweep on the white card background, which is visually equivalent.
**Applied to**: `components/GeneratingCeremony.tsx`

---

## D-003 — Empty App settings section removed from MeScreen

**Decision**: The "App settings" section (with its card shell) was removed entirely from MeScreen. Only the comment noting why is retained.
**Why**: Theme toggle was removed per ADR-008. Smoke tracker was removed per brand-product-alignment v2. The section card was empty. An empty card with a section label is visual noise.
**Applied to**: `DashboardClient.tsx` MeScreen

---

## D-004 — Nav bar icon tokens and retired welcome screen: deferred to Phase 4

**Decision**: Legacy tokens in nav bar icon components (lines 40–96) and retired welcome screen (lines 561–829) were not updated in Phase 3.
**Why**: These are not Phase 3 screen targets. Nav icons and the retired welcome screen are Phase 4 cleanup scope per the roadmap.
**Applied to**: Phase 4 task log

---

## D-005 — Delete account button: --coral → --mute

**Decision**: Delete account button at bottom of MeScreen uses `--mute` with 0.5 opacity instead of `--coral` (which aliases `--s-inter`).
**Why**: `--coral` is a training colour used for interval sessions. Using it for a destructive action mixes semantic meaning. `--mute` at reduced opacity de-emphasises the button (appropriate for a destructive action at the bottom of settings) without borrowing a training colour.
**Applied to**: `DashboardClient.tsx` MeScreen

---

## D-006 — Upgrade screen: trialExpired variant uses --warn not --danger

**Decision**: The loss-framing variant of the Upgrade screen uses `--warn` (amber) for the left-accent on feature rows, not `--danger` (red).
**Why**: N-003/N-005 doctrine — `--danger` is errors only, never training UI, and N-005 prohibits red anywhere. `--warn` is the coaching/advisory colour. A trial expiry is informational, not an error.
**Applied to**: `app/dashboard/UpgradeScreen.tsx`
