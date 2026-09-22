# Screen Architecture — Zonna

**Authority**: This document defines the single job of each screen and the content rules that enforce it.
Read before adding any feature to a screen. If a feature doesn't match a screen's job, it belongs somewhere else.

Cross-reference: `docs/canonical/ux-principles.md` (design principles), `docs/canonical/ui-patterns.md` (component patterns).

> 🔴 **THIS DOCUMENT SAYS WHAT BELONGS ON A SCREEN. IT DOES NOT SAY WHAT THE SCREEN IS.**
> Added 2026-09-21 after it was used as one, at real cost.
>
> Rebuilding the marketing device's Plan and Coach stills from this file produced a Plan screen
> with an arc and three loose session cards and **no weeks on it** — while the real `PlanScreen`
> is, in its second half, `PlanCalendar`: the Past / Now / Next / Later week cards. Everything the
> rebuild rendered *belongs* on Plan. It still was not the Plan screen. The founder caught it in
> one sentence: *"the plan screen shows the Weeks and a Kit card."*
>
> The distinction is structural, not a gap to be filled in. This doc is a **rule about what may be
> admitted** — one job per screen, and what to refuse. A screen is a **composition**: which
> components, in what order, at what weight. A doc that listed the composition would be a second
> copy of the component and would drift from it, which is why this one correctly does not.
>
> **So: to decide whether something BELONGS, read this. To know what a screen IS, read the
> component** — `PlanScreen`, `CoachScreen`, `TodayScreen` et al in `app/dashboard/DashboardClient.tsx`.
> Anything that must MATCH a screen (a marketing still, a fixture page, a design review) reads the
> component, and its test reads the component too. `lib/marketing/realComponents.test.ts` does
> exactly that: it slices the real screen function out of `DashboardClient` rather than pinning a
> list anyone chose.

---

## The rule

Every screen has exactly one job. A feature that serves two screens' jobs belongs on neither — it needs its own access point or belongs on the screen whose job it serves most directly.

When in doubt: ask "what is the user *trying to do* when they open this screen?" The answer is the job. If a proposed feature doesn't serve that action, it doesn't belong here.

---

## Screen Jobs

### Today
**Job: Execute today's session.**

The user opens Today to find out what to run and to log it done. Everything on this screen exists to serve that single transaction.

| Belongs here | Does not belong here |
|---|---|
| Today's prescribed session (type, zone, distance, pace, HR targets) | Session history beyond today |
| Coach note / daily context for *this* session | Weekly summaries or trends |
| Completion log (RPE, reflection) | Plan adjustments or session moves |
| Post-run analysis for today's run | Race projections |
| Pending adjustment banner (affects today) | Multi-week coaching insights |
| Active override for today | Profile or settings |

**One screen, one session, one day.**

⚠️ **A1 (Design Board, sitting three, 2026-09-22) — this was TRUE IN THE DOC AND FALSE IN
THE CODE.** Today carried `‹ Week 4 of 12 ›` with working arrows, and the whole screen
answered a horizontal swipe by changing week — so both Today and Plan navigated the plan,
against two entries in the *does not belong here* column above. The arrows, the swipe, and
the mirrored `viewWeekIndex` state are gone; Today renders the current week and cannot
change it. **The seven day cells stay** — this week's shape is context for today's session,
not navigation away from it. The ruling restored the doc; it did not amend it.

---

### Plan
**Job: Own the training arc.**

The user opens Plan to understand their schedule — what's prescribed across the weeks ahead, how the plan is structured, and where their race sits. It is also where they adjust the schedule (move/swap sessions).

| Belongs here | Does not belong here |
|---|---|
| Plan Arc (all weeks, race countdown) | Session-by-session HR/zone analysis |
| Week-by-week session grid (Now / Next / Later) | Weekly coaching synthesis (that's Coach) |
| This week's framing — phase, theme, km target | Race projections (moved to Coach 2026-09-12) |
| Move / swap session controls | Load ratio or zone discipline scores |
| Session type and distance per day | Trend data (HR drift, aerobic trend) |
| Race name and goal | Multi-week coaching insights |
| ~~Race Projections (one tap from Plan Arc)~~ — **moved to Coach 2026-09-12** | |

**Race Projections MOVED TO COACH — 2026-09-12 (UX-COACH-01, SLT).** They used to
be one tap from the Plan Arc, on the reasoning that *"how am I tracking toward my
race goal?"* is a periodic, deliberate question rather than a glanceable one. That
reasoning was right about the question and wrong about the screen: it is precisely
**Coach's** subject. The component's own header had called Coach its canonical home
since it was written, while it rendered in a sheet here.

On Coach it is the **arc** — where I was, where I am, and the goal I chose (§109:
it may remember and compare, it may not predict). The Plan Arc is no longer
tappable, and the sheet is gone rather than duplicated: Sutherland's point was that
the one emotionally charged object in the product was filed next to a list of
appointments.

⚠️ **It also woke R32.** The recalibration nudge renders only on
`variant="status"`, and Plan passed its handlers as `undefined`, so it had been
dormant since it shipped. The working handlers were already plumbed to Coach.

**Week Notes** (phase, theme, bullet coaching lines, km target) live here, merged into the "This Week" coaching card — not on Coach.

**Order on Plan — the weeks come first (A2, 2026-09-22).** Measured before the ruling: five
cards stood between the header and the first week, on a screen whose job is the training
arc. The order is now **the race → the arc → the weeks → everything that explains them**,
with *"Change your plan"* first of the blocks below so the screen's one action is the next
thing after the calendar. ⚠️ **Nothing was cut** — the ruling is an ordering, and a later
change that drops a block while tidying the order fails `appReviewWave3.test.ts`.

**The race is stated ONCE (A3, 2026-09-22).** Its name, date and countdown sit together
under the header. The countdown is deliberately **not** attached to the arc: the arc is the
shape of the training, the countdown is a property of the race, and hanging it under the arc
is what made the race read twice.

---

### Coach
**Job: Kit's synthesis — what your training data means and what to do next.**

The user opens Coach to hear from Kit. This is the AI intelligence layer: a synthesised read on how training is going, what the patterns show, and one clear forward action. It is retrospective + forward-looking. It is paid-only.

| Belongs here | Does not belong here |
|---|---|
| Kit's weekly read (AI) — headline, body, action line | The week-by-week session schedule (that's Plan) |
| Zone discipline score + what it means | Week Notes / plan framing copy (that's Plan) |
| Load ratio + underloaded / overloaded signal | The week-by-week session schedule (that's Plan) |
| Sessions completed / planned count | Session-level detail (that's Session Detail) |
| Weeks left to race | Profile or settings |
| Zone rings — this week's zone distribution | |
| Aerobic / easy-run trend (ONE card, UX-COACH-01) | |
| Race readiness (conditional, race window only) | |
| Phase summary (conditional, phase transition only) | |
| Zone drift alert (conditional, rule-engine) | |
| Discipline ledger — weeks within the lines | |
| Race projections — the arc (was · now · goal), §109 (moved here 2026-09-12, UX-COACH-01) | |

**Kit appears once, as a coherent voice.** Multiple disconnected Kit cards are a layout failure — consolidate.

---

### Session Detail
**Job: Understand one session's full prescription.**

The user opens Session Detail from Today or Plan to read the full brief on a single session — structure, targets, zone, rationale, and completion. Everything here is about one session.

| Belongs here | Does not belong here |
|---|---|
| Session type, zone, distance, duration | Other sessions or week context |
| Warm-up / main / cool-down structure | Plan-level metrics |
| HR targets and pace bracket | Coaching summaries |
| Coach note for this session | Profile or settings |
| RPE and reflection (post-run) | Race projections |
| Completion log | |
| Post-run reframe (AI, paid) | |

---

### Me
**Job: Your identity and configuration.**

The user opens Me to manage the things the app uses everywhere — their profile, benchmarks, data connections, and preferences. These are set-once inputs, not real-time coaching surfaces.

| Belongs here | Does not belong here |
|---|---|
| Name, race, distance, fitness level | Session-level coaching |
| HR zones and benchmark pace | Weekly coaching synthesis |
| Dist/duration display toggle | Zone rings or trend data |
| Data connections (HealthKit, Strava) | Race projections |
| Plan reshaping and overrides | Session schedule |
| Subscription and account | |
| Recent personalisation wins (zone score context) | |

---

## Validation test

Before adding any feature to a screen, answer:

1. **What is the user trying to do when they open this screen?**
2. **Does this feature serve that action directly?**
3. **If yes — does it belong inline, or one tap deeper?**
4. **If no — which screen's job does it serve?**

If step 2 is no, stop. Find the right screen. If no existing screen's job covers it, that is a signal the feature may not belong in the app at all — or that a new screen is warranted (rare; requires a product decision).

---

## Reference

- Screen design principle: `docs/canonical/ux-principles.md` § Screen Design Principles
- Component patterns per screen: `docs/canonical/ui-patterns.md`
- Feature tier (FREE/PAID): `docs/canonical/feature-registry.md`
- Active screen status: `CLAUDE.md` § Active scope
