# What Kit caught — SLT (2026-10-31)

**Input:** idea 6 of the Design Board's Coach ideas sitting (`coach-ideas-2026-10-31.md`), sent to the SLT by the founder.
**One-line brief:** on the free Coach screen (and before the trial ends), show the runner the specific things Kit
caught from their own runs, keep the every-run picture free, and offer Pro with an honest free path. It replaces
`CoachTeaser`, which sells a "zone discipline score" and "Load ratio" tiles that paid Coach no longer has.

**Tier:** the surface is FREE (it is what a free or trialling runner sees); what it advertises is PAID (Kit's read).
**Registry check:** not built; `CoachTeaser` exists and is replaced, not added to.

⚠️ **No commercial seat.** Traynor's seat is stood down (2026-09-22). Nobody here can price conversion, and there is no
measured trial-to-paid rate to price it with. That is his recall trigger, not a reason to wait.

---

🧠 **Sutherland:** *"Features are a menu; receipts are a meal you've already eaten. 'Kit caught your Tuesday at 155
against a ceiling of 145' is the most persuasive sentence we can write because it is about them and it is true. And
give the picture away: the sentence a competitor cannot say is the advert."* Backs the effort picture staying free.

📦 **Fried:** *"It replaces a screen that lies about what Pro contains. That is a net reduction in surface, and the
right one. No countdown, no 'last chance'. If the receipts aren't enough, a timer won't be."*

🏃 **Hutchinson:** *"Every receipt must be something the app actually computed and showed, with its number. If Kit
caught nothing, because there is no heart rate, say so plainly; a padded list is worse than none. And no causal claims
the engine did not make: the mockup's 'pulled week 3 back to protect you' was not true and was removed."*

🔬 **Wood:** *"The mockup triggers on day 12. Our own doctrine says upgrade prompts are triggered by behaviour, never by
a calendar date, and it is right: a date prompt teaches the runner to watch the clock, not their runs. Trigger it on
evidence: when Kit has caught at least two things."* **Vote: build, amended.**

🧭 **Zhuo:** *"One surface, two moments: a trialling runner sees it when the evidence exists, a free runner sees it on
Coach. The Design Board drew it; it rules the final layout at build."*

---

### ⚡ Conflicts

- **Sutherland vs the tier line on the picture:** resolved in his favour. The picture and its count are free; Kit's
  interpretation is Pro. This is "gate richness, never access".
- **Mockup vs monetisation doctrine:** "day 12 of 14" breaks *"upgrade prompts are triggered by user behaviour, never by
  a calendar date"* (CLAUDE.md § Monetisation). Amended: evidence-triggered.

### ✅ Recommendation: BUILD, AMENDED, after the effort picture (`COACH-EFFORT-PICTURE-01`)

1. **Evidence-triggered, never dated.** Shown when at least two receipts exist; no day count on the surface.
2. **Receipts only from what the app computed and showed** (a run's zone result, the easy heart-rate trend, the load
   verdict), each with its number. Fewer than two: no list, an honest line instead.
3. **No countdown, no urgency, free path always visible.** Price from `BRAND.PRICING`.
4. **The every-run picture stays free** beside it.
5. **Measure:** upgrade taps from this surface (`openUpgrade` source) before vs after. With 17 non-admin Coach openers,
   one runner moves the rate ~6 points; say so when it is reported.

### 🚨 MUST/NEVER check
No modal (it is the Coach screen's free state). No gamification. No hardcoded price. Copy: no em dash in sentences.

### ⚠️ Risks to existing features
`CoachTeaser` is replaced (and its `coach_teaser_empty` path for a paid runner without a current week must keep a
sensible state). Upgrade-source analytics keys change. The marketing site does not render `CoachTeaser` (checked:
the homepage trio is `SessionCard`, `CoachNoteBlock`, `ZoneRings`).
