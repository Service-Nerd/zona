# Screen Architecture — Zonna

**Authority**: This document defines the single job of each screen and the content rules that enforce it.
Read before adding any feature to a screen. If a feature doesn't match a screen's job, it belongs somewhere else.

Cross-reference: `docs/canonical/ux-principles.md` (design principles), `docs/canonical/ui-patterns.md` (component patterns).

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

---

### Plan
**Job: Own the training arc.**

The user opens Plan to understand their schedule — what's prescribed across the weeks ahead, how the plan is structured, and where their race sits. It is also where they adjust the schedule (move/swap sessions).

| Belongs here | Does not belong here |
|---|---|
| Plan Arc (all weeks, race countdown) | Session-by-session HR/zone analysis |
| Week-by-week session grid (Now / Next / Later) | Weekly coaching synthesis (that's Coach) |
| This week's framing — phase, theme, km target | Race projections (accessed via Plan Arc tap) |
| Move / swap session controls | Load ratio or zone discipline scores |
| Session type and distance per day | Trend data (HR drift, aerobic trend) |
| Race name and goal | Multi-week coaching insights |
| Race Projections (one tap from Plan Arc — not inline) | |

**Race Projections** are accessed by tapping the Plan Arc or race name header — they are not an inline card. They answer "how am I tracking toward my race goal?" which is a periodic, deliberate check, not part of reading the schedule.

**Week Notes** (phase, theme, bullet coaching lines, km target) live here, merged into the "This Week" coaching card — not on Coach.

---

### Coach
**Job: Kit's synthesis — what your training data means and what to do next.**

The user opens Coach to hear from Kit. This is the AI intelligence layer: a synthesised read on how training is going, what the patterns show, and one clear forward action. It is retrospective + forward-looking. It is paid-only.

| Belongs here | Does not belong here |
|---|---|
| Kit's weekly read (AI) — headline, body, action line | The week-by-week session schedule (that's Plan) |
| Zone discipline score + what it means | Week Notes / plan framing copy (that's Plan) |
| Load ratio + underloaded / overloaded signal | Race projections (that's Plan, accessed via Arc) |
| Sessions completed / planned count | Session-level detail (that's Session Detail) |
| Weeks left to race | Profile or settings |
| Zone rings — this week's zone distribution | |
| Aerobic trend + easy run trend | |
| Race readiness (conditional, race window only) | |
| Phase summary (conditional, phase transition only) | |
| Zone drift alert (conditional, rule-engine) | |
| Discipline ledger — weeks within the lines | |

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
