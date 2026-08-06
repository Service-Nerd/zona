# App Store Copy — Zonna v1

> **🛑 SUPERSEDED (2026-06-23).** The canonical App Store listing source is now `docs/releases/app-store-listing.md`. This file is retained as the v1 launch submission record only — do not edit, do not treat as current. Any drift between docs is resolved in favour of `app-store-listing.md`.

**Status:** first draft 2026-05-21. Awaiting Russ's red pen.
**Constraints:** Apple App Store Connect submission fields.

---

## Name (30 chars max)

```
Zonna
```

5 chars. Done.

---

## Subtitle (30 chars max) — ✅ locked

```
Plans to stop you overtraining
```

30/30 (no trailing period — a period would exceed the 30-char limit). Matches the live App Store subtitle. Sourced from `BRAND.appStoreSubtitle` in `lib/brand.ts`. Do not edit here — change at source.

---

## Keywords (100 chars max, comma-separated, no spaces between commas-and-words for token efficiency)

```
heart rate,zones,marathon,half marathon,10k,5k,training,coach,easy runs,pace,recovery,vdot,tempo
```

**Char count:** 96/100.

**Rationale:**
- Words already in name (`Zonna`) and subtitle (`plans`, `stop`, `overtraining`) are auto-indexed by Apple — never repeat them here.
- Commercial intent first: race distances (`marathon`, `half marathon`, `10k`, `5k`) drive the most search volume in running.
- Methodology: `heart rate` + `zones` are the strongest semantic signals for the product category.
- Identity: `coach`, `easy runs`, `recovery`, `tempo`, `pace` cover what the product is about.
- `vdot` is a Daniels' VDOT shoutout — narrower, but it surfaces the app to runners who already know structured training.
- **Not included** (deliberately): competitor brand names (Apple rejects), `apple watch` / `garmin` (brand-name rejection risk), `polarised` (too niche for the search volume cost), `5k plan` (subtitle covers the plan concept).

**Hot-swap options if any keyword underperforms post-launch:**
- Drop `vdot` → add `interval`
- Drop `tempo` → add `cardio`
- Drop `pace` → add `zone 2`

---

## App Store description (4000 chars max)

**Notes:**
- Apple shows ~250 chars before the "more" tap on iPhone. The first paragraph must do the conversion work alone.
- Plain text only. No markdown bold/italics. No emojis.
- Apple rejects promotional superlatives ("#1", "best") and competitor name-drops. None used.
- All-caps headers are an App Store convention — readable in plain text.

```
You're trying hard. That's the problem. Most amateur runners go medium-hard on everything — never truly recover, never truly push, and wonder why they don't improve. Zonna prescribes the zone for each session and holds you to it. Easy days are easy. Hard days are hard. The grey middle disappears.

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

Your health data stays on your device by default. Apple Health permissions are read-only. We never write back. No data sold, ever. Full policy at zonna.run/privacy. Terms of use at zonna.run/terms.

You can't outrun your easy days.
```

**Char count:** ~2,050 / 4,000. Deliberately under — Apple data suggests shorter, scannable descriptions out-convert wall-of-text. Room to add if a section ends up missing during real-device review.

---

## Promotional Text (170 chars max, can be edited without resubmission)

The "subtitle for what just shipped" field. Updates without going through Apple review again — useful for "new in this version" copy after each update.

**v1 launch suggestion:**

```
14 days free. A full plan for your race, a weekly zone score, and a coach who actually reads your runs.
```

**Char count:** 102/170.

---

## Review Information (per-subscription, both SKUs)

App Store Connect requires per-product Review Notes + a screenshot for each subscription. Use the same content for both monthly + annual SKUs.

**Review Notes (per product):**

```
Zonna is a running training app. This subscription unlocks the AI coaching layer:

- Kit, the in-app coach, generates per-run analysis comparing what the runner did to the prescribed zone
- A weekly zone-discipline score, summarising how the runner held their zones across the week
- Dynamic plan reshaping when sessions are missed, days are changed, or new injuries logged
- Per-run pace and heart-rate analysis using Apple Health data

The free tier provides a complete, generic training plan for the runner's chosen race distance (5K, 10K, half marathon, or marathon) including session detail and heart-rate zone targets. The free tier is fully usable without a subscription.

Demo account for review: [TO ADD — create a fresh account with trial expired + a populated plan, share credentials here]
```

**Required:** the demo account credentials block before submission. Reviewer cannot exercise the paid layer without an expired-trial account in the populated state.

**Review Screenshot (per product):** one screenshot of the UpgradeScreen with both pricing options visible. Use the iPhone 6.7" frame.

---

## Open items before submit

- [ ] **Demo account** — create fresh account, generate plan, expire trial via Supabase (`UPDATE user_settings SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE email = '...'`), confirm `is_admin = false`, add credentials to Review Information Notes on both subscription products
- [ ] **Subscription Review Notes** — text field in each subscription product → Review Information (alongside screenshot already uploaded). Paste the review notes block from above. Blocked on demo account credentials.
- [ ] **Marketing screenshots** — 5 shots × 2 device sizes (iPhone 15 Pro Max 1290×2796 + iPhone 14 Plus 1284×2778) from simulator with seeded data. See screenshot spec below.
- [x] ~~Production privacy/terms verification~~ — confirmed live 2026-05-15
- [x] ~~Russ red-pen pass on description voice~~ — accepted as-is 2026-05-28
- [x] ~~Russ confirm keywords list~~ — confirmed 2026-05-28
- [x] ~~Promotional text~~ — draft accepted 2026-05-28

## ASC metadata status — 2026-05-28

- [x] Name: `Zonna`
- [x] Subtitle: `Plans to stop you overtraining`
- [x] Description: pasted
- [x] Keywords: pasted
- [x] Promotional Text: pasted
- [x] Support URL: `https://www.zonna.run`
- [x] Privacy Policy URL: `https://www.zonna.run/privacy`
- [x] App Privacy / Data Collection questionnaire: complete
- [x] IAP subscription products: both Ready to Submit (localization + review screenshot + territory availability all done)
- [ ] Subscription Review Notes: pending demo account
- [ ] Marketing screenshots: not started
- [ ] Demo account: not started

---

## Screenshots — specification

Apple requires screenshots at specific device frame sizes. As of v1, the **two mandatory** sizes are:

| Display | Resolution (px) | Frame source | Real device |
|---|---|---|---|
| **iPhone 6.7" / 6.9"** | 1290 × 2796 | iPhone 15 Pro Max / iPhone 16 Pro Max simulator | iPhone 15 Pro Max or 16 Pro Max |
| **iPhone 6.5"** | 1284 × 2778 (or 1242 × 2688) | iPhone 11 Pro Max / iPhone 14 Plus simulator | iPhone 14 Plus / 11 Pro Max |

(5.5" was retired by Apple in 2024. Old `iPhoneX_*` device frame is no longer mandatory.)

**Submit 3–5 screenshots per size.** Five gives Apple the most carousel space; three is the minimum.

### Pre-capture data seeding (do this once on the simulator)

The screenshots need to look like a real user mid-build, not a fresh install. Before capturing:

1. Sign in via Google to a seed account (separate from the Apple-review demo account)
2. Run the wizard with a believable input: half marathon, 8 weeks out, ~30 km/week, 4 days/week, long-run Sunday, no injuries, age 38, training_age "structured"
3. Manually log 3–4 prior sessions across the past 2 weeks so the dashboard and Plan screen have history
4. Wait for Kit's AI analyses to populate (or trigger them manually if needed)
5. Take screenshots at this state

This avoids: empty MeScreen, generic "log your first session" empty states, no coach notes, no zone score, etc.

### The 5-shot narrative arc (locked — both device sizes get the same 5)

Apple sorts screenshots in upload order. This order tells a story: **discovery → product → proof → upgrade → close.**

| # | Screen | Caption (overlaid in Apple's screenshot tool — keep under 30 chars per line, 2 lines max) | Why this shot |
|---|---|---|---|
| 1 | **Today screen** with an active hard session card visible (e.g. an intervals session, mid-week build phase) | `The plan that knows` `you've got a day job.` | First shot is the conversion shot. Sets up the brand thesis with the most visually striking screen. |
| 2 | **Session Detail** with full prescription (zone, HR target, pace bracket, description) and a Kit coach note visible | `Every session,` `with a reason.` | Demonstrates the depth of coaching. The Kit note is the "AI that reads your runs" claim, visible in product not just description. |
| 3 | **Plan screen** showing the Now / Next / Later weeks + a session strip card | `Built around your race.` `Not around a template.` | Counters the "generic training plan" preconception. The week-strip + Now/Next/Later structure is genuinely distinctive. |
| 4 | **Coach / Post-run analysis** showing Kit's per-run feedback after a logged session | `Tells you what you` `actually did.` | The product's recurring value moment — proves the subscription is not a one-time-payment-of-features. Shows the brand voice. |
| 5 | **MeScreen profile** with HR zones visible, "Careful Now" section visible, recent-tweaks log visible | `Slow down.` `You've got a day job.` | Closes on the brand line. Familiar pattern. Validates that the app's identity is consistent end-to-end, not just landing page polish. |

### Caption design rules

Apple's screenshot tool overlays captions in white-on-image. The Apple convention is bold display type, 2 lines max, large size. Match the brand voice:

- **Sentence case, not Title Case.** ("Built around your race." not "Built Around Your Race.")
- **End every caption with a full stop.** Brand voice.
- **No exclamation marks.** Banned.
- **Avoid the word "AI"** in captions — Apple is increasingly scrutinous of "AI" claims in marketing. The functional claim ("Kit reads your runs") lives in the description, not the caption.

### Capture protocol

1. **Simulator → File → Open Simulator → iPhone 15 Pro Max (iOS 17+)**
2. Navigate the app to the target screen with the seed data in place
3. **Cmd-S** captures a screenshot to Desktop (1290×2796 already correct — no resizing needed)
4. Repeat for all 5 shots
5. Switch to iPhone 14 Plus simulator; repeat all 5
6. Upload to App Store Connect → App Information → Screenshots in the order above
7. Add captions through Apple's "Smart Banner" or in a tool like **Screenshot Studio** before upload — Apple Itself does not provide a built-in caption overlay tool

**Don't use third-party "screenshot framing" apps** that add fake device bezels around the image — Apple's listing already shows them inside a real device frame. Doubling up looks amateur.

### Optional but high-leverage

- **App Preview video** (15–30s, optional): a single screen recording of the simulator navigating through 3–4 key flows (Today → tap session → Plan → tap upgrade). Apple plays it before the screenshots. Defer for v1 — adds 1–2 days of work and ASO data doesn't suggest a big conversion lift unless the video is *very* good. Worth doing in v1.1.

### Open items

- [ ] Decide whether to include captions overlay or upload bare screenshots (recommend: captions — adds editorial layer Apple's listing format supports)
- [ ] Pick caption tool: Screenshot Studio (paid), Previewed.app (paid), Figma (free, manual), or Sketch (free if you have it)
- [ ] Seed the screenshot account and snap all 10 shots (~1h of focused work)
