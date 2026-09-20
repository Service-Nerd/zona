# Decision note — pattern-setting copy across P-01 to P-14

**Date:** 2026-09-20 · **Owner:** Russ · **Status:** PROPOSED, awaiting sign-off
**Gate:** §4A — *"Any new copy that establishes a pattern… Individual strings within an approved
pattern do not need re-approval."*

---

## Why this note exists

Fourteen proposals introduce copy. Approving them string by string would be slow and would put the
same question in front of you a dozen times. **This note collects every copy decision into
patterns**, so a yes on a pattern licenses the strings inside it.

Seven patterns. Two I recommend rejecting outright.

---

## 1. The ceiling statement — **already approved by precedent, listed for completeness**

> `7:11 /km or slower`

Already written, already shipped, already in voice (`lib/plan/easyPaceCeiling.ts`, 10 tests). P-03
only changes **where** it appears, not what it says.

⚠️ One rule inside the pattern, from the module's own comment: **never render "≤"**. A smaller
min/km is *faster*, so the symbol reads backwards for pace.

**No decision needed.** Noted so nobody re-litigates it.

---

## 2. The compliance statement (P-04) — **the most important pattern here**

> **This week — 3 of 4 runs held the zone. One drifted.**

This is the brand thesis as a sentence, and it will be reused everywhere the zone is scored.

**The pattern is:** *count, not percentage. Plain verb. Name the exception.*
"3 of 4 held" not "75% compliance". "One drifted" not "1 session non-compliant".

**Inside the pattern, no re-approval:** the singular/plural variants, the all-held case
(*"All four held the zone."*), the none-held case.

⚠️ **The none-held case is the one to look at**, because it is the sentence a struggling runner
reads: *"None held the zone this week."* is accurate and bleak. Voice table says honest, never
motivational — but also *"Happens. Plan's been shifted."* exists as a register for bad news.

**Decision needed on the zero case specifically.**

---

## 3. The consequence subtitle (P-02) — a pattern, not a string

Every row in the modify sheet states what changing it does:

> Race date · *Shift the whole plan forward or back*
> Long run day · *Anchor your weekly endurance run*

**The pattern is:** *second person implied, present tense, states the blast radius, no benefit
claim.* Miles does this well and it is the most copyable thing on their sheet.

**Inside the pattern:** ~8 rows of subtitle. Approve the pattern and the rows follow.

⚠️ **Hard rule 7 applies to every one:** a subtitle that describes a consequence the engine does not
produce is a claim. *"Shift the whole plan forward or back"* must actually be what happens.

---

## 4. The plan-length range (P-05a)

> **Marathon** · 16–24 week plan

**The pattern is:** *bare range, en dash, no framing sentence.* En dashes in ranges are correct and
must be kept; em dashes are banned.

⚠️ The honest range is runner-dependent — §97 lets a long runway earn a longer plan, §44 refuses
below a minimum — so this shows the **possible** range before the race date and the **computed**
length after. If it stays bare and derives from config, **no approval needed**. A framing sentence
would need one.

---

## 5. The exit offer (P-09c) — **the pattern most worth getting right**

> **Not ready to pay?**
> The free plan is a real plan. Full weeks, ceilings on every easy run. Keep it as long as you want.
> [Use Zonna free] [See Pro again]

**The pattern is:** *name the alternative, state what it actually contains, no time pressure, both
actions equal weight.*

This is where our position and theirs differ most. Theirs (`IMG_7184`): a serif "SAVE 64%", a
struck-through £155.88, *"It expires when you leave this screen."* — and a price £24 below the
headline they showed one tap earlier.

⚠️ **Two factual checks before this ships, both flagged in the proposal:**
- *"Full weeks"* — **true.** Free is a real rule-engine plan; gating is on richness, not access.
- *"Ceilings on every easy run"* — **verify.** `vdot_pace_zones` is granted-at-trial-and-retained, so
  a **never-trialled** free user may hold population-estimate paces rather than VDOT-derived ones.
  The sentence may need to be *"ceilings on every easy run"* → *"a ceiling on every easy run"* with
  the estimate caveat, or the claim narrowed.

---

## 6. The trial timeline (P-09b) — **blocked, and the block is the point**

> Day 1 — *[what the trial actually grants]*
> Day 11 — *Reminder that your trial ends soon*
> Day 14 — *[what happens]*

**Cannot be written yet.** `TIER-TRIAL-CONFIDENCE-01` records that the 14-day reverse trial is
**not literally full access**. Writing *"Today: full access to everything"* would be our own version
of their unverifiable 4.9 rating — the exact failure we are criticising them for.

**Resolve that item, then write this.** No approval to give until then.

---

## 7. The nameless-runner ask (P-05b)

One string, in the case where the provider gave us no name. Miles: *"What should I call you?"* /
*"So I know who I'm coaching."*

Ours would need its own line — plain and warm, not jokey. ⚠️ **Sequence with
`ENRICH-PII-MINIMISE-01`**: if we stop sending the name to Anthropic, *"so I know who I'm coaching"*
becomes a slightly odd thing to say about a value that never leaves the device.

---

## Two I recommend rejecting

### ✗ The ceremony step names (P-06)

The brief proposes: *reading your last 12 weeks → finding your easy pace → setting the ceilings →
building the weeks.*

**"Reading your last 12 weeks" is false for most runners.** We read HealthKit only on native, only
if connected, and the wizard's aerobic estimate uses a **6-week** window (`WINDOW_WEEKS = 6`). Web
users have no history read at all.

`ceremonyLines.ts` carries the constraint in its own header: **"NO LINE MAY CLAIM ANYTHING THE PLAN
DOES NOT DO."** A named step must be one that actually ran. *"Setting the ceilings"* and *"building
the weeks"* are fine and are uniquely ours. The first two need rewriting against the code.

### ✗ "No make-up runs." (P-06c)

Excellent line. **It is also a coaching claim**, and I have not verified it is true of our reshaper.
ADR-012 governs reshape; §67 and the missed-session prompt govern what follows a miss.

**Do not adopt the sentence until it has been checked against `lib/plan/effectiveSessions.ts` and
the missed-session path.** If it turns out to be true, it is one of the best things we could say.

---

## What approving this note does and does not do

**Does:** licenses every string inside patterns 1–5 and 7 without a second pass.

**Does not:** approve pattern 6 (blocked), the two rejections, or the P-04 zero case (needs a
specific decision). It also does not cover P-01, P-07 or P-13 — those have their own notes, and
P-07 in particular is a voice decision that would double every pattern above.

⚠️ **One standing constraint that applies to all of it and is not up for approval:** no em dashes in
copy. En dashes in ranges are correct. Enforced by `lib/marketing/noEmDash.test.ts` across marketing
surfaces — **and any new marketing page must be added to that test's `SURFACES` list.**
