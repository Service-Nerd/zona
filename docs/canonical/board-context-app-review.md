# Board context — what to know before reviewing the APP

**Written 2026-09-22, after the website review.** The Design Board's next sitting is the app.
This file is what the board should read first, so the app sitting does not rediscover what the
website sitting already established.

⚠️ **This is CONTEXT, not doctrine.** Rulings live in `design-rulings.md`; scope lives in
`ownership-map.md`. If this file and either of those disagree, they win.

---

## 1. The three findings from the website that will recur in the app

### 🔴 A ruled design can be entirely unimplemented
The founder said the site was *"all the same colour, quite bland as you scroll."* Measured: **10.6
phone-screens before the background changed once.** The cause was not a missing design. W-08 had
specified three grounds — `--bg`, one white spotlight, one dark close — a day earlier.

**There were ZERO `surface=` props in the codebase.** The system was ruled, built and never used.

**Ask of the app first: is this actually unbuilt, or is it built and unused?** It was the second
one on the website, and finding that out cost nothing while designing around it would have cost a
week.

### 🔴 The settled-ground scan stopped a real regression on its first real use
Sitting two ruled *"cut the Three things section."* The scan caught that the section contained
**`ZoneRings`**, which `design-rulings.md` retains as *"one third of the product's public face"*
after a previous reversal. Cutting it would have recreated `PLAN-LONGRUN-COLOUR-01` — the site
promising what the app no longer contains.

**The wrapper died; the trio moved.** Run the scan before any seat speaks, every time.

### 🔴 A check that has not been made to go red is not a check
**Six instances of substring bias in one day**, including `toContain('<ZoneRings')` passing for
`<ZoneRingsX` — the exact trap already written down in the board's own skill file. **Three checks
were green and hollow** until each was broken deliberately.

---

## 2. What the app already is, so the board does not re-propose it

| | |
|---|---|
| **Screens** | Today · Session Detail · Plan · Coach (paid) · Me · Generate-plan wizard · Upgrade · Login |
| **Retired** | Calendar, Welcome screen, Smoke tracker. Strava is admin-URL only |
| **Palette** | Warm Slate, single light theme. **No dark mode** (ADR-008) and no toggle |
| **Semantic pair** | `--moss` = *held the zone* · `--warn` = *cooked it* (P-01). ⚠️ The threshold is the Coaching Board's (`ZONE_DRIFT_ABOVE_CEILING_PCT = 20`); the hue is this board's |
| **Session colours** | Six, plus four phase colours. **Resolve through `getSessionColor(session)`, passing the whole session** — `--s-long` was declared in three places and unreachable for every generated plan until 2026-09-12 |
| **Coach screen** | Already redesigned 2026-09-12 (UX-COACH-01, six registry rows): Kit's read + ZoneRings → the arc → aerobic trend → one link out. **Settled ground — do not re-propose the seven-block teardown** |
| **Modify-plan sheet** | Scoped and shipped (P-02). Bottom nav bar, never a top-right Cancel |

---

## 3. 🎯 The finding the app sitting exists to act on

**The app is more colourful than the website.**

Measured 2026-09-22: the app uses **six session colours and four phase colours** — the plan-shape
strip renders twenty weeks as one blue/amber/red/green bar; cards carry coloured rails. The
**marketing site's own language is `--mute`, `--ink`, `--line`, `--card`, `--bg` and one green.**
Session colours appear in exactly two marketing files, `PhoneFrame` and `PlanPage` — i.e. only
where the app is being *shown*.

**Collins' wave-3 question is still open and it runs in both directions:**
- Should the *site* adopt the app's colour language?
- Is the *app's* colour language actually good, or merely more?

Neither has been ruled. The website answer is blocked on a device pass.

---

## 4. What the founder has said he wants

Quoted, because paraphrase drifts:

> *"I want the customer at the forefront of mind at all times, we want to be standout and
> disrupter in the market. We must have wow factor and make people feel something."*

> *"I want to ensure the pages look consistent, that they are good and look okay when opening on a
> mobile phone."*

**And the reconciliation, already on the record** (Sutherland, Miles teardown): wow comes from
**costly signalling** — a colour that tells you off cannot be A/B-tested into existence and a
competitor whose proposition is encouragement structurally cannot ship it. **Decoration is not
feeling; chrome is not craft.** The paper-grain overlay died because its only argument was that a
competitor had it.

⚠️ **The palette is OPEN by founder ruling (2026-09-22), including `--moss` and `--warn`.** By the
seam rule the Design Board rules the hue and the **Coaching Board rules the meaning** of the
semantic pair — and any change lands in the app *and* the website.

---

## 5. 🔴 The constraint that will shape the whole sitting

**Nothing has ever run on a device.** Not the redesigned homepage, not the Plan arc, not the three
real screens in the marketing phone.

**Two seats are structurally blocked by this:** Silvanto on craft and legibility, Wroblewski on
one-handed phone use. They can rule on structure and measurement; they cannot honestly rule on
*feel*. The website sitting worked because the founder supplied a device pass — **the app sitting
needs one too, and the app cannot be emulated in a browser at all.**

---

## 6. Open items the app sitting will touch

| Item | Board | State |
|---|---|---|
| `RACE-WEEK-VOLUME-01` | 🏃 Coaching | **RULED, not built.** The race is not training volume. 15.3% of plans, **50% of marathons**; worst case a 12 km/wk beginner with a 25 km peak and a 59 km race week. ⚠️ **Display and totals only — no prescription changes** |
| `MARATHON-READINESS-GAP-01` | 🏃 Coaching | Filed, not ruled. A beginner peaking at 25 km sent to race 42.2 km. **Willy: the volume fix is honesty, not safety** |
| `DESIGN-CD1-TAXONOMY-01` | 🧭 Design → 🏃 Coaching | Collins' first assignment. Do five session names resolve to one pace? ⚠️ **Take the measurement first — the 2026-08 premise has moved** |
| `DESIGN-EMPTYSTATE-ART-01` | 🧭 Design | Recorded as *"a taste call made against the documented rule"*, never put to a board |
| `A11Y-MOCKUP-CONTRAST-01` | 🧭 Design | Nine contrast failures, all 9–11px text inside `PhoneFrame`. ⚠️ **Option 3 is the honest root cause and it is in the APP**: `--warn` on a warn-tinted card scores **2.74:1 in the product itself** |

---

## 7. How to run it

`/design-board`. Settled-ground scan first, then the seats, then the ruling and its three
artifacts. **`/build` for anything that follows** — analysis before code, and the consumer check
covers **app AND website** every time, because a number on one is often the same number on the
other.

---

## What the board can actually SEE — measured 2026-09-22, before the sitting

**Local harnesses only.** Every `*-preview` route 404s in production by design, so this is a
`npm run dev` review, not a device one.

| Screen job (`screen-architecture.md`) | Viewable? | Where |
|---|---|---|
| **Today** | ✅ | `TabbedPhone` on `/` — the REAL components, fed by `buildDemoPlanScreen` |
| **Plan** | ✅ | `TabbedPhone` + `/plan-arc-preview` (real `PlanCalendar`, real `PlanArc`) |
| **Coach** | ✅ | `/coach-preview` + `TabbedPhone` |
| **Me** | ✅ | `/me-preview` (real `IdentityCard`, real `ProfileSection`) |
| **Session Detail** | 🔴 **NO** | see below |

Extras with harnesses: `/onboarding-preview`, `/post-run-preview`, `/zone-block-preview`,
`/refusal-preview`, `/guide-preview`. All eight routes verified **200** on 2026-09-22.

### 🔴 Session Detail cannot be shown, and that fact is itself evidence

`SessionScreen` is a function **inside `DashboardClient.tsx`** — a file of **13,000+ lines** — and it
takes **25 props**. There is no way to render it without standing up the whole dashboard behind
auth, which is why no harness exists.

**The board should hear this as a finding rather than an apology.** This repo's own record says an
auth-gated surface needs a fixture page, and the two times one was built it found defects no test
could reach (`ONBOARD-EXIT-01`, `PROFILE-NAME-01` — the founder's own name shipped as the
placeholder). The screen that carries *"understand one session's full prescription"* is the one
screen nobody can look at without logging in.

⚠️ **Rule on what is visible and name what is not.** Four of five screen jobs are reviewable from
real components. Session Detail is not, and any ruling that touches it is INSUFFICIENT EVIDENCE
until a harness exists.

### What changed in the product TODAY, which the board has not seen

- **§120** — a session card's header now states the pace its reps actually run. **2,811 sessions
  previously displayed a pace their own reps contradicted**, worst case 147 s/km. Session Detail and
  every card are affected.
- **§121** — the race is no longer counted as training volume, so week totals and the plan total
  dropped on race week. Race week now reads *"15 km + 42.2 km race"*.
- **The Design Board exists** (ADR-023) and its register `design-rulings.md` now carries six
  sections of settled ground from the website sittings. **The settled-ground scan reads it first.**
