# Phase 1 Decisions Log

Decisions made autonomously during `redesign/phase-1-tokens` execution.
Logged in real time. Low-risk = stated once. Medium-risk = reasoning included.

| # | Task | Decision | Reasoning |
|---|---|---|---|
| D-001 | Task 1 | Baseline build fails at `/api/webhooks/revenuecat` with `supabaseKey is required`. This is a pre-existing env issue — the route calls `createClient()` at module load time, and the build runner lacks SUPABASE env vars. All other routes pass. Treating as known pre-existing failure; not blocking Phase 1. | Pre-commit hook excludes this route class; Vercel has the env vars; TypeScript passes. |
| D-002 | Task 4/5 | ADR-005 and ADR-006 already exist (subscription payments and hybrid generation respectively). New ADRs assigned ADR-007 (Warm Slate palette) and ADR-008 (Single theme only). References in prompt and doc-updates-required.md updated accordingly. | Conservative choice — never overwrite existing ADRs. Next available numbers used. |
| D-003 | Task 7 | `globals.css` currently imports Space Grotesk via Google Fonts. Alignment doc §Priority 3 says remove Space Grotesk references. New globals.css uses Inter-only. Font import updated from `Inter + Space Grotesk` to `Inter` only. `--font-brand` now resolves to `'Inter', sans-serif`. | Alignment doc says Inter-only; font-brand alias retained so components using `var(--font-brand)` continue to work without changes. |
| D-004 | Task 7 | New globals.css retains Tailwind imports (`@tailwind base/components/utilities`) at the top. These are required by the build — removing them would break all Tailwind utility classes used across the app. | Build safety. |
| D-005 | Task 7 | `--bg` changes from `#F7F9FB` (System B off-white) to `#F3F0EB` (Warm Slate). This is a deliberate visual shift and the primary visible change of Phase 1. All other tokens alias through so existing components still render. | Per alignment doc §9 Phase 1 intent. |
| D-006 | Task 8 | `applyTheme()` function left in place as a no-op rather than deleted. Call sites at lines 197 and 401 remain; function body replaced with single comment. This avoids a TypeScript error if any call site is missed. | Prompt instruction: "replace the function body with a comment and leave the function as a no-op so call sites don't break." |
| D-007 | Task 8 | `saveTheme()` function commented out. Its only job was to call `applyTheme()` and write `rts_theme` to localStorage. With dark mode removed, it becomes dead code. Left as comment per ADR-006 one-release rollback window. | Follows prompt: comment, don't delete. |
| D-008 | Task 9 | Calendar screen: `CalendarOverlay.tsx` renamed to `CalendarOverlay.old.tsx`. The import and `screen === 'calendar'` branch removed from DashboardClient. If the `screen` state type includes `'calendar'`, it's removed from the union. | Per prompt Task 9. |
| D-009 | Task 9 | Welcome screen: trigger code (`showWelcome` state set to `true`) commented out. Component code left in place. Welcome screen effectively dead but component file intact. | Per alignment doc — "retired", not deleted. |
| D-010 | Task 10 | CLAUDE.md: references to ADR-005 (subscription payments) and ADR-006 (hybrid generation) retained under their correct subjects. New ADR-007 and ADR-008 added where docs mention "palette" and "theme" ADRs. | Not changing the ADR numbering system — just adding the new ones. |
