# SLT Review — Batch Request: Today / Plan / Coach / Me enhancement portfolio

> **Paste this whole file into Claude Code and run `/slt-review`.**
> This is an **explicit batch / portfolio review** — review all seven items together, not one at a time.
> Source: design review of the four core screens (Today, Plan, Coach, Me) + sub-screens, measured against `docs/canonical/screen-architecture.md` and the brand voice. Every item below is net-new (checked against `roadmap.md` / `backlog.md` — none duplicate CA-03, ENGINE-02, watch, cycle-aware, DS-07, etc.). Tiers are **proposals**, flagged where the board should decide.

## What I'm asking the board to do

1. Run each of the seven items through the full board (all five voices), per the standard output format.
2. **Then add a portfolio layer the single-item format doesn't cover:**
   - **Cross-item conflicts** — where two items pull against each other (e.g. CO-ONE removes surface area while a "more visible paid value" instinct wants more).
   - **Sequencing** — what to build first for the holistic product, with reasoning. Note dependencies.
   - **Merge / drop** — any items that should combine, or that don't earn their place.
   - **The portfolio question:** if only THREE of these ship this quarter, which three, and why?
3. Keep the mandatory checks: FREE/PAID tag per item, MUST/NEVER check, risks to existing built features.

---

## The headline finding (context for the board)

The review's biggest structural observation sits behind **CO-ONE**: `screen-architecture.md` states *"Kit appears once, as a coherent voice. Multiple disconnected Kit cards are a layout failure — consolidate."* Coach currently stacks ~11 surfaces, several with their own Kit byline. The screen whose entire job is one synthesis is the most fragmented in the app. Several other items (TD-READY, SD-WHY, TD-CLOSE) are about making the brand's restraint thesis *felt* at the moments it currently isn't.

---

## The seven items

### TD-READY — Readiness-led Today hero
- **Tier (proposed):** PAID? — board to decide (feels like the spine of the paid proposition)
- **Screen:** Today · **Status:** already prototyped
- **Real problem:** On a cooked morning the runner either grinds out the prescribed session — the exact overtraining the app exists to prevent — or guesses. A readiness *score* gets argued with; *permission* gets obeyed. "8 today, the work's Thursday" changes behaviour; 64/100 doesn't. The signal already exists in the `pre-session-readiness` route; it just never reaches the hero.
- **SLC:** *Simple* — today's hero + session reflect this morning's recovery; bad signals ease the prescription and say why. *Lovable* — the eased decision shown honestly in Kit's voice with a visible "run the full 10 anyway" override; never a coercive gate. *Complete* — fresh/steady/cooked, override path, no-data fallback (plan as-is, no empty gauge), rule-derived (no AIMark).
- **Board watch:** Hutchinson (ease thresholds must be physiologically defensible); Fried & Traynor (FREE vs PAID).

### CO-ONE — One Kit, one read  *(flagship / structural)*
- **Tier (proposed):** FREE / structural
- **Screen:** Coach
- **Real problem:** The screen built to speak once speaks eleven times. Consolidate to a single authored read at the top that owns the voice; everything below (stats, rings, trends, ledger) becomes *unvoiced evidence*. Conditional signals (race window, phase change, drift) fold into the one read instead of spawning sibling cards. Info-sheet drill-downs stay.
- **SLC:** *Simple* — one Kit voice at top; evidence below carries no byline. *Lovable* — restraint applied to the app's own UI; Kit means it because he says it once. *Complete* — race/phase/drift merged into the read; sheets preserved; empty + loading states.
- **Board watch:** Fried (on-brand restraint, easy yes); Traynor (does fewer cards reduce *perceived* paid surface area — test the price-perception angle).

### PL-MOVE — Move with consequence
- **Tier (proposed):** FREE (rule-derived)
- **Screen:** Plan
- **Real problem:** Dragging a session is the one moment a runner overrides the coach — and it's silent. Drop Thursday's intervals next to Saturday's long run and nothing objects, even though that's the textbook error the plan exists to avoid. The arc's integrity is invisible exactly when it's most at risk.
- **SLC:** *Simple* — a move that compromises the week (quality-on-long-run, no recovery gap, load spike) shows the consequence before it commits. *Lovable* — Kit's one-line read, not a modal wall; the move still goes through ("run them anyway"). *Complete* — clean move (silent), risky move (warned), revert; rule-derived so free users get it.
- **Board watch:** Hutchinson (rules must be correct; false alarms erode trust); Fried (where's the line between guarding the plan and nannying?).

### SD-WHY — Why this session exists
- **Tier (proposed):** FREE (rule) / AI-enriched for PAID
- **Screen:** Session Detail
- **Real problem:** The detail screen explains what and how, rarely why this session exists in this week. For an anti-overtraining app, the rationale — "this is easy on purpose, so Thursday can be hard" — is the most persuasive sentence it owns, and it's mostly missing. Experienced runners trust a plan that can explain itself.
- **SLC:** *Simple* — each session carries one line of intent tying it to the week's job and the zone idea. *Lovable* — Kit's register, specific: "Recovery. Going hard here steals Thursday." *Complete* — every type incl. rest; rule for free, AI for paid; default intent when no plan context.
- **Board watch:** Hutchinson (rationale must be true per session type); Wood (does explaining the why move adherence, or just add words?).

### ME-ATHLETE — What Kit knows about you
- **Tier (proposed):** FREE
- **Screen:** Me
- **Real problem:** The inputs the engine runs on — zones, benchmark, recovery baseline, injuries — sit as scattered editable rows with no sense of consequence. A benchmark three months stale silently softens every pace target, invisibly. Surface the athlete model Kit coaches as one read-only reflection at the top of Me; configuration becomes identity, not chores.
- **SLC:** *Simple* — one "what Kit knows" summary (zones, benchmark freshness, baseline, flags), each tappable to its existing editor. *Lovable* — makes inputs feel load-bearing; surfaces staleness honestly ("benchmark 11 weeks old — targets may be soft"). *Complete* — unset = honest gap not blank; stale states; routes to existing editors; no new data model.
- **Board watch:** Sutherland (identity framing drives completion); Traynor (does the stale-benchmark nudge create a recalibration loop that lifts retention?).

### TD-CLOSE — The day's close
- **Tier (proposed):** FREE
- **Screen:** Today
- **Real problem:** Restraint is the product's definition of progress — yet the moment a runner finishes is a card state-flip. There's no surface that says "that's the day, stop." The most disciplined act gets no acknowledgement, and the habit loop has no reward cue to close it.
- **SLC:** *Simple* — once today's session is logged, Today resolves to a calm closing state instead of re-showing the prescription. *Lovable* — one honest line ("That's the day. Nothing to prove now."), the day's one number, and quiet. No confetti. *Complete* — done / rest-day-done / skipped; multi-session days; persists across reopen.
- **Board watch:** Wood (real reward cue or just a nice screen? — and note the habit/gamification line); Sutherland (the close is where the restraint thesis is *felt*).

### X-FIRSTRUN — The empty app
- **Tier (proposed):** FREE
- **Screen:** Cross-cutting (Today + Coach)
- **Real problem:** The app is dense and excellent once it has data — but the first session, before a run is linked or HR is set, is where a trial user decides to stay. Today the rich surfaces (readiness, zone rings, trends, the coach read) render as skeletons/empty states. The most fragile moment gets the least-designed screen — and it's the trial→paid hinge.
- **SLC:** *Simple* — a coherent pre-data state for Today & Coach that teaches the one next action instead of showing empty instruments. *Lovable* — in-voice and confident, not a checklist of nags; one thing to do. *Complete* — no-source / source-but-no-runs / HR-unset; resolves automatically as data lands.
- **Board watch:** Fried & Traynor (this is conversion, not polish); Wood (the first action sets the habit — choose it deliberately).

---

## My own starting hypothesis (for the board to challenge, not anchor on)

- **First:** CO-ONE (stated canon violation, pure restraint, low risk) + TD-READY (prototyped, flagship of the proposition).
- **Then:** X-FIRSTRUN + TD-CLOSE (bookend the trial — first impression + daily reward cue; conversion + retention).
- **Later:** SD-WHY, ME-ATHLETE, PL-MOVE (depth passes; need the most coaching-correctness review).

Tell me where this is wrong.
