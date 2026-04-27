# Case 04: Marathon intermediate — 4:00 time goal, 13 weeks out (warn-acknowledged)

## Runner profile

Mike, 47. Returning runner (4 weeks at current volume) with hip injury history. 4:00 marathon goal, 13 weeks out. Currently 38 km/week, longest recent run 18 km. 4 sessions/week. The case that prompted the 2026-04-28 review: a time-targeted marathon plan should not be possible from this starting point. Engine refuses generation unless acknowledged_prep_warning is set; with acknowledgment, plan generates as maintenance with warnings. (The original review used 11 weeks, which after §44 returning-runner shift now triggers BLOCK; 13 weeks puts the case back in the warn zone the review was concerned about.)

## Inputs

| Field | Value |
|---|---|
| `race_date` | 2026-07-27 |
| `race_distance_km` | 42.2 |
| `race_name` | Target Marathon |
| `goal` | time_target |
| `target_time` | 4:00:00 |
| `age` | 47 |
| `current_weekly_km` | 38 |
| `longest_recent_run_km` | 18 |
| `days_available` | 4 |
| `days_cannot_train` | [mon, wed, fri] |
| `preferred_long_run_day` | sun |
| `max_weekday_mins` | 60 |
| `max_hr` | 175 |
| `training_age` | 5yr+ |
| `weeks_at_current_volume` | 4 |
| `hard_session_relationship` | love |
| `injury_history` | [hip] |
| `terrain` | road |
| `primary_metric` | distance |
| `acknowledged_prep_warning` | true |
| `plan_start` | 2026-04-27 |
| `tier` | paid |

## Plan summary

**12 weeks** · race: Target Marathon (42.2 km) on 2026-07-27
Derived fitness: **intermediate**
Goal pace: **5:41 /km**
Volume profile: **maintenance**
Compression: **constrained_by_inputs**
> Peak weekly volume 32 km is below the 53 km floor for a time-targeted MARATHON (125% of race distance). Peak long run 18 km is below the 31.7 km floor (75% of race distance) — week-on-week long-run cap (§45) prevented reaching the ratio. Plan maintains current fitness rather than building it. To enable a build profile: increase days_available from 4 to 5, OR raise max_weekday_mins from 60 to 90, OR defer the race so the build has more weeks (current 12, recommended ≥16).

### Week 1 — Base — easy start · *base*
> HR discipline. Slower than feels right. That is correct.

Weekly: **28 km** · long: 1h

- **tue** — Easy run - Zone 2 · 6.5km · 46min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **thu** — Easy run - Zone 2 · 6.5km · 46min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sat** — Easy run - Zone 2 · 6.5km · 46min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 8.5km · 60min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 2 — Base — building consistency · *base*
> HR discipline. Slower than feels right. That is correct.

Weekly: **30 km** · long: 1.1h

- **tue** — Easy run - Zone 2 · 7km · 49min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **thu** — Easy run - Zone 2 · 7km · 49min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sat** — Easy run - Zone 2 · 7km · 49min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 9km · 63min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 3 — Base — recovery week · *base* (deload)
> Deload week. Run a parkrun or timed 5K — your result sharpens the zones for the next block.

Weekly: **22 km** · long: 0.8h

- **tue** — Easy run - Zone 2 · 5km · 35min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **thu** — Easy run - Zone 2 · 5km · 35min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sat** — Easy run - Zone 2 · 5km · 35min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 6.5km · 46min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 4 — Build — first quality session · *build*
> One quality session. Everything else stays easy.

Weekly: **25 km** · long: 0.9h

- **tue** — Easy run - Zone 2 · 6km · 42min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _4×20s strides at 5K effort, full recovery between._
- **thu** — Cruise intervals · 5km · 29min · Zone 3–4 · HR 140–152 bpm · pace 5:30–6:00 /km · RPE 7
  - _Rep three is the test. Not rep one._
- **sat** — Easy run - Zone 2 · 6km · 42min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 7.5km · 53min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 5 — Build — extending the work · *build*
> One quality session. Everything else stays easy.

Weekly: **27 km** · long: 1h
> Optional: drop a parkrun PB or local 5K this week. Use the result as a fitness check, not a race effort.

- **tue** — Easy run - Zone 2 · 6.5km · 46min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _4×20s strides at 5K effort, full recovery between._
- **thu** — Progressive tempo · 5km · 29min · Zone 3–4 · HR 140–152 bpm · pace 5:30–6:00 /km · RPE 7
  - _Hold back early. Finish honest._
- **sat** — Easy run - Zone 2 · 6.5km · 46min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 8.5km · 60min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 6 — Build — recovery week · *build* (deload)
> Deload week. Run a parkrun or timed 5K — your result sharpens the zones for the next block.

Weekly: **26 km** · long: 0.9h

- **tue** — Easy run - Zone 2 · 6km · 42min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **thu** — Easy run - Zone 2 · 6km · 42min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sat** — Easy run - Zone 2 · 6km · 42min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 8km · 56min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 7 — Peak — consistency · *peak*
> Consistency. The work is the volume.

Weekly: **27 km** · long: 1.5h

- **tue** — Easy run - Zone 2 · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _4×20s strides at 5K effort, full recovery between._
- **thu** — MARATHON-pace intervals · 5.5km · 31min · Zone 3–4 · HR 140–152 bpm · pace 5:34–5:48 /km · RPE 7
  - _MARATHON-pace work. Target 5:41 /km. Controlled, even splits — exit each rep wanting more._
- **sat** — Easy run - Zone 2 · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 13km · 91min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _Step-back week. Easy aerobic — let the legs absorb last week's peak before the next push._

### Week 8 — Peak — second peak week · *peak*
> Consistency. The work is the volume.

Weekly: **32 km** · long: 2.1h

- **tue** — Easy run - Zone 2 · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _4×20s strides at 5K effort, full recovery between._
- **thu** — MARATHON-pace intervals · 6km · 34min · Zone 3–4 · HR 140–152 bpm · pace 5:34–5:48 /km · RPE 7
  - _MARATHON-pace work. Target 5:41 /km. Controlled, even splits — exit each rep wanting more._
- **sat** — Easy run - Zone 2 · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Marathon-pace long run · 18km · 126min · Zone 2–3 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 6
  - _Easy first. Hit goal pace on tired legs._
  - _Final 30–50% at MP: 5:41 /km._

### Week 9 — Taper — trust the work · *taper*
> Volume drops. Intensity stays. Trust the work you have done.

Weekly: **28 km** · long: 1.2h

- **tue** — Easy run - Zone 2 · 6km · 42min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _4×20s strides at 5K effort, full recovery between._
- **thu** — Progressive tempo · 5km · 29min · Zone 3–4 · HR 140–152 bpm · pace 5:30–6:00 /km · RPE 7
  - _Hold back early. Finish honest._
- **sat** — Easy run - Zone 2 · 6km · 42min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 10.5km · 74min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 10 — Taper — sharpening · *taper*
> Volume drops. Intensity stays. Trust the work you have done.

Weekly: **21 km** · long: 0.9h

- **tue** — Easy run - Zone 2 · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _4×20s strides at 5K effort, full recovery between._
- **thu** — Goal-pace sharpener · 5km · 28min · Zone 3–4 · HR 140–152 bpm · pace 5:34–5:48 /km · RPE 7
  - _MARATHON-pace work. Target 5:41 /km. Controlled, even splits — exit each rep wanting more._
- **sat** — Easy run - Zone 2 · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 8km · 56min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 11 — Taper — final cut · *taper*
> Volume drops. Intensity stays. Trust the work you have done.

Weekly: **19 km** · long: 0.7h

- **tue** — Easy run - Zone 2 · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _4×20s strides at 5K effort, full recovery between._
- **thu** — Progressive tempo · 5km · 29min · Zone 3–4 · HR 140–152 bpm · pace 5:30–6:00 /km · RPE 7
  - _Hold back early. Finish honest._
- **sat** — Easy run - Zone 2 · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
- **sun** — Long run - Zone 2 · 6km · 42min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4

### Week 12 — Race week · *taper* (race)
> The work is done. Arrive rested.

Weekly: **59 km**

- **tue** — Easy shakeout · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 2
  - _Short and relaxed. Wake the legs, nothing more._
  - _4×100m strides at 5K effort, full recovery between._
- **thu** — Easy shakeout · 4km · 28min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 2
  - _Short and relaxed. Wake the legs, nothing more._
- **sat** — Race-week easy · 9km · 63min · Zone 2 · HR < 140 bpm · pace 6:30–7:30 /km · RPE 4
  - _Conversational. Keep the legs moving without adding fatigue._
- **sun** — Race - Target Marathon · 42.2km
  - _Start slower than feels right. First 5 km at Zone 2._
  - _No new shoes, no new food._

## Coaching questions to address

- Is the prep-time warning surfaced clearly in plan meta?
- Does the maintenance downgrade list a sensible alternative (defer race, switch to HM, change goal to finish)?
- Is the returning_runner_note specific about which input was scaled and why?
- For an 11-week marathon, are the peak long runs alternating per §47 (no two consecutive 30km MP-finish weeks)?
- Does the engine respect the hip injury (no hill sessions in base/build)?
- Is the HR fallback note (max-only, percent_of_max) clear enough that the runner knows their resting HR would improve accuracy?

## Raw JSON

<details>
<summary>Input</summary>

```json
{
  "race_date": "2026-07-27",
  "race_distance_km": 42.2,
  "race_name": "Target Marathon",
  "goal": "time_target",
  "target_time": "4:00:00",
  "age": 47,
  "current_weekly_km": 38,
  "longest_recent_run_km": 18,
  "days_available": 4,
  "days_cannot_train": [
    "mon",
    "wed",
    "fri"
  ],
  "preferred_long_run_day": "sun",
  "max_weekday_mins": 60,
  "max_hr": 175,
  "training_age": "5yr+",
  "weeks_at_current_volume": 4,
  "hard_session_relationship": "love",
  "injury_history": [
    "hip"
  ],
  "terrain": "road",
  "primary_metric": "distance",
  "acknowledged_prep_warning": true,
  "plan_start": "2026-04-27"
}
```
</details>

<details>
<summary>Generated plan</summary>

```json
{
  "meta": {
    "athlete": "Athlete",
    "handle": "",
    "race_name": "Target Marathon",
    "race_date": "2026-07-27",
    "race_distance_km": 42.2,
    "charity": "",
    "plan_start": "2026-05-04",
    "quit_date": "",
    "resting_hr": 0,
    "max_hr": 175,
    "zone2_ceiling": 140,
    "version": "2.0",
    "last_updated": "2026-04-27",
    "notes": "Standard plan — 42.2km, 12 weeks",
    "primary_metric": "distance",
    "fitness_level": "intermediate",
    "goal": "time_target",
    "target_time": "4:00:00",
    "days_available": 4,
    "hard_session_relationship": "love",
    "injury_history": [
      "hip"
    ],
    "terrain": "road",
    "generated_at": "2026-04-27T21:10:56.519Z",
    "generator_version": "2.0",
    "tier": "paid",
    "compressed": true,
    "compression_classification": "constrained_by_inputs",
    "volume_profile": "maintenance",
    "volume_constraint_note": "Peak weekly volume 32 km is below the 53 km floor for a time-targeted MARATHON (125% of race distance). Peak long run 18 km is below the 31.7 km floor (75% of race distance) — week-on-week long-run cap (§45) prevented reaching the ratio. Plan maintains current fitness rather than building it. To enable a build profile: increase days_available from 4 to 5, OR raise max_weekday_mins from 60 to 90, OR defer the race so the build has more weeks (current 12, recommended ≥16).",
    "age": 47,
    "goal_pace_per_km": "5:41 /km",
    "recalibration_weeks": [
      3,
      6
    ],
    "training_age": "5yr+",
    "fresh_return_active": true,
    "returning_runner_note": "Fresh-from-layoff start: week 1 begins at 70% of your stated current weekly volume (29 km vs 38 km stated). Returning to running needs caution, not faster ramp — the engine prefers a small base to rebuild from. Volume grows at the standard 10% per week.",
    "hr_zone_method": "percent_of_max",
    "hr_assumption_note": "Zones derived from max HR only (no resting HR provided). Karvonen (using both max and resting) is more accurate. To refine: measure resting HR first thing in the morning, lying down, for 1 minute.",
    "prep_time_status": "warned",
    "prep_time_weeks_available": 12,
    "prep_time_weeks_required_ok": 18,
    "prep_time_warning": "12 weeks is below the recommended 18-week minimum for a time-targeted MARATHON. The plan can be generated but the time goal may not be achievable safely. Expect maintenance-grade volume rather than a true build.",
    "prep_time_alternatives": [
      "Race the half marathon at this event instead — 12 weeks is adequate for an HM build.",
      "Switch goal to \"finish\" — finish goals are achievable on shorter timelines.",
      "Defer the race to one with at least 18 weeks of prep."
    ]
  },
  "phases": [
    {
      "name": "base",
      "start_week": 1,
      "end_week": 3
    },
    {
      "name": "build",
      "start_week": 4,
      "end_week": 6
    },
    {
      "name": "peak",
      "start_week": 7,
      "end_week": 8
    },
    {
      "name": "taper",
      "start_week": 9,
      "end_week": 12
    }
  ],
  "weeks": [
    {
      "n": 1,
      "date": "2026-05-04",
      "label": "Base — easy start",
      "theme": "HR discipline. Slower than feels right. That is correct.",
      "type": "normal",
      "phase": "base",
      "sessions": {
        "sun": {
          "id": "w1-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 8.5,
          "duration_mins": 60,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w1-thu",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6.5,
          "duration_mins": 46,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "tue": {
          "id": "w1-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6.5,
          "duration_mins": 46,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "sat": {
          "id": "w1-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6.5,
          "duration_mins": 46,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 1,
      "weekly_km": 28
    },
    {
      "n": 2,
      "date": "2026-05-11",
      "label": "Base — building consistency",
      "theme": "HR discipline. Slower than feels right. That is correct.",
      "type": "normal",
      "phase": "base",
      "sessions": {
        "sun": {
          "id": "w2-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 9,
          "duration_mins": 63,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w2-thu",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 7,
          "duration_mins": 49,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "tue": {
          "id": "w2-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 7,
          "duration_mins": 49,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "sat": {
          "id": "w2-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 7,
          "duration_mins": 49,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 1.1,
      "weekly_km": 30
    },
    {
      "n": 3,
      "date": "2026-05-18",
      "label": "Base — recovery week",
      "theme": "Deload week. Run a parkrun or timed 5K — your result sharpens the zones for the next block.",
      "type": "deload",
      "phase": "base",
      "badge": "deload",
      "sessions": {
        "sun": {
          "id": "w3-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 6.5,
          "duration_mins": 46,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w3-thu",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 5,
          "duration_mins": 35,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "tue": {
          "id": "w3-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 5,
          "duration_mins": 35,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "sat": {
          "id": "w3-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 5,
          "duration_mins": 35,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 0.8,
      "weekly_km": 22
    },
    {
      "n": 4,
      "date": "2026-05-25",
      "label": "Build — first quality session",
      "theme": "One quality session. Everything else stays easy.",
      "type": "normal",
      "phase": "build",
      "sessions": {
        "sun": {
          "id": "w4-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 7.5,
          "duration_mins": 53,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w4-thu",
          "type": "quality",
          "label": "Cruise intervals",
          "detail": null,
          "distance_km": 5,
          "duration_mins": 29,
          "primary_metric": "distance",
          "zone": "Zone 3–4",
          "hr_target": "140–152 bpm",
          "pace_target": "5:30–6:00 /km",
          "rpe_target": 7,
          "coach_notes": [
            "Rep three is the test. Not rep one."
          ]
        },
        "tue": {
          "id": "w4-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 42,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "4×20s strides at 5K effort, full recovery between."
          ]
        },
        "sat": {
          "id": "w4-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 42,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 0.9,
      "weekly_km": 25
    },
    {
      "n": 5,
      "date": "2026-06-01",
      "label": "Build — extending the work",
      "theme": "One quality session. Everything else stays easy.",
      "type": "normal",
      "phase": "build",
      "sessions": {
        "sun": {
          "id": "w5-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 8.5,
          "duration_mins": 60,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w5-thu",
          "type": "quality",
          "label": "Progressive tempo",
          "detail": null,
          "distance_km": 5,
          "duration_mins": 29,
          "primary_metric": "distance",
          "zone": "Zone 3–4",
          "hr_target": "140–152 bpm",
          "pace_target": "5:30–6:00 /km",
          "rpe_target": 7,
          "coach_notes": [
            "Hold back early. Finish honest."
          ]
        },
        "tue": {
          "id": "w5-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6.5,
          "duration_mins": 46,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "4×20s strides at 5K effort, full recovery between."
          ]
        },
        "sat": {
          "id": "w5-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6.5,
          "duration_mins": 46,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 1,
      "weekly_km": 27,
      "tune_up_callout": "Optional: drop a parkrun PB or local 5K this week. Use the result as a fitness check, not a race effort."
    },
    {
      "n": 6,
      "date": "2026-06-08",
      "label": "Build — recovery week",
      "theme": "Deload week. Run a parkrun or timed 5K — your result sharpens the zones for the next block.",
      "type": "deload",
      "phase": "build",
      "badge": "deload",
      "sessions": {
        "sun": {
          "id": "w6-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 8,
          "duration_mins": 56,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w6-thu",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 42,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "tue": {
          "id": "w6-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 42,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "sat": {
          "id": "w6-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 42,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 0.9,
      "weekly_km": 26
    },
    {
      "n": 7,
      "date": "2026-06-15",
      "label": "Peak — consistency",
      "theme": "Consistency. The work is the volume.",
      "type": "normal",
      "phase": "peak",
      "sessions": {
        "sun": {
          "id": "w7-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 13,
          "duration_mins": 91,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "Step-back week. Easy aerobic — let the legs absorb last week's peak before the next push."
          ]
        },
        "thu": {
          "id": "w7-thu",
          "type": "quality",
          "label": "MARATHON-pace intervals",
          "detail": null,
          "distance_km": 5.5,
          "duration_mins": 31,
          "primary_metric": "distance",
          "zone": "Zone 3–4",
          "hr_target": "140–152 bpm",
          "pace_target": "5:34–5:48 /km",
          "rpe_target": 7,
          "coach_notes": [
            "MARATHON-pace work. Target 5:41 /km. Controlled, even splits — exit each rep wanting more."
          ]
        },
        "tue": {
          "id": "w7-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "4×20s strides at 5K effort, full recovery between."
          ]
        },
        "sat": {
          "id": "w7-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 1.5,
      "weekly_km": 27
    },
    {
      "n": 8,
      "date": "2026-06-22",
      "label": "Peak — second peak week",
      "theme": "Consistency. The work is the volume.",
      "type": "normal",
      "phase": "peak",
      "sessions": {
        "sun": {
          "id": "w8-sun",
          "type": "easy",
          "label": "Marathon-pace long run",
          "detail": null,
          "distance_km": 18,
          "duration_mins": 126,
          "primary_metric": "distance",
          "zone": "Zone 2–3",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 6,
          "coach_notes": [
            "Easy first. Hit goal pace on tired legs.",
            "Final 30–50% at MP: 5:41 /km."
          ]
        },
        "thu": {
          "id": "w8-thu",
          "type": "quality",
          "label": "MARATHON-pace intervals",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 34,
          "primary_metric": "distance",
          "zone": "Zone 3–4",
          "hr_target": "140–152 bpm",
          "pace_target": "5:34–5:48 /km",
          "rpe_target": 7,
          "coach_notes": [
            "MARATHON-pace work. Target 5:41 /km. Controlled, even splits — exit each rep wanting more."
          ]
        },
        "tue": {
          "id": "w8-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "4×20s strides at 5K effort, full recovery between."
          ]
        },
        "sat": {
          "id": "w8-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 2.1,
      "weekly_km": 32
    },
    {
      "n": 9,
      "date": "2026-06-29",
      "label": "Taper — trust the work",
      "theme": "Volume drops. Intensity stays. Trust the work you have done.",
      "type": "normal",
      "phase": "taper",
      "sessions": {
        "sun": {
          "id": "w9-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 10.5,
          "duration_mins": 74,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w9-thu",
          "type": "quality",
          "label": "Progressive tempo",
          "detail": null,
          "distance_km": 5,
          "duration_mins": 29,
          "primary_metric": "distance",
          "zone": "Zone 3–4",
          "hr_target": "140–152 bpm",
          "pace_target": "5:30–6:00 /km",
          "rpe_target": 7,
          "coach_notes": [
            "Hold back early. Finish honest."
          ]
        },
        "tue": {
          "id": "w9-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 42,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "4×20s strides at 5K effort, full recovery between."
          ]
        },
        "sat": {
          "id": "w9-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 42,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 1.2,
      "weekly_km": 28
    },
    {
      "n": 10,
      "date": "2026-07-06",
      "label": "Taper — sharpening",
      "theme": "Volume drops. Intensity stays. Trust the work you have done.",
      "type": "normal",
      "phase": "taper",
      "sessions": {
        "sun": {
          "id": "w10-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 8,
          "duration_mins": 56,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w10-thu",
          "type": "quality",
          "label": "Goal-pace sharpener",
          "detail": null,
          "distance_km": 5,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 3–4",
          "hr_target": "140–152 bpm",
          "pace_target": "5:34–5:48 /km",
          "rpe_target": 7,
          "coach_notes": [
            "MARATHON-pace work. Target 5:41 /km. Controlled, even splits — exit each rep wanting more."
          ]
        },
        "tue": {
          "id": "w10-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "4×20s strides at 5K effort, full recovery between."
          ]
        },
        "sat": {
          "id": "w10-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 0.9,
      "weekly_km": 21
    },
    {
      "n": 11,
      "date": "2026-07-13",
      "label": "Taper — final cut",
      "theme": "Volume drops. Intensity stays. Trust the work you have done.",
      "type": "normal",
      "phase": "taper",
      "sessions": {
        "sun": {
          "id": "w11-sun",
          "type": "easy",
          "label": "Long run — Zone 2",
          "detail": null,
          "distance_km": 6,
          "duration_mins": 42,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        },
        "thu": {
          "id": "w11-thu",
          "type": "quality",
          "label": "Progressive tempo",
          "detail": null,
          "distance_km": 5,
          "duration_mins": 29,
          "primary_metric": "distance",
          "zone": "Zone 3–4",
          "hr_target": "140–152 bpm",
          "pace_target": "5:30–6:00 /km",
          "rpe_target": 7,
          "coach_notes": [
            "Hold back early. Finish honest."
          ]
        },
        "tue": {
          "id": "w11-tue",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "4×20s strides at 5K effort, full recovery between."
          ]
        },
        "sat": {
          "id": "w11-sat",
          "type": "easy",
          "label": "Easy run — Zone 2",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4
        }
      },
      "long_run_hrs": 0.7,
      "weekly_km": 19
    },
    {
      "n": 12,
      "date": "2026-07-20",
      "label": "Race week",
      "theme": "The work is done. Arrive rested.",
      "type": "race",
      "phase": "taper",
      "badge": "race",
      "sessions": {
        "sun": {
          "id": "w12-sun",
          "type": "race",
          "label": "Race — Target Marathon",
          "detail": null,
          "distance_km": 42.2,
          "primary_metric": "distance",
          "coach_notes": [
            "Start slower than feels right. First 5 km at Zone 2.",
            "No new shoes, no new food."
          ]
        },
        "tue": {
          "id": "w12-tue",
          "type": "easy",
          "label": "Easy shakeout",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 2,
          "coach_notes": [
            "Short and relaxed. Wake the legs, nothing more.",
            "4×100m strides at 5K effort, full recovery between."
          ]
        },
        "thu": {
          "id": "w12-thu",
          "type": "easy",
          "label": "Easy shakeout",
          "detail": null,
          "distance_km": 4,
          "duration_mins": 28,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 2,
          "coach_notes": [
            "Short and relaxed. Wake the legs, nothing more."
          ]
        },
        "sat": {
          "id": "w12-sat",
          "type": "easy",
          "label": "Race-week easy",
          "detail": null,
          "distance_km": 9,
          "duration_mins": 63,
          "primary_metric": "distance",
          "zone": "Zone 2",
          "hr_target": "< 140 bpm",
          "pace_target": "6:30–7:30 /km",
          "rpe_target": 4,
          "coach_notes": [
            "Conversational. Keep the legs moving without adding fatigue."
          ]
        }
      },
      "long_run_hrs": null,
      "weekly_km": 59,
      "race_notes": "Race day: Target Marathon. Start at Zone 2. The second half is where the race begins."
    }
  ]
}
```
</details>
