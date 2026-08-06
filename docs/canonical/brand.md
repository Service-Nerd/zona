# Brand — Zonna

**Authority**: This is Zonna's single prose brand authority — positioning, audience, competitors, tone of voice, and visual principles. These rules apply to all copy, UI decisions, and feature design. When in doubt: honest, calm, useful.

> **This document supersedes `docs/alignment/brand-product-alignment.md` as the positioning master (2026-08-06).** That file is retained as the v1 launch-plan record only.

### Where truth lives — this doc never restates exact values

| Layer | Source of truth |
|---|---|
| Exact brand strings + pricing | `lib/brand.ts → BRAND` / `PRICING` — reference the constant name, never paste the value |
| Visual tokens (colour, type) | `app/globals.css` (ADR-007) |
| AI coaching voice (prompt enforcement) | `lib/coaching/prompts/voiceRules.ts` (derives from the voice table below) |
| App Store listing copy | `docs/releases/app-store-listing.md` |
| Copy surface map + divergence log | `docs/canonical/brand-copy-alignment.md` |

If this doc and `lib/brand.ts` ever disagree on a string, `lib/brand.ts` wins — fix this doc.

---

## Brand Positioning

### The three-line tagline system (locked strings — never rephrase, never mix two on one surface)

| Line | Job | `BRAND` constant | Where it appears |
|---|---|---|---|
| "Training plans that stop you overtraining." | **What the app does** — functional, discovery-facing | `BRAND.appStoreSubtitle` — note: the *field value* is trimmed to Apple's 30-char limit (currently `'Plans to stop you overtraining'`); the line above is the full locked concept it stands for | App Store subtitle, landing hero, paid ads |
| "Slow down. You've got a day job." | **Who it's for** — the demographic hook | `BRAND.tagline` | Login, loading, OG image, meta description |
| "You can't outrun your easy days." | **How the brand sounds** — voice moment | `BRAND.brandStatement` | Privacy footer, App Store description (not login — tagline owns that space) |

When in doubt: discovery = #1, in-app = #2, voice moment = #3. Exact values live in `lib/brand.ts` — reference the constant, never paste the string.

**Tagline** (`BRAND.tagline`): "Slow down. You've got a day job."  
**Brand statement** (`BRAND.brandStatement`, editorial/App Store only): "You can't outrun your easy days."  
**Core truth**: "You're trying hard. That's the problem."  
**Audience**: Non-elite runners who blur their zones. They care deeply — enough to go medium-hard on everything, which means they never truly recover *and* never truly push. That care is the problem.

**The product idea is zone discipline, not just slowing down.** Zonna prescribes the zone for each session and holds the user to it — easy when it's easy, hard when it's hard. Most amateur runners collapse this distinction into a grey middle. Zonna removes that ambiguity. "Slow down. You've got a day job." names the user's dominant failure mode; it doesn't imply the app is only about running easy.

**In-product voice anchor** (`BRAND.voiceAnchor`): "Hold the zone."  
Used across push notifications, coach cards, and session prompts. Expresses zone discipline in the moment — the instruction to commit to whatever zone has been prescribed, whether that's easy or hard. Not for marketing; not for the login screen. Product-internal only.

**Secondary brand phrase** (social/content only): "Train within the lines."  
For social posts, content marketing, and editorial use. Reinforces the zone discipline idea in a more approachable register. Not for primary marketing copy and never used in the product UI — `BRAND.tagline` owns that space.

The tagline names a person, not a training philosophy — it speaks directly to the user's identity. The brand statement is the training truth; used in editorial contexts (App Store description, press, privacy footer) only. **Not used on the login screen** — the tagline already owns that space; two punchlines dilute both.

> **Tagline decision (backlog D5):** "Slow down. You've got a day job." wins because it identifies the person. All canonical strings live in `lib/brand.ts`. Never hardcode.

---

## Audience

**Internal positioning sentence** (doesn't ship verbatim; every decision should trace to it):
> Zonna is for runners who always go hard on their easy days — who have a life, a day job, and no business training like professionals.

**Who they are** — adult runners, 1+ years' experience, training for a half / marathon / first ultra. Day job, family, or both. Run 2–5×/week. Use or have used Strava. Tried a free plan or generic app that didn't fit their life. **Age is not a target variable** — the psychographic travels from 25 to 65+.

**What they believe now → what's actually true**

| They believe | The truth |
|---|---|
| "I need to run more / harder" | They need to run *easier*, not more |
| "Pros train hard every day, so should I" | Fitness comes from Zone 2 volume, not threshold efforts |
| "Rest weeks are for beginners" | Consistency beats intensity, always |
| "If I skip a session my fitness disappears" | Missed sessions are a feature of adult life, not a failure |
| "My easy runs feel easy" (HR says 165) | Their body knows more than their watch |

**The gap Zonna lives in:**
> They think they need more training. They actually need more restraint and a plan that bends with their life.

Every product decision, every piece of copy, every visual choice should reinforce this gap and resolve it for the user.

---

## Competitors, positioned honestly

| App | What they do well | Where Zonna wins |
|---|---|---|
| **Runna** | Polished UI, good plan generation, strong brand | Runna assumes you'll follow the plan as written; Zonna assumes you won't, and adapts. Runna has no point of view on effort — Zonna tells you when you're overcooking. Costs less. |
| **A free plan (magazine / PDF)** | Zero cost, simple | No adaptation, no feedback, no conscience. Skip a week and the plan doesn't know. |
| **Nothing (running on feel)** | Freedom, no app | "You've been running on feel for years. Has it worked? If not, maybe it's time to listen to someone else." |
| **Planzy** | Cited as a *design* reference, not a competitor | — |
| **Coopah** | Named by the founder; no internal contrast text exists yet | Needs a researched position statement |

**The edge:** none of them call the user out for overtraining, enforce zone discipline as a product idea, or reshape the plan when life intervenes. Zonna's edge is the *opinion* it has on the user's effort — not just the sessions it prescribes.

---

## Tone of Voice

Honest, slightly sarcastic, self-aware, encouraging without cringe.

**The voice has a name: Kit** (`BRAND.coachName`). Kit is the single AI coach persona — he appears via `<CoachByline />` (avatar + sparkle) on every AI-generated surface, and the voice rules below *are* Kit's voice. All coaching-prompt enforcement of this voice lives in `lib/coaching/prompts/voiceRules.ts`. Never hardcode 'Kit' in components — reference `BRAND.coachName`.

- **Not a cheerleader.** Never over-celebrate. Never use exclamation marks to paper over ordinary moments.
- **Not harsh.** Dry ≠ cold. The app cares — it just doesn't perform caring.
- **Not vague.** "Nice work!" means nothing. "Kept it under control." means something.
- **One sentence.** Zonna voice responses are always one sentence. No paragraphs.

### Voice Examples

| Situation | Zonna says |
|-----------|-----------|
| Ran too fast | *"Bit keen. Ease it back."* |
| Perfect execution | *"There it is. Don't ruin it."* |
| Rest day | *"Do nothing. It helps."* |
| Post-run, good execution | *"Kept it under control."* |
| Session skipped | *"It happens. Pick it back up."* |
| First run of the plan | *"First one. Start easy."* |
| Fatigue logged as wrecked | *"Body's talking. Listen to it."* |

### What the voice is NOT

- No emojis in app copy (unless explicitly added by a product decision)
- No "Amazing!", "Great job!", "You crushed it!"
- No passive-aggressive guilt about missed sessions
- No false urgency ("You need to run today!")
- No fitness influencer language ("smash", "beast mode", "gains", "push through")
- No AI-sounding hedging ("It seems like...", "Based on your data...")

The canonical response matrix for session-type-aware coaching lives in `getReflectResponse()` in `DashboardClient.tsx` and must stay consistent with these guidelines.

### Reframe Voice (POST-RUN-REFRAME-01)

The post-run reframe is the **only surface** where Zonna's voice extends beyond one sentence. It is also the only surface where Zonna gets to give the runner **the hug + the truth**, not just the truth. Read the structure carefully — the warmth lives in sentence 1, never the closer.

**Structure:**

| # | Sentence job | Register |
|---|---|---|
| 1 | **Acknowledge** — warmth-as-permission. Never invalidation, never cheerleading. | Warm. *"You're allowed a bad one."* / *"Hard week catching up."* / *"Don't take that to heart."* / *"You're not failing, even though it feels like it."* |
| 2 | **Cause** — name what the data actually says happened. | Specific, named. *"Tuesday was 80% above your zone ceiling."* |
| 3 | **Progress** *(optional — include when evidence exists)* — where the work IS paying off. | Specific evidence. Trend / cohort / completion rate / RPE pattern / consistency claim. |
| 4 | **Anchor** — return to the goal at the right altitude. | Factual, not motivational. Race name + time-to-race when available; next session or rest day otherwise. |

**Length:** three sentences when no progress evidence is available, four when there is. **Never more than four.** The structure is the discipline; the warmth lives in sentence 1.

**Warmth-vs-cringe calibration:**

| Warmth-as-permission (good) | Warmth-as-cheerleading (bad) |
|---|---|
| *"You're allowed a bad one."* | *"You're crushing it!"* |
| *"Don't take that to heart."* | *"Don't give up!"* |
| *"You're not failing, even though it feels like it."* | *"You've got this!"* |
| *"Hard week catching up."* | *"What a workout!"* |

The line: permission grants the runner the right to feel what they feel. Cheerleading tells them how to feel.

**Good reframes:**

| Scenario · Tier | User said | Reframe |
|---|---|---|
| Long run felt awful · Tier A · has race | *"Worst long run in months. I can't do this."* | *"You're allowed a bad one — it isn't the verdict it feels like. Your Z2 HR on this distance has dropped 8 bpm since March, so the engine is getting stronger even when the legs aren't agreeing. The consistency over the last 6 weeks is exactly what you're building on. Twelve weeks to race day."* |
| Easy felt hard after big week · Tier B · has race | *"Why was that so hard? Embarrassing."* | *"Hard week catching up — not embarrassing, just real. You've logged 11 of the last 14 sessions and your easy-day RPE has trended down 3 weeks running — the work is doing its job underneath. The plan's working underneath the feeling. Eight weeks to your half."* |
| Tempo missed target · Tier A · has race | *"Missed by 5 seconds. The plan's wrong for me."* | *"Don't take that to heart — one tempo isn't the story. Five seconds off is execution, and three months ago this same effort would have been 18 seconds slower. The progression is real even when one session doesn't land. Six weeks to race day."* |

**Bad reframes (and why):**

| Reframe | Why it fails |
|---|---|
| *"You're doing amazing! Don't give up — every run counts toward your goal!"* | Cheerleading. Vague. Doesn't acknowledge what was said. Off-brand. |
| *"Based on your data, it seems like you may be experiencing some fatigue. Your average HR was 162 with a drift of 8%."* | AI hedging. Dumps numbers without re-framing. No acknowledgement. No warmth. |
| *"Your trend is great — push through, you've got this!"* (when `acuteChronicRatio` flags overload) | **Reframe-positive against a risk signal is harm.** The warning must surface instead. |
| *"Rough one. Tuesday ran hot. Hold the zone next session."* | Truth without warmth. Reads punitive after a spiral. The opener has to acknowledge before the data lands. |

**Hard rules:**

- **Risk flags trump reframe.** If `acuteChronicRatio` or HR-drift or any rule-engine flag indicates overload or undertraining-with-risk, the reframe is silent. The coaching warning surfaces instead.
- **Specific evidence is mandatory in sentence 2.** No reframe without one named data point — what actually happened on this run. Generic acknowledgement without evidence is the failure mode.
- **Warmth lives in sentence 1, never the closer.** The anchor is factual. No *"You've got this."* No *"Keep going."*
- **Graceful degradation across data tiers.** The reframe must work for users with no Strava and no HealthKit. Evidence sources fall back through a ladder:
  - **Tier A (full history):** numerical trend or cohort claims — *"Z2 HR 8 bpm lower than March"*
  - **Tier B (plan + RPE only):** pattern claims — *"3rd consecutive easy day you logged 'in control'"*
  - **Tier C (minimum data, new user):** structural anchors — *"Week 2 of base — body's still calibrating"*
  - **If no tier supports a positive reframe:** stay silent. Acknowledge only. Don't manufacture evidence.
- **Voice-anchor permitted only when there's no goal.** *"Hold the zone next session."* may stand as the anchor when the user has no race or goal set. It does NOT replace a goal anchor when one exists.
- **AIMark mandatory.** Every reframe carries the AI provenance glyph. This is model output and the runner deserves to know.

The reframe regression suite lives in `docs/canonical/reframe-golden-cases.md`. Prompt changes that break the golden suite are blocked.

---

### Adjustment Voice — Two-Layer Honesty (RESHAPE-FIX-WAVE2A)

When the engine proposes a plan adjustment, two surfaces share the runner's attention: the **prose** ("why we're changing your plan") and the **diff** ("what specifically changes day by day"). They follow different voice rules because they have different jobs.

| Layer | Job | Provenance | Voice rules |
|---|---|---|---|
| **Prose** (above) | Explain the WHY — the coaching reasoning, the trade-off, the context | AI (CoachByline + AIMark) | Honest, slightly sarcastic, self-aware, encouraging without cringe. 1-3 sentences. Numbers only from `trigger_detail`. **Never** describe the structural diff itself ("moved X to Y") — the diff component does that. **Never** make stability claims about anything in the diff. |
| **Diff** (below) | Enumerate the WHAT — per-day before/after, deterministic | Rule engine (no AIMark) | No prose voice — labels only. Day name + before-label + → + after-label. Strikethrough on the before. Highlight on the after. The runner reads it like a calendar, not coaching. |

**Why two layers:** the 2026-06-26 incident shipped an AI summary that said *"the 24km run and hard-easy rhythm stay intact"* while the engine had just moved the long run from Sunday to Tuesday. The runner saw only prose; the diff lived in the database. He confirmed without seeing what would happen. The prose lied. The diff would have caught it.

**Hard rules:**
- **AI prose carries AIMark. Rule-engine diff does not.** Mixing provenance on the same card destroys the signal — runners stop noticing the mark when it appears inconsistently.
- **The model is forbidden from enumerating the diff.** Prompt rule #5: *"If you find yourself writing 'moved X to Y,' delete it: the diff already shows that."*
- **The model is forbidden from making stability claims about anything in the diff.** Prompt rule #6: phrases like *"X stays intact"*, *"Y is preserved"*, *"Z remains"* are forbidden for any session appearing in the diff. Stability prose is reserved for sessions NOT in the diff.
- **A runtime validator backs the prompt rules.** `lib/coaching/diff/validateAiSummary.ts` rejects AI output that contradicts the diff and falls back to the rule-engine summary silently (ADR-006 hybrid generation pattern). False positives (rejecting a good summary) degrade to safe rule-engine prose. False negatives (passing a confabulation) re-create the incident — so the validator skews toward rejecting anything that *might* be lying.
- **A coaching-note-only adjustment renders prose without the diff.** Zone reminders, fatigue flags with no structural change — the strip auto-hides when there are no non-unchanged days. Appropriate; there's nothing structural to surface.

The diff strip lives in `components/shared/AdjustmentDiff.tsx`. The validator lives in `lib/coaching/diff/validateAiSummary.ts`. The pattern is documented in `ui-patterns.md` § PendingAdjustmentBanner.

---

## User-First Principle

**Every feature and every screen must be evaluated from the user's perspective before the technical one.**

Before building anything, ask:
1. What does the user need from this screen?
2. What is the one job this screen does?
3. What would make the user feel the app understands them?

Only then ask the technical question. If the technical approach would compromise the UX, the technical approach changes — not the UX.

This is a design gate, not a guideline.

---

## Visual Principles

### Core rules

| Rule | Detail |
|------|--------|
| No red in the training UI | Red implies danger or failure. Zonna uses amber for warnings, coral for high-intensity sessions. Form validation / error states may use `--danger` (`#B84545`) only — never in training UI. |
| No popups | All interactions navigate to full screens. Modal overlays only for destructive confirmations (delete, disconnect). Never for information. |
| Back arrow top-left | Navigation is always predictable and reversible. |
| One job per screen | Each screen has exactly one primary purpose. No dashboards. No noise. |
| Calm guidance, not alerts | Information is presented; the user decides when to act. |
| Restraint = progress | Whitespace, brevity, and silence are features. Empty means calm, not broken. |
| Slide-up sheets | Mirrored nav bar at bottom, not top. |

### What this looks like in practice

| Pattern | Zonna does | Zonna does NOT do |
|---------|-----------|------------------|
| Upgrade prompts | Contextual, inline, triggered by action | Banners, countdown timers, forced modals |
| Session feedback | Post-log reflect — calm, invited | Celebratory popups, confetti, toast stacks |
| Errors | Quiet inline text | Red alert boxes, modals |
| Empty states | Simple label explaining the state | Heavy illustration "onboarding" noise |
| Navigation | Persistent bottom nav, predictable | Deep nesting, hamburger menus |

---

## Design System Reference

The visual language is defined in full at:

- `app/globals.css` — the Warm Slate palette + type tokens; the single source of truth for all colour and typography (ADR-007)
- `docs/canonical/ui-patterns.md` — component anatomy, spacing, typography
- `docs/architecture/ADR-007-warm-slate-palette.md` + `ADR-008-single-theme-only.md` — the current design system (single light theme). System B and ADR-001's colour tokens are superseded; the token-as-single-source-of-truth *principle* is retained.

### Quick reference: banned values

| Banned | Reason |
|--------|--------|
| `#D4501A` (ember orange) | Old palette — fully retired |
| `#f5f2ee` (warm beige) | Old palette — fully retired |
| DM Mono | Old font — fully retired |
| DM Sans | Old font — fully retired |
| Any hardcoded hex in a component | Must come from CSS custom property in `globals.css` |
| Red in training UI | Implies danger; use amber or coral instead |

---

## Design Implications (from positioning)

These follow from the positioning above and override earlier preferences:

1. **The Today screen must deliver the "slow down" message in under 3 seconds.** Its hero line is the highest-leverage pixel real estate in the app.
2. **The pending adjustment card is a hero feature, not a utility.** It's the proof point for "the plan adapts to your life."
3. **The restraint stat ("78% in Zone 2") is the most distinctive moment in the weekly summary.** It's the counter-intuitive thing that sells the app. Don't bury it.
4. **The coach voice is the product.** Every instance of Kit's copy is a marketing asset — treat it as such.
5. **Data density should decrease, not increase.** Zonna wins by showing less than Runna or Garmin.
6. **Visual polish never overrides copy clarity.** If a layout pushes coach voice into 12pt muted grey, the layout is wrong.
7. **The free tier must feel honest** — a plan that works, not a crippled experience screaming "upgrade." The pitch is: *"you want the app to know you better."*

---

## Invariants

- Tone of voice must be consistent across app copy, coaching copy, empty states, error messages, and onboarding
- Visual rules are non-negotiable without a product decision logged in this file and in `CLAUDE.md`
- User-first principle is a design gate on every feature build — not a suggestion
- All new copy must be reviewed against the voice examples before shipping
