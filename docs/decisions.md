# Decision Log — ZONA

Decisions recorded here to prevent re-litigation and context loss
across sessions and contributors.

---

## Design System — System B (Locked)

**Decision:** Use System B palette exclusively. No exceptions.

**Why:**
The original palette (ember orange `#D4501A`, warm beige `#f5f2ee`,
DM Mono, DM Sans) was replaced during a deliberate rebrand to ZONA.
System B (navy, off-white, teal, amber) better represents the calm,
disciplined coaching tone. Palette regressions have been the #1
source of wasted time in this project. System B is locked to end that.

**Rule:** All colour via CSS custom properties in `globals.css`.
Nothing hardcoded in components. Ever.

---

## CSS Token Strategy — globals.css as Single Source

**Decision:** All CSS custom properties live in `globals.css` only.

**Why:**
Hardcoded values scattered across components caused repeated palette
regressions when AI sessions lost context. Centralising tokens means
a single file controls the entire visual system. Any regression is
immediately obvious and fixable in one place.

---

## `applyTheme()` — Attribute Toggle Only

**Decision:** Theme switching only toggles `data-theme="dark"` on `<html>`.
No `setProperty()` calls.

**Why:**
`setProperty()` calls override the stylesheet cascade, breaking token
inheritance. The attribute toggle lets the CSS handle everything
cleanly via `[data-theme="dark"]` selectors in `globals.css`.

---

## Global State Fetched at DashboardClient Level

**Decision:** Overrides and settings are fetched once at `DashboardClient`
and passed as props to all child components.

**Why:**
Fetching in individual components caused duplicate API calls,
race conditions, and flash/inconsistency in the UI. Single fetch,
props down is simpler and more predictable.

---

## Plan Data in GitHub Gist (JSON)

**Decision:** Training plan lives in a GitHub Gist, fetched with
`cache: 'no-store'` on every request.

**Why:**
Allows plan updates without a code deploy. The Gist is the source of
truth for session data. Fast iteration during active training build.

---

## Plan Output = JSON First, Never Direct-to-DB

**Decision:** Plan creation and reshaping always produce JSON output.
JSON is reviewed/validated before any DB write.

**Why:**
Direct-to-DB writes from AI-generated plans are too risky. JSON-first
gives a validation checkpoint and makes debugging straightforward.
Plan creation (R23) and reshaping (R20) are deliberately separate
flows to keep complexity contained, but they share the same schema.

---

## FREE vs PAID Feature Split

**Decision:** All features tagged FREE or PAID before build begins.

**Tiers:**
- FREE: Generic templates, no Strava, no dynamic coaching
- PAID: Everything intelligent — AI coaching, dynamic reshaping,
  Strava integration, plan generator with athlete variables

**Why:**
Without explicit tagging, features drift into PAID territory
accidentally, undermining the freemium model. Tag first, build second.

---

## Strava OAuth Testing via Hoppscotch

**Decision:** Strava OAuth token exchange always done via Hoppscotch
(hoppscotch.io), not curl in Terminal.

**Why:**
Multi-line curl in Mac Terminal consistently fails for this flow.
Hoppscotch handles `application/x-www-form-urlencoded` POST cleanly.
Auth codes expire in ~5 minutes and are single-use — failed attempts
waste the code.

---

## No Popups Policy

**Decision:** All interactions navigate to full screens. No modal popups.

**Why:**
Popups interrupt flow and feel inconsistent with the calm,
one-job-per-screen design principle. Full screens with a back arrow
(top-left) are predictable and easier to implement consistently.
Slide-up sheets use a mirrored nav bar at the bottom.

---

## Release Discipline — One at a Time

**Decision:** One release shipped completely before starting the next.

**Why:**
Parallel releases cause conflicts, half-finished states, and context
confusion across sessions. Ship clean, then move forward.

---

## TypeScript — Array.from() over Spread on Sets

**Decision:** Use `Array.from(seen)` not `[...seen]` for `Set<string>`.

**Why:**
Spread on `Set<string>` fails in the current TypeScript target config.
`Array.from()` is explicit and safe.

---

## Session Schema — Structured Fields vs Legacy Detail

**Decision:** Two-tier session data model. Structured fields are preferred; `detail` is legacy-only.

**Structured fields (generator output):**
```
distance_km, duration_mins, zone, hr_target, pace_target, rpe_target, coach_notes
```

**Legacy field:**
```
detail: "10km" | "3h15" | "45 min" — free-text, hand-authored gists only
```

**Rules:**
- The R23 generator always writes structured fields. `detail` is always `null`.
- Hand-authored gists (legacy) use only `type`, `label`, `detail`.
- The app prefers structured fields; falls back to `parseSessionDetail()` for legacy.
- New gists should use the structured format. All new plans from R23 onward are structured.

**Why:**
A single schema eliminates the parsing ambiguity and makes session data
machine-readable for R18 confidence scoring and R20 plan reshaping.

---

## HR Zones — Karvonen HRR, No Hardcoded Values

**Decision:** All HR zone calculations use the Karvonen Heart Rate Reserve formula.
No hardcoded zone values anywhere in the codebase.

**Formula:** `zone_bpm = restingHR + (pct/100) × (maxHR − restingHR)`

**Zone mapping used in the app:**
| Session type | Zone | HRR % range |
|---|---|---|
| easy / run | Zone 2 ceiling | 60–70% |
| quality / tempo / intervals / hard | Target HR | 75–85% |

**Fallback chain (if HR data absent):**
1. `session.hr_target` (generated plan stores this at creation time)
2. Karvonen from user's stored `resting_hr` / `max_hr`
3. `plan.meta.zone2_ceiling` (plan-level stored value)
4. Show nothing — never guess

**Why:**
A 145 bpm Zone 2 ceiling for one athlete is Zone 3 for another.
Hardcoded values are meaningless and erode trust in the coaching data.

---

## Aerobic Pace — Strava-Derived, No Estimation

**Decision:** Displayed pace comes from the user's actual Strava runs
filtered to their personal Z2 HR band. No formula-estimated fallback.

**Logic (`computeAerobicPace`):**
- Filter Strava runs where `average_heartrate` falls in user's 60–70% HRR band
- Average pace across last 6 qualifying runs
- Return formatted string (e.g. `6:45/km`) or `null` if no data

**Why:**
A formula-estimated pace (e.g. adjusting 6:30/km by HR offset) looks
authoritative but is often wrong. Showing nothing is more honest than
showing a wrong number. Athletes with Strava data see their real pace;
athletes without see nothing — both are correct behaviours.