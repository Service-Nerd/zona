# ZONA — Brand & Product Alignment

**Status:** Locked 2026-04-23 (v2)
**Supersedes:** All prior informal positioning notes
**Audience:** This doc is the master brief. Everything else — redesign, landing page, App Store listing, marketing content — inherits from here.

---

## 1. What ZONA is

**ZONA is a running training app that stops non-elite runners from overtraining.**

It's for people who've been running long enough to know they should be getting faster, but aren't — because they go too hard on their easy days, skip their plan when life gets busy, and then wonder why they're tired and injured instead of race-ready.

ZONA is the app that tells you to slow down. And then proves it's working.

---

## 2. The tagline system

ZONA uses three locked brand lines, each with a distinct job. They are not interchangeable.

| Line | Job | BRAND constant | Where it lives |
|---|---|---|---|
| **"Training plans that stop you overtraining."** | **What ZONA does.** Functional, outward-facing, for discovery surfaces. | `BRAND.appStoreSubtitle` *(to be added)* | App Store subtitle, landing page hero, paid ads, press mentions |
| **"Slow down. You've got a day job."** | **Who ZONA is for.** Demographic hook, in-app moments. | `BRAND.tagline` | Login screen, loading screen, OG tags, meta description, in-app footer |
| **"You can't outrun your easy days."** | **How ZONA sounds.** Training truth, for brand breath. | `BRAND.brandStatement` | Privacy footer, App Store description (not login — tagline owns that space) |

### Rules for using them
- Never mix two taglines in the same surface
- Never rephrase them. They're locked strings
- When in doubt about which applies, default to: discovery = #1, in-app = #2, voice moment = #3
- `BRAND.name` is always "Zona" — fix any hardcoded instances

---

## 3. Positioning sentence

> **ZONA is for runners who always go hard on their easy days — who have a life, a day job, and no business training like professionals.**

This is the internal positioning sentence. It doesn't appear verbatim in the app, but every design decision and piece of copy should be able to trace back to it.

---

## 4. The user

### Who they are
- Adult runners with 1+ years of running experience
- Often training for a half, marathon, or first ultra
- Have a day job, a family, or both
- Run 2–5 times a week
- Use or have used Strava
- Have tried a free plan or a generic app and found it didn't fit their life
- **Age is not a target variable.** The psychographic travels from 25 to 65+. A 25-year-old with their first job and a 45-year-old with three kids overtrain for the same reasons.

### What they believe right now
- "I need to run more"
- "I need to run harder"
- "Pros train hard every day, so should I"
- "Rest weeks are for beginners"
- "If I skip a session my fitness disappears"
- "My easy runs *feel* easy" (they don't — HR says 165)

### What's actually true
- They need to run **easier**, not more
- Their fitness comes from Zone 2 volume, not threshold efforts
- Consistency matters infinitely more than intensity
- Missed sessions are a feature of adult life, not a failure
- Their body knows more than their watch

### The gap ZONA lives in
> **They think they need more training. They actually need more restraint and a plan that bends with their life.**

Every product decision, every piece of copy, every visual choice should reinforce this gap and resolve it for the user.

---

## 5. Competitors, positioned honestly

| App | What they do well | Where ZONA beats them |
|---|---|---|
| **Runna** | Polished UI, good plan generation, strong brand | Runna assumes you'll follow the plan as written. ZONA assumes you won't, and adapts. Also: Runna has no point of view on effort — it just gives you sessions. ZONA tells you when you're overcooking. |
| **A free plan (magazine / PDF)** | Zero cost, simple | No adaptation. No feedback. No conscience. If you skip a week, the plan doesn't know. |
| **Nothing** (run on feel) | Freedom. No app | ZONA's pitch here is: "You've been running on feel for years. Has it worked? If yes, carry on. If not, maybe it's time to listen to someone else." |

### Why the user picks ZONA over these three
- **vs. Runna:** ZONA is more honest. It tells you when you've pushed too hard. It reshapes the plan when you miss a week. It costs less.
- **vs. a free plan:** ZONA is alive. It knows what you did and what you didn't.
- **vs. nothing:** ZONA removes the cognitive load of deciding what to do every day — without pretending you're going to train like a pro.

---

## 6. Pricing story

**Provisional pricing (monthly + annual) is locked as the Day 1 number.** Re-evaluate post-launch based on conversion.

### The pricing narrative
- **Free:** Generic plan templates (5k / 10k / HM, 8 and 12 weeks). No Strava, no adaptive coaching. Useful but not transformative.
- **Paid:** Full AI-generated plans, Strava integration, weekly coaching reports, dynamic reshaping, benchmark updates.
- **14-day free trial** on first subscription — long enough to see one weekly coaching report and one plan adjustment.
- Saving message on annual: "Save 37% / year" (`PRICING.annual.savingLabel`).

### How to frame the price
- Under Runna
- Framed not as "a fitness app subscription" but as "less than a single session with a real coach, forever."
- Short frame for upgrade screen: *"£[X] / month. Less than the shoes you ruin by pushing too hard."*

---

## 7. App Store listing — the narrative

### Title
**Zona**

### Subtitle (30 chars max)
**Training plans that stop you overtraining.**
*(Locked as `BRAND.appStoreSubtitle`.)*

### Description opening (first 170 chars — what shows before "read more")
> Most runners train too hard on their easy days. Zona is the app that tells you to slow down. Built for runners with a day job, a life, and a race on the horizon.

### Full description structure
1. Opening hook (above)
2. "What Zona does" — 4 bullet points
3. "Who it's for" — one paragraph, speaks directly to the target user
4. "What makes it different" — Runna / Strava / generic-plan contrast, softly
5. Free vs Paid breakdown
6. Founder credibility (Russell + Race to the Stones + Make-A-Wish angle)

### Five App Store screenshots — the narrative arc

| # | Screen | Hero message | Why this slot |
|---|---|---|---|
| 1 | Today (new design) | **"You can't outrun your easy days."** | Immediate brand hit — this is what the app *feels* like |
| 2 | Session Detail with coach note | **"A running coach in your pocket. An honest one."** | Shows the intelligence — this isn't a generic plan |
| 3 | Plan with pending adjustment | **"Miss a session? The plan adapts."** | Addresses the #1 reason people quit apps — life gets in the way |
| 4 | Weekly restraint card ("78% Zone 2") | **"The work you didn't do is why you're getting faster."** | The counter-intuitive truth — this is the positioning hook |
| 5 | Generate Plan wizard / race screen | **"Built around your race. Not a template."** | Paid tier value, personalisation angle |

Screenshot design is a separate workstream and equal in importance to the redesign itself.

---

## 8. Brand voice — rules

- **Honest, slightly sarcastic, self-aware, encouraging without cringe.** (Already in `CLAUDE.md` — this doc ratifies it.)
- **One sentence is better than two.** Restraint in copy mirrors restraint in training.
- **Never motivational.** Never "you got this." Never "crush your goals." Never "beast mode."
- **Specific over abstract.** "You were at 165bpm on an easy run" beats "you went too hard."
- **Self-deprecation is welcome** — ZONA is the app that admits it knows you won't follow the plan perfectly, and that's fine.
- **Humour lives in one-liners, not paragraphs.** Don't stack jokes.

### Copy patterns that work
- Too fast → "Bit keen. Ease it back."
- Perfect → "There it is. Don't ruin it."
- Rest day → "Do nothing. It helps."
- Post-run honest → "Kept it under control."
- Missed session → "Happens. Plan's been shifted."
- Hard session logged → "{X}km — that was a tough one."
- Drifted session → "{X}km — HR went high. Worth checking."

### Copy patterns that don't
- "You're crushing it"
- "Ready to conquer your next run?"
- Emojis in anything functional
- "Here at ZONA, we believe..."
- Any variant of "you got this"

---

## 9. Launch plan

### Phase 1 — Redesign: tokens + scope cleanup
**Target: week of April 28**
- New globals.css with Warm Slate palette
- Dark mode removed
- Calendar screen deleted
- Welcome screen retired
- Smoke tracker removed
- Strava screen nav entry removed (component retained, admin URL access)
- Theme toggle removed from Me screen
- Hardcoded "Zona" wordmark references → `BRAND.name`
- Hardcoded brand statement references → `BRAND.brandStatement` (now "You can't outrun your easy days.")
- New `BRAND.appStoreSubtitle` + `BRAND.signinSub` constants added
- New ADRs written (ADR-005 Warm Slate palette, ADR-006 single-theme-only)

### Phase 2 — Redesign: Today, Session Detail, Plan
**Target: by May 3**
- Full visual redesign of the three highest-traffic screens
- New components shipped alongside:
  - Restraint card
  - Plan arc (weekly progression strip)
  - RPE filling-bar scale
  - Coach note block pattern (amber, with initial avatar)
  - Pending adjustment card (elevated prominence)

### Phase 3 — Redesign: Me, Coach, Wizard, Upgrade, Benchmark
**Target: by May 8**
- All remaining user-facing screens redesigned in new system
- Session type colours consistent across surfaces
- Empty, loading, error states handled

### Phase 4 — Internal polish + copy pass
**Target: May 9–10**
- Fix any remaining hardcoded colours / fonts
- Run brand voice pass on all static copy
- Accessibility check (contrast, tap targets, focus states)

### May 10 — Kill switch + soft launch
- TestFlight invite sent to friends + @doinghardthingsbadly followers
- Goal: 30–50 users
- Success signals: users open more than once; at least 3 unprompted "this is nice" reactions; no show-stopping bugs

### Phase 5 — App Store submission
**Target: by end of May**
- Screenshots finalised (5 per §7)
- Full description written
- Privacy policy, support URL, data collection disclosures
- Apple review (plan 7 days for back-and-forth)

### Phase 6 — Public launch
**Target: first week of June**
- Public release
- Landing page live (zonarun.app or equivalent)
- @zonarun Instagram launched
- @doinghardthingsbadly launch content push (3–5 Reels, Stories, narrative around the launch)
- Race to the Stones becomes Week 6 of the launch narrative

### Race freeze
**June 1 onwards**
- No new features
- Bug fixes and content only
- All founder attention on training + race documentation
- Post-race (July 12+), evaluate what shipped and what didn't

---

## 10. Success criteria

### Primary (the two that matter)
- **Friends who try it say "oh, this is nice"** — unprompted, more than 3 of them
- **It's the app Russ wanted to build** — gut-feel, but honest. If the founder wouldn't use it for a real training block, ship is failed.

### Secondary (measure if possible, don't optimise for)
- Session completion rate
- Upgrade conversion free → paid
- Week-over-week return rate

### Kill-switches
- **May 10, 2026:** Redesign stops. Whatever state we're in, we ship to TestFlight.
- **June 1, 2026:** Feature dev stops. Race build takes priority.

---

## 11. Design implications

These are the design decisions that follow from the positioning above, and should override any preference we had before this doc was written:

1. **The home screen must deliver the "slow down" message in under 3 seconds.** The Today screen's hero line is the highest-leverage pixel real estate in the app.
2. **The pending adjustment card is a hero feature, not a utility.** Treat it accordingly — it's the proof point for "the plan adapts to your life."
3. **The restraint stat ("78% in Zone 2") is the single most distinctive moment in the weekly summary.** It's the counter-intuitive thing that sells the app. Don't bury it.
4. **The coach voice is the product.** Every instance of coach copy is a marketing asset. Treat them as such.
5. **Data density should decrease, not increase.** Runna is denser. Garmin is denser. ZONA wins by showing less.
6. **Visual "polish" should never override copy clarity.** If a beautiful layout pushes the coach voice into 12pt muted grey, the layout is wrong.
7. **The free tier must feel honest.** A free Zona user should get a plan that works, not a crippled experience that screams "upgrade." The upgrade pitch is: *"you want the app to know you better."*

---

## 12. What this doc is not

- Not a spec. Features are defined elsewhere.
- Not a style guide. UI patterns live in `ui-patterns.md`.
- Not a content calendar. That's marketing execution.
- Not a legal document. Pricing and promises here are marketing framings.

---

## 13. Change log

| Date | Change | By |
|---|---|---|
| 2026-04-23 | Initial creation. Positioning, launch plan, and design implications locked. | Russ + Claude |
| 2026-04-23 | v2: added three-line tagline system; widened target audience by removing age bracket; confirmed full-scope redesign (visual + new components in one push); added hardcoding fixes and BRAND constant additions to Phase 1. | Russ + Claude |

---
