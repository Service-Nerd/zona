# The post-run moment — competitive landscape + our data inventory

**Date:** 2026-09-13 · **Backs:** UX-POSTRUN-01 follow-on ("is this a differentiator? is there a wow moment?")
**Scope:** what six competitors do at the post-run moment, and what data points Zonna holds that they do not.
**Method:** vendor support docs and store listings (sourced below), plus a direct read of our own schema. Where a competitor's behaviour could not be verified from primary sources it is marked UNVERIFIED rather than guessed.

---

## 1. What the competitors actually do

| App | The post-run moment | Score? | Feeds the plan? |
|---|---|---|---|
| **Runna** (leader) | Thumbs up/down **first**, which *unlocks* AI "Workout Insights": planned-vs-actual, performance progress (PRs, goal progress), motivation. Considers weather + elevation. Premium only. | **NO — explicitly none** | **NO — "will not impact your training plan"** |
| **Trenara** | Coach persona ("Christophe") writes per-run feedback. sRPE collected after every run. | Not published | **YES** — ran 10 km instead of 8 and it rebalances a future session |
| **Garmin** | Pure instrumentation: Aerobic + Anaerobic Training Effect (0–5), Recovery Time countdown, 7-day Training Load (EPOC), Training Readiness (0–100) | **YES, several** | Informs Training Status, not a coached plan |
| **Coopah** | **Weekly** coach's report, not per-run: mileage, sessions, run types vs plan, "where to focus next". Real human coaches in-app. | Not published | Human-mediated |
| **Planzy** | RPE **before** (readiness) *and* after (effort) each run | Not published | **YES** — tunes plan, race estimates and paces |
| **Runzy** | Certified human coaches giving daily/weekly feedback on a training log | Not published | Human-mediated |

### The three findings that matter

**1. The market leader has no score.** Runna — the category leader — deliberately ships *no grade at all*, and says so in its own support documentation. Zonna shipped a 0–100 score with bands. **We were more gamified than the app we position against as the over-optimised one.** (§108 Amendment 1 has since withheld the score when HR is unmeasured; the score itself remains, demoted.)

**2. Runna gates insight behind the runner's own verdict.** You rate thumbs up/down *before* the AI read unlocks. Behaviourally this is the strong move: you commit to how it felt before being told how it went, so the app cannot overwrite your own read of your run. Zonna asks for RPE in a collapsed accordion *below* the analysis.

**3. Nobody joins the run to the block.** Every one of the six compares **this run to this run's plan**. Garmin aggregates load but says nothing about intent. Coopah aggregates weekly but only in a separate report. **Not one of them says "this run is why Saturday will work" or "that is the third easy run this week that drifted."** The per-run moment and the block-level meaning are separate products everywhere.

---

## 2. What we hold

`run_analysis` — `hr_discipline_score` · `distance_score` · `pace_score` · `ef_score` · `total_score` · `verdict` · **`hr_in_zone_pct`** · **`hr_above_ceiling_pct`** · **`hr_below_floor_pct`** · `ef_value` · `ef_baseline` · `ef_trend_pct` · `planned_load_km` · `actual_load_km` · `hr_pct_z1…z4_5` (zone histogram) · `feedback_text` · `source`

`strava_activities` (the run log, source-agnostic) — distance · moving/elapsed time · elevation · avg/max HR · avg speed · suffer score · the same three zone percentages

`session_completions` — RPE · fatigue tag · `coaching_flag` (`ok`/`watch`/`flag`)

`session_reflections` — the runner's own words + the AI reframe

**And the thing none of the above is:** `plan_json` — the session's prescribed zone, its pace band, its *role in the week*, the phase it sits in, and the principle that put it there.

### Where we are genuinely ahead

- **Directional zone miss.** `hr_above_ceiling_pct` vs `hr_below_floor_pct` — we know whether an easy run was too **hard** or too **easy**. Garmin's Training Effect is unsigned: a 3.5 aerobic TE cannot tell you that you ruined your easy day. This is the product's whole thesis, and it is a column.
- **Efficiency trend against the runner's own baseline** (`ef_baseline`, `ef_trend_pct`) — not a population norm.
- **The plan's intent.** Everyone else has the plan's *numbers*. We have the reason the session exists.

### Where we are behind

- **No pre-run readiness.** Planzy asks how ready you feel *before* the run. We ask nothing.
- **No weather or elevation in the read.** Runna uses both to soften an unfair judgement; we hold `elevation_gain` and never use it, and hold no weather at all.
- **No PR / progress-toward-goal beat.** Runna has one; our arc lives on Coach, not here.
- **Cross-run context is unused at this moment.** We have every run's zone history and say nothing about it on the screen where it would land hardest.

---

## 3. The question this puts to the boards

The post-run screen is now honest and calm (UX-POSTRUN-01). It is **not yet differentiated**: strip the voice and it is planned-vs-actual, same as everyone.

The open bet is the one thing the landscape leaves empty: **the per-run moment carrying block-level meaning** — *"third easy run this week that crept into Zone 3, which is why Saturday felt heavy"* — rather than describing the run in isolation.

- **Coaching Board:** what can we honestly claim from the data above, and where would that claim overreach?
- **SLT:** is it a differentiator, is it the wow, and what does it cost?

---

**Sources:** [Runna Workout Insights](https://support.runna.com/en/articles/10494265-what-is-the-workout-insights-feature) · [Runna workout review](https://support.runna.com/en/articles/9973602-reviewing-your-workouts-to-support-your-training) · [Runna post-run stats](https://www.runningwestwardho.co.uk/post/runna-post-run-stats-explained) · [Trenara](https://www.trenara.com/) · [Trenara vs Runna](https://www.trenara.com/blog/runna-vs-trenara-which-running-app-should-you-choose) · [Garmin Training Effect](https://www.garmin.com/en-US/garmin-technology/running-science/physiological-measurements/anaerobic-training-effect/) · [Garmin training features](https://the5krunner.com/garmin-features/training/) · [Coopah features](https://coopah.com/coopah-features/) · [Coopah review](https://www.techradar.com/health-fitness/coopah-app-review-an-ideal-reasonably-priced-running-companion-app) · [Planzy](https://apps.apple.com/us/app/planzy-running-plans/id6499276047) · [Runzy](https://apps.apple.com/us/app/runzy/id6448893640)
