# The backlog, by category

**Regenerated 2026-09-20, second pass.** Sources: `docs/releases/backlog.md`,
`docs/releases/roadmap.md`, `docs/canonical/feature-registry.md`.

---

## 🔴 Read this before the table: the headline count has been removed, and that is the finding

The previous version of this document opened with **"58 open"**. I tried four times today to
re-derive that number mechanically and **got a different answer every time**. Each attempt failed
differently, and the failures are worth more than the number:

| # | Method | What it got wrong |
|---|---|---|
| 1 | marker parse | open-marker list was missing 🔵 — silently dropped two items |
| 2 | marker parse | headline said 57, its own category table summed to 56 |
| 3 | marker parse + "ID appears in feature-registry" | **"appears in the registry" is not "shipped"** — an ID mentioned inside *another* row's prose read as closed. 27 false positives, including `P-02`, `P-09`, `GTM-CHARITY-06`. |
| 4 | marker parse + **registry FIRST CELL** | correct on closure, but the bullet regex only matches `> <marker> **ID**`. Items in LATER tables and plain bullets are invisible to it, so it returned ~35 against a true figure nearer 55. |

⚠️ **Attempt 3 is the embarrassing one.** `ship-record-check.py` already encodes exactly that rule
— *"it checks STRUCTURE, not presence: the ID must be in a registry row's FIRST CELL"* — and the
reason is written in CLAUDE.md, because a plain grep once counted `GTM-CHARITY-02` as covered when
its ID appeared inside another feature's row. **I re-made a documented mistake while trying to
avoid an undocumented one.**

**So: no headline count.** `backlog.md` holds items in at least four syntactic shapes and no parse
I have written reads all four. What follows is what I can state precisely — **what moved today**,
by ID, because I did it — plus the categories, unnumbered.

**If a count is needed, it needs a parser with a test, not a fifth estimate.** That is a real piece
of work and it is not filed, because nobody has asked for the number for its own sake.

---

## ✅ Closed today (2026-09-20), by ID

**Engine governance & verification — five:**
`SWEEP-AGE-01` · `SWEEP-INJURY-01` · `RACE-KEY-TWO-OWNERS-01` · `GRID-EARLY-ONSET-01` ·
`RUBRIC-GAPS-01(a)` *(b–e remain open)*

**Infrastructure & ops — two, plus the architectural item that caused them:**
`OPS-AI-SPEND-01` · `OPS-AI-FAILURE-ALERT-01` · `OPS-AI-OWNER-01` *(filed and shipped same day)*

**Commercial — two:**
`TIER-TRIAL-CONFIDENCE-01` *(re-read as a P1 live false claim, not a P2 blocker)* ·
`GTM-FREE-HOOK-01` *(SLT: don't build, closed)*

**Legal — one, by founder decision:** `STRAVA-APP-INACTIVE-01`

## 🟡 Part-closed today — the code is done, a founder decision is not

| Item | Done | Still yours |
|---|---|---|
| `TT-PRICING-CLAIM-01` | The two false clauses are **deleted**. `detail` is now *"A projected finish time. No vanity numbers."* | The replacement wording (§4A) |
| `FIN-APPLE-COMMISSION-01` | Net table in `monetisation-strategy.md`; `BRAND.PRICING` stays gross | What the corrected numbers **mean** — reprice, push web, hold the kill threshold |
| `TT-FREE-BENCHMARK-01` | SLT ruled: **(c) refused**, (a) vs (b) **deadlocked and left that way** | Unblocks on someone opening `RecalibrationTile` **on a device** |

## 📋 Filed today

| Item | Why it exists |
|---|---|
| `MASTERS-COMPRESSED-BUILD-01` | Crossing age 45 adds a deload, costs a build week, and week-indexed tempo stops outgrowing absolute-dose VO2max. **Coaching Board.** |
| `FLEET-TRIGGER-SEVERITY-01` | `FLEET-INVALID-DEBT-02`'s escalation trigger is a human judgement. 136 invariants, and the existing `severity` field answers a different question. **Coaching Board.** |
| `TT-PROJECTION-PROVENANCE-01` | 🔴 **P1.** We render a guess and a measurement in the same typeface with the same confidence. The pricing page was the symptom. |
| `PRICING-ROW-TRUTH-01` | `pricing.test.ts` proves every paid gate has a ROW, never that the row is TRUE. **The guard held while the claim rotted**, and a dozen rows carry the same exposure. |

---

## The categories

### 🏃 Coaching engine — prescription
Board owns correctness. ⚠️ **Every item is measured against 95.9% before it ships, and ten
instruments that would change prescription are already on record as built, measured and rejected.
An eleventh is forbidden without adherence or injury data.**
Open: `P-16` (needs a date) · `P-17` (RED-S, safety) · `S111-SUBFLOOR-VOLUME-01` (blocked only on
the founder sending the charity volume question) · `ULTRA-LR-ADEQUACY-01` · `LOPSIDED-ORDER-01` ·
`S112-HAZARD-01` · `INPUT-SEX-01` · `ZONE-BAND-01` / `R27`.

🔴 **Open and unresolved:** the injury cap functions as an **admission mechanism** — a healthy
8 km/wk runner is refused while their knee-history twin is admitted. §111's second recorded
inversion.

### 🔬 Engine governance & verification
Five closed today. Open: `FLEET-INVALID-DEBT-02` (P3, correctly deferred) ·
`FLEET-TRIGGER-SEVERITY-01` (new) · `RUBRIC-GAPS-01` (b)–(e) · `MASTERS-COMPRESSED-BUILD-01` (new).

### 🧭 UX & flows
The largest category and unchanged today. `P-15` (October deliverable — **today we refuse and offer
nothing**) · `P-02` (biggest build) · `P-04` · `P-05` · `P-06` · `P-08` · `P-10` · `P-12` · `P-14` ·
`FIRSTRUN-MARATHON-01` · `PLAN-NOTE-PLACEMENT-01` · `MAINT-LABEL-UTILITY-01` · the parked set ·
`R18`/`R21`/`R22`/`R24`/`R26`.

### 🎨 UI & design system
**Analysed today; nothing was buildable by me.** `P-13(c)` needs an illustration commissioned;
`P-11` is gated on stock-footage licensing. **Both are your signature, not my code.**

### ✍️ Brand, voice & copy — ✅ clear
All four strings resolved by the SLT on 2026-09-20. **One obligation survives inside `P-04`: the
zero-case words are yours**, and two coaching questions go to the board before it is built.

### 💰 Commercial & monetisation
All six reviewed by the SLT today. Two closed, three part-closed, and `P-09` is now unblocked —
**ship it without the competitor's price** (Sutherland on framing, Traynor on maintainability).
New: `TT-PROJECTION-PROVENANCE-01` (P1), `PRICING-ROW-TRUTH-01`.

### 🔧 Infrastructure & ops
**The two code items shipped today.** What remains is external and yours:
`OPS-VERCEL-PLAN-01` 🔴 **P0 — Hobby is non-commercial and we sell a subscription** ·
`OPS-SUPABASE-PLAN-01` 🔴 **P0 — breaks at ~250–320 runners, no backups at all** ·
`OPS-ANTHROPIC-CREDIT-01` · `DEPLOY-QUOTA-01`. `COHERENCE-SELECT-01` remains ⛔ *stop attempting*.

⚠️ **New, and it belongs with the Supabase decision:** `ops_events` has never had a prune job, and
`ai_call` is the highest-volume kind yet added.

### 📣 GTM & charity launch · ⚖️ Legal, privacy & data
GTM unchanged, October-dated: `GTM-CHARITY-05` … `09`. Legal: three shipped 2026-09-20;
`LEGAL-COUNSEL-01` remains 🔴 **P1, yours** — you said you would book it.

### 🐛 Live defects — ✅ none open

---

## ⚠️ What this document does not prove

- **There is no count**, for the reason at the top. Anyone quoting a total from an earlier version
  of this file is quoting one of four numbers, at most one of which was right.
- **Categories are my judgement**, not a field in the backlog.
- **Nothing here has run on a device.** That is the explicit blocker on `TT-FREE-BENCHMARK-01` and
  it is true of everything else too.
