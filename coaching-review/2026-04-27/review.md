# Zona Plan Coaching Review — 2026-04-27

Senior coach review of three engine-generated plans (5K beginner, 10K intermediate, HM intermediate). See `backlog.md` for actionable triage.

---

## Cross-cutting issues (highest leverage)

These appear in all three plans. Fix once, fixes everywhere.

1. **Race-week scheduling ignores `days_cannot_train`.** All three plans schedule shakeouts on Tue and Thu in race week, even when those days are explicitly blocked. Plan-week scheduling respects blocked days; race-week scheduling appears to use a hardcoded shakeout pattern.
2. **Theme/prescription mismatch.** Cases 01 and 03 have peak/taper themes ("This is where the fitness is built", "Volume drops. Intensity stays") that contradict the actual prescription (flat volume, no intensity).
3. **"Compressed" warning is undifferentiated.** Fires uniformly when peak < 95% target, but the meaning differs by persona — appropriate for Case 01 (returning beginner), genuinely problematic for Case 02 (Mark could carry more load).

---

## Case 01 — 5K beginner, finish goal (Sarah)

### Strengths
- All-easy approach is the right call for a returning runner with a finish goal. No quality work is the correct dose, not a missing feature.
- Conservative volume start (W1 at 20km vs current 18km) respects the 6-month gap.
- Recalibration parkrun callouts in W4 and W8 are a nice touch.
- Long run grows from 60min → 72min over 10 weeks — gentle and appropriate.

### Concerns
- **Race week (W12) puts shakeouts on Tue and Thu — both blocked days.**
- **Volume profile is flat, not progressive.** Peak weeks (W9/W10) at 20km and 23km are the same as W2 and W3. No overload. Theme says "where the fitness is built" but volume equals base weeks.
- **W4 deload (17km) drops below W1's 20km.** Reveals underlying flatness — there's nothing to deload from.
- **No strides anywhere.** A returning runner will get a race-day shock running faster than she's trained.
- Verify W11 long run sequencing for higher-volume runners (not a problem here but worth a check).

### Specific recommendations (priority-ordered)
1. **[High]** Fix race-week scheduling to honour `days_cannot_train`.
2. **[High]** Build a real progression curve. W1 should start at ~current_weekly_km (18km), peak weeks should reach ~125–135% of starting volume (~24–26km peak), deloads at ~80% of preceding week.
3. **[Medium]** Add 4×20s strides to one easy run per week from W3 onwards (Wed run, mid-week).
4. **[Medium]** Reword peak-week themes when prescription is flat.
5. **[Low]** Offer a tune-up 5K time-trial option in W10.

### Constitutional gaps
- **Blocked-day enforcement must apply to race week.** *Race-week scheduling MUST respect `days_cannot_train` exactly as plan-week scheduling does. No hardcoded day patterns for shakeouts.*
- **Peak volume must exceed base volume.** *Peak week volume MUST be ≥110% of week 1 volume. If it cannot be, downgrade the plan label from "12-week build" to "12-week maintenance" and explain.*
- **Returning-runner detection.** *Add an optional `weeks_at_current_volume` input (or infer from `longest_recent_run_km` vs target). If returning from a layoff >8 weeks, start volume at 70% of stated current and ramp at ≤10%/week.*

---

## Case 02 — 10K intermediate, sub-50 goal (Mark)

The case I'd push back hardest on. Mark is Zona's stated target user and the plan has multiple coaching errors.

### Strengths
- Easy pace ceiling (5:51–7:00/km) and HR cap (<146) correctly conservative for a sub-23:30 5K runner. Exactly the slow-down-easy-days enforcement the brand is built on.
- 4-day structure with one quality session per week is appropriate for a 38-year-old with knee history.
- Volume progression (30→37km base, peak 36km) is sane and respects the knee.
- W4/W8 deloads in the right places.

### Concerns
- **Quality sessions are mislabelled.** W9 says "Long VO2max", W10 says "Classic VO2max", but pace target is 5:06–5:20/km with coach note "Race-pace work. Target: 5:00 /km." That's 10K pace, not VO2max pace. Mark's true VO2max pace from a 23:30 5K is ~4:30/km. Calling 10K-pace work "VO2max" trains the wrong system and confuses the runner.
- **Goal pace appears miscalculated.** A 23:30 5K (4:42/km) projects to ~48:50 10K — Mark may already be sub-50 capable. Plan derived VDOT 40; a 23:30 5K is closer to VDOT 42–43. If VDOT is wrong, every paced session is wrong.
- **No race-specific work until W9 (4 weeks out).** W5–W8 quality is "Aerobic with hills" / "Steady aerobic" — useful for base, not race-specific enough.
- **Race week (W12) shakeouts on Tue/Thu — both blocked.**
- **Taper week (W11) tempo is only 5km/26min** — no race-pace sharpening reps.
- **Hill session in W5/W7 with knee history flag is risky.** "Aerobic with hills" at Zone 3–4 / RPE 7 puts loaded eccentric stress on the knee. System ignored `injury_history: [knee]`.

### Specific recommendations (priority-ordered)
1. **[High]** Fix VO2max labelling. If prescribed pace is 5:00/km (10K goal pace), call it "10K-pace intervals" or "Goal-pace cruise intervals." True VO2max for Mark would be ~4:25–4:35/km in 3–5min reps with full recovery.
2. **[High]** Audit the VDOT calculation. A 23:30 5K should produce VDOT ~42, goal pace ~4:55/km easily achievable.
3. **[High]** Replace W5/W7 hill sessions with progression runs or steady-state for runners with `injury_history: [knee]`.
4. **[High]** Add race-pace work earlier. W6–W8 should include at least one goal-pace session (e.g. 4×1km @ 10K pace, 2min jog).
5. **[Medium]** W11 taper: replace 5km tempo with 3×1km @ goal pace, 90s recovery.
6. **[Medium]** Race-week shakeout fix.
7. **[Low]** Add 6×100m strides to one easy run weekly from W4 onwards.

### Constitutional gaps
- **Session naming must match session physiology.** *A session labelled "VO2max" MUST prescribe pace at ≤95% of vVO2max (typically 3K–5K race pace). A session labelled with a race distance (e.g. "10K-pace intervals") MUST prescribe pace within ±2% of derived goal pace. If the engine cannot satisfy the label, it must rename the session.*
- **Injury history must modify session selection, not just volume.** *If `injury_history` includes "knee", "shin", "calf", or "Achilles", the engine MUST NOT prescribe hill repeats during build phase. Substitute progression runs or flat tempo.*
- **Race-specific exposure must scale with goal type.** *For `goal: time_target`, ≥50% of quality sessions in the second half of the plan MUST prescribe pace within ±5% of goal pace.*
- **VDOT derivation should be auditable.** *Surface derived VDOT and benchmark-to-VDOT conversion in the plan output.*

---

## Case 03 — Half marathon intermediate, 1:55 goal (Anna)

The strongest of the three plans, but with one structural problem and the same race-week bug.

### Strengths
- 14-week structure with 5-week base is appropriate for a HM build at this volume.
- Quality session selection genuinely race-specific: continuous tempo → cruise intervals → HM-pace intervals follows sensible specificity progression. This is what Case 02 should look like.
- Long run grows from 12.5km (W1) to 15km (W3, W7, W11) — sensible cap given 18km longest recent.
- Trail-running background and "love" of hard sessions respected with weekly quality from W6.

### Concerns
- **Long run too short for a 1:55 HM goal.** Peak long runs at 15km / 100min for a runner who'll be on her feet ~1:55 on race day means she never runs for the duration of the race in training. Standard practice is 1–2 long runs at 90–100% of race distance (19–21km) or progression long runs covering 1:50–2:10 time-on-feet. Her current longest is 18km — so 19–21km is well within reach.
- **No race-specific long-run structure.** All long runs are flat Zone 2. Gold standard for time-targeted HM is 2–3 peak long runs with embedded HM-pace segments (e.g. "16km easy with last 5km @ HM pace"). Currently zero.
- **Race week (W14) shakeouts on Tue/Thu — both blocked.**
- **W11→W14 long-run profile wastes W12.** Goes 14 → 15 → 14.5 → 10 → race. The 14.5 in W12 is neither peak nor true taper.
- **"Volume drops. Intensity stays." appears as W14 race week theme even though there's zero intensity in race week.**
- **W12 taper Wed is "Progressive tempo" 6.5km/35min and W13 race week is also "Progressive tempo" 5km/27min.** Race week 7 days out should be sharpening reps at race pace, not tempo. Tempo right before race day adds fatigue without adding fitness.

### Specific recommendations (priority-ordered)
1. **[High]** Long-run shape. Push W11 long run to 18–20km. Add a progression long run in W9 or W10 with final 4–6km at HM goal pace.
2. **[High]** Race-week shakeout fix.
3. **[Medium]** Replace W13 progressive tempo with 3–4×1km @ HM pace (5:27/km), 90s jog recovery, total ~5km.
4. **[Medium]** Smooth W11→W14 long-run profile. Either 17→14→10→race or 18→12→10→race.
5. **[Low]** Fix race-week theme copy.
6. **[Low]** Consider one mid-block tune-up race option (e.g. W7 or W9 parkrun PB).

### Constitutional gaps
- **Long-run distance must scale to race distance for time-targeted goals.** *For HM goal with `goal: time_target`, peak long run MUST reach ≥85% of race distance OR ≥90% of projected race time, whichever is higher. For marathon, ≥75% distance / 80% time. For 10K and below, no race-distance minimum.*
- **At least one race-specific long run required for time-targeted HM/marathon.** *Peak phase MUST contain at least one "long run with embedded race-pace segments" (e.g. final 25–40% of long run at goal pace).*
- **Race-week quality session must be sharpening, not tempo.** *In race week (final 7 days), if any quality session is prescribed, it MUST be short reps at race pace or faster. Never continuous tempo, threshold, or progression.*
- **Theme/prescription consistency check.** *Engine must verify that week themes are not contradicted by the actual prescription.*
