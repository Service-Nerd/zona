# App Store Listing — Zonna (v1 launch)

> Single source for App Store Connect copy. Strategy: **inversion, not imitation** — be the one
> calm, honest voice in a category that all shouts "try harder." SLT-reviewed 2026-06-15.
> All locked brand strings sourced from `lib/brand.ts`. Never hardcode a price in screenshot art.

---

## Name & subtitle

- **App name:** Zonna
- **Subtitle (30 char):** `Plans to stop you overtraining` (source: `BRAND.appStoreSubtitle`, 30/30, matches live store)

## Promotional Text (170 char max, no resubmission required)

Updated for v1.8 (2026-06-23). Sits directly above the Description on the App Store product page — never duplicate phrases from Description ¶1.

```
No streaks. No badges. No fake urgency. A plan that holds you to easy when it's easy, hard when it's hard. 14 days free.
```

**120/170.** Job: filter (moat language) + offer. Description ¶1 carries the thesis + mechanism — no offer line there, no moat line there.

## Keyword field (100 char, hidden — don't repeat name/subtitle words)

Matches live ASC field as of 2026-06-23.

```
heart rate,zones,marathon,half marathon,10k,5k,training,coach,easy runs,pace,recovery,vdot,tempo
```

**96/100.** No data yet to support swapping — keep as-is for v1.8. Revisit when ASC search analytics give us a signal on which keyword underperforms.

---

## Screenshot captions (6 frames)

Each frame = bold headline + one subline, over a device mockup, on Warm Slate cream `#F3F0EB`.
First two frames carry the whole listing (search shows ~2–3). Voice: one sentence, no exclamation,
no cheerleading, dry and honest.

**Export size:** `1320 × 2868` (App Store 6.9" primary — iPhone 16/17 Pro Max). The tool exports
exactly this; Apple rejects anything not pixel-exact. `1290 × 2796` is the 6.7" fallback only.

> **Frame 4 (the `0·0·0` inversion) dropped 2026-06-16** — Apple App Review rejects "frames that
> don't depict the app." The moat language now lives in the description ("No streaks. No badges.
> No fake urgency.") rather than as a typographic frame.

| # | Job | Variant | Headline | Subline |
|---|-----|---------|----------|---------|
| 1 | The sting (thumb-stopper) | hero | **You're trying hard. That's the problem.** | Training plans for runners who never truly ease off. |
| 2 | The proof (free-tier true) | floating HR chip | **Every run has one job.** | Zone, heart-rate ceiling, and why — on every session. |
| 3 | The discipline | effort-distribution graphic | **Easy when it's easy. Hard when it's hard.** | No more grey-zone running that goes nowhere. |
| 4 | Adapts to life | floating PendingAdjustmentBanner | **Miss a day? The plan moves.** | No guilt, no cramming the week back together. |
| 5 | Honest coaching (deeper/paid) | cropped detail card | **A coach that skips the cheerleading.** | An honest read on every run. Never "great job." |
| 6 | The calm close | plan arc + trial pill | **You can't outrun your easy days.** | 14 days, no limits. After that, you decide. |

- Frame 1 headline = the core truth.
- Frame 4 is a faithful render of the `PendingAdjustmentBanner` component (`components/shared/PendingAdjustmentBanner.tsx`) — amber wash, amber left rail, "PLAN ADJUSTED" eyebrow, real summary text + Confirm/Revert actions. Body keeps "Moved, not crammed. Happens." verbatim per SLT 2026-06-15.
- Frame 6 headline = `BRAND.brandStatement` (App-Store-permitted); subline = `BRAND.signupSub`. Trial pill says "14 days free" — never a hardcoded price (`BRAND.PRICING` is the only source of truth).
- Frame 5 must screenshot the **real** post-run reframe component (POST-RUN-REFRAME-01) with AIMark — no mockup drift.
- Frame 2's HR-ceiling chip is **formula-derived (FREE)** — never carries AIMark.

---

## Per-frame capture spec (SLT-approved 2026-06-17)

Each frame below specifies the device screen to capture, the setup needed before capture, and a checklist to verify before exporting the PNG. The HTML tool composes the caption + frame furniture — your job is to drop the right device screenshot in.

### Frame 1 — "You're trying hard. That's the problem."

**Device screen:** Today screen, populated mid-block week.

**Setup before capture:**
- Sign into a real account with an active plan loaded (founder account works — Race to the Stones plan is fine).
- Pick a week that already has data behind it (Week 3+ of a multi-week plan).
- Today's session must be an easy / Z2 run (matches caption tone — softens the hero shot).
- Coach card must show real coach content — not the "no data yet" empty state.

**Screen state checklist:**
- [ ] Status bar wordmark reads "Zonna" cleanly — no "Zo•na" glyph artifact. **Verify on real device, not simulator.**
- [ ] Coach card visible at top with real text (e.g. "Wednesday's quality ran hot…").
- [ ] Today's session card shows distance + duration + zone target.
- [ ] Week strip visible with current day highlighted.
- [ ] Bottom nav visible: Today · Plan · Coach · Me.
- [ ] No notifications / no overlays / no upgrade banners covering anything.

**Composition note (already in HTML):** hero variant now renders the device with heavier shadow + slight scale-up so the phone reads as the anchor at thumbnail scale. No HTML edits needed at capture time.

---

### Frame 2 — "Every run has one job."

**Device screen:** Session Detail — Zone 2 easy session.

**Setup before capture:**
- From the Today screen, tap into an upcoming Zone 2 easy session.
- The "≤ 142 bpm" floating chip is composed by the HTML — not from the device.

**Screen state checklist:**
- [ ] "Hold the zone" eyebrow + "Zone 2 · aerobic" header visible.
- [ ] HR target visible in the zone card (e.g. ≤ 148 bpm).
- [ ] Distance + duration visible.
- [ ] "Why this session" coach block visible with real text.
- [ ] Session structure (Warm-up / Main set / Cool-down) visible.
- [ ] No AIMark on the HR chip in the composed frame — it's formula-derived (FREE).

---

### Frame 3 — "Easy when it's easy. Hard when it's hard."

**Device screen:** Plan screen — mid-block populated week.

**Setup before capture:**
- Open Plan tab on a populated plan.
- Pick a week mid-block where the week strip shows a mix of session types and colours.
- Voice card at top should show real coach content (not empty state).

**Screen state checklist:**
- [ ] Plan title visible ("Your plan" → "Race to the Stones" or equivalent).
- [ ] Week strip visible with session-type colour rail (mix of greens / blues / ambers).
- [ ] Voice / Now card visible with real coach text.
- [ ] Current week's calendar block visible below.
- [ ] No upgrade prompts / no empty states.

**Graphic spec (already updated in HTML 2026-06-17):** the comparison bar now reads `78% easy + 2% gap + 20% hard` with explicit "80% easy" / "20% hard" labels inside the bar, and "100% medium-hard · every run" on the contrast row. Polarisation visible per Seiler / Stöggl & Sperlich. No further redraw needed.

---

### Frame 4 — "Miss a day? The plan moves."

**Device screen:** Plan screen showing a deload / re-shuffled week.

**Setup before capture:**
- Use a plan where a `PendingAdjustmentBanner` would render in real product (skipped a Tuesday → moved to Thursday). The composed amber card mirrors that.
- Capture the Plan view behind it showing a deload week with strength + easy sessions distributed across the week.

**Screen state checklist:**
- [ ] Week header visible ("W30 · 1 Jun – 7 Jun" or similar) with weekly km total.
- [ ] Session rows visible Mon → Sun with type chips (STRENGTH / EASY RUN — ZONE 2 / LONG RUN).
- [ ] One or more session rows show real shifted state (it's OK if no live banner — the floating card in the composed frame is doing that job).
- [ ] Bottom nav visible.

**Composition note (already updated in HTML 2026-06-17):** floating amber card nudged from `top:340px` → `top:440px` so it clears the dynamic island cleanly. No further composition work.

---

### Frame 5 — "A coach that skips the cheerleading." 🔴 RE-SHOOT REQUIRED

**Device screen:** Post-run reframe card (POST-RUN-REFRAME-01) — cropped detail, no phone chrome (this frame uses the `crop` variant).

**Setup before capture (critical — most fragile frame):**
1. Sign into a test account with a populated mid-block week (Weeks 3–8 of a half marathon or marathon plan).
2. **Verify the risk gate is OPEN** — check `lib/coaching/reframeRiskGate.ts` logic:
   - `coaching_flag` is null / clear on the most recent session
   - No 2+ `flag` entries in the last 5 sessions
   - No 3+ consecutive Heavy or Wrecked RPE in recent sessions
   - No HR drift ≥15 bpm / ≥10% on the captured session
   If any of these fire, the reframe is silenced and an amber warning renders instead — **do not capture the warning state.**
3. Complete a Strava-linked or manual session yesterday so the reframe has data to read.
4. Navigate to either:
   - `SessionScreen` → reflect view (manual completion path), OR
   - `PostRunScreen` (Strava-linked path)
   — whichever surfaces the `ReflectionInput` component with a reframe card.

**Screen state checklist:**
- [ ] Reframe card visible with 3–4 sentences per `brand.md` § Reframe Voice structure.
- [ ] **AIMark glyph (sparkle + accent dot) visible on the reframe card — non-negotiable.**
- [ ] Sentence 1 = warmth-as-permission register ("You're allowed a bad one" / "Hard week catching up" / "Don't take that to heart" — never "You're crushing it").
- [ ] Sentence 2 = specific named evidence (a real data point — HR delta, RPE trend, completion count, etc.).
- [ ] Anchor sentence is factual (race + time-to-race, or next session) — not motivational.
- [ ] NOT the amber risk-warning state. NOT the empty state. NOT a "no data yet" message.
- [ ] No system overlays / no keyboard / no debug UI.

**Capture format:** cropped to the reframe card area (the `crop` variant in HTML expects a tall card image, no phone chrome).

---

### Frame 6 — "You can't outrun your easy days."

**Device screen:** Plan screen — same view as Frame 3 works, or any other Plan view that reads as the calm long-term picture.

**Setup before capture:**
- Open the Plan tab on a populated plan with race + multi-week arc.

**Screen state checklist:**
- [ ] "Your plan" → race name visible.
- [ ] Week strip with multi-session colour rail visible.
- [ ] Voice card / coach block visible with real text.
- [ ] Week calendar below visible.
- [ ] No upgrade prompts in view.
- [ ] No hardcoded price anywhere — the "14 days free" pill is composed by the HTML and sources from `BRAND.PRICING`.

---

## Capture workflow summary

1. Open `app-store-screenshots.html` in the browser (`.claude/launch.json → screenshots` runs the static server on port 4599).
2. For each frame above, capture the device screenshot per the spec, drop it into the matching slot in the HTML.
3. Click **PNG** on each card to export at `1320 × 2868` (App Store 6.9" primary).
4. Or click **Download all (6)** to export all six at once.
5. Upload to App Store Connect.

**Re-shoot list (2026-06-17):** Frame 1 (verify wordmark + use updated hero composition), Frame 3 (use updated graphic), Frame 4 (use updated card position), Frame 5 (full re-shoot — post-run reframe with AIMark, risk gate open).

---

## Visual treatment — SLT-approved (2026-06-15)

The board reviewed how aggressive the visuals should be to stand out in a crowded category. Verdict:
**Mid-energy, confident inversion** — not the 5th gradient-and-watch clone (Sutherland/Traynor), but not
the original six-identical-frames version either ("absence, not restraint" — Fried/Sutherland).

Built into `app-store-screenshots.html`:
- **Layout rhythm** — every frame composes differently (hero / floating fragment / graphic-led / floating amber card / cropped detail / arc). The eye travels; it reads as a journey.
- **Floating real-UI fragments** — depth pulled from the actual product (HR chip, PendingAdjustmentBanner), drawn in Warm Slate tokens.
- **Effort-distribution graphic (frame 3)** — drawn as *polarised* training (mostly easy, some genuinely hard, nothing in the grey middle) per Hutchinson — **not** a binary easy/hard switch, which would overclaim.
- **Moat language moves to description** — the "No streaks. No badges. No fake urgency." line carries the copy-proof wedge in text rather than a typographic frame (the prior `0·0·0` frame was dropped 2026-06-16 to clear Apple App Review).
- **Quiet moss contour** (~6% opacity) behind hero/close frames — flow without gradient-shouting.
- **A growing moss thread** at each frame's top — widens frame 1 → 6, signalling progression.
- **The cream stays.** In a sea of saturated gradients, the calm frame is the thumb-stopper (Sutherland/Wood). The cream *is* the differentiation.

---

## Description

**v1.8 (2026-06-23):** ¶1 rewritten to land the thesis + mechanism inside Apple's ~250-char preview window. Offer moved up to Promotional Text (above this on the product page) to avoid duplication. Rest of body unchanged from v1.7.

```
You're trying hard. That's the problem. Most runners go medium-hard on everything and never improve. Zonna gives you a zone for each session and holds you to it — easy when it's easy, hard when it's hard.

WHAT IT DOES

A training plan built for your race. 5K, 10K, half marathon, or marathon. Tells you what to do each day and why.

Heart rate zones paced to you. Calculated from your age and your runs. No guessing, no generic targets.

Real analysis after every run. Kit, your in-app coach, reads what you actually did against the zone you should've been in — and tells you honestly.

A weekly zone score. Every Sunday: how disciplined was your week. The number you didn't know you needed.

A plan that moves. Miss a session, change a day, get injured — your plan reshapes itself, calmly.

Apple Health integration. Your runs and recovery sync automatically. Nothing to log manually.

WHO IT'S FOR

Runners with a day job. People who've got training schedules and conference calls. The ones who keep going too hard because they've only got an hour after work and they want to make it count.

If you're a sub-elite athlete running 100+ miles a week, this isn't for you. Zonna is for the rest of us — the runners who blur their zones because life is loud.

WHAT'S FREE, WHAT'S PAID

Free: a complete training plan for your race, daily session detail, heart rate zone targets, manual logging.

Premium (14-day free trial, then £7.99/month or £59.99/year): Kit reads every run, weekly zone score, dynamic plan reshaping that responds to missed sessions or new injuries, post-run pace and heart-rate analysis, continuity across coaching surfaces.

PRIVACY

Your health data stays on your device by default. Apple Health permissions are read-only. We never write back. No data sold, ever. Full policy at zonna.run/privacy.

You can't outrun your easy days.
```

---

## What this listing deliberately does NOT do

- No stock lifestyle runner on frame 1 (RunKalott's wasted asset)
- No watch-logo compatibility wall (not a race Zonna wins)
- No confetti / "100%" / streak / completion-celebration frame (imports the category's reward grammar). The description names the absence ("No streaks. No badges. No fake urgency.") — the screenshots never depict the mechanic.
- No "AI knows you" claim on free-tier-visible frames (first session is the rule engine)
- No borrowed authority ("world-class," "trusted by millions") — no social proof at launch; revisit at v1.1 with real ratings
