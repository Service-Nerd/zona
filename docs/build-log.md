# Zonna build-log

Raw learning notes, one entry per ship. Newest first. Dev / product / AI-building
angle. Feeds the weekly DHTB LinkedIn build-in-public posts — keep it honest, keep
it specific, no polish. The content system adds the voice.

---

## 2026-09-07 — §96 · Three greps agreed and all three were wrong

**Shipped:** `hard_session_relationship: 'overdo'` now does something. Plus a config-consumer test that found 10 dead `GENERATION_CONFIG` keys and 14 dead `PLAN_SIGNATURES` fields.

**Dev learning:** I filed a P1 backlog item saying an input was inert on 5K/10K, based on tracing every consumer in the codebase. Three separate greps agreed with each other. All three found the wrong branch — the live one was a third consumer I hadn't connected, gated on training age rather than distance. What found the truth was four lines: generate two plans differing only in that field, and diff them. **Where the question is "does this input change what the user sees", generate two outputs and diff them. Never read the code and conclude.** Reading tells you what you think the code does; a diff tells you what it does. I then made the mirror-image error — my first diff used a fixture that couldn't reach the branch and reported "inert everywhere", which was a property of my test data, not the engine.

**Product/creator learning:** The interesting option wasn't the one the founder complained about. He noticed "Bring it on" did nothing. The measurement found that "I overdo it" did nothing *either* — and that's the worse defect, because it's the only one of the four answers where the user is asking for **protection** rather than more. It's also the exact persona the product is built around: "You're trying hard. That's the problem." We'd built three tiers of ladder going up and no rung going down. A user telling you to rein them in, and being ignored, is a harder failure than a user asking for more and being ignored.

**AI-building learning:** I wrote the principle before the tests, and the principle claimed the change "adds or removes no session and changes no tonnage." The tests I wrote to assert that failed immediately — the brake lengthens the base phase, so quality drops 10 → 6 and volume 482 → 457. The claim was wrong. But the *true* property turned out to be better than the one I'd invented: the braked plan lands byte-for-byte on what a runner who never qualified would get. It declines to accelerate rather than cutting. **Writing the doc first and the test second let the test correct the doc**, which is the right order round when the doc is making a factual claim about behaviour.

**The honest bit:** Earlier the same day I told the founder a principle "does not exist in the engine". It did — I'd grepped for the *quoted note text in the documentation* rather than the implementation, and the shipped wording differs from the doc's. So on one day I claimed a built feature was missing, and claimed a dead input was live in the wrong places. Both errors are the same shape: treating a document as evidence about code. The documents in this repo are unusually good, which is exactly what makes them dangerous — they read like a description of the system and they're a description of intent.

**Hook material:** Our app asked runners "how do you feel about hard sessions?" One of the four answers was "I overdo it — rein me in." We measured what the training plan did differently for those runners. Nothing. Not a session, not a kilometre, not a word.

**Postable?:** yes — the hook is strong and the fix is a real product decision, not a bug. The AI-building angle (doc-first, test-second, test corrects the doc) is specific and unusual.

---

## 2026-09-07 — §91–§95 · The principle that shipped, worked, and delivered nothing

**Shipped:** Five coaching principles from four Coaching Board rulings, plus a wizard input-pattern standard and three defect fixes. All triggered by testing one 10K plan on a test account.

**Dev learning:** The bug was two correct systems meeting. §89 shortens the base phase so quality starts sooner — it does, provably, inside `plan.weeks`. ADR-020 prepends foundation weeks to fill the gap before the plan starts — it does, correctly. Neither knows about the other, and `computePhases` runs before the foundation block exists. So §89 moved quality from array index 5 to index 3, and the two weeks bolted on the front put it back at calendar week 5. The runner counts calendar weeks. Nothing was broken; the seam between two things was never anyone's job. What made it findable was measuring the thing the *user* experiences (weeks until first hard session) instead of the thing the *code* computes (base phase length) — those had silently stopped being the same number.

**Product/creator learning:** The non-monotonic result is the part I keep thinking about. Delivered onset by weeks-to-race was 4, 5, 6, 6, then 3. A runner entering a race 14 weeks out waited six weeks for quality; one entering it 20 weeks out waited three. **Planning further ahead made the plan more conservative.** Nobody decided that and no coach would defend it, but it wasn't a bug in anything — it was where two capped ranges happened to overlap. Any curve that isn't monotonic in the direction you'd expect is worth staring at, because it's almost always two rules meeting rather than one rule being wrong.

**AI-building learning:** I wrote a new invariant to catch unsafe volume jumps and it fired on **44% of plans**, worst reading 114%. My first instinct was "we have a big problem." The actual problem was my check: it flagged the plan ramping *up toward* the runner's own stated volume — every week below the load they already carry, which is not a spike by any definition. Scoped properly it drops to 17%. The repo's own constitution had already written the standard I nearly failed, from a different incident: *"an error firing on 71% of a distance's plans is not a safety mechanism — it is noise, and noise gets suppressed, which is how a real violation gets missed later."* Writing a check is easy; the hard part is proving the check is measuring what you think. I also caught myself reading `exit code 0` off a background job that had actually exited 1 — the wrapper's echo masked it. Check the real exit code.

**The honest bit:** I fixed the onset and immediately made something else worse. Shortening the base grew the peak phase from three weeks to five, and the peak selector had a hardcoded `if (5K || 10K) return 'vo2max'` with no cap — so a 44-year-old got **five consecutive VO2max sessions** and zero race-pace work before the taper, on a plan whose entire job was closing a 4:54→4:30 /km gap. That line was a leftover a previous board ruling had explicitly named and not removed. Worse: §5 has declared a specificity target (peak 60% specific) since the R23 rebuild and **no engine code has ever read it** — it's in the config, in three docs, and in one type alias, and nothing computes it. 10K peak was delivering 0% against a declared 60% and the number was invisible because nothing measured it. That's the second time this exact failure has been recorded in this repo. A config value nobody reads isn't a decision, it's a comment. And the founder's actual ask — quality in week one — I declined, because the two routes to it were both already vetoed by principles written three days earlier, and shipping it would have meant overruling a condition of approval on a ruling that isn't a week old. He gets week 3 from week 5, plus strides in week 1, and an explanation.

**Hook material:** A training principle we shipped last week to make hard sessions start two weeks earlier. It worked perfectly. Runners saw zero difference — because a *different* correct feature quietly added the two weeks back on the front, and 62% of plans hit it.

**Postable?:** yes — three angles, all specific. The two-correct-systems seam and the non-monotonic tell (dev). The invariant that fired on 44% of plans and was wrong about it (AI-building). The config value declared for four months and read by nothing, for the second time in the same codebase (the honest bit).

---

## 2026-09-07 — BUILD-LOG-01 · The ship step that records what the ship taught

**Shipped:** `/ship` now has a mandatory final step that appends a raw learning entry to `docs/build-log.md`, and the file is seeded.

**Dev learning:** Two placement details did real work here. First, the file has to live at `/docs/` root, not `/docs/releases/` — `/docs/releases/` is excluded from the Claude-project sync, so the obvious home (next to backlog.md and roadmap.md) is the one place the content job structurally cannot read. Second, a skill's frontmatter `description` is what the router matches on. I changed the skill's job and nearly left the description saying "move a backlog item to feature-registry" — the new step would have existed in the file and never been the reason the skill got picked. If you change what a skill does, change how it advertises itself in the same edit.

**Product/creator learning:** I had three docs answering "what are we doing" (roadmap), "what's the spec" (backlog), and "what exists, free or paid" (feature-registry). Nothing answered "what did that cost me to learn." That's the only one of the four that's worth anything to anyone outside the project, and it was the one I wasn't writing down. The registry is for me; the build-log is the only artefact aimed outward.

**AI-building learning:** The spec I was handed had its two most important rules — "raw notes, not marketing" and "specific beats smooth" — in the framing prose *above* the block marked "paste this into your ship skill." Pasting the block verbatim, which is exactly what an agent optimising for faithfulness does, would have dropped both. The lesson: a spec written for a human reader carries load-bearing content outside the code fence, and "do exactly what the paste says" is not the same as "do what the spec means." Worth reading the whole message before executing the part with the copy button on it.

**The honest bit:** This has no mechanical backstop and I should say so rather than pretend otherwise. Every other guard in this repo is enforced by a hook or a failing test — the deload cadence, the coaching-doctrine gate, the config-principle sync. This one runs only when the model invokes `/ship`, and `/ship` only fires for items tracked in the backlog. This very change wasn't in the backlog, so nothing would have prompted the entry you're reading; I wrote it because I was already looking at it. By my own repo's standard — "a rule that holds only while someone remembers is not a rule" — this is currently not a rule. Separately: four releases landed this morning (the ADR-021/022 engine wave, §88 `cv_intervals`, the SEO plan pages) and every one of them predates this step, so their learnings are gone. Decided not to backfill rather than reconstruct them from diffs and pass inference off as recall.

**Hook material:** Four releases shipped before lunch. Zero of them left any record of what they taught. The fifth one was a file whose only job is to stop that happening — and it still isn't enforced by anything but memory.

**Postable?:** yes — the AI-building angle (load-bearing instructions living outside the paste block) and the honest bit (I built a discipline tool with no enforcement, in a repo whose whole doctrine is that unenforced rules decay) are both real and both specific.

---
