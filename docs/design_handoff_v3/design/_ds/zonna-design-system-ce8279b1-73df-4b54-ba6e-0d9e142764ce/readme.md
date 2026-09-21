# Zonna — Design System

Zonna is an iOS + web running-coach app for **non-elite runners who go medium-hard on everything**. It generates a training plan from your race, history and week; prescribes the zone for every session; and reshapes the plan when life gets in the way. The product's opinion — *you are trying too hard on your easy days* — is the product.

- **Positioning line (what it does):** "Training plans that stop you overtraining."
- **Tagline (who it's for):** "Slow down. You've got a day job."
- **Brand statement (how it sounds):** "You can't outrun your easy days."
- **In-product anchor:** "Hold the zone."
- **The AI coach has a name:** Kit. Every AI-generated surface carries his byline.

Pricing (for mock content): £7.99 / month or £59.99 / year, 14-day full-access trial.

## Sources this system was built from

Everything here is derived from the product's own code and canonical documentation:

- **Repository:** https://github.com/Service-Nerd/zona (branch `main`)
- Design tokens: `app/globals.css` (Warm Slate, ADR-007) and `app/styles/polish-tokens.css` (card treatments)
- Architecture decisions: `docs/architecture/ADR-001-design-tokens.md`, `ADR-007-warm-slate-palette.md`, `ADR-008-single-theme-only.md`
- Brand + voice: `docs/canonical/brand.md`, `lib/brand.ts` (locked strings), `docs/canonical/brand-copy-alignment.md`
- Patterns + screens: `docs/canonical/ui-patterns.md`, `ux-principles.md`, `screen-architecture.md`, `docs/screen-inventory.md`
- Component source: `components/shared/*`, `components/marketing/*`, `components/ui/Wordmark.tsx`, `lib/session-types.ts`
- Assets: `public/icons/*`, `assets/*`, `public/fundraising/*`

If you have access, read those repositories directly before designing something new — particularly `docs/canonical/ui-patterns.md`, which is far longer than this file and is the upstream authority on component anatomy. Where this system and upstream disagree, upstream code wins.

## Products represented

| Surface | What it is | UI kit |
|---|---|---|
| **Training app** | The authenticated product: Today · Plan · Coach · Me, plus Session Detail and the notification inbox. Mobile-first, Capacitor-wrapped iOS + PWA. | `ui_kits/app/` |
| **Marketing site** | Public one-page site plus free-plan and comparison hubs. Server-rendered, no client JS in the chrome. | `ui_kits/marketing/` |

Not represented (exists upstream, not recreated): plan-generation wizard, upgrade screen, benchmark recalibration, Strava activity feed, the generating ceremony, legal pages.

---

## Index

| Path | What's in it |
|---|---|
| `styles.css` | The single entry point — `@import` list only. Link this. |
| `tokens/` | `colors.css` · `sessions.css` · `typography.css` · `spacing.css` · `radius.css` · `motion.css` · `base.css` · `fonts.css` |
| `components/forms/` | Inputs and pickers |
| `components/coaching/` | Coach voice + AI provenance |
| `components/training/` | Session and plan surfaces |
| `components/data/` | Metrics and evidence displays |
| `components/chrome/` | Wordmark, nav, CTAs, list rows, notifications |
| `components/marketing/` | Public-site chrome |
| `guidelines/` | Foundation specimen cards (colour, type, spacing, brand) |
| `ui_kits/app/`, `ui_kits/marketing/` | Click-through screen recreations |
| `assets/icons/`, `assets/imagery/` | Logos, app icons, third-party marks, photography |
| `SKILL.md` | Agent-skill entry point |
| `github.md` | Upstream source association + screen map |

## Components

Each directory holds `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md` and one `@dsCard` HTML.

**Forms & pickers** — `TextField`, `Select`, `Chip`, `SegmentedControl`, `CardSelect`, `DayGridSelector`, `WeekGrid`, `Ruler`, `WheelPicker`, `DurationPicker`, `RPEScale`

**Coaching voice** — `AIMark`, `CoachByline`, `CoachNoteBlock`, `AdjustmentDiff`, `PendingAdjustmentBanner`, `PlanIntroCard`

**Training surfaces** — `SessionCard`, `SessionTypeChip`, `ZoneBar`, `PlanArc`, `PreRunBandCard` (plus `getSessionColor` / `getSessionLabel` / `zoneNumberForType` / `zoneShortName` from `sessionTypes.jsx`)

**Data displays** — `ZoneRings`, `RestraintCard`, `StatCell`, `StatGrid`, `StatRow`, `TrendCard`

**Chrome & lists** — `Wordmark`, `CtaButton`, `BottomNav`, `WeekStrip`, `SectionLabel`, `ActionListCard`, `ActionListRow`, `EmptyState`, `VoiceAnchor`, `NotificationBell`, `NotificationRow`

**Marketing chrome** — `SiteHeader`, `SiteFooter`, `AppStoreBadge`, `WaitlistForm`

### Intentional additions

Three components have no single upstream file but are documented patterns lifted into components so screens can be assembled without hand-rolling:

- **`CtaButton`** — upstream ships this as the `.cta-primary` / `.cta-secondary` class pair in `polish-tokens.css` plus inline moss buttons per screen. One component, same values.
- **`BottomNav`**, **`WeekStrip`**, **`SectionLabel`**, **`EmptyState`**, **`StatCell`/`StatGrid`**, **`StatRow`**, **`ActionListRow`/`ActionListCard`**, **`VoiceAnchor`**, **`SessionTypeChip`** — all specified as numbered patterns in `ui-patterns.md` but implemented inline inside `DashboardClient.tsx` upstream (a 685 KB file). Values come from the pattern spec.
- **`ZoneRings`** and **`TrendCard`** are real upstream components; their implementations here follow the `ui-patterns.md` anatomy rather than the upstream source, which was too large to read in full. Treat the geometry as faithful and the internals as a reconstruction.

---

## Content fundamentals

**Voice: honest, slightly sarcastic, self-aware, encouraging without cringe.** It has a name — Kit — and it is one voice everywhere.

**Rules**

- **One sentence.** Product voice responses are one sentence. Two exceptions only: the post-run reframe (3–4 sentences) and a data correction (4 sentences, fixed structure).
- **Not a cheerleader.** No "Amazing!", "Great job!", "You crushed it!". No exclamation marks papering over ordinary moments.
- **Not harsh.** Dry is not cold. The app cares; it doesn't perform caring.
- **Not vague.** "Nice work" means nothing. "Kept it under control." means something.
- **No emoji.** Ever. The marketing site says so out loud: *"No fire emojis. Ever."*
- **No AI hedging** ("It seems like…", "Based on your data…"), **no fitness-influencer register** ("smash", "beast mode", "gains", "push through"), **no false urgency**, **no guilt** about missed sessions.
- **Second person, sparingly.** The app addresses "you"; Kit refers to himself as "I" only in coach copy. Product chrome is impersonal ("Your plan", "Done this week").
- **British English**, sentence case everywhere except 10px eyebrow labels (uppercase, tracked).
- **Numbers are honest and specific.** "8 bpm above ceiling", "78% in Zone 2", "£7.99 / month" — never rounded up for effect, never a fabricated stat.

**Voice examples (locked)**

| Situation | Zonna says |
|---|---|
| Ran too fast | "Bit keen. Ease it back." |
| Perfect execution | "There it is. Don't ruin it." |
| Rest day | "Do nothing. It helps." |
| Post-run, good execution | "Kept it under control." |
| Session skipped | "It happens. Pick it back up." |
| First run of the plan | "First one. Start easy." |
| Fatigue logged as wrecked | "Body's talking. Listen to it." |
| Today's session done | "That's the day. Nothing to prove now." |
| Plan changed | "Plan's been shifted." |
| Curiosity nudge | "Kit noticed something." |

**Warmth vs cheerleading.** Warmth grants permission ("You're allowed a bad one."); cheerleading tells the runner how to feel ("You've got this!"). Only the first is allowed, and only in the reframe's opening sentence — never as a closing line.

**Empty and error states** state the situation and stop: "Nothing to coach from yet." / "Waiting on your first run." Errors are quiet inline text, never red boxes, never modals.

**Marketing copy** is the same voice with more room: counter-positioning ("Probably not for you if…"), explicit restraint lists, honest pricing, and a first-person founder line. It states; it doesn't pitch.

---

## Visual foundations

**Warm Slate.** Single light theme — no dark mode, no theme switch. The palette is warm off-white paper with near-black ink and one muted green accent: it should look like it belongs next to a well-worn running journal, not a Bloomberg terminal.

**Colour**

- Page `#F3F0EB`, inset `#EDE9E1`, cards `#FFFFFF`. White cards lift off the warm background — that contrast is the only elevation device.
- Ink `#1A1A1A` → `#3D3A36` → `#8A857D` → `#B5B0A7`. Four steps, warm greys, never blue-grey.
- **Moss `#6B8E6B`** is the only accent: CTA, active state, completion, provenance rail. Not "healthy" green — disciplined, measured.
- **Warn `#B8853A`** is coaching *only* — coach notes, plan adjustments, cautions. Text on amber is `#3D2600`, never the amber itself.
- **Danger `#B84545`** is form validation only. Red never appears in training UI; a hard session is coral-red because it is a *session colour*, not a warning.
- Session/zone colours are one set (easy blue, long violet, quality ochre, intervals red, race orange, recovery green, strength slate, cross teal) and appear only as 3px left bars, 8px dots, or chips at 15% opacity — never as a card background.
- Third-party colour appears once: Strava orange on provenance lines.

**Type** — Inter only, 300–900. Both `--font-ui` and `--font-brand` resolve to Inter (Space Grotesk was retired). Hero 56/800 at -0.02em; screen titles 26/800; card primary 15/600; body 14/400 at 1.55; supporting 12–13/400 in `--mute`; eyebrows 10/700 uppercase at 0.08em (0.14em for coach). Metric pairs put the value first and large — value 44/800 tabular, label 13/400 beneath. Never a label above a value. Numerals are always `tabular-nums`.

**Spacing** — a fixed ladder: 4 · 8 · 12 · 14 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 56. Card padding 20px horizontal / 14–20px vertical; 12px between session cards; 28–32px between sections; 16px screen gutter; 44px minimum tap target; 60px bottom nav plus safe-area inset.

**Backgrounds** — flat colour bands. No gradients (the single exception is the 22px Kit avatar, a 135° moss→#5A7C5A ramp), no textures, no patterns, no hero photography in the product. Marketing alternates `--bg` and `--bg-soft` bands separated by hairlines. Imagery is real, warm, documentary race photography, and it lives on fundraising/story surfaces — not in the app.

**Borders, radii, shadows** — 1px `rgba(26,26,26,0.08)` hairlines, 1px `rgba(26,26,26,0.15)` for current/active. Radii 8 / 12 / 16 / 20, 14px on coach blocks, 100px pills for confirm/revert actions, 999px for the marketing CTA. Shadows are effectively absent: the strongest is `0 1px 2px rgba(26,26,26,0.04)` on a primary card. No stacked shadows, no inner shadows, no glow.

**Cards** — three treatments, and a card must declare which it is: *primary* (white, hairline, faint shadow, 18/20px padding, 12px radius — the tappable main object), *contextual* (`--bg-soft` or `--warn-bg`, no border, 16/18px, 10–14px radius — coach notes and hints), *data* (`--bg-soft`, no border, 14/16px, 10px radius — stat blocks).

**The coaching rail** — a 3px vertical bar inset 8px from the left edge marks a coaching surface: **moss** for Kit's voice, **warn** for a plan change. Rule-engine output gets no rail and no AI mark. This is provenance, not decoration.

**Transparency and blur** — no blur anywhere. Transparency is used in exactly three ways: colour tints (`rgba` line and accent tokens), opacity to signal state (done sessions at 0.3 accent, locked cards at 0.4–0.55, future plan weeks at 0.35), and the 0.35 ink scrim behind a slide-up sheet.

**Motion** — brief and functional. 0.15s `ease` on interactive state changes, 0.2s on colour fills, 0.28s slide-up for sheets, 0.05s on the ruler thumb. **No spinners** — a working state is a pulse (`ai-mark-pulse`, `coach-byline-thinking`, `zonna-ptr-pulse`) and loading is skeleton shimmer matching the content's shape. No bounces, no confetti, no celebration animation, no scroll-triggered reveals.

**Hover, press, disabled** — the app is touch-first, so hover is minimal: links darken to `#5A7C5A`, rows show a pointer. Press states are colour, not scale: an active chip takes a moss border plus `--moss-soft` fill; nothing shrinks or bounces. Disabled means `opacity: 0.45` plus a quiet hint line saying what's missing; in-flight means `opacity: 0.6–0.7` and a swapped label ("Saving…", "Adding…", "…").

**Layout rules** — one job per screen. Fixed elements: the bottom nav (app) and the sticky header (marketing) — nothing else is pinned. Sheets slide from the bottom with a 36×4px drag indicator and a mirrored footer action. Back arrow is always top-left, a 44px `--bg-soft` circle. No popups for information; modals only for destructive confirmation. Data density decreases over time — Zonna wins by showing less.

**Focus** — `2px solid var(--moss)` at 2px offset, everywhere, unchanged.

---

## Iconography

**There is almost no iconography, and that is the rule.** The system prefers a short text label to a glyph: the bottom nav is labelled, settings rows use a "›" chevron, selects use "▾", and the plan mover says "↕ Move" rather than showing a hamburger.

- **No icon font, no sprite sheet, no icon library** — upstream has none, and none was substituted here. If you need a glyph that doesn't exist, write the word instead.
- **Hand-authored inline SVG, four of them:** the AIMark sparkle (`components/coaching/AIMark.jsx`), the session-done checkmark (inside `SessionCard`), the notification bell (`components/chrome/NotificationBell.jsx`), and the Apple mark on the App Store badge (`components/marketing/AppStoreBadge.jsx`). The bell is the one icon-only control in the product, justified because it has no compact text equivalent.
- **Unicode as UI:** `→` (CTA and diff arrows), `›` (row chevron), `▾`/`▴` (disclosure), `←` (back), `✓` (completion), `⋮⋮` (drag handle), `ⓘ` (explainable metric), `✦` (marketing's stand-in for the AI sparkle), `—` (marketing list bullets). These are typographic, sized in px, coloured with tokens.
- **Emoji: never.**
- **Brand marks in `assets/icons/`:** `zonna-icon.svg`, `zonna-mark.svg`, `zonna-icon-light.svg`, `zonna-icon-dark.svg`, `zonna-icon-maskable.svg`, `zonna-icon-192.png`, `zonna-icon-512.png`, `apple-touch-icon.png`. The mark is an ink ring with a moss centre dot — a zone, held. **There is no logotype file:** the wordmark is type, rendered by the `Wordmark` component.
- **Third-party marks:** `apple-logo.svg`, `google-logo.svg` (auth buttons). Strava is represented by its colour token and the word, not a logo asset.
- **The mark as data:** on the Coach screen only, the mark becomes `ZoneRings` — four concentric arcs filled to the week's time in zone, moss dot constant. Everywhere else the mark is static.
- **Photography:** `assets/imagery/rtts-finish-hero.jpg`, `rtts-heat-story.jpg`, `zonna-splash.svg`.

---

## Caveats

- **Fonts are loaded from Google Fonts.** Upstream ships no font binaries — Inter is requested over the network in `tokens/fonts.css`, so there are no `@font-face` rules and no local files. If you have licensed Inter files, drop them in `assets/fonts/` and replace that import with real `@font-face` declarations.
- **`ZoneRings` and `TrendCard`** are reconstructed from their pattern specs rather than their (very large) upstream sources. Geometry, tokens and states match the spec; internal maths may differ.
- **`DashboardClient.tsx` (685 KB) could not be read**, so the four app screens are assembled from `ui-patterns.md` § Screen Templates, `screen-architecture.md` and `docs/screen-inventory.md` rather than from the screen source itself. Layout order is faithful to those documents; exact paddings inside the screens are the pattern defaults.
- **All data in the UI kits is invented.** No real runner's plan, paces or heart rates appear anywhere.
