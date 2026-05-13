# Zonna — Brand Brief

**Compiled:** 2026-05-13
**Source:** Extracted from `lib/brand.ts`, `app/globals.css`, `docs/canonical/`, `docs/alignment/`, `package.json`, `public/manifest.json`, `assets/*.svg`, `README.md`.
**Audience:** Designers and developers building the full brand identity.

---

## 1. Product Summary

### App name
**Zonna** — current and canonical. Brand was launched internally as "Zona" and renamed to "Zonna" in 2026. The brand may rename again, so all brand strings are parameterised in `lib/brand.ts → BRAND.name`. Nothing brand-related is hardcoded in components.

### Bundle / identifiers
- iOS bundle ID: `app.zonna.ios`
- PWA manifest name: `Zonna`
- npm package name: `zonna`
- App Store subtitle (30 chars): **"Training plans that stop you overtraining."**

### One-line description
A running training app that stops non-elite runners from overtraining.

### Core idea (positioning sentence — internal only, doesn't ship verbatim)
> "Zonna is for runners who always go hard on their easy days — who have a life, a day job, and no business training like professionals."

### Core truth
> "You're trying hard. That's the problem."

### Product idea
Zone discipline. The app prescribes the zone for each session and holds the user to it — easy when it's easy, hard when it's hard. Most amateur runners collapse this distinction into a "grey middle." Zonna removes that ambiguity.

### Core functionality (shipped, verified against `docs/canonical/feature-registry.md`)
- **Plan generation** — rule-engine templates (FREE: 5K/10K/HM); AI-enriched plans for trial/paid (marathon/50K/100K paid-only)
- **Today / Plan / Me screens** — core navigation; Coach tab paid-only
- **Strava integration** (PAID) — OAuth, run sync, HR/pace ingestion, auto-analysis pipeline
- **Session feedback** (PAID) — 4-dimension scoring (HR/distance/pace/efficiency), AI verdict + body text via Claude Haiku
- **Weekly coaching report** (PAID) — zone discipline + load ratio + AI headline/body/CTA
- **Dynamic plan reshaping** (PAID) — 5 trigger types: skip with reason, session reorder, silent miss, fatigue softening, RPE disconnect
- **VDOT + Tanaka HR zones** — dual-anchor pace + HR ceiling on every session
- **Foundation block** — automatic prep weeks when plan start is >7 days out
- **AI coach "Kit"** — single coach persona; appears via `<CoachByline />` (avatar + sparkle) on every AI-generated surface
- **Push notifications** — web push (VAPID) and iOS (APNs); verdict-based titles
- **Native iOS shell** — Capacitor wrapper around Vercel-hosted Next.js app; bundle ID `app.zonna.ios`
- **Apple + Google sign-in**; Strava OAuth via SFSafariViewController

### Tech stack (for context)
Next.js 14 (App Router) · Supabase (auth + DB) · Vercel hosting · Tailwind CSS · Capacitor iOS shell · Stripe (web) + RevenueCat (iOS, planned) · Claude Haiku 4.5 for all AI

---

## 2. Target User

**Adult runners with 1+ years of experience who go medium-hard on everything — they care too much to truly rest and not enough to truly push.**

### Demographics
- Age **25–65+**. Age is **not a target variable** — the psychographic travels.
- Training for a half marathon, marathon, or first ultra
- Has a day job, a family, or both
- Runs 2–5 times a week
- Uses or has used Strava
- Has tried a free plan or generic app and found it didn't fit their life

### What they currently believe
- "I need to run more"
- "I need to run harder"
- "Pros train hard every day, so should I"
- "Rest weeks are for beginners"
- "If I skip a session my fitness disappears"
- "My easy runs *feel* easy" (they don't — HR says 165)

### What's actually true
- They need to run **easier**, not more
- Fitness comes from Zone 2 volume, not threshold efforts
- Consistency matters infinitely more than intensity
- Missed sessions are a feature of adult life, not a failure
- Their body knows more than their watch

### The gap Zonna closes
> They think they need more training. They actually need more restraint and a plan that bends with their life.

### What success feels like
Quiet weekly proof: "78% of your runs were Zone 2. That's why you're getting faster." Permission to do less. A plan that doesn't shame them when life intervenes.

---

## 3. Existing Messaging — Taglines, Copy, Voice

### The three-line tagline system (locked, parameterised)

| Line | Job | `BRAND` constant | Surfaces |
|---|---|---|---|
| **"Training plans that stop you overtraining."** | What it does | `BRAND.appStoreSubtitle` | App Store subtitle, landing hero, paid ads |
| **"Slow down. You've got a day job."** | Who it's for | `BRAND.tagline` | Login, loading screen, OG image, meta description, in-app footer |
| **"You can't outrun your easy days."** | How it sounds | `BRAND.brandStatement` | Privacy footer, App Store description (editorial only) |

**Rules**
- Never mix two taglines on the same surface
- Never rephrase — these are locked strings
- Two punchlines on one screen dilute both. The tagline owns login.

### Supporting brand strings
| Constant | Value | Use |
|---|---|---|
| `BRAND.name` | `Zonna` | Wordmarks, `<title>`, OG, anywhere the name appears |
| `BRAND.coachName` | `Kit` | AI coach identity across all coach surfaces |
| `BRAND.signinSub` | `Access your training plan.` | Sub under login heading |
| `BRAND.signupSub` | `14 days, no limits. After that, you decide.` | Sub under signup heading |
| `BRAND.voiceAnchor` | `Hold the zone.` | Push notifications, coach cards, session prompts — in-product voice anchor. Never marketing. |
| `BRAND.push.weeklyReport` | `Your week, reviewed.` | Push notification title |
| `BRAND.push.runAnalysis` | `Run logged.` | Push notification title (fallback) |
| `secondaryPhrase` | `Train within the lines.` | **Social and content only.** Never in product UI. Not a `BRAND` constant in the code sense. |

### Pricing strings (GBP)
- Monthly: **£7.99 / month**
- Annual: **£59.99 / year** (≈ £5/month) — "Save 37% / year"
- 14-day free trial on first subscription
- Frame for upgrade screen: *"Less than the shoes you ruin by pushing too hard."*

### Voice of voice — Honest, slightly sarcastic, self-aware, encouraging without cringe

**The voice IS:**
- One sentence. Restraint in copy mirrors restraint in training.
- Specific over abstract. *"You were at 165bpm on an easy run"* beats *"you went too hard."*
- Self-deprecating where useful — the app admits you won't follow the plan perfectly.
- Humour lives in one-liners, not paragraphs.

**The voice is NOT:**
- A cheerleader (`"Amazing!"`, `"You crushed it!"`, `"Beast mode"`, `"gains"`)
- Vague (`"Nice work!"` means nothing — `"Kept it under control."` means something)
- Motivational (`"You got this"`, `"Crush your goals"`, `"Ready to conquer your next run?"`)
- AI-hedging (`"It seems like..."`, `"Based on your data..."`)
- Emoji-laden — no emojis in functional copy
- Passive-aggressive about missed sessions
- False-urgent (`"You need to run today!"`)
- "Here at Zonna, we believe..." — the app states, it doesn't pitch

### Canonical voice examples
| Situation | Zonna says |
|---|---|
| Ran too fast | *"Bit keen. Ease it back."* |
| Perfect execution | *"There it is. Don't ruin it."* |
| Rest day | *"Do nothing. It helps."* |
| Good post-run | *"Kept it under control."* |
| Missed session | *"It happens. Pick it back up."* |
| First run of the plan | *"First one. Start easy."* |
| Fatigue logged as wrecked | *"Body's talking. Listen to it."* |
| Drifted (HR too high) | *"{X}km — HR went high. Worth checking."* |
| Hard session done | *"{X}km — that was a tough one."* |
| Strong execution | *"{X}km in. Looked controlled."* |

### The "Generating Ceremony" (loading copy when a plan is being built)
**Paid tier:** "Reading your race date. Working backwards from the finish line." → "Calculating your Zone 2 ceiling. Lower than you'd expect." → "Protecting you from yourself. The 10% rule applies, even here." → "Building in the deload weeks. You'll want them." → "Almost done."

**Free tier:** "Working out your schedule." → "The 10% rule applies. Even now." → "Building in the deload weeks." → "Almost done."

**Reveal payoff:** *"There it is. Don't ruin it."*

---

## 4. Existing Visual Identity

### Design System: Warm Slate (ADR-007). Single light theme. No dark mode (ADR-008).

### Colours — all hex values are sourced from `app/globals.css` (single source of truth, no hardcoding in components allowed)

#### Surface
| Token | Hex | Role |
|---|---|---|
| `--bg` | `#F3F0EB` | Primary background — warm off-white |
| `--bg-soft` | `#EDE9E1` | Inset areas, input fields |
| `--card` | `#FFFFFF` | Card surfaces |

#### Ink (text)
| Token | Hex | Role |
|---|---|---|
| `--ink` | `#1A1A1A` | Primary text — near-black, not pure |
| `--ink-2` | `#3D3A36` | Secondary text — warm dark grey |
| `--mute` | `#8A857D` | Muted / supporting |
| `--mute-2` | `#B5B0A7` | Placeholder / disabled |

#### Accent
| Token | Hex | Role |
|---|---|---|
| `--moss` | `#6B8E6B` | **Primary accent** — CTAs, active states, completion |
| `--moss-soft` | `rgba(107,142,107,0.10)` | Soft accent background |
| `--moss-mid` | `rgba(107,142,107,0.25)` | Mid-weight accent background |

#### Semantic
| Token | Hex | Role |
|---|---|---|
| `--warn` | `#B8853A` | **Coaching only** — coach notes, warnings (warm amber) |
| `--warn-bg` | `#F5EBD4` | Warm amber tint — coach block background |
| `--coach-ink` | `#3D2600` | Warm dark brown — text on `--warn-bg` only |
| `--danger` | `#B84545` | Errors only — **never in training UI** |

#### Session type colours
| Type | Token | Hex |
|---|---|---|
| Easy run | `--s-easy` | `#3D6FB0` |
| Long run | `--s-long` | `#5E4FB0` |
| Quality / tempo | `--s-quality` | `#B8853A` |
| Intervals | `--s-inter` | `#B84545` |
| Race | `--s-race` | `#C86A2A` |
| Recovery | `--s-recov` | `#4E8068` |
| Strength | `--s-strength` | `#5A6578` |
| Cross-train | `--s-cross` | `#3D8A88` |
| Rest | — | No accent |

#### Lines and other
| Token | Value |
|---|---|
| `--line` | `rgba(26,26,26,0.08)` |
| `--line-strong` | `rgba(26,26,26,0.15)` |
| `--strava` | `#FC4C02` (fixed brand colour for Strava) |

#### Banned values (will fail pre-commit hook)
- `#D4501A` (ember orange — old palette)
- `#f5f2ee` (warm beige — old palette)
- `#0B132B` (navy — retired System B)
- `#5BC0BE` (teal — retired System B)
- Any hardcoded hex inside an `app/` or `components/` file

### Typography

| Property | Value |
|---|---|
| **Single font** | **Inter** (Google Fonts, weights 300–900) |
| Token: UI | `var(--font-ui)` → `'Inter', sans-serif` |
| Token: brand | `var(--font-brand)` → `'Inter', sans-serif` |
| Retired | Space Grotesk, DM Sans, DM Mono, Bebas Neue — all banned |

**Type scale (from `ui-patterns.md`):**

| Role | Weight | Size | Notes |
|---|---|---|---|
| Hero display | 800 | 56px | Today screen hero ("10km, slowly.") |
| Screen title | 800 | 26px | Page headings |
| Metric large | 800 | 44px | RestraintCard percent, big stats |
| Metric medium | 700 | 17px | Session card distance |
| Card primary | 600 | 15px | Session name |
| Body | 400 | 14px | Description, coach note |
| Card secondary | 400 | 12px | Zone, type, supporting detail |
| Section label | 700 | 10px | Uppercase 0.08em — eyebrows |
| Wordmark | 800 | 14px | ZONNA nav wordmark |

### Logo and icon

**Current marks** (sourced from `assets/icon-only.svg`, `assets/splash.svg`, `public/icons/`):

The mark is a **simple geometric icon** — no wordmark, no typography:
- Outer circle: `#1A1A1A` stroke on `#F3F0EB` warm-slate ground (no fill)
- Inner dot: solid `#6B8E6B` moss

```
   ⊙   ← outer ring (ink), centred moss dot
```

Read: a target / a zone / a discipline marker / a runner inside the line. Visually quiet, intentionally non-athletic.

**Sizes shipped:**
- iOS app icon (1024px, rounded rect, 225px radius)
- Splash screen (2732×2732)
- PWA icons 72/96/128/144/152/180/192/384/512 + maskable variants
- Favicons 16/32
- Source SVGs in `public/icons/source/`: light, dark, maskable

**No wordmark logo file exists yet.** The "Zonna" wordmark currently lives only as styled text (Inter 800, 14px) in the nav bar and on login/loading screens.

### Visual principles (`docs/canonical/brand.md`, `ui-patterns.md`)
- **Warm, grounded, athletic.** No decoration for decoration's sake.
- **Bold metrics, quiet context.** Large numbers, small muted labels underneath.
- **Type accent, not flood.** Session colours appear as left borders, dots, or small chips — never as full card backgrounds.
- **No chrome.** No stacked box shadows, no gradients, no decorative dividers.
- **No popups.** All interactions navigate to full screens. Modals only for destructive confirmations.
- **No red in the training UI.** Red implies failure; amber is for coaching warnings.
- **Restraint = progress.** Whitespace, brevity, and silence are features.
- **AI provenance is visible.** Model-generated content carries the `<AIMark />` sparkle + the `<CoachByline />` Kit avatar. Working state pulses (no spinners).

### Reference aesthetic
**Runna + Planzy** — bold metric hierarchy, warm athletic cards, left-accent session-type indicators, week-strip navigation, clean session rows.

### App icon at 60×60 (intent)
Stays legible as a tiny target — outer ink ring + moss centre dot on warm-slate ground. No name baked in.

---

## 5. Competitive Context

### Named competitors (from `docs/alignment/brand-product-alignment.md`)

| Competitor | What they do well | Where Zonna wins |
|---|---|---|
| **Runna** | Polished UI, good plan generation, strong brand | Runna assumes you'll follow the plan as written. Zonna assumes you won't, and adapts. Runna has no point of view on effort — it just gives you sessions. Zonna tells you when you're overcooking. Zonna costs less. |
| **Coopah** | (Listed by user; not detailed in repo) | (No internal contrast text exists.) |
| **Planzy** | (Listed by user; cited as a design reference, not a direct competitor.) | — |
| **A free plan (magazine / PDF)** | Zero cost, simple | No adaptation. No feedback. No conscience. Skips a week → the plan doesn't know. |
| **Nothing (running on feel)** | Freedom. No app. | "You've been running on feel for years. Has it worked? If yes, carry on. If not, maybe it's time to listen to someone else." |

### The gap Zonna fills that none of them do
None of the named competitors **call the user out for overtraining**. None enforce zone discipline as a product idea. None reshape the plan when life gets in the way. Zonna's edge is the *opinion* it has on the user's effort, not just the sessions it prescribes.

### How to frame the price
- "Less than the shoes you ruin by pushing too hard."
- "Less than a single session with a real coach, forever."

---

## 6. Tone of Voice — Quick Reference

| Dimension | Setting |
|---|---|
| Register | Honest, dry, slightly sarcastic |
| Person | Speaks *to* the user, not *at* them; uses "you", never "we believe..." |
| Length | One sentence, default. Never two when one will do. |
| Punctuation | No exclamation marks. Full stops do the work. |
| Emojis | Never in functional copy. |
| Numbers | Specific over vague (`"165bpm on an easy run"` not `"too hard"`) |
| Stance | The brand admits it knows you won't be perfect — and that's fine. |
| Northern-coach test | "Would a slightly sarcastic running-coach friend say this?" If no, rewrite. |

---

## 7. Existing Visual & Brand Assets Inventory

### Files present in the repo

| Asset | Path | Notes |
|---|---|---|
| Icon (light) | `assets/icon-only.svg`, `public/icons/source/zonna-icon-light.svg` | 1024×1024, ring + dot |
| Splash | `assets/splash.svg`, `public/icons/source/` | 2732×2732 |
| Icon (dark) | `public/icons/source/zonna-icon-dark.svg` | Dark-variant source |
| Icon (maskable) | `public/icons/source/zonna-icon-maskable.svg` | Android maskable source |
| PWA icons | `public/icons/icon-*.png` | Standard PWA sizes 72–512, plus maskables |
| Favicon | `public/icons/favicon-16x16.png`, `favicon-32x32.png` | |
| Apple touch icon | `public/icons/apple-touch-icon.png` | 180px |
| PWA manifest | `public/manifest.json` | Name = "Zonna", description = `BRAND.appStoreSubtitle`, theme `#1A1A1A`, bg `#F3F0EB` |
| Apple sign-in logo | `public/apple-logo.svg` | Auth UI |
| Google sign-in logo | `public/google-logo.svg` | Auth UI |
| OG image generator | `app/api/og/route.tsx` | Dynamic 1200×630; **currently uses retired navy/teal palette (marked DEPRECATED in `lib/brand.ts → og`)** — pending Warm Slate redesign |

### Brand strings — single source of truth
- `lib/brand.ts` — all canonical strings + pricing (locked)
- `app/globals.css` — all colour and typography tokens

---

## 8. Gaps — What's Missing for a Full Brand Identity

These are the holes a designer should expect to fill.

### Visual identity gaps
1. **No wordmark logo file.** "Zonna" exists only as styled Inter 800 text. A dedicated wordmark — possibly with the ring-and-dot lockup — is missing.
2. **No logo lockup variants.** Stacked, horizontal, monochrome, reversed-on-dark versions are all missing.
3. **OG / social image is still on the retired navy + teal palette.** Marked `DEPRECATED` in `lib/brand.ts → og`. Needs Warm Slate redesign (1200×630).
4. **No marketing site visuals.** Landing page (intended at `zonarun.app` per the alignment doc — note: the URL still uses the old "zona" brand) has no design.
5. **No App Store screenshot designs.** The narrative arc is locked (5 screens — see `brand-product-alignment.md §7`) but no visual templates exist.
6. **No print, sticker, t-shirt, or sponsor-asset treatments.** Founder runs Race to the Stones for Make-A-Wish UK on 11 July 2026 — no event-day brand kit.
7. **No motion guidelines.** Pulse and fade timings exist in CSS (`ai-mark-pulse`, `zonna-slide-up`); no broader motion language defined.
8. **No iconography set beyond Strava/Apple/Google logos.** UI icons are inline SVG inside components; no library exists.

### Brand-system gaps
9. **No photography or illustration direction.** The brand has never specified whether images of runners, landscapes, or any photography are allowed — and what they look like if so.
10. **No social channel visual conventions** for Instagram, TikTok, or the founder's `@doinghardthingsbadly` account.
11. **No brand-launch narrative.** Launch plan exists; brand-story copy (origin, mission, founder bio for App Store / press) does not.

### Naming / governance
12. **Old brand still leaks in two places:** the Supabase project ID is `wkppmpsvqkaxbekdgzdm` and Vercel project name is `rts-training-hub` — rename to `zonna` is on the backlog. The intended marketing domain `zonarun.app` is mentioned in older docs; needs an updated decision now that the brand is Zonna (likely `zonna.run`, `zonnaapp.com`, etc.).
13. **`BRAND.appStoreSubtitle` is 41 chars.** App Store hard limit is 30. Needs trimming before submission (e.g. "Plans that stop overtraining.")
14. **Coopah** is named as a competitor in this brief at the user's request, but **no internal contrast text exists for it in the repo**. Needs a researched position statement.

### Copy gaps (flagged in `brand-copy-alignment.md`)
15. Welcome screen body copy doesn't pass the voice check (DIV-007 — flagged, not yet fixed)
16. Free Coach card body is slightly salesy (DIV-008 — flagged, not yet fixed)
17. Full App Store description not yet written (E-011)
18. Subscription legal copy needs compliance review before submission (E-009)

---

## 9. One-Page Hand-Off Summary

| Field | Value |
|---|---|
| **Brand name** | Zonna |
| **Coach (AI) name** | Kit |
| **What it is** | Training plans that stop you overtraining |
| **Who it's for** | Adult runners (25–65+) with a day job who go medium-hard on everything |
| **Core idea** | Zone discipline — the app holds the line between easy and hard |
| **Tagline (in-app)** | Slow down. You've got a day job. |
| **Tagline (App Store)** | Training plans that stop you overtraining. |
| **Brand statement (editorial)** | You can't outrun your easy days. |
| **In-product voice anchor** | Hold the zone. |
| **Voice** | Honest, dry, slightly sarcastic, self-aware, never motivational |
| **Primary background** | `#F3F0EB` warm off-white |
| **Primary text** | `#1A1A1A` |
| **Primary accent** | `#6B8E6B` moss |
| **Coaching colour** | `#B8853A` warm amber (coaching only) |
| **Font** | Inter (single font, all weights) |
| **Theme** | Single light theme — no dark mode |
| **Logo mark** | Outer ink ring with centred moss dot on warm-slate ground (ring + zone) |
| **Pricing** | £7.99 / month or £59.99 / year (Save 37%) |
| **Trial** | 14 days, no limits |
| **Platforms** | Web (Next.js on Vercel) + iOS (Capacitor) |
| **Competitive reference** | Runna (polished, no opinion) · Planzy (visual reference) · Coopah (named, undocumented) |
| **Aesthetic reference** | Runna + Planzy — warm, athletic, restrained |

---

**Brief complete and ready to share.**
