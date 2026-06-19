# CO-ONE — Implementation Handoff: Consolidate the Coach screen

> **For Claude Code, working in `rts-training-hub`.** This is a build spec derived from an approved design (SLT-passed). It implements the screen-architecture rule *"Kit appears once, as a coherent voice. Multiple disconnected Kit cards are a layout failure — consolidate."*
> **Target:** `app/dashboard/DashboardClient.tsx → CoachScreen` (~line 7728) and the shared components it renders.
> **Tier:** structural / FREE (no new gated capability — this reshapes existing surfaces). Confirm against `feature-registry.md` before starting.
> Trigger `frontend-design`. Use the SLC framing below. Apply the `CLAUDE.md` voice table to all copy.

---

## The change in one sentence

Replace Coach's stack of ~11 sibling surfaces (several carrying their own `CoachByline`) with **one authored Kit read** at the top — single byline, single AIMark — above an **unvoiced evidence tier** (rings → stats → trends → ledger). Conditional signals fold *into* the read as sentences, not as sibling cards.

---

## Decision: Option A "Woven" (with Option B "Margin notes" as the sanctioned fallback)

- **A — Woven (build this):** the read is one paragraph — headline + woven body (conditional signals as priority-ordered sentences) + an italic action line. Dismissal is **off-surface** via a single "Manage what Kit watches →" link → sheet of per-signal 14-day mutes.
- **B — Margin notes (fallback only if review insists dismissal must be visible inline):** core synthesis + discrete flag lines under the *same* byline, each with an inline `×`. Same consolidation; more surface + dismiss chrome.
- Do **not** build C (priority-lead/demotion) — rejected for giving the runner no control over a stubborn secondary signal.

Reference mockup: `Coach — CO-ONE.dc.html` (this project) shows A, B, C, plus empty + loading states and the evidence sequence.

---

## 1. The one read — structure & assembly

One card. `--card` bg, `1px --line`, `--radius-lg`, **3px `--moss` left rail** at `left:8px`, padding `18px 20px 18px 22px`. Eyebrow: **one** `<CoachByline color="moss" role="This week" working={loading} />`. This is the only AIMark/byline on the screen.

**Body assembly (rule-ordered, then voiced).** Build the read from the signals already computed in `CoachScreen`, in this priority order. Highest-severity leads the headline; the rest become body sentences:

| Priority | Signal | Source already in CoachScreen | Folds in as |
|---|---|---|---|
| 1 | Race window (daysToRace 0–14) | `isRaceWindow`, `/api/race-readiness` | Leads: "Race in {n} days." |
| 2 | Phase change | `phaseJustChanged`, `/api/phase-summary` | Leads if no race: "You've crossed into {phase}." |
| 3 | Zone drift | `zoneDriftPattern` | Sentence: "{count} of your last {total} easy runs crept above Zone 2." |
| 4 | Benchmark staleness | `benchmarkRecalDismissedAt` + benchmark age | Sentence: "Your benchmark's {n} weeks old — pace targets going soft." |
| 5 | Base synthesis | `weeklyReport` (`/api/weekly-report`), `sessionsCompleted/Planned`, `loadRatio`, `currentScore` | The default headline + body + action line |

- The **weekly report** (`headline` / `body` / `cta`) remains the spine when no higher-priority signal fires; the `cta` becomes the italic action line.
- Race-readiness and phase-summary are **mutually exclusive** (race suppresses phase) — preserve that.
- Provenance: the read is genuine model output → byline + AIMark stay. The empty-state line is **hand-authored** → dimmed identity, **no AIMark** (see §4).
- Keep the existing **"Generate report" / "Refresh"** button and `ShareWeekButton` attached to the read.

**Remove as standalone cards** (their signal now lives in the read):
- R28 phase-summary card · R29 race-readiness card · R30 zone-drift card · the first-open coach-intro card (`zona_coach_intro_seen`) · the separate "Kit identity" headline card. Collapse the identity card and the weekly-read card into the single read.

---

## 2. The evidence tier — unvoiced, fixed order

Below the read, in this order (recency → scope). **None carry a `CoachByline` or `AIMark`.**

1. **ZoneRings** (Pattern 25) — `This week in zones`. Unchanged.
2. **2×2 stats** — zone discipline · load ratio · sessions · weeks left. Keep the tap-to-open **info sheets** (zone discipline, load ratio) — those are hand-authored education, correctly byline-free.
3. **TrendCards** (aerobic + easy) — **numbers only. Strip the AI gloss + its `CoachByline`** on the Coach placement (see §3).
4. **LedgerCard** — "Weeks within the lines". Unchanged (already rule-derived, no byline).

---

## 3. Provenance fix (critical — don't skip)

`TrendCard` (Pattern 29) currently renders a model-written gloss sentence with its own `<CoachByline role="Aerobic trend" />`. That's a second voice → it violates CO-ONE.

- On the **Coach consolidated screen**, render TrendCards **numbers-only**: the metric pair (`earlierHr → nowHr`) + eyebrow, **no gloss, no byline, no moss rail**.
- The trend *interpretation* moves into the **read** when meaningful, e.g. folded sentence: "Easy is easier than it was — 166 down to 149 since February." Drive this from the same `/api/coaching/trend` `hrIsTrending` signal that today gates the gloss.
- Net: exactly one model voice on the screen. `AIMark`/`CoachByline` provenance honesty (Pattern 16/16b) holds — mark only the read.

---

## 4. States

- **Loading** (`loading` / report in flight): `<CoachByline working />` (pulsing sparkle, not a spinner) + three shimmer lines 85/100/70% at `rgba(107,142,107,0.12)`. ZoneRings skeleton; stat tiles shimmer. Structure-independent.
- **Empty / no data** (no analysed runs, nothing to synthesise): read collapses to a **dimmed Kit identity (opacity ~0.45) with NO AIMark** + one hand-authored line — *"Nothing to read yet. Link a run with heart rate and I'll have something to say."* + a moss "Connect a run source →" routing to the Profile connection rows. ZoneRings empty silhouette; stats em-dash; trends pending; ledger empty. (Mirror the existing dimmed-byline empty pattern used in `LockedCoachingPreview`.)

---

## 5. Dismissal — per-claim, off-surface (Option A)

Today two signals are independently dismissable: zone drift (`onDismissZoneDrift` → `zoneDriftDismissedAt`) and benchmark recal (`onDismissRecal` → `benchmarkRecalDismissedAt`). When they fold into prose, an inline `×` doesn't fit.

- Add a single **"Manage what Kit watches →"** link in the read's footer → opens a slide-up sheet (reuse the existing sheet keyframes `vetra-fade-in` / `vetra-slide-up`; full-screen-style, no modal popups per UI principles).
- The sheet lists each **currently-active foldable signal** (drift, benchmark staleness, and any future foldables) with a **mute-for-14-days** toggle.
- Muting a signal suppresses its sentence from the next read. **Reuse the existing dismiss persistence** — `zoneDriftDismissedAt`, `benchmarkRecalDismissedAt` and their 14-day windows — rather than inventing new state. New foldable signals follow the same `…DismissedAt` + 14-day pattern.
- Race-readiness / phase-summary / the base synthesis are **not** mutable (they're the synthesis, not nudges).

*(Fallback B: if review mandates visible inline dismissal, render the foldable signals as discrete flag lines under the one byline, each with an inline `×` that calls the same dismiss handlers. Skip the sheet.)*

---

## SLC

- **Simple** — one Kit read owns the voice; everything below is unvoiced evidence. No card speaks twice.
- **Lovable** — restraint applied to the app's own UI; Kit says it once and means it.
- **Complete** — race/phase/drift/benchmark fold into the read by priority; trends go numbers-only; info-sheets preserved; empty + loading handled; dismissal reuses existing persistence.

## MUST/NEVER check

- No modals/popups → the manage sheet is a slide-up, not a dialog. ✅
- AIMark/CoachByline only on model output → read only; evidence + empty line carry neither. ✅
- No hardcoded colours/fonts → tokens only (`--moss`, `--warn`, `--ink`, `var(--font-ui)`…). ✅
- No gamification. ✅

## Files & components touched

- `app/dashboard/DashboardClient.tsx → CoachScreen` — the consolidation (remove standalone R28/R29/R30/intro/identity cards; build the assembled read; add manage sheet).
- `components/shared/TrendCard.tsx` — add a numbers-only / no-gloss mode (or a `glossless` prop) for the Coach placement; keep the standalone gloss variant for any other surface that still wants it.
- `components/shared/CoachByline.tsx`, `AIMark.tsx` — no change; reuse.
- Data sources unchanged: `/api/weekly-report`, `/api/race-readiness`, `/api/phase-summary`, `/api/coaching/trend`, `zoneDriftPattern`, benchmark age.

## Risks to existing features

- The read-assembly priority logic must preserve the **race-suppresses-phase** mutual exclusion already in `CoachScreen`.
- `ShareWeekButton` + "Generate/Refresh report" must stay wired to the read.
- TrendCard's glossless mode must not break any **other** screen that renders it with gloss — gate behind a prop, don't delete the gloss path.
- Update `docs/canonical/ui-patterns.md` Pattern 29 (TrendCard) and the Coach composition section in the same commit (provenance rule now says: gloss only off-Coach).
