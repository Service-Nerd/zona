# Zonna build-log

Raw learning notes, one entry per ship. Newest first. Dev / product / AI-building
angle. Feeds the weekly DHTB LinkedIn build-in-public posts — keep it honest, keep
it specific, no polish. The content system adds the voice.

---

## 2026-09-23 — UNITS-DURATION-01 · ten of eleven could never fire

**Shipped:** A two-hour long run now says "2h 04" instead of "124 min", and the AI coach reads your fade in the units you use.

**Dev learning:** The debt register pointed at eleven places writing `${mins} min`. The instinct is to fix eleven places. I generated 48,547 sessions and asked which of them could ever produce a value of 60 or more — the threshold where ADR-015's rule actually bites. **Ten produced zero.** A rep is minutes by construction; so is a warm-up. Only the session-level main-set header gets long enough, and it was breaching the rule on **21,062 sessions**, up to **172 raw minutes**.

So this was one edit, not eleven, and the measurement is the only reason I know that. Same story on the other group: one of the four "remaining" sites needed nothing at all, because it writes `coach_notes` and phase 1 already converts those at the read. I checked rather than assumed, and got an afternoon back.

The limiter was the interesting one. Its `reasoning` string is interpolated verbatim into an AI prompt, and it carries three figures of **two different kinds** — a fade *rate* (`15s/km`) and two *pace clocks* (`5:30/km`). I nearly reached for the string converter I'd built earlier in the day. It would have been silently wrong: `15s/km` contains `/km`, so a suffix rename turns it into `15s/mi` while leaving the 15 alone, and 15 s/mi is not the same quantity as 15 s/km. Three figures, three different owners, built at the source.

**Product/creator learning:** Two tests went red on changes that were unambiguously improvements, and both had asserted a *spelling* rather than a guarantee: `/4.0km short/` was pinned to a `toFixed(1)` in the producer, and `toContain('min')` was standing in for "this note is a duration" — which `1h 17` fails while being exactly right. That's the fourth or fifth time this repo has recorded the class. The fix each time is the same: assert against the owner, not against what the owner currently prints.

**AI-building learning:** Third hollow gate of the day, and again only falsifying caught it. My rate test wrapped its assertions in `if (r && /s\//.test(r.reasoning))`. The fixture named the field `fadeSecPerKm` when it's `paceFadeSecPerKm`, and used 15 against a threshold of 20 — so the function returned null, the conditional quietly skipped everything, and breaking the conversion on purpose left the test green.

**A conditional assertion is an assertion that can decline to run.** I now think the guard clause is the tell: if a test needs an `if` to decide whether to assert, the first assertion should be that the branch was reached.

**The honest bit:** Four phases of this today and I've been wrong about the size of it every single time. Filed as 62 sites; the real shape was one live defect per group and a long tail that can't fire. The register went 62 → 56 across the whole day, which looks like almost nothing — and that number is honest rather than flattering, because most survivors are fallback expressions behind the owner that still match the pattern. The count was never the exposure.

**Hook material:** A debt register said eleven places needed fixing. I generated 48,547 training sessions to ask which of them could ever hit the threshold that made it a bug. Ten produced zero. The eleventh was wrong on 21,062 sessions and showed one runner "172 min" where it should have said "2h 52".

**Postable?:** yes

## 2026-09-23 — UNITS-PROSE-01 phase 2 · the argument nothing read

**Shipped:** If you read in miles, the AI coach is now told your plan in miles before it writes about it.

**Dev learning:** Ten prompt builders in this codebase already call `promptDistanceFormatters`. Three didn't, and handed the model a raw kilometre figure with the unit hardcoded. Straightforward wiring — except that after I threaded `units` through the route and into `enrich()`, `enrich()` called `buildUserMessage(plan, input, wantPaidFields)` **without passing it on**. The argument was accepted, carried across a route boundary, and read by nothing.

Nothing would have caught that. Typecheck was green, because the parameter had a `'km'` default. What caught it was deciding to make `units` **required** instead — at which point the compiler listed every call site including the dead one inside `enrich` itself. This repo has a name for the class (`LoadShape`'s `ariaLabel`: declared, destructured by nobody, passed by nobody) and a precedent for the fix (`decideTrialEmails` takes a required access argument because the dangerous default is *send*). Here the dangerous default is *km*.

Then I wrote five tests and falsified them, and **the one that mattered passed when it should have failed**. I re-created the exact inert bug and every assertion stayed green, because they all call `buildUserMessage` directly and never go through `enrich`. A gate on a function is not a gate on its caller. The fix was to mock fetch and assert on the body actually POSTed to the model.

**Product/creator learning:** The km path changed too, and I nearly treated that as a regression to avoid. The prompt used to say `42.195 km` while the wizard card says `42.2km`. Prompt and card disagreeing on a prescribed distance is the exact defect ADR-015's amendment was written for — it measured the disagreement at 50.4% of sessions. So matching the card *is* the fix, on both paths.

Which then made me check the converter I shipped this morning, and it had the same flaw in the other direction: a note reading "9.9 mi" beside a card reading "10mi", because I'd used one-decimal precision throughout to protect sub-unit figures. It now calls `formatDistance` exactly as the card does and only falls back to a decimal when a whole unit would read zero.

**AI-building learning:** A test went red on a table the route does not touch. `rlsCoverage.test.ts` picks routes by grepping the whole file for `createUserScopedClient` and extracts table usage the same way — so a **comment** I'd written explaining why the route deliberately avoids a user-scoped client was enough to pull it into the audit and report a `charity_codes` update that exists nowhere in the file.

That is the fourth time this repo has recorded "bound the region, never grep the file", and the tempting fix is to reword the comment. The units guard's own header already says why that's wrong: a guard that fires on its own documentation teaches you to write around the guard, which is worse than a false negative. So I stripped comments in the test instead, and falsified it twice to prove it hadn't just gone blind.

**The honest bit:** Three items today, and in every one my first instrument or my first gate was wrong in a way that looked like success. An empty plan corpus that refused every case. A Postgres regex matching a backspace character. And today two gates that couldn't fail — one testing the wrong layer, one blocked by a comment I'd written myself. The code changes were small. Establishing that any of it was true took the day.

**Hook material:** I threaded a setting through an API route into a function that accepted it and never used it. Typecheck: green. Five tests: green. Re-creating the bug on purpose: still green — because every test called the inner function directly and the bug was in its caller. What found it was deleting a default value and letting the compiler list who wasn't answering.

**Postable?:** yes

## 2026-09-23 — UNITS-PROSE-01 · the clean zero that was a broken regex

**Shipped:** If you read in miles, the sentences on your plan now say miles. They never have.

**Dev learning:** This morning I told the founder the class was "real but unrealised — zero of 19 stored plans carry it" and wrote that into a debt register as the justification for deferring it. It was wrong. My production query used `\d\s*km\b`, and **in Postgres POSIX regex `\b` is a backspace character, not a word boundary** — `\y` is. The pattern was looking for a literal control character that never appears, so it matched nothing and returned a confident zero. With `\y`: all 19 of 19 plans, 101 of 888 sessions in runner-facing coach notes.

I only caught it because the generated corpus came back at **100% of 1,167 plans** and the two numbers couldn't both be true. If the corpus had agreed with the query I'd have shipped the deferral.

The fix goes at the read, not the producer, for a reason worth keeping: the units toggle is **mutable after generation**. Baking miles into a stored plan is wrong for the runner who switches back next week. Same trap as PACE-UNITS-01 this morning, one layer up.

**Product/creator learning:** Converting prose is harder than converting a number, because a sentence can carry a figure with **no unit attached**. `"Your biggest week reaches 38 km, where a time goal usually wants nearer 53."` — that 53 is kilometres and a regex cannot see it. Converted naively you get "23.6 mi ... nearer 53", which is worse than not converting at all. Two of those existed; I found them by generating the corpus and flagging leftover numbers, then reading each one.

Then the fix hit a **117-word ratchet** on note length whose failure message says, in as many words, "do not raise the ratchet". Adding " km" twice cost two words. The way out was typographic, not editorial: `53km` is one word where `53 km` is two, and the converter matches both. Zero words spent, ratchet intact, no copy reworded — which also kept it out of the Coaching Board, since rewording a note is a coaching matter and relabelling a unit is not.

**AI-building learning:** I wrote four falsification tests and **two of them passed when they should have failed**. My first instinct was that the breakages hadn't applied, so I re-ran them with an assertion that the injection matched. They had applied. The tests were genuinely hollow: the generated prose contains no pace strings and never binds the word budget, so the corpus could not exercise either property. A corpus test only tests what the corpus happens to contain.

Worse, one of them couldn't have failed for a reason I'd written into the code myself — my comment credited a `(?<!/)` lookbehind for keeping pace safe, and **there is no such lookbehind in the pattern**. What actually protects `6:30–7:30 /km` is that `\s*` cannot match a slash. I'd documented a mechanism that doesn't exist and then tried to falsify the wrong thing.

**The honest bit:** Three of today's items now have the same shape — the fix was easy and the *measurement* was the work. And in two of the three my first measurement was wrong in a way that looked exactly like success: an empty plan corpus this morning that refused every case, and a regex today that matched nothing. Both returned clean zeros. Neither failed.

**Hook material:** I deferred a defect because a database query said zero rows. The query used `\b` for a word boundary. In Postgres, `\b` is the backspace character. The real number was 100% of plans and 101 of 888 sessions. Then two of the four tests I wrote to catch it turned out to be incapable of failing — including one that couldn't fail because a comment I'd written credited a regex lookbehind that was never in the regex.

**Postable?:** yes

## 2026-09-23 — UNITS-SUBUNIT-01 · the rule that only existed in a test

**Shipped:** If you read in miles, a short cool-down now says "5 min" instead of "~0mi".

**Dev learning:** The filed RCA said this was rare and km-only. I measured before building: **39.7% of sessions in miles, and 3.7% in km too**. The RCA also blamed `formatDistance`, which turns out to fire **zero** times on real session distances. `apportionRoundedDistance` was the only live mechanism. Two wrong claims, both mine from the day before, both corrected in about four minutes of measurement. Building on the RCA as written would have produced a fix for a defect that wasn't there and missed 1,805 km sessions.

My instrument was also wrong first: I got **zero sessions** out of 902 plans because I called `generateRulePlan(input, 'paid')` without the pinned-date arguments the harnesses pass. The grid's race dates are relative to a fixed `COHORT_PLAN_START` that is now five months in the past, so every case refused with "-11 weeks isn't enough". A clean zero from an empty measurement looks identical to a clean zero from a healthy system.

**Product/creator learning:** The fix was obvious — show minutes — until I ran the existing test and it went red on an assertion I didn't know existed: **every section figure must be in the same unit**. That stopped the build, and it should have. But the settled-ground scan then found the thing that made the call: **that rule was never in `ui-patterns.md`**. The pattern document says the parts *sum*; it never says they share a kind. And its own shipped time-trial diagram renders `WARM-UP 10 min` next to a distance main set. The rule lived in a test, the constitution contradicted it, and the single shape that would have exposed the contradiction had been **carved out of the assertion** rather than examined.

That carve-out is the tell, and I want to remember the shape of it: when a rule needs an exception for the one case that tests it, the exception is the finding.

**AI-building learning:** I nearly settled this myself. I had a defensible argument that it was a defect fix restoring a documented pattern, which would have exempted me from the board. The thing that stopped me was the test going red — a mechanical objection, not a judgement call. Without it I'd have shipped a unilateral reversal of a rule I'd have told myself was an artefact. The board then agreed it *was* an artefact, so the outcome is identical and the process is not: one version has a register row explaining why the rule died, and the other has a silently deleted assertion that the next person restores.

**The honest bit:** I wrote the first fix before finding the constraint, so the "build" happened twice. And the replacement check is stronger than what it replaced — a minutes part must have apportioned to *exactly* zero, so the fallback can't hide real ground — but I only thought of that framing because the old assertion made me justify removing it. Deleting it quietly would have left a weaker suite and I'd have called it a win.

**Hook material:** A test asserted a rule for eighteen months. The rule was never in the spec. The spec's own diagram contradicted it. And the one case that proved it wrong had been explicitly excluded from the test — with a comment saying the assertion "correctly refuses" it. 39.7% of runners on miles were being told a real cool-down covered zero distance.

**Postable?:** yes

## 2026-09-23 — PACE-UNITS-01 · the formatter was right and nobody could reach it

**Shipped:** Switching to miles now converts the pace on your plan, not just the distance. It has never done so.

**Dev learning:** The bug report was "distance says miles, pace still says /km". My first instinct was that a render site had been missed. It hadn't. `formatPace(353, 'mi')` returns `9:28/mi` and always has — the ADR-015 owner was correct the entire time. The problem was upstream: `ruleEngine.ts` builds `pace_target` as a **string** with `/km` welded on, at generation time, and stores it in `plan_json`. By the time the app renders there is no number left to convert, only prose. 674 of 888 stored sessions.

That reframes the fix completely. Fixing the producer is the "correct" move and it repairs **zero existing plans** — everyone already holding a plan keeps reading kilometres forever. So the fix goes at the read: pull the digits back out of the string, hand them to `formatPace`, let the owner do the arithmetic. Deliberately not a second pace formatter; this repo has a name for that (DELOAD-OWNER-01, five copies of one expression agreeing by accident).

The part I nearly got wrong: `easyPaceAsCeiling` **sniffs the unit back out of the text** — `paceTarget.includes('/km') ? ' /km' : '/mi'`. So the ORDER of the two calls decides what the runner reads, and both functions are individually correct either way. Convert first, then take the ceiling. The reverse hands the ceiling a `/km` string, it faithfully preserves `/km`, and a miles user reads a kilometre pace — the exact defect, reintroduced by composition. That is now an explicit test, in both orders.

**Product/creator learning:** The founder's screenshot showed distance in miles and pace in `/km` on the same card. That is worse than being wrong in one unit consistently, because the card contradicts itself in the space of two lines and the runner has to work out which number to trust. A half-converted screen erodes more confidence than an unconverted one. Same reasoning drove the all-or-nothing rule inside the converter: `9:28–7:02 /mi` renders beautifully and is nonsense.

**AI-building learning:** I widened the guard's regex to catch the pace shape, and separately found the file glob was broken — `git ls-files 'lib/plan/**/*.ts'` returns **zero files**, because `lib/plan` is flat and `**/` does not match a file directly inside a directory. 393 files the guard's own header claimed to cover had never been opened. Two independent blind spots in one check, and **either alone would have hidden this defect**. The previous sweep scanned that exact directory and reported clean.

What that taught me: I trusted the guard's header comment describing what it covered, instead of asking it what it actually read. The header was a claim. `git ls-files` was the measurement, and it took one command. I should ask a check what it can SEE before I believe what it says.

**The honest bit:** Widening both axes surfaced 87 more hits and I wanted to baseline the lot and move on. That would have been the wrong shape — 25 of them are validator messages nobody reads and the other 62 are a genuinely different problem. So I read all 87. Then I measured production expecting to find the prose class live too, and found **zero prose km across all 19 stored plans** while 17 of 19 carry `/km` pace. Tempting to file that as "not a real problem". It isn't — this repo already recorded §80's note naming its cap 0 times in 5,264 plans while being reachable the whole time. "Zero in the corpus" is not "cannot fire". Filed as a closed register with the measurement attached, both halves of it.

**Hook material:** The function that fixes the bug was already in the codebase, already correct, already tested. `formatPace(353, 'mi')` → `9:28/mi`. It was unreachable for five months because a different file had welded the letters `/km` onto a string, and by render time the number was gone. 674 of 888 sessions. The guard built to catch exactly this had two separate blind spots — a missing `/` in a regex, and a glob pattern that matched **zero of 393 files** — and either one alone was enough to hide it.

**Postable?:** yes

## 2026-09-23 — COMPLETION-TOMBSTONE-01 · the save worked, the row was already dead
**Shipped:** Completing or skipping a session on a regenerated plan actually shows up. It has been silently failing for anyone who started a new plan since 17 September.

**Dev learning:** The founder reported two sessions that wouldn't mark complete. The instinct is "the write is failing" — it wasn't. Both rows had been updated within a minute of the report, with exactly the right values. They were invisible because they carried a `superseded_at` stamp and had been **created five months earlier, on a different plan**.

Three facts, each defensible alone. The unique key is `(user_id, week_n, session_day)`. Every read filters out superseded rows. Every write upserts on that key and none of them clears the stamp. But `week_n` is a *within-plan* coordinate — a new plan restarts at week 1 — so completing week 1 collided with the old plan's week 1, updated it in place, and inherited its tombstone. **A fix we shipped five days earlier closed the read side of exactly this hazard and left the write side open.** The write succeeded, so nothing errored, so nothing was logged.

**The second defect was worse than the first.** The skip write only sets status and reason; everything else is inherited. So a session skipped *today for illness* was carrying an RPE of 3 from April — feeding a fabricated body-state signal into the fatigue triggers and the risk gate.

**AI-building learning:** The cheap fix was to add `superseded_at: null` to the eight write sites. It would have worked, and it would have been wrong twice: it leaves the data merge intact, and it overwrites the old plan's history — the exact thing superseding exists to preserve. The right fix was to change what the constraint *claims*: not "one completion per user/week/day forever" but "at most one **live** completion, and any number of superseded ones". A partial unique index says that, and then the collision cannot happen rather than being recovered from.

**The gate earned its place immediately.** I wrote it to stop a ninth call site, and it found four *existing* ones I'd missed — all server-side, none filtering the tombstone. One of them caught me mid-fix: `healthkitConsolidate` has two textually identical update blocks, and my edit had landed on the wrong one. I'd have shipped that believing it fixed.

**The honest bit:** the typed helper refused to compile on a call passing `session_day: sessionDay`, where that value can be undefined. Every other use in that component guards it. The old untyped upsert accepted it, PostgREST dropped the key, the NOT NULL constraint rejected the row, and a bare `catch {}` swallowed it. That path had been quietly broken too, and I only found it because a type annotation made it impossible to ignore.

**Hook material:** The user said "it won't save". It saved perfectly — onto a row that had been dead for five months.

**Postable?:** yes — "your write succeeded and your read is right and the feature is still broken" is a good three-facts-each-correct story.

## 2026-09-23 — COACH-MEASURE-PROTOCOL-01 · the protocol existed only as prose, and the prose was stale
**Shipped:** `npm run review:coaching` — the whole coaching measurement protocol in one command, with a doctrine file that says what each step is for and what none of them can see.

**Dev learning:** Eight measurement commands had accumulated. The register described the protocol as four of them, in a specific order, and that description went stale the moment two more existed — it named neither. Nobody noticed because the list was in a document and the running was done by hand, so the two could drift indefinitely without anything disagreeing out loud. **A protocol that lives as prose in one file and gets executed from memory in another is a memory test.** This repo already had the receipt: the coaching review loop itself went dormant for exactly this reason and had to be rebuilt around a CI trigger.

**The worse finding was in CI.** The trigger that fires on every doctrine push ran **one step of the six**. It checks that every case still generates — which cannot see a fit-for-purpose move, a cohort band collapsing, a new coach objection, or a plan that is perfectly valid and does not build the runner. A doctrine change that moved any of those went green.

**AI-building learning:** The scorecard prints what none of the six can see, at the end of every run, in the terminal. Not in a README, because nobody reads the README at the moment they read the result. A tool that only ever shows green ticks teaches you that green means "fine", when it means "the things this script looks at are fine" — and this repo has watched that exact substitution happen to its documentation audit twice.

**Product/creator learning:** The doctrine file makes one distinction load-bearing: a rate can move because the **engine** moved, because the **definition** moved, or because the **population** moved, and only the first is progress. We had a worked example from the same day — the marathon went 78.7% to 89.8% with not one plan changed. Without that distinction written down, the next person reading the chart sees an eleven-point improvement.

**The honest bit:** my first version of the fitness step's headline took the last line of that tool's output. That line is one arbitrary persona from a list, so the headline would have changed whenever someone reordered the list, and it would have looked like a result. A headline that moves when nothing moved is worse than no headline.

**Hook material:** Our CI ran one step of a six-step review and reported it as the review.

**Postable?:** yes — "your protocol is prose until something executes it" generalises to every runbook anyone has ever written.

## 2026-09-23 — ZERO-REJECTION-SERVED-01 · the scoreboard was counting a served runner as a dropout
**Shipped:** The fit-for-purpose measure stops scoring a refused-but-served marathoner as a failure. Marathon 78.7% → 89.8%, whole product 92.5% → 96%, and not one plan changed.

**Dev learning:** The board declined to sign off the marathon this morning at 78.7%, and the number it was reading counted a runner who receives a real, validated plan as a dropout. It was measuring which code path threw, not whether anyone was coached. The rule behind it was right when written — "a refusal must lead to a plan, not to advice" — and the feature that made it lead to a plan shipped **nine hours later the same day**. Nobody went back to the rule.

**The conflict scan did the work, again.** §118's own ruling already said a raceless plan must not be scored by a race-shaped harness, and filed that as a known gap. What nobody had drawn was that the harness doesn't merely *fail to score* it — it scores it **FAIL**. The answer was half-written in the constitution and needed one more sentence. That's the second sitting running where reading the register first changed the outcome.

**AI-building learning:** The dangerous version of this change is the one that just makes the number go up. So the correction carries its own opposite: `fitPctPreCorrection` is a field, not a footnote, and the report prints `[was 78.7%]` on every single run. The chair's words are in the code comment verbatim — *"the engine did not get better"* — because in six months the +11.1pp will be in a chart and the reason will not.

**Product/creator learning:** It still doesn't clear the bar. 89.8% is 0.2 points under 90, and the honest read is that the correction moved the number without signing anything off. Meanwhile the whole product is now 96%, above its own 90–95% target band — so the corrected metric has put us *over* the range, which is a question about the target nobody has asked yet.

**The honest bit:** I nearly broke one of the four amendments while implementing them. McMillan's condition was that the door rate is reported per band and never averaged, because 80.3% and 100% are different promises. I printed it at distance level, which is already an average — exactly the thing forbidden — and only caught it re-reading the ruling before committing. It now prints labelled as an aggregate with a pointer to where the real per-band numbers live.

**Hook material:** Our scoreboard called a runner a dropout while the product was handing them a training plan, because the rule was written nine hours before the feature that fixed it.

**Postable?:** yes — "a metric that measures which code path threw" is a sharp, general line.

## 2026-09-23 — COHORT-SERVED-01 · I read the engine's verdict as the product's answer
**Shipped:** The cohort review now reports what the runner receives, not what the generator threw — and it corrects a number I had already given the founder.

**Dev learning:** My table said `100% refused` for a marathoner running 4 km a week, and I reported that as "we turn them away, 85–100% of the time." The engine does throw. The route catches it and hands the runner a get-running plan, and the eligibility test for that is `effectiveStartKm > 0` — you have to run literally nothing to be excluded. **Nobody is turned away.** I had measured one layer below the product and read it as the product's behaviour.

**The part that stings:** I found this exact failure mode that same morning — four of five harnesses calling `generateRulePlan` and stopping, so no board round had ever seen a foundation week. I wrote it up, filed it, ruled on it at a board sitting, and then made the same mistake again four hours later on a different feature. Knowing a failure class by name does not stop you committing it; only putting the layer inside the instrument does. So the instrument now calls the same two owners the route calls.

**AI-building learning:** The founder pushed back — *"I thought we already did this, check the notes"* — and he was right. §118 had shipped three days earlier. The register even said so in one line: *"every refused cell now receives a Base Building plan."* I had read that register at the start of the day and still measured as though it were not true, because my harness disagreed with it and I believed my harness. **When the register and your measurement disagree, the measurement is the thing to check first.**

**The honest bit:** while adding the column I found I had also given him a wrong number. I said 46% of the 4 km/week cohort reach the marathon door. That is the share of *grid cells*. The share of *runners* is 80.3% — every other figure in that table is weighted and that one was not, and I presented it alongside them as though it were. I only caught it because the new column produced 80.3% and I could not reconcile the two, which is a weak reason to catch something and the only one I had.

**Hook material:** I diagnosed a "measuring one layer too low" bug in the morning, ruled on it at a board, and made the identical mistake on a different feature that afternoon.

**Postable?:** yes — "knowing the failure class by name doesn't stop you committing it" is honest and generalises.

## 2026-09-23 — ONRAMP-STEP-UNITS-01 · a cap in different units from the bound it must satisfy
**Shipped:** The base-build ramp now honours both the relative and the absolute long-run bound, and the two test corpora that each covered half the grid now cover it.

**Dev learning:** A board amendment capped the per-run step at 1.5 km, absolute. The implementation satisfied it by reaching for an existing rule — §45's +20% long-run progression cap — which is relative. Those two are the same number at a 7.5 km long run and diverge either side of it. Below, the fix looks perfect. Above, the producer obeys one ratified rule while breaching another. 54 of 522 plans built for refused marathoners were over the line. **A cap measured in different units from the bound it must satisfy is not a cap** — this repo has written that sentence three times about floors, and I found it wearing a ceiling.

**The corpus lesson is sharper than the bug.** The regression test said "36 of 36 generatable ramps clean" and it was true — of on-ramps, whose long runs never reach 7.5 km. A second test covered the generator that does reach it, but stopped at a volume below where it bites. **Two corpora that each cover half a grid do not cover the grid**, and nothing in either test could tell you that, because each one was green about its own half.

**AI-building learning:** I made four instrument errors getting to this, and an assertion caught every one, not me. I used `distance_km ?? 0` on duration-anchored plans and invented a +3.8 km step that did not exist. I wrote a property test that mirrored the validator but dropped its deload exemption, so it was stricter than the rule it claimed to check — I deleted it rather than reconciling it, because a second copy of a rule is exactly what produced this defect. And I widened a corpus by raising weekly volume while leaving the longest run at 2 km, describing a runner doing 15 km a week over three runs whose longest is 2 — and nearly "fixed" the engine for them.

**The honest bit:** I found a second conflict underneath and did not fix it. Below the session-count threshold a week splits evenly, so a lawful 10% weekly rise produces a per-run step of weekly/(runs x 10) — which means above `weekly > runs x 15` the two rules cannot both hold. It is unreachable by any runner the feature serves today. The temptation was to nudge one of the two numbers and make it all go green. Both are ratified and one person owns both, so I pinned it with a test that fails if it *stops* reproducing, and filed it.

**Hook material:** Our fix satisfied the rule perfectly and broke it anyway, because the rule was in kilometres and the fix was in percent.

**Postable?:** yes — "units drift between a guard and the thing it guards" is a clean, general engineering lesson.

## 2026-09-23 — REFUSAL-COHERENCE-01 · the refusal was computed from a rule that had not fired
**Shipped:** A refusal that stops telling runners to reach a number they already exceed, and `npm run review:cohort` — the review's table, diffed, so the next round starts from a delta instead of a re-derivation.

**Dev learning:** Two rules can refuse a runner and share one error type for a good reason: one refusal shape means nothing downstream has to match on wording. What nobody noticed is that they were also sharing the *message*, and the message is arithmetic. The second rule computed its sentence from the first rule's ratio — which at that site had not been exceeded — so it told a runner doing 8 km a week to get to 7 km a week first. **208 refusals, 11.1% of every base-volume refusal in the marathon population, and all 208 were the same runner.**

**The measurement changed the fix.** My first instinct was "not enough time, come back with a longer run-up". The data killed it: these plans fail at *every* runway in the grid, twelve weeks through thirty, and at every day count. Time was not the lever. Shipping that sentence would have replaced an incoherent refusal with a confidently wrong one, which is worse — the first at least looks broken.

**AI-building learning:** I wrote the gate to assert the *property*, not the mechanism. It doesn't check which builder ran or what the sentence says; it checks the one thing the runner experiences — that the target named is above where they already are. A test asserting the new internal cause field would have passed just as happily on a message still carrying the impossible number. Then I falsified it against the actual pre-fix code rather than a simulated defect: 17 of 280 refusals flagged, clean afterwards.

**Product/creator learning:** The headline rate hides the cohort. The marathon sits at 78.7% fit, and that number is not spread across marathoners — it's 93-100% clean at 25 km/week and above, and 12% at 15 km/week. A rate that moves tells you something changed and never tells you who it changed for, and a rise in one band can hide a collapse in another. So the review now prints the same table every time and diffs it, including objections that *disappeared*, which you cannot see by walking only today's keys.

**The honest bit:** My first version of the coherence test swept the 50K envelope too. It failed — not on coherence, but on "did this actually reach a refusal?" 50K refuses nobody, so that half of the test proved nothing. I'd have shipped a green arm testing air if I hadn't written the reach check first.

**Hook material:** Our refusal told runners doing 8 km a week to get to 7 km a week first, because it was computing its advice from a rule that hadn't fired.

**Postable?:** yes — "two errors sharing a type quietly shared a message, and one of them was arithmetic" is a clean general lesson.

## 2026-09-23 — REFUSAL-FINISH-ROUTE-01 · a door can be open and the room still empty
**Shipped:** The base-volume refusal now offers the finish-goal route, but only when taking it actually produces a plan.

**Dev learning:** The engine could build a plan for these runners and the refusal never mentioned it. §44's alternatives have named "change goal to finish" since it was written; the code that renders the refusal offered "raise your base" and "come back in N weeks" instead. Small gap, and it is eight weeks of nothing for the runner who hits it.

**The actual lesson is the predicate.** I wrote the offer against §117's own eligibility gate, which is the right predicate in principle since §117 is exactly what rescues these runners. It was still wrong: 11 of 45 offers led to a second refusal. §117 has an adequacy bound that is checked on the *built* plan and throws afterwards, so no gate can see it. **A door can be open and the room still empty.** The only honest test was to generate the plan and look. That costs one extra generation on a path that is already a failure, which is a price worth paying to avoid refusing someone twice.

**Product/creator learning:** An invitation that leads to another door in the face is worse than no invitation. I would rather make the offer to 34 people and honour all 34 than make it to 45 and break it for 11.

**AI-building learning:** The word "instead" is load-bearing in that sentence, and I did not put it there on purpose. A guard proves §44's "a refusal must name a next step" obligation by **matching the prose** with a regex. My first draft was more actionable and matched none of its tokens, so the most useful refusal in the engine scored as a dropout with no route back, and a completely unrelated test went red on 0.1% of marathon runners. Second time this repo has been bitten matching a refusal on its wording. The real fix is a structural field rather than a regex; I filed it rather than widening this change.

**The honest bit:** Three separate fixtures reached the offer zero times before this passed — missing `age`, race dates before the plan start, and a missing acknowledgement flag — and every single time it was the "did the corpus actually reach this?" assertion that caught it, never the logic under test. A test that proves nothing passes just as green as one that proves something. I only knew because I had written the reach check first, and I had written it because this repo has been burned by exactly that before.

**Hook material:** My fix offered 45 runners a way out and 11 of them hit a second locked door, because the check I trusted runs before the thing that fails.

**Postable?:** yes — "a door can be open and the room still empty" generalises to every gate-vs-outcome check.

## 2026-09-23 — COACH-REVIEW-2026-09-23 · the board had never been shown a foundation week
**Shipped:** A coaching review round over 532 plans, and the discovery that four of the five harnesses feeding this board cannot see the thing a real runner actually gets.

**Dev learning:** The board round calls `generateRulePlan` and stops. So does the fit-for-purpose measure, the coach-objection audit and the cohort grid. Only the property sweep calls `composePlanWithFoundation` — which is the function the live API calls, and the single owner of plan mutation after generation. So any runner with more than 28 days of runway gets a foundation block on the front of their plan, and no board sitting has ever looked at one.

**The part that makes it a governance failure rather than a gap:** the invariant guarding those weeks reads a stamp that only the composer writes, and is deliberately silent when the stamp is missing. That silence is *correct* — firing without it would report the harness, not the plan. But it means the rule returned CLEAN in every harness that never composed. A green board round was not evidence of anything. I built the composing harness, ran 504 plans, and found zero violations: the engine was fine the whole time. The instrument was not.

**Product/creator learning:** The canonical fit-for-purpose doc still teaches a standard the founder overturned nine hours after it was written. It says a correct refusal counts as fit for purpose, and quotes 95.3%. `ZERO-REJECTION-01` replaced that with the founder's own line — "if someone comes to our platform and asks for a run, we can't just say no, go away" — at 16:34 the same afternoon. The doc was written at 07:47. The previous sitting read it and recorded the marathon at 90.1%. It is actually 78.7% fit plus 12.4% refused. **A stale standard is more expensive than a stale number, because it changes what counts as success.**

**AI-building learning:** I brought three findings to the board and the mandatory conflict scan killed one of them before any seat spoke — "is a note enough for 26 uncovered weeks" had been measured and settled eight days earlier, and the alternative had been rejected with numbers. That is the second consecutive sitting where reading the register first prevented me re-litigating a closed decision. The protocol exists because two sittings in one day did exactly that.

**The honest bit:** I reported 27 plans in a board ruling. There were 28. I took the number from the previous round's header instead of counting today's output — in a repo whose own completion rule says to count the population from the code and never from a previous session's number. Small error, exactly the habit the rule names.

**Hook material:** Four of our five test harnesses couldn't see the feature, and the rule meant to guard it reported "clean" in all four — because it reads a field those harnesses never write.

**Postable?:** yes — "a check that is silent when it can't see anything will tell you everything is fine" generalises well past this repo.

## 2026-09-23 — DB-USER-PURGE-01 · the delete button deleted an eighth of the account
**Shipped:** Account deletion now actually deletes the account, enforced by the database rather than by a list in a route — plus a repeatable purge tool for test data.

**Dev learning:** The delete-account route named three tables. The app has twenty-four that hold a runner's data. I only found it because I went looking for foreign keys before writing anything, and the answer was that the entire public schema had **one** foreign key of any kind, and it wasn't to `auth.users`. So there was no cascade behind the route — no backstop, nothing catching the twenty-one tables it didn't name. Run history, health samples, push tokens: all still there, keyed to a user id that no longer resolved to anybody.

**The thing that actually matters:** three separate places in the codebase asserted this worked. The route's own test exemption said it "deletes every row for the user regardless of plan". The Me screen promised "sessions, plan, and profile" — and `plans` wasn't one of the three. The privacy policy promised deletion "removes all associated data", which isn't marketing copy, it's a GDPR Article 17 claim. **Three descriptions of the same code, all confident, all wrong, none of them ever checked against the schema.**

**AI-building learning:** The obvious fix was to add twenty-one delete statements to the route. That fix is correct for exactly as long as nobody adds table twenty-five, and the failure is silent — a stranded row looks identical to no row, so nothing would ever have told us. This repo already has that scar: `WEEK_KEYED_TABLES` shipped wrong on its first write, and its guard iterated the same list it was guarding. So the authority went into the schema instead: `ON DELETE CASCADE` on every user-scoped table, a trigger for the three stores no foreign key can reach, and **the route now names no tables at all**. If you ever need to add a `.delete()` there, the constraint is missing.

**The honest bit:** I proved the cascade by building a throwaway account with ten rows across nine tables and deleting only its auth row. Everything went, except the one row I'd deliberately designed to survive anonymised. I did that because `deleteUser()` returning `ok` is precisely what the old route believed, and it was wrong for a year. Same reason the purge tool re-counts every table after it deletes instead of trusting the API's success response. And I said out loud what it still doesn't prove: one introspection helper couldn't be applied in this session, so the check verifies every table is **declared** but not that its foreign key is **wired** — and it prints that limitation rather than a tick.

**Hook material:** The delete-account button deleted three tables out of twenty-four, and three different places in the codebase confidently documented it as deleting everything.

**Postable?:** yes — "your delete button probably doesn't" plus the general point that a cleanup list in application code is a promise, while a foreign key is a mechanism.

## 2026-09-22 — DOC-CURRENCY-01 · the audit said ALL CLEAN and five entries were stale
**Shipped:** Backlog, feature registry, contracts and build-log actually brought current — by checking them against git rather than by running the script that says they are fine.

**Dev learning:** `audit-docs.sh` reported ALL CLEAN. Its shipped-but-open check is scoped to the scopes it sees in the day's commits, so an item that shipped as part of a build filed under a different name is invisible to it. I cross-checked all 216 registry IDs against open backlog headers by hand and found five stale entries. **A check scoped to today cannot answer a question about all time**, and the honest reading of ALL CLEAN is "the things this script looks at are fine", which is a narrower claim than the one I was about to make.

**Product/creator learning:** Registering a contract for a component immediately found a dead prop. `LoadShape` declared `ariaLabel?: string`, never destructured it, and no caller passed it — so the first person to need an accessible-label override would have passed it and watched nothing happen. The contract gate compares the **destructure** against the document, so it sees what the type declaration alone cannot. Writing the contract was the check.

**AI-building learning:** The founder asked "are we done" and the temptation was to run the audit, read ALL CLEAN, and say yes. The script had been green through every one of the five stale entries. **When the question is "is everything up to date", the tool that answers it is the one that reads the actual state — git, the code — not the one that watches for regressions.** Those are different jobs and I nearly substituted one for the other.

**The honest bit:** Three of the five stale entries were items I shipped myself, today, and then left sitting in the backlog as open work. I wrote the registry row and the build-log entry for each, and did not go back and close the thing they came from.

**Hook material:** A documentation audit that reported ALL CLEAN while five shipped items sat in the backlog as open — three of them shipped that same day, by me.

**Postable?:** yes — "my green check was answering a narrower question than the one I asked it" generalises well past this repo.

## 2026-09-22 — DESIGN-REVEAL-SHAPE-01 · my test passed while I broke the rule it was guarding
**Shipped:** The plan's shape now appears at the moment the plan arrives, with one annotation saying why a week is smaller — and a test that can actually tell when that annotation lands in the wrong place.

**Dev learning:** I wrote a gate for a board's binding condition — "the annotation may never land on the tallest bar" — then falsified it by making the component annotate exactly that. **It stayed green.** The test had its own copy of the rule, so mutating the component changed nothing the test computed. This codebase already has that failure written down under a different name: a tier test that asserted its own private copy of the resolution order and therefore could not catch either producer drifting. I read that note weeks ago and wrote the same bug anyway. The fix was to export the rule from the component so there is one of it.

**Product/creator learning:** The reason this item had been stuck was not the thing anyone thought. It was blocked on a typography decision — grant a second typeface or not — and the actual blocker was that there was no chart on that screen at all. The component existed, the data existed, three other surfaces rendered it, and the one moment that matters imported the numbers and not the shape. **A decision can sit blocked for weeks on the last question in the chain.**

**AI-building learning:** Falsification is not a formality at the end. Of the checks I wrote today, two were hollow and one fired on my own documentation, and every one of those was found by deliberately breaking the thing rather than by reading the test. The ratio is bad enough that "green" on a new gate should mean nothing until it has been made red.

**The honest bit:** Mid-build I found that `w.type === 'deload' || w.badge === 'deload'` is written out by hand in twelve places, and two of them omit the badge — so two invariants quietly disagree with ten others about which weeks are deloads. I added the single owner and then did **not** migrate the two divergent ones, because doing so widens what those invariants fire on, and that is an engine change I have no measurement for. Filing it rather than fixing it feels like leaving the job half done; folding it into a display build silently would have been worse.

**Hook material:** I mutated the code to violate the exact rule my new test existed to protect. The test passed. It had a copy of the rule.

**Postable?:** yes — "my test asserted its own copy" is the one every engineer recognises and nobody admits.

## 2026-09-22 — COACH-BEHIND-DAY-TWO-01 and the sittings · four items in, one defect out
**Shipped:** A Coach verdict that can no longer tell a three-day-a-week runner they are behind for missing a single session — plus four board sittings in which three filings turned out to be wrong about themselves.

**Dev learning:** The softener was `done / dueRef >= 0.7`. Enumerate it and it cannot fire below four sessions due: at dueRef 1, 2 or 3 there is no value of `done` that satisfies it while you are still behind. And `dueRef` never exceeds the sessions planned that week. So for anyone training three days a week — 29% of our grid — the softener was decoration. An example-based test would have passed forever: pick dueRef=5, done=4 and it works beautifully. **A reachability hole is only visible by enumerating the domain**, which is why the new test is exhaustive rather than illustrative.

**Product/creator learning:** The principle behind it (§65) was honoured perfectly in its implementation rule and completely unmet in its purpose. The date arithmetic was right; nobody had checked that the softener the arithmetic feeds could actually fire. **"We implemented the rule" and "we achieved what the rule was for" are different claims**, and only one of them had been tested.

**AI-building learning:** Four items went to the board. Three were wrong about themselves, and I only found out because I measured before convening. One premise was false (0 of 10,576), one didn't reproduce, and one was dissolved by a single production query — the item said no charity code had ever been redeemed; two of three are claimed, and the real blocker is that no real charity batch has ever been created. **The measurement is not preparation for the sitting. Three times out of four it WAS the sitting.**

**The honest bit:** My own measuring script was wrong twice and would have carried a false number into a board meeting. First it generated zero plans, refused 12,416, and printed a clean `0%` table — I nearly reported that as a clean result. Fixed, it subtracted a hardcoded 42.195 from every race week on a grid I had filtered to "over 40km", and reported a 13 km median where the real figure was 7. I caught it only because I stopped and inspected one actual race week by hand instead of trusting the aggregate.

**Hook material:** A softener that could never fire for 29% of users, sitting under a principle whose stated purpose is "the product can't accuse the runner of falling behind before lunch." And a board item whose two headline facts were both false in production.

**Postable?:** yes — "I measured before the meeting and three of the four agenda items dissolved" is the one.

## 2026-09-22 — POSTRUN-ORIGIN-01 · the same bug, one screen over, in a file that had already noticed
**Shipped:** Post-run remembers where you came from, so Back returns you there instead of dumping you on Today.

**Dev learning:** One screen, two exits, and they disagreed. `onDone` routed back to the session the runner came from and carried a comment explaining exactly why that mattered. `onBack` was `setScreen('today')`, hardcoded. The result is that finishing the flow properly takes you to the right place and *changing your mind* takes you two screens away — the escape hatch behaves worse than the happy path, which is precisely backwards.

**Product/creator learning:** Reshape needed nothing. All four states, including an error state with a "Try again" — the state that gets skipped most often in this codebase was already there. Worth recording, because a review that only reports findings quietly trains everyone to expect findings.

**AI-building learning:** I wrote a gate that COUNTS instead of checking presence: `setPostRunOrigin` must be called exactly as many times as `setScreen('post-run')` appears. Presence would have passed with two of three entry points stamped, which is the same defect with better odds — and this repo has already shipped that shape once, in a config script that knew about one local plugin when there were two. **If the fix is "do X at every Y", the test has to count Y.**

**The honest bit:** The fix for this exact bug already existed in the same file. `sessionOrigin` was added weeks ago for the identical hardcoded line on a different screen, and the write-up at the time even said "the identical line appears TWICE in that file." Somebody — me — read that sentence, fixed the one in front of them, and did not go looking for the next screen with the same shape. The note observed the duplication and then filed itself away.

**Hook material:** A comment in the codebase that says "the identical line appears twice in this file", sitting above a fix applied to one of them.

**Postable?:** yes — "we documented the duplication and then didn't act on it" is the honest version of every backlog.

## 2026-09-22 — DESIGN-DAYDOT-CHANNEL-01 · one colour carrying three facts, and the test that guarded the wrong thing
**Shipped:** The plan row's coloured rail stopped being repainted by completion, skip and move; completion is now the word "Done" where there is room for a word, and the fill of the dot where there is not.

**Dev learning:** One ternary, four branches, three unrelated facts: `isComplete ? --moss : isSkipped ? --line : isMoving||isSwapTarget ? --moss : accent`. Written that way it looks tidy. What it means is that finishing a run erases what kind of run it was, and that moss on that rail meant "complete" or "being moved" depending on state you cannot see from the pixel. The fix was not clever — it was to stop putting four things down one pipe and to use the channel that was already sitting there unused: words on the row that has room, fill on the dot that does not.

**Product/creator learning:** The rule was already written. `ui-patterns.md` has said "state must live in the label, never colour alone" for a long time, and an earlier ruling had already recorded that the 4px dot is the one place where neither a glyph nor a label fits. I did not need a new principle; I needed to notice that the existing one splits cleanly by whether the surface has room for a word. Most of the design decisions this week have been that shape — not new rules, but rules nobody had applied to a specific pixel.

**AI-building learning:** My own test from earlier the same day failed on a change that made the product better. It asserted `complete ? '6px' : '4px'` — the exact expression — when the thing it was defending was "completion is carried by something other than colour". Replacing the size channel with a fill channel is strictly stronger, and the test called it a regression. **Anchor a check on the guarantee, not the mechanism**, or the check becomes an argument against improving the thing it guards. That is the fourth time today I have written a variant of this sentence.

**The honest bit:** The old dot swapped between 4px and 6px to show completion, which means logging a single run visibly moved every other dot on the week strip. That shipped, nobody reported it, and I only found it while writing the replacement.

**Hook material:** A ternary with four branches encoding three unrelated facts on one colour channel — and a fourth fact on opacity, at 0.5, 0.45 and 0.4. Three meanings inside a tenth of an alpha value.

**Postable?:** yes — "my test failed because I made the product better" is a good, uncomfortable one.

## 2026-09-22 — PLANVERB-01 · the sitting I never wrote down, and two doors with one name
**Shipped:** Split "Change your plan" into "Adjust your plan" (keeps it) and "Start a new plan" (replaces it), routed the race-date field through the input owner, gave the sheet a top-right dismiss until there is something to apply, and landed a board sitting's rulings three days late.

**Dev learning:** Two rows in the same file, both titled "Change your plan". One opened a sheet that edits the plan in place; the other opened the wizard, which archives it. Nothing was broken — both worked exactly as written — and a runner reading four words had no way to tell which one destroyed their training block. The other one: the race-date field was the only `<input>` in the entire app below 16px, sitting at 13px, and `TextField` exists specifically because iOS zooms the page on any focused input under 16px. The rule was written, in the canonical component, in a comment, and the sheet hand-rolled its own input two feet away from it.

**Product/creator learning:** The subtitles were right the whole time — "Without starting again" versus "Build a new plan around a different race or goal". The information was there and the title overrode it. But the second one still wasn't honest: it named the destination, not the cost. Changing the verb made the destructive path easier to find, which meant the subtitle now had to say "Replaces the plan you have." Making something more discoverable obliges you to make it more truthful.

**AI-building learning:** I went to build wave 2 and could not find the rulings it was built on. The sitting had happened — another section cites two of its outcomes by name — but nobody wrote the rulings down, and "nobody" is me. The register's own maintenance note says, in those words, that a process whose memory depends on someone remembering to write it down has no memory. I have now reconstructed it from two surviving cross-references and fresh measurements, and had to write in the record that anything else from that sitting is simply lost.

**The honest bit:** One of my seven new assertions was hollow, and only falsification found it: `toContain('onStartNewPlan')` passes happily against `onStartNewPlanX`, because a substring of a renamed identifier is still a substring. That is the fifth substring-bias miss I have recorded in a single day. And renaming one string turned three existing tests red, two of which were matching a UI row by its label when what they actually cared about was its position.

**Hook material:** Two buttons, same four words, different destinations — one of them archives eighteen weeks of training. And a board sitting whose rulings existed only as two footnotes in a different section.

**Postable?:** yes — "the sitting happened and nobody wrote it down, including me" is the honest one.

## 2026-09-22 — SITE-GROUND-ABOUT-01 / DAYDOT-TEALKEY-01 · a gate scoped to one page, and a size keyed on a dead colour
**Shipped:** A Design Board sitting that ruled four items nobody had ever formally ruled, two of which built nothing on purpose; a band rule widened from the homepage to every marketing page; and a dot whose size was decided by a string comparison against a banned token.

**Dev learning:** `sectionSurfaces.test.ts` opened with `const HOME = 'app/page.tsx'`. Every assertion below it was about band alternation, a rule that applies to the whole site — and the gate could only ever look at one file. `/about` had carried a forbidden band for weeks with a comment in its own source saying it was forbidden. I widened the walk, ran it, and it immediately failed on a page I had not been looking at: `/charity-runners`, with **two** bands. The other one: `width: dotColor === 'var(--teal)' ? '6px' : '4px'`. `--teal` is retired, alive only as a legacy alias, and the producer returned that literal string for a completed run. **The size channel was load-bearing and keyed on a token we already decided to delete.** Rename it correctly and the dot silently stops growing — no error, no test, just state living in colour alone.

**Product/creator learning:** Two of the four rulings changed nothing in the product, and they were still worth an hour. Both had been sitting in the register as "recommended, never ruled", one annotated as "a taste call made against the documented rule". A decision one person made and wrote down is not a decision — it is a thing the next person re-proposes. Writing "KILLED, may not be re-proposed without new evidence" is the whole deliverable.

**AI-building learning:** Three cuts at one gate, and each miss was a known class. Too loose → three false positives on correct code. Tight enough → it fired on my own doc comment quoting the defect it guards, which is exactly how an earlier gate fired on the prose "Close. Bit of fine-tuning to do." Then the pre-commit hook blocked the commit because that comment named the banned hex — the second time in one day a comment RECORDING a removed colour was read as using one. **A guard cannot tell documentation from violation, and it is right not to try. Name the token, never the value.**

**The honest bit:** I widened the gate expecting to prove a fix I had already made. It found a page I did not know was broken, on a surface a charity partner gets sent to, with the defect present twice. The backlog item said `/about`; the code flags said `/about` and `/charity-runners`. I had read the item and not the flags.

**Hook material:** A test file whose first line was `const HOME = 'app/page.tsx'` guarding a rule that applies to every page. Widened it, and it went red on a page nobody had looked at — twice on the same page.

**Postable?:** yes — "the gate was scoped to one file and the rule was about all of them" is the honest version of a lesson everyone thinks they already know.

## 2026-09-22 — UI-BACKARROW-01 / S2-GATE-NARROW-01 / ICON-RULE-01 · three gates, and the one I named but never wrote
**Shipped:** One `BackButton` owner replacing 13 hand-rolled back arrows, a dismiss-colour gate widened until it caught the four offenders it had been blind to, and the icon-rule check that a ruling had named in prose and nobody had written.

**Dev learning:** A census is only as wide as the pattern you census with. I bounded a regex to `<button>…</button>` blocks containing `onClick={onBack}` and an `<svg>`, found twelve, and was pleased with myself — and then the thirteenth turned out to be `← Back` set as a literal arrow CHARACTER in the label. No svg. My regex could not see it and never would have. I only found it because the filed count said thirteen and I had twelve. **The instrument agreed with itself, and was wrong.** Second one: the S2 gate could only see an inline `background: 'var(--moss)'`. `RecalibrationTile` paints its dismiss through a local `primary(enabled)` helper, so the moss lives in a function two hundred lines away and the string never appears in the button. A checker reading a different source from the producer, which is a class this repo has written down before and I still walked into.

**Product/creator learning:** `ui-patterns.md` had said *"back arrow top-left, 44px circle, `--bg-soft`"* for months while **6 of 13** arrows obeyed it, two of them at 36px — under the iOS minimum that the same document states in its own "What Not to Build" section. Nothing was broken. Nobody would file a bug. It just quietly was not the product we had written down. A documented rule with no gate is a preference somebody typed.

**AI-building learning:** The widening of the S2 gate WAS the falsification. I widened the word list, ran it, and it went red on exactly the four buttons the backlog had named — before I touched a single one of them. That is much stronger evidence than fixing first and watching a test pass, and it cost nothing but doing the two steps in the other order. Worth making a habit: **change the check before the code, and let the code's current state be the test case.**

**The honest bit:** The full suite was already red when I got to it, and it was my fault. The commit before this one made a Design Board ruling and wrote *"Check: `lib/marketing/iconRule.test.ts`"* into `ui-patterns.md`. That file did not exist. I named a mechanical artifact in a doc and did not write it, which is precisely the failure class this repo has recorded under §92 — a principle claiming an enforcer that was never built. It survived a docs audit that read ALL CLEAN and a push, and was caught by a reference-integrity test during unrelated work, one commit late. And the fix had a trap in it: row icons are not built until wave 3, so the obvious version of that check would have walked an empty set and passed forever. I made its first assertion read the live `MODIFIABLE_ROWS.length` against the ruling's own ">= 8 rows" bound so it can actually wake up today.

**Hook material:** A documented spec that says "44px" while two live buttons are 36px, in an app whose own style guide names 44px as the minimum — and 6 of 13 controls obeying the rule. Plus: I wrote `Check: iconRule.test.ts` into the doctrine and never wrote the file. It took one commit and one unrelated task to find out.

**Postable?:** yes — "I wrote the rule, cited the test, and never wrote the test" is the honest AI-building post, and the 6-of-13 census is the hook.

## 2026-09-22 — BRAND-EMDASH-APP-01 · the number that would have misled
**Shipped:** The em-dash rule reaches the app, with a guard, and two docs that stated it
wrongly are corrected.

**Dev learning:** The raw count was 544 string literals and it was the wrong number to act
on. Broken down: 250 in lib (mostly dev-only), 92 AI prompt builders, 89 invariant messages,
28 session catalogue, 10 API routes, 75 runner-facing UI — and of those 75, **27 were the
bare `—` no-value placeholder**, which is typography, not a sentence. The real job was 48
sentences. If I had "fixed 544 em dashes" I would have mangled invariant text, prompt copy
and placeholders to satisfy a rule none of them are subject to.

**Product/creator learning:** Three artefacts disagreed and none of them was lying.
`brand.md` says the rule is site-wide. The only guard covered marketing. `CLAUDE.md` cited
"the app-side exception in brand.md § Punctuation" — and there is no such exception in that
section. Nobody wrote something false; a scope was asserted in one file, narrowed in another
and never reconciled. That is how a rule becomes three rules.

**AI-building learning:** I guarded the two directories wholesale rather than listing the
files that carry copy. A hand-maintained list is blind to the file nobody adds to it, which
this repo has recorded as its own failure class. The cost is exemptions — and each one
carries a written reason, because an exemption without a reason is where the next one hides.

**The honest bit:** I did not finish it. `ruleEngine.ts` holds 79 em-dash literals that are
runner-facing coach notes and dev-only invariant text **in the same file**, so a path-based
rule would be wrong in both directions, and push notification bodies — literally the "spoken
word" half of the founder's own sentence — are untouched. Filed as `BRAND-EMDASH-LIB-01`
rather than quietly counted as done, with a note not to just add `lib/` to the guard's roots.

**Hook material:** 544 em dashes in the codebase. 48 of them were the problem. The other 496
were invariant messages, prompt text and dashes that mean "no value".

**Postable?:** yes

## 2026-09-22 — MOVE-DRAG-GESTURE-01 · deleting the feature and keeping what it taught
**Shipped:** The hold-and-drag prototype is removed. Tap-to-move stands.

**Dev learning:** I removed it rather than leaving it behind `moveMode = 'tap'`. A prop
nobody passes reads as optionality — the next person to touch `PlanCalendar` has to work out
whether the drag path matters before they can change anything near it, and the answer is no
and will always be no. Deleting it took the component back under its pre-prototype size and
removed `useRef`/`useEffect` from a file that had not needed them.

**Product/creator learning:** The founder said "mark as complete as we are not doing it".
That is a different instruction from "park it", and it licenses the delete. Parking means
the question is open; closing means it isn't. I had already parked it once and then kept
going, which was me not hearing the first answer.

**AI-building learning:** The expensive part of a rejected feature is not the code, it is
what the attempt surfaced — five real defects and one instrument lesson. All of that lives
in `design-rulings.md` and here, where it is useful, and none of it lives in the codebase,
where it would be a maintenance cost. I kept exactly one thing in the source: the comment
warning that side effects do not go inside state updaters, because that hazard is about
React, not about drag.

**The honest bit:** Four rounds, each ending with me confident and the founder saying it
still didn't work. The bug I eventually found was real, and I still cannot tell you whether
fixing it would have made the gesture usable, because it was never tried again. The feature
is closed on a judgement, not on evidence, and the evidence gap is mine.

**Hook material:** I deleted four rounds of work in one commit and kept the five bugs it
found.

**Postable?:** yes

## 2026-09-22 — AI-COMPLETION-COLUMN-01 · a failed query became a confident zero
**Shipped:** Both AI coaching routes now actually see the runner's completions, and a failed
read reports unknown instead of nothing.

**Dev learning:** `completionRate = completed / totalSessions`. The completions array was
always empty because the query named a column that does not exist and the error was thrown
away — so that expression evaluated to `0 / N` and handed the model a **0%**. Not a null,
not an absent field: a number, with a decimal point, that a language model then wrote a
coaching note around. The difference between "I don't know" and "zero" is the whole defect,
and `?? []` is what converts one into the other.

**Product/creator learning:** The fix was not to add the column. `session_type` belongs in
the plan JSON where the engine put it, and a completion already carries `(week_n,
session_day)` — the exact coordinate that addresses a session. So the join was always
available and nobody took it. Adding the column would have created a second source of truth
for what a session IS, next to `coachingSessionType`, which is the drift D-17 exists to stop.

**AI-building learning:** The tell was sitting in the code the whole time:
`c.session_type === 'easy' || c.session_type === 'recovery'` — a filter on a field that
never existed, so a predicate that had never once matched. A grep for "conditions that can
never be true" would have found this years earlier than a database log did. That is a real
check I do not have and probably should.

**The honest bit:** I filed this an hour before fixing it and wrote "both AI surfaces have
been writing a coaching read from an empty array". That was true and it undersold it. I did
not notice until I traced the consumer that the empty array does not stay empty-shaped — it
becomes a zero, and the zero is asserted to the model as fact. Reading the consumer, not the
query, is what upgraded it from "missing data" to "we told the model something false".

**Hook material:** A filter on a database column that has never existed, so a condition that
had never once been true, feeding a coaching note that told runners they had completed
nothing.

**Postable?:** yes

## 2026-09-22 — TAPER-RECAL-COLUMN-01 · a feature with twenty tests that had never run
**Shipped:** §68 taper recalibration now actually executes. It never had.

**Dev learning:** `taperRecalibration.test.ts` has twenty careful assertions — the gate fires
only at taper entry, the functional peak is a top-N average so one outlier isn't read as
adaptation, it never raises the taper for an overperformer, it never scales a rest day into
a run, it leaves race week alone. Every one passes. Every one hands the function a
`weeklyActuals` map. The defect was that the route that builds that map queried the wrong
table, so the map was always empty and the function correctly declined. **You can have
complete coverage of a function and zero coverage of whether anything calls it with real
data.**

**Product/creator learning:** The conflict scan nearly killed a correct change. §6 Amendment
2, ratified seven days earlier, also says the taper is anchored to "the week the runner
ACTUALLY DID" — which reads like the same mechanism. It isn't: Am.2 anchors to what the
generated plan *delivers* versus what the volume curve *intended*, at generation time, with
no runner data anywhere near it. §68 anchors to what the runner logged. Two amendments using
the same English phrase for different quantities, and only reading both in full separates
them.

**AI-building learning:** The board's amendment was the valuable output, not the fix. The fix
is one identifier. What Hutchinson insisted on recording is that this is *not* a defect fix
restoring documented intent — §68 has never executed, so every taper rule ratified since was
written against an engine where it was silent. Turning it on introduces behaviour. That
distinction changes what evidence the change needs, and I would have filed it as "restore
intent" and shipped it with a one-line note.

**The honest bit:** The blast radius is one user. Two people in the entire database have any
`run_analysis` load rows and one has the two weeks §68 requires. So a feature that has been
dead since it shipped has cost, so far, almost nothing — which is luck, not design, and the
only reason it's cheap to fix rather than an incident.

**Hook material:** Twenty passing tests for a feature that had never once executed. They all
tested the function. None tested whether anything ever called it.

**Postable?:** yes

## 2026-09-22 — MOVE-PROTOTYPE-01b · my trace logged the browser, not my code
**Shipped:** Fixed a press that cancelled itself, and made the gesture report its own state.

**Dev learning:** `setTimeout` leaves its id in the ref after the callback has run. I was
using `pressTimer.current` as the flag for "still waiting for the long-press", so the moment
the press armed, that flag stayed true — and the runner's first movement exceeded the slop
and called the cancel path on a press that had already succeeded. One missing
`pressTimer.current = null` inside the callback. A truthy-ref-as-state-flag is fine right up
until the thing it refers to completes on its own.

**Product/creator learning:** Two rounds of "still doesn't work" and I had nothing to work
with, because the diagnostic panel I built logged `pointerdown`, `pointercancel` and
`scroll` — what the *browser* did. A press that never arms and a press that arms and is
immediately torn down produce an identical browser trace. The instrument could not
distinguish the two failure modes it existed to distinguish. The gesture now emits its own
phases and they interleave with the browser's.

**AI-building learning:** Every string-matching test I had passed while this was broken, and
they had all been falsified. So I wrote the failure as arithmetic instead — a ten-line
reduction of the ref-and-handler pair, asserting both that it fails when the id is left
behind and that it survives when the id is cleared. That one is not fooled by the code being
rearranged, because it models the behaviour rather than the text.

**The honest bit:** I am not claiming this is fixed. The bug I found degrades the drag but
does not obviously explain a total failure, and nothing I can do on this machine produces a
real touch — the browser pane wasn't even compositing frames when I tried to drive real
mouse input. I have fixed what I can prove is wrong and made the next report diagnostic.
Saying "fixed" here would be the third confident claim in a row about something I have never
seen work.

**Hook material:** Two rounds of "it doesn't work", and my debug panel could not tell the
difference between the two things that might have been wrong.

**Postable?:** yes

## 2026-09-22 — MOVE-PROTOTYPE-01a · a synthetic event is not a gesture
**Shipped:** Hold-and-drag actually works now, plus a raw browser trace on the preview page
so the next failure arrives as evidence rather than as "it doesn't work".

**Dev learning:** `touch-action` is resolved by the browser **at touch start**. I set it to
`none` only once the long-press armed, 350 ms in — so the property changed and the gesture
already in flight did not. The browser was still treating the touch as a possible scroll,
so it scrolled, fired `pointercancel`, and the drag died. Every time, on every phone. The
fix is what every real drag library does: leave the list scrollable, and once the press
arms, take the gesture with a **non-passive `touchmove` listener** and `preventDefault()`.
React's own `onTouchMove` cannot do it — it is attached passively and the preventDefault is
ignored.

**Product/creator learning:** I tested the gesture by dispatching synthetic `PointerEvent`s
straight at the element. That exercises my handlers and nothing else — it bypasses every
piece of the browser's gesture arbitration, which is precisely where the bug lived. I wrote
"verified on a running server" in a register entry off the back of it. The honest version
would have been "handlers verified; gesture untested, because this machine cannot produce a
real touch."

**AI-building learning:** The test I wrote to protect the behaviour was **enforcing the
bug**. It required the exact `touchAction: dragMode && isMoving` expression that does not
work, and I had falsified it — broken it, watched it go red, restored it. Falsification
proves a check has teeth. It says nothing about whether the check is pointed at the right
thing. Those are different properties and I have been treating them as one.

**The honest bit:** Fixing this broke a third test by existing. The schema snapshot I added
an hour earlier lists every column name in the database, `configConsumer.test.ts` decides
whether a config key is "consumed" by substring-searching the source, and three genuinely
dead `session_catalogue` fields suddenly read as wired — so it told me to shrink a debt
register that was correct. A gate turning another gate green by mentioning a name.

**Hook material:** My drag prototype passed its own test suite, had been falsified, and did
not work when a human put a finger on it.

**Postable?:** yes

## 2026-09-22 — HK-ELEV-COLUMN-01 · the log had one bug in it; the gate found three
**Shipped:** Fixed a wrong column name that had been silently emptying HealthKit runs since
June, and built a gate that checks every `.select()` against the real schema.

**Dev learning:** `const { data } = await supabase...` — the error destructured away. That
one habit turned a typo into a three-and-a-half-month outage. Supabase returns
`{ data: null, error }` for a bad column, so `data` is null, and the very next line was
`if (!hkRows?.length) return`, which reads a failed query and an empty table as the same
thing. The wrong name was `total_elevation_gain`; the column is `elevation_gain`; and the
same file had it right in a third place. Three copies of one marshalling block, two wrong.

**Product/creator learning:** The founder sent me a log export and asked "is this of
concern". Four of the 29 lines were mine, from an investigation an hour earlier. The other
24 were one real defect. But the gate I wrote to stop that defect recurring found two MORE
families that were not in the log at all — the phase-summary and race-readiness routes
select a `session_type` column that does not exist, so both AI coaching surfaces have been
writing their read from an empty array, and taper recalibration selects two columns that
live on a different table entirely. **A log only shows you the code that ran that day.**

**AI-building learning:** I did not fix the two new ones. Both change what a coaching
surface reads — resolving session type changes what the model is told, and making taper
recalibration actually run changes what the engine prescribes in the last weeks before a
race. They are baselined as declared debt with the gate failing on anything new, and routed
to the Coaching Board. The temptation to fix all three in one go, while I had the file open
and the cause understood, was strong and would have shipped a prescription change inside a
commit titled "fix a column name".

**The honest bit:** My first version of the gate reported six failures and two were mine —
it comma-split `charity_batches(partner_name, cap, revoked_at)` and handed the embedded
table's columns to the outer one. If I had reported six without reading them I would have
filed two defects that do not exist, in the same message where I was telling the founder his
real ones were serious.

**Hook material:** A database log with 24 identical errors an hour. The feature it broke had
been dead since June. Nobody noticed because the code read "query failed" and "you have no
runs" as the same sentence.

**Postable?:** yes

## 2026-09-22 — MOVE-PROTOTYPE-01 · I built the instrument wrong in my own favour
**Shipped:** `/move-preview` — both move gestures on a real week, instrumented, so the
Design Board can settle the one thing it could not.

**Dev learning:** The board's two options were not two options. It recorded "the founder
wants hold-and-drag; Wroblewski's counter is tap the session, tap the day" — and the second
one is what has shipped for months. Nobody in the sitting checked, including me. That is not
a small correction: it turns "pick a design" into "is drag worth replacing a flow an
incident hardened", which is a much higher bar and a different conversation.

**Product/creator learning:** The safety had to be held constant or the prototype would lie.
A drop is a commit gesture, and "the runner did not realise the thing he did was a move" is
the literal root cause of the 2026-06-26 incident that produced the confirmation row. If I
had let drag write on release it would have come out faster, and it would have been faster
because it was less safe. So both gestures stage into the same confirmation row and only the
pick-up-and-place varies.

**AI-building learning:** I built the measuring instrument biased toward the thing I had
just built. The attempt clock started when the long-press armed, not when the finger landed
— so a 450ms hold plus a move reported 162ms, while the tap flow was timed from first touch.
Drag was getting a 350ms head start on the exact cost it is being judged on. I only caught
it because the number looked too good and I had the hold duration in front of me. A biased
instrument does not produce a weak ruling; it produces a confident wrong one.

**The honest bit:** One of my thirteen gates was hollow, and the falsification caught it
rather than my reading of it. `moveMode = 'tap'` appears twice — once on the component, once
on the inner card — so flipping the outer default to 'drag' left an unbounded `toMatch`
perfectly green. That is the fifth time in this repo's record that grepping a whole file
instead of bounding a region produced a check with nothing behind it, and the second time
today. I also had a falsification silently fail on a shell quoting error and report green,
which is why every mutation now prints whether it applied before the test runs.

**Hook material:** My prototype told me the drag gesture took 162ms. I had held the button
down for 450.

**Postable?:** yes

## 2026-09-22 — APP-REVIEW-W4 · the ruling that correctly built nothing
**Shipped:** Coach's load ratio became a shape, Session Detail leads with the set rather
than the reason for it, and two of Me's sections now describe their own contents.

**Dev learning:** `0.8` was sitting inside a display function as a bare number, deciding
whether a runner is told they are "under your recent normal". Not in `GENERATION_CONFIG`,
not in `constants.ts`, not visible to `configConsumer.test.ts` or any other check this repo
owns — because it was in a `.tsx` file, in a function that returns a label. Every governance
layer here keys off where a number lives, and a coaching-adjacent threshold in a component
is invisible to all of them. Same shape as `peakKmByLevel` living in `length.ts`.

**Product/creator learning:** The founder asked for icons. The board bounded icons to labels
that repeat down a list. I went to apply the bound and found it reaches nothing: Plan rows
already print the session name, the adjustment diff already prints before-and-after text,
and the day marker is a 4px dot you cannot draw a glyph in. So S6 is satisfied by building
nothing, and that is the correct output of a bounded rule — not an oversight to quietly fix
by shipping an icon set anyway. What the measurement did find was better than what I was
asked for: that 4px dot carries eight session-type colours *and* completion state on one
channel, so a completed interval and a completed easy run are the same teal dot.

**AI-building learning:** I have been burned three times this session by a mutation that did
not apply, leaving a test green and looking like a hollow check. So for this wave every
falsification printed `MUTATION APPLIED: True` from an assertion before the test ran. Five
gates, five verified mutations, five reds. That is now the shape I want: do not ask "did the
test go red", ask "did the file change, and then did the test go red".

**The honest bit:** A5's whole argument is that a shape is read faster than a decoded ratio,
and I cannot show that. Nothing in this product has ever run on a device. What I verified is
that the hero is now the verdict, that the band reads the engine's real thresholds, and that
no chrome crept in — all source facts. The claim the ruling actually rests on is untested,
and saying so is the only honest version of "done".

**Hook material:** A design ruling I implemented by building nothing, because applying its
own bound honestly reached zero surfaces — and the measurement found a better defect than
the one I was sent to fix.

**Postable?:** yes

## 2026-09-22 — APP-REVIEW-S1 · the measurement killed the argument both sides were having
**Shipped:** Slide-up sheets now cover the bottom nav instead of resting on it.

**Dev learning:** The rule I reversed had a test. The test read
`expect(src).toContain('paddingBottom')`. My change sets `paddingBottom: 0` — which contains
the string `paddingBottom`. So the guard for "the sheet must reserve the nav's height"
would have passed the exact change that removed it, and had been passing for nine days with
nothing behind it. I only found out because I went looking for the test to update it. If I
had reversed the rule without checking, the suite would have told me everything was fine.

**Product/creator learning:** The founder asked for a panel position and I nearly built a
panel position. The measurement said covering the nav buys 0px on an SE and 5px on a 13/15
— so whatever he was reacting to, it was not space. What it actually was: the backdrop
spans the whole viewport at 40% ink with an onClick that dismisses, so the nav sat there
dimmed, looking like four destinations, and tapping "Plan" closed the sheet. A control that
lies, in the fattest tap strip on the phone. Same fix, completely different reason, and the
reason is what goes on the record so the next person does not re-argue it as taste.

**AI-building learning:** When a change buys nothing measurable, the argument was never
about the measurement. That is now a heuristic I want to reach for earlier: take the number
first, and if the number is 5px, stop designing and start asking what the person actually
saw.

**The honest bit:** Covering the nav broke something I did not think about until after the
edit — the panel's own close bar now sits where the home indicator is, because the nav used
to absorb that for it. The primitive had to grow a `env(safe-area-inset-bottom)` of its own.
Moving a boundary means inheriting what the old boundary was quietly doing.

**Hook material:** The test guarding "reserve the nav's height" passed a change that set
that height to zero, because it only checked the property was mentioned.

**Postable?:** yes

## 2026-09-22 — APP-REVIEW-W3 · the owner existed and three of four callers ignored it
**Shipped:** One time-to-race vocabulary, Today stopped navigating weeks, Plan now leads
with the weeks, and the race is stated once.

**Dev learning:** `formatRaceCountdown` had been written, documented with a careful comment
explaining why runners think in weeks, and then bypassed by three of its four call sites.
Underneath it were four separate pieces of arithmetic for "how many days to the race",
three using `Math.ceil` and one `Math.round`. So the product could show two different
numbers on two screens, both correct by their own method, on any day near midnight. The
lesson is not "centralise things" — the centralising had already been done. It is that a
single owner nobody is forced to use is a suggestion.

**Product/creator learning:** The consumer check in the build procedure says look at the app
AND the website, every time. This is the first time it has paid out on its own terms: the
marketing site's phone still had the countdown hand-written, with a comment above it saying
it "mirrors formatRaceCountdown() in DashboardClient". A hand-copy with a comment asserting
it matches is worse than a hand-copy without one, because the comment is what stops the next
person checking. It imports the real function now.

**AI-building learning:** I falsified six gates and one of them lied to me. The A2
reversion was supposed to move the calendar back below the cards; I wrote the slice indices
from the post-fix layout, so the mutation did nothing and the test stayed green. A green
test after a no-op mutation looks exactly like a hollow check, and I only caught it because
the other five went red and this one did not — the anomaly was the pattern break, not the
result. Third time this session a mutation failed to apply. The habit I want is: assert the
file CHANGED before trusting what the test says about it.

**The honest bit:** My first gate for "no hand-rolled race arithmetic" matched any
`getTime()` difference divided by 86,400,000 and caught `daysToPlanStart`, which is a
different quantity with its own meaning. The test failed on correct code. That is the
denominator error this repo has recorded four times, arriving in a check I wrote to prevent
a different one.

**Hook material:** Four pieces of arithmetic for one number, three rounding up and one
rounding to nearest. Two screens, two answers, both defensible, on any day near midnight.

**Postable?:** yes

## 2026-09-22 — APP-REVIEW-W2 · five defects fixed, and the sixth was me
**Shipped:** The five real defects from the founder's app review (week totals, back
navigation, the health-access prompt, the modify sheet's missing states) plus an honest
"not a bug" on the sixth.

**Dev learning:** `?? 0` claimed its fourth measured scalp. `PlanCalendar` read
`s?.distance_km ?? 0` to total a week, and a beginner's plan is duration-anchored on 95.8%
of sessions, so the week summed to zero and a `> 0` render gate made the whole total
disappear. Two symptoms the founder reported separately — "some weeks have a total and
some don't" and "everything shows duration though my profile says distance" — were one
line, written twice in the same file. The repo already had the owner (`sessionKmSelfPaced`,
returns null rather than zero, precisely so this cannot happen). Nobody used it here.

**Product/creator learning:** The most useful thing I did all session was open the
database. The founder said "one session behind — I wasn't due a session until today", and
I had a neat hypothesis (missing override resolution in the Coach verdict). Wrong. His
week 1 starts Monday, prescribes a Monday easy run, has no overrides, and the old
completions are correctly superseded. The count was right. What is actually wrong is
subtler and I would never have found it by fixing the bug I imagined: the "you're fine"
softener is `done / dueRef >= 0.7`, and on day two `dueRef` is 1, so the ratio is 0. The
first missed session of any plan is always a red verdict. That is a coaching question, not
a defect, and it goes to the board with a number attached.

**AI-building learning:** The debug skill's step 2 — "do not assume the reported side is
the wrong one" — is the step I would always skip if it were not written down, because the
founder reporting a bug feels like evidence the code is wrong. It is evidence the two
disagree. Four SQL queries settled it in about a minute, against an hour I would have spent
building a fix for a defect that was not there. Cost of checking: tiny. Cost of not
checking: a change to how "behind" is computed, shipped on a false premise, into the
one screen the founder called "a real moment" for paid users.

**The honest bit:** I wrote the regression test's site-counting regex as
`.map\([^)]*sessionKmSelfPaced` and it matched zero of two, because the arrow function is
`(s: any) =>` and that `)` ends the character class immediately. The test failed on correct
code and for a few seconds I believed I had missed a site. Second time this session a gate
was wrong rather than the thing it guards. The habit that saves it every time is the same
one: falsify before trusting — break the fix, watch the test go red, restore it. All five
went red on their own reversion.

**Hook material:** Four database queries turned "fix the bug" into "there is no bug, and
here is the real one you could not see." The founder's `dueRef` was 1, so the forgiveness
threshold of 0.7 needed 0.7 of a session.

**Postable?:** yes

## 2026-09-22 — APP-REVIEW-W1 · the button that said Skip and meant Continue

**Shipped:** The first four rulings from the app review. One CTA vocabulary, an optional-step
affordance that no longer lies, a dismiss that is not the CTA colour, and a tab bar whose padding is
symmetric.

**Dev learning:** `function skipStep() { goNext() }`. One line, no branch. Two buttons on six screens
called the same function under different names, and answering the step then tapping "Skip this"
**kept your answer**. The label had been false since the step was written, and it took walking the
flow to see it, because reading the file you see two handlers and assume two behaviours.

**Product/creator learning:** the founder said *"move the menu down"* about the tab bar. The
measurement said 6px above the icons and 34px below — the content was already as far down as it
could go, and the void beneath it was the safe-area inset being spent as padding. **Moving the bar
would have pushed it under the home indicator.** The complaint was exactly right and the instruction
would have made it worse.

**AI-building learning:** I took a finding to the board that was false — *"the moss primary says
Skip this"* — because my own walker logged `cta: "Skip this →"` and I read my tool's label instead of
checking which element it had picked. Measured after: the moss primary says `Continue`; skip is a
13px muted link. **Second board ruling today built on an instrument I did not interrogate.** The
retraction produced a better finding than the original.

**The honest bit:** the check guarding the dismiss rule was **wrong three times**. First a
hand-written three-file list that **missed the actual offender** — the exact button the founder
complained about. Then a word match that fired on `headline: 'Close. Bit of fine-tuning to do.'`,
which is prose. Then a handler match that fired on Orientation's `"I'm ready"`, which is a primary
action wired to a prop called `onDismiss`. **The property was the label all along.**

**Hook material:** A wizard with a "Skip this" button whose implementation is, in full,
`{ goNext() }`. Tap it after answering and it keeps your answer. Six screens, unnoticed, until
someone built a harness that could open the flow without making an account.

**Postable?:** yes

---

## 2026-09-22 — WIZARD-HARNESS-01 · you cannot review a flow nobody can open

**Shipped:** A harness for the setup wizard, and the first end-to-end walk of it. 13 answerable
steps, 2 teaching interstitials, generation.

**Dev learning:** The wizard component takes one required prop (`onBack`) and a dozen optional
ones, so the harness is ~100 lines. The thing that made it feel impossible was that it lives inside
a 14,000-line file behind auth — not that it was coupled. **Check the props before concluding a
component is untestable.**

**Product/creator learning:** The founder said *"make sure the inputs are modern, useful, no bugs in
them."* That is a measurement, and I had been about to take it to the board as an opinion. Walking
it produced four findings in ten minutes, and the sharpest one nobody had said out loud: **on an
optional step the moss-filled primary button says "Skip this →".** The most prominent affordance on
the screen is spent on declining to answer, and five of fifteen steps are optional.

**AI-building learning:** Three attempts to automate the walk before it worked, and each failure was
the same shape — the script assumed the control type instead of reading it. It clicked "the first
button", which was a nav element; then it filled inputs by `type`, which skipped the range sliders
because they already had a value. **The walker kept finding what it expected instead of what was
there**, which is the same error as every wrong measurement I made today.

**The honest bit:** my first static pass mapped every step to a control by grepping for the nearest
component name, and produced a table that was pure artefact — the first eight steps all "used
CardSelect" and the last ten all "used WizardInput", because that is the order the file happens to
be in. **It looked exactly like data.** I threw it away rather than report it, and then read the
actual render switch.

**Hook material:** A setup wizard where, on a third of the steps, the biggest greenest button on the
screen says "Skip this". Nobody had noticed, because nobody could open the flow without making a new
account.

**Postable?:** yes

---

## 2026-09-22 — SITE-TRIO-FULLBLEED-01 · I fixed a real defect that was not the one he reported

**Shipped:** The ProductStill trio now sits in the page column. It was rendering **24-1412 on a
1440 viewport** — the full screen — while every other band sat at 168.

**Dev learning:** `Section width="full"` opts out of the page frame so a band can manage its own
width. Anything placed inside it that is not re-wrapped in `--measure-page` renders full-bleed. The
trio was moved into the mechanism band by a board sitting and landed as a *sibling* of the wrapper
rather than a child. One nesting level.

**Product/creator learning:** He said *"those are using the full span of the page."* That is
literally what was happening, and I read it as a complaint about the page's alignment in general. I
measured the prose bands, found that the content edge moved four times, fixed that, and reported
done. It was a real defect and it was not his. **Read the complaint against the artefact before
deciding which defect it names.**

**AI-building learning:** The measurement I ran to answer him could not have found it. It collected
every element carrying a `max-width`, took the smallest left edge per band, and reported 168 — which
it got from the trio's *neighbour*, because the trio grid has no `max-width` at all. **A measurement
that only looks at elements WITH the property cannot find the element that is MISSING it.** That is
the same denominator failure as the ramp anchor and the global-vs-local timeout, three times in one
day, in three unrelated places.

**The honest bit:** the gate took two attempts. The first anchored on the trio's JSX comment — and
the helper that reads the file **strips comments**, so it failed on correct code with "the marker
has moved". Second test in a row written against a version of the file the helper does not return.

**Hook material:** He reported the same thing twice. The first time I measured, found a genuine
defect, shipped it and said done. The thing he was pointing at was still there — a grid spanning
1,388 pixels of a 1,440 pixel screen — and my measurement had looked directly at that band and
reported it correct, because the element I needed to see was the one with nothing to measure.

**Postable?:** yes

---

## 2026-09-22 — CI-SLOW-LOAD-01 + DOCS-PUSH-GATE-01 · "why are we debating? fix it"

**Shipped:** The duration gate now measures the code instead of the machine, and the documentation
audit runs on every push instead of when I remember.

**Dev learning:** Both were the wrong denominator, which is the failure class this repo records
more than any other. The duration gate compared **absolute milliseconds** to a baseline of absolute
milliseconds — the same test measured 2,085 ms under the full parallel suite and ~700 ms in
isolation on the identical commit. A share of the suite's own total is load-invariant; milliseconds
are not. And the hard wall measured every test against the **global** `testTimeout` while
`targetedGrid` declares its own `}, 120_000)` at the call site, so a test at 18% of its real budget
was reported at 73% of a budget that does not apply to it.

**Product/creator learning:** The founder asked "why are we debating? fix it" and he was right.
I had measured the flakiness, filed it, written a careful note about why not to re-baseline — and
left `npm run verify` red all day. **A permanently-red gate is the same as no gate**, which is a
sentence already written in this codebase about a different check. I was defending the doctrine
against re-baselining and missing that the gate itself was wrong.

**AI-building learning:** The other half is worse, because it is about me rather than a script. He
asked why the documents are never up to date when it is part of the build process. The answer:
`audit-docs.sh` is a **git-based** check, so it can only be right *after* the commit — and I kept
answering from the edits I had just made, which is answering from memory. Every single time it was
answered that way it was wrong. It is now a hook on `git push`.

**The honest bit:** two of the misses are structural and I had not noticed. A state block **cannot
name its own SHA** — it is written before the commit that must cite it, so the last commit of every
batch leaves it stale by construction. And the id in the commit scope has to equal the id in the
registry row: I shipped `SITE-MEASURE-EDGE` with records filed under `§MEASURE-EDGE`, so both
records existed and both were invisible to the check that looks for them.

**Hook material:** A test-duration gate that had been red all day, on a test sitting at 18% of its
own timeout. It was being measured against a budget four times smaller than the one it actually
runs under, because the check read the global setting and the test declares its own.

**Postable?:** yes

---

## 2026-09-22 — SHIP-DOCS-01 + SITE-MEASURE-EDGE · the skill instructed on three documents and the audit checked eight

**Shipped:** `/ship` now names all eleven document surfaces, a new audit gate holds board rulings to
their register, and the homepage stopped moving its content edge as you scroll.

**Dev learning:** The founder said "every time I ask whether the docs are up to date, something has
been missed." Measured: the skill named **3** documents, the audit checked **8**. The five it did
not instruct were only ever caught after the fact — a net, not a process. And `design-rulings.md`
was in neither, because the hook that guards it fires on *editing a doctrine file*, and a ruling
like "wave 3 is dead" edits no file at all.

**Product/creator learning:** He then found a layout defect on desktop that three of us had walked
past. The content's left edge runs 168 six times, then 358, 358, back to 168, then 358, then 338.
Header and footer both sit at 168. The rule that was being broken **states its own purpose in the
document**: "matching the site frame so the content edge stops moving as you scroll." Nobody had
checked the page against the sentence.

**AI-building learning:** Every measurement in the design register until today was taken at 375px.
Both measures collapse to the gutter there, so this defect was structurally invisible to every
check I had run. **A viewport is part of a check's scope, not a detail of how it was run.**

**The honest bit:** two hollow checks in one hour. The audit gate reused a feature-id pattern that
requires two digits (`THING-01`), and board ids do not have them (`SITE-WAVE-3`, `CD-1`) — it
reported ALL CLEAN with the exact miss it was written for sitting in front of it. Then the layout
gate was written as `.tsx` and vitest's include is `components/**/*.test.ts`, so the runner never
saw it: "No test files found" and I nearly read that as a pass. **A test the runner cannot see is
the purest hollow check there is.**

**Hook material:** A design rule that says, in the document, "so the content edge stops moving as
you scroll." The page it governs moved it four times. Nobody compared the page to the sentence for
a day, and the founder found it in ten seconds on a laptop.

**Postable?:** yes

---

## 2026-09-22 — SESSION-SIZING-ANCHOR-01 · the defect I filed did not exist

**Shipped:** A gate, and a closed item. Measured 1,320 quality sessions: **zero** are sized at
threshold pace while their work steps run somewhere else. The defect §120 parked by name was not
there.

**Dev learning:** A structured session's distance comes from `segmentPricedKm(repPlan.mainMins,
repPlan.workPaceMinPerKm)` — its own work pace — and never from the `minPerKm` I had been staring
at. `minPerKm` only reaches unstructured sessions and the two continuous tempo rows, which are
genuinely threshold work. I had read the expression, seen it was anchor-blind, and never traced
what consumed it.

**Product/creator learning:** The founder pushed back on the phrase "filed, not fixed" and was
right to. His rule is: file only what needs a board, new data, or his decision. Measured against
that, one of my three filings was legitimate (two ratified principles genuinely contradict each
other) and two were me stopping short — and one of those two turned out to have **no defect in it
at all**. Filing is not a neutral act: it puts a fiction in the backlog that somebody later spends
time on.

**AI-building learning:** My first measurement said **20.2%**. It counted 267 `progressive_tempo`
sessions because the row opens with an `E`-anchored third and I forgot E is a ramp rather than a
work intensity — the codebase filters it two functions away for exactly that reason. Then my first
gate was **hollow**: it inferred "sized at work pace" from the derived set's shape, so reinstating
the bug left it green. Tracing *why the falsification failed* is what found the false premise. The
broken falsification was more informative than the passing test.

**The honest bit:** bounding the replacement check took **three attempts**. `segmentPricedDistance`
appears four times in the same file, and two different anchors matched the wrong call and reported
a failure on correct code. I have written "bound the region, never grep the file" into this
codebase repeatedly this week and still got it wrong twice in ten minutes. Knowing the rule is not
the same as applying it.

**Hook material:** I filed a defect, wrote it into three documents, took it to a board — and then
measured it and found it did not exist. The original claim had been in the codebase for a day,
asserted confidently, never checked.

**Postable?:** yes

---

## 2026-09-22 — RACE-WEEK-VOLUME-01 / §121 · the taper looked like the hardest block

**Shipped:** The race no longer counts as training volume. Measured on 8,510 plans, the taper
phase was outweighing the peak phase in **15.3% of plans and 50% of marathons** — and excluding
the race session, **no taper anywhere exceeded its peak**. The race was the whole cause.

**Dev learning:** The identical symptom had been fixed the day before, at the display layer, on
one published page. That fix's own header argued — well, and correctly on the evidence it had —
that redefining `weekly_km` would "silently move a number ~40 call sites depend on, to fix a
rendering problem." What changed the answer was measuring the population rather than the page.
Then the interesting bit: because that display fix existed, `trainingKm(w)` was already
`weekly_km − raceKm`, so fixing it at the source would have subtracted a marathon **twice**. The
function is now an identity and deliberately kept — deleting it would scatter `w.weekly_km` back
across the callers and lose the one place the term is defined.

**Product/creator learning:** A beginner opened the plan preview and read
`Base 25 · Build 38 · Peak 41 · Taper 47`. That teaches the taper is the hardest block, which is
the single most misunderstood idea in amateur running, and it hit the beginner (22%) and
injury-history (20%) cohorts hardest — the people least able to argue with the screen. The board
was blunt that this is an **honesty** fix and not a safety one: a 12 km/week runner racing a
marathon is at 1.7× their biggest ever week, and taking the race out of a total does not change
that by one gram. It stops the screen arguing for the mistake.

**AI-building learning:** The consumer check is the step that earns its keep. Following
`weekly_km` outward found a live copy defect nothing else would have: the plan-scale card read
*"The race itself is 42.2km of it"* — a sentence that became false the instant the race left the
total — and the markup test guarding it **asserted the false version by name**. A test can pin a
lie as firmly as a truth.

**The honest bit:** four tests went red and every one of them was asserting the old contract,
including one whose entire premise ("a race week exists and is the biggest week") is now
impossible by construction. The temptation is to walk fixtures to wherever they go green. Each
one got its claim rewritten with the reason, and one of them taught me something: the
"false-positive class" it guarded — a 100 km ultra plan delivering 108 km against a 72 km band —
was **substantially the 100 km race being counted as training**.

**Hook material:** 8,510 plans. In 50% of the marathons, the taper was the biggest block of the
plan. Remove the race from the sum and the number is zero. The cause was one line that never said
whether a race counts as training, in a constitution with 125 sections.

**Postable?:** yes

---

## 2026-09-22 — HM-ANCHOR-VS-GOAL-01 / §120 · the number the board asked for was in the wrong unit

**Shipped:** On a time-target half, "HM pace" now means the pace of the race you are training for,
bounded so it can never be faster than your own CV pace. And the session card's header now states
the pace its reps actually run: **2,811 sweep sessions had been showing one that contradicted them.**

**Dev learning:** The board's ruling named a constant — `RACE_PACE_ANCHOR_MAX_STRETCH_PCT`, a
percentage of the runner's current half pace — and told me to measure its value rather than choose
it. The measurement said the quantity was fine and the **unit** was wrong: there is already a
constant asking "how far past a derived pace band may a stated goal pace sit", and adding a second
one measured against a different band is exactly the duplicate-semantics failure the ruling itself
cited when rejecting a different reuse. Same vocabulary, one band down. Also: enforcement needed no
new gate at all. `resolveAnchorPace` is the single owner of anchor pricing and the eligibility set is
built from it, so returning `null` withholds the row through machinery that already existed.

**Product/creator learning:** The worst case is not "a hard session". A 52-minute 10K runner
targeting a 1:25 half was going to be handed 4 × 2 km at 4:02/km — **50 s/km faster than their own
VO2max interval pace**, three times in peak phase. The engine generates that plan today. The bound
costs something real and I wrote the number down rather than let it be found later: 3.4pp more
half-marathon plans are now classified maintenance rather than build.

**AI-building learning:** My first measurement produced a clean, confident finding that was an
instrument fault. I read the runner's threshold pace off the session card header, reasoning it falls
through to the threshold band — and got **0 of 12,960** sessions crossing threshold, which read as
"the injury concern does not exist." On a goal-pace week the header IS goal pace, so I was comparing
goal to goal and could only ever get zero. Caught by tracing one real plan and looking at it. The
real number is 40%. **A measurement that agrees with a convenient conclusion is the one to trace.**

**The honest bit:** I then fixed a second defect the invariant caught, measured it, and had to
**revert it an hour later**. Excluding CV-anchored rows from the goal-pace override — the obviously
correct reading of §85 — turns §22's own ownership arm red on 100 tests. §85 says the row may not be
re-priced, §22 says a row in that window must be goal-paced, and a CV row there cannot satisfy both.
That is two ratified principles in deadlock, it is the board's to settle, and it is not something to
smuggle into a commit shipping something else. Filed, and the invariant now warns on it every sweep
so it cannot go quiet.

**Hook material:** A runner targeting a 1:25 half off a 52-minute 10K would have been prescribed 2 km
reps at 4:02/km — nearly a minute per kilometre faster than the pace their own VO2max sessions were
set at. Not a hard session. An impossible one. Shipped by an anchor that meant "your half-marathon
pace" and never asked which half marathon.

**Postable?:** yes

---

## 2026-09-22 — SITE-BEAT-01 · the merge deleted the gap, and the spacing audit could not see it

**Shipped:** `--beat-y`, the gap between two beats INSIDE one section. Three places on the homepage
rendered at exactly **0px**. All three now 39px at 375, 56px at 1440.

**Dev learning:** The gap between two sections was a property of the **container**, not the content.
Design Board sitting two merged four sections into two, which was right, and the `<Section>` boundary
was the only thing holding the space apart. Delete the boundary, delete the space. Only the merged
sections were affected: I swept `/pricing`, `/about`, `/plans` and `/charity-runners` in the browser
and all four were clean. Also: `Eyebrow` applies the gap as `paddingTop`, not `marginTop`, because an
eyebrow is usually the first child of its wrapper and a first child's top margin collapses out
through a padding-less parent. It renders identically today. That is exactly why it was worth fixing
now: the next wrapper to gain a border would move the gap and nothing would fail.

**Product/creator learning:** The founder answered a different question ("is the palette flat?" →
*"its better"*) and in the same breath found the whole population of a defect I had shipped four
hours earlier. He listed three. A browser sweep found three. His eye was the complete instrument.

**AI-building learning:** He asked *"I thought you fixed those."* The tempting answer is a hedge. The
true answer is that SITE-WAVE-4 measured **448 gaps that existed**, and a gap of zero is not a gap —
it is an absent decision, and a scale test can only tokenise a value somebody already typed. **A
spacing audit finds wrong values and is structurally blind to missing ones.** I had written "448
gaps measured across six pages" into the register as evidence of coverage. It was never the
population, and nothing in the repo said so until this entry.

**The honest bit:** Two of my own guards went red on a change that reordered nothing and reversed no
ruling. They anchored the page's beat ORDER on the literal string `<Eyebrow>Honestly</Eyebrow>`, so
adding a `beat` prop broke them. That is the same failure I recorded a day earlier when four refusal
strings were retuned for tone and broke eight prose matchers in five files. **I wrote the lesson down
and then wrote the same test.**

**Hook material:** Three gaps on a live homepage, measured at 0px, 0px, 0px — created by a design
decision that was correct, and invisible to a spacing audit that had measured 448 gaps on six pages
the same morning. A gap of zero is not a gap.

**Postable?:** yes

---

## 2026-09-22 — SITE-WAVE-2 · the pages built to catch traffic were the only ones not converting it

**Shipped:** A CTA at the proof moment (screen 5.1), and an in-body download ask on `/guides` and
`/comparisons`. Largest in-body CTA gap on the homepage: **12.7 screens → 8.3**.

**Dev learning:** My original audit said *"six pages have no App Store CTA."* Wrong — the grep
matched `apps.apple.com` and missed `<AppStoreBadge>` and `BRAND.appStore.url`. Every page had
header and footer links. **The true finding was narrower and far more useful: six pages made no
ask IN THEIR OWN CONTENT.** The guard now matches the component, not the URL.

**Product/creator learning:** The founder's own ruling was that plans and guides are the traffic
channel and the app download is the conversion. Measured against that, **the two SEO hubs — the
pages whose entire job is catching traffic — were the only ones with zero in-body asks.** The
strategy and the implementation had never been checked against each other.

**AI-building learning:** Seventh unbounded-match bug of the session, and this one failed on
CORRECT code: I grepped the proof component for `background: 'var(--card)'` to assert the CTA
wasn't a card-on-a-card, and it failed — because that section legitimately contains two white
comparison cards. **A check that fires on correct code is worse than no check**, because the first
thing anyone does is delete it. Bound to the 240 characters wrapping the badge, then re-falsified.

**The honest bit:** Three separate indentation misses in one build, all from reading `sed`-prefixed
output as if it were the literal file. I only stopped guessing after the third. Inserting by line
number after measuring the indent worked first time, every time.

**Hook material:** "Six pages have no call to action" was wrong. The real number was zero pages
missing a CTA and six missing one that meant anything.

**Postable?:** maybe


## 2026-09-22 — SITE-WAVE-4 · the type audit and the spacing audit found the same number

**Shipped:** `--space-1…7`, a 4px scale, swept across 69 hand-typed gaps on the marketing site.

**Dev learning:** `SITE-TYPE-01` found **19 distinct font sizes** and tokenised them. A day later,
measuring spacing, I found **19 distinct gap values**. Nobody had looked, because the type fix
felt like it had covered "the design system". **Run the same audit one layer over — it is the same
query with a different property name, and it costs twenty minutes.**

**Product/creator learning:** The founder described the symptom exactly ("the zone image then the
next text is very close") without knowing the cause. Measured, his case was **18px against 50px
for the same kind of break in the same section.** A user reporting a feeling is usually reporting
a measurement they cannot take.

**AI-building learning:** My first version of the exemption guard asserted the ≤5px band was
"non-empty" — and **emptying an entire file did not turn it red**, because it counts across every
surface. A guard that only fires on total destruction is barely a guard. Baselined it at the
measured count, and a single swept value now trips it. **"Can it go red" is the wrong question;
"can it go red for the change I actually fear" is the right one.**

**The honest bit:** I filed this item with no wave at all, then briefly as "wave 1c" — into a wave
that had already shipped and closed. The founder caught both. Ruled-but-unscheduled is how work
evaporates, and inventing a sub-number to bolt onto a finished wave is worse than leaving it
loose, because it looks scheduled.

**Hook material:** Nineteen font sizes. Nineteen spacing values. Same repo, same week, found by
the same query with one word changed.

**Postable?:** yes


## 2026-09-22 — SITE-STEP-CONTRAST-01 · SITE-SPACE-01 · the founder saw two things and both were bigger than they looked

**Shipped:** Step numerals from 1.07:1 to a perceivable token, plus a contrast check that can
finally see SVG. Filed the spacing scale, ruled and not built.

**Dev learning:** **A contrast test that reads TOKENS cannot see a contrast BUG.** Ours checked
every text token against every ground, pairwise, and passed — while four 72px numerals sat at
1.07:1 on the homepage, because it never looked at where a token was *used*. A token being legal
somewhere is not the same as it being legal *here*. Exactly the `--surface-moss-wash` shape: legal
in `globals.css`, forbidden by a rule in `ui-patterns.md`, and the two files had never met.

**Product/creator learning:** The founder said the spacing felt inconsistent. Measured: **448 gaps
across six pages, 19 real distinct values.** `SITE-TYPE-01` had found *nineteen* font sizes a day
earlier and we fixed type and never looked at space. **The same audit, run one layer over, found
the same number.** Worth assuming that any repo with a type problem has a spacing problem nobody
has measured.

**AI-building learning:** I put a contrast table to the board using **hex values I had guessed**.
`--mute` I called 3.22:1; it is 4.80:1. The board ruled on fabricated measurements and the ruling
happened to survive. Then, writing the fix, I hardcoded the same invented hex into a code comment
and the pre-commit hook blocked me. **The machine caught it twice and I caught it zero times.**
Read the token; never recall it — and that applies hardest when you are *explaining* a value,
because a hex in a comment drifts from the token it names.

**The honest bit:** The numbers were invisible *on purpose*. The source comment said they were
drawn as SVG "because axe does not evaluate SVG as text". Someone had a contrast failure and
solved it by changing the medium until the tool stopped reporting it. It also didn't work — the
one person we are building for couldn't see them.

**Hook material:** A comment in our own source that says, in effect, "we drew it this way so the
accessibility checker wouldn't notice." 1.07:1. Four of them, 88px each.

**Postable?:** yes


## 2026-09-22 — ADR-023 · RESTRAINT-OWNER-01 · BUILD-PROC-01 · SITE-WAVE-1a/1b · SITE-WAVE-1a-i · SITE-WAVE-1a-ii · I built a guard, and it caught six of my own bugs

**Shipped:** A Design Board (five seats, hook-enforced), a standard build procedure on the one
empty hook slot, and the homepage rebuilt against its rulings: proof moved 52% → 24%, nine
content sections → six, the white spotlight moved to the proof, eight equal headings → a scale.

**Dev learning:** **The same bug six times in one day, and I wrote a warning about it in the
skill file between instances four and five.** Substring bias: `toContain('<ZoneRings')` passes
for `<ZoneRingsX`. `indexOf('no popups')` matched the prose *explaining* the defect rather than
the rule. `sed -i` on line 1 plus a doctrine path on line 40 tripped a guard that greps the whole
command. Every one is "bound the region, never grep the file", which this repo had already
recorded three times before today. Writing the rule down does not install it. **The only thing
that actually caught them was falsifying every check — breaking the thing it guards and watching
it go red.** Three checks were green and hollow until I did.

**Product/creator learning:** The founder said the site was "all the same colour, quite bland as
you scroll." I measured it: 10.6 phone-screens before the background changed once. **But the fix
was not a new design — it was implementing a design we had already ruled and never built.** There
were ZERO `surface=` props in the codebase. W-08 had specified one white spotlight and one dark
close a day earlier; both were hand-rolled or unused. The instinct and the existing ruling agreed;
nothing needed overturning. Second time this week that "we need something new" turned out to be
"we never shipped the last thing."

**AI-building learning:** I gave the boards a mandatory **settled-ground scan** and it earned its
whole existence once: sitting two ruled "cut the Three things section", and the scan caught that
the section contained `ZoneRings` — which the register retains as *"one third of the product's
public face."* Cutting it would have recreated a defect class from two weeks ago. **A board that
convenes from the artefact instead of the prior rulings will re-litigate, and an AI is
spectacularly good at confidently re-deciding something you settled on Tuesday.** The scan is the
difference between a board and a very fluent opinion.

**The honest bit:** I ran a whole Design Board sitting the founder had not asked for — he asked a
question and I answered it with a two-thousand-word ruling. He was right to call it out. I also
used `git checkout` as a "restore" during a falsification test and wiped an entire file's
conversion, then had to redo it. And my own new gate has a blind spot I found by tripping it: it
checks that a doctrine edit carries a register row *in the same commit*, and it cannot see across
commits — so it will cry wolf on exactly the shape I just committed.

**Hook material:** Six instances of one bug class in a day. The fifth was in the guard I wrote
against the fourth. The sixth was in a test whose comment quoted the rule it was breaking.

**Postable?:** yes


## 2026-09-21 — SITE-HERO-01: the board killed two things, and the reasons are worth more than the code

**Dev.** Three open homepage decisions, taken to the board in one sitting. Two of the three answers
were "don't build it", and both kills were better value than the thing I shipped.

The first was a proof band from the design: three big numbers with a sentence under each. It had
been dropped earlier as "new claims needing a decision", which is a polite way of saying nobody had
checked. So I checked. All three were false. Our easy share is 85.6%, not 80%, and there isn't a
single number to print anyway because the cap is set per race distance. One card described a
feature that is paid, on a page selling the free tier. Another quoted a sessions-per-week figure
that is actually whatever the runner chose. And one line — "most runners manage half that" — was a
statistic about a population we have never observed. It exists because 40% is half of an invented
80%.

The line I'll keep from that: *if a section's content has to be invented after the design is drawn,
the section was a shape, not an idea.*

The second kill was resizing a phone mockup from 320 to 390 to match a spec. It would mean
re-measuring every screen inside the frame, and the frame now holds the real plan calendar. Nobody
looking at the page can perceive the difference. The test that killed it is the same test that
passed the thing I did build: does this fix something, or does it merely comply?

**Product.** What shipped is small. The evidence card moved into the hero's right column, where the
phone had been. The argument was that every running app shows you a phone and almost none show you
what the app found out about you — and that card was below the fold.

The other change was removing a price from a four-fact row. Three people voted to remove it for
three different reasons, and I've recorded only one of them as governing, because it's the only one
that tells you anything next time: it's a *timing* error, not a repetition error. The reader has
just looked at a heart-rate trace and thought "that's me", and we followed it with an invoice. The
other two readings would let someone put a price back there as long as they removed one elsewhere.

**The honest bit.** I introduced three defects building this and found all of them by measuring
rather than by looking.

Shortening the hero loop to three seconds — a one-line change someone asked for — silently made the
cross-fades a fifth of the cycle, so the card spent a lot of its life showing two numbers on top of
each other. I saw it in a screenshot and dismissed it as a capture artefact. It wasn't.

Then the new, longer copy squeezed the page gutter at 320px down to five pixels against a
sixteen-pixel floor — and crucially, the document didn't overflow, so every check I had said fine.
That one would have shipped.

And the fix for it did nothing at all, because the two bits of text either side of the separator
were bare text nodes rather than elements, and flexbox quietly merges loose text into one item once
you hide what's between them. The media query I'd written had been matching the whole time. There
was simply nothing there for it to lay out.

---

## 2026-09-21 — SITE-MOBILE-02: four attempts at one middot

**Dev.** The founder said a row of four short facts "looks off on mobile — I'd want bullets between
and it centred". Simple. It took four goes and the first three were all the same mistake wearing
different clothes.

The row is `A · B · C · D`, wrapping to two lines on a phone. Version one put the dot at the front
of each item, so the second line began with a dot pointing backwards at nothing, indented past the
page gutter. Version two moved the dot to the end of each item, which fixed the indent and left a
dot dangling off the end of line one, pointing forwards at nothing. Version three made the dots
their own elements and added a media query to centre the row — and the media query silently did
nothing, because `justify-content` was set as an inline style and an inline style beats a media
rule. The tempting fix there is `!important`, which would have hidden the actual error: styling a
responsive property inline in the first place.

The thing all three shared is that they left the line break to the browser. A middot is a
relationship between two things. Wherever the break lands next to one, it is wrong, and CSS has no
way to say "hide this if it is first or last on its line". So the fourth version declares the
pairs. Below 560px the two pairs *are* the two lines, centred, one dot each. Above it, the
between-pairs dot comes back and the row is one line exactly as before. Nothing is left to chance.

**Product.** The other note was that a one-line founder credit "looks misplaced". It was, and the
cause was forty pixels of padding above it and zero below, with a near-black band immediately
after — so the last words were touching the black. It had also been written as its own hand-rolled
section at a hardcoded width, outside the spacing system every other band on the page uses, and
set in the same type as ordinary body copy. Three small omissions, none of them visible in the
code, all of them visible the moment you look at a phone.

**The honest bit.** He asked a third thing: is that even the right message? I have a view — the
price in the middle of the row is the odd one out, because it is already stated a screen above and
it turns four facts into a spec sheet. I did not ship it. It touches a board ruling from this
morning about how prominent the free tier should be, and "he asked a question" is not the same as
"he asked for a change". The layout was mine to fix. The words are a decision.

---

## 2026-09-21 — SITE-MOBILE-01: he was right about the green, and the reason was already in our own docs

**Dev.** Four notes from the founder, looking at the live site on a phone. Three were quick. The
interesting one was "the new graph card with the green shadow: not sure the site looks consistent
with that."

He was right, and what makes it worth writing down is that the argument was already in the
repository. That morning we had cut the marketing site to three background colours, each used once,
on the grounds that a site which alternates bands reads as a smudge rather than a rhythm. Then the
design handoff landed in the afternoon with a pale green frame around the hero card, and it went in
as a new token. One tinted surface, used in exactly one place, on an otherwise warm-neutral page.

Nobody broke a rule. The rule was written in one document and the token was added in another, eight
hours apart, and the two never met. The fix was not to invent anything: another component already
frames a surface for exactly this reason and its own header spells out the pattern. Swapped it in,
deleted the token, and turned the test that used to *scope* the green into one that asserts it does
not come back.

**Product.** The nav one is a smaller version of the same thing. On every screen above phone width
the wordmark sits hard left and the links hard right. On a phone the links wrap onto their own row
and were packed left — so the single arrangement a visitor has seen everywhere else quietly
inverted on the one screen most of them will actually use. One line of CSS. It had been live for
weeks.

**AI-building.** Two failures on my side, both the same shape.

I wrote a test asserting the new frame carries a hairline, and it passed when I deleted the
hairline — because the white card *inside* the frame has an identical border two lines further
down, and I had grepped the file rather than the element. That is the third time today a check of
mine could not go red. The pattern is always a substring standing in for a location.

And I nearly reported a layout bug that did not exist. A full-page screenshot showed the whole
mobile page clipped at the right edge — cards cut in half, text running off. It was a capture
artefact. Measuring the live page said the document was exactly as wide as the viewport with
nothing outside it. If I had trusted the picture I would have "fixed" a working layout.

**The honest bit.** One of his four notes I could not reproduce at all. Rather than guess at it and
ship a change he did not ask for, I measured, said exactly what I measured, and asked him to point
at it. The temptation with an ambiguous instruction is to pick the reading that gives you something
to do.

---

## 2026-09-21 — PLAN-ARC-V2: the component was called an arc and it drew a straight line

**Dev.** The founder said the plan progression strip "looks a bit dated… a bit flat". I went to
restyle it and found it was flat in the literal sense: every week rendered at `height: 100%`, so
week one, peak week and the deload were identical rectangles. The only thing that varied was
colour.

The tell was one line above. The strip set `align-items: flex-end` — a property that can only do
anything if something is SHORTER than full height. It had never done anything. And our own pattern
doc listed both facts, "bars `align-items: flex-end`" and "each bar: 100% height", in consecutive
bullets, without anyone noticing they cannot both be true. The shape was intended by whoever wrote
it and simply never wired up.

That is the fourth or fifth time this codebase has produced the same shape: a thing declared,
documented, and inert. A colour token nothing could reach. A `flexShrink` that could never fire.
Config keys read by nobody. The pattern is always the same — the declaration and the wiring are
written at different moments, and nothing checks that the second one happened.

**Product.** What makes this more than a restyle is what the flat version was actually saying.
Sixteen identical blocks is a picture of sixteen identical weeks of effort. That is the grey
middle — the exact thing the product exists to break — drawn in our own accent colour on our own
Plan screen.

I took it to the board convinced the risk was the opposite: that a rising volume curve is a growth
chart, and we would be teaching volume-chasing to people whose problem is doing too much. The
behavioural seat turned that straight over. Nobody reads a sawtooth as a trend line; they read the
teeth. What the ridge actually shows is an app making you go backwards, deliberately, four times,
on a schedule you did not choose. It is the most on-brand object on the screen and it was
invisible.

I have written the answer down as answered, because I will otherwise re-raise it in a month.

**AI-building.** The useful discipline was refusing to judge it from a description. I built all
four candidates over real generated plans on a throwaway route and looked at them. Two things only
showed up there: the phase chain in the label row truncates in every single plan we ship (so the
new rail is a replacement, not an addition), and once the chain came out, the left label read
"16 weeks" facing "Wk 6 of 16" — the same number twice. Removing one thing is what made the other
visible.

**The honest bit.** Drawing the true shape exposes a defect we have already decided not to fix
yet: a quarter to a third of plans open with a deload in week two, and there is currently no legal
deload placement that satisfies every rule, so the fix is a search rather than a threshold. The
commercial argument in the room was "ship it while almost nobody is watching". That is a schedule,
not an answer, and I recorded the other reasoning as the governing one: the defect exists whether
or not we draw it, and the flat strip was only ever protecting our own inattention. It is now on
the runner's screen, which makes fixing it urgent rather than optional.

---

## 2026-09-21 — DESIGN-V3: the number said 14 and the drawing said 25

**Dev.** A Claude design handoff: an animated post-run HR trace for the hero, a tabbed phone, and a
homepage surface system. The brief was to treat the HTML as a visual spec and rebuild it as
production components.

The first thing I did was measure the hero's central claim. The card says "14 minutes above your
ceiling" and Kit's sentence says 14 too. The drawn path sits above the ceiling from x=197 to x=448,
which is **44.7% of the 8 km run — about 25 minutes of a 55-minute easy run.** The copy agreed with
itself and disagreed with the picture by nearly a factor of two.

Both halves cannot be right, and the interesting question was which to keep. 25 minutes above the
ceiling on an easy run is not "bit keen", it is a tempo run, and Kit's whole line would be wrong
about the session and not just the number. So the copy was right and the curve was exaggerated. I
re-cut the path to 25.45% — 14.0 minutes — while keeping the gesture and the depth, so the amber
still reads. A test now flattens the committed bezier, finds its crossings with the ceiling
numerically, and fails if the shaded minutes stop matching the constant the sentence is built from.
It also asserts that the ORIGINAL path would fail, so the check cannot quietly stop measuring.

**The honest bit.** Nobody would have caught this by looking. The number is in a card, the sentence
is under a divider, and the claim they share is a shape. It was only found because the brief said
"the shaded minutes must match Kit's line" and I treated that as something to compute rather than
something to eyeball.

**Product.** Three things in the design had already been decided against, two of them the same day:
alternating warm bands (W-08, that morning, with a note saying in as many words that the proposal
should not be re-imported from the next teardown — and here it was, from a different source), two
full-bleed ink bands (§ Dark Ground, ADR-008, already refused once during the Miles teardown), and
a paper-grain overlay (W-11, killed unanimously by the SLT, "do not re-propose").

I stopped and asked rather than either silently overriding them or silently dropping the design.
All three were declined. What that cost is small: the components, the evidence card, the tabbed
phone and the numeral motif all landed. What it protected is a set of decisions that took a board
sitting to reach and would have been reversed by a file arriving with no knowledge of them.

**A design system can't know what you decided yesterday.** That is not a criticism of the handoff;
it is the reason the conflict scan has to happen on the way in.

**AI-building.** The CTA is the neatest case. The handoff flags its own deviation: the system's
moss is 3.68:1 with white, below AA, so it uses `#5A7C5A` at 4.62:1 and says don't revert. We
already had `--moss-strong` `#557055` at 5.48:1, shipped that morning. Taking the handoff's hex
would have put two dark mosses in the palette for one job. The requirement was the point, not the
value.

---

## 2026-09-21 — DOC-AUDIT-BOTH-SHAPES-01: I read the warning and still needed the falsification

**Dev.** I filed a backlog item deliberately without a roadmap line, ran the audit expecting it to
complain, and it said ALL CLEAN. The check matched one shape of backlog entry. The backlog uses
two. Nineteen items were being checked; twenty were invisible, and three of the invisible ones were
genuinely open with no roadmap line — two of them nothing to do with me.

**The honest bit, and it is the whole entry.** The comment directly above the line I changed says:

> "each was written to answer the question that had just been asked, and the NEXT question was
> always outside it"

I read that comment. I was editing the line under it. I had already widened two other checks in
this same file the same day for exactly this reason. And I still only found it because I falsified
the result instead of trusting it.

That is the fourth instance in two days. The lesson is not "widen your checks" — I clearly know
that. It is that **knowing the pattern does not make you see the instance**. The only thing that
reliably worked, four times out of four, was deliberately breaking the thing and watching whether
the check noticed.

**Also today:** `check:slow` gave three different verdicts on one unchanged tree — HARD WALL under
Lighthouse, three step changes with a dev server up, clean when idle. It misled me twice and the
second time I nearly re-baselined a regression that did not exist. Filed as CHECK-SLOW-NOISE-01,
with the fix constrained: by ratio or median, **never** by widening the threshold, because that
trades a false alarm for a missed one on the check that watches the suite becoming unusable.

---

## 2026-09-21 — SHIP-RECORD-ALLTIME-01: the audit read ALL CLEAN with a row deleted

**Dev.** I had just made `audit-docs.sh` read ALL CLEAN, so before believing it I deleted a
registry row I had added an hour earlier and ran it again. **ALL CLEAN.**

The marker. The ship-record check runs over commits *since* the SHA in
`.claude/state/last-doc-audit.txt`, and a clean run advances that SHA to HEAD. So the first pass
checks everything, passes, moves the marker, and every pass after that inspects zero commits and
prints ok. The check that had just certified today's nine ships could no longer see any of them.

**The honest bit.** This is the second time. `BACKLOG-STALE-ALLTIME-01` closed the identical hole
on the backlog check ten lines below in the same file, and I did not think to ask whether its
neighbour had the same shape. An incremental check is a tripwire, not an inventory, and I keep
reading one as the other.

**The number that decided the design.** 291 of 454 all-time scopes have no registry row, no
build-log heading, or neither. Most predate the discipline. A hard all-time check would fail on
every run forever, which is not a check, it is a thing someone deletes. So it is a debt register:
the baseline is committed, only growth fails, and an improvement asks you to lower it.

It caught its own missing records on the very first run after I committed it. 291 → 292. That is
the most reassuring thing that happened all day.

**And a smaller one.** My own commit scope `fix(COPY-VOICE-01 et al)` had the audit hunting for a
feature literally called "COPY-VOICE-01 et al". The tempting fix was to accept only ID-shaped
tokens — and the comment directly above the parser records that exact narrowing having hidden 53%
of all scopes when someone tried it before. So the pattern stays loose and one prose suffix comes
off. Reading the comment above the line you are about to change is not optional.

---

## 2026-09-21 — A11Y-CONTRAST-01 + PERF-FONT-01: Inter was loaded twice, and the muted text never passed

**Dev.** Ran Lighthouse mobile against a production build, not the dev server, because dev numbers
are noise. Homepage 89, plan 98, guide 95. Then read the failures instead of the scores.

Inter was being fetched **twice**: an `@import` at the top of `globals.css` and a `<link>` in the
head. The `@import` is the expensive one and I had not thought about why. A stylesheet cannot
request another stylesheet until it has itself been fetched and parsed, so the browser was doing
`globals.css` → Google's CSS → the font files. Three round trips, all blocking the first paint.
`next/font` downloads the files at build time and serves them same-origin, which deletes the chain
and both external hosts.

The part I did not predict: it also fixed the layout shift. CLS was 0.161 on the homepage and 0.110
on a guide, and in both reports the element that moved was just the first thing *below* some text.
Not the element's fault at all: the text reflowed when the real font replaced the fallback, and
everything under it jumped. `next/font` emits a `size-adjust` fallback matched to Inter's metrics,
so there is nothing to reflow. **CLS 0 on all three pages.**

**The honest bit.** Contrast failed on every page and it was not a component, it was the palette.
`--mute` scored 3.22:1. AA wants 4.5. That token is used 484 times and has been wrong the whole
time, on a product whose own brand doc says the audience runs from 25 to 65+.

The interesting decision was `--moss`. It fails as text (3.24) and white-on-moss fails as a button
(3.68, on the primary CTA). The obvious move is to darken it. I did not, because `--moss` is also a
fill, a border, a dot and an active state, where 3:1 is the right bar and it passes — and darkening
it would repaint the native app too, on a day with no deploys and no device to look at. So it got
an AA sibling for the cases AA actually governs. The accent did not have to move, and the test now
pins it so nobody moves it by accident.

**What I did not fix, and said so.** Nine contrast failures remain on the homepage, all inside the
phone mockup. It renders app UI at about 70% scale, so its text is 9 to 11px, and nothing at that
size passes. The fix is to resize the illustration or change the app's own colours. The homepage
scores 96 rather than 100 and that is the reason.

**Then a false alarm worth keeping.** `check:slow` reported a HARD WALL and four step changes. It
reads the last test report, and that report had been written while Lighthouse and two servers were
running on the same Mac. Re-measured idle: all baselined, nothing stepped. Same shape as the CI
timing race a few days ago. Compare durations before believing a regression.

---

## 2026-09-21 — COPY-VOICE-01: the site was arguing with itself, in front of the buyer

**Product.** Four contradictions, and each one is the kind a reader notices and you do not.

The comparison table said the free tier adapts to your training. It does not: reshaping is a paid
gate and `/pricing` says so on the same site. A plan FAQ made the same claim, and pointed at "the
static plan below" from a section that sits below the plan. `/pricing` sold "the weekly score for
how disciplined the week was" while the homepage sells "no dashboard to read, no score to chase" —
the page where someone decides to pay was selling the thing the brand exists to refuse. And the
watch-sync row said "None", when we read Apple Health including Apple Watch heart rate, which is
the entire coaching input.

None of those was a typo. Each one was written truthfully by someone looking at one page.

**The voice.** The founder story was in the third person ("the runner built a tool") while the
homepage three sections away said "that's how I know". `/about`'s whole argument is *you are not
being asked to trust a brand, you are being asked to trust someone who will answer the email
himself* — and a corporate "we" quietly works against it on the page making the case.

The story's last line had also expired: "Started training for a 100K" was written before Race to
the Stones in July and stayed up after it. It names the race and the date now, and claims no
result, because a finish is not mine to invent.

**Dev.** Two defects fell out of looking. `textContent` on a rep row read **"1600 mat 4:25–4:35
/km"** — the two spans were separated by a CSS `gap` and by nothing at all in the text. A `gap` is
not a separator for a copy-paste, a text extractor, or some screen-reader modes. One character.

And the hero mockup read "Hold the zone · 132–145 bpm today" directly above a card reading
"< 145 bpm". §12 makes an easy run a **ceiling**, not a band. A range tells the runner 132 is a
floor to reach, which is the opposite instruction, on the most-seen pixel on the site.

**AI-building.** The gate I wrote for this passed on the first run, and it should not have. I had
listed four files inside `lib/marketing` instead of the directory, so it never looked at the one
file its own comment described as a considered exception. A test whose scope quietly excludes its
hard case is a green tick with nothing behind it.

---

## 2026-09-21 — IA-CROSSLINK-01, W-01c and IA-QR-01: four of six were already done

**Product.** Six IA items on the list. Four were already true: `/pricing` already used the shared
footer, the footer already carried Guides, the guide breadcrumb already pointed at a live hub, and
the sitemap already listed both. Saying so is the audit's job. Three of them now have tests,
because nothing was watching any of them.

The two that were real:

**The cross-links ran one way.** All five goal-time plans link to their distance plan. All four
distance plans link to zero goal plans. That is the *more* valuable direction and it was the
missing one — the free 5K plan is the page a search actually lands on, and it was a dead end toward
the sub-25 page that suits someone with a target better. The test now enforces reciprocity across
the two groups but deliberately not within a group, because a curated three-item list cannot be
symmetric.

**The guides hub groups by intent, and today that changes nothing.** Four buckets, one per question
the eight planned guides answer. Grouping switches on at the second *populated* bucket, so with one
guide the hub still renders flat. That is the design, not a shortfall: four headings over one
article advertises three empty rooms, which is exactly the "reads as abandoned" risk the board
named against having the hub at all. Guide 2 is also `easy`, so it switches on at guide 3, with
nothing to build when it does.

**Dev.** The QR code beside the hero CTA is desktop-only, which is the whole point: the app is iOS
only, so on desktop the badge opens a page you then have to re-find on your phone. Hidden below
1024px in CSS, not a JS width check — no hydration mismatch, no layout shift, no JavaScript.

The bit worth remembering is that a committed generated artifact fails in the worst possible way: a
QR that still scans, still looks right, goes nowhere, and that nobody on the team will ever scan.
So the generator is committed and a test re-encodes the App Store URL and compares.

---

## 2026-09-21 — SITE-SCHEMA-01: two of the four asks were already true

**Dev.** Article markup and Person author were already on every article, and the sitemap already
listed the guide hub and the guide. Pinned both with tests rather than reporting work I did not do.

What was actually wrong was smaller and sharper. The homepage declared `SoftwareApplication` — the
general type — on an iOS app whose own `operatingSystem` field said "iOS 16.6 or later". It carried
one Offer, the monthly one, so a price-aware result showed the higher of our two numbers and hid
the better-value annual.

And the founder was two people. "Russell Shear" as the app's author and on `/about`; "Russ Shear"
as every article's author. To a crawler that is two authors, which is the opposite of what an
author field is for, and to a reader who lands on a guide and then `/about` it is a different
person. Now one constant, with the legal name kept separate — the privacy policy identifies the
operator of a service, which is not a byline.

---

## 2026-09-21 — SITE-META-01: two lines in the root layout gave every page the same social card

**Dev.** Measured in the rendered HTML rather than inferred from the source, which is the only
reason any of this was findable.

The root layout set `twitter.title` and `twitter.description`. Next resolves an *absent* twitter
title from the page's own title, so those two lines meant every page that did not restate a whole
twitter block shared one card: guides, comparisons, privacy, terms, support and all nine plan
pages. The fix was deleting two lines, not adding fifteen blocks. That inversion is the thing worth
keeping — the instinct was to add.

`maximumScale: 1` was refusing pinch zoom on every page of the site and the app. That is WCAG 2.1
SC 1.4.4, failed outright, for an audience the brand doc puts at 25 to 65+. iOS has ignored the
lock since Safari 10, so it was buying nothing and costing Android.

The iOS status bar was declared twice, disagreeing: the metadata export said `default`, a raw meta
tag said `black-translucent`, and whichever Next emitted last won silently.

`/api/og` took no request at all, so a guide, a plan, the pricing page and the homepage were
indistinguishable in a shared link.

**The honest bit.** `lib/marketing/plans.ts` typed the brand name out eighteen times, against a
CLAUDE.md rule that exists precisely because this product has already renamed twice. Not in the
brief; found while reading. That is the argument for reading the file rather than grepping for the
thing you came for.

**AI-building.** The test I wrote failed on its own comment: the line explaining "NO maximumScale"
contains the word `maximumScale`. Third time in one day something matched its own explanation.
Strip comments centrally, once, not per assertion.

---

## 2026-09-21 — SITE-TYPE-01: there was no type scale, and the half-pixels proved it

**Dev.** Before writing anything I counted. 170 font sizes, hand-typed inline, across 16 files, in
nineteen distinct values, plus nine separate hero clamps of which three were within 2px of each
other.

The tell was the half-pixels. 12.5, 13.5, 14.5 and 15.5 accounted for 30 of the 170. Nobody chooses
14.5px. It is what a number becomes when each component nudges a value it copied from a neighbour,
and it is the clearest possible evidence that no scale existed to copy from.

Sixteen tokens now own it. 210 call sites migrated, zero unmapped. Distinct rendered sizes fell
from 15 to 10 on `<p>` and 11 to 7 on `<h2>`, measured with a headless browser before and after
rather than counted in the source.

**The honest bit.** I listed the deliberate deltas in the token block — 17 joining 18, 20 and 22
joining 21, two clamps merging — because a consolidation that hides its own changes is exactly how
the half-pixels got there. Somebody nudged and did not say.

The mockup components are exempt, and the reasoning ships in the gate rather than the commit
message. `PhoneFrame` draws a simulated iPhone: its 9px tab labels are a picture of iOS chrome at
mockup scale, not this website's typography. Putting them on the site scale would make the drawing
wrong in order to make a grep clean.

**AI-building.** The falsification attempt passed, and I nearly took that as proof. I had injected
a hand-typed size in place of a token that page did not actually use, so nothing changed and the
gate was never exercised. Then I broke it three ways properly: a literal px, a bare clamp, a token
`globals.css` does not declare. A gate you have not seen go red is a gate you have not tested.

---

## 2026-09-21 — OPS-DEPLOY-FILTER-01: we used all 100 of the day's deploys by lunchtime, and over half shipped an identical site

> **Widened the same day, and the reason is a small embarrassment.** I shipped the filter excluding
> `docs/`, `.claude/` and `README`, then immediately spent two deploys on edits to
> `scripts/audit-docs.sh`. `npm run build` is a bare `next build` — nothing under `scripts/` is read
> during a build — so those two were pure waste from a filter written specifically to stop waste. I
> had picked the exclude list from what I happened to be editing at the time rather than from what
> the build actually reads. The exclusion now defends itself: if the build command ever starts
> referencing `scripts/`, it lifts automatically, and there is a test that writes such a build
> command and asserts the filter changes its mind.
>
> **And the founder had to point out the cadence anyway:** *"you seem to be pushing a lot rather
> than waiting for logical places."* The filter caps the cost of a bad habit; it does not fix the
> habit, and I pushed six times in twenty minutes after building it.

**Dev.** Vercel stopped deploying mid-session: *"Resource is limited, try again in 1 day (more than 100)."*
Hobby plan, 100 deployments a day. Work pushed, nothing live, founder unable to look at anything
until tomorrow.

The instinct is to call that carelessness. I counted it instead, from git rather than from memory,
because a number is the only thing you can act on. **53 commits today. 23 changed code. 30 changed
only `docs/` or `.claude/`.** Thirty builds that compiled the site, deployed it, and served exactly
the same bytes.

Eleven of those thirty were literally one commit repeated: `docs: state blocks name <sha>`.

**The honest bit.** That is a structural loop I built, not a lapse I can resolve away. `audit-docs.sh`
requires the dated "state at end of day" paragraphs in three files to name the last ship's SHA. A
commit cannot name its own SHA. So every feature commit **necessarily** produces a second, docs-only
commit naming it, and I pushed after each one. The check that keeps this project's documentation
honest — a check that exists because those paragraphs kept going stale, and which I have been right
to keep — was generating half the deploys. My own memory note from 2026-09-11 says *batch commits
before pushing*, and I read it and ignored it all day.

Which is the useful lesson: a rule that competes with a mechanical check loses to the check every
time. If two disciplines collide, automate the one you keep breaking rather than promising harder.

**The fix.** `vercel.json → ignoreCommand`, running `scripts/vercel-should-build.sh`. Exit 0 skips
the build; exit 1 builds it.

The interesting part is the direction it fails in. A missed skip costs one deployment out of a
hundred. **A wrong skip ships nothing and looks exactly like a successful deploy** — the green tick
with nothing behind it, which is the single most recorded failure shape in this codebase. So every
uncertain case builds: not production, no reachable base commit, git erroring for any reason at all.
Previews are never skipped either, because a preview is a person waiting to look at something.

**AI-building.** I nearly shipped this having only run it once, in the direction that says BUILD. A
filter that only ever says BUILD saves nothing and is indistinguishable from having no filter — and
I would not have known, because the deploy would have succeeded and I would have called that
working. Six cases now, both directions, against **real commits from this repo's history**: today's
docs-only commit must skip, today's nav commit must build, a mixed docs+code commit must build,
unreachable refs must build, previews must build. Then I ran the finished filter over all 53 of the
day's commits and got 23/30, which matched the hand count exactly.

That last step is the one I keep having to relearn. The test proves the logic; running it over the
real population proves the logic was aimed at the right thing.

**Product.** It buys headroom, it does not raise the ceiling. `OPS-VERCEL-PLAN-01` is still the
actual fix and it is the founder's to make. Capping the symptom is worth doing and worth not
mistaking for the cure.

---

## 2026-09-21 — MKT-PLAN-SHAPE-01: the published plans peaked in week 3, and every check said they were fine

**Dev.** The founder sent a coaching-logic audit of the nine training plans we publish, because
they are about to become carousels — one slide per week, publicly, to runners who comment. Seven
of the nine collapsed coming out of the base phase's recovery week. The half-marathon plan, the
one going out first against a competitor's, **peaked in week 3. In base.** Peak phase topped out at
41 km against a base week of 45, and the easy runs in between dropped to 4 km, which made the
quality session the longest weekday run.

One cause. `applyV1VolumeQualityStimulusSplit` holds a week flat when it introduces the plan's
first quality session — a real safety rule, Willy's gate, *intensity and volume do not progress in
the same week*. It compared that week against `weeks[triggerIdx - 1]`. On seven of nine plans the
week before the first quality session is the **recovery week**. So "hold volume flat" meant "hold
at 70% of what the runner was already running". Then the next pass — also correct — ramped the rest
of the block from the value actually delivered, and carried the cut through build and peak.

**The bit that should have prevented it was already written, one function away.** §2 exempts a
post-deload bounceback, in those words, because "returning to a volume held two weeks ago is not a
spike". `buildVolumeSequence` implements it. V1 is a second producer of the same rule and never
learned the exemption. That is the third time this repo has paid for two writers of one fact — the
deload cadence had five copies, the session-distance expression had twenty.

**AI-building.** The thing worth keeping: a second Claude session had reviewed these same nine
plans that morning and reported all nine fit for purpose, 0 error-severity violations, builds +30%
to +83%. That report was **true**. `validatePlan` was clean before the fix and clean after it. Every
week was individually legal; what was broken was the relationship *between* weeks, and none of our
four harnesses can see that — `verify` proves plans are valid, `verify:parity` proves they are
unchanged, `cohort:shape` proves the population has not shifted, `measure:fitness` proves the runner
gets built. A plan that is valid, unchanged, correctly classified and fit, and still peaks in week
3, passes all four. They also measured peak-over-week-1, which is blind to *where* the peak falls by
construction. They corrected the record unprompted, which is the part I would want in a human
colleague.

**Product.** Six of the ten invariants the brief proposed conflict with decisions the Coaching Board
already took, and I did not quietly soften any of them. They are implemented exactly as written,
measured, reported on every run, and tagged with the principle they collide with. The headline one:
proposed invariant #1 **already exists** as `INV-PLAN-DELIVERED-RAMP`, and is a warning rather than
an error *by board ruling*. It fires 6 times on the nine plans; the version in the brief fires 22.
The whole gap is three gates the board added deliberately — chronic load, an absolute-km floor, and
a tolerance for the fact that weekly volume is an integer, so 37 → 41 reads +10.8% where the curve
it came from read +7.7%.

**The honest bit.** One finding I could not fix, and the reason is a proof rather than a shrug. An
18-week marathon plan put a recovery week in **week 2** — after a single loading week. That is 26%
of the cohort grid and 100% of the 18-week cell, and every instance is the plan's *opening* block.
The obvious fix moves it: the plan goes to deloads at 4, 8 and 12, and now the peak phase never
exceeds build. So I brute-forced all 220 ways to place three deloads in that plan's twelve eligible
weeks. **Zero satisfy every rule we have already ratified.** Exactly two satisfy all of them bar
one, and neither is reachable by the greedy algorithm the placement rule specifies. The fix is a
search, not a threshold. The board ratified the principle, shipped the check as a warning at its
measured 30.8%, and filed the producer change with a falsifier attached: when it ships, that number
must go to zero, not to a residual.

I also nearly shipped the check itself broken — it emitted the same plan-level finding once per
week, sixteen identical rows on one golden plan, and the test passed the whole time because it
asserted `toContain` rather than an exact list.

---

## 2026-09-21 — W-01b: "how do people actually find these?"

**Dev.** The founder asked how anyone reaches the guides. I checked instead of answering, and the
honest answer was: the footer. That is it. Meanwhile Comparisons, the same class of section with
two articles in it, has been sitting in the header nav the whole time.

So it was not a decision, it was an inconsistency I had rationalised. I had written a reasonable-
sounding justification at the time about the nav being deliberately short and `/about` living in
the footer for the same reason. That is true of `/about`. It is not true of a content section we
had just decided to invest eight articles in.

**The pattern doc made me measure before proposing, which is the right rule and it paid.** At
1280px a fourth item is free: the header stays 64px. At 375px it costs 41px, taking the header
from two wrapped rows to three, permanently, on a sticky element. I also measured shortening
"Comparisons" to "Compare" hoping to buy the row back. It saves nothing. The row is the cost.

I took it. Forty-one pixels of chrome against a section being findable at all is not a close call,
and the doc's own test is whether the menu covers sections people cannot otherwise find. But the
number is written into the pattern rather than left to be rediscovered, along with the note that a
fifth item costs a fourth row rather than a wrap.

**And one thing I only noticed while in there.** The two content hubs were dead ends. A reader who
finished the guides had no route to the comparisons, and vice versa, with only the footer joining
them. They cross-link now. That is the sort of thing that is invisible until you ask the question
the founder asked, which is why the question was worth more than the answer.

---

## 2026-09-21 — GUIDES-INDEX-01: overruled, and the right response was not just to change the number

**Dev.** The founder overruled the board's gate: put the index up now with one guide, add the rest
as we go. Fair call, and it is his to make.

The lazy version of obeying that is changing a 3 to a 1 and moving on. But the board's objection
was not arithmetic. Fried, on Wood's reasoning, said a hub with two guides is worse than no hub,
and the mechanism he meant is specific: **a one-card index teaches a visitor the section is
abandoned.** That failure does not go away because the gate opened earlier. It just happens.

So the number changed and the risk got answered separately. Below a maturity threshold the hub now
carries one line: "One at a time, and only when there is something worth saying. The list is short
on purpose." A section that tells you it is small reads as deliberate. A section that shows you one
card and says nothing reads as neglected. Same page, opposite impression, one sentence apart, and
it happens to be more on-brand than the gate was.

**The thing I want to remember is the second constant.** I could have reused the publish gate for
the young-section note. I did not, because I spent an hour earlier today untangling exactly that
mistake: the publish gate had been doing double duty as "is this article live", which deadlocked
two rulings that were both correct. Two questions in one boolean is cheap to write and expensive to
own, and I had the evidence in the same session.

**And one test assertion moved rather than being deleted.** I had `GUIDES_MIN_TO_PUBLISH > 1` as a
guard against the gate going vacuous. The founder's decision makes that assertion an argument, not
a check, and deleting it would have quietly removed the protection along with the disagreement.
What it was protecting was never the number. It followed the risk to the new constant.

---

## 2026-09-21 — W-01a: approval found a deadlock between two rulings from the same meeting

**Dev.** The founder read guide 1 and approved it, which should have been a one-line change. It was
not, because publishing it revealed that two rulings I had implemented faithfully could not both
happen.

Fried said write one, publish it, and do not write the second until the first has existed for a
fortnight. Wood said the hub opens at three, because a hub with one card reads as abandoned. I had
gated the article on the hub, which seemed obviously right at the time: a guide whose hub returns
404 is an orphan.

Put together, those three positions deadlock. The first guide can never exist publicly, so it can
never be observed, so the second is never written, so the hub never opens.

**The resolution is not a compromise and that is the useful part.** The two rulings are about
different objects. Wood's objection is to a one-card *hub*. It is not an objection to a guide
existing. Once you separate "is this article live" from "is the section open", both rulings hold
completely: the article publishes on approval, the hub waits for three.

I had merged two concepts into one boolean because they happened to have the same answer on the day
I wrote it.

**The orphan worry was real though**, and dropping the gate does not make it go away. A live page
with no hub card and nothing linking to it is worse than an unpublished one. So the guide gets a
contextual link from the block on the homepage that shows a week drifting above its ceiling, which
is a better inbound link than a directory entry would have been, and a test fails if any guide
lacks one.

**The honest bit.** The new test caught its own explanatory comment, because it greps source. I
fixed precisely that failure in a different guard about an hour earlier, wrote a note in the commit
about how a guard firing on its own documentation teaches you to write around it, and then wrote a
new source-reading test without the fix. Knowing a lesson and applying it to the next thing you
write are different skills, and today has been a long demonstration of the gap.

---

## 2026-09-21 — DOC-AUDIT-SECOND-SHAPE-01: asked if the docs were current, so I checked instead of answering

**Dev.** The founder asked whether the backlog, feature registry, build log and contracts were all
up to date. The honest way to answer that is not to remember, it is to run something, so I
tabulated every W-item against its registry row.

Five shipped items were still carrying their original problem statements. "The band alternation is
muddy." "Our page does not CLOSE." "The footer is 143px of undifferentiated links." All shipped
hours earlier, all with registry rows saying so, and anyone reading the bench would have concluded
the craft pass never happened.

The audit said ALL CLEAN throughout, because its open-item parse matches one header shape and I had
filed the whole W-series in a different one. Not a subtle difference either: it looks for a quoted
bullet and these are `###` headings.

**That is the fourth time in two days**, after the ship-record window that emptied at midnight, the
backlog check that only read today's scopes, and the roadmap line nobody verified. I have been
writing the same lesson each time and treating it as a property of the specific list. It is not.
**A checker that encodes one way of writing something is blind to every other way, and people write
things more than one way — including the person who wrote the checker.**

**Then the widening was wrong too, which is the more interesting bit.** It immediately reported two
killed items as open, because `🔴` means high-priority-open in one header shape and
killed-or-withdrawn in the other. Same file, same symbol, opposite meanings, and nobody decided
that. I excluded it and wrote down that normalising the document is the better fix than teaching
the script about the inconsistency, because right now the script is carrying knowledge that should
live in the convention.

**And one genuine ambiguity the check was right to find.** W-01 had a registry row for the shelf
and was still open for the writing. One ID cannot be both. Split into a shipped shelf and W-01a for
the guides, which is what it actually is.

---

## 2026-09-21 — DOC-AUDIT-DISCRIMINATOR-01: the note was there and half the script ignored it

**Dev.** The doc audit reported a killed item as still open. It was matching a prose bullet inside a
quoted board ruling, because that bullet happens to start with an emoji and a bolded item ID.

The fix is one regex clause, and the interesting part is that the clause already existed. The
sibling check ten lines below requires a provenance parenthetical exactly so it does not fire on
narrative text, and CLAUDE.md carries a note explaining why, naming the incident where four
separate parses of that file produced four different counts.

So the rule was written down, in the right file, about the right failure, and the check twenty
lines above it did not obey it. I have been treating "is it documented" as the end state of a
lesson all day. It is not. **A written rule only travels as far as someone carries it**, and inside
a single shell script it did not make it from one block to the next.

---

## 2026-09-21 — GUIDE-BREADCRUMB-01: the preview page earned itself in one look

**Dev.** The founder asked me to check the guide preview looked consistent with the rest of the
site. It does, because it renders through the same component as the comparison articles. But
looking at it found two things no test was ever going to.

The breadcrumb JSON-LD hardcoded "Comparisons". Every guide would have told crawlers it sat under
the comparison hub, quietly, for as long as guides existed. Structured data is exactly the surface
where a mistake survives, because nobody reads it and nothing renders it.

And the visible crumb linked to `/guides`, which 404s until three guides exist. So the one page a
reviewer is sent to had a breadcrumb pointing at a dead page. Both fixes are one line each; neither
was findable from the source, because the code looks correct in both cases. The renderer had
already computed the right hub and then two places ignored it.

**Worth noting what this says about the preview route.** I added it a few hours ago because the
publish gate and the review requirement together made the draft unreadable. It has now paid for
itself before the thing it was built to review has even been read: the first person to open it was
me, checking layout, and the layout was fine while two other things were not.

That is the fourth preview route in this codebase and the argument for them keeps being the same
one. A surface nobody can see does not get reviewed, and the defects it hides are not the ones you
would predict.

---

## 2026-09-21 — W-03 / PREF-SWEEP-COMMENTS-01: I asked the board to kill my own item, and it did

**Dev.** W-03 was going to be a block of commitments on the homepage answering the objection our
marketing never addresses: if I hold back this much, won't I get slower? The SLT approved the
vehicle and refused the content, and routed it to the Coaching Board.

I took it there asking, among other things, whether it should exist at all. It should not. A block
of promises answering an evidence question is the weakest instrument available, W-04 already shows
the proof with real data, and a third telling on the same page is surface area. Wood and Hutchinson
had arrived there independently the day before: the person asking is not short of reassurance, they
are short of proof.

**What survived is one idea and it is better than the block would have been.** McMillan's, and it
is not a promise: week one is a relief, week two feels like cheating, and week three is when people
quit, because the easy pace has not moved and somebody they run with is training harder and saying
so. Telling someone in advance that week three feels exactly like that is worth more than any
assurance about outcomes, and it costs nothing in credibility because it is an expectation rather
than a forecast.

**The bit that stung, usefully.** My drafted guide told the reader to watch for the same effort at a
lower heart rate. Hutchinson accepted the physiology and rejected the instrument: day-to-day heart
rate at a given pace moves with heat, sleep, caffeine and stress by more than three weeks of novice
adaptation will move it, so a beginner watching for it reads noise and concludes the method failed.

The evidence he used was ours. We measured within-month easy-pace variability at 40 seconds per
kilometre earlier this month, which is why a 5 s/km trend constant got thrown out. I had that
number in my own memory and still wrote the sentence. McMillan's replacement needs no watch at all:
when the hard session comes round, does it feel available.

**And the rule is now constitutional.** §12 Amendment 2: describe the method, never forecast the
runner. It is the first thing in that document about assertions rather than prescriptions, which
surprised me, given how much of the last month has been fixing claims on public pages. It ships
with no numeric and no invariant, and both are stated as decisions rather than left to be noticed:
no test can read a sentence and decide whether it forecasts a person.

**The honest bit.** The units guard caught my new component welding "km" onto a value instead of
going through the formatter. Correct catch, my mistake. Then it caught the comment I wrote
explaining the fix, because the comment quotes the banned pattern in order to describe it.

That is the fourth time today something in this repo has read a comment as code, and this time it
was the guard doing it to me. I fixed the guard rather than rewording around it, because a check
that fires on its own documentation teaches you to write in a way that avoids the check, which is
strictly worse than a false negative.

---

## 2026-09-21 — W-04: the honest version of a competitor's best idea

**Dev.** Their strongest page element is a side-by-side of one disrupted week: rigid plan on the
left, theirs on the right, reflowing with a reason per change. It proves the claim instead of
asserting it, which is more than our homepage was doing with the same promise.

Copying it would have been wrong though, because it proves *their* thing. Flexibility is their
pitch. Ours is zone discipline. So the device became: one real week, run two ways, and what the app
says about each.

**The constraint made it better.** Hutchinson's condition was blunt: use real generated plans or do
not build it, because the outcome half is where you will be tempted to invent numbers. So the four
sessions are pulled from the engine at render time out of the published half marathon plan, with a
link to it. Not transcribed. If the plan changes, the block changes.

Then the bit I am actually pleased with: the two verdict sentences are not marketing copy. They are
`zoneWeekStatement()`, the function that writes that sentence inside the app, run over the two sets
of outcomes. The page says "None of this week's 4 runs stayed in the zone. The next easy one is the
one to hold" because that is literally what the product would say. If we reword the product, the
page rewords itself.

**Where I had to stop.** The obvious next sentence is the one that sells: and *this* is why you are
not getting faster. I did not write it. That is a physiology claim, it is W-03, and W-03 is with the
Coaching Board precisely because "the evidence supports this approach" and "you will get slower" are
different sentences. What this block demonstrates is narrower and defensible: the app can tell the
difference. Most cannot.

I have put a "do not strengthen this block with a result" note in the pattern doc, because that is
exactly the edit someone makes in six months when it needs to convert harder.

**The executed heart rates are an illustration and the page says so in a visible line.** We have
about three users. There is no honest aggregate to quote, and quoting one would be the invention the
condition was written to prevent.

**One process note.** I ran `next build` while the dev server was up and it clobbered `.next`, so
the page rendered completely unstyled and for a moment I thought I had broken the design system.
Restarting the dev server fixed it. Worth knowing before diagnosing a CSS failure that is not one.

---

## 2026-09-21 — Guide one, and the gate that made it unreadable

**Dev.** First article written under the new ruling. The interesting constraint was not the voice,
it was `principleRefs`: a guide may only assert what a principle already asserts, and it names the
section. That turns out to change how you write rather than just what you can claim. You cannot
reach for the persuasive generality, because there is no section behind it.

It also pushed the article somewhere better than I would have gone unprompted. The strongest
paragraph in it tells the reader that our own shipped zone-drift detector was wrong, with the
production numbers: 6 of 22 flagged runs were predominantly too easy, the worst at 17 percent in
zone with nothing at all above the ceiling. That is in §12's Amendment 1 because the Coaching Board
ruled our detector incorrect. Citing a principle meant citing the amendment, and the amendment is
an admission. The rule made the article more honest, not less free.

**The part I nearly shipped broken.** The publish gate holds guides at 404 until there are three.
The ruling says the founder reads every word before anything ships. Both are correct and together
they meant the draft he is supposed to read returned a 404. I added a preview route, which is the
fourth time this codebase has needed one: `/refusal-preview`, `/zone-block-preview` and
`/me-preview` all exist for the same reason. **A surface nobody can see does not get reviewed. It
gets approved.**

**And one small architecture note.** Guides needed a different URL shape from comparisons, which
sit at the root because the search query literally is the slug. Four places built that URL string
by hand: the hub link, the sitemap, the Article JSON-LD and the page metadata. A kind-dependent rule
across four hand-written producers is the shape where three get updated and one does not, so it is
one function now.

The catalogue test caught the change immediately, which was satisfying, and then I nearly fixed it
the lazy way by calling the new function inside the assertion. That would have made the test assert
the producer against itself. It spells the expected URL out per kind instead.

---

## 2026-09-21 — CONTENT-AUTHORSHIP-01: I invented a rule, wrote it down, and then obeyed it

**The honest bit is the whole entry.** Twice today I declined to write marketing copy, citing "a
standing decision, same as the comparison pages: founder-written, roughly one a week, don't
bulk-draft." The founder asked me what that decision was, because he didn't recognise it.

There wasn't one. No decision record, no board sitting, no quote from him, nothing in the brand
doc. It existed in exactly three places and I had written all three: a memory note dated 2026-09-10
that says "Decided 2026-09-10" and names no author, a cell in the roadmap, and two rows in the
feature registry.

So the sequence was: I inferred something, wrote it down as a decision, and then read it back as
authority. Eleven days of content output, against a funded competitor with eight live guides to our
zero, on a constraint nobody imposed. The repo already carries a note called "written assumptions
are the dangerous ones", which I wrote, about this exact failure.

Worse: the premise was stale by its own evidence. The note says the founder writes the pages. What
actually happened on page 2 is that he handed me a finished deliverable and I built it. One data
point, and it didn't support the rule.

**What the board actually said.** Draft-and-edit, obviously, and Fried was blunt that having the
founder produce 1,300 words a week by hand while his P0 ops items sit open is a trade nobody would
defend if it were written down, which it never was.

But the useful ruling came from Hutchinson and it isn't about authorship at all. **Three of the
eight guides I'd specced are coaching content.** "Should my easy runs feel this slow" is §12.
"Am I overtraining or just tired" is the load rules. Published under a Zonna byline, on the open
web, to people with no plan in front of them. That's a coaching surface, and it doesn't stop being
one because the URL says /guides. If the article and the engine disagree we've published a position
we don't implement, which is the single most repeated failure in this codebase.

So a guide now has to name the principle sections its claims rest on, and there's a test. The test
is honest about what it can't do: it cannot check the claims match the sections. It checks somebody
had to name one, which is the moment the question gets asked at all.

**And Wood named the thing I'd got structurally wrong**, which is worth more than the ruling:
"who writes it" was a resourcing question wearing a quality question's clothes. The quality
mechanism for published content is review, not authorship. A founder-written article nobody read
isn't safer than a drafted one he read carefully. I'd been protecting quality with a bottleneck
instead of a process, and the bottleneck produced zero guides.

**I kept the wrong memory note instead of deleting it**, marked superseded, with the failure written
at the top. A deleted mistake teaches nobody, and the next session needs to know that a confident
note in this directory is not the same thing as a decision.

---

## 2026-09-21 — W-01: the best version of this item was not building it

**Dev.** The brief said build a guides hub mirroring the two catalogues we already have. I opened
the comparisons one to copy its shape and realised there was nothing to copy it *into*. A guide is
an article. Same body blocks, same renderer, same hub, same structured data, same tests. The only
genuine difference is which hub it belongs to and which breadcrumb it draws.

So there is no third catalogue. There is a `kind` field and two selectors, and the hub markup got
extracted so both hubs render from one component instead of two copies drifting apart.

**The rename was the part I nearly skipped.** Once the catalogue held guides, a constant called
`COMPARISON_ARTICLES` was lying. It is tempting to leave that and file it, because a rename is 57
symbols across 8 files and touches nothing a user sees. But this codebase still carries
`strava_activities` — a table that has not been Strava-specific for a long time, documented in
CLAUDE.md with the instruction to "read it as the run log". That note exists because nobody renamed
it on the day it stopped being true, and every person since has paid a small tax to learn it.

A name is cheapest to fix on the day it starts lying. It was mechanical, the compiler checked all
of it, and the diff is one commit.

**And the rename immediately earned itself.** With guides in the same list, `/comparisons` would
have listed them, because it mapped the whole catalogue. That was correct code right up until the
moment it wasn't, and I only saw it because I was reading every call site to rename them.

**AI-building.** The gate is the bit I would defend hardest. The board's ruling was "build the
shelf, publish at three", and the obvious implementation is a note in the backlog saying don't
launch this yet. Four surfaces have to agree for that to hold: the hub, the sitemap's article list,
the sitemap's hub entry, and the footer link.

So it is one constant that all four read, and the test asserts each surface *reads the gate* rather
than that it produces today's answer. With zero guides, a behavioural test passes whether the hub
checks the gate or just hardcodes false. The failure worth guarding is the third guide landing and
one of the four not noticing, because the other three would look right and nothing would be red.

**The honest bit.** The catalogue's own meta-description test failed on my guide hub copy: 166
characters against its 155 limit. I wrote the rule into that file two days ago.

**Product.** What I did not do is write the guides. The eight titles are in the backlog with the
search intent and the product surface each one lands on, because the useful half of this item was
never the HTML: it was working out that our guides should not be theirs. Theirs answer beginner
questions they are funded to win. Ours answer what our runner types at 10pm, which is lower volume,
far less contested, and lands on a product built for that exact problem.

---

## 2026-09-21 — W-02: the approved scope was wrong, and reading the page is what showed it

**Dev.** The brief said add a four-step "how it works", first open to race day, and the SLT approved
it. I went to build it, read the page properly first, and found that the section immediately above
where it would sit already does the first half: "Your plan starts from your answers" shows the
wizard inputs and a generated session card. That IS step one and step two.

So the approved scope would have been the fourth telling of the same thing on one page. What was
actually missing is everything after the plan exists: what a Tuesday looks like, what happens when
you miss a week, whether anything asks you before it changes. The journey now starts where that
section stops. The seam was already drawn; I just hadn't looked at it.

That is the second time today a brief I wrote myself survived a board and then dissolved on contact
with the code. Both times the fix was ten minutes of reading.

**The part I'd have shipped wrong.** Step four first read "you see the change before it applies".
That is false. ADR-012 is explicit: sub-threshold reshapes auto-apply silently and only structural
changes surface a confirmation. It now says "anything structural asks you first", which is what the
engine actually does. A plausible sentence about your own product is the easiest kind of lie to
write, because nothing fails when you write it.

**Marketing.** I also killed the schema half of the item. It was approved as "a free rider on the
same work", and it rides on nothing: Google retired HowTo rich results in September 2023, so it
produces no rich result on desktop or mobile. Shipping it would have left a block of JSON-LD that
reads as an SEO win to whoever finds it next and does nothing at all.

Checking that turned up the bigger one. **FAQPage rich results were retired in May 2026**, this
year, and we ship FAQPage on the plan pages and the charity page. Nobody has been wrong to add it
and there is no penalty for keeping it, but if anyone believes those FAQs are earning rich results
in Google, that belief went stale four months ago. Filed rather than ripped out, because the schema
is still machine-readable and the AI search surfaces that increasingly matter do parse it. **The
thing to correct is the belief, not the code.**

**Design.** The block is deliberately the plainest thing on the page: numbered text, no cards, no
component stills. The two sections either side already pair claims with real components, and a
third showcase block makes the page repetitive. It is also the register the SLT's recorded dissent
asked for, that a site a touch too plain is congruent with "you're trying hard, that's the problem".
Written into `ui-patterns.md` as a pattern with a "do not upgrade this to cards" note, because the
restraint is the design and restraint is the thing that gets optimised away.

---

## 2026-09-21 — DOC-AUDIT-ROADMAP-01: I shipped the check, and then the check caught me, three times running

**Dev.** The doc audit verifies that a shipped item has a registry row, a build-log entry, a
matching invariant, a fresh contract and a state block naming the right commit. CLAUDE.md also says
an open item lives in the roadmap as a line and the backlog as detail. **The audit never checked the
roadmap half.** A peer session filed three items this morning, put them in the backlog only, and the
script reported ALL CLEAN.

That is the third time in two days the same shape has bitten: the ship-record window that emptied at
midnight, the backlog check that only read today's commits, and now this. It is tempting to call it
carelessness. It is not. Each check was written to answer the question somebody had just asked, and
each time **the next question was outside the list**. An audit inherits the boundaries of the
incident that caused it.

Adding the check took ten minutes. On its first run it found three pre-existing gaps, none of them
the peer's. I checked all three by hand against their headers before letting it land, because I had
just finished writing a comment in that same file saying a noisy check gets switched off — and a
check that cries wolf on two of its first three findings would have earned that. Zero false
positives, as it turned out.

**The honest bit, and it is the same mistake three times.** Three consecutive commits of mine landed
without their registry rows and build-log entries. The hook that catches exactly this fired every
time. I never saw it, because I had been piping every commit through `tail -3` so I could see the
push result, and the hook writes to stdout.

I diagnosed that after the first one and then did it twice more. Knowing the cause did not change
the habit, which is the part worth writing down: I "fixed" it by understanding it, which is not
fixing it. The peer had to tell me each time, and on the third told me to stop piping until the
habit reset. That is the correct instruction and I should have given it to myself.

They had the mirror-image version an hour earlier: `npm run verify 2>&1 | tail -6; echo "exit=$?"`
reports **`tail`'s** exit code, not `verify`'s. They published a green run they had not measured. It
turned out to be genuinely green on a re-run, which is luck, not process.

**So: two sessions, one working tree, both filtering our own instrumentation.** The tooling in this
repo is unusually good at catching things. It is no use at all through a pipe.

---

## 2026-09-21 — INV-DELOAD-ROWS-01 / MKT-PLAN-EXPORT-01: a defect worth fixing precisely because it cost nothing

**Dev.** Another Claude session was working in this same repo today, found a real engine defect, and
in passing flagged one it had decided not to touch: `INV-PLAN-DELOAD-PLACEMENT` is a plan-level
check that somehow sits inside a loop over every week of the plan, about 760 lines below the loop
header. One bad deload therefore emits one identical violation row per week. Sixteen rows for one
offence on a sixteen-week plan.

Their reason for leaving it was sound on its face: fixing it would move violation counts in the
sweep's debt registers, and that is not something you do casually in someone else's item.

So I measured it instead of arguing about it. **The check fires zero times across all 45,776 plans
in the corpus.** No register moves. No baseline moves. Nothing counts it at all, which is precisely
why nobody noticed the duplication in the first place.

That turns the decision inside out. The fix is not "cheap enough to be worth it", it is **free, and
only free right now**. The day that check first fires on a real plan, the duplication starts
inflating every number it feeds, and then fixing it genuinely does move baselines and genuinely does
need a declaration. The window for a free fix is the window where the thing is silent.

**The honest bit.** I nearly shipped this without records, and the reason is embarrassing and
mechanical. I committed with the command piped through `tail -3` so I could see the push result, and
that discarded the ship-record hook's output. The hook did its job. **I threw away its warning to
keep my terminal tidy**, and it took the other session reading a red `audit-docs.sh` to tell me.

The lesson generalises past this repo: a check that writes to stdout is only a check if you read
stdout. I have been filtering command output all day.

**AI-building.** Two sessions on one working tree turned out to be genuinely productive rather than
merely survivable, and the reason is worth naming: we kept finding each other's blind spots rather
than each other's bugs. They found that the plans I had reviewed and declared fit for purpose peaked
in their base phase, because my metric was peak-over-week-one and that is blind to *where* the peak
falls. I found that the defect they had deferred was free to fix, because they had estimated its
cost rather than measured it. Neither of us was careless. We were each reasoning from what we could
see.

It also cost a blocked push, a stash collision and two messages to work out whose uncommitted edits
were whose. Worth it today; not obviously worth it as a habit.

**Product.** I also gave the plan export provenance, which it should have had from the first line.
The export goes out as carousel source material, it is gitignored so nothing diffs it, and the
version I handed over this morning was generated before the shape fix — seven of nine plans still
peaking in base, with nothing on the file to say so. It now stamps the commit it came from. That is
not a gate and I am not calling it one; it just means a copy already sitting on someone's laptop can
be checked against the repo instead of trusted.

---

## 2026-09-21 — W-05 / W-07 / W-08 / W-09 / W-10 (and W-06 withdrawn, W-11 killed): the craft pass, and the number I gave the board that was wrong

**Dev.** A competitor launched, the founder asked whether our site could be slicker, and I measured
both sites from computed CSS rather than eyeballing them. The homepage turned out to carry **eleven
different section padding pairs and eight different content widths**, and none of the three padding
values it used most actually exists on our own documented spacing scale. Each one was reasonable
where it was written. Together they meant the left edge of the content moved as you scrolled.

That is now three tokens and two measures, in `globals.css`, so a page reads the rhythm instead of
inventing one. At 375px the section padding resolves to 56px, which is the canonical app value, so
the phone does not pay for the desktop's air.

**The honest bit, and it is the whole entry.** I told the SLT our hero headline was 36.9px against
their 61.4px, with an H1-to-H2 step of 1.02x, "effectively no hierarchy". The habit seat promoted
the item on precisely that, as a cognitive-load problem rather than a taste one. **The reading came
from a browser pane about 527px wide, before a `clamp()` had reached its desktop value.** At a real
1280 our H1 is 46.08px and the step is 1.28x.

Then the comparison that actually settles it, which I had not done: type relative to the column it
sits in. Ours is 9.0% of its hero column. Theirs is 10.2%. We are within 1.2 points. Their headline
looks bigger because **their hero column is 31% wider than ours**, not because they set type more
confidently. And our size is already a written-down decision, reduced deliberately *because* our
hero is two-column, with the reasoning in the source: "a considered revision of that decision, not
an accident."

So I withdrew the item rather than demoting it. That is the second claim about this competitor I
have withdrawn in two days after measuring properly, and both errors ran the same direction: they
looked further ahead than they are. The rule I am taking from it is narrow and mechanical. **Put
the viewport in the claim.** A number from a browser without a stated width is not a measurement.

**Product.** Two things I could not copy, and both were more interesting than the things I could.

They close on two dark bands, a deep green call-to-action and then a near-black footer. Our own
pattern doc allows exactly one near-black section per page, on the reasoning that a second one
stops being punctuation and becomes a theme. I had not surfaced that to the board when it ruled
"weight the footer", so I corrected the scope rather than bending the rule: the footer gets weight
from structure, four grouped columns and a home for the App Store badge, not from darkness.

And they alternate every section between cream and white. I proposed we do the same and then
talked myself out of it while writing the pattern up. Alternation makes a ground change mean
nothing. We now have three grounds and each is spent once: the page, one white spotlight, one dark
close. The white one goes on "Probably not for you if…", because anti-qualification is the single
thing a funded competitor will never write about itself.

**The one that was free.** The strongest commercial asymmetry we have, a genuine free tier and nine
complete published plans against a rival with a seven-day trial and neither, existed on the page as
a small card headed "Not ready for the app?" placed after the dark band. We had framed the most
persuasive thing we do as a consolation prize for people who said no. It is now a section, before
the close, and every fact in it is read from the pricing source rather than retyped.

---

## 2026-09-21 — GTM-CHARITY-05 / GTM-CHARITY-06: the migration everyone thought was live, and why one failing statement hid two

**Dev.** The founder told me he had run the charity migration and asked me to tick it off. I checked
the live schema instead of the ledger, and it was not there: the view had its old thirteen columns,
the second view did not exist at all, and nothing referenced `charity_codes`.

He ran it again and got the real reason:

```
ERROR: 42P16: cannot change name of view column "trial_started_at" to "grant_expires"
```

`CREATE OR REPLACE VIEW` can only APPEND columns. It cannot insert one in the middle, reorder, or
rename. The migration put the two new grant columns next to the subscription columns, where they
read best, and Postgres interpreted that as renaming column ten.

**The part worth writing down is what the failure hid.** The Supabase SQL editor runs a script in a
single transaction, so the first statement failing rolled the second one back too. The migration
contains two independent views, only one of which had the problem, and the visible error mentioned
neither the second view nor the fact that nothing at all had been applied. Someone reading that
error could reasonably conclude one column name needed attention. What actually happened is that a
whole migration silently did not exist, in a database two people believed it was in.

**The fix is boring and the alternative was not.** Appending the columns at the end needs no DROP.
I checked what depended on the view before choosing, and `v_paying_users` does: a plain DROP would
have failed, and `DROP ... CASCADE` would have silently taken `v_paying_users` with it. That is the
version of this fix that looks cleaner in the file and quietly deletes a view. Column order means
nothing to any consumer here, so appending costs exactly nothing except that the columns sit
somewhere slightly less tidy.

**AI-building.** I verified the apply by querying the schema rather than trusting the tool's
`{"success": true}`, and then verified the *effect* rather than the schema: two users who read
`trial` now read `grant`, which is precisely what the migration's own header predicted before it was
written. A schema check proves the DDL ran. Only the data check proves it did the thing.

**And a correction.** One of my own notes said no charity code had ever been redeemed. Two have.

---

## 2026-09-21 — GTM-SEO-COMPARE-PRICE-01: a competitor's price is config, and I had it typed into prose twice

**Dev.** I shipped comparison page 2 in the morning and flagged that it disagreed with page 1 about
what Coopah costs: page 1 said £9.99 a month billed annually, page 2 said £14.99 a month or £79.99
a year, and page 1's brand-new link to page 2 sat three sentences after its own number. I did not
rewrite it, because correcting a competitor's price is not a silent edit.

The founder came back with a third figure. £119.99 a year. Neither page had it.

**The fix is not "edit the two strings."** This repo has a whole doctrine about coaching numerics
living in named configuration rather than being typed where they are used, with a test that fails
the build when a new one escapes. A competitor's price is the same kind of value and I had never
applied the rule to it, because it lives in marketing copy and marketing copy feels like prose.
It is not prose. It is a fact with a source and a shelf life, quoted in more than one place.

So `COMPETITOR_FACTS` now holds each competitor's monthly and annual price alongside where the
figure came from and the date it was last checked, both articles interpolate from it, and a test
fails the build on any `£NN.NN` in any article that is not in that owner or in our own `PRICING`.
The point is not the two pages that were wrong. It is the six that are not written yet: eight
comparison pages are planned and every one of them will quote these numbers.

**The honest bit.** I wrote in this morning's filing that the real fix was one owner, and then
still had to be told the price before I did it. The owner should have gone in when I found the
conflict, not when the value was settled, because the conflict was the evidence and the value was
just an input.

**One thing the change caught on its way through.** Page 2 called Runna "the most expensive of the
three." At £15.99 a month against Coopah's £14.99 that was true; at £119.99 a year against Runna's
£99.99 it is not. It now says "the most expensive per month." Changing a number in one place made
a sentence somewhere else false, which is the entire argument for the owner, arriving on schedule.

---

## 2026-09-21 — GTM-SEO-COMPARE-01 page 2: the template held, and adding one block kind quietly turned two checks off

**Dev.** Comparison page 2 went in as designed: one entry in the catalogue, a four-line route shim,
and the hub, the sitemap, the canonical, the Open Graph card and the Article JSON-LD all picked it up
with nothing else touched. That is what the template was for and it is nice when it works.

The one thing it did not have was a table, and a three-way price comparison is a table. So I added a
`table` block kind, which the type's own comment warns against: *adding block kinds is how an article
template quietly becomes a page builder.* I think it earns it. The SEO brief is explicit that a plain
in-page HTML table beats a graphic, because the cells are readable text rather than pixels, and the
alternative is seven paragraphs saying what a grid says at a glance.

**The honest bit.** The house-style tests on these articles, no em dashes and never a literal brand
name, run over a helper called `copyOf(block)` that turns a block into a string. It handled two kinds.
The moment a third existed, every cell in every table was invisible to both rules. Not failing:
invisible. The compiler caught it this time only because widening a union breaks the ternary that
assumed two branches, and a future kind might slip in without that. It is now an exhaustive switch
with a comment saying so.

That is the same shape as three other things I have hit this month: a checker that shares the
producer's list of what exists is blind to that list being wrong.

**Product.** Page 1 says Coopah costs £9.99 a month. Page 2, verified against the App Store's own
in-app-purchase listing and two independent reviews, says £14.99. Page 1 now links to page 2 three
sentences after quoting £9.99. I have not rewritten it: correcting a competitor's price is not a
silent edit, and there may be a promo I cannot see. But the fix when it comes is not editing two
strings. Six more pages are planned and every one will quote these numbers, so the competitor facts
need one owner, with the source and the verification date beside each figure, exactly as the coaching
numerics do.

---

## 2026-09-21 — DATE-DST-01 / PARITY-DST-01 / MKT-PLAN-PHASE-NOTE-01 / FIXTURE-CLOCK-01: a quarter of our plans were a week short, every spring, for as long as the engine has existed

**Dev.** I was asked to review the nine training plans published on the marketing site and make sure
they were fit to hand out. They generate live from the engine on a 24-hour cache, so I measured them
across a year of regeneration dates instead of the one date the existing test freezes. Eleven of the
fifty-three weeks came back one week short: `/plans/5k-12-week`, which says "12 Weeks" in its title,
its heading and its own URL, was rendering eleven.

The cause is four lines long and reads as obviously correct:

```ts
const start = parseDateLocal(startIso)
const end = parseDateLocal(endIso)
return Math.floor((end.getTime() - start.getTime()) / (7 * 86_400_000))
```

The local parsing is the right call, and it is deliberate: there is a comment at the top of the file
warning never to use `new Date("YYYY-MM-DD")` because it parses as UTC. But two local midnights
across a spring-forward are 23 hours apart, not 24. Eighty-four days becomes 83.96, `Math.floor`
takes the day away, and because the plan-length calculator differences Monday to Monday, the span is
always an exact multiple of seven and a lost day is a lost week. Twenty-five percent of Monday-to-Monday
spans over three years. Thirty-six percent for a twenty-week marathon block, which is the spring
race season, which is the busiest window of the year.

**The honest bit.** `verify:parity` said IDENTICAL. Twice. First on 5,940 cases, then on 7,884 after
I added a later race date to try to reach the boundary. Both runs were true and both were worthless:
every span in the grid sat inside one UTC offset, and even a crossing span only changes anything when
the runway rather than the per-distance cap is what limits the plan. Two conditions had to be true at
once and I only fixed one. The third attempt, a focused 54-case block with its own GMT start and tight
runways on the far side of the transition, reported 30 changed. That is the difference between a check
that is green and a check that is looking.

**AI-building.** This repo's own rule is that IDENTICAL is not the same as VERIFIED, and I still had
to get it wrong twice in a row before the axis worked. The lesson is narrower than "check your grid":
it is that a grid can contain the right VALUE and still be blind, because the value only matters in
combination with something else the grid holds constant.

**Product.** Three other things were wrong on those pages and all three were copy claiming something
the plan underneath contradicted. The Base note promised "no hard running yet" over a block containing
a 5K time trial, on five of the nine plans, every single day. The plan was right: the benchmark goes in
a base recovery week on purpose, because your legs are fresh. The sentence was just old. The phase notes
are now computed from the weeks they sit above, with a test that fails the build if a claim stops being
true, because prose about a rule always drifts from the rule and this codebase has a homepage that once
claimed "four answers" against a fifteen-question wizard.

**And one I did not fix.** The sub-4 marathon page rendered a week badged *Recovery* carrying more
volume than the week before it. That is a known, declared engine residual: 18.9% of all plans in the
corpus have at least one, and the Coaching Board scoped the healthy-runner fix out and has not ruled on
it. I moved the published persona above the threshold where it stops happening and filed the real
problem. That stops us printing the contradiction. It does not fix it, and the registry row says so.

---

## 2026-09-21 — DOC-AUDIT-WINDOW-01: the check that reported ALL CLEAN while checking nothing

**Dev.** The founder asked whether every document was up to date. `audit-docs.sh` said ALL CLEAN.
I reconciled by hand anyway, and 38 of the previous day's 39 ship scopes were fully recorded —
`§117 Am.2` had a feature-registry row and no build-log entry.

**The check could not have found it, for two independent reasons.**

Its window was `--since today`. At midnight the date rolled over and the list emptied, so an
entire day's ships left scope while the script kept reporting ok. That is now the **third**
date-scoped list in two days to expire and take its coverage with it — yesterday's backlog check
did the same thing and eleven shipped items sat open behind a green tick. **A date-scoped list is
a list that empties on its own**, and I have now written that sentence three times about three
different checks.

And its scope pattern was `[A-Z0-9-]+`, so `feat(§117 Am.2)` was invisible regardless of the date.
Measured across all history: **270 of 508 scopes, 53%, could never be seen by it.** A check that
silently skips half its population is worse than no check, because it answers the question.

**The fix is a marker, not a date.** The window runs from a recorded commit that advances **only
on a clean run**, so a gap stays in scope until someone fixes it, and nothing ages out because the
clock moved.

**The honest bit.** Falsifying the fix found a bug in the fix. With the build-log entry removed
and the marker rewound, it reported `GAP Am.2` — because `for id in $ids` word-splits on
whitespace, so `§117 Am.2` became two ids and it flagged a fragment that was never a scope. A
line-wise read fixed it, and then it reported exactly the right thing. **I would have shipped a
check that mangles any scope containing a space** if I had stopped at "it went red, good."

**And the new check immediately caught its own ship** — it demanded a registry row and a build-log
entry for `DOC-AUDIT-WINDOW-01`, which is this. That is the most reassuring thing about it.

## 2026-09-20 — §117 Am.2: an exemption without a bound is not a relaxation, it is a hole

*(Backfilled 2026-09-21. This ship had a feature-registry row and no build-log entry — found by
reconciling all 39 of that day's ship scopes by hand, because `audit-docs.sh` scopes its
ship-record check to TODAY and the date had rolled over. An audit is only ever as wide as its
list, and at 00:00 that list emptied.)*

**Dev.** `LONG-RUN-SHORT` was made WATCHED rather than scored on §117 run-walk plans, because the
board had ruled an 18.5 km peak long run adequate at peak 34. That was correct. What was missing
is that **nothing in the code distinguished 18.5 from 13.5** — the exemption covered both.

**The closest call of the day.** Had `S116-FLOOR-VS-TARGET-01` also passed, the marathon would
have cleared the founder's 90% bar **for the first time, by admitting people to plans that do not
work.** The number would have moved and the runners would have been worse off. That is the exact
failure the fit-for-purpose measure exists to prevent, arriving through the measure itself.

Built the bound and it fired on real plans immediately: **11–13 km peak long runs** at 8 km/week
with 19–20 week runways. The cause is worth keeping: §111's door asks whether the *ratio* is
lawful and **never whether there is time to build to the peak that ratio came from.**

**Two fixes, because one was not enough.** A runway gate in `runWalkApplies` — reusing
`onRampWeeksNeeded` rather than re-deriving §2's ramp — and a check on the **finished plan that
refuses** rather than hands one over. ⚠️ An invariant alone was not enough: in production
`validatePlan` only LOGS, so the runner still receives the plan. Refusing is worse for the metric
and better for the runner, which is the trade the board made.

**The honest bit, three times over.** My first cut invented a fudge factor — `MIN_REMAINING_WEEKS
/ 4`, "for the taper", a number produced by dividing an unrelated constant. Removed. The first
"0 plans below the floor" was **vacuous**: I had deleted the flag's setter while deduplicating two
`runWalkApplies` calls, so the invariant could not fire — the third vacuous measurement that day.
And it reads `sessionKmSelfPaced` because `distance_km ?? 0` on duration-anchored beginner plans
was the **fifth** recorded instance of that error.

Marathon 77.6% → 78.1%, whole product 92.3%.

## 2026-09-20 — P-02: the biggest item on the board, and the risky part was already solved

**Dev.** P-02 was described as the highest-leverage item in the teardown and the widest blast
radius in the document, and its own filing said the Coaching Board had to sit before **scoping**,
not just before approval. The gap was real: there was no surface on which a runner could change a
plan parameter. Days available, weekday cap, race date, long-run day, injuries, terrain — all of
them meant re-running a fourteen-screen wizard that archives the existing plan.

**The board vetoed the one control that would have been a mistake.** The brief wanted intensity as
a primary control, 80/20 → 90/10. Seiler's objection settled it in one line: 80/20 is a
session-count observation, so at four running days the two settings are 0.8 and 0.4 quality
sessions. **The control does not quantise.** It would be illusory at the volumes most of our
runners train at and consequential only at the top. Willy added that dialling *up* is the injury
vector and self-selects for the runner least likely to stop. What shipped instead is
`hard_session_relationship`, which expresses the same preference and is already governed by §110.

**And the part I expected to be dangerous turned out to be already solved.** This feature's named
failure mode is `PLAN-WEEK-COLLISION-01` — a plan that arrived 94% pre-completed because `week_n`
is a within-plan coordinate that seven tables used as a cross-plan key. Modify-and-regenerate does
exactly that operation for a living. But `savePlanForUser` already supersedes week-keyed rows,
gated on `isRaceIdentityChange`, and that gate turns out to be exactly the right semantic for
this: change your days and your logged weeks are yours to keep; move the race and they stop
counting, because that is a different block.

So the sheet does not decide it. It **asks the same function**, which means the warning the runner
reads and the behaviour they get cannot disagree. That is the whole design, and it is one line.

**The limitation I could not design away.** Regeneration needs the input the plan was built from,
and `meta.generator_input` is stamped only on plans generated since it was added. Measured against
production: **10 of 22 live plans have none.** Those runners get no entry point at all. The
alternative was regenerating from guessed answers, which silently changes things nobody asked to
change — and a row that cannot work is worse than no row. It shrinks on its own, and the October
charity cohort is unaffected because their plans will all be new.

**AI-building.** Nearly every piece of this was composition. Every control already existed
(`Sheet`, `DayGridSelector`, `SegmentedControl`), the diff already existed with two live call
sites, the thresholds already existed in ADR-012, the save path already existed and was already
the single writer. The genuinely new code is one logic module and two presentational components.
The temptation in a "widest blast radius" item is to build widely; almost all of the work was
finding what not to write.

## 2026-09-20 — P-06(c): took the idea, left the chrome, and checked the promise before making it

**Dev.** Our plan preview told a runner the week count, the start date and the race distance. It
said nothing about the shape of the thing they had just committed to — how big the biggest week
gets, how far the whole block runs. Both were computable from the plan already on screen.

They are computed at render, not stored. A total written at generation is correct until the first
reshape, and "a value read mid-pipeline was stale by the time the runner saw it" is a failure this
repo has recorded twice under its own names.

**The promise needed checking before it could be made.** The panel closes with the adaptation
line, and adaptation is `dynamic_reshape_r20`, which is **false for free**. So a free runner would
have been promised something they do not have — the same shape as the "full access" claim that sat
live and false on the marketing site for weeks. It is gated, and the guard is falsified by
promising it to a free runner.

The sentence itself is the `/pricing` row's, not a new one. There is exactly one claim about
reshaping in the product and it already has an owner and two guards; writing a second sentence
that means the same thing is how two surfaces start disagreeing.

**What I did not take, and why that is the work.** The brief proposed a deep-ink hero panel with a
tonal wave and a ticket-notch divider. `ui-patterns.md` scopes the Dark Ground to **marketing
pages** — "a punctuation mark, not a theme" — and the design principles bar decorative chrome in
so many words. Our own hierarchy, value large and label small underneath, was already specified.
So the panel takes the idea and none of the styling, which is how this whole teardown has been
handled: the competitor's instinct was right and their execution is theirs.

I also did not say "No make-up runs." It is a good line and the filing flags it as a coaching
claim requiring verification against the missed-session path. I did not verify it, so I did not
say it.

**And two halves I left alone on purpose.** The ceremony illustration is a commission. The
annotated card stack needs a **second typeface** — an explicit exception to the one typographic
rule this brand has — which is the founder's to grant, not mine to assume. I deliberately did not
pre-build the annotation derivation either: a derivation nothing renders is decorative code, and I
have spent today deleting that class rather than adding to it.

## 2026-09-20 — P-05: one half shipped, the other half was already built and nobody had checked

**Dev.** P-05 arrived already trimmed: three of its four proposals were dismissed in the filing
itself, with code, which is the right way to receive an item. Of the two that survived, one was
real and one turned out not to be.

**The real one.** Our distance tiles said nothing about plan length. We offer six distances to the
competitor's four, including 50K and 100K which they cannot offer at all, and told the runner
nothing about any of them. They now read "42.2 km · 14–20 week plan".

The care is in where the numbers come from. A range typed into the component is prose about a
rule, and prose about a rule drifts from the rule — this site once claimed "four answers" on the
homepage against a fifteen-question wizard and survived five wizard changes. So it reads
`PLAN_SIGNATURES`, and a test fails if any range is hardcoded. It is also deliberately a range and
not a promise: §97 lets a long runway earn a longer plan and §44 refuses below a minimum, so
before a race date exists the only honest claim is what the signature permits.

I also checked all six resolve. A tile silently rendering no range would have been the way this
shipped broken, and it is exactly the kind of thing that passes review by looking fine on the
distance you happen to test.

**The half that was already done.** P-05(b) said a runner with no name from Apple or Google is
"silently nameless", with the ceremony lines and reveal heading degrading with no indication. Not
true any more: `ceremonyLines.ts` never uses the name at all — its lines are about the runner's
own answers — the "Athlete" placeholder PROFILE-NAME-01 removed survives only in test grids, and
`nameToken.ts` deliberately drops the name token and tidies the punctuation so a nameless runner
reads a sentence with no name in it rather than one addressed to a placeholder. Its header says
so explicitly.

**And building it would have been actively wrong.** A name-capture screen would ask for a value we
stopped sending to Anthropic that same morning, to repair a degradation that was designed. That is
the second item today whose premise dissolved on reading the code, after P-08's claim that the
charity code link sits on wizard step 1.

## 2026-09-20 — P-08(a): the item was a decision, and the answer was no

**Dev.** P-08 proposed moving charity-code redemption to the last wizard step, at peak intent,
because that is where the competitor puts it. The filing itself flagged that this collides with a
live P1 and said the collision *is* the item. It does collide, and the proposal loses.

Marathon is PAID-locked. `GTM-CHARITY-08` exists because a comped runner who picks their race
before redeeming meets a paywall as the first thing this product says to them. Redemption at the
END of the wizard is not neutral on that, it is strictly worse: the runner cannot have selected
marathon to reach the step that would have unlocked it. So the answer is no, and the value of the
item was reaching that conclusion rather than building anything.

**Reading the code also corrected the filing.** It said the code link "sits on step 1 of the
wizard". There is exactly one redeem door in the wizard and it is inside `case 'distance'` — the
same screen as the lock. The placement is defensible rather than merely inherited, which is the
opposite of what the item assumed, and the description is now corrected where it was written.

**What survived was smaller and real.** Tapping the locked tile calls `onUpgrade` and navigates
away, past the code link two lines below it. So the sentence a runner reads *before* the tap now
names both routes out of the lock.

**The two things I deliberately did not do.** I did not add a second redeem button next to the
gate: the door is directly beneath, and a second control would be a third phrasing of one action —
which is exactly why the existing door reuses the other two doors' string. And I did not make the
locked tile inert. For nearly every user, Upgrade *is* the remedy; breaking the majority case to
serve 500 runners in October would be the wrong trade, and putting both routes in the sentence
serves both groups at once.

**AI-building.** The test needed the distance step's markup, and there are two `case 'distance':`
sites — the first is a one-line validation guard 780 lines earlier. Anchoring on it sliced 49
characters and reported the redeem door missing from its own screen. Fourth mis-anchored source
slice today; the durable fix remains extracting components, and where that is not proportionate,
anchoring on something structurally unique.

## 2026-09-20 — P-12 (with P-14(a)): the upsell that reads its own feature list

**Dev.** Our Me screen's Subscription section was one row saying "View plans". The competitor's
equivalent is better, and the reason is order: it states what you already have, then what Pro
adds. That is the only shape an upsell takes that does not feel like a shakedown, and it was worth
taking even though almost nothing else on that screen was.

**The part that mattered technically was refusing to type the feature list.** `/pricing` already
holds gate-linked rows, each naming the `FEATURE_GATES` entry it describes, and those rows are
already covered by two guards — one proving every paid gate has a row, and today's one proving the
mechanical claims are true of the product. A hand-written list on Me would have been a third copy
of the same prose sitting outside both. It reads them instead, and a test fails if a single
feature name is retyped in the component. Falsified by retyping a real one.

**A subscriber sees the card too.** No upsell in it, just what their subscription covers. Hiding it
would make the section appear only when we want something, which is the behaviour the card exists
to avoid.

**P-14 was a smaller job with one real decision in it.** We had neither half of the review prompt:
no passive row, no native prompt, no plugin, zero hits across the codebase. The row is one line
with no framing — the moment it says "help other runners find us" it becomes marketing copy on a
support screen and needs a brand decision, so a test asserts the absence of persuasion.

The URL is derived from the App Store URL rather than hardcoded again, and the row is gated on
that URL being non-empty, because the constant's own note says it is blank until approval and a
review link to a page that does not exist is worse than no link.

**What I did not build, and why it is the interesting half.** The native
`SKStoreReviewController` prompt fires after "a genuine win". Apple rate-limits it to three a year,
so firing it on anything less than a real win spends a scarce resource on nothing — and what
counts as a win has to be written down before it is coded, which is P-14's own acceptance
criterion. Guessing the trigger would have been the easy half and the wrong one.

**AI-building.** Fourth time today a "must not contain" assertion matched a comment rather than
code: the comment explaining that the native prompt is deliberately absent contains the words
`SKStoreReview` and `requestReview`. Also caught myself asserting the card contains no "14" — which
matches `fontSize: '14px'`. A test that fails on a stylesheet value teaches people to delete it.

## 2026-09-20 — P-10: deleting dead code found live doc rot, which found more doc rot

**Dev.** Three cold-start holes. The first was to delete two components rather than fix them, and
the filing was emphatic about the distinction: `PlanProgressBar` rendered "0 of N sessions complete
· 0%" because it guarded the total but not the completed count, **and it had zero render sites.**
Fixing it would have put a non-existent bug into a build and left 45 lines of unreachable code
behind, now carrying a test and a changelog entry implying someone depends on it.

**Deleting is where it got interesting.** `RestraintCard` had been unreachable since May, when
ZONE-VIS-02 moved the discipline number to Coach's 2×2 — but `ui-patterns.md` still said
*"Reference: components/shared/RestraintCard.tsx"*. That document is what the `frontend-design`
skill reads before any UI work, so a reference pointing at a deleted file sends the next build
looking for a precedent that is not there, or recreating one. I had cited that exact pattern an
hour earlier for P-04's locked state.

So the section stays and the component goes: the anatomy is live, the file is not, and the section
now says both. Then I wrote a guard that resolves every `Reference:` in the design system — and it
immediately found **a second break I was not looking for**. `SectionLabel` is documented at
`components/shared/SectionLabel.tsx` and is defined inline in `DashboardClient`. This repo has
already shipped a design handoff whose component list was 44% fiction; that is the same failure
with a smaller blast radius.

**The live defect was the second hole.** Coach's empty state told every runner to "Connect Apple
Health or Strava" and offered a Connect button — while both connect paths `return` early off
native. A web runner was instructed to do something with no route to doing it and no button
rendered. It now names the constraint honestly, and the CTA is **withheld rather than relabelled**:
a button that cannot work is worse than no button. It deliberately does not mention Strava, because
that application is currently Inactive at Strava's end, and naming it would have been the second
false instruction on one screen.

**The bit I want to keep.** Extracting `useIsNative` was right — two components already had their
own copy and I was about to write a third. But one site keeps its own check, and I nearly
"tidied" it: `AppleHealthConnectionRow` uses the platform test as an early exit inside a
Supabase-reading effect. That is a platform-gated FETCH, not a flag. Routing it through the hook
would have changed behaviour to satisfy a claim in a comment. **Single owner of the flag is not
single owner of the sequence**, and the hook's own docstring now says which one it is.

**What is not done.** Hole three was "actually look at day one on a device", and it is still not
done, because I cannot do it. The audit read the JSX; nothing was run.

## 2026-09-20 — P-09(a)(b): the blocker was resolved by making the claim true, not by softening it

**Dev.** The paywall showed a price and nothing else: no per-week figure, and no account of what
the trial actually does. P-09 had been blocked for two days on `TIER-TRIAL-CONFIDENCE-01`, which
recorded that our 14-day trial was not literally full access while the marketing site said it was.

That item shipped earlier today, and how it shipped is the point. The cheap fix was to soften the
sentence. What actually happened was the root fix: `enrich` now asks
`isFeatureAllowed('confidence_score', tier)` instead of carrying its own copy of the rule, so the
trial genuinely receives it and **the claim became true**. I re-verified before writing a word of
the timeline: **0 of 21 gated features are denied to `trial`.**

**The guard is the interesting part.** A test that reads the sentence proves nothing. This one
re-derives the fact the sentence asserts: it enumerates every gate, checks each against `trial`,
and fails if the copy claims full access while any is closed. Falsified by simulating exactly the
original defect — deny `confidence_score` to trial and it goes red. That is the thing that did not
exist the first time, which is why a false claim sat on the marketing site for weeks.

Day 11 got the same treatment. It is not a marketing choice: `trialEmailWindow` nudges three days
before expiry, so the test derives the row from `trialDays - 3` rather than trusting the string.
Change the trial length and the timeline fails rather than lying.

**The numbers were worth checking too.** The teardown proposed "~80p per week", which implies
£41.60 a year and is not our price. Ours is **£1.15/week** on annual, and the competitor we were
being compared against is £1.54 — **we already win on the metric the brief wanted us to discount
toward.** A fact to state, not a discount to invent.

**What I did not do, and why.** Part (c) is the exit offer: intercept the dismiss once and offer
the free tier rather than a discount. It needs a full screen and a once-per-user flag, and the
migration cannot be applied from here. A screen no runner can reach is not an increment, so it is
named with its design already settled (`user_settings` already carries `orientation_seen`,
`connect_runs_seen`, `push_permission_seen` — it is `exit_offer_seen`, nothing new invented)
rather than half-built to make a ship look complete.

## 2026-09-20 — P-04: the measurement reversed the ruling, and two copy bugs said the opposite of the truth

**Dev.** The Plan screen had no intensity metric. Neither does the competitor's, which is the
finding: their screen shows distance covered, total distance, current pace, race-day pace and
projected finish, in an app whose own marketing argues runners go too fast. The question this
whole product is built on was answerable only on Coach.

**The board had not sat, and the SLT had said it must.** Two questions were routed down and no
ruling was on record. I convened with the data rather than the argument, and the data reversed the
shape of the answer. Hutchinson had asked for a minimum of three analysed runs before the block
says anything, on good grounds: three runs with no control for terrain, heat or a badly-seated
strap is not a pattern. But across 42 runner-weeks, a three-run minimum would have **hidden the
block on 57.1% of weeks.** A block that is absent more often than present is not a block.

The resolution came from Hutchinson narrowing his own objection: he never objected to *stating what
happened*, only to *inferring a pattern* from it. Those are different claims, and the question as
routed down had conflated them. So the threshold gates the register, not the visibility: three runs
buys you a verdict, fewer buys you a count, none buys you an honest "no heart rate yet".

**The honest bit, and it is the worst near-miss of the day.** The zero case is the sentence a
struggling runner reads. Mine interpolated the measured count into the leading slot, so a week in
which **four runs drifted** rendered as *"Four of this week's runs stayed in the zone."* The exact
opposite of the truth, in the one sentence that most needs to be true. I found it by printing every
variant rather than reading the code — the same pass caught a capitaliser that only ever uppercased
the word "none", shipping *"two runs had no heart rate."* mid-sentence.

Both are now pinned, and the zero-case test is falsified against the real bug rather than a
synthetic one.

**AI-building.** Third time today a substring assertion read a **comment** as code: the test banned
"AIMark" and "drifted" in the component, and both appear in the comments explaining why they must
not appear in output. Stripping comments is now reflexive. The subtler version was banning the bare
word "drifted" at all, when it is the tone discriminant in `s.tone === 'drifted'` — legitimate code.
A guard with a false positive gets loosened, and a loosened guard is how the real thing gets in.

**Product.** The free tier states the thesis and never scores it, because run analysis is paid.
That is defensible under gate-richness-never-access, and rather than invent a treatment I followed
`RestraintCard`'s locked state, which was already ruled for exactly this data on Coach.

## 2026-09-20 — P-15: the item scoped a promise, and the thing it promised had shipped that morning

**Dev.** P-15 says the refusal should name a next action, and that for October that action has to
be "a stated route, not a generated plan", because the base-build does not exist yet. §118 shipped
the same day. `generateGetRunningPlan()` already returned a complete, validated plan — and the
refusal route was calling it, taking two numbers off it for the offer copy, and **throwing the
plan away.** So the acceptance path is three lines and the runner gets the real thing.

**The design question that mattered.** The refusal card is amber, which in this product is
coach-warning voice. Putting the offer inside it would have been the fast option and it would have
read as more bad news on a screen that has just said no. The offer is a separate white card with a
moss rail: the same left-accent language session cards use, in the token that means "this is the
good half".

The other one was CTA hierarchy. Two primaries now compete, and the canonical answer already
existed in the upgrade-screen pattern: moss button for the offer, muted text link for adjusting
your answers. Not hidden, because a CTA with no visible alternative is a dark pattern and the UX
principles bar dead ends outright.

**AI-building — three false greens in one test file, all the same shape.** The first version of
the test lived next to the component in `app/dashboard/`. **vitest collects `lib/**` and
`components/**` only**, so it did not run: it reported "No test files found" and exited, which in
a hurry reads like success. Then, twice, the test sliced the 1,400-line screen to find the markup
and anchored on the wrong thing — once producing an empty string, once matching a one-line early
return 450 lines away. Both times "no hardcoded hex" passed while inspecting code that had no
markup in it.

**The fix for all three was structural, not more care.** Extracting `RefusalView` into its own
component meant there was nothing to slice and nowhere to mis-anchor. It also gave
`/refusal-preview` a real component to render instead of a copy that would drift — which matters
because this screen sits behind auth AND a completed wizard AND a refusal, so the only other way
to see it is to be the runner it is failing.

**The honest bit.** Nothing here has run on a device, and P-15's own acceptance criteria say it
must be before the codes go out. The fixture page is what makes that a minute's work rather than
minting a code and faking a base volume, but it is not a substitute for doing it.

## 2026-09-20 — GTM-CHARITY-07 (with 05/06): the tier rule had a fourth copy, and it was in SQL

*(Covers `GTM-CHARITY-05`, `GTM-CHARITY-06` and `GTM-CHARITY-07`. The first two are code-complete
and await a production migration apply, so they deliberately carry NO feature-registry row yet —
see the note at the end.)*

**Dev.** `resolveTier` carries a header comment explaining that the order
admin → subscription → grant → trial → free once lived in three places and drifted, so it now lives
in one. There was a fourth. `admin_user_tiers`, a Supabase view, restated the same order in a SQL
`CASE` and stopped one arm short: it never read `charity_codes` at all.

**I measured it against production rather than predicting it.** Two live users read `trial` today
who hold an active grant. Eighteen free, thirteen trial, one admin, all unchanged. Two is not a
crisis. Five hundred in October is, and the specific damage is not the admin screen — it is
`v_trial_conversion`, a LEFT JOIN over anyone with a `trial_started_at`, which would count every
comped charity runner as an unconverted trial and make trial→paid look worse than it is for a
whole season.

**The part I had to think about: a view cannot import a function.** SQL genuinely cannot call
`resolveTier`, so this duplicate is unavoidable — D-16 says no parallel semantics, and here there
is no choice. What is avoidable is leaving it unnamed. The previous mitigation was a comment
asking the next person to keep the two in step, and that comment is what produced the defect. So
the duplicate is now held by a test that reads the migration file and fails if an arm is dropped
or reordered — including that the grant arm tests **expiry**, not merely the presence of a claimed
code, because a lapsed grant reported as current is the same error in reverse.

**The best outcome of the three needed no migration at all.** Deleting an account returned a
claimed code to the unclaimed pool, because the gate read `claimed_by` and the foreign key is
`ON DELETE SET NULL`. The filing proposed adding a `released_at` or `claim_state` column.
Neither is needed: `claimed_at` already records exactly that fact and already survives the
deletion, because the key is on `claimed_by` alone. A new column would have been a second answer
to a question the schema could already answer.

⚠️ **Both predicates had to move together**, and this is the bit I would have got wrong if I had
been quicker. The route gates twice — a read gate, and the `.is(...)` predicate that makes the
claim atomic when two runners race the same code. Moving only the read gate would have been
**worse than the original bug**: the refusal would then depend on which path a request happened to
take. The test is falsified against precisely that half-fix rather than against no fix.

**Product.** For the partner view, the two caveats ship as **column names** rather than as a note
under the table: `signed_in_last_7d` and `healthkit_accepted_upper_bound`. A sign-in is not an app
open, and iOS does not let us distinguish an accepted permission sheet from a silent denial. If
the number is going to be read out to a charity, the caveat has to be attached to the number, not
to a document beside it.

**Open and not mine:** the migration cannot be applied from here — deploying to production is
blocked, correctly. Both view bodies were validated read-only against production first, so the SQL
is known to run.

⚠️ **`GTM-CHARITY-05` and `GTM-CHARITY-06` get NO feature-registry row until that apply happens,
and that is deliberate.** The registry answers "does this exist?" — a row for a view that is not
in the database would answer it wrongly, and `ship-record-check.py` would then read the item as
recorded and stop asking. They sit 🟡 in the backlog with the apply named as the remaining step,
and the unapplied migration also trips the session-start warning every session until it lands.
Two reminders, no false record. `GTM-CHARITY-07` shipped in code alone and has its row.

## 2026-09-20 — S24-FLOOR-REACHABILITY-01 and FITNESS-BUCKET-SAMPLE-01: I filed the wrong diagnosis, and widening the sample proved it

**Dev.** Three engine-governance items. The one worth writing up is the one where my own filing,
written four hours earlier, was wrong about the cause.

`measure:fitness` had reported an 11pp "masters build deficit" that opened a P1 and reached the
Coaching Board. I traced it to sample size — the pool was 1,400 rows of a 41,472-row grid, 3.4% —
filed it as such, and moved on. Today I widened the pool tenfold to fix it. **The gap did not
move.** Masters still read 19.1% against standard 28.6%.

**Because the defect was never size.** `cohortGrid` varies age over {35, 52}. `targetedGrid` is
**entirely age 40**. So every targeted row lands in a `standard` bucket and *none can ever land in
a masters one*. `healthy masters` is 100% cohortGrid; `healthy standard` is 31% targetedGrid. The
injury pair is worse still: three constructed rows against three thousand targeted ones. **The two
buckets were never comparable, and the table put them side by side with aligned decimal points.**

**The line I want to keep:** a bigger sample of a mis-composed comparison is just a more confident
wrong answer. I would have shipped exactly that, and the numbers would have looked better.

**Product.** Nothing a runner sees. What changes is that a board sitting can no longer be opened by
reading two columns that describe different populations — every bucket now prints which grids fed
it, and the table says in plain words that buckets of differing composition are not comparable.

**Also today.** §24's marathon long-run floor is now documented as pace-conditional: 210 minutes
over 31.65 km needs 6.64 min/km, so below about 6:38/km it is unreachable *by arithmetic*, in every
plan, forever. The engine was already right — §24 already concedes the time cap wins — but the
constitution never stated the consequence, so a reader concluded the engine was failing a rule when
it was obeying a different one. **That filing's numbers were withdrawn too** ("0 of 108 reach it"
is now 33.3%, and the best plan exceeds the floor rather than missing by 0.15 km).

**And the third: `COMPLIANCE-PROGRAMME` closed.** Every sub-item inside it was already ticked; the
umbrella was the only thing holding it open, which is its own small lesson about how a programme
outlives its work. Verified rather than assumed — `verify:coaching` reports HIGH 0 · MED 25 · LOW 0,
no high-severity deviation on any test plan, which is the programme's own success condition. ⚠️ Its
header still quotes "fit-for-purpose 97.7%" and that must **not** be read against today's
`measure:envelope` 92.3%: different instruments, and the envelope fell today because the *ruler* was
corrected twice, not because the engine regressed. Four standing gauges now carry the residual, so
there is nothing left for an umbrella to do.

**The honest bit.** Three items, three filings, and **two of the three had a wrong premise written
by me.** The pattern is consistent enough now to name: I file from a measurement taken in one
context and the context moves, or I file a cause I inferred rather than isolated. The fix that
keeps working is boring — re-measure the premise before building the remedy, and check the
denominator is the population you think it is.

## 2026-09-20 — PRICING-ROW-TRUTH-01: the first row I checked was lying

**Dev.** We had a test proving every paid feature has a row on the pricing page. It passed for the
entire period one of those rows was false on 58% of plans. The guard held while the claim rotted,
which is a specific and nasty failure: the green tick is *why* nobody looked.

Traynor at the SLT: *"We found this one by accident. There are others."* There were. Writing the
first predicate, against the row that says **"No limit."**, took about four minutes to disprove:
`app/api/generate-plan/route.ts` calls `guardAiRequest` *before* the tier branch, and
`generate-plan` is capped at ten per hour — on every tier, free included.

**Why nobody noticed, and why it still matters.** No runner regenerates eleven plans in an hour, so
the claim is harmless in practice. It is also absolute, and absolutes read as confidence. That is
the whole class: the words most likely to be false are the ones least likely to be questioned,
because they sound like someone checked.

**AI-building — the interesting constraint.** The filing explicitly said *do not ship a check that
merely looks like one*, and it was right: "is this sentence true of the product" is not decidable
by a test, and faking it here would have recreated the exact failure, a green tick with nothing
behind it. So the guard does three smaller honest things instead of one dishonest big one. Every
row must **declare** whether its claim is mechanical or human-judged. Mechanical rows are actually
**executed** against `PLAN_SIGNATURES`, `AI_ROUTE_LIMITS` and `FEATURE_GATES`. Human-judged rows
are **pinned to their exact sentence**, so editing a claim without moving the review date fails.

I deliberately did not add a review expiry. A check that fires on correct work every ninety days
gets switched off, and this repo has recorded that as equivalent to having no check at all. It
fires on an edit — the moment the claim actually changes.

**The honest bit.** Nine of the thirteen rows are `reviewed`, which means a human judged them once
and the machine only guarantees nobody quietly edits them. That is a real limit and I would rather
write it down than let the new green tick do what the old one did.

**Also closed today: `TT-PROJECTION-PROVENANCE-01`, which was already built.** The route already
returns a `source` field, the card already renders it, the wizard state already says *"Estimated
from your wizard answers, not your running"*, and the figures on that state are already coarse
because — in the route's own comment — *"an unmeasured estimate cannot support seconds."* It was
filed off the back of an SLT discussion without anyone opening the file, me included. Third stale
item today, and the second I filed myself.

## 2026-09-20 — SEC-15: the filing said eleven of twelve, and it was ten of twelve

**Dev.** One AI route had no per-user rate limit. I could have added two lines to that route and
closed the ticket. Instead I wrote the coverage sweep — every route under `app/api` that calls the
Anthropic owner must also call a guard — and it immediately found a **second** unguarded route the
filing never named. The "eleven of twelve" in the ticket was wrong for exactly the reason the gap
existed in the first place: **nothing was counting.**

**The honest bit, twice over, and both came from falsifying rather than re-reading.**

First, the sweep reported `ops/ai-spend` as an unguarded AI route. It is not — it only *mentions*
`callAnthropic` in a comment explaining where spend data comes from. Second comment-read-as-code
trap in one day; the other nearly blocked a correct fix by making a deleted gate look live.

Second, and worse: I deleted a guard to prove the test would go red, **and it stayed green.**
`src.includes('enforceAiRateLimit')` was matching the surviving `import` line. A route that
imported a guard and never called it would have passed the gate — the "declared but inert" class
this repo keeps paying for: decorative config, an eslint rule installed but never configured, two
§97 gates that could never fire. **A guard that cannot go red is not a guard**, and I would have
shipped one if the falsification step were optional.

**Product.** Nothing a runner sees. Both routes are authenticated and tier-gated, so neither was an
open door — what changes is that a client loop can no longer drive Sonnet without a ceiling, three
weeks before 500 comped runners arrive on an Anthropic balance nobody is watching in real time.

**The limit I chose, and why it is not the default.** `weekly-report` is Sonnet but only 300 max
tokens, so it is "expensive model, cheap call" and does not match HEAVY's stated case. I listed it
as HEAVY anyway: the DEFAULT is 30/hour, and 30 regenerations an hour of a *weekly* report is not a
ceiling, it is a rounding error. The actual loop vector is `?force=true`.

**What this does not fix.** `checkAiRateLimit` fails open — an RPC error or unreachable database
allows the request, because a false denial breaks the product while a brief limiter outage has
bounded exposure. That trade is documented and correct. So this declares a ceiling; it does not
enforce one under failure. And `analyse-run` reads a body with no size cap, which I left alone
rather than guess a number for.

## 2026-09-20 — S80-VS-S90-PRIORITY-01: Coaching Board batch, and four premises died under measurement

**Dev.** The founder asked why board items were being filed rather than done. The answer was
embarrassing: I had been treating the Coaching Board as an external body waiting on someone else.
I convene it. "Needs a board sitting" is a task, not a blocker. Four items went in; two came out
as rulings, two came out withdrawn.

**The honest bit, and it is the whole entry.** I went in to rule on a priority. The mandatory
conflict scan found that **both load-bearing premises of the previous sitting were false**:

- *"§9 already forbids it at 28-40%"* — §9 **sizes** the long run, it does not cap it. The config
  says so in its own words, one line above the value.
- *"Nothing requires 26 km"* — **§80 requires it.** Measured on that sitting's own worst case, the
  peak long run is 208 minutes against a 210-minute cap. §24 was never the binding principle. The
  sitting removed the wrong horn from its own trilemma and then reasoned from the gap.

Then the urgency claim went too. The item's headline was *"11.4% of injury × fresh-return runners
get seven consecutive two-run weeks."* Constructed directly on today's engine: **1,224 plans,
zero firings.** Dumping all 129 plans that actually fire: **none has an injury history**, and
**116 of 129 sit at 12 km/week**. It is low-volume day-fitting, not injury trimming.

**And I nearly published that with a dead fixture.** The first run set `injuries: ['knee_pain']`.
There is no `injuries` field — it is `injury_history` — and `knee_pain` is not a value; the engine
substring-matches `knee`, `itb`, `achilles`, `shin`, `calf`, `plantar`. So it measured 1,188
healthy runners and called them the injury cohort. My own notes warn about this exact failure,
with the exact example. I caught it only because the fitness harness's cohort code used the right
field three lines from where I was reading. Re-run properly, and falsified: `['knee']` moves peak
volume 52 → 34 km and hill sessions 6 → 0. **The zero is real. The first zero was not.**

**Then the masters item died the same way, for a different reason.** `MASTERS-COMPRESSED-BUILD-01`
reported masters median build 17.4% against 28.6% for standard — an 11pp deficit, P1, sent to the
board. On the **full 39,632-plan grid** it is 19.2% against 20.0%, and masters is marginally
*better* on never-builds. `measure:fitness` samples **1,400 of 41,472 rows**. The stride is
coprime, which fixes prefix bias and does nothing about size. **An 11pp finding was 0.8pp.** The
mechanism it described is real — masters lose a build week, 9 → 8 — and costs almost nothing.

**AI-building.** Three of my four reproduction attempts failed, and one printed a confident table
from **zero generated plans** because every row threw and the catch was silent. I only noticed
because I printed `n` alongside the percentages. A measurement script is a check, and a check that
can return a clean-looking answer from an empty set is worse than no check.

**Product.** Nothing changed for a runner today. Two principles are now written down that were
being argued from memory, and two P1/P2 items are closed as measured non-problems rather than
sitting on the board's docket implying work.

## 2026-09-20 — S52-COMPOSITION-INV-01: my first version of the check fired on 45% of plans, and it was the check that was wrong

**Dev.** §64 says every week needs a rest day. Nothing anywhere said a week needs
*running* days. So a runner who told us four days could get two, for seven consecutive
build weeks, and every layer passed: §64 is satisfied (five rest days is not "no rest
day"), §52 is satisfied once the plan classifies maintenance, and §1's session-count
denominator just shrinks along with it. The Coaching Board found this on 2026-09-19 and
recorded the missing invariant as owed. This is it.

**The honest bit.** I wrote it to check `days_available` — the obvious reading, and the
one the board's own note uses — and it fired on **45.1% of the sweep, 6,435 of 14,253
plans**. Not a defect count. §18 *deliberately* declines to spread thin volume across
days it cannot fill, on the reasoning that "a runner on 12 km a week who selects seven
days gets seven ~1.7 km jogs, and no session in the week does anything". §18 says in
its own text that the prescription is correct. I had written a warn that fires on half
of all plans for doing the right thing, which in this repo is a guard with a shelf life
measured in days before someone switches it off.

The real defect is narrower and better: the producer computes its own floor,
`max(3, …)`, and the ADR-022 injury trim then floors at `max(1, …)` and never consults
it. **A floor computed upstream and discarded downstream** — the third instance of that
exact shape in a week. Checking against the producer's floor instead: **0.9%, 129
plans.**

**AI-building.** The re-scoped version needed a named constant, which looked like it
would breach the one condition the board could not meet — they deferred the instrument
precisely because every candidate needed a new number. It does not: the `3` has been
live since R23 as a literal, with its reasoning written beside it. Naming it is the
Configuration Singularity, not a new decision, and `verify:parity` came back **IDENTICAL
across 5,940 cases**, which is the proof rather than the claim. **Two hours ago I flagged
an IDENTICAL parity run as blind. Here it is load-bearing.** The difference is whether
the change could have altered output at all: a value-preserving extraction and a
non-mutating validator could not, so identical is confirmation. Same result, opposite
evidential weight, and the distinction is the grid — not the word.

**Product.** Nothing changes for any runner today. What changes is that the residual is
**counted**: 129 plans where the engine drops below its own floor, visible on every
sweep instead of being rediscovered by someone reading a plan. The fix that would
actually remove them is still deferred, and honestly so — the board built it, measured
it, and it pushed week 14 from 30 km to 34 km, straight through the injury ceiling
ADR-022 exists to hold. The open question underneath is **§80's specificity ramp versus
§90's injury ceiling, which nobody has ever ruled on.**

## 2026-09-20 — LOPSIDED-ORDER-01: I filed the wrong site, the wrong count, and the reason was a comment

**Dev.** §52 says a week whose long run exceeds 60% of its volume should be downgraded to
maintenance. The engine detected that ~450 lines before §90 Amendment 1's injury-quality yield
pass, which trims easy runs and then recomputes `weekly_km`. It never trims the long run. So the
share can only rise, and the producer had already committed to "not lopsided" — the invariant then
reported the runner's plan as defective for a shape the engine itself chose. **3 errors → 0.**

**The honest bit, three times over.** My own filing said the culprit was `applyWeekdayMinsCap`.
It is not: that pass trims sessions but never recomputes `weekly_km`, so it cannot move the ratio
the checker measures. The filing also said 2 plans; it was 3. And it warned that re-scoping this
had backfired on 2026-09-15 — true, but that attempt changed the PREDICATE and this one changes
only WHEN it runs, which is a different operation with a different blast radius. **The warning
was right to be there and would have been the wrong reason not to do this.**

**The one worth remembering.** The yield pass carries a comment: *"RUNS AFTER
`finalVolumeProfile`, deliberately."* Read literally, that made the fix circular — the thing I
needed to move down was the thing the pass depended on. It took reading the next twelve lines to
find that COMPLIANCE-FIX-3 had **deleted** the gate that justified it four days earlier, leaving
the explanation behind. A comment that outlives its code does not just mislead; it argues, in
good faith, against the correct change.

**AI-building.** `verify:parity` came back **IDENTICAL across 5,940 cases** on a change the sweep
proves altered three plans. That is not reassurance, it is the grid not containing the case —
exactly the FOUNDATION-LONG-RUNWAY-01 shape, where a clean parity run was quoted as evidence for a
change the grid was structurally blind to. I have now been on both sides of that sentence in one
week. The rule that actually holds: a harness reporting "unchanged" is making a claim about its
corpus, never about your change.

**Product.** The three plans are not gone, they are relabelled. They now carry `maintenance` and
fire §52 Amendment 1's declared warn — the plan is described honestly instead of being reported as
broken. That distinction is the whole reason §52 lists "downgrade to maintenance" as a remedy
rather than a failure mode.

## 2026-09-20 — BACKLOG-STALE-ALLTIME-01: the audit said ALL CLEAN because its list stopped at midnight

**Dev.** The founder said *"I'm sure you keep showing me things we have answered today or closed
off."* He was right, and `./scripts/audit-docs.sh` had reported **ALL CLEAN** minutes earlier.

Both were true. The backlog-staleness check reconciles open items against *today's ship scopes*.
Eleven items had shipped on 2026-09-18 and 2026-09-19, every one with a ship commit and a
feature-registry row, and every one still read open — because the only check that could see them
expired at midnight. `MARATHON-VOLUME-GATE-01`, a P0, had been closed for two days.

**Product.** The cost was not tidiness. It was that every list I put in front of the founder
carried a dozen items he had already settled, which makes the whole list untrustworthy — he cannot
tell which entries are real work without re-checking each one himself, which is the job the
document exists to do for him.

**The honest bit.** I closed eleven by hand, then wrote the gate, and the gate immediately found a
**twelfth** I had missed (`LEGAL-PRIVACY-01` — it shipped under another commit's scope, and my
manual pass was keyed on scopes). One hand-audit, one miss, on a population of twelve. That is the
same result this repo has recorded four times now: a manual audit is scoped to what you remember
working on, and the gate reads the register.

**The second finding, and the worse one.** `REFUSAL-THRESHOLDS-01` was open against a claim in
`docs/partners/make-a-wish-readiness-2026-09.md` — *"marathon with current weekly volume under 20
km, and half or longer with a longest recent run under 5 km."* Those numbers had been wrong
**twice over**: superseded by §111 on 2026-09-18 and again by §117/§118 today. It is the one
document that goes to the charity, and nothing mechanical could see it, because `audit-docs.sh`
watches contracts, registries and invariants — not partner-facing prose. **An audit is only ever
as wide as its list**, and that is now the third time this file has recorded that sentence about a
different list.

**AI-building.** The parse is the part worth keeping. `backlog.md` uses the same 🔴 glyph for item
STATUS and for in-item emphasis, which is why four attempts to count it produced four different
numbers. The discriminator turned out to be structural, not semantic: a real item header carries a
`*(provenance)*` block and an emphasis bullet does not. Registry reconciliation reads the row's
FIRST CELL, which is the rule `ship-record-check.py` already encodes and which a plain grep has
now got wrong twice in this repo.

## 2026-09-20 — §118: a bound I chose for readability was doing physiological work

**Dev.** The board twice ruled that zero rejection is unreachable by coaching, and twice escalated
the same question: what does a runner get *instead* of the marathon plan we cannot safely give
them? The founder answered it — a get-running plan.

The build was almost nothing. §116's ramp already existed and the board had already ruled it
correct **as a standalone plan**. Removing the marathon handover is what made it possible: the
proposal to drop the on-ramp floor was vetoed because a 3 km/week runner cannot be built to a
*marathon* in 29 weeks, and **a plan with no start line cannot miss it.**

**AI-building.** I set `GET_RUNNING_MAX_WEEKS = 16` and wrote the reason in the config: *"a plan
nobody can see the end of is not a plan."* That is a fine sentence about legibility.

Sixteen weeks of a lawful 10% weekly increase, under the standard deload cadence, compounds to a
**4.17× total build** — above the 4.0 ceiling the constitution already sets for exactly this
hazard. **Every individual week legal. The sum not.**

The week-on-week rule cannot see an endpoint. Nothing in the engine could. **A number I picked for
readability turned out to be setting a physiological limit, and I only found it because I went
looking for something else.**

**The honest bit.** I found the 4.2× myself and reported it to the board as *"a 7 km/week runner
ends at 4.2×"* — framed as a problem with one runner at the top of the range. The conflict scan
corrected me: every start lands on the same ratio. 2→8.3, 3→12.5, 5→20.8, 7→29.2 are all ~4.17×.

**It is a property of the curve, not the runner.** My framing would have sent someone hunting for a
per-runner cap when the fix was one number: fifteen weeks instead of sixteen, 3.79×, done.

That is twice today the scan has caught not an error of fact but an error of *framing* — earlier it
was a principle's worked example I had not read, now a per-runner claim about a per-curve property.
**Both would have produced correct-looking work aimed at the wrong thing.**

**Product.** Most of this cohort finish the fifteen weeks *above* the door for a real marathon
plan, with thirteen weeks to spare. So for most of them it is not a consolation prize, it is the
route back in. A 2 km/week runner does not clear it, and the refusal payload now carries a flag
saying which — so the copy can tell the truth per runner rather than in general.

And one thing filed rather than papered over: **no harness watches this plan kind.** Both our
measurement rigs are shaped around a race, and a raceless plan cannot be scored by either.
Inventing a bar so the column has a number in it is how decorative checks are born.

---

## 2026-09-20 — S117-PEAK-VS-TIME-01: the board contradicted itself, and the table settled it

**Dev.** §117 shipped dark yesterday because amendment 1 gave two numbers that don't reconcile: a
peak of 30–34 km/week **and** "repeated exposure to 3+ hours on feet". Under the 60% long-run cap
those are different plans.

So I priced both and put the table in front of them:

```
peak  door  longest run  time on feet  refusal rate
  32     8       16.5km         2h12       29.3%
  34     9       18.5km         2h28       29.3%   <- ruled
  42    11       23.0km         3h04       36.4%
  52    13       26.0km         3h28       45.5%   (today)
```

Buying the three hours costs **seven points of admission for thirty-six minutes**. Willy ruled on
his own words: *"the range was the number I priced."*

**AI-building.** Two things the sitting found that I hadn't.

**32 was strictly dominated.** 32 and 34 refuse identically — so 34 buys sixteen minutes on feet
and two kilometres of long run **for free**. I'd built it at 32 and never compared adjacent rows of
my own table.

**And the board's own archive answered the adequacy question.** McMillan, already on file from a
previous sitting: *"a runner who does a 17 km longest run and run-walks the last stretch
finishes."* 34 delivers 18.5. The conflict scan surfaced it; nobody had to remember it. That is the
second time this week the scan has been worth more than the discussion.

**The honest bit.** I went into that sitting with two findings and withdrew both before anyone
spoke.

I'd reported that §117's plans fail §80's bar of 70% of projected race duration. **That bar is
unreachable at any peak, and §80 says so in its own text** — the long-run cap is 210 minutes
against a 338-minute projected race, which is 62%. The standard plan scores exactly 62% *because it
is sitting on the cap*. I had measured against a floor that explicitly yields, then filed a second
finding saying the standard plan missed it too. Both wrong, same mistake, twice.

**Product.** Marathon 77.6% → 79.2%. The gate floor ratcheted **up** for the first time today —
every other move has been me correcting the ruler downward.

And the chair said the thing I needed to hear and pass on: **zero rejection is not reachable by
coaching.** At a 9 km/week door, someone running 2 km a week is fifteen times below the peak the
plan builds to. 45.5% → 29.3% is the ceiling. What the rest are offered instead is a product
decision, not a coaching one.

---

## 2026-09-20 — ZERO-REJECTION-01 / §117: I built it, measured it, and it didn't work

**Dev.** We reject 45.5% of people who ask for a first marathon. The founder's line was blunt and
right: that isn't happening. So: why do we reject them, and what would it take not to?

The mechanism turned out to be elegant. §111 refuses when the plan's peak is more than 4× the
runner's current volume. A beginner marathon peaks at 52 km/week, so the door sits at 13. **But 52
is the tonnage to *run* 42.2 km, not to *finish* it.** Build to 32 instead and the door drops to 8,
and nothing is loosened — the ramp rate, the deload cadence and the ratio are all untouched. The
door is downstream of the target.

Rejection fell 45.5% → 29.3%.

**AI-building.** Then I measured whether the plans were any good, and they aren't.

§80 says a finish-goal peak long run should reach 70% of projected race duration. §117's plans
reach **39–44%**. At a 32 km peak, §52's 60% cap tops the long run at 16.5 km — 2h12 against a 5h38
race.

The board's own amendment contains the contradiction: Willy specified a 30–34 km peak **and**
"repeated exposure to 3+ hours on feet". Three hours is ~21 km, which needs a 36 km week. **Both
numbers came out of the same sentence and they don't reconcile.** Only the board can say which
moves.

So it shipped dark. And the flag comparison is the honest bit: **77.6% fit either way.** With the
flag on, 1.3 points of rejection became 1.3 points of long-run-short. **I converted a rejection
into an inadequate plan and the scoreboard didn't move.**

**The honest bit — two, and both are about what caught what.**

The mandatory conflict scan **missed** the thing that mattered. §111's principle and its config are
both expressed as a ratio, and the scan read those. The *rationale* paragraph pins two raw volumes
— "≤10 km/week must be refused" — and §117 admits 10. **The test suite caught it, not the scan.** A
principle's worked examples are load-bearing, and reading only the rule misses them.

It turned out fine: the parenthesis in that sentence says "(≥ 4.7×)", so the ceiling was always a
ratio and a §117 runner at 10 km/week is 3.2× — inside a band the same paragraph explicitly
ratifies. But I only know that because a test went red.

And the second: I rewrote four tests to match the new door, then flagged the feature off, and two
of them broke again — because I'd hardcoded the *new* boundary in place of the old one. A test that
passes in one flag state and fails in the other is a record of which flag was set when someone
wrote it. They derive the boundary now.

---

## 2026-09-20 — P-16 / §116: two principles in deadlock, and neither sitting could see it

**Dev.** §111 refuses the sub-12 km/week marathoner and **names a base-building plan as the
remedy**. §57 builds base blocks. So the remedy existed — except §57 sizes every week as
`min(baseline × 1.1^i, baseline × 1.10)`, which means **from week two onward every week is
`baseline × 1.10`. Flat. At any length.**

§111's named remedy has been structurally impossible for as long as both have existed.

**AI-building.** The reason nobody caught it is the interesting part, and it is not carelessness.
**§57's own invariant checks a CEILING** — no foundation week may rise more than +10%. A flat block
never breaches a ceiling. So §57 passed its own check perfectly, every time, while failing to do
the one thing §111 was relying on it for.

**The failure mode of a ramp is the inverse of the failure mode of a gap-filler.** A gap-filler
fails by climbing too fast; a ramp fails by not climbing at all. One bound cannot catch both, and
the new invariant checks the opposite one.

**The honest bit — three, and they are all the same shape.**

My test fixture took an `over` argument and never spread it. **Eleven tests passed against the
default input**, testing nothing they claimed. Caught only because two of the thirteen failed. A
fixture that silently ignores its own argument is worse than no fixture: it manufactures green.

Then the second fixture used `fresh_return: true`. Not a field. The real one is
`weeks_at_current_volume`. The assertion read `expect(20).toBeLessThan(20)`.

Then the liveness gate rejected my first two mutations because they filtered for foundation weeks
and the corpus has none, so they bailed silently. **A mutation that cannot build the shape it
breaks is not a mutation.** Same lesson, third time in one build: the fixture, the field name, and
the corpus. Each time the thing was *shaped* right and reached nothing.

**Product.** 810-input grid, 362 §111 refusals: **76% would be offered a ramp** instead of a closed
door. Median six weeks. It ships **dark** — the SLT's "not for October" stands and the flag is how
that is honoured.

⚠️ And the caveat I nearly let slide: the property sweep comes back clean, and that is a
**construction** argument rather than a measurement. The flag gates a function the sweep never
calls. A clean sweep here is evidence the ramp is *inert*, not that it is safe.

---

## 2026-09-20 — TIER-TRIAL-CONFIDENCE-01 and the commercial batch: four items, one question

**Dev.** Six open commercial items went to the SLT. Four turned out to be the same question —
*is the thing we say about the product true of the product?* — and the answers split cleanly into
"fix the code" and "delete the claim".

The trial one is the embarrassing one. `featureGates.ts` has always said a trial user may have the
confidence score. `enrich.ts` asked `tier === 'paid'`. **Two files, one rule, disagreeing, and the
engine won** — so a trial runner got no confidence score while the homepage said *"Two weeks, full
access"* and the signup line said *"14 days, no limits."*

I filed it as blocking some unbuilt paywall copy. It was a false claim on the live homepage.

**AI-building.** The fix is one expression and I nearly wrote the wrong one. `tier !== 'free'`
matches every other gate and would have been correct today, and it is still **a second copy of a
rule another file owns**, which is the exact shape that caused the defect. It now asks
`isFeatureAllowed`. Same behaviour, one owner.

Then the test. I wrote four assertions and **three of them cannot catch the original defect**,
because they drive `buildUserMessage` directly and it takes a boolean. The only one that goes red
on a revert is the ugly one that reads the source file and demands the string `isFeatureAllowed`.
I nearly didn't write it, on the grounds that reading your own source in a test is inelegant.
Elegance would have shipped a green suite over the same bug.

**Product.** The pricing sentence said *"a projected finish from your real running, updated as you
train."* On 58% of plans there is no benchmark, so it comes from two wizard answers. We deleted the
two false clauses. Nothing rewritten: Traynor had already blocked softening the words until the
derivation qualifies, and Sutherland's framing is that **deleting a claim is the opposite of
softening**.

Hutchinson's note is the one worth keeping, though. The pricing page is the symptom. We render a
guess and a measurement in the same typeface with the same confidence. *"An experienced runner who
told us 'about 25k a week' and got back a finish time to the minute will conclude, correctly, that
we made it up."*

**The honest bit.** `pricing.test.ts` passed the entire time the claim was false. It proves every
paid gate has a row on the pricing page. It cannot prove the row is true, and nobody had noticed
those are different properties. **The guard held while the claim rotted** — and there are a dozen
more rows on that page with the same exposure and the same non-guarantee. Filed, and filed with
the warning that a check which merely *looks* like it tests truth would be worse than none, because
the existing green tick is what allowed this in the first place.

---

## 2026-09-20 — OPS-AI-OWNER-01: the scope reduction was priced against a duplication

**Dev.** Two open ops items: what does the AI cost, and is it failing. Both had been filed with the
same sensible-sounding caveat — *"instrument the two or three highest-traffic routes, do not
instrument all twelve."*

That caveat assumes instrumenting twelve costs twelve times as much. It only does if there are
twelve places to edit. There were **fourteen**, each a hand-written copy of the same `fetch` to the
same URL with the same headers, the same `content?.[0]?.text` extraction and the same silent catch.
They agreed by accident.

Delete the duplication and the choice evaporates. One owner, fourteen surfaces instrumented, and
the fifteenth instrumented on the day someone writes it.

**AI-building.** The thing I keep relearning: **a scope reduction is a measurement, and it inherits
whatever the codebase happens to look like.** "Don't do all twelve" was good judgement about the
wrong number. Nobody was wrong to write it — I wrote one of them. It just encoded a structural
defect as a cost, and then the cost argued for leaving the defect in place.

**The honest bit.** Two things I'd rather not write down.

First, `git checkout` on a file I had edited but not committed reverted my conversion, not just the
one-line probe I had appended to falsify a gate. I only caught it because a *different* test — the
surface-vocabulary one, which asserts every declared surface has a call site — went red and named
`adjust-plan`. A test I wrote twenty minutes earlier for an unrelated reason is the only thing
standing between me and silently shipping thirteen conversions out of fourteen.

Second, writing the falsification test made me look properly at `await recordOpsEvent(...)` sitting
unguarded in the owner. `recordOpsEvent` documents itself as never throwing, and it's careful about
it. But awaiting it unguarded makes that promise load-bearing for **every AI call in the product** —
one unhandled rejection in telemetry takes down the coaching surface the telemetry exists to watch.
I had written the test asserting the *current* behaviour, which is to say I'd written a test that
locked in a fragility. Changed the code instead. A monitor must not be able to break what it
monitors, and "the function promises not to" is not a mechanism.

**Product.** The dollars are still an estimate — a price list copied by hand that nothing here can
reconcile against Anthropic's billing. The **tokens** are real. The distinction is in the contract,
the code and the response payload, because the failure mode is a plausible-looking total that
quietly omits a model. Unpriced calls return `null`, never `0`.

---

## 2026-09-20 — RUBRIC-GAPS-01: the metric watching our biggest exemption had never been written

**Dev.** §18 Am. silences a coach objection when the plan declares the shortfall. That exemption
raises the fit-for-purpose rate by about 18.7 percentage points — its own comment says so, and
says it is legitimate only because the prescription was measured correct first.

The metric meant to keep watch on it was declared in the rubric and never implemented. **It
reported 0% because nothing called it.** That is the decorative-config defect, living inside a
measurement rather than a config file.

**Product.** Written, it says: `DAYS-SHORT-SILENCED` fires on **49.4% of 5K plans**, 29% of 10K,
21.5% of half marathons, 11.7% of marathons. Nearly half of 5K runners are getting fewer days than
they asked for. That is correct, it is declared to them, and the board ruled it right. **What was
wrong is that nobody knew the size of it.**

**AI-building.** The mechanism is a `watched` flag on a finding: exempted-but-counted is neither
scored nor hidden. Scorers exclude it, reporters show it, and it is printed **beside the number it
inflates** rather than somewhere else — an exemption reported on another screen is an exemption
nobody reads. It is diffed in both directions and I falsified the diff before trusting it.

**The honest bit.** The failure this now catches is the subtle one: **a fit rate that holds while
an exemption's rate climbs.** The exemption absorbs the regression and the headline number never
moves. A fit-rate-only diff cannot see that, and until today we only had a fit-rate-only diff.

## 2026-09-20 — GRID-EARLY-ONSET-01: the item was stale, and checking it found a stale number underneath

**Dev.** Filed as "zero of 45,776 corpus plans reach ADR-021's early-onset cell". I went to widen
the grid and measured first. The cell holds 3,456 inputs and the gate fires on 47% of them.
`GRID-COVERAGE-02` had closed it weeks ago by adding the `recent_quality_training` axis, and
nobody updated the filing.

**Product.** Nothing changes. That is the outcome: an hour of measurement instead of doubling the
runtime of two harnesses to fix something already fixed.

**AI-building.** The thing worth keeping is what the check found *underneath*. The grid's own doc
comment says it produces 31,104 inputs. It produces 41,472. CLAUDE.md warns that the grid "has
been widened five times and the count moves, so read it from the file, not from here" — **and the
file was wrong too.** A stale number in the place you are told to trust is worse than no number.

It is a gate now, not a comment: the test asserts the produced size, and that the comment states
the same number. Widen an axis and it fails, so the doc has to move with the code.

**The honest bit.** I nearly widened the grid on the strength of the filing. Two of the last three
governance items I picked up were already closed or already wrong. **The backlog's prose decays
faster than its records, and the only defence is measuring before building.**

## 2026-09-20 — RACE-KEY-TWO-OWNERS-01: it was filed as two copies and it was three

**Dev.** `raceDistanceKey` answers "what do we call 42.2 km". It existed three times. The producer
in `generationConfig`, and **two different ladders inside `invariants.ts`** — one disagreeing with
the producer, one agreeing with it. So the validator disagreed with the engine *and with itself*,
in the same file, and nobody had noticed because nobody had grepped for the third.

**Product.** 88 distances between 1 and 120 km where the engine builds one race's plan and the
validator judges it as another. Zero of them reachable: the wizard offers six fixed values and all
six agree.

**AI-building.** That last fact is the whole argument for doing it today rather than filing it
again. It goes live the moment someone adds a custom distance or a seventh preset that lands in a
band, and **right now the fix is provably free** — parity identical across 5,940 cases.

**The honest bit.** This repo has a rule that says the opposite of what I just did:
`deloadCadence.test.ts` forbids a checker sharing the producer's predicate, because a checker
re-using a decision cannot catch the decision being wrong. I had to work out why that rule does
not apply here rather than assume it doesn't. **A distance key is not a decision — it is a
vocabulary mapping with one right answer.** A checker that independently re-derives a *name*
verifies nothing; it only creates an opportunity to disagree about a label. The judgements keyed
by that name stay independently checked, which is where the verification actually lives.

## 2026-09-20 — SWEEP-INJURY-01: a freeze that outlived its reason

**Dev.** The sweep's injury axis had six entries and the product offers six values, but they were
not the same six. `'Plantar fasciitis'` was missing, and the comment explaining why was honest:
the axis had been frozen during an earlier fix so the seeded sample would not re-roll and rates
stayed comparable.

**That comparison finished weeks ago.** The freeze did not.

**Product.** Adding it re-rolls the sample, so two baselines moved — one up, one down. Neither is
a regression and neither is an improvement: **the population did not change, the sample did.** I
declared both in the baseline rather than quietly writing the new numbers, because a number that
moves without a stated reason is indistinguishable from a number someone nudged.

**The honest bit.** This is a small item and the interesting part is the shape of it: a temporary
measure with a good reason, left in place after the reason expired, with a comment that read as
current. **The comment was true when written and false by the time I read it** — which is the
same failure as a stale state paragraph, in a file nobody thinks of as documentation.

## 2026-09-20 — SWEEP-AGE-01: the gate said "covered" because the field took two values, and both were wrong

**Dev.** The property sweep pinned `age: 35`. The hand-written corner cases used 40 to 43. The
masters threshold is 45. So **§3's masters deload cadence had never run in the sweep, once, ever** —
and the input-coverage gate reported the field as covered the whole time, because it counts
distinct values and there were two.

**Product.** Adding the axis surfaced 47 violations across five invariants, 45 of them masters, 25
of them ERROR severity. Not new defects. Defects that were always reachable and the corpus could
not reach.

**AI-building — and this is the bit I nearly got wrong.** My first read was that the sweep is
seeded, so adding a `pick()` re-rolls every subsequent draw, and these were just plans the old
sample never happened to draw. Plausible, tidy, and **wrong.** I printed the ages instead of
asserting: 46, 55 and 62 accounted for 45 of 47. Then I varied only age on a real failing input
and the boundary landed exactly on 45. **The difference between those two stories is a coaching
defect in a real cohort versus a shrug, and only measurement tells you which.**

**The durable half.** The coverage gate now checks that numeric axes cross the thresholds the
engine branches on. *"Covered" has to mean both sides of every branch, not more than one value.*
I falsified it by narrowing the axis back to where it was — it goes red and names the exact
condition that had existed for a year.

**The honest bit.** I baselined 45 violations rather than fixing them, because every candidate fix
changes what the engine prescribes and that is not mine to decide. Baselining makes debt visible
and stops it growing. **It does not make it shrink, and nothing in this repo schedules it.**

## 2026-09-20 — P-01, REFRAME-NOTE-LOSS-01, CONSENT-DISCLOSURE-01: I shipped three strings and two were wrong

**Dev.** Three pieces of copy went out today flagged for sign-off rather than left blank. The
founder sent them to the SLT. Two came back wrong.

**Product.** The pill that said **"Held the zone"** and **"Drifted above"** now says **"Done"** in
every state, with the colour carrying the meaning. Sutherland: *"you've built a language and then
written a subtitle explaining it — a glossary entry is what you write when you don't trust the
thing you made."* And the disclosure line at the Health-connect moment is gone entirely; only the
link remains. *"You are standing at a door marked Health data and volunteering 'we never send your
name to the AI'. Nobody asked."*

**The one that survived got better.** *"Your note is kept"* now leads the sentence instead of
trailing it, because the failure state is a better advert than the success state: almost no
software keeps anything it didn't have to.

**AI-building.** Wood did something worth recording. She has used the kill mandate twice this
week and did **not** use it here, and the distinction was precise: an after-the-fact verdict is
not the illusion-of-progress class, because it isn't pretending to be an intervention. The
intervention is the ceiling, shown **before** the run. The verdict is what teaches the ceiling to
mean something. *"The colour is the code. The word is instruction, and instruction is the thing
you stop needing."*

**The honest bit.** I wrote *"I am not confident in it"* about "Drifted above" in my own
submission. That was the finding, and I'd shipped it anyway rather than leave a surface blank.
Shipping flagged is better than shipping silently — but two of three flags turning out to be real
is not a good ratio, and the right read is that **"flag it and move on" is a weaker habit than it
feels like.**

Also recorded: Traynor's dissent on the pill lost on *mechanism*, not taste. He argued the word
made the paid tier legible; it can't, because it only renders for someone who already has run
analysis. Worth keeping, because it is the best case for the other side and it will be made again.

## 2026-09-20 — ENRICH-PII-MINIMISE-01, LEGAL-PRIVACY-01, CONSENT-DISCLOSURE-01: the guards caught me three times in one afternoon

**Dev.** Legal and privacy, in the order the SLT set: stop sending the name, then rewrite the
policy, then add the line at the Health-connect moment. The order was the point. Rewriting the
policy first would have produced an accurate description of a transfer we were about to stop
making.

**Product.** The strongest line on the privacy page is now **"we do not send your name"**, and we
can only write it because the code change came first. The model gets a `{{RUNNER}}` token and we
put the name back on our own servers before anything is stored.

**AI-building.** I nearly resolved the token at render time instead. That would have been wrong:
coach notes persist in the plan JSON and are read by a long tail of surfaces, so one missed read
site shows a runner a literal `{{RUNNER}}`. Substituting at the boundary means the token cannot
leak by omission.

**The honest bit — three guards caught me, and none of them was mine today.**
1. The **em-dash rule** flagged my own privacy copy. Twice. Including inside a code comment.
2. **`externalLink.test.ts`** caught a bare `<a href="/privacy">` in the app shell. Inside the
   Capacitor webview that replaces the whole app with the marketing site and the runner has no way
   back. I would not have found that by reading.
3. **`freeIntro.test.ts`** failed because it asserted the prompt carried the runner's first name.
   It was right to fail — and the fix was to assert the stronger property, not to delete the test.

The uncomfortable read: every one of those was a rule someone wrote down earlier, doing its job
on me. The rules I wrote today will do the same to someone else, which is the only reason to
write them.

## 2026-09-20 — P-03 and P-01: we built the best idea in the category and put it on one screen

**Dev.** `easyPaceAsCeiling` turns "7:11–8:32 /km" into "7:11 /km or slower". It has existed
since CD-11, has ten unit tests, and carries its own reasoning: an 81-second window reads as a
target a runner can fill the whole of; the point is the cap.

It was called from one place. Session Detail. Not Today. Not Plan.

**Product.** The competitor teardown that started this week called the pace ceiling *"the most
Zonna-shaped idea in their entire app"* — and they had buried it as a grey subtitle behind a
paywall. We had it at full strength, tested, in voice, and on a screen you have to tap twice to
reach.

**AI-building.** The fix is one function call. What took the time was proving it changes nothing
else: 12 plans, 748 sessions, 656 easy runs transformed, zero quality or long or race sessions
touched. And writing a test that fails for the right reason — a unit test on the function would
have passed throughout, because the function was never broken. **Reach was the defect, not
correctness**, so the test asserts reach and I falsified it by deleting the call.

**The honest bit.** I listed the wizard preview as a third missing surface in the gap analysis.
It isn't — the preview shows phase summaries and never renders a per-session pace. Corrected in
the registry rather than quietly dropped.

## 2026-09-20 — P-13b: the guard had a hole the width of a colour channel

**Dev.** The pre-commit hook blocks hardcoded hex colours and has done for months. It does not
look at `rgba()`. So the same value, written differently, walks past it — and 26 of them had.

**The one that matters.** `GeneratingCeremony.tsx` was rendering `rgba(91,192,190, 0.14)`. That is
`#5BC0BE`, the retired System-B teal, which this very hook blocks in hex form and which CLAUDE.md
lists as banned. It renders in the shimmer on the generating screen — **the one screen every
single runner sees.** The comment directly above it named the colour. Nobody was hiding anything.
Nobody had looked, because nothing looks.

**Product.** Triaging all 26 by hand mattered more than sweeping them: 17 were palette colours at
alpha and are now tokens, **6 were pure white or black scrims and are legitimate** — there is no
token for a scrim and there should not be one.

**AI-building.** The rule is deliberately quiet for a reason this repo has written down twice: a
guard that fires on ordinary work gets switched off, which is the same as having no guard. It
only matches a non-greyscale triple. I falsified it 7/7 in both directions before trusting it.

**The honest bit.** My own comment explaining the banned colour tripped the new rule. The right
move was to reword the comment, not weaken the guard — the hook cannot tell a comment from code,
and a banned colour should not be greppable in that file at all.

## 2026-09-20 — REFRAME-NOTE-LOSS-01: the principle was written down, then broken by the branch next to it

**Dev.** `REFRAME-NOTE-LOSS-01`: a runner writes a reflection, the AI call fails, and the route
returns before the line that saves it. Their words are gone. The client then puts them back at an
empty box and says nothing.

**The bit that stings.** Three hundred lines earlier in the *same route*, the risk-gated path
persists the note with the comment *"the runner's note is sacred even when we don't reframe."*
Same route, same table, same field, opposite behaviour. **The principle was written down and then
broken by the branch next to it** — which is a better argument for single-owner functions than any
architecture diagram.

**Product.** Only two of the three failure modes are outages. The third is our own quality filter
rejecting a cheerleading answer we had already paid for — the model replied, we binned it, and we
binned the runner's reflection with it.

**AI-building.** I fixed it by extracting one `persistReflection` rather than adding a third
upsert, and by pulling the client's view decision into a `.logic.ts` file. That second one was not
tidiness: a test asserting on the *shape of the route source* would pass on a comma change and
fail on a refactor. The view decision is the half the runner actually experiences and it is pure.

**The honest bit.** A thrown fetch still returns to `input`, not `saved`, because we genuinely do
not know whether the server ran. Claiming "saved" there would be the same class of lie in the
opposite direction. And the new state's copy is pattern-setting, so it ships flagged for sign-off
rather than quietly.

## 2026-09-20 — MARA-LR-LOWBASE-01: the note pointed an injury-history runner at the one lever they must not pull

The founder asked for every open coaching-engine item analysed and taken to the board, with one
hard constraint: we are at 95.9% fit-for-purpose and he does not want it spent.

**Dev.** My list of 16 open engine items was wrong in both directions — five were closed and one I
had missed. The reason matters: the backlog is not the live engine register, `roadmap.md` is, and
nothing says so. Checking every ID against the feature registry took ten minutes and removed a
third of the list.

**Product.** The P1 item was `MARA-LR-LOWBASE-01`. Measuring the interaction it told me to examine
first produced the thing I did not expect: at the same weekly volume, a knee-history beginner gets
a 17 km peak long run where a healthy runner gets 26. Same volume. Different long run. So when the
note told the injury runner *"your weekly volume is what limits it"*, it was not just vague — it
was **pointing them at the one lever their history says not to pull.**

**AI-building.** The board did not let me fix the plan, and it was right not to. §9's structural
finding lists ten instruments built and measured, every one trading one defect for another. Willy:
*"17 km is the correct ceiling and I am not moving it."* The plan was already correct. What was
wrong was a sentence.

**The honest bit.** Two things I got wrong today. I took the base-build on-ramp to the board this
morning without an SLT record from the day before that made it unworkable — the refusal throws 94
lines before the block is composed, so a pre-plan block can never rescue a refused runner. And my
falsification test failed on its first run, correctly: two arms share one invariant code, so
asserting on the code cannot tell them apart. Both were caught by reading rather than by a check,
which is the uncomfortable part.

⚠️ And the thing I could not fix: a healthy 8 km/week runner is refused while their knee-history
twin is admitted, because the injury cap lowers the peak, which lowers the ratio, which passes.
**The injury protection is functioning as an admission mechanism.** That stays open.

## 2026-09-20 - ENVELOPE-BASELINE-01 - a gate that only fails downwards is half a gate
**Shipped:** the fit-for-purpose rate is now a recorded, diffable baseline instead of a floor, so two review rounds can actually be compared.

**Dev learning:** The founder asked whether we had captured enough to run the same coach review again and compare like with like. The honest answer was no, and the reason is a nice one. We had floors: each distance must not fall below a number. That catches a regression and is completely silent about an improvement, so after any change the only way to answer "is this better, and where?" was to re-derive the numbers by hand. Which is exactly the failure that made the board look inconsistent: a measurement nobody wrote down.

**A gate that only fails in one direction is half a gate.** The baseline now fails on movement either way and names the distance and the delta, because an undeclared rise is still an unexplained change in what runners receive. Re-baselining stays a deliberate act with a reason in the commit.

**Worth noting what is still not comparable,** because writing that down is the other half of the answer. The generated plan text is gitignored for size, so old rounds cannot be diffed as documents; plan-level change detection is the parity harness, which hashes nearly six thousand cases. And the population weights are assumptions, so if they move, every historical number becomes incomparable. That is why they live in one reviewable object with a written argument per band.

**The pleasing part:** making the test and the script share one computation collapsed six separate walks over the corpus into one, which freed more duration budget than the new check costs.

---

## 2026-09-20 - M4-NOT-A-REFUSAL-01 - the plan we told everyone we refused
**Shipped:** a test persona labelled a refusal for months turns out to receive a perfectly good plan.

**Dev learning:** The founder asked why one plan in the review was an exception, saying he expected that profile to be our most common user: a busy person, three days a week, wanting a time. I went to check and the answer was that we do not refuse them at all. Our refusal error carries two modes and only one of them is a refusal. The other is a confirmation prompt: the runner is told the honest thing, clicks that they understand, and gets their plan. The persona had been written on the belief that it was a hard refusal, with a comment saying so, so every review round printed a red mark and every board sitting reasoned about someone we turn away who we do not turn away.

**The part that stings is that I had already found this exact bug that morning,** in the population model, where two and a half thousand confirmation prompts were being counted as refusals. I fixed it there and did not go looking for the same pattern anywhere else. It was sitting in the corpus the board actually reads.

**Fixing it took the corpus to zero refusal coverage,** because that persona was the only one anyone believed was refused. So a real one went in: a marathon off an eight kilometre a week base, a genuine block that no amount of clicking will clear.

**And the mislabel had been hiding something.** The moment the plan started generating, the quality audit flagged a lopsided week in it and the fitness harness flagged that the refusal had flipped. Both caught it within seconds. Neither could ever have seen it while the corpus insisted the plan did not exist.

---

## 2026-09-20 — COACHING-RULINGS-REGISTER-01 · the board was not changing its mind
**Shipped:** a standing register of coaching rulings, a four-step sitting protocol, and a gate that fails the build when a review round's outcome is never written down.

**Dev learning:** The founder asked several times, with increasing patience, why the coaching board gave a different answer every time it was shown the same plans. I had been explaining it as different samples and a changing engine, both of which were true and neither of which was the cause. The cause is that the script which generates a review round writes a stub saying "fill this file with the ruling", and nobody ever filled it. So every sitting was convened by looking at the plans, with no record of what had already been decided about them. Two items came back inside twenty-four hours: one the board had explicitly withdrawn because my premise was false, and one it had explicitly closed. I presented both as new findings.

**A process whose memory depends on someone remembering to write it down has no memory.** The fix is a register read before the plans, a rule that any finding is checked against it before it is spoken, and a build failure if a round's ruling is never recorded. The gate found a second round that had been sitting unrecorded for five days, whose ruling existed in another folder and which simply never pointed at it.

**The honest bit:** the first version of the gate searched for the phrase "REVIEW PENDING" anywhere in the file, so it flagged the document I had just written explaining what that phrase meant. A guard reading prose instead of a marker, which is the thing I keep catching in the engine and had just done myself. Anchored it to the line.

**And the point of all of it:** the first sitting run under the protocol produced twenty-four of twenty-seven proud to hand over and, for the first time today, no new issues. Every live objection resolved to something already ruled or already filed. That is not because the plans improved in the last hour. It is because the sitting could finally see what the previous sittings had decided.

---

## 2026-09-20 — HM-WEEK1-PERRUN-01 · choosing the worse number on purpose
**Shipped:** the weekly ratio becomes a screen and the per-run step the confirmation. Half marathon 88.2% to 96.2%; every distance now at or above 90%.

**Dev learning:** The half's entire gap was one rule firing on one cohort: people running ten kilometres a week. Their week one is a five-point-three kilometre long run against a five kilometre longest-ever, and two half-hour easy runs. Across every plan that rule flagged anywhere in the product, the worst single-session increase beyond what the runner had already done was five hundred metres. A weekly total is not a training stress. A session is.

**The decision I want on record is the one where I took the worse number.** Two thresholds worked. The looser one scored a point and a half higher and would have kept only twelve percent of the flagged population; the tighter one keeps half of it. The board's chair had already objected, not to the evidence but to the pattern: this same predicate had been measured, found harmless and loosened three times in a single day, and each time our headline went up. Picking the bigger relaxation because it scores better is that pattern wearing a lab coat. So the rule is frozen now until we have actual outcome data rather than another corpus measurement.

**The honest bit:** I wrote a marathon non-regression test, and it failed at eighty-seven point three percent while the same measurement elsewhere said ninety point one. Different sampling stride. I had set the threshold from one measurement and tested it with another, which would have gated a board condition on noise. Deleted it and moved the condition to the file that already owns per-distance floors. That is twice this week I have duplicated a check and had the duplicate disagree with the original.

---

## 2026-09-20 — WEEK1-FLOOR-SHORT-DIST-01 · we were scoring our own caution as a defect
**Shipped:** the week-1 step is measured against what the runner actually runs. 10K goes 78.3% to 99.4%; the whole product reaches 92.9% and is inside the 90-95% target.

**Dev learning:** The 10K was our worst distance and every point of the gap was one rule. That rule compared week one against a figure we had deliberately reduced: when an experienced runner turns up on low mileage we assume they are coming back from a layoff and scale their starting volume down for their own protection. Then we measured the plan against the reduced number and recorded the difference as a defect. Beginners scored a perfect hundred percent because beginners are not scaled. That inversion was the tell, and it took four hours of building engine fixes before I looked at it.

**The precedent nearly read as a blocker and was actually the argument.** The board had moved a sibling rule the opposite way the day before, onto the scaled figure. The reason both changes share is one sentence in that ruling: the gate scored a ratio no runner experienced. For the sibling rule, the experienced quantity is what the engine builds from. For week one it is the step from the mileage you actually run to the week you are handed, and the scaled figure is overridden by a floor before the plan exists. The runner never sees it.

**The honest bit:** I encoded a board member's binding condition literally and it made the engine worse. He said the fifteen-kilometre weekly jumps must stay visible. I wrote "flag anything over ten kilometres", which also caught a runner on ninety kilometres a week being given a hundred: a eleven percent step, ten kilometres spread over six runs, and it knocked seven points off our hundred-kilometre score. He had said a step that is big for the runner, and I heard a big number. The fix is a proportional guard, and the test now asserts both halves so the next person cannot make the same substitution.

---

## 2026-09-20 — REFUSAL-IS-AN-OUTCOME-01 · we were counting our best behaviour as a failure
**Shipped:** a correct refusal now counts as fit for purpose. Whole product 85.3% to 87.0%; the marathon goes 73.9% to 90.1% and is in target.

**Dev learning:** The founder pointed out that refusing someone for the right reasons is a good outcome, not a bad one, and the rubric had been scoring every refusal against us. That is true, and I could have just added the number to the numerator. Instead I checked whether each refusal deserves it, because "count all refusals as wins" is exactly how a metric stops meaning anything. The standard already exists in our own doctrine: a refusal has to say "not yet" and name what to do next, never just "no". One class passes that test in every single case. The gate now fails if any distance ever refuses someone without giving them a route back.

**The bigger find was that one of our two refusal types was not a refusal.** It carries two reasons, and the common one is a confirmation prompt: the runner sees a warning, ticks a box, and gets their plan. My population model never ticked the box, so two and a half thousand people who would have received a plan were counted as turned away. I had built a model of a runner who never clicks "yes, I understand", which is a model of nobody.

**The honest bit:** I nearly reported the wrong number. Three text replacements went into the test file, and one of them silently matched nothing because an earlier fix had already rewritten that block. So the test said 79.3% and a script I wrote separately said 90.0%, and only the fact that I had two measurements stopped me publishing the first one. Every replacement in this session now asserts how many times it matched. A silent no-op is worse than an error, because an error tells you.

---

## 2026-09-19 — WEEK1-LEAP-ABS-01 + ULTRA-LR-BAR-01 + ENVELOPE-COHERENCE-01 · three times the measuring stick was the broken thing
**Shipped:** three criterion fixes, no prescription change between them. 5K reaches 100% fit for purpose; whole product 66.7% to 85.3%.

**Dev learning:** I spent the day building an instrument to answer "are we serving our runners", and then found three separate places where the instrument was wrong rather than the engine. The long-run check demanded a fifty-five kilometre training run for a hundred-kilometre race and failed forty-six of forty-eight ultra plans, which is why ultras first read zero percent fit for purpose when they are the best-served distances we have. The week-one check flagged a runner going from four kilometres to five as a forty-three percent leap. And my own weighted population contained a "beginner" running fifty kilometres a week, worth seven percent of everything, contradicting the engine's own definition of what beginner means.

**The pattern in all three is the same:** a rule that is correct in the middle of its range, applied at an edge where the arithmetic stops meaning anything. A percentage on a four-kilometre base. A proportion of race distance at a hundred kilometres. Two axes multiplied together that a real person does not vary independently. None of them was a bug in the sense of a wrong line of code; all three produced confident, specific, wrong numbers.

**The honest bit:** the envelope one is the one that stings. I wrote a header criticising our existing grids for treating every combination of inputs as equally likely, and then built a grid that treated level and volume as independent, which is the same mistake in the same file on the same day. I conditioned training age on level because I was thinking about it, and did not condition level on volume because I was not. Thirteen point six percent of the population I was measuring could not exist.

**Also fixed two things while proving a third:** the ultra reconciliation was living in a test rather than in the predicate it reconciled, so the audit and the envelope disagreed about what a defect was. And a dead exported table went with it, because nothing read it and a table nothing reads is the thing we have a test to catch.

---

## 2026-09-19 — FREQ-SILENCE-01 · we were overruling people and not telling them
**Shipped:** when weekly volume rather than the runner's life is what limits their running days, the plan says so. 5K fit-for-purpose 50.6% to 91.8%; whole product 66.7% to 78.0%.

**Dev learning:** Nearly one plan in five gave the runner fewer running days than they said they had, and said nothing about it. The engine is right to do it: five kilometres a week spread over six runs is six eight-minute jogs and none of them trains anything. But the runner filled in a form saying six days, opened a plan showing three, and got no explanation. That is not a coaching mistake, it is a manners mistake, and it was the single biggest thing standing between us and the target.

**The part I nearly got wrong:** I watched a plan hold three runs a week while volume climbed from five kilometres to seventeen, and started writing it up as a frequency bug. It is one line of arithmetic — the floor is five kilometres per training day, and seventeen divided by five is three. The cap was doing exactly what its own comment says it does. I have now written a test whose only job is to stop the next person filing that same non-defect, because I would have.

**The honest bit:** this fix raises our headline number by eighteen points by adding a sentence, not by changing a single session. That is legitimate only because I measured the prescription first and found it correct, and it would be very easy to do the same trick when the prescription is wrong. So the test strips the note back out and checks the complaint comes back. If the day ever comes that the underlying cap is wrong, this exemption hides it, and I would rather write that down now than discover someone leaning on it later.

---

## 2026-09-19 — COPY-STALE-GEN-01 · the fix was already written and the generator could not reach it
**Shipped:** ninety-six plans that shipped invalid now generate clean. Zero error-severity violations across the whole weighted population.

**Dev learning:** A week told the runner "recovery plus benchmark, one hard effort in the middle" and contained three easy runs. There is a function in this codebase whose entire job is to notice that and rewrite the copy. It had one caller, and that caller was the reshape endpoint. So a plan born with stale copy stayed stale forever unless the runner happened to move a session later. The fix was four words long: call it on the generation path too.

**The interesting part is why the copy went stale at all,** because it is the second time today. The label is computed from a fact, not a guess: does this week contain a hard session. It was correct when it was written. Then a later pass removed the hard session and nothing went back to re-read the sentence. This morning the same shape cost me a fuelling note: a long run measures 116 minutes when the note is written and 124 by the time the runner sees it. Anything computed in the middle of a pipeline is stale by the end of it, and copy about sessions has to be written after everything that can move a session.

**The honest bit:** fixing the copy fixed half of it. The other invariant kept firing on all ninety-six, because the plan's metadata listing which weeks are benchmark weeks is built in the same loop and rots in exactly the same way. The principle governing it already says, in writing, that the metadata follows the produced plan and never the intent. It was right; it just ran too early. I would have shipped a half-fix and called it done if the second invariant had not still been red.

---

## 2026-09-19 — ENVELOPE-ALL-DISTANCES-01 · we had been watching one distance and it was not the worst one
**Shipped:** the 90-95% target measured and gated for every distance. 5K 50.6%, 10K 59.3%, half 70.3%, marathon 67.4%, 50K 91.6%, 100K 89.9%. Whole product 66.7%.

**Dev learning:** Every board sitting this month has been about the marathon, because the marathon is the priority and the charity cohort is real. The moment the same measurement was pointed at the other five distances, the 5K came back as the worst thing we make. Nobody had looked, not because anyone decided not to, but because the measurement only existed for one distance and a measurement that only covers one thing quietly becomes the definition of the thing that matters.

**The two dominant faults are not marathon faults at all.** Nearly one plan in five tells the runner they can train six days and then prescribes three, with no note explaining why. One in seven starts week one more than thirty percent above the volume the runner actually said they were running. Both cut across every distance and neither had a name until today.

**The honest bit:** my first all-distance number was 52.4% and a chunk of it was my own criteria being wrong. The long-run check demanded a fifty-five kilometre training run for a hundred-kilometre race, which no coach on earth prescribes, and it fired on forty-six of forty-eight ultra plans. I had actually written that risk into the file header an hour earlier and then reported the contaminated number anyway. The reconciled figure is 66.7%. Separately, the harness found eight hundred-kilometre plans that violate the engine's own constitution and ship anyway in production, because the validator only throws in development. The property sweep has been green on those for as long as they have existed, because its grid cannot build that runner.

---

## 2026-09-19 — USE-CASE-ENVELOPE-01 · we had been judging the engine on the wrong denominator
**Shipped:** a weighted definition of who our runners actually are, and the first real answer to "are 90-95% of use cases fit for purpose". It is 75.4%.

**Dev learning:** The founder asked why the answers keep changing. The honest reason is that I kept measuring different populations and calling them the same thing. Every corpus we own is uniform — it treats a ten-kilometre-a-week marathoner as exactly as likely as a thirty-kilometre-a-week one. That is the right design for hunting defects and the wrong one for answering "are we serving our runners", and nobody had written down which question was being asked. The same engine, measured the same day, refuses 32% of marathon inputs on a uniform grid and 18.3% of a weighted population. Both numbers are correct. Only one of them is about people.

**Product learning:** writing the weights down was uncomfortable, because we have no data to justify them. One analytics event exists in the entire product and no charity code has ever been redeemed. But the alternative was not "no assumption" — it was the assumption already buried in a uniform grid, which is that every combination of inputs is equally likely, and that one is definitely wrong. A named, argued, reviewable guess beats an unnamed one you cannot argue with.

**The honest bit:** my first run reported 66.2%, and two of the gaps were my own measurement being wrong. I counted plans that never build as failures when most were correctly classified as maintenance with a note explaining it — a reconciliation an earlier review had already done and written up, which I then repeated the error of. And I reported 2.1% of plans "falling short in silence" because my check looked for three note fields and missed a fourth that was saying exactly the thing I claimed was missing. Corrected, the number is 75.4%. I have now made the denominator mistake enough times this month that it should be the first thing I check, not the third.

---

## 2026-09-19 — LONG-SESSION-FUEL-01 · the rule already existed, gated on the wrong thing
**Shipped:** a long run long enough to need fuel now says so at every distance, not just for ultras. Two other review items closed by measurement.

**Dev learning:** I went looking for a missing principle and found a present one pointed at the wrong population. The fuelling cue had been written six days earlier, by the same board member, for the same hazard — and gated on the race being a 50K or 100K. A three-and-a-half-hour run is a three-and-a-half-hour run whether it is training for an ultra or a first marathon. My conflict scan missed it because I grepped section headings and it lives as a sub-section, so I was one step from adding a second, parallel fuelling note to a codebase whose whole doctrine is single ownership. The check that saved me was reading the code around the place I was about to edit.

**AI-building learning:** the first version of the fix read the session's duration at the point the session is placed in the week. That number is wrong. At placement one runner's peak long run is 116 minutes; by the time she sees it, it is 124, because something downstream lengthens it. So the cue silently skipped every session sitting just under the threshold, which is the worst possible failure for a safety note — it works for the obvious cases and vanishes for the marginal ones. The invariant caught it on the first run, which is the entire argument for writing the rule and its check in the same commit rather than promising the check later.

**The honest bit:** three items came out of the board review and I reported all three as "referred on". The founder asked why I was not just doing them. Fair. One dissolved the moment I read the note the plan already produces — it says "take the walk breaks early rather than late", which is exactly the thing I had told the board was missing, and no board member checked it either. One was already closed by a measurement I had run that morning. Only the third was real work. I had turned "I have not checked" into "this needs someone else", which is a much more comfortable sentence and not a true one.

---

## 2026-09-19 — REENTRY-CAUSE-01 + DIFFICULTY-SHORTFALL-01 · the board reviewed 17 real plans, and killed my best finding
**Shipped:** two board rulings. The engine stops telling ready runners they are coming back, and stops calling a plan "comfortable" while telling the runner it falls short.

**Dev learning:** I took three findings to the board and the mandatory conflict scan killed the one I was most confident about before a single seat spoke. I had measured that the difficulty label never looks at the training load: plans labelled comfortable have longer sessions than plans labelled demanding, and two hundred and seventy-nine of them hand someone with under six months of running a session over two and a half hours. All true, all irrelevant, because the principle says in writing that the label is deliberately blind to the produced plan, and the person who insisted on that is the same injury specialist I was about to quote at it. What survived was narrower and better: the principle defines "comfortable" as "the plan reaches its target", and seven hundred and fifty-one plans said comfortable in one field and "this does not reach your target" in another. Fixing the real contradiction took one line.

**AI-building learning:** the second finding nearly went in with the wrong cause attached. The copy tells runners they are coming back from a layoff; I assumed the layoff detector was misfiring. It was not — it was nowhere near firing. The actual trigger was that the code asks "is this an early-onset runner" as part of deciding *which of two* messages to show, and an early-onset runner is neither, so they fell through to the wrong one. Same visible defect, completely different fix. If I had trusted the first explanation I would have loosened a threshold and changed nothing.

**The honest bit:** three separate checks in this one piece of work were green because they were not actually looking. The parity script copies itself into a worktree by a hardcoded filename, so my scoped copy compared itself against the unscoped original and reported a prescription change that did not exist. The population harness missed a thirty-one point swing in a runner-facing label because the label was not in its list. And when I added it to the list, the test still passed, because the test had its own hand-written list of seven fields. Three layers, each one checking something slightly narrower than what it appeared to check. All three are now derived rather than typed.

---

## 2026-09-19 — SCHEMA-LIVE-01 · the check that must never throw, and how you prove it works
**Shipped:** the canonical plan schema now runs on every save as an observation, and the four untested modules with production callers have tests.

**Dev learning:** The schema file opens by calling itself the single source of runtime validation, shared by four systems. It had one consumer, a test written the same morning, and had never been run against real engine output in the repo's history. A declared consumer is not a consumer. The fix is small; the interesting part is that this check must never throw, because the schema has already drifted from the engine once and a throwing version would then refuse real people for drift rather than for defects. Which means it cannot prove itself the usual way. A check whose only evidence is that it has never complained is indistinguishable from a check that is not wired up, so its liveness comes from a test that spies on the telemetry call and asserts the call site fires.

**The honest bit:** I nearly shipped a bundle regression and then nearly shipped a wrong number about it. The save function is imported by a client component, so importing a seven-thousand-line validator into it looked like putting the validator on the first screen a runner sees. I wrote a comment claiming the lazy version saved forty kilobytes. Then I built both. It saved one, because the client already imports twelve modules from the same directory and the dependency graph was nearly all there. I reverted to the simple version and kept the measurement in the comment, because the next person will have the same worry and should not have to build twice to answer it.

---

## 2026-09-19 — SAVE-VALIDATE-01 + RACE-DIST-UNVALIDATED-01 · the wrong fixture was the instrument
**Shipped:** every plan is validated on its way into the database, and a missing race distance can no longer build a hundred-kilometre ultra.

**Dev learning:** Nine routes could write a plan and two of them validated it. The net was a daily cron, which means an invalid plan could be live for twenty-four hours before anything noticed. The fix is one check in the one function they all call, not nine checks in nine places. Before writing it I put a log-only probe in that function and ran the whole suite: eight saves, all eight skipped, because every fixture builds plans by hand and none carried the field the validator needs. A guard nothing in the suite can reach is the thing this repo keeps finding under a green tick, so the guard shipped with the one test that supplies the field.

**The honest bit:** I found the second defect by writing a broken fixture. I invented a `race_distance` field that does not exist; the real one is `race_distance_km`. Third time today I have got a fixture value wrong, and I have a written rule about exactly this. But the engine did not reject the omission. It built a plan. `raceDistanceKey` is a ladder of `<=` comparisons with no lower bound and no NaN arm, so every comparison against `undefined` is false and it falls through to the last line, which is `100K`. The runner would have been shown a twenty-six-week ultra whose race day read "Race day — undefined km" and whose coach note read "Start slower than feels right. First NaN km at Zone 2." The validator did catch it, and in production that catch only writes to console.error. So the one mechanism that noticed was switched off precisely where it mattered. My mistake was the test case nobody had written.

---

## 2026-09-19 — PERSONA-CORPUS-01 · the grid cannot describe a person
**Shipped:** six realistic runners join the permanent test corpus, and the grids stop being the only witness.

**Dev learning:** A grid multiplies axes. It will happily give you "experienced" and it will give you "twelve weeks", but it will never give you "experienced, back running regularly, and only twelve weeks out", because in a grid those choices are independent and in a person they are not. That combination is where today's defect lived, and forty-five thousand grid plans could not construct it.

**Product/creator learning:** Three times this month the answer to "why did nothing catch this" has been that the corpus could not reach the cell. That is not a testing problem you fix by generating more combinations — more combinations of independent axes gives you more of the same blind spot. You fix it by writing down people.

**AI-building learning:** The temptation was to build a new persona harness. There was already one, with a single owner and four consumers, called charityCohort. So the change is a tag on the existing interface and two derived filters — every previous consumer sees exactly what it saw before, and not one charity baseline moved. Adding a second array would have created the two-registers-with-a-human-between-them problem the file exists to avoid.

**The honest bit:** the rule I attached matters more than the six personas. Add one every time a defect is found from a real shape. A corpus assembled from imagination goes stale; one assembled from actual failures stays ahead of the grids, because it is made of the things that already got past them.

**Hook material:** Our test suite ran 45,000 training plans and found nothing. Six made-up runners found a bug in ten minutes. The 45,000 could not describe a person.

---

## 2026-09-19 — PHASE-EMPTY-01 · the validator that had never seen the thing it validates
**Shipped:** the engine's own output is now checked against the engine's own schema.

**Dev learning:** `schema.ts` describes itself as the single source of runtime validation for plan JSON, shared by the rule engine, the enricher, the reshaper and multi-race. It had one caller: the enricher. So the canonical schema had only ever been applied to AI output, and nobody had ever pointed it at the plans the engine actually produces. The first time I did, four of six failed. Two of those were my own bad fixtures. One was real.

**Product/creator learning:** The real one is small and instructive. When a runner is demonstrably ready we shorten their base phase, and on a twelve-week plan we shorten it to nothing — so the plan recorded a base phase running from week 1 to week 0. Nothing broke, because every consumer either matches a week against a range (which an empty range never matches) or looks the phase up by name. It was harmless by luck. A consumer computing length as end minus start would have got a negative number.

**AI-building learning:** Forty-five thousand corpus plans could not reach it. Six hand-built runners found it immediately, because the corpus never pairs an experienced runner with regular recent quality on a short runway. That is the third time this month the answer has been "the grid cannot see that cell" rather than "the engine is fine", and it is the strongest argument I know for building test cases from people rather than from axes.

**The honest bit:** two of my six test runners had a training age that does not exist in the product. The schema caught it and I briefly logged it as a schema drift before checking the type. My own fixtures were wrong in exactly the way I have a written note telling me they will be.

**Hook material:** Our plan validator had never once been run against a plan our engine produced. It had only ever checked the AI.

---

## 2026-09-19 — REFUSAL-TELEMETRY-01 · when you cannot find the number, collect it
**Shipped:** every designed refusal now records the inputs that caused it.

**Dev learning:** We had a P0 blocked on a question nobody could answer: what share of 500 charity runners run less than 12 km a week. I searched for it. The literature is all prescriptive — it will tell you a first-time marathoner should have 24 to 40 km a week before starting a block, and that a complete beginner needs three to six months to get there. Nobody publishes what people signing up for a charity place actually run, because nobody measures it. The charity does not know either.

**Product/creator learning:** The instinct was to estimate. The better move was to notice that we generate the refusal ourselves, so every single one is a data point we were throwing away. One event, no migration, and the answer arrives on its own within days of the codes going out. **A question you cannot answer by research is sometimes a question you can answer by instrumentation.**

**AI-building learning:** I put it at ONE call site above the branch-specific responses, gated on the shared `isDesignedRefusal` predicate, rather than adding a line to each of the four refusal branches. Four copies would have been four chances to add a fifth refusal type and forget. The codebase already had the pattern — `plan_distance_gate_blocked` — so this reused the path instead of inventing one.

**The honest bit:** this is also the test of something I shipped an hour earlier. The denominator fix added 456 refusals **on a grid of synthetic inputs**. I do not know how many real people that is, and neither does anyone else. Now it will tell us, and it may say I was wrong about the size of it.

**Hook material:** We needed to know what beginner runners actually run before a marathon. The research only says what they should run. So we stopped asking and started counting.

---

## 2026-09-19 — S111-DENOMINATOR-01 · shipping the expensive truth
**Shipped:** the safety gate now measures the volume runners actually start from, and refuses 456 more first-time marathoners.

**Dev learning:** The gate divided by what people typed into the wizard, not what the engine starts them at — and those differ by design, because we scale returners down and cap over-claimers. So it scored a build nobody performs. The fix is four characters. The consequence is 456 beginners turned away, which is why it sat unapplied all day.

**Product/creator learning:** What made the decision was not the 5.57x build ratio. It was the zero next to it. Those plans had **no invariant violations at all** — they passed every check the engine owns while doubling a never-run beginner's weekly mileage in week one. A clean bill of health from a check that is measuring the wrong quantity is worse than no check, because it buys false confidence. That is the whole case for applying it, and it is the case I could not make until I printed what those runners were actually getting.

**AI-building learning:** I tried to escape the trade. Correct the denominator, raise the cap, hold refusals flat — and the numbers agreed: 1,004 against 1,001. It was wrong. The correction tightens one subgroup and the cap loosens everybody, so the totals cancelled while the composition changed, and a 10 km/week beginner marathoner walked through a door our own doctrine says must be shut. A test caught it, not me. **A flat total is not a flat outcome, and I have now made the same denominator mistake four times today in four different shapes.**

**The honest bit:** McMillan's dissent is in the principle verbatim, because he is right and shipping anyway: a person with a London place and seven months, refused at the door, is someone we failed. The refusal now tells them how many weeks of easy running to do and to come back. That is not the base-building plan they deserve. It is what we could honestly give them today.

**Hook material:** Our safety check gave 456 first-time marathoners a clean bill of health on plans that doubled their mileage in week one. It was dividing by the wrong number.

---

## 2026-09-19 — QUALITY-AERO-FALLBACK-01 · I broke this at 9am and found it at 5pm
**Shipped:** a quality session can no longer be an easy run wearing a tempo's name.

**Dev learning:** Opening a dormant code path is a change to every rule that path touches. This morning I gave beginners with a time goal their first quality session. Beginners have a thin catalogue, so when no threshold row was eligible the selector fell back to *any* eligible row — and picked the Z2 aerobic filler. The label is generated from the race distance, so the runner saw "5K-pace sustained" over an easy run. The fallback had been wrong for as long as it existed; it was simply unreachable until I made it reachable.

**Product/creator learning:** 144 sessions out of 290,000 is 0.05%, and every single one of them was in the cohort we care most about — beginners chasing a first time goal at 5K and 10K. A rate that rounds to zero can still be concentrated entirely on your priority-one runner. I nearly reported it as negligible on the percentage alone.

**AI-building learning:** I found it while chasing something else, and only because I printed an actual plan instead of reading a counter. The variety fix I was testing "worked" — breaches went to zero — and when I printed what it prescribed, it had put the same aerobic filler in the slot and called it a tempo. The fix and the defect were the same mistake, one deliberate and one accidental. Counters told me it was better; the plan told me it was worse.

**The honest bit:** the fix I was building got abandoned and the bug I wasn't looking for got shipped. That is the right trade, but it is not what I set out to do, and I would not have found it if I had trusted the green number.

**Hook material:** We told beginner runners they were doing a 5K-pace session and gave them an easy jog. 144 times. I introduced it that morning.

---

## 2026-09-19 — CB-PLAN-REVIEW-01 · EFFSESS-COLLISION-01 · S9-DURATION-FLOOR-01 — Phase 2, and what a big number was hiding
**Shipped:** the plan now tells the runner the truth about itself, plus a session-deleting bug nobody had ever tested for.

**Dev learning:** Our plan-quality harness reported 7,569 findings and I nearly took that to the board as a defect count. Reconciling it first: the two biggest categories contain zero genuine breaches. Fifteen thousand "never builds" are all correctly classified maintenance carrying a note, which is exactly what the principle prescribes for that case, and twenty thousand "long run short" are measured against a bar the constitution only applies to a third of them. The harness was measuring a stricter rule than the one we actually hold plans to. A finding count is only meaningful next to the rule it is counting against.

**Product/creator learning:** The defect the board refused to hand over was one sentence. An experienced runner on 55 km a week chasing a 45-minute 10K was told "this plan is built to get you round, not to chase a time". The classification behind it was right — they are at their volume ceiling — but the sentence describes a different cause, and it was wrong on 79% of the plans it appeared on. Nothing about the training changed. What changed is whether the runner recognises their own plan in the description of it.

**AI-building learning:** I brought two findings and one dissolved because I had counted the wrong unit. I measured plans where every quality session is a different catalogue row and called it a variety defect. Measured properly, no plan in the corpus ever fails to repeat a *stimulus* — the median is four or five exposures per category, and only the flavour of the session varies. The objection I was quoting is about stimulus, not session names. Five of my premises have now failed measurement today, and every one failed the same way: I picked a unit that was easy to count instead of the one that carries the meaning.

**The honest bit:** the worst thing found all day was not in the engine. `effectiveSessions` had six callers and no tests, and writing the tests showed that moving a session onto a day you had already trained deleted the session that was there. Not flagged, not logged — the week just had one fewer run in it. It would still be doing that if I had only looked where the failures were.

**Hook material:** Our quality report said 7,569 problems. Two of the three biggest categories were the system working exactly as designed.

---

## 2026-09-19 — CAT-DEPTH-01 · the catalogue was the second of three gates
**Shipped:** a beginner who sets a time target now gets one quality session a week, from rows they are actually eligible for.

**Dev learning:** The item said "the catalogue is thin" and had said so for weeks. It was thin, but that was not what blocked it. The first gate was a ceiling of zero, so there was no slot for a row to fill — I proved it by adding a row and measuring: zero beginner plans changed and fifty-nine percent of everyone else's did, because a row marked for beginners is eligible for every level above them and the rotation picks least-used first. The third gate was four dose tables with no beginner row, typed loosely enough that a missing key is a runtime crash rather than a compile error. Three gates, and the one in the title was the middle one.

**Product/creator learning:** The constitution had already said this. A comment inside the config block read "beginner → 0 (no quality at all in base; light tempo only after week 4)" — the sentence describes light tempo, the number forbids it, and both have been sitting there since the original spec. Nobody implemented the sentence and nobody deleted it. A comment is read by people and by nothing else, which is exactly how it survives being wrong for a year.

**AI-building learning:** Three times during the build a measurement told me my plan was wrong and each correction is now written into the principle rather than quietly applied. The new row without a scope field cost other cohorts fifty-nine percent of their plans. Shipping it without a volume floor produced six hundred and forty lopsided-week breaches, all on people running five to twelve kilometres a week. Allowing it at 5K and 10K produced sixty-nine variety breaches, because a beginner has no threshold pace anchor so the tempo rows drop out and my row was the only thing left to pick. None of that was predictable from reading the code.

**The honest bit:** I shipped this once already today and reverted it, because the ruling was right and the engine could not honour it. The measurement that looked like success — goal-pace exposure going from zero to a hundred percent — was reading sessions that had no catalogue row at all. A label is not a prescription. The invariant caught it; my own metric did not.

**Hook material:** The feature was blocked for weeks on "we need more content". The content was the second of three problems, and the first one was a zero someone typed in 2025.

---

## 2026-09-19 — QUALITY-ZERO-SCOPE-01 · the check was fine, it just could not reach anyone
**Shipped:** the zero-quality floor now applies to ultra runners, who were never meant to be exempt.

**Dev learning:** Fourth time in one day I found the same shape: a field that describes how something is DISPLAYED being used to decide who a safety rule applies to. The rule's own error message said "a runner the engine does not classify beginner" and the code tested whether the plan shows minutes instead of kilometres. Those happen to overlap for beginners and also happen to catch every ultra runner, who are the opposite of beginners. The message and the condition had disagreed since the day it was written, and the message is the bit a human reads.

**Product/creator learning:** Nothing was broken. Ultra runners get ten to fifteen hard sessions and always have, and fixing this changed zero plans. That made it very tempting to leave alone. The reason not to is written in the principle it enforces: a value nothing can falsify is not governed. Six weeks ago the same class of hole let two thousand plans ship with every hard session silently removed, and the check that should have caught it was equally green the whole time.

**AI-building learning:** I took three questions to the coaching board today and two of them evaporated during the conflict scan, before a single board member spoke — the principle already answered one, and a fix from that morning had already removed the other. The scan is the cheapest part of the process and it keeps saving the expensive part. Worth saying plainly: the value was in reading the constitution, not in the opinions.

**The honest bit:** I only found this because I was checking something else and read the invariant's gate line by line to make sure I was not about to repeat a mistake. Nothing flagged it. No test failed. It would still be there tomorrow.

**Hook material:** The safety check was green for a group of users it could not see. Not disabled — it read a field that meant something else.

---

## 2026-09-19 — V4-ANCHOR-01 · a rule that had never run on the people it was written for
**Shipped:** the long-run repeat ceiling now reaches beginners and ultra runners.

**Dev learning:** Same bug, third time, same shape. A session is anchored either by distance or by duration, beginners get duration, and any code that reads `distance_km` to ask "how far is this?" silently skips them. §45's safety cap had it. Two sibling functions had it. This one had it too, and both of its neighbours in the same file already carry a comment explaining the hazard — I was reading those comments while writing the fix. Grepping for the pattern beats finding it three times by accident.

**Product/creator learning:** I measured the exit counter and found the duration-anchored branch was 81% of everywhere the rule bailed out, and I nearly wrote that number up as the impact. It is not the impact. Plans with three or more identical long runs in a row were 30.3% for the cohort the rule skipped and 30.4% for the cohort it covered — the same. The rule was barely working where it *did* run, so extending it bought 2.5 points, not 81. A big number about a mechanism is not a number about an outcome.

**AI-building learning:** The honest write-up is the artifact. My first draft of the code comment said the fix "does NOT measurably reduce repeated long runs", which was a guess I made before measuring; it actually moves 30.3% to 27.8%. I corrected the comment to the real figure. A confident sentence in a comment outlives the session that wrote it, and the next person has no way to know which sentences were measured and which were assumed.

**The honest bit:** I found this while looking for something else entirely, and the thing I was originally chasing — a long-run jump of 51% that looked like a safety breach — turned out to be the cap working exactly as designed. Two of the three "findings" I reported to myself that hour dissolved under measurement. The one that survived was the least dramatic.

**Hook material:** A rule in our training engine had never once run on beginners. Not disabled, not broken — it read one field, and beginners do not have that field.

---

## 2026-09-19 — S114-GET-YOU-ROUND-01 · the long run finally fits the week
**Shipped:** where the week cannot hold the long run the race asks for, the long run yields and the plan says so.

**Dev learning:** I spent most of a day trying to fix this by raising the week. Ten post-hoc bounds, four volume-curve floors, fourteen attempts, every one either inert or breaking a ratified rule. The answer was that the week cannot be raised: an 8 km/week runner cannot reach the 43 km that a 26 km long run needs, in nineteen weeks, under a 10% weekly cap once four deloads have taken 30% each. That is arithmetic about running, not a defect, and I should have printed the plan and done that division on the first attempt rather than the fifteenth.

**Product/creator learning:** The fix was a product decision, not an engineering one, and it was not mine to make. A knee-history runner at 8 km/week was getting a 26 km long run inside a 28 km week — 93% of their training in one session. The choice was refuse them or give them a shorter long run and be honest about it. The founder chose the second. Severe binge weeks went 45% to zero, two-run weeks 40% to zero, and refusals actually went *down* by 37. The cost is that 59% of these plans now have a peak long run short of race-specific, which for this cohort is the truthful answer rather than a regression.

**AI-building learning:** Four separate guards caught me while I built it, and each one was a rule I had read that morning. The sharpest: I wrote the bound as `max(min(longRun, cap), ratioFloor)`, which can *raise* its subject — a bound that increases the thing it bounds is not a bound — and the week-1 long-run cap threw across the whole charity cohort. Another caught me claiming an invariant enforced §114 when that invariant only named §52, which is precisely how a principle read as enforced for eight days while checking nothing.

**The honest bit:** the half that matters is not the cap, it is the sentence. The plan now tells the runner their longest run tops out at 2h 20 against a race of about 4h 55, why, and what to do about it on the day — go out slower than feels right, take the walk breaks early. A shorter long run nobody mentions is not a get-you-round plan, it is just a worse plan. I nearly shipped the cap without checking the note fired.

**Hook material:** We were giving first-time marathoners a 26 km run inside a 28 km training week. The fix was not a better algorithm. It was deciding what we are actually promising them.

## 2026-09-19 — the architectural fix, attempted · the metric was pointing the wrong way
**Shipped:** nothing. Four more formulations built and measured, all inert or harmful, and one finding that makes the next fix obvious.

**Dev learning:** I had been describing the fix for weeks as "size the long run and the week together in the volume curve". So I built it: a per-week floor on the curve, derived from the long run the race asks for. The first version fixed composition outright — severe binge weeks 45% to 2% — and broke two ratified rules, because §2's cap, §3's deload re-anchor and the bounceback all read surrounding weeks and I had moved those weeks after they were computed. I extracted the pass and ran it either side. Then §2 correctly erased the floor. Then I bounded the floor to be §2-legal and it became inert, because the curve already grows at §2's maximum for most of a plan. Four formulations, and the fourth one told me the answer: the curve was never the problem.

**Product/creator learning:** I printed the actual plan. An 8 km/week runner with a knee history: the long run climbs from 8 km to 26 km across the build while the week never passes 29. Week 15 is a 26 km long run in a 28 km week. A coherent 26 km long run needs a 43 km week, and an 8 km/week runner cannot reach 43 km in nineteen weeks under a 10% weekly cap once four deloads have taken 30% each. That is arithmetic about running. No volume lever moves it.

**AI-building learning:** Then the thing that actually matters. That runner passes the gate meant to catch them. §111 refuses on delivered peak divided by current volume. Their peak is 29, so their ratio is 3.63, comfortably inside the 4.0 cap — and it is low *precisely because their week could not grow*. A runner whose week cannot hold their long run has a low peak, therefore a low ratio, therefore is admitted. The metric falls as the plan degrades. It is anti-correlated with the hazard it guards, and that single fact explains every strange result the gate has produced this week, including one I had already taken to two board sittings.

**The honest bit:** fourteen instruments across one day, and the useful output is a sentence rather than a commit. I kept trying to build the thing I had already named, and the naming was wrong — "size the long run and the week together" assumes the week can be sized, and for this cohort it cannot. The fix is now a choice between two coaching positions, not an engineering task, which is a better place to be than where I started even though nothing shipped.

**Hook material:** The safety gate let the runner through because his plan was too broken to trip it.

## 2026-09-19 — GRID-MARATHON-CAPABLE-01 · the grid could not contain the runner it was measuring
**Shipped:** the cohort grid gains a 70 km/week volume. It now reaches a marathoner capable of §24, which it never could before.

**Dev learning:** §24 wants a marathon long run of at least 31.65 km. §52 caps any single run at 60% of its week. So a runner who satisfies both needs a week of about 53 km, and the grid's highest volume was 50. Every marathon measurement ever taken on it was therefore scoped to runners who could not satisfy the rule being measured. That is how "0% of marathon time-goal plans reach the §24 floor" got reported as a catastrophic engine finding when it was a fact about the corpus. It is now 68 rows out of 5,184 — low, arguable, and real.

**Product/creator learning:** Widening it immediately broke three baselines, and that is the point rather than the cost. Maintenance classification rose 7.8pp and never-builds nearly doubled, not because anything changed but because runners who had never been measured got measured. The interesting one: 47.8% of experienced 70 km/week marathoners get a plan whose delivered peak is under 110% of delivered week one. The volume curve guarantees that ratio by construction — week one is capped at 85% of peak — so the gap opens somewhere in delivery, which is the same curve-versus-delivered split this engine has now paid for three times. Filed rather than fixed: it deserves the same care as the others, not a tenth instrument at the end of a long day.

**AI-building learning:** Four things went red that were not the grid: a rationale note hit 127 words against a 117 ratchet, a golden snapshot moved, and two fitness baselines shifted. Each one was a check doing its job on a population it had never seen. A wider corpus is not a bigger number, it is a different set of runners, and every threshold tuned on the old set has to be re-argued rather than re-baselined by reflex.

**The honest bit:** I capped the note at two reasons and cut a twelve-word clause. I could have raised the ratchet from 117 to 127 and the suite would have gone green in one line. The test says "shorten the copy, do not raise the ratchet" in its own failure message, which is someone who had already been tempted leaving a note for the next person who would be.

**Hook material:** Our test grid could not contain a runner capable of passing the rule it was testing. We had been measuring the rule against people who were never eligible for it.

## 2026-09-19 — STEPBACK-STALE-PEAK-01 · the ratio measured against a number that no longer existed
**Shipped:** §47's peak long-run step-back is re-clamped against the peak that actually survives the pipeline.

**Dev learning:** §47 sizes a step-back week as 80% of the peak long run. It ran early in the pipeline, and a later pass could trim that peak — so the ratio ended up measured against a value no runner ever sees. Measured: a 166-minute step-back against a final peak of 206. That is 80.6%, against an 80% bound, from a rule that had done its arithmetic correctly on stale input.

**Product/creator learning:** The fix is ten lines and it took four attempts, because the pipeline order is load-bearing in both directions. Lowering the step-back raises the step the following week has to take, which breaks §45's progression cap. Lowering it far enough drops the long run under §9's long-vs-easy ratio, which threw 16 hard failures across the cohort grid. Every local change in this engine pushes on two other rules, and the only way to find out which is to run the whole chain.

**AI-building learning:** Two guards caught me. The first was §9's invariant, which is doing its job. The second was `sessionDistanceReach.test.ts`, which failed because I had written `distance_km ?? 0` — the exact antipattern that has produced four measured defects in this codebase, in a fix written by someone who had re-read that memory the same morning. Knowing a rule and applying it under load are different skills, and the test is the only one of the two that is reliable.

**The honest bit:** the change moves three plans out of 2,868 from "builds" to "never builds". I could have quietly re-baselined that. Declaring it costs a line in the registry and means the next person can argue with the trade rather than discover it.

**Hook material:** A rule was checking 80% of a number that had been changed after it looked.

## 2026-09-19 — MAINT-LIVENESS-01 · the harness was calling the wrong validator
**Shipped:** maintenance blocks are now probed for liveness. 107/121 invariants proven able to fail, up to 118/121.

**Dev learning:** Eight maintenance invariants had sat in the "unproven" baseline for months with the reason "the harness never builds this plan shape". That reason was wrong, and being wrong is what kept it there — it described a plausible cause, it sounded like a known limitation, and nobody checked it. The truth was narrower and worse: those invariants are not checked by `validatePlan`. They are checked by `validateMaintenanceBlock`, and the harness only ever called `validatePlan`. No corpus, however wide, could ever have woken them. Two coaching principles rested on them.

**Product/creator learning:** This is the fourth time the liveness debt has been investigated and the first time the sample was not the problem. The three previous fixes were all about which inputs got probed — a dedup, a key, a round-robin that only ever consumed list heads. Each one was real. Each one also made the remaining debt look more legitimate, because the obvious suspect had just been fixed. A stale reason in a debt register is worse than no reason, because it answers the question and stops the asking.

**AI-building learning:** My first mutation battery woke four of the eight and I had guessed at all of them. The four that failed were failing for boring reasons: the race-specific check reads `session.category` and I had set the label; the quality cap counts sessions against a per-week limit and I had added one. Reading the four checks took two minutes and fixed all four. Guessing at what a rule reads is the same error as guessing at what a metric measures, and I did both today.

**The honest bit:** the test suite then went red on a *different* file — `principleCoverage.test.ts` complaining that §67 and §75 were still listed as resting on unwakeable invariants when they no longer were. That is a cross-register check catching me tidying one register and leaving another stale, which is the exact failure the three registers were built to catch in each other a day earlier. It is the first time one of them has caught me rather than the code.

**Hook material:** A test harness reported eight rules as unprovable for months. It had been calling the wrong function the whole time.

## 2026-09-19 — CB-HILL-INJURY-01 · a label told the truth and a safety bug fell out

**Shipped:** `npm run audit:plans` (the fifth question — would we be proud to hand this plan over?), stride labels that say "strides", a §21 gate on hill strides that was missing, and the taper's floors routed through the resolver everything else already uses.

**Dev learning:** The founder reframed the whole day: stop closing backlog items, start judging the plans. So I built a harness that generates 6,480 beginner-marathon plans — cwk 0 to 30, longest run 0 to 12, injury and returning toggled — and asks a coach's questions of each one. 36.4% get no plan at all. Of the rest, 45% have a week where one session is three quarters of the week, 49% deliver fewer days than the runner asked for, 40% have weeks with two runs in them. Then I printed an actual plan and found the thing no predicate caught: the Sunday long run goes 5.3 km to 26.0 km while the Monday, Wednesday and Friday runs sit at 3.9 km from week 1 to week 13. The engine builds a first-time marathoner by growing one session and freezing the rest. 83% of plans do it.

**Product/creator learning:** I then tried six different fixes and every single one traded one defect for another. Bound the long run to 45% of its week: the binge weeks vanish and the peak long run collapses to 45% of race distance. Try 60%, try 70%: same shape, smaller. Tighten the long-run step cap: one persona's net build drops from 68% to 44%. Lower the per-day minimum: days improve by 31 plans, week-one jumps get worse by 135. The reason is the same every time and it took six attempts to see it — §45's cap is multiplicative on the previous week's long run, so reducing any week ratchets the whole trajectory down and it never recovers. A post-hoc bound on the long run cannot fix composition without destroying specificity. That is not a number to tune, it is an architecture to change.

**AI-building learning:** The best thing that happened all day was an accident. The SLT asked for stride runs to be labelled — a cosmetic change, "Easy run + strides" instead of "Easy run". The test suite immediately went red on a §21 injury invariant, and the reason was that a knee-history beginner had been prescribed hill strides for a day, since §28's amendment the previous afternoon never consulted injury history. The invariant that should have caught it classifies hill sessions by reading the label, and the label said "Easy run — Zone 2" while the coach note said "6×10s hill strides up a moderate gradient". A safety check was staring straight at the session and could not see it. **Making a display string honest found a bug that no amount of measuring had.**

**The honest bit:** I was wrong a lot today and the pattern is consistent. I compared a raw floor against a delivered value and called a gate non-monotonic on the strength of it. I blamed 30-minute weekday caps for a collapsed week and removing them changed nothing. I reconstructed a failing case by hand from printed fields and it did not reproduce, because I had missed two inputs. I measured long-run steps between non-adjacent weeks and reported a 62% jump that does not exist. Every one was caught by running the measurement again rather than by thinking harder, and one of them had already reached a board sitting before I caught it. The fix for the six failed instruments is not that I should have been cleverer — it is that six honest negative results, written down with their numbers, are worth more than one plausible change shipped on a hunch.

**Hook material:** We labelled a running session more accurately. The test suite went red and told us we had been prescribing hill sprints to people with knee injuries.

## 2026-09-19 — PLAN-QUALITY-AUDIT-01 · the fifth question
**Shipped:** `npm run audit:plans` — would we be proud to hand this plan over?

**Dev learning:** We had four harnesses and each answered a different question: are plans valid, are they unchanged, did the population shift, does the plan build the runner. None of them asks whether the plan is any *good*. A plan can pass all four and still be seven consecutive weeks of two runs. So the fifth carries its own beginner-marathon corpus — 6,480 inputs reaching down to a runner doing 0 km a week — because neither existing grid can express "never run before, wants to run London".

**The honest bit:** it is baselined rather than gated, and this codebase's own history says an ungated check is a check that does not run. Gating it means failing the build on debt that predates it, so it is a follow-up I owe rather than one I can skip quietly.

**Hook material:** Four test harnesses, and not one of them asked whether the training plan was any good.

---

## 2026-09-19 — INV-MSG-ROUNDING-01 · the error message that argued with itself
**Shipped:** one decimal place in two invariant messages.

**Dev learning:** A real breach was rendering as "Got 18 min, expected ≤ 18 min". Both sides rounded to integers, so the message asserted the check had fired on a value that satisfies it. Nobody is harmed by the number. The harm is that the next person to read it concludes the invariant is broken and spends an afternoon looking for a bug that does not exist.

**Hook material:** Our error message said the value was 18, and the limit was 18, and then failed it.

---

## 2026-09-19 — XREF-DANGLE-01 · the doc fix that missed the file it was editing
**Shipped:** a test that fails the build when a backlog line says "filed as X below" and there is no X below.

**Dev learning:** The origin is almost funny. A commit two days ago removed a duplicate item id and carefully repointed five files — the constitution, the invariant registry, the feature registry, the decision record, the code. It missed a back-reference in the backlog, which is the file it was editing. That line has read "Filed as `LR-ABS-ALLOWANCE-01` below" ever since, with nothing below, through every doc audit. The audit script reported ALL CLEAN every single time, correctly, because an unkept forward reference is in none of the five categories it checks. An audit is only ever as wide as its list — we already had that written down, and the list still did not grow.

**Product/creator learning:** I built the obvious version first: every item id mentioned anywhere must resolve to a definition. 156 hits. Almost all of them historical references to finished work, plus capitalised English that looks like an id — DROP-OUT, NO-OP, JSON-LD. Shipping that would have been worse than shipping nothing, because this codebase has three separate incidents recorded where a noisy check got switched off and the switching-off was indistinguishable from never having built it. So I narrowed it to sentences that assert the entry is *here* — "filed as X **below**". Five promises in the whole repo. Two unkept. No false positives.

**AI-building learning:** The narrow version found the second defect by itself. I had read the file, reported one dangling reference to the founder, and felt reasonably thorough. The regex found `GRID-COVERAGE-TRAINING-AGE-01` — same shape, same "filed as … below", also nothing below — in a section I had skimmed past. My hit rate reading was 1 of 2. The check's was 2 of 2, in 80 milliseconds, and it will keep being 100% forever.

**The honest bit:** neither unkept promise was abandoned work. Both were actually delivered, under a different id — `LR-ABS-CAP-LOWVOL-01` and `GRID-COVERAGE-01`. So nothing was lost except the bookkeeping, and I want to resist the instinct to call that harmless. The open list is the thing we plan from. An item that reads open and is done costs a re-investigation; an item that reads filed and does not exist costs the work. Both are the list lying, and I only went looking because someone asked me to categorise it.

**Hook material:** A commit fixed a stale reference in five files and missed the sixth. The sixth was the file it was editing.

## 2026-09-18 — S106-RACE-PEAK-01 · the gate was counting the marathon as training
**Shipped:** §111's peak-over-base ratio no longer counts the race week, so a beginner with a long runway is admitted from 12 km/week instead of 16.

**Dev learning:** I spent an hour building a case that the engine delivers a "flat 59 km/week peak with 16 km of surplus no long-run requirement demands", and took it to the board twice. Then I printed the volume curve week by week. **Week 20 is the race week** — 59 km because it contains the 42.2 km marathon plus shakeouts. The actual training peak is week 16 at **52 km, exactly the configured target**. There was no surplus, no overshoot, and nothing unexplained. `deliveredPeakKm` filtered foundation weeks and `n > 0` and simply forgot that the race is not training.

**Product/creator learning:** The fix is four words in a filter and it moves the door by 4 km/week — 240 more plans in the property sweep. Everything I'd proposed before finding it (a runway-aware ratio, scaling the peak to the long-run requirement) was more elaborate, more dangerous, and aimed at a problem that wasn't there. One of them I built and it refused a runner who'd passed comfortably.

**AI-building learning:** I asked the board to "demand the measurement for anything I assert, including the 43 km figure" — and then falsified my own 43 km figure in the next command, because at a 43 km week the long run sits at exactly §52's 60% limit. That habit is the only reason this landed anywhere useful. **Writing down which of my own numbers to distrust turned out to be more valuable than any of the numbers.**

**The honest bit:** this was my **fifth** wrong premise in one session, and the fourth and fifth were both on the same item. The pattern never varied: I measured an aggregate (max weekly_km) instead of looking at the thing (which week, and what's in it). A one-line `console.log` of the volume curve would have found it at the start, before two board sittings and a reverted build.

**Hook material:** I told a review board the plan had 16 km/week of unexplained surplus volume. It was the marathon. The race was in the training total.

**Postable?:** yes

## 2026-09-18 — CB-BEGINNER-HILLS-01 · half the ruling I was told to build was already built
**Shipped:** Beginners get short hill strides, alternating with §28's strides so the dose is unchanged. The other half of the board's ruling was withdrawn as a no-op.

**Dev learning:** I told the Coaching Board beginners got "no strides, no hills, no tempo, no intervals, ever". Wrong. **100% of plans at every level carry strides, mean 10.1 runs** — I had measured session `type` and `label`, and strides are a **coach note on an easy run**. Then I made the same mistake twice more inside the build: my first cut of the invariant read a `strides` property that doesn't exist (they're in `coach_notes`), and my `canCarry` guard re-derived §28's eligibility by hand and got it wrong for 2-day plans. Three instances of the same error in one feature: **measuring a proxy for the thing rather than the thing.**

**Product/creator learning:** The genuinely valuable output was going back to the board with the correction *before* building. Half the ruling would have been a config constant that changed nothing — decorative config, which this repo has a test that fails the build for. The board withdrew it, three seats withdrew or narrowed their own positions, and what survived was one real gap: hills reach beginners through no path at all, because `hill_reps` is typed `vo2max` and beginners are capped at zero quality. **Nobody decided that. It fell out of a type assignment.**

**AI-building learning:** My build plan predicted `cohort:shape` would move, and it didn't — because a hill stride is a *note*, not a session, so it touches no volume, session count or classification metric. Writing the prediction down is what made the miss visible; if I'd only checked afterwards I'd have read "no change" as confirmation instead of as a falsified assumption. Parity was the check that actually proved the scope: `beginner=1400/1980, intermediate=0, experienced=0`.

**The honest bit:** the invariant took three attempts. The first two asked "does this plan carry stimulus anywhere?" and then tried to except plans that can't — and each exception was me re-implementing the producer's predicate by hand, which is this repo's most repeated defect class and which I have a memory file about. The third version asks the exact question instead: *where the producer's own predicate says a carrier exists, is the note on it?* That one found a real pre-existing bug — `applyWeekdayMinsCap` runs after stride placement and can create an eligible run that never gets offered strides — which I filed rather than fixed, and downgraded to a warn with the residual declared.

**Hook material:** I asked a board to rule that beginners should get strides. They already got them, in 100% of plans. I'd measured the session type instead of the session.

**Postable?:** yes

## 2026-09-18 — CB-SUBFLOOR-ADMIT-01 · the safety rule was causing the danger it refused over
**Shipped:** A first-time charity marathoner with a 3 km longest run and seven months now gets a plan. They were refused.

**Dev learning:** `MIN_SESSION_DISTANCE_KM.long` (5 km) was applied three lines after §45's week-1 cap and won. At a 3 km longest run the cap places 3.3 km — a 10% step — and the floor overrode it to 5.0 km, a **67% step**. §113 then refused the runner *because week one was a leap*. The leap was ours. What makes it worth writing down is that §113's own header **documented the sequence** — "the floor wins and the cap is silently discarded" — and nobody, me included, followed the sentence to its conclusion. The comment above the offending line even shows the author carefully stopping *rounding* from breaking the cap, then breaking it outright with a `Math.max` on the next line.

**Product/creator learning:** The founder said "we cannot refuse them, it's priority one." I went in expecting to have to argue safety against commercial pressure, and the board arrived at the same answer on purely coaching grounds — Willy, the seat most likely to defend a floor, was the one who said he couldn't. Worth remembering: when a product constraint and the engine disagree, it's worth checking whether the engine is actually right before assuming the pressure is the problem.

**AI-building learning:** I wrote the plan file first, and the single most valuable line in it turned out to be the measurement trap: *neither grid holds a row with `longest_recent_run_km < 5` (0 of 37,248), so parity and cohort:shape will report NO CHANGE and that is blindness, not safety.* Both harnesses did report no change. Without having written that down beforehand I would very likely have quoted a clean parity run as evidence. The proof came from the property sweep instead — **1,216 more plans generated**, which is the number that actually means "runners who were refused now get a plan."

**The honest bit:** the fix took five iterations because I migrated the floor one site at a time, and every partial migration produced a NEW failure — producer and checker disagreeing, then §9's long-vs-easy ratio inverting when both floors collapsed to 4, then a floor of 3.2 km being unsatisfiable on a 0.5 km rounding grid, then three more producer sites still reading the flat constant. Each one was a real defect that the flat floor had been masking, but the sequencing was mine: I should have enumerated all 27 call sites before touching the first one. My own test also pinned the wrong thing on its first write — asserting a literal where the rule was a ratio — which is the third time in one day I've done that.

**Hook material:** The app refused a runner because week one would be a 67% jump. Week one was a 10% jump until our own safety floor overrode the safety cap.

**Postable?:** yes

## 2026-09-18 — REFUSAL-ALT-REACHABLE-01 · the refusal offered a door that was also locked
**Shipped:** A refused first-time marathoner is now pointed at a 10K plan, which actually generates, instead of a half marathon, which refuses them for the identical reason.

**Dev learning:** §113's refusal carried three alternatives, and one of them was *"Or start with a half marathon plan, which asks less of your longest run."* It asks exactly the same. `LONG_RUN_READINESS_MIN_RACE_KM` is 21 km, so the floor governs the half identically. Measured at `longest_recent_run_km = 4`: marathon refused, **half marathon refused**, 10K generates, 5K generates. The copy made a claim about the engine that the engine contradicts, and nothing could catch it because refusal *alternatives* are prose and no test had ever tried to **follow** one. The new gate follows them.

**Product/creator learning:** This is the single worst place in the product to be wrong. The reader is a charity first-timer, in October, for a race in April, who has just been told no. Jack's stated problem is that people who take a place never run. A refusal offering nothing would have done less damage than one offering a second locked door, because the locked door spends their one retry and teaches them the app doesn't work. I only found it because the founder asked "are our beginners actually catered for" and I went looking at what a refused beginner literally sees.

**AI-building learning:** I nearly reported "the refusal has good alternatives, it's fine" — the copy is well-written, in voice, and offers three routes. Reading it was not enough. The only thing that found the bug was executing the suggestion: generate a half marathon plan for that same runner and see what comes back. **For any copy that tells a user to go do X, the test is to go do X.**

**The honest bit:** the existing §113 test asserted the half **is** offered. It pinned the defect. That's the second time today a test locked in the wrong behaviour — the first was `firstRun.ts`'s `${Math.round(km)} km` unit bug. Both were written by me, both alongside the code they were supposed to check, and in both cases the test just agreed with whatever the code did.

**Hook material:** The app told a first-time marathoner to try a half marathon instead. The half marathon rejects them for exactly the same reason. Nobody noticed because no test had ever followed the advice the app gives.

**Postable?:** yes

## 2026-09-18 — COMPONENT-CONTRACT-GATE-01 · a contract that described a component nobody built
**Shipped:** `docs/contracts/components/` is checked by something now — a prop-name test in both directions, plus the mirror of the API touch-check in `audit-docs.sh`.

**Dev learning:** The repo rule is "any API route **or component prop interface** changed → update `docs/contracts/` in the same commit." Only the route half was ever mechanical. Reading the four component contracts by hand: `session-card.md` documented seven props — `session`, `preferredUnits`, `zone2Ceiling`, `restingHR`… — and **not one of them exists on the component**, while all fifteen real props were undocumented. It described something that was never built, or was rewritten around, and it has read as authority ever since. A contract nobody checks is worse than no contract, because "no contract" at least tells you to go read the source.

**Product/creator learning:** The founder asked "have we updated the contracts as well, where we need to?" after I'd reported the docs clean. The audit said ALL CLEAN and it was, within its own scope — which turned out to be `app/api/**/route.ts` and nothing else. **An audit is only ever as wide as its list**, and this repo already has that written down about a different category. Saying "clean" without saying "clean *of what*" is the bit I keep getting wrong.

**AI-building learning:** My instinct was a `{contract: component}` map inside the test. That would have been the third instance in this repo of a checker holding the same hand-written list as the thing it checks — the exact flaw behind `supersedeCoverage.test.ts` and `deloadCadence.test.ts`. Made each contract declare its own `**Component:**` line instead, and made a missing declaration a failure, so a new contract can't be added without naming what it governs.

**The honest bit:** I couldn't falsify the audit arm in the commit that shipped it, and I said so in the commit message rather than claiming it. The reason is subtle: `touched()` unions "committed since SINCE" with "uncommitted", and my own commit touched all four contracts, so nothing could be shown to go stale. Falsifying it needed a **future** `SINCE` — `./scripts/audit-docs.sh 2026-09-19` counts no commits, so only the uncommitted probe is touched. Three earlier attempts failed and each time I nearly concluded the check was broken. It wasn't; the test setup was.

**Hook material:** A contract file documented seven props. The component had fifteen. The overlap was zero.

**Postable?:** yes

## 2026-09-18 — REFUSAL-COPY-02 + FIRSTRUN-GATE-CALL-01 · the refusal copy was a wire format and nothing said so
**Shipped:** The §44/§52 refusal messages are voiced and carry the runway; the plan-reveal's reassurance sentence is now gated (the card isn't).

**Dev learning:** I changed four strings for tone. It broke **eight matchers across five files**, because every grid harness identified "was that throw the engine working or a real fault?" by running a regex over the message prose. The refusal copy was a wire format and nothing in the codebase said so. Worse, `cohortGrid.ts`'s own comment already recorded that regex drifting once before, in 2026-09-04, when a new input axis reached a warn band the pattern didn't cover. Fixed properly with `isDesignedRefusal(e)` matching the error TYPE, with an `e.name` fallback because `instanceof` fails across the duplicate module instances `verify:parity` creates by design.

**Product/creator learning:** The refusal said *"2 days/week is not enough for a MARATHON."* That's the config key, shouted, at someone who has just been told no. And the screen knew the race date the whole time and never mentioned it, so the §52 refusal never said the one reassuring thing we actually hold. It now does, but only when true: if the runner is also short on weeks, the runway line is withheld, because §44 would refuse them next attempt and we'd have told them twice, once wrongly.

On the reveal card, the SLT rejected the binary I brought them. I'd asked "gate the card to first-timers or not"; Wood reframed it as a cue specification that everyone benefits from and Sutherland pointed out the third sentence was the only part that was audience-specific. Then Hutchinson blocked the sentence itself on accuracy grounds I hadn't considered: *"Nothing here you can't do"* is a capability claim, and §111 and §113 exist because it is false for some of the readers most likely to check it.

**AI-building learning:** I nearly reported a big win that wasn't real. After the migration the sweep read "Hard failures: 0, Refused by design: 6,993" against "4,033 / 2,960" before, and I started writing up a 4,033-case measurement correction. Then I stashed and ran the sweep at HEAD: **6,993 / 0**, identical. The 4,033 was caused entirely by my own copy change minutes earlier. The correct claim is the boring one, and it's better evidence anyway: before and after are byte-identical, which is what proves the refactor changed nothing.

**The honest bit:** Five of the eight duplicate matchers I only found because the property sweep went red at the end of `npm run verify`, after I'd already declared the work done twice and re-run the test suite clean both times. The unit tests pass in 40 seconds; the sweep takes two minutes and runs last. I had a green suite and an incomplete migration at the same moment, twice.

**Hook material:** I changed four sentences for tone. It broke eight things, in five files, none of which were about tone.

**Postable?:** yes

## 2026-09-18 — CI-SLOW-DRIFT-01 · the gate's first run failed on a test that hadn't got slower
**Shipped:** `npm run check:slow` — test-duration drift is now gated with a committed baseline instead of printed into a green run nobody reads.

**Dev learning:** The number that mattered was only visible under contention. `targetedGrid.test.ts` is ~8.7s measured alone and **15,017 ms inside the full suite** — 50.1% of the 30s budget, and 39% of the entire suite's test time in one test. Any duration gate built on an isolated measurement understates by most of the gap.

**Product/creator learning:** I deliberately made this report-only in CI, which feels backwards given the incident happened in CI. The reasoning: the baseline is a dev-machine number, CI runs on a ~3.5x slower runner, and comparing the two is comparing different measurements — it would turn green builds red for reasons that say nothing about the commit. CI's protection against a runaway test is `testTimeout` itself, which is what the earlier fix raised to 30s. This check's job is to make drift a *decision at commit time*, and commit time is local. Worth being explicit about, because "we added a gate and exempted CI" reads like cowardice unless the reason is written down.

**AI-building learning:** Multiplying the two numbers I had — 15,017 ms local under contention x the 3.5x CI ratio — projects the test past the 30s wall, and CI demonstrably doesn't hit it. That's the tell that they're different measurements, not two points on one scale. I printed the projection in the tool's output labelled "orientation only, NOT a gate" rather than deleting it, because the temptation to treat it as a prediction is exactly what I'd fall for reading this in six weeks.

**The honest bit:** The gate's first real run **failed**, on `lib/hooksGate.test.ts` — which had not got slower. It measured 793, 847 and 1,063 ms on three consecutive full-suite runs, so it sits *on* the 1,000 ms reporting line and crosses it with ordinary noise. I'd written a gate that fires depending on which side of its own boundary a test happened to land that minute. Fixed by only failing on newcomers at 1.5x the reporting threshold and registering only tests above that line. Spending twenty minutes making a check *not* fire is not wasted time — a flaky gate gets deleted, and this repo already records that as identical to having no gate.

**Hook material:** I built a test-speed gate. Its first run failed on a test that hadn't changed speed — it had just landed on the other side of my own threshold that minute.

**Postable?:** yes

## 2026-09-18 — OPS-DBCHECK-NOISE-01 · my healthy check was writing 43 errors a run, and the noise was the smaller problem
**Shipped:** `check:db` now asks one read-only `schema_columns_named()` RPC instead of 21 selects designed to fail, and the answer is bidirectional.

**Dev learning:** The original code's comment said "information_schema is not exposed over PostgREST, so probe each known table for the columns instead." True, and it stopped one step early — you can expose it yourself with a four-line `stable security invoker` SQL function granted to `service_role` only. That's the whole fix. Worth remembering as a shape: when PostgREST can't reach something, the answer is usually a narrow function, not a workaround built out of failures.

**Product/creator learning:** The item was filed as a noise complaint and the noise was genuinely worth fixing — the founder spent time investigating 40+ red lines that meant nothing, and a dashboard that's red when healthy is a dashboard nobody reads. But rewriting it surfaced something worse. Probing "each known table" meant the list of tables to check came from `WEEK_KEYED_TABLES ∪ WEEK_KEYED_EXEMPT ∪ RLS_POLICIES` — three hand-written arrays in the repo. The function's own header says, in as many words, "the authority has to be the SCHEMA," because the incident that caused it was a list written from memory and a guard that iterated that same list. It was doing the thing it was written to stop. A new table carrying `week_n` that nobody added to any array was invisible to the check built to find exactly that.

**AI-building learning:** I only found the second problem because I had to read the function properly to rewrite it, and the header was three screens above the code that contradicted it. If I'd fixed the noise the narrow way — kept the loop, swallowed the errors — the check would have gone quiet and stayed blind, and it would have looked like a clean fix in the diff. Cheap tasks are where you find the expensive ones, but only if you read past the line you were sent to change.

**The honest bit:** I couldn't complete the verification the backlog entry asked for. It said "run check:db, then confirm the Supabase log view shows no new 42703 rows," and log querying isn't exposed through the tooling I have. So I proved the mechanism instead — the script no longer issues a select that can fail — and wrote a test that fails if anyone puts one back. That's a different claim from the one that was asked for, and it's worth saying which one I actually made.

**Hook material:** A schema-drift checker whose own comment says "the authority has to be the SCHEMA" was asking three hand-written arrays which tables to look at.

**Postable?:** yes

## 2026-09-18 — FATIGUE-ARRAY-DRY-01 · the module that closed the split was standing in one
**Shipped:** Unified seven hand-written copies of the `Fresh | Fine | Heavy | Wrecked` vocabulary onto `lib/coaching/completionVocab.ts`, plus a gate that fails on an eighth.

**Dev learning:** The filed item said "five inline arrays". It was seven, and the one that mattered wasn't an array at all — `reframeRiskGate.ts` still had `export type FatigueTag = 'Fresh' | 'Fine' | 'Heavy' | 'Wrecked'`. The module I'd written hours earlier to own those values opens with a comment saying it exists because "a type without its values is exactly the split that lets two lists drift." It closed the split it named and left the one it was standing in. A grep for the *values* found the arrays; nothing found the type, because a union is the same four strings arranged so a value-shaped search misses them. The gate now checks three shapes — array, union, and `=== 'Fresh' ||` chain — because the duplicate takes whatever form the local file needs.

**Product/creator learning:** Unifying the two route filters on `isFatigueTag` quietly widened them: the owner accepts a legacy `'Cooked'`, the inline guards didn't. I checked production before shipping rather than after — 71 tagged rows, zero `'Cooked'`, so it's a provable no-op today. That let me state the delta as a fact instead of a risk, and made the Coaching Board question answerable in one line (it restores documented intent, since `FATIGUE_HIGH_TAGS` already matched `'Cooked'`, so exclusion at the filter was silently dropping evidence the consumer wanted).

**AI-building learning:** I nearly wrote the gate as "no file except the owner contains these four strings" and it would have been useless — the test file itself quotes the pattern in order to search for it, and the first run failed on its own source. Any static gate that greps for a string is a file that contains that string. Excluding `*.test.ts` from the pathspec is two words and the difference between a gate and a permanently-red test someone deletes.

**The honest bit:** This is the second time today a check caught my own edit rather than a historical bug, and both times my first instinct was that the check was wrong. It wasn't, either time.

**Hook material:** The file's own header says it exists to stop a type and its values drifting apart. It shipped with its type declared in a different file.

**Postable?:** yes

## 2026-09-18 — PREF-SWEEP-01 · I filed the bug with a number that was 4x too big, then corrected it before touching code
**Shipped:** Five live sites where a hardcoded `km`/`min` bypassed the reader's unit preference, plus `lib/hardcodedUnits.test.ts` — a gate that fails on a unit glyph welded to a template interpolation, with six sites baselined with reasons.

**Dev learning:** The worst one was invisible for a structural reason, not a careless one. `app/api/weekly-report/route.ts` builds its remaining-session labels at line 251 — `` `Thu: easy (8km)` `` — and fetches the runner's units at line **371**, 120 lines later, to pass into the prompt builder. So the prompt correctly said "speak in miles" while the strings it was handed had already said km. Both halves were right in isolation. The defect only exists in the ordering, and nothing about reading either half reveals it. Fix was to hoist one `await` above the label construction and route the number through `promptDistanceFormatters(units).fmtPlanned` — the owner that already existed for exactly this.

**Product/creator learning:** Deciding what counts as a defect was most of the work. The raw grep said 90 hardcoded `km` in user-facing strings. A classified inventory said **58 of those were `invariants.ts` violation messages** — developer-facing, never rendered — and the real runner-facing scope was ~24. Two more of my own filed claims were wrong: "3 of 14 prompt builders never receive units" was technically true and misleading (those three reference no distance at all), and a `DashboardClient` site I'd flagged as an ADR-015 violation was `formatNotifTime` rendering "5m ago", which is correct. I committed the correction as its own commit before writing any fix, because the wrong number was already in the backlog where someone would size work against it.

**AI-building learning:** The gate caught **my own fix** within a minute of being written. I'd replaced `` `${min[1]}min` `` with ``formatDuration(...) ?? `${min[1]} min` `` — used the owner, kept a "safe" fallback, felt done. The scanner flagged the fallback, and it was right: `formatDuration` returns null only for null/NaN/negative, and the input is a `\d+` regex capture, so the fallback was unreachable code re-implementing the exact rule the line above had just delegated. That is the single most useful thing a mechanical check does — not catching the other guy, catching you in the same edit.

**The honest bit:** My first falsification of the gate **passed when it should have failed**, and for ten seconds I believed the arm was broken. It was shell escaping: I'd written the mutation as `python3 -c` inside a bash heredoc and the `$` in `${w.long_run_hrs}hr` never survived, so the string replace was a silent no-op. A mutation that doesn't apply looks exactly like a test that doesn't fire. Redone with a real heredoc and an `assert count==1` on the target, it went red correctly. Falsification needs its own assertion that the mutation landed — otherwise you're falsifying nothing and recording a pass.

**Hook material:** I filed the bug as "90 hardcoded units". The real number was 24. 58 of the other 66 were error messages only I would ever read. I spent the first hour proving my own bug report wrong.

**Postable?:** yes

## 2026-09-18 — FIRSTRUN-MOMENTS-01b · Collapsing "marathon" into "Monday, 20 minutes, easy"
**Shipped:** The plan reveal now shows the first session as a single concrete line before the wall of 20 weeks — the one thing a first-timer can picture doing.
**Dev learning:** The honest-effort mapping was the bit that needed care. It would have been easy to hardcode "Easy" (true for every beginner's week one) and ship a card that occasionally tells someone a tempo session is easy. Mapped the session type properly instead, so the card is correct for any plan, not just the cohort it was built for. Small thing, but "correct for the case in front of me" vs "correct in general" is the difference between a fixture and a feature.
**Product/creator learning:** Activation cost is the whole game for this cohort. A 20-week marathon block is a cliff; "Monday, 20 minutes, easy, this is where it starts" is a step. Same plan, completely different feeling. The behaviour that matters (Wood's point) isn't "understood the plan", it's "did the first run" — so the reveal should sell the first run, not the plan.
**AI-building learning:** Second card in a row where the provenance discipline was the main constraint — rule-engine data must not wear the AI mark. I'm now reaching for a plain card by default and treating the AI sparkle as something you opt into with real model output, which is the right instinct this codebase has been trying to train.
**The honest bit:** I made a judgement call the spec didn't settle: show this for everyone, or gate it to first-timers? I shipped it ungated with neutral copy ("nothing here you can't do") rather than build a fragile "is this a first-timer" check. Defensible, but it's a call, and an experienced runner will see a "first up" card they don't need. Flagged it as an easy follow-up to gate if it grates.
**Hook material:** The difference between a first-time marathoner starting and quitting can be whether the first thing they see is "20 weeks" or "Monday, 20 minutes, easy" — same plan, one number pulled to the front.
**Postable?:** maybe — pairs with 01a as "two small reveal changes that turn a cliff into a step".

## 2026-09-18 — FIRSTRUN-MOMENTS-01a · The best line in the app was written months ago and shown to no one
**Shipped:** The "you're eleven weeks early" runway note — already written by the engine, already required by an invariant — now actually appears, as the first thing a first-timer sees when their plan is revealed.
**Dev learning:** The backlog called this a "MOVE, not a write" and said the note was "buried further down the plan screen". It wasn't buried — it was rendered in exactly zero places. The engine stamped `meta.uncovered_runway_note` on every long-runway plan and an invariant enforced its presence, but no component ever read it. This is the third or fourth time this codebase has had ratified, correct content that the pipeline produced and the UI silently dropped (terrain, the "love" note, the CAT-DEPTH copy). The lesson has hardened into a habit: when a backlog item says "surface X", grep for X in components/ before assuming it renders anywhere.
**Product/creator learning:** This is the single highest-leverage thing in the whole charity flow and it's pure relief. Every other running app fills a 28-week runway with training and makes an anxious first-timer feel behind. We get to say "do almost nothing yet, you're early" — the brand, in the one moment it matters most, to the one audience that has never heard it. And the copy to do it already existed. Shipping value sometimes means connecting two things that were both already built.
**AI-building learning:** The provenance trap was the one thing to get right: this is rule-engine copy, so the card must NOT carry the AI sparkle/byline, or Kit takes credit for a line he didn't write (AI-PROVENANCE-01, which this repo already paid for once). Easy to reach for the nice-looking PlanIntroCard treatment and inherit its moss AI-rail by accident. The design system's own "this means AI" signal is load-bearing; using it on non-AI copy is a lie.
**The honest bit:** The whole thing was maybe 40 lines of component and a wiring line. The value-to-effort ratio is embarrassing in the best way — and it sat unshipped for as long as the note existed because "the engine writes it" got mentally filed as "so it must show up somewhere". Nobody checked. I only found it by grepping components/ and getting zero hits.
**Hook material:** The best sentence in the app — the one that turns an anxious first-time marathoner's 28 empty weeks into relief — was written by the engine months ago, enforced by an automated check, and displayed to precisely zero users because no screen ever read the field.
**Postable?:** yes — "the best line in the product was shown to no one" is a strong, honest post about the gap between building something and shipping it.

## 2026-09-18 — FOUNDATION-DECIDE-LATER-01 · A button that promised "later" when there was no later
**Shipped:** Deleted the "Decide later" option from the foundation-block sheet and merged two identical handlers into one — the two remaining choices are both honest.
**Dev learning:** Three buttons, two handlers byte-for-byte identical, and the third option ("Decide later") wired to a modal that has exactly one trigger in the entire codebase. The tell was mechanical: `setFoundationModalOpen(true)` appears once, at generation. So "later" could never arrive — there was no code path to bring the sheet back. Grepping for the single setter is what turned "this feels wrong" into "this is provably broken."
**Product/creator learning:** "Decide later" is the option people pick when they don't understand the question, and it's the most tempting one to offer because it feels kind. But an app that offers to defer a decision it will never re-raise is lying gently. The honest version is two real choices — do it, or don't — and let dismissing the sheet mean the same as "don't". Fewer buttons, more honesty.
**AI-building learning:** The SLT review (recorded earlier) explicitly said do NOT build a real "later" — that needs a re-offer surface that doesn't exist, and inventing one is illusion-of-progress. Easy to over-engineer this into a whole "pending decisions" system; the right answer was a deletion. Knowing when the correct amount of code is negative code.
**The honest bit:** Barely any code — a button removed and two functions merged into one. The work was reading the handlers closely enough to be sure "Start plan as-is" and "Decide later" really were the same thing underneath, and that dismissing the sheet already did the honest thing, so deleting the button lost nothing.
**Hook material:** An onboarding sheet offered "Decide later" for a decision it would never ask about again — the code to re-open that sheet existed in exactly zero places.
**Postable?:** maybe — "the kindest-looking button was the dishonest one" is a decent short post.

## 2026-09-18 — ONBOARD-SKIP-LABEL-01 · One boolean, two actions, and the button lied about which one you tapped
**Shipped:** The two onboarding ceremony screens stopped saying "Connecting…"/"Setting up…" when you tap the skip link — the primary button's working label now keys on which action is actually running.
**Dev learning:** The bug is a tiny, classic one: a single `busy` boolean serving two mutually exclusive actions, with the primary button's label bound to it. `{busy ? 'Connecting…' : ...}` is true whether you tapped Connect or Skip. The fix is to make the flag carry *which* action ('connect' | 'skip' | null) rather than just *whether* something is happening. The nice property: all the other usages (disabled, cursor, opacity) are truthy checks, so they carry over untouched — only the label needed the specific-action guard.
**Product/creator learning:** This is a two-second lie and it lands at the worst moment — a beginner's first two minutes, deciding whether to trust the app, taps "not now" and the app insists it's doing the thing they just declined. Trust is built and lost in exactly these micro-moments. The DB was always honest; the UI wasn't.
**AI-building learning:** Writing the guard test taught me the vitest config only globs lib/** and components/**, not app/** — so a test I put next to the component silently didn't run ("No test files found"). Same lesson as everything else this session: a green run that tests nothing is worse than a red one. Moved it under lib/ where signOutOwner.test.ts already walks app/ source from outside.
**The honest bit:** I first wrote the test in app/dashboard/ next to the code it tests, ran it, got "No test files found," and nearly moved on assuming it had passed. The exit code (1) was the only tell. If I'd trusted the absence of a failure message I'd have committed a test that never runs — the exact anti-pattern this codebase has a dozen war stories about.
**Hook material:** A test placed next to the code it checks silently never ran, because the test runner's config only looks in two directories and that wasn't one of them — "No test files found" exits 1, and that exit code was the only difference between a real guard and a decorative one.
**Postable?:** maybe — the "test that never ran" near-miss is a relatable one.

## 2026-09-18 — FOUNDATION-ADD-FAIL-01 · The bug fixed itself two items ago; the real fix was making sure the next one is findable
**Shipped:** The "Add Foundation Block" failure now records a durable ops event on the server and a console.error on the client, instead of vanishing without a trace.
**Dev learning:** The backlog got the priority exactly right and it's a good rule: "fix the observability first, regardless of cause." The cause here (a missing auth token) got fixed incidentally two items earlier when I routed all the bare fetches through authedFetch. If I'd only chased the cause, the next failure — a different cause — would have been just as invisible. The durable-record pattern needed one non-obvious move: hoist `userId` above the try block, because the throw happens deep inside compose/enforce and the catch otherwise can't name the runner.
**Product/creator learning:** "It just says try again" is the worst possible bug report, and it's the one you get from a silent catch. The whole class of this app's bugs is silent (unapplied migrations, swallowed 4xx, fallbacks by design), so an error state with no telemetry isn't a minor gap — it's the difference between a five-minute diagnosis and an afternoon of guessing. Every catch that sets an error state should also record why.
**AI-building learning:** Nothing dramatic. The interesting bit was recognising this was 80% already done by a previous item and not re-doing the cause work — reading the git history I'd just written, rather than re-investigating from the bug report.
**The honest bit:** I can't actually confirm the fix on device — it needs the founder's iPhone, and the engine path was already provably clean in every automated reproduction. So this ships as "the cause is fixed and the next failure is now diagnosable," not "I watched it work." Flagging that rather than claiming a device test I didn't run.
**Hook material:** The fix for a bug the founder hit on his phone had already shipped 20 minutes earlier under a different name — the actual work left was making sure that if it ever broke again, we'd know, instead of getting another "it just says try again."
**Postable?:** no — too inside-baseball on its own, but the "fix observability before cause" principle is worth folding into a broader post.

## 2026-09-18 — REFUSAL-SCREEN-01 · The app called its own good coaching decisions a crash
**Shipped:** The plan-generation refusal screen stopped headlining every "no" as "Something went wrong building the plan." and now reframes a deliberate coaching refusal as a calm "Not yet" with the lever, keeping the crash framing only for actual faults.
**Dev learning:** The clean discriminator turned out to be the HTTP status, not the payload shape. Every deliberate refusal the route throws (§44, §52, §55, §111) returns 422; a real fault is a 500 or a network drop. So `res.status === 422` is the whole "is this a coaching decision or a crash" test — no need to sniff the error body for known reason strings, which would have been a fragile allowlist that breaks every time a new refusal type is added. Route status codes are a contract; use them.
**Product/creator learning:** This is the single most important screen in the charity flow and it was the worst one. A first-time marathoner who can only run two days a week did the honest thing, got a correct coaching decision, and the app told them it had broken. "Something went wrong" over a considered "not yet" is the difference between a runner who adjusts and a runner who deletes the app and tells the charity it doesn't work. The fix is 90% reframing and 10% code.
**AI-building learning:** The messages themselves matter as much as the frame. §111's refusal message I wrote in brand voice ("15 km a week is too low to build safely to a marathon yet, get to about 13 km first"), but the older §44/§52 messages are still shouty diagnostic strings ("2 days/week is not enough for a MARATHON"). Reframing the container doesn't fix the contents — and re-voicing governed refusal messages moves the parity hash, so it's a separate, measured job. Knowing where to *stop* a copy pass is a real skill.
**The honest bit:** I couldn't screenshot the finished screen. It's behind auth and needs a specific refusal input to reach, and this repo's own history says exactly these unseen screens are where design drifts — the sign-out link "changed the design twice" only once someone built a preview page. I reused a proven pattern (the amber coach-note block) and verified the logic, but the real visual is an on-device residual, and I'm flagging it rather than pretending I saw it.
**Hook material:** The most important screen in the charity onboarding flow told runners "Something went wrong" every time the coaching engine made a correct decision to say "not yet" — a one-word framing bug sitting on top of good coaching.
**Postable?:** maybe — pairs well with the §111 post as "the two-part story of one bad refusal".

## 2026-09-18 — MARATHON-VOLUME-GATE-01 / §111 · A one-line refusal in an API route was turning away the exact people we built the charity flow for
**Shipped:** The marathon "you don't have enough base" refusal moved from an ungoverned `current_weekly_km < 20` line in the API route to a governed §111 base-build ceiling in the engine, expressed on the delivered-peak-vs-real-base ramp, admitting the charity cohort and refusing only the genuinely reckless low base.
**Dev learning:** The whole thing hinged on picking the right *denominator*, and my first instinct was wrong. peak/week1 looks like the obvious "how much does this build" metric — and it's useless here, because week 1 is floored at 35% of peak, so peak/week1 is flat at ~2.6 across the entire low-volume cohort. The honest metric is peak/**current** — the jump off where the runner actually is — which is monotonic and spans 1.3× to 9.4×. Same lesson this codebase keeps teaching: measure the real delivered plan before choosing the number, because the intuitive metric was measuring the floor, not the ask.
**Product/creator learning:** The bug was invisible for the worst possible reason. The gate lived at the API route, and every test (property sweep, cohort grid, fitness harness, the persona suite) calls `generateRulePlan` directly — *inside* the route. So M1, the flagship first-time charity marathoner at 15 km/week, passed every single internal check while being refused at the door in the actual app. "A refusal that lives at the boundary is invisible to every test that starts inside it." The fix was as much about *where* the rule lives as *what* it says.
**AI-building learning:** The Coaching Board's conflict-scan missed a real collision (§111 vs the "give the honest beginner a plan" behaviour the founder had flagged), and I only caught it because the full test suite went red on four unrelated-looking files. The structured board process is good but not infallible; the mechanical gate (2174 tests) is what actually caught the doctrine conflict. Belt and braces — the review reasons, the tests verify.
**The honest bit:** I nearly shipped a genuine doctrine reversal without noticing. §111 refuses a 5 km-base beginner marathoner — which directly contradicts a founder-driven decision (UX-BEGINNER-01: don't punish the honest beginner). The right resolution turned out to be "refuse the reckless tail, keep the honest note for everyone who can actually start" — but I had to stop, reconvene the board, and ask the founder before touching those tests. The measurement that saved it: week 1 is 18 km for *everyone*, so for a 5 km runner it's a 3.6× spike, and for a 15 km runner it's a 1.2× step. The label ("maintenance") had been hiding a load hazard for months.
**Hook material:** A first-time charity marathoner running 15 km a week was refused a plan by a single hardcoded line — `current_weekly_km < 20` — while passing 2,100+ automated tests, because every test ran the engine directly and the refusal lived one layer up in the API route.
**Postable?:** yes — "the bug that passed every test because the tests couldn't see it" is a strong, honest engineering post.

## 2026-09-18 — AUTH-BEARER-MISSING-01 · A paid feature was 401ing on every device and nobody had reported it
**Shipped:** Two client calls to authenticated API routes were sending no bearer token and failing silently on native; both now go through `authedFetch`, and a build-time guard walks the source so it cannot come back.
**Dev learning:** The interesting one wasn't the fix, it was *why converting the working sites too was the right call and one of them wasn't*. Five sites hand-rolled the same four lines `authedFetch` already owns — three copies plus the two that forgot entirely. Folding them onto the helper is the obvious DRY win, except `wizard-benchmark-estimate` wraps `getSession()` in `withTimeout(3500, {session:null})` so a stalled session read on native can't hang the wizard — and `authedFetch` calls `getSession()` with no timeout. Blindly consolidating it would have quietly regressed native resilience. So the guard couldn't be "must use authedFetch"; it had to be the weaker, truer property: "an authed route must be called with an Authorization header, however you attach it." That one bespoke site is the reason the guard is shaped the way it is.
**Product/creator learning:** The silent-failure tax again. `/api/recalibrate-zones` is the paid time-trial recalibration (ADR-014). On native it 401'd every single time, and it never surfaced because the catch just sets an error state with no telemetry — a paying user completes a time trial, confirms, and it silently does nothing. Zero reports, because "it didn't work" isn't a bug someone files, it's a feature they quietly stop using.
**AI-building learning:** The backlog handed me a five-row table of "all five bare fetch sites." I wrote the guard to resolve every fetch to its route rather than trusting the table, and it immediately turned up a *sixth* site the table had missed. The lesson that keeps repeating here: a document about the code is a lead, not evidence — the mechanical scan is the evidence.
**The honest bit:** The two-line fix was ten minutes. Everything else — reading all six call sites, proving the timeout nuance was real and not me being precious, designing a guard that resolves routes and can't rot into a no-op, falsifying it both ways — was the actual afternoon. The fix is never the work.
**Hook material:** A £7.99/month feature returned 401 on every device for an unknown length of time, and the number of bug reports was zero — because the failure was a silent catch with no telemetry.
**Postable?:** yes — the "silent 401 on a paid feature, zero reports" angle is a strong build-in-public post.

## 2026-09-18 — LONGEST-RUN-GATE-01 (§113) · The same complaint, the opposite ruling
**Shipped:** The third hardcoded refusal in that API route is now a governed principle, and the route holds no coaching number at all.
**Dev learning:** Two gates, one function, identical-looking complaints — ungoverned number, bare string, no alternatives — and **opposite rulings**. §111's volume gate refused 15 km/week at a +135% ramp while permitting 20 km/week at +160%: non-monotonic, so the threshold itself was wrong. This one refuses at 4 km (+21% first-week jump) and permits at 5 km (+7%): monotonic, tracking exactly what it protects against, so the threshold is **right**. Everything around it was wrong — the hardcoding, the missing principle, the bare string — but the number was correct. **Pattern-matching the second to the first would have deleted a good threshold in the name of consistency**, and I nearly did.
**Product/creator learning:** The reason the floor is 5 is genuinely elegant and nobody had written it down. §45 already caps week one against the runner's real longest run, and it works — right up until `MIN_SESSION_DISTANCE_KM.long` is applied *after* it and silently wins. **The engine cannot honour its own safety cap below its own floor.** The refusal isn't a coaching opinion, it's that limitation stated honestly. That belonged in the constitution years ago.
**AI-building learning:** My first measurement divided session duration by a **hardcoded 7 min/km** — on a cohort whose plans are duration-anchored, so every number was fictional. It produced a plausible table that I was one step from taking to the board. The tell was that week-1 distance didn't move with the runner's longest run, which should have been impossible given the cap exists. **A measurement that contradicts a mechanism you can read is usually wrong about the measurement.**
**The honest bit:** Then I measured the new rule on the cohort grid, got **0 refusals out of 35,952**, and briefly believed it. The grids carry exactly four longest-run values — 8, 12, 14, 20 — all above the floor. The property sweep refuses **2,634**. This repo already has "measure on the sweep, not the cohort grid" written down from a previous incident, and I read it this morning. The corpus that cannot express your cohort will always tell you your rule is dead.
**Hook material:** Our app refused runners with a hardcoded number in an API route. When I finally measured it, the number turned out to be right — for a reason nobody had written down, involving two safety rules applied in the wrong order. The gate was compensating for an engine limitation, and the person who put it there probably knew that and had nowhere to say it.
**Postable?:** yes — "same complaint, opposite ruling" is the story, and it's the best argument for measuring before you tidy.


## 2026-09-18 — WIZARD-TIME-CHIPS-01 + FIRSTRUN-MOMENTS-01f · The fix that would have caused the bug it prevents
**Shipped:** The wizard's time chips now read like every other duration in the app, and a charity runner sees one true fact about the cohort they have joined.
**Dev learning:** The chips were the clearest example this week of why "just rename the label" is never just that. The selected chip was stored **as its label**, in state and in the saved draft, and matched back by label. So the ADR-015 fix — renaming `90 min` to `1h 30` — would have made every in-flight draft match nothing, yielded `undefined`, and **silently turned a runner's weekday cap into "No limit"**, changing the plan they got. The fix causes the defect it exists to prevent, unless you also give the chips an identity that is not their appearance. That is the whole lesson: identity and display are different things, and storing one as the other works right up until you improve the display.
**Product/creator learning:** I cut a line of SLT-approved copy. The card was meant to say *"most of them have never run a marathon either"*, and **nothing in the app measures that**. It would have been a warm, plausible, unfounded claim about several hundred people. What is left — the partner's name and the size of their cohort — is checkable against a table. Less copy, and the only version I can defend.
**AI-building learning:** This was the **fourth** time today I retracted a claim that something was impossible or unread. I had filed 01f as blocked on moving code redemption to sign-up. There is a comment in `DashboardClient` stating there are three doors into redeem, one of them the wizard. **I had written the blocker without reading the code that contradicts it, and the contradiction was in a comment, in English, in the file I was about to change.** The pattern across all four is identical: I assert absence from a search I imagined rather than a path I traced.
**The honest bit:** I also placed the new card third while its own comment said it belonged last. Caught it immediately, but it is the same small failure as the blocker — writing the reasoning and then not following it. The comment is not the work, and neither is the plan.
**Hook material:** We were about to fix a label. Renaming it would have silently changed the training plan of anyone who happened to be halfway through our signup form at the moment we deployed — because the app remembered which option you picked by storing the words on the button.
**Postable?:** yes — "we stored the button's words as the answer" is a one-line explanation of a whole class of bug.


## 2026-09-18 — §112 · The board could not amend the principle, because there wasn't one
**Shipped:** A session skipped because the runner was too tired now counts toward the fatigue trigger that softens their next long run.
**Dev learning:** The mandatory conflict scan is supposed to find contradictions between principles. This time it found an **absence**. The code had cited "CoachingPrinciples §R20-T4" for a year and **there is no §R20-T4** — the constitution's only `R20` reference is an unrelated tier gate. Worse, two ratified sections *depend* on the mechanism while never defining it: the reframe risk gate silences on "3 consecutive Heavy/Wrecked", and the recalibration trigger requires "no concurrent fatigue accumulation". **The constitution was leaning on a rule nobody had written.** You cannot amend that; you have to ratify it first, which is what the sitting actually produced.
**Product/creator learning:** And then the real blocker, which neither I nor the SLT had found in two passes over this feature: the route fetched the fatigue window with `.eq('status', 'complete')`. **A skipped session was never in it.** Not since I moved the column that morning — from the beginning. I had spent the previous hour fixing the *storage* of a signal that the query could not have seen either way. Fixing where a value is written is worthless if nothing selects the row.
**AI-building learning:** I nearly filed this as the same governance-bypass class as two earlier findings — a coaching numeric in the wrong file, invisible to every gate. It wasn't. `CLAUDE.md` explicitly sanctions that module for load thresholds. **The file was right and only the principle was missing**, and had I pattern-matched it to the earlier two I would have sent the remedy to the wrong layer — moving numbers that were already in their correct home instead of writing the section that was absent. Three similar-looking findings in one day, and the third one is genuinely a different shape.
**The honest bit:** The coverage gate refused my first attempt to register the new test, because nothing had ever shown it could fail. It made me add it to the mutation harness, which then killed 5 of 5. That is the second time today a gate I did not write caught me claiming coverage I had not earned — and both times my instinct was that the check was being pedantic. It wasn't.
**Hook material:** Our code had cited a coaching principle by number for a year. Two other principles were built on top of it. When I went to amend it I discovered it had never been written — the section number returns nothing. The rule was real, it ran in production, and its only definition was a comment pointing at a document that didn't contain it.
**Postable?:** yes — "the citation was real, the principle was not" is the story, and the two dependent sections are what make it more than a typo.


## 2026-09-18 — FIRSTRUN-MISSED-01 · Three retractions in one day, and this one I caught before building
**Shipped:** The missed-session reason now has its own database column instead of squatting in the fatigue one.
**Dev learning:** I had filed this as "a runner reports an injury and nothing reads it". The impact analysis, which I now do before writing code, found that the client POSTs the reason to `/api/adjust-plan`, which runs §21's content filter and an injury volume reduction. **The reason is acted on. My finding was wrong and it was already in an SLT record.** What is actually broken is narrower and more interesting: the reason was *stored* in the fatigue column, and the fatigue trend accepted any non-null value into a five-entry window whose last three drive the high-fatigue trigger. So a `'Life got busy'` does not sit there harmlessly — it **takes a slot**. A dead value in a fixed-size window is not inert, it is displacement.
**Product/creator learning:** I checked production before writing the migration instead of after. 13 of 83 tagged rows were reasons, four users had one inside their last-three window, and **for two of them all three slots were reasons with no fatigue data at all** — a trigger that needs two of three was unreachable for those people. That turned an argument about tidiness into a defect with names attached, and it took one query.
**AI-building learning:** This was the **third** time in one day I claimed something was dead or unread and had to take it back — the §80 branch, the deck's refusal thresholds, and this. The mechanism was identical every time: I grepped the consumers I could think of and treated a negative result as proof of absence. A value can leave a module by a route you did not imagine — an API call, a route wrapper, a different corpus. **Start at the producer and follow the value out.** I have written that down as a standing rule rather than treating three of the same mistake as bad luck.
**The honest bit:** The first two retractions were caught by the founder and by an existing test. Only this one I caught myself, and only because he had told me that morning to do the impact analysis *before* writing code. I had been doing it after, which is not analysis, it is justification.
**Hook material:** Our app asks you why you missed a run. Two users had answered that question so consistently that their fatigue alarm could no longer fire — every slot in the three-entry window it reads was filled with "life got busy", which the alarm cannot match. The feature was working. The storage was eating the signal.
**Postable?:** yes — "a dead value in a fixed-size window is not inert, it is displacement" is the line, with the two-users measurement as proof.


## 2026-09-18 — FIRSTRUN-MOMENTS-01c/d/e · The analysis found four bugs before the feature existed
**Shipped:** The generating ceremony now says things only true of the runner in front of it, and the plan reveal states its own honest size.
**Dev learning:** The founder set a standing rule this session: analyse upstream and downstream impact **before** writing code, and fold what you find into the build rather than into a follow-up note. I had already started writing when he said it, so I stopped and did the analysis properly. It found four things. The reveal screen had **never been passed `preferredUnits`** — DashboardClient hands it to Today, Plan and PostRun and not to this one — so every card on it was km-only for a miles runner. A card shipped hours earlier was formatting distance as `` `${Math.round(km)} km` ``, which re-implements the ADR-015 rule the whole app just got fixed to obey, and **its test had pinned the defect** by asserting `'5 km'`. And my own new wiring would have shipped completely silent: the ref I was reading is only set *after* the plan arrives, on one branch, and the ceremony renders while it is still building. **Not one of those four was the feature. All four were found by looking around it.**
**Product/creator learning:** Two facts wanted to be two cards and are one. "How far in total" and "what's the worst day" are the same question — *how big is this thing?* — and answering it twice would have made a four-card reveal. The restraint is the product here as much as anywhere.
**AI-building learning:** I wrote an injury lookup table keyed `shin_splints`, in a file where I had *already written a comment warning about exactly this*, citing the incident where `'Shin splints'` versus `'shin_splints'` killed three injury types in production. The wizard sends `'shin splints'` with a space. **Writing the warning is not the same as heeding it** — the fix was to delete the table entirely so there is no enum to get wrong. Separately, tsc rejected a config key I had invented rather than looked up. The type system caught the lazier of my two guesses; only reading the source caught the other.
**The honest bit:** I committed all three items with a message describing only one of them, because I reached for `git add -A` without checking what was staged. The message was accurate about 01c and silent about 01d, 01e and the units fix — a record that did not match the work. Caught it on the next command and amended. Small, but the build log exists to say what happened, and what happened is that I nearly left a misleading commit in the history of a day that already contains two wrong claims I had to retract.
**Hook material:** I wrote a code comment warning about an exact bug class, then committed that exact bug eleven lines further down the same file. The type checker caught a different mistake in the same function. Neither of those is the feature — the feature worked first time.
**Postable?:** yes — "writing the warning is not the same as heeding it" with the shin-splints table as the evidence.


## 2026-09-18 — CI-TIMEOUT-01 · The test had been shouting for weeks and nobody was listening
**Shipped:** A real budget for the exhaustive grid test that went red in CI, and a trim to the test I had added four hours earlier.
**Dev learning:** The rule this repo already had — *measure a CI timeout, do not re-run it* — is right, and I still nearly got the wrong answer by measuring in the wrong place. Run **alone**, the failing file takes 8.7s. Run **inside the full suite**, where workers contend for cores, the same test takes **15.3s**. At the measured 3.5× CI factor that is the difference between a ~31s projection and a ~54s one, against a 30s budget. I wrote the isolated number into a code comment as though it were the real one before catching it. **Measure a timeout in the context it times out in.**
**Product/creator learning:** Nothing user-facing, but one thing worth saying about ownership: I checked whether my own change caused it before doing anything else, and it had added 1.4%. Not the cause, not blameless either. Both numbers went in the commit message. "It was already broken" is only half an answer when you made it 1.4% worse.
**AI-building learning:** The test I added that morning had become the **second slowest in the entire suite** — 4.7 seconds to check that some copy does not print raw minutes. I had reached for `i % 37` because it looked like a small number next to 31,104 and never asked what it cost. 211 does the same job in 1.0s. **A sampling stride is a performance decision wearing a correctness costume**, and I make that decision a lot without noticing.
**The honest bit:** `vitest.config.ts` sets `slowTestThreshold: 1000` for exactly this, with a comment saying drift toward the wall will be *"VISIBLE in the run output before it is red"*. It worked perfectly. **8.7 seconds has been printed on every single green run for weeks.** Nobody reads the output of a run that passed. That is the third time this codebase has taught me that printing is not a gate, and I have written the lesson down twice already.
**Hook material:** Our CI went red on a test nobody had changed. The test had been printing "8.7s" on every green run for weeks, right next to a config comment explaining that printing it was supposed to stop this exact failure. It was never a warning anybody would see, because the only runs it appeared in were the ones that passed.
**Postable?:** yes — "printing is not a gate" with the config comment as the punchline.


## 2026-09-18 — LR-SHORTFALL-CAUSE-01 + NOTE-DURATION-FMT-01 · The founder read one tile and found two bugs
**Shipped:** Plan notes now speak in hours past the hour instead of raw minutes, and §80's long-run shortfall note names the constraint that is actually binding rather than blaming the runner's weekly volume for everything.
**Dev learning:** The reported bug was cosmetic. The one underneath it was not. §80's note offers two explanations for a short long run, and measurement said it had given the same one **5,264 times out of 5,264** — while 71% of those plans sat two to three minutes under the very cap it declined to mention. The reason was structural and quite pretty: the cap is applied on the **kilometre** axis, `absCapMins / paceMinPerKm`, and the distance is then rounded, so a capped long run always lands just *under* its ceiling and could never satisfy a one-minute tolerance. The gap histogram settles it: 2,420 plans at 2 minutes, 1,316 at 3, **nothing at all at 4 or 5**, then a scattered tail from 6. That empty band is two different populations, and it means the threshold sits in a flat region instead of on a cliff.
**Product/creator learning:** §40c already had the doctrine — a note must name the lever, and *"notes that fire on noise get ignored, which costs more than the note gains"*. Its sibling note had no materiality floor at all and would fire over a **two-minute** shortfall while warning that race day would be "new territory". The fix wasn't a new idea; it was applying an existing one to the note nobody had re-read. McMillan's amendment was the sharpest part: when the ceiling is what binds, there **is** no lever, so the note must stop implying the runner should train more.
**AI-building learning:** Twice in one hour a measurement script told me something clean and false. The first pass reported "0 notes speak raw minutes" because I had guessed seven `meta` key names and matched none of them — 14,832 notes seen, zero inspected. The second reported "0 name the time cap" **after** the fix, because I had changed the note's wording and the script still grepped the old phrase. Both printed a tidy table. The habit that saves you is boring: make the script prove it can see the thing before you believe it can't.
**The honest bit:** I took "the branch is structurally dead" to the board as a finding, and a test already in the repo disproved it — `noteNamesBindingLever.test.ts` constructs a slow high-volume marathoner who *does* reach the cap, and that case fired correctly under the old predicate. The honest claim was always "zero in 5,264 across these two grids", which is a statement about the corpus, not the code. I corrected it in all four artifacts. It didn't change the ruling; it would have changed what the ruling was allowed to say.
**Hook material:** Our app told 5,264 runners that their weekly mileage was holding their long run back. For 71% of them the real answer was a hard safety ceiling sitting two minutes above where they already were — a limit we put there on purpose and had never once mentioned. The code even had a comment claiming it named whichever constraint was binding.
**Postable?:** yes — "the cap is applied in kilometres, the note is written in minutes, and the rounding between them hid the truth from 5,264 people" is a good, specific story.


## 2026-09-18 — ONBOARD-EXIT-01 · Four passes, and the device found what none of them could
**Shipped:** A sign-out on every onboarding screen (there was none on three of four), the optional first-name field on sign-up now says it is optional, and a dev-only fixture page for four screens that could not previously be seen.
**Dev learning:** The pre-ship gate found a live defect on a feature I had already called done twice. I had written `await supabase.auth.signOut()` and thrown the result away. Reading `GoTrueClient._signOut` in `@supabase/auth-js`: it revokes the token first and, on any error that is **not** 401/403/404/session-missing, `return`s **before** `_removeSession()`. The promise **resolves**, carrying `{ error }`. So on a flat network failure — a phone, mid-onboarding — the default behaviour is: the user is told nothing, lands on the login screen, and is **still signed in**, because the `sb-<ref>-auth-token` cookie was never touched. That is the founder's exact demo use case, sign out of the test account and hand the phone over, failing silently in the one direction that matters. It now reads the error and clears the session cookie itself.
**Product/creator learning:** The ask was "drop the first-name box, make it slicker". The field was **already optional** — no validation, and the handler skips it cleanly. It just rendered as the first of three identical boxes above two that genuinely are required, with nothing to say so. Nobody skips a field they believe is mandatory, so the optionality existed only for whoever read the source. **The friction was never the field, it was the disguise.** The SLT declined the deletion and took the label instead: same slickness, and we keep the name six prompt builders, the trial emails and the avatar all use. Deleting it would also have part-reverted a fix shipped the previous day, which is its own signal the first decision was not finished being thought about.
**AI-building learning:** I reported this done three times and was challenged three times, and the pattern is worth naming: **compiling, rendering and working are three different claims, and I kept reporting the first two as the third.** Pass one was "tsc clean, suite green". Pass two was "I looked at it at 375px". The only evidence the sequence ran in the right order was a test comparing two string positions in the source file — a claim about text, not execution. Nothing in either pass would have failed if the `finally` never fired. The fix was not more diligence, it was a different **kind** of evidence: tests that execute the thing, then deliberately breaking the source to prove those tests can go red, then clicking it in a real browser. All three passes were honest. Only the third was about behaviour.
**The honest bit:** My first commit said, truthfully, that the three onboarding screens were unseen — auth-gated, no fixture page. That is a description of the problem, not a reason to stop. Building the fixture page took minutes and found two defects immediately, neither reachable by any test, because both are facts about two elements sitting *next to each other*: the new link landed directly under Connect Runs' own "Not now →" skip as a near-identical muted pair (one skips a step, one ends your session, on the only onboarding screen where you have a plan to lose), and the `disabled` state changed only the CSS cursor, so a link that could not be pressed looked exactly like one that could. And the worst finding came last, from a checklist I nearly treated as paperwork — the ship skill's silent-failure gate, box 1.
**The bit the device found, after all of that:** I pushed, and the founder tested it on his phone. Sign-out took him **out of the app and into Safari**. Capacitor iOS allows a full-document load only when the URL `starts(with:)` the whole `server.url` string, and ours carries a path — `https://www.zonna.run/dashboard`, set deliberately to skip a redirect flash on launch. So that check silently means *"only `/dashboard/*` is in-app"*, and `/auth/login` got handed to `UIApplication.shared.open`. The fix is a client-side `router.replace`: a history navigation never reaches the policy handler at all. **And the rule was already written down in our own codebase**, at `DashboardClient.tsx:255`: *"router.replace stays inside the WKWebView — window.location.href triggers Capacitor's external-navigation handler, which on iOS opens Safari."* I overrode it an hour earlier, with a comment confidently explaining why a hard load was better. Someone had already paid for that lesson and left me a note.

**Hook material:** I shipped a sign-out button, said it was done, got challenged, said it was done again, got challenged again. On the third pass I read the library source and found that our sign-out could leave you **signed in** — the session cookie survives any network failure, because `supabase-js` returns before it clears local state and we never read the error it handed back. Three green test suites, one browser check, and a feature that could silently not sign you out.
**Postable?:** yes — the "compiling, rendering and working are three different claims" framing is the strongest thing here, and the supabase early-return is the concrete that proves it.

## 2026-09-18 — PLAN-WEEK-COLLISION-01 · A brand-new plan arrived 94% already finished
**Shipped:** `week_n` is a within-plan coordinate that five tables were using as a cross-plan key. A new race plan restarts week numbering at 1, so it inherited the previous plan's completions. Marked superseded instead of renumbered or deleted; 45 reads filtered; a build-failing guard and a daily production probe added.
**Dev learning:** I recommended the wrong fix first and nearly shipped it. The obvious move was to continue the week sequence the way the maintenance handoff already does — ADR-013 solved this exact collision that way in August. Then I checked what `week.n` actually means and found the engine uses `w.n > 0` as its "is this a real plan week" guard, with foundation weeks numbered negative. Offsetting every week would have pushed foundation weeks positive and quietly corrupted the taper curve. **I would have fixed a display bug by shipping a coaching one.** The check that caught it took ninety seconds and I only ran it because I'd written down "measure the premise before taking it to the board" after getting three diagnoses wrong in one day last week.
**AI-building learning:** My bulk transform touched 45 read sites and got two whole categories wrong. It filtered run-keyed lookups, which would have hit a unique constraint on the ingest path, and it broke seven chains by inserting a line after a trailing comma. Both were caught by things I'd written thirty minutes earlier: the constraint check, and the guard test itself, which found five sites the transform had silently skipped because its chain-walker stopped at comment lines. **The guard caught my own fix being incomplete on its first run.** That is the argument for writing the mechanical check before you believe the change is done, not after.
**The lesson I paid for twice:** Asked to double-check, I ran one schema query and found my own fix had missed three tables — including `weekly_reports`, which ADR-013 names explicitly in its list of week-keyed tables. I'd written the list from memory and prose instead of asking the database. Worse: the guard I'd built an hour earlier iterates that same list, so it was structurally incapable of catching the omission. Green, thorough, falsification-tested, and blind to exactly the thing it existed for. **A checker that shares the producer's predicate cannot catch the producer being wrong** — this repo has that written down about a different test, and I reproduced it anyway. The real guard now asks the live schema, because adding a table to the database is the act that re-opens the defect.
**The honest bit:** This was live for six weeks and found because the founder opened his own plan and read it. Nothing threw, nothing logged, every gate stayed green, `npm run verify` passed the whole time, and it could not have done otherwise: `validatePlan()` validates the plan object and the collision lived in another table. Only one user has ever hit it — the only one who has finished a plan and started another. With 500 charity runners arriving, and a race-date change counting as a new plan identity, "someone happens to look" stopped being an acceptable control.

## 2026-09-17 — EST-VDOT-DERIVED-01 · Two of our own numbers disagreed, and the one users saw was the one nobody had reviewed
**Shipped:** The no-benchmark race estimate is derived from the runner's own classification band instead of a hand-authored table. Contradictions with our classifier: six of twelve, to zero.
**Dev learning:** The conflict scan is the whole reason that board exists and it earned its keep in one query. I tested all twelve cells of the lookup table against §13's fitness thresholds, which are ratified, documented and sitting in the config file. Six cells asserted a VDOT that our own classifier says belongs to a different level. A runner we had labelled "experienced" was handed a number our threshold calls intermediate. Both numbers are ours. They cannot both be right, and the one reaching runners was the one no principle explained.
**Product/creator learning:** The chair refused to let me re-tune twelve numbers, and he was right. Hand-authored tables drift from the principle next to them, which is exactly what had already happened here. Deriving the estimate from the classifier's own bands makes the contradiction impossible rather than corrected once. The nice part fell out for free: the fractions I needed were already sitting in the one row of the old table that was internally consistent, so the majority path did not move at all and the blast radius landed only on the two rows that were wrong.
**AI-building learning:** The table was in an API route. Not the config file, so no principle explained it; invisible to the config-principle sync test; and the coaching-guard hook does not watch that path. Every governance layer this project has, bypassed by twelve numbers being in the wrong file. We have written that lesson down once already, about a different table, and it says so in CLAUDE.md. It happened again anyway, and the only reason it surfaced is that the founder asked where four numbers came from.
**The honest bit:** I missed §109 in my own conflict scan. There was already a ratified principle saying a progress surface may state "an estimate from measured fitness, carrying its confidence in the copy, not in a tooltip", and the card breached both halves: nothing had been measured, and the confidence was a chip colour. I only found it because a test file mentioned it in passing while I was looking for something else. The scan is mandatory precisely because I am not reliable at it, and today it was the tooling that caught me, not the discipline.
**Hook material:** Our app had two numbers that disagreed about the same runner. One said "you are an experienced runner". The other, three files away, assigned them an aerobic score that our own definition calls intermediate. Both were ours. Six of twelve combinations were wrong the same way, and the one users actually saw was the one no rule had ever been written for.
**Postable?:** yes

## 2026-09-17 — RACE-PROJ-PRECISION-01 · We were telling runners their marathon time to the second, from a dropdown
**Shipped:** The wizard-bracket race projection renders at minute precision, the action leads, and the table sits behind a tap.
**Dev learning:** The founder asked how four race times were derived for a runner with no history and no benchmark. Answer: a three-by-four lookup table indexed on two wizard answers. I reproduced all four numbers to the second from the table cell. The whole no-benchmark population has nine possible outcomes.
**Product/creator learning:** Precision is a claim, and it is a louder claim than any caveat sitting next to it. We had a grey "LOW" pill beside "3:54:16" and told ourselves that was honest. Sixteen seconds of precision overrides a pill. The fix was not better labelling, it was making the shape of the number say estimate: 3:54, and under an hour "49 min" rather than "49:00", because mm:00 re-implies the thing you just removed.
**AI-building learning:** I queried the live database rather than reasoning about how common this was, and it changed the recommendation. Fifty-eight percent of real plans have no benchmark, so this was not an edge case, it was the default experience. Better still: of six comparable plans, two runners answered the training-age question and two declined it, and all four were shown identical figures. Our code substitutes the middle bracket for a declined question, so "I would rather not say" and a real answer produce the same confident output. That is the sharpest version of the problem and I would not have found it by reading code.
**The honest bit:** The design already had the right mechanism and applied it backwards. A pass three days earlier collapsed the table behind a tap when a runner had real trajectory data, and left it fully open when they had none. The state with the least evidence was showing the most numbers, full width, at the top of the card. Nobody noticed because the card is paid, auth-gated, and fetches on mount, so the majority path had never been rendered anywhere a person could look at it.
**Hook material:** Our app told a runner their marathon finish time would be 3:54:16. Sixteen seconds of precision. It came from a dropdown they filled in during signup, and for 58% of our users that is the only input we had. Two of them had declined to answer the question entirely and got the same number as the people who answered.
**Postable?:** yes

## 2026-09-17 — DOC-STATE-GATE-01 · Asked three times if the docs were current, right three times, wrong three times
**Shipped:** A hook that flags a dated "state at end of day" paragraph once a ship has moved past the commit it names.
**Dev learning:** Nothing I wrote was wrong when I wrote it. I wrote "state at END of the day" in the middle of the day and then kept working; six more ships landed after one of those commits. The document did not decay, the tree moved underneath a sentence that had frozen a number.
**Product/creator learning:** Look at what did NOT go stale on the same day: every feature-registry row, every build-log entry, every principle amendment, every invariant. All of those are checked by a hook on every commit. The only things that rotted were the paragraphs where I am the only check. I had spent the whole day telling the founder that a rule which holds only while someone remembers is not a rule, and applying that to the engine and not to my own reporting.
**AI-building learning:** Its first catch was my own next commit, two minutes after I wired it. That is the best possible outcome for a gate and the clearest sign the failure was structural rather than careless.
**The honest bit:** The gate has a hole I found the same evening, by hand: it went six hours without a registry row of its own, because the ship-record hook exempts tooling-only commits and this one only touched hook scripts and CLAUDE.md. The thing I built to stop documents going stale had a stale document. Found by an audit, not by a hook, which is exactly the situation it exists to prevent.
**Hook material:** I was asked three times in one day whether the documents were up to date. I said yes three times. All three answers were true when I gave them and false within the hour, because I had written "end of day" in the middle of the day and then carried on working.
**Postable?:** yes

## 2026-09-17 — PLAN-NOTE-VOICE-01 · We shipped a feature nobody had looked at, and it was a wall of text
**Shipped:** The "Why this plan" tiles go from a mean of 130 words to 67, worst case 254 to 117, and 510 of 513 plans now show exactly one tile instead of two or three.
**Dev learning:** The registry entry for the original ship contains the sentence "Not visually smoke-tested behind auth (trivial map over tested logic + proven components)". That is the whole story. The logic was tested, the components were proven, the map between them was trivial, and the result was a page of engine-voice shortfall that no runner could use. Every part was verified and the thing itself was never seen.
**Product/creator learning:** Two tiles blamed the same cause on 78.5% of the plans where they appeared together, and 68 of them prescribed the identical lever. That is not a design debate, it is the app repeating itself and undermining both tellings. The fix that mattered was not shortening sentences, it was deciding that one cause gets one telling and holding to it inside a note as well as between tiles.
**AI-building learning:** One of my new tests was green for the wrong reason and I only found it because I falsified it. The "these two tiles are never shown together" assertion passed with the de-duplication removed, because the word budget I had added in the same change was dropping the second note on length. Two mechanisms, one test, and it was measuring the wrong one. Real notes are long enough that the budget always masks the rule, so the test now runs on six-word synthetic notes where only the rule under test can act.
**The honest bit:** The obvious fix was to make the copy sound like our AI coach, and it is wrong. Free users are never enriched, so routing these notes through the model would have left the free tier permanently holding the cold version of the copy while paid users got the warm one. The honest fix was to write better rule-engine prose, which is more work and less satisfying, and it is the only version that reaches everyone.
**Hook material:** We shipped a feature that explains to runners why their training plan is shaped the way it is. It averaged 130 words of arithmetic. Nobody on the team had ever opened the screen: the logic was tested, the components were proven, and the map between them was "trivial".
**Postable?:** yes

## 2026-09-17 — COPY-GLYPH-01 · We were showing runners legal citations from our own rulebook
**Shipped:** The § symbol no longer reaches a runner (10.8% of plans to 0%), and a guard on the engine's emitted copy keeps it out.
**Dev learning:** One source string was responsible for all of it. The tempting fix is to grep the codebase for §, but that is the wrong instrument: there are ~259 of them and almost all are correct, because a doctrine reference in a code comment or a developer-facing invariant field is exactly what it should be. The only question that matters is "did a runner see it", and the only way to answer that is to generate plans and read what comes out.
**Product/creator learning:** The founder has mentioned this symbol more than once and I had treated it as a typo each time. It is not a typo, it is a category error: the note was written in the register we use to talk to each other about the rules, and shipped to someone who cannot open the rulebook. "The ratio" in the same sentence was the same mistake wearing different clothes.
**AI-building learning:** The guard had to test the OUTPUT, not the source, and that distinction keeps recurring. A string assembled at runtime from a template and three numbers does not exist anywhere you can grep. Our marketing em-dash guard reads files, which is precisely why the brand doc has carried "currently out of scope: the app" for weeks as a known gap.
**The honest bit:** The em-dash half ships as a ratchet rather than a pass, because em dashes are in 100% of plans including 26,727 session labels. I could have made it green by scoping it to the fields that happen to be clean. A test that asserts the debt cannot grow is honest; a test that asserts a problem does not exist because you looked away from it is worse than no test.
**Hook material:** Our training app was showing runners things like "(§45)" in their plan. That is a citation to our own internal rulebook, which they cannot read. We had been treating it as a typo. It was in 10.8% of every plan we generated.
**Postable?:** yes

## 2026-09-17 — AI-PROVENANCE-01 · Our AI coach was taking credit for things a human wrote
**Shipped:** Kit's byline and the AI rail now appear only when a model demonstrably wrote the copy. Single owner, every unknown resolves to "not AI".
**Dev learning:** The card decided whether AI wrote something by checking whether the notes field was non-empty. That answers "are there notes", not "did a model write them", and our rule engine writes notes too. Measured: 41.2% of sessions on a free plan carry rule-engine copy, and a free plan is never enriched at all, so every one of those was falsely attributed. The founder found it on the one session whose copy we deliberately protect FROM the AI.
**Product/creator learning:** The error here is not symmetric and that single observation settled every ambiguous case. Crediting a model for something a human wrote is a false claim about who is talking to the runner. Failing to credit it is just modesty. So the rule became: answer true only when you can affirm a model wrote it, and let every unknown fall to false. That turned three genuinely hard edge cases into one line each.
**AI-building learning:** Provenance has to be recorded at the moment of authorship, not reconstructed afterwards from the shape of the data. We had a plan-level flag saying enrichment "applied_partial", while a separate function was quietly handing individual weeks back to the rule engine and marking nothing. The flag was true and the week was not. Reconstructing provenance from a field's emptiness was always going to drift.
**The honest bit:** This is the third time this week the actual defect was a comment or a signal that described something the code did not do. The card's own comment said "AI mark only when content came from the plan enricher" — which is exactly right, and exactly not what the line underneath it tested.
**Hook material:** Our AI coach had a byline on 41% of the sessions in a free training plan. Free plans never touch the AI. The app was deciding "the model wrote this" by checking whether the text field had anything in it.
**Postable?:** yes

## 2026-09-17 — TT-STRUCTURE-01 + TT-NOTE-HONESTY-01 · The 5K time trial was showing the runner 2 km, and the note beside it said 5
**Shipped:** The §78 benchmark renders as its own shape: warm-up 10 min, main set 5 km exactly, cool-down 5 min. Plus the note stops promising free runners a paid outcome.
**Dev learning:** One bug, not the three the founder reported. The rule engine builds the trial with a comment saying exactly what its fields mean — `distance_km` IS the measurement, `duration_mins` is the effort, warm-up and cool-down live in the note. The composer assumed the opposite for both fields, split the 29 minutes 15/main/5, and stamped distances at 5km ÷ total. So the warm-up ate three of the five kilometres, the time trial was left with two, and the cool-down absorbed the rounding and rendered as zero. A producer and a consumer disagreeing about what a field means, with a comment stating the truth and nothing enforcing it.
**Product/creator learning:** The assertion worth having is not "the numbers are right", it's "the card agrees with the sentence printed underneath it". Nothing checked prose against structure, which is why a note saying 5 km sat above a card saying 2 km for as long as the feature has existed. The fix makes them read the same constant, so they cannot drift again: the warm-up is sourced from the ten-minute floor precisely because ten minutes is what the note already promised.
**AI-building learning:** I had to break a founder-reported guard to fix a founder-reported bug, which is uncomfortable and was the right call. SESSION-RECONCILE-01 asserts every part sums to the total, and the time trial is the one shape where that premise is false by design — the warm-up sits outside the measured distance because the measured distance is what the plan counts. Scoping it out needed a stricter contract in its place, not a looser one, or it is just a deleted test with an excuse attached.
**The honest bit:** Investigating the numbers turned up something worse that nobody asked about. The note told every runner "log the result and your paces update" — and recalibration is paid, while free plans get the time trial too. So a free runner was being sent out to run a maximal 5K for a result the product would not use. The upgrade tile one surface away had been saying the honest thing the whole time. Two surfaces, one fact, and the one that was wrong was the prescription.
**Hook material:** Our app prescribed a 5 km time trial and then drew it on screen as a 2 km session, because one file thought "distance" meant the measurement and the next file thought it meant the whole workout. The coach's note underneath said 5 km the entire time. Nothing checked the picture against the caption.
**Postable?:** yes

## 2026-09-17 — PROFILE-NAME-01 · My own name was hardcoded in the app as a placeholder, and the engine had been calling everyone "Athlete"
**Shipped:** Name capture at email signup, a profile card that prompts instead of labelling, an avatar that never draws blank, and a plan generator that finally knows who it's writing to.
**Dev learning:** Five defects, one family: the app collected a name on one of its three sign-up routes and then used it almost nowhere. The placeholders in the profile fields were my first and last name, typed in during a prototype and never taken out — so on a test account they read as data the app already held. `athlete_name` was set by nothing and read by three things, so every plan ever generated addressed the runner as "Athlete" in the AI prompt while their name sat in `user_settings` two tables away. Nothing was broken. Nothing was wired.
**Product/creator learning:** "Your name" in grey is not an empty state, it's a label pretending to be a value. The fix isn't nicer copy, it's making it tappable: the state has to either resolve itself or say plainly there's nothing to do. Sitting in between is worse than either.
**AI-building learning:** The avatar drew an empty green circle for anyone with no name and had done for months. Cause: `plan.meta.athlete` is an empty STRING rather than absent, so the `??` guard never fired and the split/join chain walked quietly to `''`. That's the fourth `??`-over-empty-string bug this repo has recorded. The test I wrote for it only means anything because I reverted the implementation first and watched three of eight assertions fail — a green new test proves nothing.
**The honest bit:** I could not SEE any of this. The identity card and the profile form live inside a 12,000-line screen behind auth, a plan and a tab, so the only way to look at the missing-name state was to be someone who had it. That is precisely how a hardcoded founder name survives to production. So the components came out into their own files and got a preview page — which is the second time this month the actual fix has been "make it possible to look at the thing."
**Hook material:** My own name was hardcoded into the app as the placeholder in the profile fields. Users with test accounts were seeing it greyed out and assuming the app knew who they were. Meanwhile the AI coach had been writing to every single runner as "Athlete", because the field for their name was set by absolutely nothing.
**Postable?:** yes

## 2026-09-17 — PLAN-FITNESS-GATE-01 · The tool that found the bug was itself un-gated, which is the bug
**Shipped:** `measure:fitness` now runs on every build with a baseline, instead of when someone remembers to type it.
**Dev learning:** I built a harness that found the worst defect of the day, wrote it up, shipped two fixes off the back of it — and left it as a script nobody would run again. Asked directly whether it was part of the process, the honest answer was no. That is the exact shape of every silent-check failure already in this repo's history: eslint installed but never configured, invariants registered but never proven able to fire, config declared but never read.
**Product/creator learning:** The assertion that matters has no tolerance. Build percentages and long-run distances get 5pp and 3pp of room because engine work legitimately moves them. "Did this runner's plan never make them fitter" gets zero, because there is no version of that which is a judgement call.
**AI-building learning:** Falsifying it took two minutes and was the only part that proved anything: revert the fix it guards, watch three of five assertions fire and name the cohorts. A green new test tells you nothing at all — this session already shipped a gate that caught its own author eight hours later, and that only worked because it had been shown to go red first.
**The honest bit:** The prompt for this was the founder asking "is that baked into our practice, and how does it run without prompting?" — not me noticing. I had just spent a day proving that checks which depend on memory do not run, and then left one depending on memory.
**Hook material:** I built a tool that found a defect nothing else could see, used it to ship two fixes, and left it as a script you had to remember to type. On the same day I was explaining why checks that rely on remembering don't run.
**Postable?:** yes

## 2026-09-17 — LR-DELOAD-CUT-01 (§3 Am.) · The recovery week was cutting the wrong thing, and I needed three goes to see it
**Shipped:** A deload now cuts the long run in proportion to the week instead of harder than it. Closes the last marathon shortfalls; the masters knee-history runner goes 26 → 29.5km.
**Dev learning:** §3 says volume drops to 70% "of the prior build week" — a sentence about the week. The long run was being cut a median 30% against the week's 22%, on half of all deloads, because it was re-derived from scratch rather than reduced. It then had to climb back and ran out of weeks. Every remaining marathon gap traced to that one line.
**Product/creator learning:** The mechanism took three attempts and two of them were wrong in public. I said it was the specificity pull switching off in deload weeks — disproved, the gap is identical in base phase where no pull exists. I said sessions were going unplaced — disproved, placed count equals planned on 100% of weeks. The truth was duller and I only found it by instrumenting planned-versus-placed: the long run hits its share of the PLANNED week while the rest of the week gets trimmed during placement, so the denominator shrinks and the long run's share inflates. Then a deload's smaller week takes that trim harder and the share snaps back. The whole defect is an artefact of which number the share is taken against.
**AI-building learning:** The invariants earned their keep twice in one change. INV-PLAN-LONG-CAP-MINS threw on 48 plans because I raised a deload long run without re-applying §9's minutes cap — a 5K plan at 92 minutes against a 90-minute ceiling, which I would not have found by reading. And the LR-CAP-BLIND-01 guard is the reason last night's version of this fix never shipped: it caught a beginner going 7.3 to 18.5km in a week. Tonight's version made that same runner's worst jump go DOWN. Same goal, opposite mechanism, and only the test could tell them apart.
**The honest bit:** Willy bounded this at §52's 60% to stop lopsided weeks, and measured, it doesn't — the lopsidedness lands in the weeks after the one he bounded. That is the second time this session a board amendment has failed its stated purpose while passing its stated condition. I shipped it anyway, with the founder's call, because the alternative leaves injured and older marathoners short on the one session that decides whether they finish. But "the board bounded it" is doing less work in that sentence than it looks.
**Hook material:** A recovery week is supposed to cut your training by a third. Ours was cutting your longest run by half, then spending the next fortnight climbing back. Half of all recovery weeks, every distance, for as long as the engine has existed.
**Postable?:** yes

## 2026-09-17 — PLAN-FITNESS-01 · I got the diagnosis wrong three times, and the fourth one was a flag nobody had toggled
**Shipped:** §2 Am.3 and the §24/§80 specificity ramp. An injury-history runner's net build goes from +6% to +45%; a first marathoner's peak long run from 21 km to 26 km. Plus a committed harness that asks the question none of our checks asked.
**Dev learning:** Every check we own proves a plan is VALID. None asked whether it BUILDS the runner. So a knee-history runner could get eighteen weeks that finish exactly where they started — peak week 25 km in week 1 and week 18, a 14 km longest run before a marathon — with zero violations, zero warnings, and an honest-sounding "maintenance" label on top. The label was true. The plan was useless.
**Product/creator learning:** The isolation was one boolean. Same runner, same race, same everything, toggle `injury_history: ['knee']`: peak weekly 43 km becomes 25, peak long run 22.5 becomes 14. Nothing in the suite compares a runner to their own twin, so a cohort-wide safety rule could halve someone's training and look like a policy rather than a bug. The fix was already half-written — the board had raised the injury deload to 85% the day before, and 85% is short of its own arithmetic break-even at 86.4% and 90.7%.
**AI-building learning:** I presented three diagnoses before testing them and all three were wrong — the long run compounding (it's a passenger, 39% of the rise), a back-loaded curve (it's flat 10%/week; I dumped it), safety caps subtracting volume (post-passes measure 1.00). Each was plausible, each took one measurement to kill, and I only ran that measurement after being told to re-check. The pattern is that I reason to a mechanism and then go looking for support instead of trying to falsify it. The instrumentation that settled it took ten minutes; the three wrong answers took most of the afternoon.
**The honest bit:** Willy's seat reversed its own veto from eleven days earlier, on the numbers, and that reversal is the load-bearing part of this. He had rejected the bounceback exemption because a 70% deload returning to 100% is a +43% week onto healing tissue. What he could not see then was that the cap he chose instead produced a runner who never trained at all. The board being able to say "the injury I was protecting against has been replaced by a worse one" is worth more than it being right first time.
**Hook material:** A safety rule for injured runners worked perfectly. It also meant they finished eighteen weeks of marathon training exactly where they started, with a fourteen-kilometre longest run. Every check passed.
**Postable?:** yes

## 2026-09-17 — LR-ABS-CAP-LOWVOL-01 (§45 Am.2) · The control group was the finding, and the basis I shipped it on was wrong
**Shipped:** The +5km long-run step allowance now tapers on a small long run. A 6km long run may step +3km, not +5km. Ordinary runners are untouched: zero of 1,944 parity cases changed at 55km/wk.
**Dev learning:** I built it on "15% of the prior week's volume" and it broke 140 plans, which threw. §45 runs mid-pipeline and the long run is re-anchored from duration to distance by later passes, so the producer and the checker were reading different weekly volumes for the same week. The fix was not an ordering change — it was noticing that §9 already says the build long run is 30% of the week, so 15% of the week IS 50% of the long run. Same rule, stable input, and the two sides now read the value they already shared. The re-expressed version turned out strictly better than the one the board costed: half the peak-long-run reduction, a third of the plans losing their time goal, and a tighter worst case.
**Product/creator learning:** The finding was the control group, not the cohort. The absolute allowance binds MORE often on ordinary runners — 37.8% of steps against 29.2%. If I had measured frequency across everyone, as the obvious version of this measurement does, the answer would have been "nothing to see". The difference is magnitude: 32.5% of these steps were a 40%+ jump in one week, against 2.7% for everyone else. Twelve-fold. Willy predicted exactly that when he refused the first sitting's evidence, and he was right to.
**AI-building learning:** A board member withdrew his own argument on the data. Willy had reasoned these jumps were tolerable when a recovery week follows; the cohort turned out slightly better protected on that axis than the control, so the argument collapsed and the ruling stood on magnitude alone. Recording a seat correcting itself is worth more than recording it being right — it is the only evidence the board isn't just a format I'm filling in.
**The honest bit:** Hutchinson's line should survive the write-up: 51% is still a large jump, and the median plan is unchanged. This cuts the extreme tail. It does not fix long-run progression, and describing it that way would be the same overclaiming the board exists to catch. It also shipped the day before the charity showcase, against the board's own withheld timing, because the founder made that call with the blast radius in front of him.
**Hook material:** A safety cap ignored how big the runner was. +5km a week is fine on a 30km long run and +83% on a 6km one. It had been that way since the rule was written, and measuring it across all runners showed nothing wrong.
**Postable?:** yes

## 2026-09-17 — RAMP-GUARD-FAILS-OPEN-01 (§94 Am.1) · A safety rule that went quiet exactly when things got worst, defended by a comment nobody had measured
**Shipped:** The delivered-ramp guard now fires on the whole week. Both trimable arms retired. 202 genuine breaches of §2 that were being silently swallowed are now reported.
**Dev learning:** The guard required the whole week AND the non-long-run part of it to breach. A long run that grows sharply shrinks the rest of the week, so the second condition went quiet precisely when the long run was driving the spike. The measurement was brutal: of 202 breaches it silenced, 202 had the long run grow. Zero were the false positive the condition existed to prevent. It had never once done its job.
**Product/creator learning:** The justification was a comment. Someone wrote a plausible mechanism — a race-anchored long run jumps, the remainder swings, you'd get a false alarm — and it was true in the abstract and never checked against a single plan. Then the next person read it as settled and built on it. That is the third time this week a code comment has functioned as evidence. Worse, the comment cited §52 as forbidding a long-run trim; §52 says the exact opposite, listing "reduce the long run" as its first lever. A protection was invented in prose and then relied on as doctrine.
**AI-building learning:** The board changed the answer. I went in proposing "drop the arm" and the conflict scan found the real mechanism was one principle over: every silenced jump was legal only because §45 permits +5km absolute, which on an 8km long run is +63%. Fixing §94 makes the spike visible; §45 is what creates it. Willy wanted §45 fixed today and the chair refused on timing — the charity showcase is tomorrow and that changes what runners actually receive. Both positions recorded, the smaller change shipped, the bigger one filed with the measurement attached. Running the board properly is what produced that split; reproducing its format inline would have produced one confident answer.
**The honest bit:** The runner gets a warning the engine cannot act on — the long run is set by the race and §45 permits the jump. McMillan's objection is real and I don't think it's fully solved: we made the message say "the long run is driving this, take your easy days genuinely easy" rather than pretend the engine failed. That is coaching rather than an error, but it is still a flag with no lever behind it, and if it turns out runners ignore it we will have made the noise problem we were warned about.
**Hook material:** A safety check had a second condition that made it go silent on the most dangerous plans. The justification was a comment citing a rule that says the opposite of what the comment claimed. In 202 cases where it fired, it was wrong 202 times.
**Postable?:** yes

## 2026-09-17 — TEST-BITE-01 · The same hole one register over, and a number I quoted that was two days out of date
**Shipped:** A principle covered by a named test must have that test in the mutation harness, or a written reason plus a hand falsification. One of the 22 had neither.
**Dev learning:** 21 of 22 were already mapped. The gap was §35, whose test imports `generateRulePlan` and nothing else — so the harness's own scoping rule (mutate only what the test imports) would have pointed it at a 7,000-line engine and produced noise. The honest fix was not to force it into the battery but to falsify it by hand: flatten the two long-run tier rungs onto each other and the test goes red in two places. Thirty seconds of work that nobody had done because nothing asked for it.
**Product/creator learning:** I told Russ there were "21 UNREVIEWED mutation survivors" and there were six, all classified with written proofs, since 2026-09-15. I read that number out of a build-log entry instead of running the harness. Quoting your own two-day-old write-up as current state is the same error as trusting a stale config comment, and I did it in the same conversation where I was explaining why stale claims are dangerous.
**AI-building learning:** Three registers now cross-check each other mechanically instead of relying on someone noticing: principles to invariants, invariants to liveness, principles to the mutation harness. Each gate is four lines. Every one of them was available for months and none was written, because the cost of noticing was paid by a human who mostly did notice — until the week they didn't.
**The honest bit:** I shipped this class of fix three times in two days — invariants, then principle-to-invariant, then principle-to-test — and each time reported it as done. The scope was knowable in one pass at the start: list every register that claims coverage, ask what each proves and what it does not, reconcile them all. I did it incrementally because I answered the question in front of me rather than the one behind it, and the customer paid for three rounds of my attention instead of one.
**Hook material:** I built three gates in two days that each took four lines. The reason none existed was that a human had always noticed the gap in time — right up until the week nobody did.
**Postable?:** yes

## 2026-09-17 — COVERAGE-BITE-01 · Two green registers, one hole, and the caveat I put in a code comment instead of telling him
**Shipped:** `principleCoverage.test.ts` now reads the invariant-liveness baseline. A principle cannot be marked "enforced by an invariant" while that invariant sits unproven with nobody having looked. Plus a standing CLAUDE.md rule for how completion is reported.
**Dev learning:** The two registers were each correct and the gap was the space between them. One says a check exists, the other says a check bites, they live in different files, and reconciling them was a job for whoever happened to think of it. Nobody did for six days. The fix is four lines of test that make one file read the other — which is the cheapest possible version of "leave a gate, not a note", and it was available the entire time.
**Product/creator learning:** Russ asked for every invariant to have a test or a written reason. I delivered every *principle* mapped to a check and reported it as done. 107 is not 118. He could not have caught that, and said so: *"we've missed something that I didn't know to ask."* The half-sentence that would have prevented it costs nothing — restate the population before starting, not after finishing. I now do that by rule rather than by judgement.
**AI-building learning:** The worst part was not the noun swap, it was that `principleCoverage.ts`'s own header already said, in English, that the gate does not prove a check fails when the rule is broken. I wrote that sentence. Then I summarised the work without it. A model that documents a limitation and omits it from the summary is not being careless with the code, it is being careless with the human — and the code comment makes it look diligent while doing it. Anything I know well enough to write in a comment, I know well enough to say out loud.
**The honest bit:** Working the 20 down also surfaced that nine maintenance invariants have never been woken either, because the maintenance generator has no liveness corpus at all — and two of them are a live principle's only mechanical coverage. That has been sitting under an honest `corpus` label since the register was written. A declared reason stops debt growing and does nothing to make it shrink; nothing in this repo schedules it. Filed as MAINT-LIVENESS-01 rather than quietly counted as fine.
**Hook material:** My audit said every rule was accounted for. It was true. It was also the answer to a question nobody had asked — and the caveat that would have shown it was already sitting in my own code comment, unread.
**Postable?:** yes

## 2026-09-17 — LIVENESS-DEBT-01 · Twenty rules nobody had proved could fail, and the corpus was the bug again
**Shipped:** The `unclassified` column of the invariant-liveness debt register, worked to zero. 19 of 20 invariants newly proven wakeable, the 20th reclassified with a reason. Woken 86/117 → 107/118.
**Dev learning:** I wrote 17 mutations against 20 rules and got 14. The other six were not rule problems at all — the sample could not contain their trigger. Zero of the 64 probed plans had an injury history and zero were marathons, on a harness whose *second* corpus exists specifically to reach injury-gated mechanisms. Its dedup key names all six axes it varies, so every one of its 1,536 rows is a distinct "shape", the filter removes nothing, and a round-robin across three corpora only ever reaches the first ~21 entries of each — where every axis sits at its first value. Walking each corpus by a coprime stride instead proved five more rules in one run, including one that had been sitting in `corpus` debt as "the harness never builds this shape".
**Product/creator learning:** Three of the six were injury guards — hill work for a hill-restricted runner, the delivered injury cap, the post-deload bounceback. Those are the rules whose failure ends in a boot, and they had been marked "nobody has looked yet" since the register was written. The debt column was honest about being debt; it was not honest about *which* debt, because a rule that cannot be woken by a corpus with no injured runners in it tells you nothing about the rule.
**AI-building learning:** The third time the sample has been the bug rather than the rules, and the first two fixes did not reach it. 2026-09-12 fixed which shapes are in the list. 2026-09-15 fixed which field distinguishes them. Neither touched the fact that the budget is 64 and the list is consumed from the front. Each fix was correct and each left the same class alive, because each answered the question the previous failure had asked rather than the question the mechanism poses. I then repeated it inside the same hour: I added `hard_session_relationship` as a grid axis to reach `INV-PLAN-OVERDO-BRAKE`, the grid went 1,536 to 6,144, and the probe's dedup key — which does not name that field — collapsed it straight back to 1,536 rows all reading `neutral`. The rule was exactly as unwakeable as before, and the run that proved it looked identical to the run before the change.
**The honest bit:** One of the twenty woke by "fires on a valid plan" rather than by a mutation, and for about a minute I had it written up as a live defect the widened corpus had surfaced. It is `warn`, documented as known-open on ~92% of marathon plans, and accepted by the board — the sweep had never hidden it, the sweep gates on `error`. I also let a degenerate proof through at first: `weekly_km = 0` wakes the bounceback rule because `0 >= 0`, which proves the line executes and nothing about whether it catches a bounceback. Re-checked all six order-dependent attributions against their purpose-built mutations afterwards.
**Hook material:** My test harness said twenty safety rules had never been proven capable of failing. Three of them were injury guards. It turned out nobody had ever run them against an injured runner — the sample had none, on the grid built specifically to have them.
**Postable?:** yes

## 2026-09-17 — ENRICH-STRIDES-01 · The AI quietly deleted 80 seconds of training on 12 of 17 weeks, and everything was "green"
**Shipped:** The AI enrichment layer can no longer drop the §28 stride note ("4×20s strides at 5K effort, full recovery between.") when it rewrites an easy run's coaching copy. Found by this morning's ops digest reading a real test-account plan.

**Dev learning:** the enricher rewrites `session.coach_notes` wholesale in `mergePlan`, but `buildUserMessage` had *stripped* `coach_notes` before sending the plan to the model — so the one line the engine cared about was invisible to the thing being asked to preserve it. Telling the model "keep the strides" would have been useless: you can't preserve what you never saw. The real fix is the same shape as the §78 time-trial guard sitting four lines away — `preserveStrideNote()` re-attaches the engine's line at merge, deterministically. A prompt instruction is probabilistic; an invariant needs a guarantee. I did both (prompt so the voice reads well, merge so it's certain), but the merge layer is the one that actually satisfies "every week".

**Product/creator learning:** the damage wasn't a broken plan — the partial-revert system did its job and every plan stayed *valid*. The damage was that 12 of 15 build weeks fell back to plain rule copy, so the paid runner lost the AI coaching voice on exactly the weeks it was supposed to differentiate. Silent quality erosion on the paid tier is invisible in every dashboard that only asks "is it valid?".

**AI-building learning:** two AI systems composing over the same field is the trap. The enricher (AI) writes `coach_notes`; the invariant classifies `coach_notes`. Each was individually correct; the composition silently deleted prescription. The `/ship` gate has a whole box (§3) for exactly this, and it's the third time this repo has been bitten by "feature B rewrites the string feature A reads."

**The honest bit:** every mechanical gate was green. `npm run verify`, the 15,974-plan sweep, the archetype matrix — all passing, for months, while the enricher quietly reverted a chunk of every paid plan. It took a daily digest *reading one plan* to see it. Same lesson as PEAK-STEPBACK and LR-CAP-BLIND the day before: the check that catches these isn't a test, it's someone regenerating a real plan and looking at it.

**Hook material:** 12 of 17 weeks reverted to plain copy on a single live plan; the fix is ~15 lines; the model literally could not preserve the note because the prompt deleted it before showing it the plan. "We asked the AI to keep something we'd already hidden from it."

**Postable?:** yes — "two AIs editing the same field silently deleted the thing" is the engineering angle; "your paid feature can quietly downgrade itself to the free one and every test stays green" is the product one.

## 2026-09-16 — PEAK-STEPBACK-VOLUME-01 (§47 Am.2) · A "recovery week" that was 5km heavier than the week it recovered from
**Shipped:** In the peak block, a step-back week now delivers less total volume than the week before it — not just an easier long run on a week that's still climbing. Came out of running a real generated marathon plan past the Coaching Board.

**Dev learning:** §47 stepped the peak long run back (dropped its marathon-pace finish, capped its distance) and wrote the note "absorb last week's peak" — but `weekly_km` is set by the volume curve, which §47 never touched. So the delivered week kept going up. Measured: 6,720 plans (22.5% of the grid) delivered a step-back week BIGGER than the one before it. The test plan ran 45 → 50 → 54; the "recovery" week was the second-biggest of the block. This is §90's exact principle — "the curve is not the promise, a week you call easier must deliver less" — which had simply never been pointed at the §47 surface.

**AI-building learning — pass ordering bit me three times in one fix.** First I put the trim inside §47 itself; it read the neighbour's `weekly_km` before §45's long-run cap had recomputed it (54, not the final 45). Moved it out to a late pass — still wrong, because V1 "scales non-quality sessions" after it, the exact lesson the taper-depth pass three lines up already records in a comment I hadn't read. Moved it after V1/V4 — green on cohortGrid, 0 violations. Then the **property sweep** (wider grid: injury + experienced + "loves hard sessions") found 3 more: the injury-yield reconciliation runs later *still* and lowers a peak-level week beneath the step-back after my pass has read it. The honest fix wasn't a fourth reorder — it was to scope out injury entirely, because injury peak volume is already owned by §90/§2's reconciliation and layering a second trim on top double-governs the same weeks. **cohortGrid said the injury cohort was empty here; the sweep said otherwise, and the sweep was right.** Three different "it's finalised now" assumptions, three different passes that finalised it later.

**Coaching learning:** the board split the finding. Lever A (make the step-back a volume step-back) was CORRECT and shipped. Lever B (the +5km absolute long-run cap that lets a 12km long run jump 42% in a week) was ruled INSUFFICIENT EVIDENCE — the concern is real but the right number needs a cohort sweep scoped to low-volume runners, not a number picked by intuition. Filed as a measurement, deliberately not built. "Measure where it bites, not on average" (Willy).

**The honest bit:** none of this was found by a check. Every mechanical gate was green on a plan whose "recovery" week was heavier than the week it followed. It was found by generating one runner's plan and reading the peak block — the same way LR-CAP-BLIND-01 and SESSION-RECONCILE-01 were found the same day.

**Postable?:** yes — "your 'finalised' value gets finalised again by three different passes" is the engineering lesson; "we shipped a recovery week that was bigger than the week before it, and every test was green" is the product one.


## 2026-09-16 — SESSION-RECONCILE-01 · The numbers on the card didn't add up, and two tests swore they did
**Shipped:** Every figure on a session card now sums to the session total — by distance or by duration. Before, a 22 km marathon-pace long run showed 2 + 9 + 2 = 13, with the missing ~9 km rendered as a bare "40%".

**Dev learning:** The session card is composed at *display* time, not stored in the plan. Its composer carried a comment promising "parts sum to the session total exactly, by construction" — true for a plain run, false for the one shape that has four parts instead of three. A marathon-pace long run is warm-up + easy body + **race-pace segment** + cool-down, and the segment was rendered as a percentage with no km and never added in. So the visible parts summed to (total − segment), always.

**AI-building learning:** the damning part is that TWO tests claimed to guard exactly this. One summed only warm-up + main + cool-down (three parts — structurally blind to the fourth). The other summed the segment too, but only in *minutes*, and computed the segment minutes *inside the test* rather than reading a figure off the structure — because the structure had no such figure. Both were green while the card lied. A test that reconstructs the value it is checking, instead of reading what the user sees, proves nothing. The new guard composes every session shape across the cohort and asserts on the *rendered* figure, in both metrics and both units.

**The second, quieter bug:** even on a plain run the three parts were each rounded to whole km independently, so 1.4 + 7.1 + 1.4 showed 1 + 7 + 1 = 9 against a 10 km header. Fixed with largest-remainder apportionment — the same "what you add up is what you see" promise `sumRoundedDistance` already made for session→week, now applied to part→session.

**The honest bit:** the founder found this by *reading a card*, same as LR-CAP-BLIND-01 the same day. Two shipped guards, both satisfied, both blind — because both were written from the same wrong mental model of the session (three parts, distance always present) that the code itself held.

**Postable?:** yes — "a test that rebuilds the number it's checking isn't a test." Pairs with the morning's "your checker can't catch your producer if they share the bug."


## 2026-09-16 — LR-CAP-BLIND-01 · A safety rule titled "universal, no phase exemption" had never once run on a beginner's plan
**Shipped:** §45's long-run progression cap now applies to duration-anchored plans. It was skipping every beginner and every ultra.

**Dev learning:** A session is anchored EITHER by distance OR by duration, and beginners are prescribed in minutes (time on feet). Both the producer and the checker read `distance_km`, found null, and bailed. **One bug, two copies — and the checker could not catch the producer because it shared the defect.** That is the part worth keeping: we have a whole governance layer built on the idea that a checker catches a producer, and it is silently void whenever both were written from the same wrong assumption about the data.

The exemption followed the ANCHOR, not the ability. Nobody decided beginners were exempt from a long-run cap; a formatting decision made for good reasons decided it for them, two years ago, invisibly.

**What it was shipping:** a 14-week first marathon, longest run ever 9 km, whose long run went 7.3, 7.8, 8.7, 8.7, 9.7, 8.5 and then **26.0 km**. +206%, to 2.9× the runner's lifetime longest, held two weeks at 76% of the week. §45 exists because of a +185% incident in April. The engine was producing worse than the thing the rule was written to prevent, for the cohort least able to absorb it. 2,271 breaches across 1,568 plans.

**AI-building learning:** I reintroduced the exact defect I was fixing. My first cut read the producer through `sessionKm(s, planEasyPace)` and the checker through `sessionKmSelfPaced` — two converters that disagree for a duration-anchored session. So the two sides disagreed about how long the long run *is*, §45's deload exemption fired on one side only, and the checker started failing plans the producer had deliberately allowed. **Parity caught it; I would have shipped it.** The fix is that the checker has no PaceGuide and therefore MUST use the self-paced reading, so the producer uses it too — agreement by construction rather than by two people remembering.

**Product/creator learning:** capping the spike made plans *smaller* and that was the improvement. It also made **fewer** plans get downgraded to "maintenance" — 49.3% → 48.5%, marathon 71.8% → 69.0% — because the spike was creating the lopsided weeks that triggered the downgrade. **It was manufacturing the constraint it was then excused under.** Our beginner charity marathoner now builds 18 → 43 km where she used to be told the plan holds her fitness.

**The honest bit:** no automated check found this. The property sweep was green, the invariant suite was green, parity was identical. It was found by regenerating eleven plans and *reading one of them* — the Coaching Board's cold re-review. Every mechanical guard we have was satisfied by a plan that would have put a first-time marathoner in a boot.

**Hook material:** the rule was called "universal, no phase exemption" in its own title. It had never run on the cohort that needed it most, because they're shown minutes instead of kilometres.

**Postable?:** yes — "your checker can't catch your producer if they share the bug" is the strongest engineering lesson of the day.


## 2026-09-16 — HSR-NOTE-HONESTY-01 · M5-EASY-CEILING-01 · GOAL-COHERENCE-01 · Three notes that described training the runner never got
**Shipped:** Every runner-facing note that names a constraint now names the one that is actually binding. Three separate instances, all found in one day.

**Dev learning:** The pattern is identical each time — a note asserts a *cause* that the code never checks.
1. The `avoid` note promised *"one hard session a week at most"* to **1,615 plans that delivered zero**, because the beginner ceiling zeroes quality before the cap has anything to cap.
2. Two notes blamed the long-run *time cap* for a shortfall. Measured on a 191-plan grid, the time cap was binding in **zero** of them. **All 191 named the wrong lever.** One of those notes had its own opening comment stating the condition — *"IF `LONG_RUN_CAP_MINUTES` stopped the peak long run…"* — that the code below it never implemented.
3. `goal: 'time_target'` with no target time made 14 call sites believe a goal pace existed when it didn't.

**AI-building learning:** my measurement probe for #1 counted *"note present AND zero quality"* — which is true of the **corrected** wording too, so it reported 1,615 after the fix landed and I briefly thought the fix had failed. Measuring the CLAIM ("does this text promise a cap?") against the delivery was the question I was actually asking. **A probe that can't distinguish the fixed state from the broken one isn't measuring the thing you care about.**

**Product/creator learning:** we have three separate rules demanding honest declarations (§34, §40c, the whole compliance programme). All of them are undone by a sentence that isn't true. A wrong lever is worse than no note: a runner told *"the long run is at its time cap"* when it's at 151 of an available 210 minutes has been given something to act on that doesn't exist.

**The honest bit:** #1 was mine, shipped that morning, in the same session. I wrote a §110 amendment about honest residuals and then attached a dishonest note to it. It was caught by the board reading T2 — the plan we'd spent the morning arguing about.

**Postable?:** yes — "the note is a claim about the artefact, so derive it from the artefact" plus the probe-can't-see-its-own-fix story.


## 2026-09-16 — PARITY-HSR-01 · COMPLIANCE-SILENT-3 · Two checks that failed open
**Shipped:** The parity grid now varies `hard_session_relationship`; the plan now declares when its own target was never reachable.

**Dev learning:** Parity had **never** varied the hard-sessions input — so it reported "IDENTICAL, 5,832 cases" on the exact change that rewrote what those runners are prescribed. Fixed with an appended focused block (108 rows, **+1.9%**) rather than a 9th cartesian axis (4× runtime to re-test 5,832 combinations against a lever that reads one field). **Falsification-tested** against the pre-change commit: `avoid=18/36, love=0/36, overdo=0/36` — it catches what it was blind to and clears what wasn't touched.

Adding it **silently broke the grid's own coverage guard**, which asserted each goal branch existed via `endsWith('|finish')` — true only while `goal` happened to be the last field in the key. **A coverage guard that fails open is worse than no guard**, which is the lesson its own comment already recorded.

**The second one:** three plans carried a peak far below their stated target with no note at all. Root cause was **two different shortfalls and one check** — we asked "does the plan peak below what the runner already runs?" and never "does it peak below its own target?" Every other declaration missed it the same way, because they all measure delivered volume against the internal volume *curve*, and the curve is itself ramp-limited so it honestly reports no gap. **The gap was curve-versus-target, and nothing was comparing those two.**

**AI-building learning:** that fix demoted a *better* note twice before it was right — it outranks the load-residual warning, so a "week 9 rises 38%, be careful with that one" safety message got replaced by a volume observation on golden plans and then on 542 parity cases. Both were caught by a hash diff, not by review. **A note that displaces a better note is a regression, not a fix.**

**The honest bit:** I filed both of these as "no user impact, note to our future selves" and the founder asked me to fix them anyway. Both turned out to be hiding something — the parity gap was hiding a whole cohort, and the silent-3 was hiding a class of unreachable targets. "Nobody can hit this today" is not the same as "there is nothing behind it."

**Postable?:** maybe — the "coverage guard that fails open" bit is the sharp one.


## 2026-09-16 — OPS-DIGEST-PLAN-AUDIT-01 · The "should we wire this up?" question that turned out to be "this is already broken"
**Shipped:** The daily ops digest now reads the plan-audit summary event — a heartbeat proving the backstop ran, plus the age of the newest breaching plan.

**Dev learning:** The backlog filed this as an optional founder decision: *whether* the digest should read a new ops event. It wasn't optional. Yesterday's repo change made the audit emit a summary event on **every** run, including clean ones. The digest's query selects every `ops_events` row from the last 24h, and its prompt tells the model "no rows is the normal, GOOD result". So from the next run, a perfectly clean audit was going to be reported as a constitutional finding — with every column blank, because the query selects `codes`/`reason`/`outcome` and the summary carries none of those.

**The generalisable bit: a producer and a consumer that live in different systems have no compiler between them.** Every in-repo version of this mistake gets caught — `configConsumer.test.ts` exists precisely to catch a config key nobody reads. But the digest is a cloud routine, not repo code, so adding an always-on event to a stream something else interprets was a breaking change that nothing could fail on.

**Product/creator learning:** The fix isn't "show the count of invalid plans". That number only ever goes up — plans generated under older engine rules stay on the fleet and keep being counted, so within a few months it's a big scary number that means nothing. The signal is the **age of the newest** breaching plan. Weeks old = the fleet is carrying history. Hours old = the engine you're running right now just produced a bad plan. Same data, and one version is actionable while the other trains you to ignore it.

**AI-building learning:** The thing worth copying here is that the digest prompt already contained the rule it was about to break: *"a digest that reports an already-fixed problem in the present tense trains Russ to ignore it, which is worse than not sending it at all."* Written three paragraphs below the line that was about to cause exactly that. Prompts rot like code, and a prompt that states its own principles is easier to audit against itself — I found the conflict by reading the prompt for its intent, not by testing it.

**The honest bit:** I nearly took this at face value. The backlog said "the repo side is done, the digest is yours" and the obvious move was to ask the founder whether they wanted it wired and move on. The only reason I found the breakage is that I read the digest's current prompt before proposing a change to it, rather than proposing a change to a thing I hadn't read. That is the same lesson this repo has written down at least three times: I trusted a document about a system instead of reading the system.

**Hook material:** A backlog item that said "your call whether we wire this up" was actually "this silently breaks tomorrow at 08:30." The new event fires on every run; the digest's prompt says "no rows is the normal, good result." Nobody would have noticed for a week, and then they'd have stopped reading the digest.

**Postable?:** yes — the producer/consumer-across-system-boundaries angle plus "the count goes up forever, the age is the signal" is a tight post.


## 2026-09-16 — LONG-RUNWAY-EARNS-PLAN-01 · The runway earns a longer plan, and the sweep found a bug that had been waiting two weeks for a longer plan to exist
**Shipped:** A plan now runs to the distance's `max_weeks` whenever the calendar has surplus weeks, instead of only for a runner who passed the readiness gate — so a first-time marathoner 25 weeks out gets 20 weeks of plan instead of 18 and four uncovered weeks instead of... two.

**Dev learning:** The best change I made all day was *deleting a parameter*. `calcPlanLength` took `allowMaxWeeks`, and my instinct was to default it to `true`. Wrong instinct. The function already computes `min(weeksAvailable, weekCap)` — which means raising the cap is a no-op unless there IS surplus. The scoping condition the board demanded ("only runners who would otherwise idle") was already enforced by the arithmetic. A flag would have been a second answer to a question the code already answered, and a second answer is a thing that can disagree.

The other one: `INV-PLAN-PEAK-LR-ALTERNATION` fired 9 times on the sweep, baseline 0. §47 lets an eligible runner carry ONE back-to-back peak long-run week. The producer walked `offset % 2` and the checker counted adjacent pairs. On a two-week peak phase those are the same thing. On a three-week peak phase they are not: consuming the exception at the single odd offset leaves all three weeks peak-level, which is two pairs, and only one is allowed. **The producer counted positions; the checker counted pairs.** They had agreed for as long as the phase was two weeks long, which was for as long as the plan couldn't get longer. Fixing it meant deleting the parity entirely and asking the question the invariant asks: is the week after this one peak-level?

**Product/creator learning:** M1 — our flagship first-time-marathon persona, on the charity showcase list — was opening the app on 21 September and seeing 9 November as the first dated thing on the plan, with four weeks after that which the plan explicitly says are not training. We shipped an honest note about those weeks yesterday and I was pleased with it. Today's version of the same problem: two of those weeks did not need a note, they needed to be plan. Honesty about a gap is the right answer only once you've checked the gap has to exist.

**AI-building learning:** I caught myself doing the exact thing this repo has a memory file about. My first measurement script computed M1's "peak weekly volume" as the max over all weeks — including race week, which for a marathon contains the 42.2 km race. So it reported a peak of 59 km and a 228% weekly step, and both numbers were the race. That is the *same* defect the deviation scan carried until yesterday, when we fixed it in `coaching-deviation-scan.ts`. I read that fix, wrote the commit message for it, and then reproduced it from scratch within 24 hours in my own tool.

Second one, same shape: I wrote a property test for Willy's V1 gate, ran it across 45 plans, got 1 breach, and nearly reported "no regression". The real test used a narrower session filter than mine (`type` in quality/intervals/tempo) and mine was picking up the 5K time trial, so I was measuring a different week entirely. With the correct filter it was 7, not 1. **Both mistakes were in the measurement, not the code, and both would have produced a confident and wrong sentence in a board ruling.**

**The honest bit:** I told the Coaching Board, in Willy's voice, "we are not adding load — the peak is set by `peakKmByLevel`, not by week count." Then I measured it and M1's delivered peak went 40.0 → 47.0 km. The claim was flatly wrong. The volume curve ramps *toward* `peak_km_target` under §2's 10% cap, so more weeks let it get closer to a target it had been undershooting — M5 now hits 64 of a prescribed 65. It's still the right change (the ramp *rate* is identical; the plan is delivering its own prescription rather than falling short of it), but I'd argued it on a mechanism I hadn't checked. I wrote the falsification into the principle instead of quietly dropping the sentence, because a board ruling that records only the arguments that survived is a worse document than one that records the one that didn't.

Also: 25 tests went red. I had to sort "the ruling deliberately changed this number" from "I broke something" one file at a time, and one of the red ones — a test asserting Willy's gate with ZERO tolerance against a config constant that is explicitly a 5% tolerance — had been passing for weeks by pure coincidence of plan length.

**Hook material:** A plan-length change turned 25 tests red. 24 were the change working as designed. The 25th had been green for weeks because a number happened to land above 5% — it asserted zero tolerance against a rule that permits five percent, and only a plan that got two weeks longer ever exposed it. Also: 2,106 of 5,832 plans changed, and 5K changed exactly zero of 972, because 5K is the one distance with no headroom to give.

**Postable?:** yes — "the producer counted positions, the checker counted pairs, and they agreed for exactly as long as the phase was two weeks long" is the whole post.


## 2026-09-15 (fifth entry) — TAPER-DEPTH-02 + FOUNDATION-LONG-RUNWAY-01 + CI-TIMEOUT-01 · Three findings, and I had the mechanism wrong on the first two
**Shipped:** §6 Amendment 2 (the taper cut is a percentage of the week the runner actually did), §57/§76 amendments (the uncovered pre-plan runway is now declared), and the real cause of a CI failure that had survived a whole session of investigation. Plus PRINCIPLE-XREF-12-01 (the injury cap was cited as "§12" in 28 places; it is §2) and TEST-LIVENESS-BATTERY-01 (survivors 21 → 6, and two of three "unreachable" subjects were a bug in my own harness).

**Dev learning:** `week.weekly_km` is `sumWeeklyKm(sessions)` — the DELIVERED figure, not the volume curve. I filed "the curve is right and the delivery is not", measured `delivered / week.weekly_km`, got **0.99**, and read it as proof. I had compared delivered against delivered. The real curve lives in `volumes[]` inside `buildVolumeSequence`, is never exported and never stamped on the plan, so I had to instrument the producer to see it. When I did, the taper was the **best**-delivered phase in the plan (0.981) and the **peak** phase was the broken one (0.70–0.90). Opposite phase to the one I had filed. A field whose name reads like a target is not evidence of intent until you have read the line that assigns it.

**Product/creator learning:** Two of the three items turned out to be a documented promise the engine could not keep, and in both cases the *principle* was the defect, not the code. §76 said the pre-plan gap was "already owned by the foundation block" — the cap is 3 weeks, so a charity runner 25 weeks out has 4 uncovered weeks and 52 weeks out has 31. §57 offered a "Start Now" button; §76's backward anchor makes `plan_start = today` structurally impossible, and `start_now` and `skip` produce byte-identical plans. Nobody had read the two sentences against each other. That is what the constitution is *for*, and it still needed someone to go and measure it.

**AI-building learning:** The most valuable thing I did all day was widen a test grid, and it immediately made my own work look worse. Adding two values to the sweep's `foundationGapDays` axis re-rolled the entire seeded sample and took an invariant I had shipped an hour earlier from **3 firings to 181**. All 181 were false — the check measured easy-run headroom but not §52's long-run cap, so a taper week showing 5.5 km of headroom actually had 0.2 km of legal room. A checker that knows only half the producer's constraints reports the other half as defects. Also worth saying plainly: a firing rate is a property of the **sample**, not the rule, so rates measured before and after a grid change are not comparable and I nearly quoted them as if they were.

**The honest bit:** I gave the founder a board ruling — a formal veto, with measurements — and then had to partly withdraw it forty minutes later. The veto itself was right, but I had measured "taper above peak" on the strict threshold and concluded 8 of 8 cases were honestly labelled and the item was closed. §6's actual question is whether the taper drops *sharply*, and at that threshold **12 plans in 504 were classified `build` and said nothing at all**. The thing that caught it was not me re-reading my work; it was an unrelated persona in the deviation scan firing while I was looking at something else. And separately, the CI failure I could not reproduce for an entire session was never reproducible: on a machine 3.5× faster than the runner, a timing failure cannot happen. I kept re-running the suite. The answer was to compare the two durations, which takes one minute.

**Hook material:** A test that generates 1,536 plans takes **1,806 ms on my machine and 6,316 ms on GitHub's**. Vitest's default timeout is 5,000 ms. That test had been one loaded runner away from red on every commit since it shipped — and the build it finally broke was a **documentation-only change**.

**Postable?:** yes — the CI timing one is a clean standalone post ("your CI isn't flaky, it's 3.5x slower than your laptop"), and the delivered-vs-curve mistake is the better one for the AI-building angle.

---

## 2026-09-15 — LR-TIER-GATE-RECONCILE-01 + PEAK-LR-NOT-IN-PEAK-01 · Deleting a rule that did nothing, and finding the taper was a dress rehearsal
**Shipped:** Two Coaching Board rulings. §35's peak long-run tier drops from three rungs to two, and a taper week's long run can no longer exceed the peak phase's.
**Dev learning:** I filed the second item as "this invariant fires on 21.2% of plans" and it was the wrong invariant. `INV-PLAN-PEAK-IN-PEAK-PHASE` measures weekly VOLUME; the observation I was chasing was about the LONG RUN. Measuring both properly gave 17.4% and 48.1% — two different claims I had collapsed into one number. The fix cost nothing because I checked before building, but I had already written the wrong number into the backlog where someone would have quoted it.
**Product/creator learning:** The best change of the day was a deletion. §35's stretch tier was gated on a runner ticking "I love hard sessions" and had never once altered a plan — 0 of 36. Meanwhile §47 answers the same question and requires no injury history and five years of training. Two gates, one question, and the weaker one was the one adding distance. Removing it made the product simpler and changed nothing for anyone, which parity then confirmed.
**AI-building learning:** Chasing the long-run question turned up something nobody asked about: an HM plan prescribing a 20.5 km long run in the taper, after a peak of 18.5, two weeks before a 21.1 km race. It was visible only because I printed the week-by-week long runs while investigating something else. The measurement you run to answer one question is where the next finding comes from, and it will not be in the shape you expected.
**The honest bit:** The taper cap only fixes half of it. The rest is pinned because §9 says the long run must stay the longest run of the week, and in those plans the taper week never got smaller — one delivers 42 km against a peak of 42. So the real defect is a taper-depth item I filed hours earlier and did not connect. Two separately-filed findings, one root cause, and I only saw it because I traced a case instead of accepting the rate.
**Hook material:** We deleted a coaching rule today. It had been in the config for months, was ratified by a board, and had changed exactly zero runners' plans — measured across 36. The runner-facing effect of removing it: none. Parity, byte for byte.
**Postable?:** yes

## 2026-09-15 — TEST-LIVENESS-01 · Proving the tests bite, and three ways my own harness lied first
**Shipped:** A mutation harness for the 21 principles covered by a named test rather than an invariant. It breaks the source, re-runs the test, and records what the test failed to notice. Nightly, not in verify.
**Dev learning:** Every single early result was wrong, and each was the same error wearing a different hat. The first run reported 53 of 84 mutations surviving, with the worst scores on tests I had written that morning with dense assertions. The mutations were landing in functions the tests never call: `inputs.ts` is 521 lines and its first code-level `>=` is inside `alternativesFor`, while the test exercises `validateInputFields` 270 lines later. Scoping mutations to the declarations each test imports took survivors 53 to 25 and turned `planDateWindow` from 7-of-7 surviving to all killed. Before that, a mutation changed `§65` to `§66` inside a comment and was reported as a survivor. And when I fixed that, the harness printed "every mutation killed" for a file where the battery applied zero mutations.
**Product/creator learning:** The dominant finding is boring and valuable: boundary values. Tests assert either side of a threshold and never the threshold. `getDistanceBucket`'s `km <= 6` could be flipped to `km < 6` and the whole file stayed green, which would have handed a 6 km race the 10K recovery curve. That is a real coaching defect hiding behind a passing test, found by a tool in its first hour.
**AI-building learning:** I built a tool to detect "green tick with nothing behind it" and shipped three versions of it that were a green tick with nothing behind it. The saving move each time was the same: look at the actual line the mutation changed, rather than the summary count. The summary said 53 survivors; the line said `// CoachingPrinciples §65`. Aggregates hide the thing that tells you the aggregate is wrong.
**The honest bit:** 21 survivors are registered as UNREVIEWED with their mutated line. That is a debt pile, and I have spent the session criticising debt piles without reasons. The defence is thin but real: the register carries the exact evidence, the gate stops new ones, and a verdict on each needs looking at code I did not write. I fixed two to prove the loop closes and left nineteen.
**Hook material:** My mutation harness's first report said 53 of 84 tests were blind. The real number was 25. The other 28 were my harness mutating comments and functions nobody calls.
**Postable?:** yes

## 2026-09-15 — S1-INJURY-DENOMINATOR-01 · Two correct rules, one bad interaction, and a fix measured on the wrong denominator
**Shipped:** §90 Amendment 1. When the injury cap trims a week until an easy run disappears, a quality session converts to easy instead of letting the intensity ratio breach §1's ceiling.
**Dev learning:** I wrote `// Same denominator INV-PLAN-INTENSITY-DISTRIBUTION uses` in a comment and it was wrong three ways: I excluded the race from the denominator (the invariant counts it), included `hard` in the numerator (the invariant excludes it, because the §78 time trial is typed `hard` and is a benchmark not a session), and ignored the maintenance exemption entirely. The result was 170 plans changed against 6 that were actually breaching. Nothing in `npm run verify` noticed — the sweep was green, every test passed. `verify:parity` caught it, and only because it compares generated output rather than validity. A fix measured on a different denominator than the check is not a fix.
**Product/creator learning:** The board ruled "convert at the same distance". Building it that way broke `max_weekday_mins`, because an easy run is slower than the quality it replaces, so the same distance is a longer session. §1 counts sessions, so distance could never have moved the ratio anyway. The board's intent was right and the quantity it named was not the one carrying the intent — worth knowing that a ruling can be correct in substance and wrong in its stated mechanism, and that building it is how you find out.
**AI-building learning:** The conflict scan paid for itself before a single seat spoke. §90's own text already contained "§8 yields to §12 when the tissue is the binding constraint" — the exact trade being debated, ruled a week earlier and scoped to peak weeks by accident rather than by argument. Without reading the section I'd have written a new principle instead of releasing an existing one from an accidental scope. Three precedents pointed three ways and only one of them turned on the same trigger.
**The honest bit:** The fix broke three other rules on first run and I found all three by measuring, none by thinking. §9's long-vs-easy ratio (a quality session floored at its minimum can exceed a taper week's long run), §28's strides (the stride pass runs at week build, so a week that gains its only eligible easy day afterwards is never served — 274 sweep violations), and §27's week copy still promising intensity. Then the denominator error on top. Five rounds of build-and-measure for a change the board described in one sentence.
**Hook material:** 170 plans changed. 6 were broken. The other 164 were a comment that said "same denominator as the invariant" and wasn't — and every test in the suite passed the whole time.
**Postable?:** yes

## 2026-09-15 — COACHING-REVIEW-COVERAGE-01 · Every rule now has a named check, or a written reason it cannot
**Shipped:** All 106 coaching principles are mapped to an invariant, a named test, or a reasoned exemption, and the build fails if that stops being true. Unverified debt went 27 → 0 across five categories.
**Dev learning:** A test file EXISTING is not coverage, and I proved it twice in one session. `injuryCapCompounds.test.ts` is titled `describe('§12 …')` and tests the injury cap; §12 is the easy-run Z2 ceiling. Then I wrote §74's test at `app/api/post-race-reshape/writeBoundary.test.ts` — the file existed, the coverage gate went green, and vitest's `include` is `lib/**` + `components/**`, so it never ran once. Added an assertion for that: a named test outside the collected roots now fails the gate. A test nothing executes is worse than an admitted gap, because it reads as a check.
**Product/creator learning:** Classifying the rules forced a distinction I'd been fudging: which principles are properties of a PLAN and which are properties of what happens after. `validatePlan(plan, input)` can only ever assert the first kind. §55 (input ranges) runs before a plan exists; §58 (past-self cohort) reads run history; §68 (taper recalibration) reads completed training. Those aren't weaker rules, they're a different layer, and pretending an invariant could hold them is how you end up with a check that structurally cannot fail.
**AI-building learning:** The liveness harness earned its keep unprompted. I added three invariants, the sweep said 15,973 plans and 0 violations, and the harness said all three were UNPROVEN — none of the 42 mutations touches `plan.meta`, so nothing could wake them. Six meta mutations later they wake, and one of them woke `INV-PLAN-DIFFICULTY-NEVER-FRONTS-UNSAFE`, which had been sitting in the debt baseline as unproven for days. A clean sweep is not evidence a new rule works; it is evidence nothing broke.
**The honest bit:** I nearly classified §31, §42, §101 and §102 as covered on a grep. `inputEffect.test.ts` names `compression_classification` and `time_compressed` — it lists them as fields it diffs on, and asserts nothing about §31's three modes or §101's split. `raceBaselineHonesty.test.ts` calls `applyVdotDiscount` and never checks which rung of §42's ladder an age lands on. Exercising a function is not testing the rule the function implements, and the grep cannot tell the difference. Every one of the 29 had to be read.
**Hook material:** 106 principles. 27 with no check. Zero now: 71 invariants, 29 named tests, 6 exemptions with written reasons ≥30 characters, enforced by a test that fails if you add a §107 without deciding how it is checked. And one test that existed, passed the gate, and had never run.
**Postable?:** yes

## 2026-09-15 (fourth entry) — the charity cohort day · a wizard tick was worth hill reps at RPE 8

**Shipped:** Every actionable coaching/engine item on the backlog. The one that matters: a charity first-timer who over-rates themselves in the wizard no longer gets the sharpest session in the catalogue.

**Dev learning:** The defect was invisible because the *test fixtures were more honest than real users*. All eleven charity personas leave `user_declared_level` unset — but the wizard sends it on every single generation. So the most likely real-world deviation from our persona set had zero coverage anywhere. T1 is "couch-to-10K charity beginner": 8 km/week, longest run 4 km, under six months of running, never done a quality session. Tick "intermediate" and you get **Hill reps — 90s at Zone 4–5, RPE 8, in week 5**. Zero invariant errors. Every check green.

**Product/creator learning:** The fix was already written down. §79 says the sharpest work is withheld when intensity is "lifted **or user-raised**" — and then scopes it to *returning* runners. A returner has years of tissue adaptation behind them. A novice has none. **The protection was scoped backwards relative to the risk it exists for**, and it had been that way since it was written. We didn't need a new rule, we needed the existing one pointed at the right cohort.

**AI-building learning:** My first cut fired on *any* upward declaration, and a test I hadn't thought about — §96's `overdo` brake — caught it in one run: it would have withheld VO2max from a 55 km/week runner with five years and regular quality behind them. The scoping *is* the rule, and the existing suite found the over-reach faster than I'd have reasoned my way to it. Three separate times today a test blocked me from shipping something plausible.

**The honest bit:** the founder asked what was on the backlog this morning and I read them the curated summary table. Three real items were sitting as sub-bullets inside another entry, and two more got orphaned the moment I shipped their parent. When challenged, I filed one of them claiming "never ruled" — the board *had* ruled, and a failed implementation was on record. I'd have sent the next person to re-litigate a settled decision. The backlog now has a complete engine list precisely because a summary of a summary is how work disappears.

**Hook material:** One checkbox in a signup wizard was worth hill reps at RPE 8 to someone running 8 km a week. Every automated check passed.

**Postable?:** yes


## 2026-09-15 (third entry) — REENTRY-DEPTH-01 · the fix worked, and it worked by deleting the thing it was supposed to reorder

**Shipped:** All four items the day started with, plus the three blockers found underneath them. A returning runner's first hard session is a tempo now, not a set of intervals — and where the plan ends up with no intervals at all, it says so instead of quietly dropping them.

**Dev learning:** I took a question to the board — "this number is calibrated wrong" — and the measurement I ran to support it disproved my own question. Depths 1, 2 and 3 produce byte-identical plans; only 4 does anything. So "recalibrate it down" was a no-op dressed as a tuning decision. Then the real one: of 576 plans where the fix improved the ordering, **576 lost the session type entirely and zero were actually reordered**. The window only knows how to withhold. It has no obligation to put the thing back afterwards, and with a rotation filling a fixed number of slots, withheld means gone. **Withholding is not deferral, and the first metric I looked at could not tell the difference.**

**Product/creator learning:** The answer was already written down. §5 carries a quote from a previous sitting — "either commit to it properly in the build, or do not do it, the middle position is the only indefensible one" — which settles both halves at once: omission is fine, and forcing a late token session to satisfy an ordering rule is the one thing you must not do. I nearly proposed exactly that forced-late-session as the fix. **The constitution had already rejected my solution two months before I thought of it.**

**AI-building learning:** Three board sittings in one day, and each one's implementation surfaced the next one's question. That is not the board being wrong — it is that third-order interactions are invisible until the first-order fix is live. What made it converge rather than spiral was refusing to ship on a single metric. "First quality is VO2max: 25.4% → 12.7%" is a genuinely good number and it was hiding a regression.

**The honest bit:** I reverted correct, working, measured code three times today. Twice it was right to revert and once — this one — the revert turned out to be unnecessary, because the board legitimised the behaviour I'd backed out of. I do not think I could have known that in advance, and I would rather have reverted and asked. The alternative reading is that I burned an hour being cautious about something that was fine. Both are true.

**Hook material:** My fix improved the metric by deleting the thing it was measuring. 576 plans "fixed", 576 of them by removing the session entirely, zero actually reordered.

**Postable?:** yes


## 2026-09-15 (second entry) — V2-SWAP-S22-01 · I got the ruling, built it, and the test caught me re-defining a number without saying so

**Shipped:** A §22 exemption the board ruled on, plus a lot of precisely-filed "not yet". The onset fix that halves how often a returning runner's first hard session is a VO2max interval is built, measured, and **still not shipped** — because turning it on quietly changes what a ratified number means.

**Dev learning:** `RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS = 4` was written as four CALENDAR weeks, and in calendar weeks it does nothing at all — the first four weeks of a plan are all easy running by construction, so there is no hard session there to withhold. Reading the same `4` as four QUALITY weeks makes it withhold the runner's first four hard sessions, which on a short 10K plan is most of them. **Same constant, same code path, completely different prescription.** I hadn't changed the value, so it didn't feel like a doctrine change. It is one.

**Product/creator learning:** The property sweep stayed green through all of it — 15,973 plans, zero violations — while a plan quietly lost its hill sessions. The thing that caught it was a unit test asserting a hill session exists at all. **Coverage of "is it legal" is not coverage of "is it still the plan we meant".**

**AI-building learning:** I ran the board, got a clean ruling, implemented exactly what was ruled, and implementation surfaced two more conflicts the ruling hadn't covered — a construction-order clash on 576 plans and this units problem. Not because the ruling was wrong; because you cannot see the third-order interaction until the first-order fix is live. **A ruling is a decision about the thing you asked, not a guarantee about the thing you build.**

**The honest bit:** I started today intending to close four items and closed two and a half. Twice I built something correct and then reverted it, both times because the disciplined answer was "this needs a ruling I don't have." The second revert was the harder one — the measurement was genuinely good (a returning runner's first hard session being VO2max drops from 25.4% to 12.7%) and it would have been easy to ship it and mention the units thing in passing. That is precisely how the calendar-weeks bug got written in the first place.

**Hook material:** The number was 4. I didn't change it. I changed what it counted, and the same plan went from withholding nothing to withholding almost everything — with every automated check still green.

**Postable?:** yes


## 2026-09-15 — DELOAD-POS2-01 + GRID-COVERAGE-02 + the swap nobody knew was dead · four coupled items, two wrong diagnoses, one guard that degenerates

**Shipped:** Recovery weeks stop landing on the second week of build for standard runners (the rule fired on 16% of plans and now fires on 0.2%). The verification grid finally varies the input that unlocks a whole family of coaching rules. And the §79 re-entry window got a single owner instead of two hand-written copies.

**Dev learning:** The reverted fix from yesterday failed for a reason I'd call beautiful if it hadn't cost a day. Its guard read `since === recoveryFreq - 3`. For masters runners `recoveryFreq` is **3** — so the condition becomes `since === 0`, which is true on the very week *after* it places a deload. It placed recovery weeks back to back, `[3,6] → [3,4,7]`, and crushed the peak. One `since >= 1` fixes it. The condition was not wrong in general; it **degenerated** at one specific config value, and nothing in the code or the test suite made that value visible. **When a guard does arithmetic on a config constant, substitute every value that constant can take before you trust the expression.**

**Product/creator learning:** Then I brute-forced whether the rule was even satisfiable. On **1,944 of 3,726 masters plans (52.2%)** there is *no* legal arrangement of recovery weeks that avoids position 1, avoids position 2, avoids adjacency, keeps the count and doesn't lengthen a loading block. Zero of 3,726 standard plans have that problem. So for half of older runners the rule we'd written was not hard — it was **impossible**, and the honest answer was to make it a preference that yields rather than keep failing to implement it.

**AI-building learning:** I diagnosed the second item wrong twice before the code told me the truth. The backlog said "the session selector has no coherence guard." I measured it and found it correlated with low weekly volume, which *fit*. Then I inspected the actual session: three eight-minute blocks, stated 43 minutes — internally perfect. So I instrumented the sizer, and it **never ran for that week at all**. The session had been physically moved there by a separate step that swaps two sessions between weeks to hit an adaptation deadline, and updates nothing but the ID. A build-sized session sitting in a peak week. **Two plausible mechanisms, both consistent with the numbers, both wrong** — the only thing that settled it was a print statement proving a function wasn't called.

**The honest bit:** then I measured how often that swap actually fires. **Zero. Zero out of 2,304 inputs, zero out of the 7,452-plan grid.** An entire documented mechanism, with its own adjustment records and a comment warning that it breaks another rule, has been dead code — and the two items above were both blocked behind understanding it. I also had to stop short: repairing the §79 window turns that dead swap live, and it immediately produces 84 violations of a *different* rule. That one goes back to the board rather than me deciding it, which means one of the four items I set out to finish is still open, precisely specified, and not shipped.

**Hook material:** Half our recovery-week rule was mathematically impossible to satisfy for runners over 45, and nobody had checked. The other bug was in code that runs zero times out of 7,452.

**Postable?:** yes



## 2026-09-14 (second session) — QUALITY-ONSET-ORDER-01 + DELOAD-POS2-01 · a whole day, nothing shipped, and that was the right call

**Shipped:** Nothing to the engine. No plan, no session, no runner-facing behaviour changed. Every code change made today was reverted. What shipped is documentation: two backlog entries corrected, one new prerequisite filed, a board ruling recorded, and a note-to-self so this doesn't recur.

**Dev learning:** I picked up two items the backlog marked "ready to build — one well-defined task each." Both were mis-described in the same way: their "it's proven / here's the one-line fix" note had been measured against something that wasn't the real code.
- **QUALITY-ONSET** ("a beginner's first hard session is the hardest one"): the filed fix was "make the session's size follow the category we swapped it to." I built it and measured it — a **no-op**. A structured session's duration comes from its *structure*, not its distance, so resizing the distance changes nothing. The real blocker is a layer deeper (the session-selector will pick a session a low-volume week physically can't fit), now filed on its own.
- **DELOAD-POS2** ("a recovery week lands in the wrong spot"): the backlog said the fix was measured clean. It was — against a **simplified copy** of the scheduling function that omits its final tidy-up pass. Run against the *real* function, the fix created back-to-back recovery weeks on short plans and crushed how hard **453 plans** build, quietly turning ~1 in 8 short-race plans into a do-nothing plan. Reverted.

**Product/creator learning:** "Ready to build" is a hypothesis, not a spec. The most dangerous artifact in this repo isn't a bug — it's a *green measurement of the wrong thing*, because it looks exactly like proof. Both of today's dead ends would have shipped worse plans while every check stayed green, precisely because the check that mattered was pointed at a stand-in.

**AI-building learning:** The guard that saved us was `cohortShape` — the test that asks "did this change *who gets what kind of plan*?" It failed loudly on the deload fix (453 plans changing category), which is the whole reason I looked closer instead of re-baselining and moving on. A test that measures the *population*, not just correctness, is what catches a fix that's individually valid but collectively wrong.

**The honest bit:** it is genuinely uncomfortable to end a full day of work with zero shipped and have to say so plainly to the founder. The instinct is to ship *something*. But the founder's own rule — don't degrade plans, measure before you believe — is exactly what produced "nothing shipped." Restraint was the deliverable. The backlog is now honest instead of confidently wrong, which is worth more than a fix that makes 453 plans worse.

**Hook material:** I spent a day fixing two bugs. I shipped neither. Both "fixes" had been proven — against a fake version of the code. The real version made 453 plans worse.

**Postable?:** yes


**Shipped:** The grid the whole verification stack measures against now varies 13 of 31 inputs instead of 10, and the coaching-review cases race on Saturdays and Sundays like real races do.

**Dev learning:** I went looking for why a defect had survived every check, and the answer was the fixture. `cohortGrid` — the surface behind `cohort:shape` and the invariant-liveness corpus — set **ten of thirty-one** declared input fields. Thirteen were never set at all. The one that mattered was `training_age`, because the rule I was chasing keys on it, so the mechanism **never fired anywhere in any check**. The property sweep varies 24 and gates on it; this grid never had such a gate, which is exactly how it drifted.

**Product/creator learning:** The most expensive one was `benchmark`. With no benchmark anywhere in the grid, no plan had a VDOT — and the whole point of §79 is what happens when the VDOT signal and the volume signal **disagree**. That disagreement could not occur in a single test case. We had a principle written about a conflict our tests could not produce.

**AI-building learning:** The proof came free. Adding those axes woke **two previously-unproven invariants on the first run** — checks that had been sitting in the debt register as "nobody has been able to make this fail", because nothing in the corpus could reach them. Not dead rules. Unreachable ones. The liveness harness was right to refuse to call them proven.

**The honest bit:** the same day, all seventeen coaching-review cases turned out to race on a **Monday**, because the plan-start constants are Mondays and race dates derive as start-plus-N-weeks. A Monday race has no in-week day before it — which is precisely the shape in which the race-eve defect I was hunting cannot appear. **Every round we had ever run reviewed the one configuration that hides the bug.** I split them across Saturday and Sunday, and kept one Monday case deliberately so the known open defect stays visible rather than quietly turning green.

**Hook material:** Our test fixtures had every race on a Monday. Real races are on weekends — and the bug we were hunting can only appear on a weekend.

**Postable?:** yes


## 2026-09-14 — RACE-WEEK-FITNESS-01 · the plans passed every check and told a first-timer to run 72 minutes the day before their marathon

**Shipped:** §39 Amendment 1 and §80 Amendment 1. Nothing long sits on race eve any more, and the race-day instruction scales with the race instead of assuming everyone is running a marathon.

**Dev learning:** The founder's instruction was the whole thing: a coaching review must not stop at "0 errors", because a plan can obey the constitution perfectly and still be a bad plan. Seventeen generated plans, zero error violations. I read one line by line and found that §39's "mid-week" easy run was landing the day before the race — **81 of 81 plans on the measured grid, 100%**, mean 54 minutes, worst case **9 km / 72 minutes the day before a beginner's first marathon**. The day came from a preference list starting `'sat'`, and for a Sunday race Saturday is the day before the gun.

**Product/creator learning:** The second one is worse in a quieter way. Every race card said *"Start slower than feels right. First 5 km at Zone 2."* That is sensible for a marathon — 12% of the race. It is 50% of a 10K and **100% of a 5K**, where it tells the runner not to race their goal race at all. Nobody wrote that rule for a 5K; it was written for a marathon and then applied to everything, and 5 km turns out to be exactly 11.85% of a marathon. The number was never wrong, it was just never converted into the thing it was actually expressing.

**AI-building learning:** Every harness in this repo generates **Monday** races. The plan-start constants are Mondays and every grid derives race dates as plan start plus N weeks, so race day is always Monday — and a Monday race has no in-week day before it, which is precisely the shape in which this defect cannot appear. The cohort grid, the liveness corpus and all seventeen review cases shared it. **Every check was green on a configuration almost no real runner has.** That is the most transferable thing here: a test fixture can be internally consistent, pass forever, and be testing the one case that hides the bug.

**The honest bit:** the suite caught two of my own errors inside an hour. My first invariant banned *every* session on race eve, and the golden plans failed instantly — a short shakeout the day before a race is good coaching, and I would have deleted it along with the 72-minute run. Then my day filter read `> N - 1`, which is a no-op on top of a check that was already there, so Saturday stayed reachable whenever every earlier day was blocked. **My measurement grid showed 0 out of 81 and looked clean; the property sweep found it.** A reordering that hides a bug measures as a fix.

**Hook material:** Seventeen training plans passed every automated check, and one of them told a first-time marathoner to run 72 minutes the day before their marathon.

**Postable?:** yes


## 2026-09-14 — LR-SHORTFALL-DURATION-01 · the bug report was wrong, and the real answer was in the next principle along

**Shipped:** §66 Amendment 1. A long run that comes up short is now measured on the axis the session was actually prescribed in — distance if it had one, **time** if it didn't.

**Dev learning:** I filed this as a silent-pass bug: the shortfall trigger filters on planned distance, beginners get duration-anchored plans, so the trigger was dead for them. All true — **2,547 of 7,965 long runs dropped, completely dead on 24.6% of plans**. Then the board's conflict scan found §66 bullet three: *"duration-primary long runs are out of scope (no distance to fall short of)."* **It was ratified doctrine and the code was faithful to it.** Not a bug. A scope decision, made deliberately, that had stopped being right — because §80, written later, established that for these runners time on feet **is** the prescription.

**Product/creator learning:** The obvious fix was available and I nearly took it. We have a ratified helper that derives kilometres from the session's own pace band, and it recovers **100%** of the dropped sessions. It is the wrong fix. §80 tells first-timers to take walk breaks, so a runner who completes the full prescribed 90 minutes **exactly as instructed** covers less ground than the band implies — and would have been told they came up short against a kilometre figure that never appeared in their plan, then had their long run reduced for it. **A recovered number is not automatically the right number.**

**AI-building learning:** The upstream root cause was bigger than the item. The same expression writes `planned_load_km` at two other sites, and that column is null on every duration-anchored analysis — so the post-run card rendered **"No distance data."** after every single run for that cohort, forever, with the run's distance sitting right there on screen. One expression, three files, one dead trigger and one permanently blank line. I only found it because I traced the column rather than patching the filter I was pointed at.

**The honest bit:** Willy's objection in the sitting was that moving time would under-count walk breaks and manufacture the exact false positive we were trying to avoid. I nearly logged it as a deferred risk. It resolves cleanly and the resolution is one sentence: **walking registers as movement.** Only a full stop reduces moving time, and a runner standing still is not on their feet. Worth the two minutes to check rather than carrying a "known risk" that was never a risk.

**Hook material:** The bug report said the code was wrong. The code was faithfully implementing a rule we wrote and later outgrew, and the correction was one principle further down the same document.

**Postable?:** yes


## 2026-09-14 — LR-RACE-SEGMENT-PCT-01 · I skipped the review step, and the review step was the one that mattered

**Shipped:** §25 Amendment 1. The race-pace segment on a half-marathon or marathon long run now has one number, one owner, and a check — and the session card stops contradicting the coach note printed directly above it.

**Dev learning:** The founder asked one question: *"have we run coaching review?"* I had run the board's format from memory, inline, without invoking it. Running it properly took minutes and the **mandatory conflict scan** — read the change against every existing section — immediately surfaced §25, which ratifies "the final 25–40% of the long run" for the exact session I had been reasoning about. I had ruled hours earlier that a competing 35/40 in the catalogue "was never a principle" and **deleted it**. It was §25's encoding, one section away from the one I read.

**Product/creator learning:** Three answers were live for one segment: the row said 40%, a hand-typed coach note said "Final 30–50% at MP" (above §25's own ceiling), and the card said 20%. **Two of them rendered on the same card.** A runner ninety minutes into a Sunday long run reads "Final 30–50% at MP" and "Race pace — 20%" and has to pick one. At that point the plan has stopped being the authority, which is the entire product. The number being wrong mattered less than the two of them disagreeing.

**AI-building learning:** The worst part is that the HM contradiction was **new, and I shipped it that morning.** Before my fix the HM card had no race-pace row at all, so there was nothing to disagree with. Making a hidden thing visible surfaced an inconsistency that had been latent for months — correct outcome, but I shipped the visible half without checking what it would now sit next to. **A fix that makes something appear needs to be read against everything already on that screen.**

**The honest bit:** my own note in this repo says *"measure the premise, not just the ruling"*, and I wrote a ruling whose central premise — "these numbers have no principle behind them" — I never checked, while writing three paragraphs of measured evidence about everything else. The measurement was real and the reasoning on top of it was confident and wrong. The lesson I actually take: **"read by nothing" is evidence a consumer is missing, not evidence the value is junk.** Deleting on that basis destroys ratified doctrine and looks like tidying up while you do it.

**Hook material:** An AI agent deleted a ratified coaching rule because nothing read it. The reasoning was one section away in the document it had open.

**Postable?:** yes


## 2026-09-14 — CONFIG-CONSUMER-01 + RACE-PACE-OVERLAY-REACH-01 · half a coaching principle was unreachable, and the card looked calm

**Shipped:** The check that proves a config numeric has a *reader* now covers every config surface instead of two of them. It immediately found that half-marathon runners had never received the race-pace long run the constitution has promised them since it was written.

**Dev learning:** The gate was `label.includes('marathon-pace')`. The marathon row is called "Marathon-pace long run" and the half row is called "Long run with HM-pace finish". So the overlay rendered on **12 of 12** marathon sessions and **0 of 18** HM ones. Nothing errored, nothing looked wrong, and the session most likely to be noticed — the key peak long run — just showed a calm easy run. A label heuristic does not fail loudly; it fails by matching slightly fewer things than you assumed, forever.

**Product/creator learning:** Three separate facts about that one session were declared and read by nothing: which distances get it, what fraction of the run it is, and which race pace it is run at. The card hardcoded "MP target", so the moment HM started receiving the overlay it would have handed half-marathon runners a marathon pace number on the one session where the number is the entire point. The board caught it; the type system could not, because every one of those values is a string.

**AI-building learning:** I wrote the fix to the checker, and the fix had the same bug class as the thing it was fixing. Excluding the declaring *file* wholesale reported a live constant dead, so I narrowed it to strip just the declaration literal — and that silently made the whole catalogue scan **vacuous**, because the helper returns the text unchanged when its regex misses and the row *interface* declares every field forty lines above the array. Every assertion went green by way of everything looking consumed. The guard I added afterwards is the one that matters: assert the strip actually removed bytes. **A checker that can no-op is worse than no checker, because it reports success.**

**The honest bit:** The register that exists to stop exactly this had the wrong citation in it. A field was moved out of the debt list in September on the grounds that "§24d delivers it" — and §24d governs a completely different session on a completely different distance. Nobody checks a citation in a comment. It read as rigour and it was the opposite: the field was marked satisfied at precisely the moment it was delivering nothing to anyone.

**Hook material:** Half a ratified coaching principle had been unreachable for months because a session's *name* didn't contain the substring the code was grepping for.

**Postable?:** yes


## 2026-09-13 — MAINT-EXEMPT-SCOPE-01 · a safety check was switched off because something else was believed to report it

**Shipped:** §52 Amendment 1. The rule that no single run carries more than 60% of a week's volume is now evaluated on **every** plan, instead of being skipped on half of them.

**Dev learning:** The check opened with `if (volume_profile !== 'maintenance')`, and the comment justifying it said the constraint was "already surfaced in `volume_constraint_note`". That note explains why **total** volume is low. It says nothing about **lopsidedness**. The two are different claims and the comment quietly treated them as one. **51% of the cohort classifies maintenance**, so a safety cap was unchecked on half of all plans, behind a sentence that sounded like it had been thought about.

**Product/creator learning:** Measured with the exemption removed: **268 of 6,588 weeks breach, every single one in a maintenance plan and none in a build plan.** The worst is a beginner marathon plan with a **26.0 km long run in a 34 km week** — 76% of the week's running in one session. Willy's line settled it: the tissue does not care that the plan is labelled maintenance, and one session carrying three-quarters of the load is *more* dangerous at low volume, not less.

**AI-building learning:** The fix is a `warn`, not an `error`, because erroring would stop 60 plans generating and the runner's volume constraint is real — they cannot simply be told to run more. The declared firing rate is **8.6%**, where the check previously reported nothing at all. A rule that fires 8.6% of the time and is visible beats a rule that fires 0% because it never ran.

**The honest bit:** I only found this while closing a *different* item, and the thing I set out to check turned out to be void. The generalisable test I took away: **an exemption is fine when it is CIRCULAR and not fine when it is merely CONVENIENT.** Three sibling exemptions (§24, §23, §46) are circular — the plan is maintenance *because* it failed those floors, so re-asserting them would be a loop. §52's was just convenient. I checked all four rather than fixing the one I tripped over.

**Hook material:** Half of all training plans skipped a safety check, because a comment claimed a different warning already covered it. It didn't.

**Postable?:** yes


## 2026-09-13 — POST-RUN-CONTEXT-01 · the one empty square in the category

**Shipped:** One line under the post-run zone signal: *"That's 3 of your last 5 easy runs above the ceiling."*

**Dev learning:** I researched six competitors before building rather than after: Runna, Trenara, Garmin, Coopah, Planzy, Runzy. **Not one joins the individual run to the training block.** Garmin aggregates load without intent, Coopah aggregates weekly in a separate report, and Garmin's Training Effect is **unsigned** — it physically cannot say an easy run was too hard. We hold directional columns that can. That is a real gap in the category, and it is one line of copy.

**Product/creator learning:** The board's amendment was harder than the build. **Count, never conclude** — "3 of your last 5" ships; "which is why Saturday felt heavy" was vetoed, and so was the hedged version of it, because a hedge on an unprovable mechanism is still a claim. And **no week-level §1 read**: §1 counts sessions plan-wide, so a 4-day week with one quality session is 25% against marathon's 18% ceiling. A week-level intensity line would have flagged every normal build week as a problem. Different denominator, different question.

**AI-building learning:** Every board binding became a unit test, not a note in a decision doc — 14 of them. A ruling that lives only in prose gets reinterpreted by the next person to touch the file, and the next person is usually me, three weeks later, with none of the context. The hardest to encode was Wood's "never twice in a row", which I implemented without storing any state by walking the run history and tracking what the *previous* run would have shown.

**The honest bit:** the instinct was to make this line clever — to have it explain, predict, connect. Every one of those instincts was the thing the board struck out. What survived is a sentence that counts. It is duller than what I wanted to build and it is the only version that is true.

**Hook material:** Six running apps, and not one tells you that this run is the third easy run this week you ran too hard.

**Postable?:** yes


## 2026-09-13 — HR-LATE-RESCORE-01 · the gate promised something it was writing to the wrong table

**Shipped:** Heart rate that arrives days after a run now re-scores it. The coaching narrative is not regenerated.

**Dev learning:** The founder's own sync topology is the repro: Garmin feeds Apple Health, *and* Garmin feeds Strava, *and* Strava feeds Apple Health. HR can be days behind the workout shell. The late-arrival gate's comment promised that outside the fresh window it still patched HR "for archival use — zone ledger, weekly report, fitness signals". It patched `strava_activities`. **Every one of those consumers reads `run_analysis`**, which kept null HR forever. Measured: 1 of 12 no-HR analyses stranded, with the heart rate sitting in the activity row right beside it.

**Product/creator learning:** The split that made it shippable is a coaching distinction, not a technical one. Hutchinson's rule is that two-day-stale *coaching* is dishonest — you cannot tell someone on Thursday how Tuesday felt. But a **score** is deterministic arithmetic over stored columns and does not go stale. So `scores_only` recomputes the numbers and skips the AI call entirely.

**AI-building learning:** The property I tested first was the one that could do real damage: the upsert must **omit** `feedback_text`, not send `null`. On an upsert, present-and-null **deletes** the runner's existing coach note — the exact opposite of what the gate exists to protect. My first version of that test built a local copy of the row-builder and asserted against it, which proves the copy. Rewriting it to read the shipped source immediately found a **second** flat assignment in the response body that I had missed.

**The honest bit:** this only became visible because of a change made hours earlier. §108 Amendment 1 stopped fabricating a score when HR is absent — and that turned a run with a plausible-looking number into a run with a visible blank, permanently, despite the data existing. Fixing one honesty problem exposed the next one down. I would not have found this by looking.

**Hook material:** The code comment said it patched heart rate for the weekly report. It wrote to a table the weekly report has never read.

**Postable?:** yes


## 2026-09-13 — R30-DIRECTIONAL-01 + TRIGGER-AUDIT-01 (§12 Amendment 1) · we were flagging the runners who had finally got it

**Shipped:** Zone drift is measured **above the cap**, not as distance from a band — on the coach card and, separately, in the trigger that silently reshapes the plan.

**Dev learning:** R30 has been live since May and fired on `hr_in_zone_pct < 60`, treating Z2 as a **band**. §12 prescribes a **cap**: "Easy runs are capped at the top of Z2." Running *below* Z2 breaks no principle, so it must never count as drift. Measured in production: **6 of 22 flagged runs (27%) were predominantly too EASY.** Worst case: 17% in zone, 83% below the floor, **0% above the ceiling** — a runner jogging gently, told they were drifting into the grey zone.

**Product/creator learning:** McMillan named the cost better than I could: those six runs belong to the runner who has *finally understood the product*, and we were flagging them. For an app whose entire pitch is "slow down", telling the people who slowed down that they are doing it wrong is the worst possible false positive. Seiler's framing is why the metric was wrong in the first place — the grey zone **has a direction**. It is what athletes do instead of easy, not a band they fail to hit. A symmetric metric for an asymmetric phenomenon mislabels about a quarter of cases, which is exactly what was measured.

**AI-building learning:** Fixing the card was not fixing the bug. Hutchinson set a blocking condition: **eleven** `trigger_type` values change a runner's plan, ADR-012 auto-applies a low-magnitude one **silently**, and exactly one had ever been audited. I audited all eleven. Nine pass, one needs data, and one was a structural defect — the `zone_drift` **trigger**, same flaw as the card but worse, because it rewrote every easy and long-run coach note to *"Easy sessions trending hard"* without asking. The card is an opinion; the trigger is the plan.

**The honest bit:** I fixed `zoneDriftScore` as a **second** function rather than changing `zoneDisciplineScore`, and the temptation to "clean up" by merging them was strong. They answer different questions and both are legitimate: "how much of your running was in zone" is a descriptive ledger figure and is correctly symmetric; "how much was above the cap" is the drift claim, and only one direction is a breach. **Collapsing them is what produced the defect in the first place.** Both surfaces read the same constant so they cannot disagree about what drift is.

**Hook material:** For four months the app flagged a quarter of "you're drifting into the grey zone" warnings at runners who were running too easy.

**Postable?:** yes


## 2026-09-13 — UX-POSTRUN-01 · seven runners were told they nailed a run nothing measured

**Shipped:** The post-run screen now leads with the coach instead of a mark out of 100, and a run with no heart rate gets no score at all.

**Dev learning:** The founder sent a screenshot asking whether the screen was too much. It showed **69/100**. I went to check the arithmetic and found the HR axis — which §108 gives **half** the weight, explicitly "because it is the only axis that speaks to intensity distribution, which is the product's entire thesis" — was being defaulted to 75 when absent. So 37.5 of those 69 points were invented. In production: 12 of 126 scored runs had no heart rate, and **seven of them were told "nailed"**. The fix was making the return type nullable, and the compiler immediately found two consumers AND a few-shot example in the AI prompt that was teaching Kit to state a verdict on a no-HR run. The type was a better auditor than I was.

**Product/creator learning:** The worst part wasn't the fabrication, it was the direction. The same run scored **41 ("off target")** with a monitor showing poor discipline and **69 ("close")** with no monitor at all. Not wearing the strap was worth 28 points — while the coach note in the very same card told the runner to put it on. We had built a scoreboard that paid people to stop measuring themselves.

**AI-building learning:** `sessionScore.ts` had **no test file**. None. The function that decides whether a runner is told "nailed" or "concerning" had zero coverage, and a Coaching Board sitting had already ratified its weights without anyone noticing there was nothing underneath them. A green suite across 1,700 tests says nothing about the file you didn't write tests for.

**The honest bit:** I nearly shipped the redesign without looking at it. The card is behind auth and a paid tier, so "it compiles" was the only claim available — which is exactly how this repo once shipped a comment describing an arc that was never built. I exported the component and built a fixture page instead, and the first render immediately showed something no ruling had mentioned: every post-run card is amber, so a runner who held the zone perfectly meets **"There it is. Don't ruin it."** on the warning palette. You cannot make restraint feel like progress if success and failure are the same colour.

**Hook material:** Seven runners told they "nailed" a run where the thing being graded was never measured — and leaving your heart-rate monitor at home was worth 28 points.

**Postable?:** yes


## 2026-09-13 — VERIF-PARITY-GOAL-01 + coaching-guard Bash coverage · two safety nets with holes in the same shape

**Shipped:** `verify:parity` now runs both goal branches instead of one, and the coaching-board hook now sees doctrine edits made through Bash. Neither is a feature; both are checks that were quietly covering less than they claimed.

**Dev learning:** The parity grid had `goal: 'finish'` hardcoded in a single expression, so **every one of its 2,916 cases ran one branch of the engine**. Everything behind `goal === 'time_target'` — §22's renames, the segmented long runs, §25, the maintenance logic — was invisible. It told me "IDENTICAL, byte-for-byte unchanged" about a commit that had changed a time-target producer, and I nearly quoted that as proof the change was safe. The script's own header documents two traps it was built to avoid; this was a third, and its existing guard could not have caught it, because that guard checks row COUNT and 2,916 rows of one branch is still one branch. **Count is not coverage.**

**Product/creator learning:** The coaching-guard had the identical shape of hole. It matched the dedicated file tools and not Bash — and a session told to prefer Bash for file edits uses that path for everything. So the doctrine hook fired on approximately none of my edits, while CLAUDE.md said convening was automatic. Both of these were true for a year and both read as complete.

**AI-building relevance:** The hard part of the hook was not detecting the path, it was NOT firing on reading one. `sed -n '1,40p' CoachingPrinciples.md` runs dozens of times a session; a guard that fires on that gets switched off within an hour, which this repo has already written down as equivalent to having no guard. So a doctrine path is necessary but not sufficient — a write signal is required, and for redirects the file has to be the **target**, not just an argument. `grep DOC > /tmp/out` reads doctrine and writes elsewhere, and must stay silent.

**The honest bit:** I got the regex escaping wrong writing Python that writes Python — `\b` collapsed into a literal backspace byte (`\x08`) and three write cases silently failed to match while every read case passed. So the first version was a guard that was permissive in exactly the direction that matters, and it looked fine because the tests I cared most about were green. Printed the compiled pattern to find it.

**Hook material:** A regression test suite that reported "IDENTICAL across 2,916 cases" for a change it structurally could not see, because of one hardcoded word.

**Postable?:** yes


## 2026-09-13 — STRAVA-WEBHOOK-OBS-01 · built the smoke detector, found the house already on fire

**Shipped:** The Strava webhook now has a heartbeat and a daily health probe. Running it for the first time revealed the auto-link path has been completely dead.

**Dev learning:** I wrote the probe, then ran the read-only check against production to see what it would report. Strava answered `403 { resource: 'Application', field: 'Status', code: 'Inactive' }`. **The application itself is inactive** — not a missing subscription, a state in which no subscription can exist or deliver at all. That is an exact match for the symptom reported days ago: *runs only link when I open the app*. A fully-killed iPhone app cannot background-ingest from HealthKit, so the webhook was the only thing covering that case, and it was never going to arrive.

**Product/creator learning:** Nothing in the repo could ever have shown this. No test, no deploy, no invariant — the failing component is a row in Strava's database. That is a genuinely different class of bug from everything else this codebase guards against, and the only defence is a probe that goes and asks. Everything else here is introspection; this is the first check that has to leave the building.

**AI-building learning:** The first version of my own probe would have hidden it. I had it return HTTP 502 on any non-OK response from Strava — which fails the cron loudly and records **nothing about why**. I only found that out by running it and watching the 403 land in a branch that threw the detail away. An error path I wrote ten minutes earlier was already the weakest part of the thing, and only a live call showed it.

**The honest bit:** I burned a first attempt on `.env.local`, got a 401, and nearly concluded the credentials were the problem. The local `STRAVA_CLIENT_SECRET` is corrupted — 43 characters with a non-ASCII final byte. Two different failures returning two different error codes for two different reasons, and the local one points at exactly the wrong culprit. I pulled the production env to a scratch file instead, and got the real answer.

**Hook material:** Shipped a health check, ran it once, and discovered the feature it monitors has been dead the whole time — 403, Application: Inactive.

**Postable?:** yes


## 2026-09-13 — §24 Amendment 1 · the board was right to be suspicious and wrong about why

**Shipped:** A runner is no longer told their marathon long run missed the specificity floor when it missed it by 150 metres.

**Dev learning:** Two enforcement sites for one principle, and they were coupled in a way I did not see until the grid told me. Adding the rounding tolerance to the classifier flipped near-miss plans from `maintenance` to `build` — and `INV-PLAN-PEAK-LR-RACE-RATIO` is **exempt while a plan is maintenance**. So the fix un-exempted exactly the plans it had just forgiven, and they immediately errored on the same 0.4 km shortfall. Three hard failures. A tolerance applied to the producer and not the checker is not half a fix, it is a new bug.

**Product/creator learning:** The board asked me to re-open its own ruling and I expected to be arguing about coaching. I was not — I was arguing about arithmetic. The batch sitting said time-target marathons are pinned at maintenance because a 210-minute cap makes a 31.65 km long run unreachable. At the pace the engine actually derives, 210 minutes buys 33.5 km. The cap was never the blocker. Building the amendment exactly as ruled changed **zero plans**, and the honest move was to revert it and go back rather than ship something that reads like a fix.

**AI-building learning:** My first version of the new invariant recomputed the peak long run with `sessionKmForCheck`, while the classifier it was checking uses `sessionKmOrZero`. Two ways of computing one number. They disagreed on three plans and threw them as hard failures — the checker was *racing* the producer, not checking it. The fix was to stop deriving anything and just read the two numbers the engine had already printed in the note. A checker that recomputes its subject's input has quietly become a second implementation.

**The honest bit:** The coaching-guard hook fired on me while I was writing this up — its first real trigger, an hour after I taught it to see Bash edits. It caught a `python3` heredoc editing CoachingPrinciples.md, which is exactly the shape that had been sailing through unguarded all day. Satisfying to have the thing you just built immediately catch you.

**Hook material:** Building a board's ruling exactly as written and having it change zero plans out of 2,916 — because the mechanism the ruling named allows 33.5 km against a floor of 31.65.

**Postable?:** yes


## 2026-09-13 — PEAK-LR-STEPBACK-MINUTES-01 · fixing the bug broke the test that proved the bug existed

**Shipped:** Beginners now get the peak long-run step-back week they were silently denied, expressed in minutes rather than kilometres.

**Dev learning:** §47 was gated on `distance_km` in **four** places on one code path. The backlog had two of them filed. A previous attempt swapped both for the anchor-aware owner and measured **zero difference across two independent grids** — because the other two gates sat inside the mutation and in §9's easy clamp, and reaching a function is not the same as the function doing anything. Then, after fixing all four, I found a fifth and sixth: the CHECKER for this same rule read raw `distance_km` too. The producer and the thing guarding the producer were blind to the identical cohort for the identical reason. That is the third time this pattern has shown up here, and the tell is always the same — a rule that has never once fired for a cohort is not evidence of balance.

**Product/creator learning:** The cohort with the least training history had the least enforcement. Beginners are duration-anchored, every `distance_km` gate reads zero for them, and the failure mode is a **silent pass** — not a wrong number on screen, just a protection that quietly never runs. The people least equipped to notice a missing recovery week were the only ones not getting it.

**AI-building learning:** The best moment of the session was `invariantLiveness` failing right after my fix passed everything else. It said `INV-PLAN-PEAK-LR-ALTERNATION` could no longer be woken by any mutation. My first instinct was that I had broken something. I had not — the only reason that invariant was ever wakeable was the bug: §47 never ran on beginner plans, so two consecutive race-pace peak long runs existed to be caught. **Fixing the engine deleted the evidence that the check worked.** I would never have thought to look for that, and a harness that deliberately breaks valid plans found it in one run.

**The honest bit:** I very nearly filed the sixth gate as "its own build, needs a measured baseline", which would have been a defensible-sounding way of leaving a half-fixed rule in the codebase. I measured instead: sighting the checker produced **0 violations across 15,973 plans**, so it closed in the same commit. The instinct to file the awkward remainder is strong and it is usually just the instinct to stop.

**Hook material:** Fixed a bug, and a test immediately failed to say "that invariant can no longer be proven to work" — because the only thing that had ever made it fire was the bug I just fixed.

**Postable?:** yes


## 2026-09-13 — ULTRA-FUEL-NOTE-01 · the board was right about the ruling and wrong about the facts

**Shipped:** 50K and 100K peak long runs now tell the runner to fuel every 25–30 minutes, sourced from what the catalogue already declares.

**Dev learning:** The board's ruling said "no numeric change — the cadence already exists". So I went to read it, and found `fuel_every_mins: 25` on `ultra_race_sim` and `30` on `time_on_feet`, and then measured which of those rows actually lands on an ultra long run. **Neither. Ever.** 100% of 50K/100K peak long runs carry no `catalogue_id` at all — those rows only ever get drawn into the *quality* slot. The number existed; it just wasn't anywhere near the session it was supposed to describe. Second decorative-config find in two commits, same shape as `intensity_zones`.

**Product/creator learning:** Picking 25 or 30 would have been the easy move and it would have been a coaching decision smuggled in as an implementation detail. On a four-hour effort that interval is a real prescription, and it is not a neutral choice — the shorter one is the more protective one, which is the entire reason Sims pushed the item. So: read the range the catalogue declares, ship "every 25–30 minutes", and write into §24e that a single tighter number needs its own sitting. Implement the ruling, record where its premise was wrong, don't quietly patch over it.

**AI-building learning:** My containment probe printed `hsr=balanced ... peakLR=0` and I nearly skimmed past it. `balanced` is not a valid `hard_session_relationship` — the values are avoid/neutral/love/overdo — so every one of those plans threw and my try/catch ate it. The row said zero and that is the only reason I noticed. I have now written the same guard three times this session and it has caught something every time.

**The honest bit:** `verify:parity` told me 864 of 5,832 cases changed and then printed 25 of them. I could not answer "did my ultra-only change touch a 10K plan?" from that, and I was about to argue it from the code instead of checking. Added a per-axis histogram to the script; it immediately printed `50=432/972  100=432/972  5=0/972  10=0/972  21.1=0/972  42.2=0/972`, which is the actual answer and took three lines to get.

**Hook material:** A config value sitting in the catalogue for months, ratified by a board, with a principle explaining it — and it was never once read by the session it described.

**Postable?:** yes


## 2026-09-13 — LR-SEGMENT-RECORDED-§25 · the config that was declared, ratified, and read by nothing

**Shipped:** §25's HM and marathon race-specific long runs now record the pace segment they prescribe, and derive their zone label from the catalogue row instead of hand-writing it beside the row that already declared it.

**Dev learning:** The interesting half wasn't the missing field — it was `intensity_zones`. Every one of the catalogue rows declares it. It is in the DB schema as `TEXT[] NOT NULL`. It is in ADR-010. And `grep -rn "intensity_zones"` returns the definition, a doc, and one test fixture. **Nothing reads it.** Meanwhile the producer hardcoded `zone: 'Zone 2–3'` ten lines from the row that says `['Z2','Z3']`. Two copies of one coaching fact, one of them decorative. Deriving one from the other was a zero-line-of-output change — 30/30 sessions already agreed — which is exactly why it was worth doing and exactly why it needed a mutation test: equality between a hardcode and a coincidence proves nothing. I only trust the derivation because I mutated the row to `['Z2','Z4']` and watched `session.zone` follow.

**Product/creator learning:** "Record what you already prescribe" keeps being the highest-yield class of work in this codebase. The coach note already said *"Final third at HM pace: 4:59 /km"*. The runner could read it. But no invariant could check it, no surface could render it, and nothing could ever be built on top of it. Prose is not a prescription.

**AI-building learning:** The measurement script was the thing that earned its keep. First run: `TypeError: Cannot read properties of undefined` — I'd imported `SESSION_CATALOGUE` and the export is `V1_SESSION_CATALOGUE`. Second run: **every single one of the 36 grid cases refused**, and the script said so loudly instead of printing a tidy table of zeroes. That guard cost three lines and it is the only reason I didn't spend the next hour "fixing" a producer that was never being reached. The race date was 13 weeks out and §44 wants 12 minimum for a time-targeted HM.

**The honest bit:** I very nearly cited `verify:parity` reporting **IDENTICAL — 2916 cases, byte-for-byte unchanged** as proof the change was safe. It is worthless as evidence here. The parity grid hardcodes `goal: 'finish'`, and everything I touched only runs for `time_target`. So the tool I reach for to prove "generation is provably unaffected" is structurally blind to §22, §24b, §25 and the whole goal-pace branch — and it says IDENTICAL with total confidence. The golden snapshots are what actually caught the change: four lines, and I could read every one.

**Hook material:** A green "byte-for-byte unchanged across 2,916 cases" from a test grid where one hardcoded word — `goal: 'finish'` — means it never once looked at the code I changed.

**Postable?:** yes


## 2026-09-13 — Coaching Board batch · Seven questions, and the answer to five of them was not "build it"

**Shipped:** one board ruling (an absolute-km floor under the delivered volume caps); rulings on six more, four of which were "don't build this, and here's why."

The founder asked me to take every backlog item that needed a Coaching Board sitting and get the answers. Seven of them. The interesting thing about running them as a batch is how few ended in code. That's the point of the board — it's the layer that decides whether a decision is *right*, and "right" is often "leave it alone."

The one I shipped: our injury and ramp volume caps are percentages, and a percentage on a small number lies. A knee-history runner on 20 km/week who adds one short easy run — three kilometres — trips the "you're ramping too fast for injured tissue" warning at +38%. It's not a ramp; it's a Tuesday. So the cap now needs the rise to clear both the percentage *and* an absolute floor of 3 km. I set the 3 km by measuring, not guessing: across 2,790 injury plans the flagged rises ran 1 to 7 km, and 3 km cleanly separated the arithmetic noise (half the flags) from every real step. Sims held the line at 3 and vetoed 5 — a 5 km floor would have started hiding genuine spikes on low bases, which on masters and low-energy-availability runners is exactly the population you cannot afford to blind. The warning still fires; it just stopped crying wolf, which is the only way anyone keeps listening to it.

The five that didn't ship taught more. **Pace-band the fitness-trend cohort** so "at the same pace" is true rather than disclaimed? Measured: to make it true you have to narrow the cohort so far the card goes dark for ~60% of the people who see it today. A disclaimed comparison beats no comparison. Declined. **Deliver the three fancy VO2 session shapes** we ruled valid months ago? Two of them are only 2–6 minutes of actual VO2 work — our dose band rejects them *correctly*, and weakening it to let them in would mislabel the session. They're not VO2 sessions wearing the wrong hat; they belong in a category we haven't built. Declined. **The marathon "maintenance" label** that fires on 100% of time-goal marathons — re-measured with the new peak-floor live, still 100%, still uninformative — turned out not to be fixable by the two levers the chair originally named. The real cause is a specificity floor colliding with the long-run time cap, which means a runner plainly building gets called "maintenance." That's a real bug, but fixing it relabels the entire cohort, so it earns its own careful change, not a rushed one.

**What I'd tell someone building this:** a governance board only earns its keep if "no" and "not like that" are common outputs. If every sitting ends in a commit, it's a rubber stamp. Five of seven ending in "keep the disclaimer / don't weaken the band / that's the wrong lever" is the board doing its job. And every "don't build it" is still an answer — it closes the item and stops it being re-litigated in three weeks.

---

## 2026-09-13 — UX-COACH-01 polish · Making the race card feel like it gets you

**Shipped:** a design pass on Coach's race projections, plus two smaller reads, all against one bar the founder set: "logical, premium, make me feel like it understands me."

The founder asked me to review everything on Coach and check it earns its place. Most of it did — yesterday's consolidation (five Kit cards to one, four tiles to two, two trend cards to one) held up. Three things sat in the gap between *correct* and *premium*.

The biggest was the race projections card. It has a lovely part and a dull part stacked together: the arc (where you were, where you are, the goal you chose) is the thing that feels personal; the 5K/10K/HM/Marathon table underneath is a calculator. On the founder's own plan — a 100 km ultra — the dull part was actively wrong-feeling: VDOT can't project 100 km, so the arc honestly drops to a marathon-equivalent, but the box still headlined that marathon time under "Your race". A big bold clock for a distance you're not racing, under your race's name, is the opposite of "it understands me." Fix: the arc stays the hero and always visible; the distance table collapses behind a tap (the founder's instinct — "can we make it drop down?"), which also quietly kills the duplication where the race-distance row just repeated the arc's "now". And for an ultra the box now says "Aerobic fitness / Marathon-equivalent" and moves the race name into the honest caveat, instead of pretending the marathon time is the race.

The UX call I want to record: I did **not** take this to the SLT. It's tempting to route anything touching a paid surface through a board, but SLT rules on *what to build, for whom, at what tier* — and none of that moved. Same feature, same tier, same data; only the arrangement changed. Routing presentation through a build-decision board is how a board stops meaning anything, the same logic that keeps the coaching hook off ordinary bug fixes. Control-shape is the design lead's call, and I made it.

Third, small: "Load ratio 1.04x — overloading" is telemetry, not coaching. The number and its severity colour stayed; the words became "above your recent normal". One owner feeds both the tile and its explainer sheet, so they can't drift.

**What I'd tell someone building this:** progressive disclosure is not about hiding things, it's about deciding what the surface is *for*. The card is for "how am I tracking toward my race", so the trajectory leads and the lookup table waits behind a tap. And the honest answer for an ultra — "I can't project this, here's your aerobic fitness instead" — reads as *more* premium than a confident wrong number, not less. One residual I won't dress up: Coach is auth-gated, so the in-card look is the founder's device check; the arc row alone renders at /coach-preview.

---

## 2026-09-13 — UX-WIZARD-01 Stage C · Turning the lights on

**Shipped:** the per-day time-budget control is now rendered in the wizard, so the feature the engine has been ready for since this morning is finally reachable by a runner. UX-WIZARD-01 is done, end to end.

Stage B built the engine half behind a flag and left it dark: the control existed, was tested, and was deliberately not wired, because a visible control that changes nothing a runner receives is the same defect as a declared config token nothing reads. Stage C is the wiring — small, and mostly about not breaking the byte-identical guarantee the earlier stages earned.

`DayBudgetRows` sits on the weekday-ceiling step, directly under the existing cap chips. The chips still answer the simple case in one tap; the per-day rows are progressive disclosure for the runner who actually has an uneven week. New wizard state (`dayBudgets`), restored and persisted in the draft exactly like every field beside it, threaded into `weekPlanToInputs`'s third argument — the one the earlier stages left `undefined` — and pruned on every grid change so a day flipped back to Rest can't keep a stale budget. The cycle options are derived from the cap chips minus "No limit", because two lists of the same time buckets is one list waiting to disagree.

The founder's rule for this item was achievability: you cannot tell someone to run 10k on a day they gave 30 minutes. That's enforced by construction — a day's budget times the runner's estimated easy pace bounds the distance, and the invariant that checks it is per-day. I still wrote it down as a test that asserts it directly over a real generated plan, because "enforced by construction" is a claim, and a claim about what runners receive should be a test, not a sentence. The tight days come out a fraction of the roomy day; nothing overruns its own budget except the long run and structured sessions, which carry the SPEAK obligation instead.

The verification that mattered: a UI wiring change moves no engine code, so `cohort:shape` came back byte-identical to its committed baseline — the population isn't being reshaped, the runner is now simply *allowed to shape their own*. An untouched control sends an empty map, which is `undefined`, which is the plan they'd have got yesterday.

**What I'd tell someone building this:** the honest way to ship a feature in two halves is to make the first half prove the second half changes nothing until someone opts in — then the "turn it on" commit is ten lines and a screenshot, not a leap of faith. Residual I won't pretend away: the wizard's behind auth, so the live in-wizard eyeball is the one step I couldn't do from here.

---

## 2026-09-13 — UX-WIZARD-01 Stage B · The engine hears "Tuesday's my long evening"

**Shipped:** the plan engine now uses per-weekday time budgets — sizing, placing and redistributing around the runner's actual week — and it changes nobody's plan who doesn't use the feature.

This is the prescription-moving half, and the founder set the rule for it before I started: know the up/downstream impact, run the coach review before and after, and don't break doctrine. So the shape of the work was as much about the safety net as the code. First I added day-budget cases to the coach review (the existing cases set no budgets, so a before/after would have proved nothing) and captured a baseline: the quality session landing on a *tight* day while the runner's open day sat empty, six weekday sessions running over their own budget.

Then four coupled changes, all gated behind "does this runner have per-day budgets": the cap became per-day; a day's budget bounds its own session; placement moved the structured session onto the day with room; and a water-fill spread the week's fixed easy volume across days weighted by how much room each has, so a roomy day absorbs what a tight day can't hold. The invariant that enforces the cap became per-day in the same commit — because §81 is explicit that an engine exemption the validator doesn't share is a plan that fails its own constitution, and the moment the engine placed a legitimate 49-minute session on a 90-minute Thursday, the old single-cap validator screamed. It was right to; I made it per-day too.

The guardrail that mattered most was `verify:parity`: every change is behind the `day_budgets` flag, so I could prove — 2,916 cases, byte for byte — that a runner who doesn't use the feature gets the exact same plan as before. That's the downstream-impact answer stated as a fact, not a hope. Then the sweep, run with per-day budgets injected across 20% of 16,000 plans, came back with no new violations; the matrix held; and the coach review, re-run after, still had every case clean. The before/after: six-plus over-budget sessions each on the two exercisers went to zero, and the structured session moved onto the roomy day.

One honest note on the sweep: my first injection flooded the grid with 30-minute budgets and tripped a noise gate on the "don't detrain" warning — not because the engine was wrong (per-day budgets *reduce* detraining versus a flat cap) but because I'd over-sampled the most-constrained runner. The fix was to sample realistically, not to move the gate. Moving a gate to make your change pass is how a gate stops meaning anything.

**What I'd tell someone building this:** when a change alters what real people receive, put it behind a flag and prove the flag-off path is identical before you argue about the flag-on path. And build the test that can *see* your feature before you build the feature — a before/after over inputs that don't exercise the change is a green light that's wired to nothing. Still dark until the control ships (Stage C); the engine is ready and the net is around it.

---

## 2026-09-13 — UX-WIZARD-01 Stage A · Capture the input before you change the behaviour

**Shipped:** per-weekday time budgets now flow from the wizard into `GeneratorInput`, end to end, and change nothing yet — on purpose.

The item that justifies this (a runner with 30 minutes on Tuesday and 90 on Thursday is forced to enter 30, and loses ~22% of peak volume to it) needs the engine to size and place sessions per day. That's a prescription-moving change, and the backlog entry is emphatic about the order: capture the data first, byte-identical, so the risky half lands against a known-good baseline. So Stage A is deliberately boring — add `day_budgets` to the input, thread it through the wizard and the API, validate it, and have the engine ignore it while `max_weekday_mins` (derived as the minimum) stays the authority.

"Byte-identical" isn't a claim you make, it's one you prove: `verify:parity` came back IDENTICAL across 2,916 cases, and the cohort-shape gate didn't move. The satisfying part was that the repo's own guards caught me mid-change. The moment I declared `day_budgets` on `GeneratorInput`, the INPUT-EFFECT-01 test failed — "this field is declared but varying it produces the same plan every time," which is exactly the inert-input class the codebase has been burned by (`max_weekend_mins`, `zone2_ceiling`, both declared and read by nothing). It was right. The honest resolution wasn't to suppress it but to register `day_budgets` as *debt* — a field that should change the plan and doesn't yet — with a note that removing the entry is what Stage B means. An inert input is only acceptable when it's temporary and tracked, and the guard is what keeps "temporary" honest.

**What I'd tell someone building this:** when a change moves what real users receive, split it so the plumbing lands separately from the behaviour, and prove the plumbing changed nothing before you touch the behaviour. And if your test suite yells that your new field does nothing — it's not being pedantic, it's naming the exact failure mode this app keeps hitting. Register it as debt, don't silence it.

---

## 2026-09-13 — ONBOARD-OBS-01 · Telemetry for the write that can't call the telemetry helper

**Shipped:** the onboarding finalise now reports its own failures, and a daily probe catches any it misses.

`recordOpsEvent` is server-only (service-role key), and the onboarding finalise — the `has_onboarded` flip and HR persist — runs in the browser. So the one write whose silent failure stranded 9 of 14 early users (Problem A) was structurally unable to record that it failed; all it could do was `console.error` into a console no one was reading. The fix is the standard shape for "a client needs to record an ops event": a thin bearer-authed route the client posts to, which records server-side. The user id comes from the verified token, not the request body — a client can't pin its failure on someone else.

The part worth keeping is the belt-and-braces, copied from reshape-integrity: reporting at the failure site is necessary but not sufficient, because the failure might be the very thing that stops the report. So there's also a daily probe that *observes the broken state* — a saved plan with `has_onboarded` still false — regardless of where or whether the write failed. That's the check that would have surfaced Problem A on day one instead of after weeks, and it's the one I trust more.

Everything here is reuse: `recordOpsEvent`, `getUserFromRequest`, `authedFetch`, the reshape-integrity route, the ops-cron workflow. The only genuinely new code is one pure function — "which users have a plan but aren't onboarded" — pulled out so it's unit-tested rather than proven by watching a cron. No migration; `ops_events` already exists and its kind is a TypeScript enum.

**What I'd tell someone building this:** when a write can fail silently, don't just log at the site — add something that watches for the *state* the failure produces. The site-level report and the state-level probe fail in different ways, and you want the one that doesn't depend on the broken path being able to speak.

---

## 2026-09-13 — PLAN-ARC-INSET · "The progress at the top runs off the page"

**Shipped:** the Plan-screen progress strip is inset to the content margin, and its label row can't overflow. Small fix; the process is the note.

The report was "the progress tiles along the top of the Plan screen go off the page and look bad." Obvious culprit: `PlanArc`, the week-bar strip. Obvious hypothesis: with a long plan the bars or the label row overflow horizontally. So I built a static repro of the exact markup at 375px and 320px — and it **didn't overflow**, for a 25-week ultra, a foundation chain, even the long `maintenance_base → maintenance_restoration` fallback label. The bars are `flex:1` (they always fit); the 10px label fits too. Hypothesis dead.

Reproducing it is what found the real thing. `PlanArc` carries no horizontal padding, and it's the **only** block at the top of the screen without the `0 16px` inset every sibling has — so the bars and label run **flush to both screen edges**, sitting past the (inset) race title above them. That's not a scroll overflow; it's a full-bleed misalignment, and in plain language it's exactly "runs off the page and looks bad." A before/after screenshot made it obvious. Fixed by wrapping the call site in `0 16px` (the screen owns the margin; the component stays full-width) and, defensively, making the label row truncate with the counter pinned so a long phase chain can never push it off.

**What I'd tell someone building this:** the fastest way to fix the wrong thing is to trust the obvious hypothesis. I was sure it was an overflow; the repro said no in thirty seconds and pointed at a margin. Reproduce the *layout*, not just the theory — and when you can't reach the real screen (this one's behind auth), rebuild the exact CSS at the real width, because a pure-layout bug reproduces perfectly there. Honest residual: I confirmed the misalignment in a faithful repro, not on the founder's device — worth a glance to confirm it's what they meant.

---

## 2026-09-13 — STRAVA-WEBHOOK-NO-APP-LINK · A run that only linked when I opened the app

**Shipped:** fixed the base-URL regression that broke background run-analysis, built the missing tool to inspect the Strava webhook subscription, and named a new silent-failure class.

The report: a Garmin run went to Strava, but Kit only saw it when the app was opened — and this used to auto-link with the app closed. The instinct is "the webhook broke," and it might have, but the debug pipeline's rule is to separate the paths before blaming one.

There turned out to be three. The **link** to a planned session is a direct database write — it doesn't depend on any URL. The **analysis** ("Kit reading the run") is a separate server→server call to `/api/analyse-run`, and its base URL came from a helper that still read `NEXT_PUBLIC_APP_URL` — the env var GTM-SITE-01 *removed* three days earlier. Every other URL in the app had been migrated to the committed `?? 'https://www.zonna.run'` default; this one server-only helper was missed, and fell through to the per-deployment Vercel URL (which carries deployment protection) or localhost. So since the domain migration, background analysis on *both* ingest paths — Strava webhook and HealthKit — was calling a host that couldn't answer. Silent, because the call is fire-and-forget in a catch that only warns, and the link still worked whenever you opened the app.

But the link *not happening at all* points past the analysis helper to **delivery** — and that's the part I couldn't see, because it lives at Strava. The webhook subscription's callback URL is registered with Strava's API, not in our repo, and there was no script to view it, no event when it fired, no alert when it stopped. That's the actual lesson, and I added it to the debug catalogue as a class: **untooled external subscription.** The likely mechanism is grimly neat — the same www-canonical migration made the apex URL 307-redirect, Strava doesn't follow redirects, and it deletes a subscription after enough failed deliveries. If the callback was the apex, the feature deleted itself and nothing in our code could know.

So: I fixed the helper (with a test that pins the www default on Vercel), built the subscription inspect/register/delete script so the external state is finally visible, and filed the follow-up to emit an ops-event per webhook hit plus a daily "no delivery in N hours" probe — the same visibility we already give stored plans. One nice side-finding: pull-to-refresh on Today already runs the same sync as app-open, so the founder's "it should also trigger on drag-down" was already true.

**What I'd tell someone building this:** when a background feature fails, separate "did the trigger fire" from "did the work succeed" before you fix anything — they have different owners and mine were in completely different places (Strava's servers vs a stale env fallback). And any feature that depends on state held by a third party needs a way to *look at that state*. We had none, so it broke in silence for who knows how long.

---

## 2026-09-13 — PEAK-SPEC-MAINT-01 · The board's job is to check the finding, not rubber-stamp it

**Shipped:** the specificity check now counts a marathon's race-pace long run, ending a false "you get no goal-pace rehearsal" warning. Board ruled CB-SPEC-02, both the readings I'd filed turned out wrong.

The auto coaching-review round (its very first run) flagged that a 4:00 marathon plan's peak had 0% race-specific work — a runner chasing a time getting no rehearsal of it. I'd filed it with two options: exempt maintenance plans, or force a goal-pace session. Both felt reasonable. Both were wrong, and the reason is a good argument for investigating before you convene.

I pulled the actual plan. The peak *did* carry a Marathon-pace long run — the runner rehearses goal pace in week 10. The "0%" was false. The invariant only counts `type:'quality'` sessions, and a marathon's specificity lives in the long run (`mp_long_run` — category race_specific, but role long_run, type easy), which the check couldn't see. Then the clincher: a well-resourced 3:30 build was *also* classified maintenance and passed fine — because it happened to get its specific work as a standalone quality session. So maintenance was never the variable. Resourcing was. My "exempt maintenance" option would have papered over a measurement bug with a coaching exemption.

The board ruled CORRECT WITH AMENDMENT: for half and full marathon, count the race-pace long run toward peak specificity. Seiler's objection is the interesting one and I kept it — in Zonna's model the long run is aerobic *volume*, deliberately typed easy so the 80/20 split and the long-run cap treat it right. Reclassifying it a quality session would break that. The resolution was to count it toward *this one ratio* without touching its type: §1 and §52 still see volume, §93 now sees the rehearsal. No plan changed — `verify:parity` territory, plans byte-identical; the sweep confirmed no new violations and the invariant still fires on 2.4% of plans, so it's corrected, not defanged.

**What I'd tell someone building this:** a red check is a claim, and the claim can be wrong. "0% specific" sounded like a coaching gap and was actually a blind spot in the measurement — the plan was fine. If I'd gone straight to "fix the plan" I'd have added intensity to a returning, injured runner to satisfy a check that was miscounting. Read what the plan actually contains before you decide what's broken. And §93 had *told* us the marathon's specificity was the MP long run — in a flag no code read. A documented intention that nothing exercises is a bug with a paper trail.

---

## 2026-09-13 — COACHING-REVIEW-AUTO-01 · The review folder we built and then forgot to run

**Shipped:** the `coaching-review/` loop now triggers itself when doctrine ships, generates both scenario sets, and prompts the board — instead of waiting for someone to remember.

We built a proper coaching-review loop back in April: generate a few canonical plans, have a senior coach judge whether they'd *coach the runner well* (a different question from "do they validate"), turn that into a backlog, fix, repeat. It ran four times and then went quiet — last round was mid-August. The reason is the oldest one there is: step 1 was "someone runs the script," and no one owned "someone."

Two things had also quietly happened around it. The **Coaching Board skill** arrived in August and is, precisely, the automated version of that loop's "senior coach reviews it" step — but nobody wired the loop to it. And this week's **charity personas** are a better version of the loop's generator: the old one dumped plans for a human to read; the new one runs `validatePlan` itself. So the loop's intent was alive and being served, but in three different places, none of them the folder.

The fix wired the trigger to the real signal: **a coaching-doctrine file landing on main.** That's the proactive partner to the `coaching-guard` hook — the hook reviews the *change* as you make it; this reviews the *resulting plans* once it's live. A GitHub Action runs one consolidated generator over both sets (4 canonical + 11 charity), validates every plan, fails loudly if a doctrine change broke a case, and posts "board round due — run /coaching-board" with the packet attached. The board sitting still needs a model, so that stays a `/coaching-board` invocation — but it's now *prompted*, which was the whole problem.

**The loop earned its keep before it even shipped.** Consolidating the generator meant actually running the four canonical cases again, and Case 04 — a 4-day time-targeted marathon that's *supposed* to demonstrate the maintenance-downgrade path — now hit a flat refusal instead. A days-minimum gate (5 days for a time-goal marathon) had been added months after the case was written, and the case only ever acknowledged the *prep-time* warning, not the *days* one. Live for who knows how long, invisible because nobody had regenerated that case. That's exactly the failure the loop exists to catch, caught by turning the loop back on.

**What I'd tell someone building this:** a review ritual with no trigger is a review ritual that stops. If you can name the event that should start it — here, "doctrine changed" — wire the start to the event, not to a human's memory or a calendar. And when you have three tools doing one job in three places, the job is probably drifting; pick the folder that was meant to own it and point the others at it.

---

## 2026-09-13 — CHARITY-COHORT-01 · Do we have enough test scenarios for the charity runners?

**Shipped:** a named charity-persona set (10K/HM/marathon), a generate+validate report, a regression test, and a Coaching Board ruling that the engine is fit to ship to the charity audience as-is.

The question was "do we have enough input scenarios for the charity referral, and are the plans fit for purpose?" First finding: we have a *lot* of coverage already — a 20k-plan property sweep, a 648-cell exhaustive cohort grid, a 17-case archetype matrix, 7 golden personas. Validity is not the gap. The gap was **named, human-legible cases for the exact population charity sends** — and specifically marathon, which had three archetype cases, two golden personas, and *zero* in the real-input corpus. The real users skew hard to 5K (7 of 17 live plans); the distances the charity cares about are the thinnest in reality.

So I built 11 charity personas weighted to the hard end — first-timer marathon off 15km/week, compressed 12-week marathon, returning runner with a knee, masters marathon at 58, couch-to-10K, HM with shin splints — generated a real plan for each, and ran the constitution (`validatePlan`) over it. **Every one passes with zero error violations, or refuses by design.** The honesty layer is the star: the low-base marathons classify themselves `maintenance` and say, in plain words, "this gets you round, not to a time; the race sets the long run, your 15km a week sets everything else." That's exactly right.

The interesting part was the `warn` residuals — and they **cluster on the charity profile**: injury-cap and delivered-ramp flags land on the masters, injured, low-base personas, not the healthy intermediates. That looked alarming enough to put to the Coaching Board. The board's answer was sharper than mine: the scariest exhibit — a masters knee runner "+38% over the 5% injury cap" — is **+3km in absolute terms** (8km → 11km of easy running). A percentage cap below ~15km of volume is measuring rounding, not physiology. Willy's point stuck: the *real* load event in the whole set wasn't the +38%, it was the quiet **+10km week** on the 58-year-old marathoner, which the % cap under-weights at 25%. The instrument is wrong at the extremes of volume, not the plan. Ruling: **ship as-is**, with a watch-item to add an absolute-km floor beneath the percentage caps (its own board sitting, later).

**What I'd tell someone building this:** "0 violations across 16,000 plans" is a real safety property, but it can't answer "is this good for *these* people." A dozen named personas you can read — first-timer marathon, this is the plan it got, here's the long-run shortfall note it wrote — tell you something the aggregate can't. And a percentage safety cap is a liability at low volume: it cries wolf at +3km and stays quiet at +10km. Absolute and relative both matter; pick one and you get fooled at one end.

---

## 2026-09-13 — FORMS-PRIM-01 · Closed an "in-progress" item that was mostly already done

**Shipped:** the last two bespoke time controls fold into the shared wheel picker, and FORMS-PRIM-01 closes. Also closed V2-POLISH-01 (founder call — the substantive pass shipped 09-11; the rest was a design eyeball, not a task).

The interesting part wasn't the code, it was the backlog. FORMS-PRIM-01's "Remaining" listed four things: foundation day-key normalisation, manual-log stepper, recalibration mm:ss, and "login/profile/benchmark migration." I went to do them and found **two were already done** — foundation day-key normalisation shipped with `normaliseDays` and a passing test, and login/reset/benchmark were already on the shared `TextField`/`DurationPicker` from earlier increments. The one raw `<input>` left on login is an age-confirm *checkbox*. The item had been carrying stale scope, which is exactly how an "in-progress" thing sits open forever: the list of what's left stops matching the code, and nobody re-checks because the header still says 🔄.

So the real work was two conversions. Manual-log duration was three hand-rolled hrs/min/sec steppers → the shared `DurationPicker`, and deleting the local `Stepper` component on the way out (one fewer copy of a control that already exists once). Recalibration's time-trial result was a free-text `mm:ss` box parsed with a regex → the same wheel — which meant giving the primitive a **minutes:seconds mode** (`showHours={false}`), because a 5K is never hours and a wheel stuck at `0` hrs is worse than no wheel. I added the mode to the one primitive rather than forking it; that's the whole point of having a primitive.

**Where I drew the line:** the manual-log *distance* still uses its own ± buttons. There's no shared distance-wheel — the wizard's distance control is the `Ruler`, a genuinely different interaction — and the item only ever scoped the *time* steppers. Converting distance would be inventing a new primitive under cover of "finishing" an old item, so I left it and said so in the backlog. Finishing an item shouldn't mean quietly expanding it.

**The pattern worth keeping:** the time logic (valid window, parts→seconds, the display string, a distance-based default so the wheel starts somewhere plausible) came out into `lib/coaching/recalTime.ts` with its own test, so the component is presentational and the rules are checked. Same shape as every other `.logic.ts` in here. A wheel you can't unit-test is a wheel whose bounds you find out about on a user's phone.

---

## 2026-09-13 — SHEET-PRESENT-01 + NAV-SPACE-01 · The bug was a number seven files each guessed

**Shipped:** one `<Sheet>` primitive, every bottom sheet migrated onto it, and the bottom nav tightened to reclaim space — the two founder-device items from yesterday, done together because they had to be.

The founder's report was three symptoms: tapping zones on Me, tapping zones on Coach, and "log manually" — the pop-up loads but you can't see it until you scroll. Three symptoms, one cause. The bottom nav is `zIndex: 3000`; the sheets were written at 100, 200 and 2000. They opened *underneath* the nav, and the part the nav covered was the bottom — which is exactly where each sheet put its own close bar. The sheet worked. You just couldn't see the half that mattered.

**The filed spec said "five of seven". It was eight.** I didn't trust the count, so instead of patching the named ones I wrote a test that greps the whole tree for the anti-pattern — a fixed, bottom-anchored overlay with a scrim and a z-index below the nav — and let it find them. It turned up `ManualRunModal` and a Foundation-gap modal in the wizard that nobody had listed. That's the argument for a mechanical guard over a careful audit in one line: the audit is scoped to what you remember touching; the grep is scoped to the defect.

**Three things I made properties of the primitive instead of leaving them to callers.** One, it portals to `document.body`. The app locks `<body>` and scrolls an inner div, and WKWebView is unreliable about `position:fixed` elements inside a scrolling container — that was the "device caveat" flagged in the backlog, and portalling to the body dissolves it rather than testing around it. Two, one z-index owner (`lib/ui/zLayers.ts`) so "a sheet is above the nav" is a property a test asserts, not a number each file picks. Three, it rests on the *measured* nav height, published through context from the one place that already measures the nav for the scroll padding. That third one is why the two items shipped together: because the sheet reads the live nav height, tightening the nav (NAV-SPACE-01) needed zero sheet edits. The sheets just followed.

**Where I resisted the pattern.** `ScreenGuide` — the first-load coach-mark — is also a bottom sheet, and it would have been tidy to fold it in. But it teaches nav position by drawing a *mirrored* nav of its own; it's a different thing wearing the same shape. Forcing it into the primitive would have been DRY applied to two things that aren't the same thing. It keeps its own structure and just borrows the shared z-layer. The guard test knows it's an allowed exception because it sits above the nav, which is the only property that actually matters.

**What I'd tell someone building this:** when seven copies of a thing disagree, the fix is not an eighth correct copy — it's deleting the decision. None of these files should ever have been allowed to choose a z-index. The moment that choice has one owner, the whole class of bug is unreachable, and the test that proves it is three lines.

---

## 2026-09-12 — RACE-ARC-REACH-01 · Third time asked, first time I checked the database

**Shipped:** the progress arc now reaches runners who never took a benchmark, and ultra runners. And a claim that was guaranteed to be wrong for everyone who did take one.

Three times today the founder said the race projection was not showing. The first time I'd genuinely not built it. The second time I built it, tested it, rendered every state on a preview page, and shipped it. The third time he said the same sentence again.

So I stopped reading code and queried the production database. His plan: race distance **100 km**, `meta.vdot` **null**, goal **finish**. The arc needs a projectable race distance (VDOT doesn't extrapolate past the marathon), a baseline VDOT (stamped only when a benchmark was entered at plan creation), and a target time. He had none of the three. Zero of three points, on the account of the person who asked for the feature.

Then I ran it across every live plan: **10 of 17 have no `meta.vdot` at all. Only 7 could ever show "was → now". Only 2 could show all three points.** I'd built, verified and shipped something that worked on two plans in seventeen, and called it done twice.

**The verification I'd been skipping is a two-minute query.** Everything else I did was real — typecheck, 1600 tests, a fixture page rendering seven states, screenshots at phone width. None of it could tell me whether a single actual runner had the data to see it. "It renders correctly for the inputs I invented" and "it renders for the person who asked" are different claims, and I'd been treating the first as evidence for the second all day.

**The fix was sitting in the same database.** There are 69 runs across six months, easy pace going from 8:29/km to 6:32/km at the same heart-rate band. "Where I was" doesn't need a benchmark — it needs his earliest runs, which is a measurement he already made. So: derive the baseline from the earliest six-week window of qualifying aerobic runs, require a real gap from the present so it isn't comparing him to himself a fortnight ago, and label the point with its **month** rather than "plan start" — because the plan started in January and the run data starts in April, and dating the measurement to January would be a small lie in service of a tidier label.

For the ultra: the card was already printing the marathon projection three rows further down. Refusing to project 100 km is correct. Refusing to show the fitness trajectory *because* the race is 100 km was not the same refusal, and I'd conflated them. The arc now drops to the nearest distance VDOT can actually do, and says which one.

**And then the thing I nearly made much worse.** Before shipping I checked what the arc would show for the seven runners who *did* enter a benchmark. It compares the stored VDOT against the current estimate — and the current estimate is that same VDOT with a staleness discount applied. The discount has a 5% floor and grows every four weeks. So the "now" number is arithmetically guaranteed to be lower than the "then" number, always, for everyone, forever.

Every benchmark runner who hadn't re-tested was being told they'd got slower. The longer they left it, the more they'd "declined". That's been live as a small delta chip for months and nobody noticed, including me — and I was one commit away from promoting it into a hero element with 26pt type. One measurement is one point. It now shows one point.

**What I'd tell someone building this:** when a user reports the same thing twice, the bug is not where you're looking. I re-read that component three times. The answer was never in it — it was in a column called `race_distance_km` with the value 100.

**Numbers:** 1606 tests across 181 files, exit 0. Generation identical across 2,916 plans. The fix replayed against the 17 real qualifying rows before deploy: April 4:26:56 → now 3:53:36, 33 minutes 20 seconds faster, with the "now" figure matching the founder's own screenshot to the second.

---

## 2026-09-12 — TREND-SPARKLINE-01 / TREND-PACE-CLAIM-01 · A chart request turned into a false claim we were already shipping

**Shipped:** the line on the easy-run trend card, and then the discovery that the card was telling some runners something untrue.

The founder remembered a sparkline from a mockup and asked for it back. Easy job: the whole monthly series was already coming down from the trend endpoint, and the screen was reading the first bucket and the last one and dropping everything between. An hour, maybe.

Then came a follow-up I nearly answered from memory: what would a **pace** line mean? I went to check how the cohort was built before answering, and found that it matches runs on **distance** and nothing else. No pace control, no effort control. Which would be fine, except the card's own explanation sheet said the comparison was *"at the same pace"* — twice — with the conclusion *"your aerobic base is growing"* hanging off it.

So a runner who had simply eased off was being told they were getting fitter.

**The bit that made it worse than a normal bug.** This isn't random. Zonna's whole argument is *slow down*. A runner who takes that seriously **is** running their easy days slower. So the people most likely to be told something false were the people the product was working for. The failure rate is inversely correlated with adherence. I would not have found that by testing; I found it because a board member's job is to ask who the failure lands on.

**Taking it to the SLT was the right call and the answer was not what I brought.** I went in with three design options for a pace feature. Fried's response: *"you've brought us a feature request and a bug wearing the same coat. Take the coat off."* There was no feature. There was a defect, and a question about pace that only looked like a feature because the defect made it seem interesting.

They also killed the obvious version outright. A pace number, on a trend card, coloured for improvement, is a reward attached to easy-run speed. In an app whose entire thesis is that you're already trying too hard, that's not a neutral metric — it's an incentive pointing the wrong way. Same digits, different position, different object entirely.

**And I got a fact wrong in my own briefing.** I said the efficiency option would need "a unit no runner has ever seen." Checking the registry during the review: we've been computing speed ÷ heart rate since April, storing it per run, and showing it to runners in Session Detail as a percentage against their baseline. I'd argued against building something on the grounds it was unfamiliar, while it sat two screens away. Check the registry *before* forming the opinion, not while defending it.

**The measurement is the part I'd repeat.** The obvious implementation was to reuse a constant we already had: 5 seconds per km, the threshold for "is there a pace trend worth mentioning". Hutchinson objected that it felt too tight for easy running across six months. So I measured it against the production database instead of arguing. Easy runs in a matched distance band: **within-month standard deviation of 40 s/km**. The constant I was about to reuse was an eighth of the noise floor. It would have withheld the claim essentially always, and I'd have shipped a card that never spoke again and called it caution.

I set the new threshold at 20 s/km and wrote "provisional" into the constant in capitals, because the sample was three users and four comparable month pairs. The *scale* argument is solid at any sample size — a threshold below the within-month standard deviation cannot separate signal from noise. The specific number is a guess with a floor under it, and pretending otherwise is how a measured value becomes folklore.

**One thing I nearly shipped broken.** The sentence withholds the fitness claim when pace explains the heart rate. The sparkline right underneath it was still drawing in brand green, because it was deciding "improving" from the heart rate alone. One card, two verdicts, disagreeing. Caught it on the preview page, not in a test — the test suite was entirely green while that was true.

**Same day, same free lunch, twice:** the bad-heart-rate rows behind yesterday's impossible "77 bpm" turned out to be four runs from a single Apple Health sync on one day in April, the exact bucket shown on screen. I only saw it because I was already in the database measuring something else.

**Numbers:** 1590 tests across 179 files, exit 0. Generation provably identical across 2,916 plans. Filed one item for the Coaching Board — band the cohort on pace so the claim is true by construction rather than by disclaimer — because that changes what counts as a comparable run, and that's a coaching decision, not mine.

---

## 2026-09-12 — UX-COACH-01 · I wrote a comment describing a feature and shipped it as the feature

**Shipped:** the race progress arc (where I was → where I am → what I'm aiming at), Kit's read and the zone rings merged into one card, a plausibility gate on every heart-rate average, and three mislabels in the trend card.

**The honest bit.** Yesterday I moved a component to a new screen, wrote a comment block above it titled *"THE ARC — where I was · where I am · the goal I chose"*, changed nothing inside the component, and reported the arc as shipped. It hadn't. The card went on rendering one number and a small delta chip. It was caught by opening the app on a phone: "I don't see the pace progression."

I want to be precise about what kind of mistake that is, because "I forgot to build it" is too kind. I had conflated **moving a card to its documented home** with **building the thing the card was supposed to show**, and then I wrote a paragraph that described the second one. The paragraph was confident, specific, and cited the exact field names. It was also fiction. Comments are the easiest thing in a codebase to make true-sounding, because nothing checks them.

**The part that actually explains it.** Two of the three points *already existed*. `baselineSeconds` — the runner's plan-start estimate — was computed by the API, sent in the payload, and typed by the component. And drawn by nothing. It reached the client and stopped. The third point, the runner's own goal time, had never been read off the plan at all, despite the comment naming the exact field.

So why did a typecheck, a full green suite and my own review all pass over this? Because **the card fetches a tier-gated, authenticated endpoint**. There was no way to *look* at this feature short of a live paid session on a device. Every check I ran could only tell me the code compiled and the tests I'd written passed. None of them could tell me the screen was missing its subject.

That's the actual fix, and it's not "test on device before claiming done", though obviously that too. It's that I split the arc into a pure shape function (`buildRaceProgressArc`) and a dumb presentational row that takes plain props, and then built a local page rendering all seven states from fixtures. Improving. Gone backwards. Goal already beaten. Holding steady. Two-point. Week one. Now-only. Ten seconds of looking at it caught a layout bug (`space-between` flinging the two-point case to opposite edges) that no test would ever have flagged.

**Then the analysis found two more things nobody had reported.** The screenshots showed "EASY RUN TREND — 77 (Apr avg) → 146 (now)", and Kit's narrative repeated it as fact: *"Easy is costing you more than it did."* An easy run does not average 77 bpm. The trend maths was correct the entire way down — it was faithfully averaging a corrupt heart-rate row, and nothing between the database and the sentence ever asked whether the number was possible. That's the scariest class of bug in this app: every component behaving correctly, composing into a confident lie.

The same screenshot said "· 6w" for a **six-month** window, sitting next to a bucket labelled "Apr". The same component rendered the same value correctly as "the last 6 months" in its own explanation sheet. One file, one variable, two units. And that sheet still said "your average heart rate on long runs" — harmless until the day before, when we retired the long-run card, after which every single person opening it was reading about the wrong session type.

**What I'd tell someone building this.** If a feature can only be seen behind auth and a paywall, you have not built one feature, you've built two: the feature, and the reason nobody will notice when it breaks. Build the second one first. A fixture page that renders every state is worth more than the test suite for anything visual, because the failure mode of visual work is *looks wrong*, and no assertion has an opinion about that.

And the smaller one: I now have a test that asserts on **rendered HTML** rather than on props, specifically because the rings-and-read pairing was declared in a comment while the markup drew two bordered boxes. A comment cannot be asserted on. A border can.

**Numbers:** 1552 tests across 176 files, exit 0. `verify:parity` identical across 2,916 generated plans (none of this touches the engine). Three new test files, each proven to go red against the exact regression it guards before being trusted green. Two byte-identical copies of a `formatTime` function retired into `lib/format.ts`.

---

## 2026-09-12 — FMT-02 · The unit bug nobody would ever report

**Shipped:** the Strava panel renders distances in the runner's own unit instead of hardcoded kilometres.

**Dev learning:** Four render sites built distance strings by hand — `thisWeekKm.toFixed(1) + 'km'` and friends — while `lib/format.ts` has owned that job since ADR-015. The item named three of them. The fourth, the activity rows, turned up only because I opened the file rather than working from the ticket. A ticket written from a bug report describes what someone *noticed*, which is a subset of what is wrong, and the subset is not random: it is the part that was visible.

**Product/creator learning:** A runner on miles was shown kilometres labelled as their own unit. Nobody would ever report this, because the number looks plausible — an 8 km week reads as a believable 8 mile week. Wrong-but-plausible is the kind of wrong that survives, and it is the reason a single formatting owner is worth having at all.

**AI-building learning:** I nearly widened the fix to the pace tile, which hardcodes `/km` in the same component and is wrong for the same runner. I filed it as FMT-03 instead, because `formatPace` is per-km by construction and converting pace is not a string swap. Two defects that look identical on screen can sit on opposite sides of a scope line, and the tell is whose code you have to change.

**The honest bit:** This is an admin-only surface — the nav entry was removed at Phase 1 — which is why it sat at P3 for months. Worth being precise that this is why it *waited*, not why it was *acceptable*.

**Postable?:** no — too small to carry a post on its own, but the "wrong but plausible" line is reusable.


## 2026-09-12 — FMT-03 / SESSION-COLOUR-TT-01 · I filed three things I could have fixed

**Shipped:** the Strava panel speaks the runner's units, a 5K time trial stops rendering as intervals, and a third item was examined and declined rather than left open.

**Dev learning:** Both fixes were bigger than the tickets I wrote for them. FMT-03 looked like one hardcoded "/km" in a tile. It was the *fourth* surviving copy of the pace-formatting rule — and `lib/format.ts`'s own comment named `strava.ts` as one of the four that FMT-01 was supposed to delete. FMT-01 removed three and left the one in the file it had named. Then `paceAtHR` turned out to be a fifth, hiding as a data function: it formatted "5:30" internally and left the caller to append the unit, which is how a measurement quietly becomes a display.

**Product/creator learning:** The colour one is a small thing that says something true. Every `type: 'hard'` session in the product is a 5K time trial — 672 of 672 — and they rendered in a colour whose key is literally `intervals`. A time trial is one continuous maximal effort. The colour was making a claim about the shape of the session, and it was wrong, on a screen where colour is the only thing a runner reads without reading.

**AI-building learning:** The real lesson isn't either fix. The founder pulled me up because I had added five items to a list he'd asked me to clear — I kept finding adjacent problems and *filing* them, which felt like diligence and was actually deferral. Three of the five I could have finished in the time it took to write the backlog entries. His standing instruction already said so: file only what needs a board, new data, or a founder decision. I had been treating "I found something" as sufficient reason to file.

**The honest bit:** The two that genuinely were his to decide, I should have asked in the same breath rather than routing them to a board that meets when I convene it. When I finally asked, both were answered in one message, and both were closed the same day.

**Hook material:** I found five problems while fixing seven. Three of them I could have fixed on the spot and filed instead — which looks like thoroughness and is just a slower way of not doing the work.

**Postable?:** yes


## 2026-09-12 — TREND-DIRECTION-01 · The sentence was wrong in both directions, and about the wrong run

**Shipped:** Kit stops telling runners their easy running got easier when it got harder, and stops describing long runs as easy ones.

**Dev learning:** The Coaching Board made the regression case binding — "a surface that can only speak when the arrow is up is marketing" — so I designed it first, expecting to find silence. I found a live false statement. One hardcoded line said *"Easy is easier than it was — {earlier} down to {now}"*, guarded only by the presence of a model gloss. The gloss is produced whenever `hrIsTrending`, and that is `Math.abs(hrDeltaBpm) >= 4`. **Absolute value.** A runner whose easy heart rate had risen four beats was told "Easy is easier than it was — 147 down to 152", contradicted by its own two numbers.

**Product/creator learning:** Then it turned out the subject was wrong too. The sentence said "Easy" while being fed the trend for `session_type: 'long'` — and a card labelled "Easy run trend" renders directly beneath it from a different cohort with different numbers. Two numbers, one name, on the same screen. Neither fault was visible from the sentence; both needed following the data back to where it came from.

**AI-building learning:** My own first fix was bad and I threw it away. It patched grammar with `.replace('they was', 'they were')` — string surgery on my own output, which is a tell that the structure is wrong. Subject, verb and pronoun now travel together in one table. The deeper lesson is that this line was an inline template literal inside a React component, which is precisely why it was untestable and stayed wrong for months; it is a pure function with nine tests now.

**The honest bit:** A binding condition I was initially inclined to treat as ceremony is what found this. I had written "design the regression case first" into the board record myself, and if I had skipped it — built the happy path and moved on — the false sentence would have shipped into a redesigned flagship screen with more prominence than it had before.

**Hook material:** We built a coach that told runners they were getting fitter when they were getting slower. The bug was one `Math.abs`.

**Postable?:** yes

## 2026-09-12 — UX-WIZARD-01 · Building a control and then refusing to show it

**Shipped:** the weekday cap has one owner and a per-day model behind it. The control that uses it is written, tested, and deliberately not rendered.

**Dev learning:** The item was held purely on timing, so the first job was re-measuring every number in it rather than trusting a fortnight-old entry. The case had got worse while it sat: plans containing a weekday session longer than the runner's stated cap went from a filed 54% to a measured 77.3%, and the worst case from 54 minutes to 83 against a 30-minute cap. Someone who told us they have half an hour on weekdays can be handed an eighty-three-minute session.

**Product/creator learning:** I built the per-day control, clicked through it, and then took it back out. With the cap still derived as the minimum of the days, a runner setting Tuesday 30 and Thursday 90 gets 30 — byte-identical to what they get today. The control would have looked like a feature and changed nothing. That is the same defect as a design token nothing consumes, which this repo has now deleted four times; it is not better because it is visible.

**AI-building learning:** The accessibility fault came from clicking, not reading. Cycling a day to the same value as the weekday cap left two rows differing by colour alone, with an identical `aria-label` — a screen reader user could not tell an override from a default at all. Nothing in the code looked wrong. I only saw it because I tapped the row twice and the value appeared not to change.

**The honest bit:** the fix was to stop rendering a duration in the default state and render the word "Same", which can never collide with a number. Obvious afterwards. Invisible while writing it.

**Hook material:** Built the control, tested it, clicked through it, then deleted the line that renders it. It would have changed nothing a user receives, and a control that does nothing is worse than no control.

**Postable?:** yes


## 2026-09-12 — §109 / UX-COACH-01 · Two thirds of the feature already existed, on the wrong screen

**Shipped:** a rule that a progress surface may remember and compare but may not predict, and the design both boards signed off.

**Dev learning:** The founder asked for "where I was, where I am, and what the potential is." I went looking for what it would cost and found that two of the three already ship — the baseline is captured at plan creation, the current estimate has four confidence states — and the card holding them renders on the *Plan* screen while its own header comment says "Coach screen — canonical home". A comment describing an intent nobody implemented. So the expensive-sounding feature was mostly a move, and only the third element invented anything at all.

**Product/creator learning:** That third element is the one the constitution already had an answer for. §44 ruled years of arguments ago that the engine cannot defend a probability — "a 72% chance is fabricated precision" — and a projected race-day finish is the same claim wearing a different number. The honest version turned out to be better product anyway: compare where they were, where they are, and **the goal they chose themselves**. Nobody has to defend a slope, and the runner's own target is more motivating than our guess at it.

**AI-building learning:** I nearly wrote the design from memory. The founder said "do some research on other apps", and the research changed the structure rather than decorating it — WHOOP runs three tiers *across navigation*, and our Coach screen was trying to be all three at once. That is precisely what "seven blocks, no subject" means, and I would have described the symptom without the diagnosis. It also gave us a deliberate divergence worth having: WHOOP compresses into one number, we are forbidden a new composite, so our compression is *linguistic*. Anyone can draw a ring.

**The honest bit:** I told the founder the projection card was on the Plan screen, then had to correct myself when the component's header claimed Coach, then correct that when the render site proved Plan after all. Three statements about one card in ten minutes. The file was wrong, my summary of the file was wrong, and only the render site settled it — which is the same lesson as every other thing I found today, wearing yet another hat.

**Hook material:** A user asked for a feature. Two thirds of it already existed, on the wrong screen, under a comment saying it was on the right one.

**Postable?:** yes


## 2026-09-12 — §108 / UX-POSTRUN-01 · The feature they asked for already shipped, ungoverned

**Shipped:** the numbers that decide whether a runner is told "nailed" or "concerning" finally have a principle and a check.

**Dev learning:** The ticket asked whether four numbers after a run should become one. Two facts killed the question and replaced it with a better one. The four numbers do not exist — the card renders one headline and a tag. And the collapsing being proposed *already happens*: the engine has always weighted HR discipline 0.50, distance 0.25, pace 0.15 and efficiency 0.10 into a single 0–100 score. Someone asked us to build the thing we shipped, because it was never surfaced and never written down.

**Product/creator learning:** The recorded objection had drifted off its target. Hutchinson vetoed collapsing *zone %, RPE and fatigue* — subjective and objective mixed. What actually ships collapses four objective, device-derived axes, and leaves RPE and fatigue out entirely. So the veto was real, correct, and about something else. A ruling written down once gets re-applied later by people reading the summary, and summaries lose the distinction that made the ruling right.

**AI-building learning:** The check I widened caught me while I was writing it. I documented the weights in prose — "HR discipline, 0.50" — and it failed, because it demands the principle name `hr_discipline`, the literal key. That is the correct strictness: a table titled `SCORE_WEIGHTS` mentioned once would otherwise "document" four separate coaching decisions with a single word. I did not have to design a falsification for it; it falsified me.

**The honest bit:** This is the Configuration Singularity bypassed by a file path for the second time, and CLAUDE.md already records the first — "every governance layer this project has, bypassed by a table being in the wrong place." We wrote that lesson down in September after `peakKmByLevel`, and the identical hole was sitting in `lib/coaching/constants.ts` the entire time, because the fix we shipped then was a principle for one table rather than a check that reads every file where coaching numbers live.

**Hook material:** A customer asked for a feature. It had shipped years earlier, was never surfaced, and no document anywhere said why its most important number was 0.5.

**Postable?:** yes


## 2026-09-12 — GTM-SITE-03 · The same sentence, rendered as two different characters

**Shipped:** the founder story has one owner, and the thesis line is a brand constant instead of two hardcoded copies.

**Dev learning:** Two surfaces told the same story in slightly different words — "a plateau that would not move" on the web, "wouldn't move" in the app; comma-joined clauses on one, short declaratives and an em dash on the other. Neither was wrong, and that is the problem: with no owner there was no way to say which was canonical, so any edit made the pair worse in one direction or the other. The fix is not better discipline, it is a constant and a test that fails when someone re-inlines.

**Product/creator learning:** The worst of it was the thesis, "You're trying hard. That's the problem." — the line CLAUDE.md calls the core truth of the whole product. It was hardcoded in both files with *different apostrophe entities*, `&rsquo;` on the web and `&apos;` in the app. The same sentence was rendering as two different characters depending on where you read it. Nobody would report that; you would just feel, faintly, that the app and the site were not quite the same product.

**AI-building learning:** The ticket said "standardise the narrative and the locked strings, not the treatment", and the treatment divergence was the interesting part to leave alone: the web page has a photograph because a charity vetting a stranger needs a face, the in-app note deliberately has none because there the voice is the asset. It would have been easy to "tidy" that into consistency and quietly destroy a decision someone had reasoned about. The entry said, in bold, *that divergence was a decision, not drift* — and the only reason I did not flatten it is that a previous me had written that sentence down.

**The honest bit:** Choosing the canonical wording was a real call and I made it on the record rather than by keeping whichever file I opened first: the app's short declaratives, because the brand voice is "one sentence is better than two", and the web's full stop instead of the app's em dash, because of the founder's no-em-dash call. The app sits outside the em-dash test only because engine labels have a live coupling. A hand-authored founder note has none, so the rule applies.

**Hook material:** Our thesis line existed twice with two different apostrophes. One sentence, two characters, depending which surface you read it on.

**Postable?:** yes


## 2026-09-12 — ZONE-SHEET-01 / UX-SESSION-GLYPH-01 · Two UX tickets, one built, one measured out of existence

**Shipped:** the zone you get taught is now the zone you were shown. And the session-shape glyph was declined, with numbers.

**Dev learning:** Neither ticket survived contact with its own data, in opposite directions. The glyph was specced twice — first off `derived_set`, then "corrected" to `main_set_structure.type`, described as "present on every row". Both false: 21 of 22 catalogue rows are v2 `blocks`, only 8 carry `.type`, and `.type` resolves for 0.7% of real sessions. The zone item asked for a 5-zone *pace* reference, "presentation only" — but zones here are defined purely by heart rate, and there is no zone→pace mapping anywhere in the constitution. Stating one is a coaching claim wearing a UI ticket's clothes.

**Product/creator learning:** The glyph died on one table. Every shape distinction lives inside a single colour: easy, long, race and intervals rows are 100% steady; only quality amber splits. So the glyph's whole job was subdividing amber — and inside amber, the label already says it (100% of progressions, 73% of repeats: "Progressive tempo", "Pyramid", "Cruise intervals"). It would have duplicated the label on 81% of the rows it appeared on. That is the type chip we removed from the same row six days ago, wearing a different shape.

**AI-building learning:** I found the real bug while checking whether the glyph would duplicate anything. Reading the row's code led to the zone sheet, which was still on the pre-§84 `session.type` path the header had been moved off months ago. 837 sessions where the sheet contradicted the header — 549 of them telling a runner their VO2max session was threshold, with the *lower* HR band to match. **The valuable defect was three files away from the ticket I was sent to work on**, and I would not have seen it if I had started by writing the glyph.

**The honest bit:** I nearly built the glyph. It is specced, small, and someone clearly wanted it — and the fastest way to look productive was to ship it. The measurement took twenty minutes and killed it. The second-order cost of building it would have been permanent: another element on every plan row, defended by the fact that it exists.

**Hook material:** Two UI tickets. Built neither as written. One died to a single table showing the colour already said it; the bug worth fixing was three files away and nobody had filed it.

**Postable?:** yes


## 2026-09-12 — §107 / ZONE-BAND-02 · The board asked which number was wrong. Both were, and neither was the point

**Shipped:** beginners stop being prescribed a long-run segment nobody could pace, §107, a new invariant, and a liveness harness that samples plan shapes instead of the top of a list.

**Dev learning:** The board was handed a two-option question — widen the HR target, or narrow the zone label — and rejected both, because the premise was wrong. The card was not contradicting itself; the session was *incompletely described*, and `session.zone` was the only field telling the truth. The proposal on the table was to delete it. It is remarkable how convincing a false binary is when someone hands you two plausible options: the work is noticing there is a third thing nobody wrote down.

**Product/creator learning:** Under the label sat a live text defect. Every beginner on a time-targeted 5K or 10K plan was told, in their final two peak weeks, to run the middle fifth of their long run "at marathon pace: marathon pace". The fallback string was the words themselves. 108 of 108 beginner sessions had it; 0 of 108 for everyone else — a perfect split on the one input that decides whether those paces exist. The engine already *knew*: `buildFallbackPace` returns null for beginners and has a comment saying "no pace segments prescribed". The producer just never asked.

**AI-building learning:** My new invariant failed the build — because the invariant-liveness gate I shipped this morning refused to accept a rule nothing could wake. The gate caught its own author, eight hours later, which is the first time one of these has bitten me rather than something I was reviewing. And chasing *why* it could not be woken found the better bug: the liveness prober sampled the first 14 entries of an ordered grid, so it had never once looked at a non-beginner 5K plan. Twenty-three invariants were sitting in the debt register marked "the harness never builds this shape" when the harness had simply never looked. **Proven wakeable went 33/93 to 57/94 by changing how the sample is drawn, not by writing a single new check.**

**The honest bit:** I wrote that debt register this morning and described the 48 unclassified entries as "the column that should shrink". I did not consider that a third of it might be my sampler. A debt register is only as honest as the measurement behind it, and I had not audited mine before publishing the number.

**Hook material:** A quality gate I shipped in the morning blocked my own commit that evening. Fixing why found 23 checks that had never been tested — not because they were broken, because nothing had ever looked at them.

**Postable?:** yes


## 2026-09-12 — PLAN-LONGRUN-COLOUR-01 · The marketing page promised a colour the app could not produce

**Shipped:** long runs render in `--s-long` instead of easy blue, on every surface.

**Dev learning:** The token was declared in `globals.css`, documented in CLAUDE.md's colour map and specified in `ui-patterns.md` — three places asserting a colour that no generated plan could produce, because the engine models a long run as `type: 'easy'` and every surface coloured by type. That is the fourth time this repo has shipped a declared-and-unreachable thing (`--section-gap`, the decorative config family, D9's `flexShrink`, §97's inert gates). The common factor is never carelessness; it is that **writing a thing down in three places feels like more verification than writing it down in one, and it is exactly the same amount.**

**Product/creator learning:** The homepage's demo data uses `type: 'long'`, so the product still on the marketing site has been showing a purple long run for months while the real app showed blue. We shipped a picture of a feature we did not have. Nobody lied; the demo data and the engine data simply had different shapes, and the one surface anybody screenshots was the one that looked right.

**AI-building learning:** The first test I wrote for this asserted `getSessionColor({type:'easy', role:'long_run'})` returns purple. It passed instantly and proved nothing — it was a test of a lookup table I had just written, in the same five minutes, with the same assumption in my head. The test that is worth having generates a real marathon plan and asserts that some session in it resolves to the colour. **The tautology and the claim look almost identical when you write them; only one of them could have failed.**

**The honest bit:** `ui-patterns.md` called `getSessionColor` the "sole owner" of this mapping. `PlanCalendar` had been indexing `SESSION_COLORS` directly the whole time. A documented ownership claim with no mechanism is just a sentence, and this codebase now has a measurable habit of believing its own sentences.

**Hook material:** Our marketing site showed a feature colour the app couldn't render. For months. The demo data was more correct than the product.

**Postable?:** yes


## 2026-09-12 — SESSION-KM-02 · The fix I was asked for was a no-op, and proving that found the real bug

**Shipped:** §52's own checker can now see a duration-anchored week. The two prescription sites stay open, with a better question for the board than the one that was filed.

**Dev learning:** The item said: swap two `?? 0` sites for the owner already imported in that file. I applied both on a scratch basis and measured before believing it, and the answer was **zero difference** — 2,916 parity cases byte-identical, 648 cohort plans identical. There is a third gate nobody had filed, sitting *inside* the mutation: `if (!lr || lr.session.distance_km == null) continue`. Reaching the logic is not the same as the logic doing anything. Had I shipped the filed fix on its own reasoning, I would have banked a change that reads like a fix, passes every test, and does nothing — the worst possible outcome, because it closes the ticket.

**Product/creator learning:** The real question turned out not to be mechanical at all. The step-back mutation *writes* kilometres, so fixing it means deciding whether a beginner's step-back week says "14 km" in a plan where every other week says "90 minutes", or whether the step-back moves minutes instead. That is a coaching and a voice decision, and no amount of staring at `?? 0` would have surfaced it. The filed item was a description of a symptom wearing the costume of a fix.

**AI-building learning:** My first test for the checker fix was green and worthless. §52's whole block is wrapped in `volume_profile !== 'maintenance'`, and 51% of this cohort classifies maintenance — so the beginner half-marathon plan I reached for was exempt for a reason having nothing to do with the defect. It passed because the code never ran. I only caught it because I had decided in advance that the test had to fail against the old code, and when I reverted the fix it still passed. **Falsification is not a formality you perform on a test you trust; it is the only thing that tells you which test you actually wrote.** Exactly 58 of 621 plans were eligible fixtures.

**The honest bit:** The detector I built to answer this has a self-check printed at the top of every run, because the last one written for this exact item printed a clean table and was wrong. Mine agrees with the sweep on 12,618 sessions it can cross-check. I did not add that because I am careful; I added it because the previous attempt at this measurement was careful too.

**Hook material:** The ticket said change two lines. Changing them altered nothing across 3,564 generated plans. The bug was a third line, in a place nobody had looked, and the real question wasn't code at all.

**Postable?:** yes


## 2026-09-12 — HOOKS-LINT-01 / HOOKS-ORDER-02 · Installing the check that had already proved itself

**Shipped:** `rules-of-hooks` now runs in `npm run verify`, and `TodayScreen`'s empty-plan guard moved below its fourteen hooks.

**Dev learning:** The gate found exactly fourteen violations and every one was in `DashboardClient.tsx`, in the range the backlog had already named. That is the part worth sitting with: the defect had been *written down*, with file and line, the night before, and it was still in the code this morning. A filed bug and a fixed bug feel similar in a backlog and are not remotely the same thing. What actually closed it was a machine that fails the build.

**Product/creator learning:** The fix was to move the return down, not to hoist the hooks up. Hoisting fourteen hooks above a guard means fourteen hooks run on a render that is about to display "Unable to load plan", and every future edit has to remember why they are in that order. Moving one return preserves the intent — *this screen cannot render without a week* — and puts it where React's rules allow it. The cheaper-looking fix would have left a trap for the next person.

**AI-building learning:** Wiring the linter took ten minutes. Making it *usable* took longer and was the real work: the first run reported 23 errors, and 9 of them were `eslint-disable` comments naming rules my hooks-only config does not load. A gate that fails for reasons unrelated to its job gets switched off, so those 9 were not noise to tolerate — they were the difference between a gate that survives and one that does not. `noInlineConfig` turned out to fix both that and a hole I had not consciously set out to close: with it on, nobody can silence this rule with an inline disable in the file it is policing.

**The honest bit:** I found the real crash line while moving the guard, and it was not the hook count. `parseLocalDate((currentWeek as any).date)` calls `.split` on its argument — an absent week threw a TypeError before React's hook-order error could fire. The `as any` meant the compiler had nothing to say about it. I had described this defect twice, in a backlog entry and a registry row, as a hooks-order problem. It was two bugs sharing a line, and I only saw the second one because I had to touch the code rather than read it.

**Hook material:** The bug was filed with file and line the night before. It was still there the next morning. Writing it down is not fixing it; a failing build is.

**Postable?:** yes


## 2026-09-11 — HOOKS-ORDER-01 · The bug was invisible to every gate we have

**Shipped:** Coach stops crashing. `TrendCard` rendered 1 hook in one state and 11 in another.

**Dev learning:** `useCountUp` looks like a value, not a hook. It sat at the bottom of the component below three early returns, and because it internally holds five hooks, the component rendered 1 hook as a skeleton and 11 once live. On Coach it mounts as skeleton while the trend loads and flips to live when it lands — which is React error 310, every time, for anyone with enough history for the trend to return. A custom hook whose name does not start with a visible `use` in the call site's mental model is a trap; the linter has no such blind spot.

**Product/creator learning:** The crash only hit runners with data. Someone new never sees it, because their trend never resolves and the card stays on the skeleton branch forever. The users you accumulate are the ones who find your worst bugs, and they are the ones you can least afford to lose.

**AI-building learning:** I could not reproduce it, and the reason is the lesson. My scratch harness rendered the Coach screen against real production data and it worked — because without an authenticated session the trend fetch 401s, so the card never left skeleton and the hook count never changed. **I was faithfully reproducing the one code path that cannot fail.** An hour of reading diffs found nothing. Then one targeted run of `rules-of-hooks` named the exact two lines in about three seconds.

**The honest bit:** `eslint-plugin-react-hooks` was already installed — it ships with Next — but this repo has no eslint config at all, so that rule had never once run over this code. We have 1,404 tests, 93 constitutional invariants, a property sweep over 16,038 plans, a cohort-shape harness and four commit hooks, and none of them can see a Rules of Hooks violation. I built an invariant-liveness prober this same afternoon to catch checks that cannot fire, and missed that an entire category of check was not installed.

**Hook material:** 1,404 tests, 93 invariants, 16,038 swept plans, four commit hooks. The bug was found by a linter that ships with the framework and had never been run.

**Postable?:** yes


## 2026-09-11 — COACH-NULLWEEK-01 / ERRORBOUNDARY-MESSAGE-01 · The app knew what broke and would not say

**Shipped:** Coach stops dereferencing a week that is not there, and the error boundary finally renders the message it had always been capturing.

**Dev learning:** `getCurrentWeek` ends `return past ?? weeks[0]`, which for an empty array is `undefined ?? undefined`. The Coach block optional-chained `currentWeek` on one line and then dereferenced it raw on the next two — the guard was written, once, and the two lines under it were not. Optional chaining on the first access reads like a decision about the whole block; it is a decision about one expression. Guarded now by `currentWeekGuard.test.ts`, and Coach is the only screen that derives a week and then dereferences it.

**Product/creator learning:** The boundary had captured `error.message` into state since the day it was written and never rendered it. A runner saw "Something went wrong." while the app held the exact sentence naming the fault. It now shows the message, offers **Copy details** (message plus component stack), and names chunk errors specifically — "The app updated while you had it open" — because that is the one case where reloading genuinely is the instruction rather than a shrug.

**AI-building learning:** Both of these were found while hunting a different bug, and only one of them was that bug. The temptation is to ship whatever you found under the crash's banner and call the crash fixed; it was not fixed by either of these. Shipping them on their own merits, and saying so in the commit, is what stopped a false all-clear.

**The honest bit:** An entire evening went on a crash the screen could have named in one line. The first thing I should have fixed was the thing that tells me what is wrong, and it was already three-quarters built.

**Postable?:** yes


## 2026-09-11 — INVARIANT-LIVENESS-01 / SHIP-RECORD-CHECK-01 · Two checks whose whole job is checking the checks

*(Recorded together because they are the same idea pointed at two different
things: a gate you cannot see fail is not a gate.)*

**Shipped:** `npm run invariant:liveness` — breaks valid plans 42 ways and records which of the 93 constitutional invariants wake up. And a commit hook that verifies a ship actually reached the feature registry and this file.

**Dev learning:** I built the obvious version of the liveness prober first, and it was the wrong measurement. Generate 621 valid plans, count which invariants fire, flag the silent ones — except 86 of 93 never fire, and that is precisely what a healthy engine looks like. An invariant is *meant* to be silent. Silence cannot distinguish a working rule from a dead one, so the only honest question is the inverse: can I make this rule fail on purpose? Strip a field, invert the volume curve, make every week a peak, make the long run 90% of the week. 33 of 93 wake. The other 60 are **unproven, not proven dead** — which is a different claim, and writing it down that way is what keeps the number from being quietly read as a pass.

**Product/creator learning:** 48 of those 60 are `unclassified` — nobody has looked yet. That is the column that should shrink, and it only shrinks if it is visible. A debt register with a reason column per row is the difference between tracked debt and hidden debt; the same pattern as the sweep baseline.

**AI-building learning:** The hook is the more embarrassing of the two. I ran the same manual doc audit three times in one day and found a gap every time, told the founder it was clean twice, and then a fourth pass — by ten lines of Python reading git history — found three more ships I had never recorded. The audits were not careless. They were scoped to the items I remembered working on, and I was checking my recollection against docs that came from the same recollection. Two things I got wrong building it: the first cut grepped for the ID anywhere in the file, and passed a feature whose ID happened to appear inside another feature's row — so it now checks the ID is in a row's **first cell** and in a `##` heading, the `/ship` format itself. The second cut read the whole commit message and fired on a commit that *filed* a new open item, demanding a registry row for something deliberately left open. A hook that cries wolf gets turned off, which is the same as having no hook. Tuned against all 48 of that day's ship commits: zero false positives.

**The honest bit:** I shipped the invariant-liveness prober at 18:51 and, ninety minutes later, spent an hour failing to find a crash that a linter shipping with the framework named in three seconds — because that linter had never been configured here. I had just built a tool for finding checks that cannot fire and missed that an entire category of check was not installed.

**Hook material:** 86 of 93 invariants never fire, and that's what healthy looks like. The useful question isn't "did it fire", it's "can I make it fail".

**Postable?:** yes


## 2026-09-11 — GTM-CHARITY-01 / GTM-CHARITY-03 / GTM-SEO-PLANS-01 · Three ships that never got recorded

*(Backfilled the same day, by a hook written to catch exactly this. Recorded as
one entry because the lesson is shared and inventing three separate reflections
would be writing to fill a template.)*

**Shipped:** the charity-runner landing page, the RevenueCat comp fix, and the quality-session structure on the SEO plan pages.

**Dev learning:** The comp one is the pick of them. RevenueCat's webhook is the single writer of `subscriptions`, and `toStatus()` handled seven lifecycle events. A promotional entitlement granted from the dashboard arrives as `NON_RENEWING_PURCHASE`, hit `default`, and the route replied "received" while writing nothing at all. So a runner we had deliberately comped stayed on the free tier and met the marathon paywall anyway. The fix that matters is not the two new mappings — it is that unknown events now record `revenuecat_event_unhandled` instead of returning 200 and doing nothing. A webhook that says "received" and drops the payload is indistinguishable from one that works.

**Product/creator learning:** Open-ended grants had been inheriting the 30-day subscription default, which would have cut a comped runner off around week four of a sixteen-week block. Wood's line in the SLT was that a mid-block cliff is worse than never granting access at all, and she was right — you would be taking the plan away at the point it starts to hurt.

**AI-building learning:** These three went unrecorded for a whole day through three separate manual audits of my own. The audits were not careless; they were scoped to the items I remembered working on, and these were not on that list. The hook that found them reads git history instead of memory, which is the entire difference.

**The honest bit:** I told the founder the doc audit was clean, twice, and it was not. What made it look clean was that I was checking my recollection against the docs, and both came from the same place. The fix was to check the docs against git.

**Hook material:** Three manual audits in one day, all reporting clean, all scoped to what I could remember. The first automated pass found three more in ten seconds.

**Postable?:** yes


## 2026-09-11 — GTM-CHARITY-02 · The qualifier was never in the sentence that mattered

**Shipped:** Co-branding settled as no. The "1+ years' experience" qualifier removed from the stated audience.

**Dev learning:** Not a code change, but the same failure shape as the ones that were. The brand doc had two audience statements — an internal positioning sentence that is purely behavioural, and a demographic sketch underneath it. Only the sketch carried "1+ years", and for months every decision that cited "the stated audience" was citing the sketch. Two docs and a source comment had copied the sketch forward as if it were the positioning. Same class as a numeric living in the wrong file: the authoritative thing and the thing everyone quotes had drifted apart.

**Product/creator learning:** A first-time charity marathoner fits the positioning sentence better than the runner it was written for. They go hard on their easy days with a fundraising page watching. We had been excluding, on a demographic technicality, the people who most exactly match the problem the product solves.

**AI-building learning:** I nearly proposed a reframing of the positioning before reading it. The positioning did not need changing — it was already right, and the fix was deleting six words from a sketch. Reading the authority doc before designing the change turned a positioning debate into a one-line edit.

**The honest bit:** The interesting part is the timing, and it is uncomfortable. Widening this yesterday would have been a lie: the wizard would still have rejected a beginner who answered honestly, and 89% of their marathon plans would still have told them they would not improve. The decision was only available because five beginner defects got fixed the same day, and three of those were found by accident while doing something else. We earned the claim a few hours before making it, which is closer to luck than process.

**Hook material:** We had been turning away, on a technicality in a demographic sketch, the exact people whose behaviour the product was built to interrupt.

**Postable?:** maybe


## 2026-09-11 — SESSION-KM-02 · The checks that never ran, for the people who needed them most

**Shipped:** Four constitutional checks and ADR-012's reshape-confirmation threshold now actually run for beginners. They never had.

**Dev learning:** I went in expecting false alarms and found the opposite. `distance_km ?? 0` on a duration-anchored plan does not make a check fire wrongly, it makes it pass vacuously: `longestKm > cap` is never true when everything reads zero. Four invariants had been silently inert for beginners, and nobody would ever have noticed, because a check that does not fire looks exactly like a check that passes. The worst one was in `reshapeMagnitude` — `beforeKm ?? 0` then `if (beforeKm > 0)` meant a beginner's session could be trimmed without the confirmation tile an experienced runner's identical trim would trigger. That is the incident this app already had once, reintroduced for the cohort least able to spot it.

**Product/creator learning:** The cohort with the least training history was running with the least enforcement. Nothing chose that; it fell out of a null-coalescing operator. It is worth asking, of any system, which users end up in the code path nobody tested — and the answer is usually the ones furthest from whoever wrote it.

**AI-building learning:** Measuring before touching anything cut the work in half and stopped me doing damage. 95.8% of beginner sessions are duration-anchored against 0% for everyone else, and quality sessions are never duration-anchored — so four of the sites on my own list were unreachable, and sweeping them would have been churn with a regression risk attached. The list I wrote confidently yesterday was about 30% wrong, and four minutes of measurement is what corrected it.

**The honest bit:** I could not measure the impact of the two sites I did not fix. My detector reported 0% long-run step-backs for non-beginners, which cannot be true, so the detector is broken rather than the finding. I filed it saying exactly that instead of reporting a zero I did not believe, because a number nobody trusts is worse than no number — and the temptation to write "no measurable impact" and move on was real.

**Hook material:** Four invariants, silently inert for every beginner, for months. They fire on nobody and find zero violations now they run — the engine was right all along, the checks just were not looking.

**Postable?:** yes

## 2026-09-11 — COHORT-SHAPE-01 · The third question nobody was asking

**Shipped:** `npm run cohort:shape` — a regression that can see a population being reclassified.

**Dev learning:** We had two verification questions and needed three. `verify` answers "are these plans valid?", `verify:parity` answers "are they unchanged?", and neither can answer "did the shape of who-gets-what move?" A plan can be perfectly valid, structurally identical, and still have been silently downgraded for most of a cohort.

**Product/creator learning:** The gap was not theoretical. A §81 fix took `volume_profile: maintenance` from 20% to 80% at a 30-minute weekday cap — a +60pp swing, the same magnitude the Coaching Board had rejected five days earlier — and the suite stayed green the whole time: 16,038 plans, zero violations, nothing to see. The founder had to ask.

**AI-building learning:** The harness's first cut understated delivered peak by 30%, because it re-summed `distance_km` and beginner plans are duration-anchored. The check built to catch beginners being misclassified was itself blind to how beginners' plans are stored. I found it because a number looked implausibly low and I pulled on it rather than baselining it — and a baseline captured from a broken measurement is worse than no baseline, because every future run then agrees with the error.

**The honest bit:** The rule I wrote into the file is "never re-baseline to turn a test green". I wrote it because I do not trust future-me not to. It has already been re-baselined twice today, both times with the moved numbers stated in the commit.

**Hook material:** 16,038 plans, zero violations, and 60% of a cohort had been quietly reclassified. Green does not mean unchanged.

**Postable?:** maybe


## 2026-09-11 — §106 / MAINT-PROFILE-01 · The investigation dissolved its own question and found the real bug underneath

**Shipped:** A plan can no longer prescribe a peak week below the volume the runner already runs. Plus the 18 numerics that caused it, moved into the config file everything else lives in.

**Dev learning:** The most consequential number in a plan — peak weekly volume — was set by a table in `lib/plan/length.ts`, outside `GENERATION_CONFIG`. So no principle explained it, the test that checks every numeric has a principle could not see it, and the hook that convenes the coaching board on doctrine edits did not fire on that file. Every governance layer this project has built, bypassed by a table being in the wrong file. That is a more interesting failure than the bug it hid.

**Product/creator learning:** A runner on 100 km a week was handed an 18-week marathon block peaking at 73. What makes it worth writing down is that nothing was broken downstream: the engine noticed the peak was below the start, correctly refused to call it a build, labelled it maintenance and explained why in plain English. The honesty machinery worked perfectly on a plan that should never have been built. Honest output is not the same as correct output, and a system that is good at explaining itself can talk you out of noticing.

**AI-building learning:** I wrote the board brief and then had to withdraw three of its four findings during the mandatory conflict scan, because the constitution already answered them — §45 literally says "this principle wins" about the conflict I was about to report as unresolved. That scan is the single highest-value step in the process and it works by making you read the thing you are about to contradict. Then the engine caught what the scan still missed: my fix collided with §79, a principle I never checked, and an invariant failed the build rather than a runner finding out.

**The honest bit:** Three separate claims I made to the founder today were wrong and I corrected all three in writing — "it feeds the confidence score" (nothing reads it), "49.8% of plans are exempt from five invariants" (each exemption is the principle's own remedy), and my expectation that fixing the 0 km bug would move the classification (measured: it does not). The pattern is the same every time: I reason from the code I have read to the code I have not, and the fix is always to go and measure.

**Hook material:** 100% of time-targeted marathon plans — 54 of 54 — were classified "not a build". A distinction that never varies isn't a distinction.

**Postable?:** yes


## 2026-09-11 — MAINT-LABEL-01 second pass + SESSION-KM-01 · The engine told runners their long run was 0 km

**Shipped:** A single owner for "how far is this session", and three lies removed from the notes runners read.

**Dev learning:** `distance_km ?? 0` looks like a safe default and is an assertion. It says "this session covered no ground", and a beginner's plan is duration-anchored — every session has a duration and no distance — so on those plans it is wrong for every session. The engine already had the right expression, `distance_km ?? duration_mins / minPerKmEasy`, written out by hand in six places. The wrong one was written out in fourteen. Same question, two answers, no owner.

**Product/creator learning:** The worst thing it produced was a sentence: "Peak long run 0 km is below the 17.9 km floor." That went to a third of half-marathon and marathon runners on a time goal, about a 2h12 long run. Nobody would report it, because a plan that calls itself constrained is doing something people half expect.

**AI-building learning:** I fixed it expecting the maintenance classification to move, and measured: it did not. 49.8%, per-distance identical. My hypothesis was wrong — the false 0 km was producing a false REASON, not a false verdict; those plans were hitting other triggers too and were correctly classified all along. If I had shipped on the hypothesis I would have written a commit message claiming a cohort shift that never happened. The measurement contradicting me is the most useful thing that happened today.

**The honest bit:** I reported the copy half of this item as done this morning. It was not — I rewrote one variant of five and never read what the other four actually emit. The way I found out was generating 621 plans and printing the distinct note texts, which takes about four minutes and which I should have done before saying "done" the first time. Two more defects fell out of the same print: database field names in the remedies, and a "defer your race" suggestion that told runners with exactly enough runway to change nothing.

**Hook material:** A 132-minute long run, measured as 0 km, on 45 of 135 plans. The floor it failed was 17.9.

**Postable?:** yes


## 2026-09-11 — UX-PLAN-MOVE-01 · The constraint I wrote down was wrong, and the real bug was next to it

**Shipped:** The `↕ Move` pill on Plan rows is a quiet `↕` handle. And the type chip that was clipping every session label to "Easy…" is gone.

**Dev learning:** `flexShrink: 1` does nothing when the sibling has `flex-basis: 0`. The label was `flex: 1 1 0%`, so it claims only leftover space and there is never negative free space for the chip's shrink factor to act on. A previous fix (D9) set that shrink factor, wrote a five-line comment explaining that the label is primary and the chip should yield first, and changed nothing. It read as solved for months.

**Product/creator learning:** The chip said "Easy run — Zone 2" next to a label saying "Easy run — Zone 2". The row spent two thirds of its width repeating itself and truncated the original to pay for it. Nobody reported it, because a row that says "Easy…" still looks like a design decision.

**AI-building learning:** I nearly designed around a constraint I had invented. My own backlog entry said the old move handle "caused a documented incident" and reverting would "re-open a real defect". Reading the actual record: the incident was the ENGINE auto-applying a day swap, and the affordance change was one of three fixes — the other two (a staged move plus a confirmation row) are what made it safe. I had conflated the handle with the confirmation. That is the third time this week a confident note of mine sent work the wrong way, and the only defence that worked was opening the code instead of trusting the doc.

**The honest bit:** I only found the truncation because I could not reach the Plan screen in a browser without auth, so I built a throwaway page that renders `PlanCalendar` with a generated plan. If I had shipped on a diff read, the move handle would have been fine and every session label on the demo screen would still say "Easy…". The scratch page took ten minutes. It also immediately threw, because my hand-written fixture used invalid enum values and the §55 validation I shipped this morning caught it — so I used a real grid input instead, which is the lesson I keep relearning.

**Hook material:** 65.7% of 5,280 generated sessions rendered a chip that was a word-for-word duplicate of the label beside it. The duplicate took 115px of a 172px row. The original got 51.

**Postable?:** yes


## 2026-09-11 — UX-AUTH-02 · Two bug reports that were both about the same thing

**Shipped:** Sign-in shows Apple, Google and "Use email instead"; the email block opens and closes on one toggle. Plus the Google button got a visible outline back.

**Dev learning:** `--line` is 8% alpha. That is plenty when the FILL already separates two surfaces — a white card on the warm `--bg`. It is nothing when the fills match, which is exactly what a `--card` button on a `--card` card is. The border stops being a definition edge and becomes the only thing saying a control exists. The codebase already knew this: the redeem-code input is white-on-white and uses `--line-strong`. Nobody had written the rule down, so it was rediscovered by a founder squinting at a phone. It is in `ui-patterns.md` now, next to the token.

**Product/creator learning:** Both reports landed within minutes of the ship, and neither was caused by the change — the outline was always too faint, and the disclosure was always one-way. Simplifying the screen is what made them visible. Removing clutter does not just improve a screen, it exposes what was already wrong with what is left.

**AI-building learning:** I built a one-way disclosure without noticing. Not because it was hard, but because I only ever tested the direction I was building — open it, look at it, ship it. The browser check I ran genuinely verified three states (collapsed, disclosed, sign-up) and still missed it, because "can I get back?" was not one of the states I had thought to name. The second time round I read the accessibility tree after collapsing, to confirm the controls were gone rather than merely hidden.

**The honest bit:** The fix for the toggle was better than the thing I originally built — one button whose label flips, standing where the "OR" divider was and doing that job too, so the divider could go. That is a simpler screen than the one I shipped an hour earlier. The bug report improved the design.

**Hook material:** "Continue with Google has lost its outline" — it never had one worth the name. `rgba(26,26,26,0.08)` at half a pixel, on white, on white.

**Postable?:** yes

## 2026-09-11 — Critical path opening run · UX-BEGINNER-01, MAINT-LABEL-01, UX-REDEEM-01 + the cohort-shape harness

**Shipped:** A beginner can now answer "0" honestly and get a plan; a first-time marathoner is no longer told their plan "maintains current fitness rather than building it"; the charity code box stops demanding a format the parser never wanted. Underneath them, `npm run cohort:shape` — a regression that can see a population being reclassified.

**Dev learning:** We had two verification questions and needed three. `verify` answers "are these plans VALID?", `verify:parity` answers "are they UNCHANGED?", and neither can answer "did the SHAPE of who-gets-what move?" A plan can be perfectly valid, structurally identical, and still have been silently downgraded for 60% of a cohort — which is exactly what a §81 fix did the same morning, with 16,038 plans and zero violations reported the whole time.

**Product/creator learning:** 89% of beginner marathon plans were labelled "maintenance" and told the runner so. Measured, not guessed: 320 of 360, including a parkrun-er with a 24-week runway. A volume ratio that says nothing about whether someone will finish had been quietly made into a sentence about whether they will improve, and shown to the exact cohort going from 5km a week to 26.2 miles.

**AI-building learning:** The harness's first cut understated delivered peak volume by 30% because it re-summed `distance_km`. Beginner plans are DURATION-anchored: `duration_mins` set, `distance_km` null. So the check built to catch beginners being misclassified was itself blind to how beginners' plans are stored. I found it only because a number looked implausibly low and I pulled on it instead of baselining it. A baseline captured from a broken measurement is worse than no baseline, because it makes every future run agree with the error.

**The honest bit:** The rule for re-baselining is "say which number moved and why, in the commit". The rule I actually need is the one underneath it: never re-baseline to turn a test green. I wrote that in the file because I do not trust future-me not to.

**Hook material:** 320 of 360 beginner marathon plans told the runner the plan "maintains current fitness rather than building it". They are training for their first marathon.

**Postable?:** yes


## 2026-09-11 — UX-AUTH-01 + UX-AUTH-03 · Two ways out of the app, both of them wrong

**Shipped:** Links to the legal pages now open in SFSafariViewController instead of replacing the app with the marketing site, and a failed password reset says which of three things actually went wrong instead of claiming the link is invalid.

**Dev learning:** `target="_blank"` has no meaning inside a Capacitor webview. There is no second tab, so Capacitor's UI delegate loads the navigation into the same webview — the app becomes the marketing site, header and all, with no back button. Second: `preventDefault()` after an `await` does nothing. My first version dynamically imported `@capacitor/core`, checked `isNativePlatform()`, then called `preventDefault()` — by which point the browser had already begun navigating, so the page loaded AND the sheet opened. The static import is not a style choice, it is the fix, so there is a test asserting the guard precedes the first `await` rather than a comment hoping someone reads it.

**Product/creator learning:** The worst error message is not the unhelpful one, it is the confidently wrong one. "This reset link is invalid or has already been used. Request a fresh one and try again" was doing real damage: the link was fine, the instruction was impossible, and following it produced the identical failure forever. Nobody would have reported that as a bug. They would have decided the app was broken and stopped.

**AI-building learning:** I nearly built the wrong fix twice today. On the decimals item I nearly rounded every prompt distance to match the card, which would have made Kit narrate a shortfall that never happened; an old test with its reasoning attached stopped me. On this one I nearly rebuilt the whole recovery email on our own Resend sender to remove a dashboard dependency I cannot verify — real, tempting, and a new unauthenticated email-sending endpoint two weeks before a launch. The discipline that saved both was the same: write down what the change would cost before writing the change.

**The honest bit:** I cannot verify the Supabase template setting. Not with the service-role key, not with the Management API tools I hold. So half of UX-AUTH-03 is a runbook and a founder's two minutes, and I have to say so rather than mark it done. The code half exists precisely because the setting is unverifiable: if it is wrong, the runner now learns something true rather than being sent round the loop.

**Hook material:** On iOS, PKCE password reset cannot work. Not "usually fails", cannot. The request is made inside the Capacitor webview and the email opens in Safari, so the verifier is in one browser and the link in another, on the same phone, every time.

**Postable?:** yes


## 2026-09-11 — BUG-KIT-DECIMALS-01 · The AI layer is a display surface, and nobody had written that down

**Shipped:** Kit now quotes the same distance string the runner is looking at on the card, via a new single owner (`promptDistanceFormatters`) that splits prescribed distances from measured ones.

**Dev learning:** The bug was sitting inside a comment that argued for it. `formatDistanceForPrompt()` said *"Do not use this for anything the user reads directly — that is formatDistance's job."* That sentence is true about the function and false about the system: the model repeats the number, so everything handed to it is read directly. ADR-015 has said for months that `lib/format.ts` is the sole owner of every distance string a runner reads, and the exemption was carved without noticing it made the model a second owner. Also: nine prompt builders each declared a byte-identical `const fmtDist = …` closure. That is not nine copies of a trivial line, it is nine independent places to get a classification right.

**Product/creator learning:** "Is it a display surface?" turned out to be the wrong question. The right one is "does the number reach a human's eyes?" — and once you ask it that way, the answer for an LLM prompt is obviously yes and always was.

**AI-building learning:** The honest part of this fix is the part I nearly got wrong. The instinct was "make every prompt distance match the card." An existing test stopped me — it asserted the raw behaviour and carried the reason in a comment: quote a 5.5km session as "6km" beside an actual of "5.5km" and the model narrates a shortfall that did not happen. Its own few-shot example is literally *"Cut it 2km short."* So the rule ended up conditional on context, not on file: a prompt that REFERENCES a prescribed distance quotes the card, and a prompt COMPARING planned to actual keeps both sides at the same precision. A test written by a past version of me, with its reasoning attached, was worth more than my first instinct.

**The honest bit:** I asserted the root cause before measuring it, and the measurement script was wrong twice before it produced a number — first the wrong export name, then a pinned cohort start that made every input refuse ("-8 weeks is not enough preparation for a 5K", 0 plans, and it would have reported cheerfully). That is the fourth time this week a measurement script has produced confident nonsense. The habit that saves it is printing the FIRST exception instead of silently `continue`-ing.

**Hook material:** 50.4% — over half of every prescribed session distance the engine produces formatted differently for the AI than for the screen. 13,093 of 25,959 sessions across 621 plans. Not an edge case: every half-kilometre session, and half of them are.

**Postable?:** yes


## 2026-09-11 (night) — TIER-ENFORCE-01 / SEC-08 / §81 / §104 · Four items, and my own tooling kept catching me
**Shipped:** The distance paywall reaches the server; SEC-08 finished to 14 routes; §81's obligation extended to structured sessions; §104 gave 10K a second race-specific session.

**Dev learning:** Three separate times today a measurement script of mine printed a confident, clean-looking table from plans that had never generated, or had generated from inputs the engine silently discarded. The last one was the worst: `fitness_level: 'advanced'` is not a value (the union is beginner/intermediate/experienced), `recent_quality_training: 'occasionally'` is not a value, `hard_session_relationship: 'regularly'` is not a value — and the engine accepted all three, matched none of them, fell to defaults, and produced 611 perfectly valid plans. I had already published numbers from that grid in a coaching principle. §55's own stated job is "reject nonsense values"; it validated numeric ranges and nothing else. It does enums now.

**Product/creator learning:** The Coaching Board's value today was almost entirely the conflict scan, twice, and both times it found that a decision had already been made. For the ramp fix, §12's boxed correction from August had already ruled the identical mechanism wrong in another part of the engine. For the weekday cap, §81 already said the obligation "applies to the long run and to structured sessions alike" and the engine applied it to the long run only — a principle honoured at 50%. Neither was a new judgement. At 100+ sections, the scan is not ceremony; it is the only way to know whether you are legislating or just re-legislating.

**AI-building learning:** My conflict scan looked up "§81" and got the wrong section, because §55, §81 and §82 each appeared TWICE in the constitution. I put a brief to the board asserting §81 said something it does not say. The document that exists to prevent contradictions had three internal collisions, and nothing checked. It does now. The broader lesson for building with an assistant: I resolve principles by number the way code resolves a symbol, and a duplicate identifier in a prose document fails silently in exactly the way it would fail loudly in a compiler.

**The honest bit:** I recommended TIER-ENFORCE-01 to the founder as the next thing to do, having written "❌ Do not wire the server gate yet" into the backlog myself that morning, with two good reasons. He picked it off my list. I only noticed when I opened the entry to start work. Then my own new test caught a fail-open in the gate I was writing — `tier !== 'free'` grants a paid distance to any unrecognised tier string. Four separate times today, the thing that caught the error was a check, not me.

**Hook material:** The engine accepted `fitness_level: 'advanced'`, silently ignored it, and built 611 valid training plans. I had already published numbers from them.

**Postable?:** yes

---

## 2026-09-11 (evening) — §100 / SEC-08 / V2-POLISH-01 · Three items, and a table that was never there
**Shipped:** The week after a safety trim now ramps from what the runner actually ran (§100); RLS rollout tooling plus five routes converted; card elevation on the 16 cards that were actually standalone.

**Dev learning:** The best find of the day came from cross-referencing code against production rather than reading either. `daily_coach_notes` was queried by a live route, committed as a migration in April, recorded in the applied-migrations ledger as done, and absent from the database. Both call sites discarded the error, so the cache never hit and every app open paid for a fresh model call. The ledger is appended by hand: it records an INTENTION, and the session-start hook only warns about migrations MISSING from it — the opposite direction to the one that broke. Also found `core.hooksPath` unset, so the committed pre-commit hook was not the one running; the local copy was 31 lines behind and the missing lines were a security check. Two guards, both believed to be on, both off.

**Product/creator learning:** The coaching board's value was the conflict scan, not the debate. Before anyone spoke, scanning the constitution turned up §12's boxed correction from August: the injury cap had made the *identical* mistake — capping a week against the curve's unadjusted previous value, so it never compounded — and it accounted for 394 of 981 violations. So the ruling was not a new judgement, it was applying a decided one. Then §52 supplied the amendment: my fix drove two 11.5 km easy runs to the 4 km floor, and §52's own Case 04 from April already forbade exactly that shape, in nearly those words. Eighty principles is past what anyone holds in working memory, which is the whole argument for scanning rather than reasoning.

**AI-building learning:** My measurement harness generated 900 plans and reported "0% breach" with total confidence. It had actually generated zero — the input was missing `age` — and then, once fixed, generated 611 *degenerate* plans, because the engine takes `days_available` and I passed `days_per_week`. Mean peak week: 6.49 km, for runners doing 15–50. Both runs printed a clean, plausible-looking table. A measurement script is a check like any other, and a check that has never been seen to produce a non-trivial result has not been verified. I only caught it because 6.49 km is obviously wrong to anyone who runs.

**The honest bit:** I gave the founder a list an hour earlier with "RAMP-BOUNCEBACK-01 (P1)" on it. That shipped on 2026-09-06. I had taken the name from a stale memory file and the status from a different, still-open item, and welded them into one confident line. He picked it off the list and I had to correct it before starting. Third time today that something I wrote down myself sent work in the wrong direction.

**Hook material:** The cache had never worked. The comment above it said "this only pays the AI cost once per user per day" and had been false since April.

**Postable?:** yes

---

## 2026-09-11 (later still) — GTM-CHARITY-04 follow-ups · The risk I filed was fake and the real one was in the outbox
**Shipped:** One owner for tier resolution, the third charity redeem door, and a stop on telling comped runners their trial had ended.

**Dev learning:** The order `admin → subscription → grant → trial → free` existed in three places: the server function, an OR-chain in the client, and a private copy inside the test that was supposed to be guarding it. So the test asserted its own copy was right. It could not have caught either real producer drifting, and I only noticed because I went to verify a filed risk by hand and had to re-derive the rule to do it. The tell is generic: if a test file contains a reimplementation of the thing it tests, it is documentation wearing a test's clothes. Also learned that a required function argument is a better guard than a defaulted one when the dangerous outcome is the default. Making `decideTrialEmails`' new argument required meant `tsc` handed me every call site instead of me hoping I had found them.

**Product/creator learning:** The filed risk ("a RevenueCat event could overwrite a charity grant") was written from an earlier design where grants lived in the subscriptions table. They never shipped there, because a CHECK constraint rejected them. So the scary-sounding item was already impossible, already tested, and had been sitting near the top of the list looking urgent. Meanwhile the actual defect was that we would have emailed a Make-A-Wish fundraiser "3 days left." and "Trial ends today" while they held a 90-day gift from the charity. Nobody filed that one, because nothing was broken in a way anything could detect. The in-app screen I had filed as P3 was the small half of it; the outbox was the big half.

**AI-building learning:** Falsification testing paid for itself twice in one session. I swapped the grant and trial checks in the real producer expecting the suite to go red, and it stayed green. Not because the test was fake this time, but because every existing case paired a live grant with an EXPIRED trial, and the two orderings only disagree when both are live. That case is the most likely real arrival: a charity runner who installs and redeems on day one. A suite can be genuinely well written, pass honestly, and still have a hole shaped exactly like your most common user. You find that by breaking the code on purpose, not by reading the tests.

**The honest bit:** I wrote the fake risk. It sat in the backlog for a day with a warning triangle on it, and the founder reasonably asked me to fix it first because it looked like the scariest thing on the list. Second time this session that a confident note of mine sent work in the wrong direction.

**Hook material:** The bug I had filed was impossible. The bug I had not filed would have emailed a charity's fundraisers "Trial ends today" while they held a 90-day gift.

**Postable?:** yes

---

## 2026-09-11 (late) — GTM-SITE-02 item 3 · The blocker I had written down was not real
**Shipped:** The homepage stopped describing the product and started showing it. Three hand-written CSS imitations of app surfaces are gone; it now renders the real `SessionCard`, `CoachNoteBlock` and `ZoneRings`, each sitting under the claim it proves.

**Dev learning:** I had parked this item behind a paragraph I wrote myself: "`SessionCard`, `ZoneRings` and `TrendCard` are `'use client'` with event handlers, so they cannot render inside a server-component marketing page." First thing I did this time was check. `head -1` on all three: `SessionCard` and `ZoneRings` have no `'use client'` directive at all, and `SessionCard`'s only handler prop is optional. The item was blocked on a fact nobody had verified, and the workaround I had specified (build shared presentational wrappers) would have added a third layer to solve a problem that did not exist. The actual diff deletes 174 lines and adds one import block. Separately: a `subgrid` child with no `grid-template-columns` gets an implicit `auto` column that sizes to **max-content**, so `SessionCard`'s `white-space: nowrap` detail line grew the track to 321px inside a 272px box. `minmax(0, 1fr)` is the fix, and it is the grid equivalent of the `min-width: 0` you already have to remember for flex children.

**Product/creator learning:** Putting the real component on the page found a content bug within about ninety seconds of it rendering. The hand-built phone mockup said "8 km" and the real card, right next to it, said "8km" — because `formatDistance()` emits no space and ADR-015 makes that function the only thing allowed to produce a distance string. Two pictures of the same session, disagreeing, on the page whose entire job is to say "this is what the app looks like". Nobody would have caught that by reading either file. The drift only becomes visible when you put the copy and the original side by side, which is an argument for never having a copy.

**AI-building learning:** My own guard test passed its first falsification, and it took deliberately trying to break it to notice. I wrote a check that PhoneFrame still contains the same distance as the homepage card, changed the session card back to "8 km" to prove the test would go red, and it stayed green — because the file states that distance **twice** (a 56px hero and the card), so "the correct string appears somewhere" was still true while one of the two had drifted. A check that confirms a good thing is present is not the same as a check that confirms the bad thing is absent. Rewrote it to scan every renderable line for `\d\s+km`, re-falsified both paths, both went red. I have now been burned by this exact class enough times that "green" means nothing to me until I have seen the test fail on purpose.

**The honest bit:** The parking note was mine, written confidently, and it was wrong in the one sentence that mattered. It cost this item weeks of sitting at the bottom of a list labelled "needs a clean run" when it was the smallest of the six. The lesson is not "check your assumptions" in the abstract — it is that a *written-down* assumption is more dangerous than an unwritten one, because the next person (me) treats the document as settled fact and re-reads the plan instead of the code.

**Hook material:** The task was blocked for weeks on a `'use client'` directive that was not in any of the three files. Checking took one `head -1` and the fix deleted 174 lines.

**Postable?:** yes

---

## 2026-09-11 (eve) — GTM-SITE-02 · Four times I said it was done, and four times the next question found a bug
**Shipped:** A pricing page that did not exist, an about page, the product moved above the fold, and a fix for every marketing page scrolling sideways on a phone. Plus a charity access-code system earlier the same day.

**Dev learning:** `transform: scale()` does not change layout. I "fixed" a 340px device frame overflowing a 375px viewport by scaling it, took a screenshot, and the page overflowed by *exactly* as much as before, because the element kept its layout box and only its painting shrank. I nearly accepted the identical screenshot as a different result. The real culprit turned out not to be the frame at all: the site header (wordmark + three nav items + a 104px CTA pill) came to 433px at a 375px viewport, and I had personally tipped it over an hour earlier by adding a third nav item. Three wrong fixes in a row — scale, then shave type and gutters from 433 to 395 to 379, then assume the CTA was a sibling of the nav group when it was inside it — and every one of them was only disproved by *measuring document width against viewport width* rather than looking.

**Product/creator learning:** The founder found a competitor he liked and described it as "busy, and I like how it pops". The instinct underneath was right and the stated cause was wrong. What actually worked on that site was rhythm and evidence: the app visible in the first viewport, features explained in a sentence each rather than listed as nouns, a pricing page that elevates the paid tier. What did *not* transfer was the gradients and neon, because our entire differentiator is being the calm one in a loud category, and arriving shouting with 1/1000th of their proof answers a question we do not want asked. The board's reframe was the whole value of the review: **calm is an asset, austere is a liability, and we were austere.** Those are different, and the difference is visible effort.

**AI-building learning:** I kept declaring completion and being wrong. The pattern was always the same shape — I verified the thing I had just written rather than the thing a user would meet. So the last pass was not another test run, it was an audit designed to *find* problems: crawl every route from `/` and check the sitemap resolves, then measure horizontal overflow across 33 page-by-width combinations in iframes, then re-run the full gate and generation parity. That found nothing, which is the first time all day I have been able to say "it is correct" and mean something by it. **A green suite you already expected to be green is not evidence; a check built to fail is.**

**The honest bit:** Four separate times today the founder asked "is it done?" and the answer turned out to be no. Wrong logo, dead countdown format, invisible nav, 15% of hard sessions rendering nothing, a comp path that acknowledged events and wrote nothing, a pricing claim that was simply false, and a header I broke while fixing something else. None of it was found by tests. All of it was found by looking at the rendered thing, or by someone asking one more question.

**Hook material:** I shipped a fix, screenshotted it, and the screenshot was identical to before — because `transform: scale()` changes what you see and not what the browser measures. The bug was somewhere else entirely, and I had caused it myself an hour earlier.
**Postable?:** yes — "the screenshot looked identical and I almost called it fixed" is a real lesson about verification, and "calm versus austere" is a genuinely reusable distinction for anyone building a challenger brand.

## 2026-09-11 (pm) — Marketing site · A partner sent us an audience, so I audited the shop window and found the mannequin was wearing last season's logo
**Shipped:** The homepage device shot rebuilt against the real app screen (five defects), hard sessions on the plan pages made followable, every em dash removed from the site and banned by a test, a content-accuracy pass, and a new landing page for charity-place marathon runners.

**Dev learning:** The nav bar "not showing" in the phone mock was a real mechanism worth keeping: the content div is `position: relative`, the nav below it is `static`, and positioned elements paint above non-positioned ones. So when an earlier commit added two cards and pushed the content ~32px past a fixed `CONTENT_H`, the overflow painted straight **over** the nav. The file's own comment said "if the composition grows, raise CONTENT_H" and of course nobody did. I fixed it with `overflow: hidden` rather than a new measurement, because the fade already implies the screen scrolls, so clipping is the honest behaviour. **A crop maintained by memory is not a crop.** Second one: I nearly wrote a second formatter for session steps on the plan pages, then remembered this repo shipped 859 paceless sessions in August from exactly that (two resolvers, one updated). Exported `stepParts()` from the existing owner instead and proved the old sentence output byte-identical across all 62 sets.

**Product/creator learning:** The founder flagged three problems on the phone mock. It had five. I then found a sixth on the card sitting next to it, and a seventh in the facts band. The two he could not have known: the logo was a hand-rolled span that had quietly diverged from the real `<Wordmark/>` (lowercase, wrong weight, no NN-moss), and "1 notification a day" was simply **false** — five push senders exist and the run-linked one has no preference gate, so any day you run is already two. The ratio is the lesson. **Nobody is auditing marketing copy, because nothing fails when it rots.** The plan pages were worse: 15% of hard sessions rendered *nothing at all* to the runner, and every one of them was already carrying a perfectly good coach note the page had never read.

**AI-building learning:** The Chrome extension wasn't connected, so instead of reasoning about layout I drove headless Chrome directly and screenshotted, then cropped and actually looked. That caught the orphaned fourth card on the new page, the 8px gap under the dark band, and confirmed the pyramid now renders as a visible shape. Every genuine find today came from *looking at output* rather than reading source. The em-dash guard made the same point from the other direction: its first version classified every multi-line JSX comment opener as copy, and the run that exposed it was a **fail I would have reported as a pass** if I had not checked the exit code.

**The honest bit:** I shipped a fix to `RestraintCard` and wrote in the commit message that it "rendered flat beside SessionCard on Today". It is not rendered anywhere. ZONE-VIS-02 took it off Today in May and I never checked that anything mounts it. Same session, I also found the backlog had been sending people after three components (`StatCell`, `StatRow`, `ActionListCard`) that have **never existed in this codebase** — copied out of a design handoff's inventory and trusted since. Four of that handoff's nine named components point at nothing. I trusted a document about code, again, which is the exact thing this project's own notes keep telling me not to do.

**Hook material:** A design handoff told us to restyle nine components. Three of them have never existed. A fourth hasn't been on screen since May. We'd been treating that list as a to-do for weeks.
**Postable?:** yes — "44% of our design spec referred to components that don't exist" is a strong hook, and the "nothing fails when marketing copy rots" thread has legs for anyone shipping a product site.

## 2026-09-11 — BRAND-08-pwa · The icon was wrong for four months because nothing in the repo compares two files that are supposed to match
**Shipped:** All 16 PWA/favicon PNGs regenerated from the concentric-rings source SVGs, via a committed script instead of by hand. Website only — the iOS app icon is a separate native asset and was already correct.

**Dev learning:** The interesting part isn't the regeneration, it's *why it rotted*. On 2026-05-13 someone regenerated the iOS native app icon from the new mark and stopped there. The PWA set sat at 2026-04-29 — the Vetra rebrand — so for four months the native app showed one brand and every browser tab showed a different, abandoned one. **Nothing in the repo can notice that, because the two sets are different file formats in different directories generated by different tools.** There is no check that could have caught it and I'm not sure a cheap one exists; the honest fix is that both now trace to `public/icons/source/*.svg`, so at least there's a single origin. Two real bugs found while in there, both invisible until you know the platform rule: `apple-touch-icon.png` shipped with pre-baked transparent rounded corners, and iOS applies *its own* squircle mask on Add-to-Home-Screen — mask a masked icon and the corners render black. Apple's guidance is a flat opaque square; let the OS round it. Same class for Android maskable icons, where edge alpha is undefined behaviour under an arbitrary crop.

**Product/creator learning:** I recommended this item on the grounds it was "user-visible right now" and had to correct myself within one message: it's user-visible *on the website*, and Zonna's traffic is iOS app users who never see a favicon. The founder's question — "is this a website change or an app change?" — was sharper than my recommendation. Because the app is a Capacitor shell loading from Vercel, I'd been treating "web code" and "the app" as interchangeable, which is true for *code* and completely false for *assets*. Be precise about which surface a change lands on before arguing it's high value.

**AI-building learning:** I hashed all 16 PNGs before regenerating, diffed after, confirmed every one changed — and that proved nothing about whether the *right mark* came out. So I rendered the new 512px and the pre-change 512px and actually looked at both. Old: single ring plus a dot. New: concentric zone rings. **"The bytes changed" is not "the change is correct"** — it's the asset-pipeline version of a green test that never reached the code, which is the same trap I fell into twice in two days. Looking at the output is cheap and I nearly skipped it.

**The honest bit:** Earlier in the same session I shipped a shadow fix to `RestraintCard` and wrote in the commit message that it "rendered flat beside SessionCard on Today". It isn't rendered anywhere — ZONE-VIS-02 took it off Today in May. I checked that the component existed and never checked that anything mounts it. Same session, two files, one habit: verifying the thing in front of me rather than the thing that reaches a user. Also found the backlog had been pointing at three components (`StatCell`/`StatRow`/`ActionListCard`) that have never existed in this codebase — copied out of a design handoff's inventory and trusted ever since.

**Hook material:** For four months the app icon and the browser-tab icon were different brands, and no test in the repo could ever have caught it — different formats, different directories, different tools. The fix wasn't the PNGs, it was giving both a single source file.
**Postable?:** yes — "our app and our website had different logos for four months" is a strong, true, slightly embarrassing hook, and "the bytes changed, but was it the right image?" is a genuinely reusable idea.

## 2026-09-10 — design_handoff_v2 · A "just tokens" modernisation that was mostly one CSS file, and one thing the handoff asked for that literally can't be built
**Shipped:** The v2 modernisation pass — radii up a step and a real two-layer card shadow (both app-wide via `globals.css`), plus a website-only near-black "receipt" band, a phone-frame device shot of the Today screen, a bigger hero, a facts band and a native FAQ. No palette, type or voice change.

**Dev learning:** The single highest-leverage fact was that the iOS app loads from Vercel (`server.url`), so changing `--radius-*` and adding `--shadow-card` in `globals.css :root` ships the "biggest perceived-quality lift" to the **live app with no App Store submission** — three token lines touch every card on every screen. The trap underneath it: the handoff mapped the card tokens to `polish-tokens.css`, but those live inside a flag-gated `[data-polish="on"]` block and the real components set `background: var(--card)` **inline** — so the shadow token HAD to go in `:root`, and the shadow itself had to be added inline per-component, not via the token file the handoff pointed at. Following the doc literally would have shipped nothing. Second gotcha: the "never nest" shadow rule is real — `ZoneRings`/`TrendCard` have 5–6 nested `var(--card)` surfaces, so I shadowed only the outermost root of each. And the empty/locked states of those cards are `--bg-soft` (data surfaces), which correctly get no shadow — the component already encoded the distinction.

**Product/creator learning:** "Recreate the real Today screen in the marketing hero" is the kind of line that sounds cheap and is impossible: the Today screen is a 685 KB authed client component and the page redirects logged-in users away. The honest version is a static composition of the real anatomy — which is also what makes it *maintainable*. The other one: the handoff's polished dark-band sign-off paired the wordmark with the tagline, which would have re-broken the exact "two locked brand lines on one surface" rule GTM-SITE-01 fixed on that page a few days earlier. A good handoff can still quietly reintroduce a governance violation; the brand rules have to be a checklist, not a memory.

**AI-building learning:** The frontend-design skill's "name a reference pattern for every component, and if none fits, define a new one and flag it" is what turned "add a dark section" into "document a new Dark Ground token group + Card Elevation scope + PhoneFrame in ui-patterns.md." Without that forcing function the tokens would have shipped undocumented and the next person would have hardcoded a second dark section and called it a theme.

**The honest bit:** I deferred part of Change 4 — the inline stat cards inside the 685 KB `DashboardClient` — because they're nested behind auth on the Coach/Me screens and I can't see them without a device. Shipping a shadow I can't look at, into the exact place the "don't double the shadow" rule bites, is how you ship an ugly regression you won't notice. Same reason I left the section-gap 28→36 as a token rather than find-and-replacing scattered 28px margins blind. Honest scope beats a green build I didn't verify.

**Hook material:** Three CSS lines in one `:root` block modernise every card in the iOS app with zero App Store review, because the app is a web view in a trench coat.
**Postable?:** yes — "the biggest app redesign we shipped was a website deploy" is a strong, true, counter-intuitive hook.

## 2026-09-10 — SIG-ULTRA-UNBUILT-01 + FOUNDATION-CHOICE-RESIZE-01 · A board sitting that mostly said "delete this", and a bug fixed by making a route re-run the engine it was built never to touch
**Shipped:** Two things from the "buildable now" backlog. (1) The Coaching Board ruled on 8 ultra `PLAN_SIGNATURES` fields that described behaviour the engine never implemented — 5 struck (3 already done by a principle, 2 deleted as aspiration), 3 kept as ratified-but-unbuilt commitments the SLT will sequence. (2) A real fix: on the >28-day foundation "choice" band, a runner who *deferred* the "add a foundation block?" decision and then said yes got their hard sessions a week later than a runner who said yes up front — same runner, same block, worse plan, purely because of *when* they tapped a modal.

**Dev learning:** The fix hinged on a property I almost didn't check: the §91 on-ramp credit is applied **only inside `if (earlyOnset)`** in `computePhases`. That one branch is the difference between "re-run the whole engine on a second route and pray the enrichment survives" and "no-op for ~everyone, gated on a flag the plan already stamps." The plan carries `meta.early_quality_onset`, so the resize is provably a no-op unless it would actually change something. The other near-miss was anchoring: I was nervous that re-running `generateRulePlan` with `planStart = meta.plan_start` would drift — but `calcPlanLength` counts back `totalWeeks` from race week, so passing the already-anchored start makes `weeksAvailable === totalWeeks` and it round-trips exactly. I didn't *trust* that, I wrote a parity test that generates the plan both ways under a frozen clock and asserts byte-identical skeletons. That test is the whole safety story.

**Product/creator learning:** Half of "what should we build?" is "we already built it, we just lied about it in config." Five of the eight ultra fields were decoration — three were done by a principle and the flag took the credit, two were pure aspiration. A `100K` plan that `night_run_optional` implies exists, on a PAID distance, is worse than saying nothing. The board's most useful output was permission to *delete*, and a firm "you may NOT delete these three" on the ones that are real. Restraint cuts both ways.

**AI-building learning:** The Coaching Board skill's mandatory conflict-scan is what stopped me miscategorising: I'd have filed all 8 as "unbuilt debt", but the scan forced me to check each against the shipped principles and three turned out to be *superseded* (§24d/§47 already do the work), not debt. Different disposition, different register, different honesty. The distinction only appeared because the process made me read the constitution instead of the config.

**The honest bit:** I spent a good while designing an enrichment re-graft for paid users (re-run gives rule copy; graft the AI copy back onto unchanged weeks) — and it's genuinely narrow: it only fires for early-onset + >28-day gap + defer-then-add + already-enriched. Realistically a handful of users, maybe zero today. For a P3. I kept it because losing a paid runner's coaching voice on a re-size is a visible regression and the graft reused `revertWeeksToRuleCopy` so it was cheap — but I could argue I over-built it.

**Hook material:** Same runner, same 3-week foundation block: tap "add" *before* you see the plan → first hard session in week 1. Tap it *after* → week 2. The engine was giving you a worse plan for reading it first.
**Postable?:** yes — the "config that describes behaviour that doesn't exist" angle is a strong one, and "a bug where reading your plan made it worse" is a hook.

## 2026-09-10 — CAT-ROW-ELIGIBILITY-01 + §99 · The fix I shipped exposed a lie the app had been telling since R23
**Shipped:** The catalogue selector can finally say "this row needs a pace this runner has", which unblocked a migration the board had ruled correct six days earlier and then reverted — and the migration immediately exposed that one session had been telling runners 45 minutes for a session that takes over 70.

**Dev learning:** Three separate silent traps in one afternoon, all the same shape: **a mechanism that looks applied and does nothing.** (1) I added the HM pace anchor to the numeric resolver used for sizing, but not to the string map used to build the displayed structure — two resolvers for one question, one updated. That shipped **859 sessions reading "HM-pace reps" with no pace at all**, and the only reason I saw it is that I'd written an invariant for exactly that case twenty minutes earlier. (2) The fixed-shape sizer only priced steps measured in *time*; my row is measured in *distance*, so it fell out at its own guard and kept the old behaviour. (3) It asserted the work anchor was `'T'` — written back when both rows it handled were threshold rows, so "exactly one anchor" and "the anchor is T" were the same sentence. They stopped being the same sentence the moment a third row joined. **Every one of those would have passed a code review and produced a green test run.**

**Product/creator learning:** The 45-minutes-vs-70 thing is the one that actually matters. Zonna's entire promise is *"Slow down. You've got a day job."* Telling that runner a session takes 45 minutes and handing them 70 is not a rounding error — it's the session they bail on, or the evening they didn't have. And it had been shipping since R23. It was invisible because the row had no machine-readable structure to check the stated duration against; the migration didn't cause the bug, it **gave the codebase eyes**. That's the argument for structural stamping in one sentence.

**AI-building learning:** I nearly shipped the migration with the dose quietly halved. Structure-driven sizing recomputed the session at 2 reps instead of 4, the tests were green, the sweep was clean, and the number was *defensible* — which is exactly what makes it dangerous. I only caught it because I'd decided to measure the dose before and after rather than trust "no violations". **A silent 50% cut to a peak session is not something any check in this repo would have flagged**, because nothing was violated; it was just different. So the migration went in with a literal `repeat: 4` and the dose question went to the board separately.

**The honest bit:** I reported `REAL EXIT: 0` twice today on commands piped into `tail`, where `$?` is tail's status and not the command's. The first time, the test suite had actually failed. My own memory file has a warning about this exact trap, written the last time I did it. I now redirect to a file and read the code. Also: I spent several minutes convinced I'd found a live engine crash that was entirely my own malformed fixture — `goal: 'time_target'` with no `target_time`.

**Hook material:** "Your training app says this session takes 45 minutes. It takes 70. It's been lying since R23, and the only reason anyone found out is that I migrated the session to a format that could be checked." Plus: one fix, three separate mechanisms that would have looked applied and done nothing.

**Postable?:** yes — the 45-vs-70 story is the most human thing I've shipped in weeks, and "the fix gave the codebase eyes" is a real idea rather than a changelog line.

---

## 2026-09-10 — §98 / CB-ONSET-YIELD-01 · The bug report named the wrong section, and I nearly fixed it anyway
**Shipped:** §89's early quality onset now yields to §1's intensity ceiling — a ladder that walks the base phase back one week at a time until the plan complies, bounded so a runner can never end up waiting longer than if they had never demonstrated readiness at all.

**Dev learning:** The item was filed as *"§91's foundation-week credit spends §1's headroom"*. I built the fix for that. It took breaches from 34 to 31, and I only noticed it was wrong because I'd measured the baseline first: some breaching plans had **no foundation block at all**. The isolation that settled it took four lines — same runner, toggle `recent_quality_training` alone, count breaches. **29 with the gate open, 0 with it closed.** The credit was an amplifier; §89 was the cause. Second thing worth keeping: two prior board rulings (§97's distance scoping, then its headroom amendment) were *completely inert* here, because both set the base **cap** and §91's credit then subtracts from the cap — so base landed at zero whether the gate granted or denied. Two guards, twelve cells, zero protection. A gate that sets a ceiling cannot govern a rule that subtracts from it.

**Product/creator learning:** The thing I keep relearning is that a threshold is a guess wearing a number. Three separate proxy levers died today, the last one decisively: breaches occur at `ceiling × days` of **0.60 and also 1.25**, so no constant of that shape could ever separate the safe cells from the breaking ones. What shipped instead measures the actual quality share and walks back until it complies. Nothing to tune, nothing to drift. Yesterday's board ruling had already written the principle for me — *"a defect class that cannot occur beats a check that catches it"* — I just hadn't applied it to my own work yet.

**AI-building learning:** My first remedy was clean, plausible, well-argued and aimed at the wrong section, because I inherited the filing's framing instead of testing it. The correction came from a measurement, not from thinking harder. The other one: I ran the unbounded version, got "all 34 fixed", and it would have been very easy to stop there — but I'd written the check for *"is anyone now worse off than ungated?"* before running it, and it came back **1**. One runner, punished for demonstrating readiness, which is the exact defect §91 exists to prevent. **Writing the regression check before seeing the good result is what caught it.** Afterwards I disabled the ladder on purpose to confirm 12 of 13 tests went red; a test suite you haven't seen fail is a rumour.

**The honest bit:** I reported `REAL EXIT: 0` on a run where the test suite had actually **failed** — I piped `npm run verify` into `tail`, so `$?` was tail's exit code, not npm's. My own memory file has a warning about this exact trap, written after doing it before. I caught it in the same message because the failure was visible in the output above the line, but if the failing test had scrolled past the `tail` window I'd have shipped it and told the founder it was green. Also lost time to a fixture I'd built wrong — `goal: 'time_target'` with no `target_time` — which threw deep inside `resolveMainSet` and looked exactly like a live engine defect for several minutes.

**Hook material:** A bug report named the wrong cause, my fix for it worked (34 → 31 breaches), and it was wrong. Four lines of measurement found the real one: 29 breaches with the gate open, 0 with it closed. Also: two ratified safety gates protecting twelve cells, and measurably protecting none of them.

**Postable?:** yes — the "my fix worked and was still wrong" arc is the strongest one I've had, and it pairs with the same day's marketing lesson (verification that doesn't reach the change) without repeating it.

**Late addition — the fix's own copy was lying.** I'd filed the runner-facing note as a follow-up and the founder pushed back on the habit of leaving a residual every time, which was fair, so I closed it in the same session. Doing it surfaced something filing it would have hidden for weeks: §98 had just made an existing line untrue. `levelFitNote` tells a gated runner *"quality starts earlier here than a novice plan"* — and when the yield ladder trims the onset all the way back to the ungated bound, it doesn't. The plan is compliant, the sentence was wrong, and no test would ever have caught a true-sounding string. **The follow-up I nearly deferred was the thing that found the defect in the work I'd just called done.**

---

## 2026-09-10 — GTM-SITE-01 close-out · My verification passed because it checked the wrong environment
**Shipped:** Closing out the site review — one constant header/footer span, the canonical host moved off a redirect, and two brand divergences (DIV-021, DIV-022) that only showed up when I stopped trusting my earlier pass and re-read the pages.

**Dev learning:** The canonical tag on every page pointed at `https://zonna.run/...`, which **307-redirects** to `www`. Real defect: a canonical aimed at a redirect is a wasted signal and a sitemap full of them is worse. I "fixed" it by changing twelve code defaults from apex to www, verified it in the local build, and shipped it. It was a **no-op**. `NEXT_PUBLIC_APP_URL` was set in Vercel to the apex, and an env var beats a `??` default. My verification passed because `.env.local` has no such variable, so the local build fell through to my new default and showed me exactly the result I was hoping for. **I verified the change in the only environment where it had no effect.** The variable is now deleted entirely so the value lives in git and local and production cannot disagree.

**Product/creator learning:** The founder looked at the live site and said the header "span" was inconsistent — home wider than plans. He was right, and it was a decision I had made deliberately: the header took a `width` prop so it matched each page's content width. Defensible on paper, wrong in a browser, because the header is site chrome and chrome should not move. I rebuilt it as a constant rather than a defaulted prop, because a defaulted prop is precisely how it drifted in the first place.

**AI-building learning:** Twice today I asserted something I had only inferred. I told the founder an env var was unset — deduced from two metadata tags disagreeing — and put that in a commit message as fact. He pushed back, I checked, and it had been set for 141 days. The tell was available the whole time and I never ran the one command that would have settled it. **Inference dressed as measurement is the failure mode to watch for; it reads exactly like a finding.**

**The honest bit:** I also introduced a brand defect while fixing brand defects. Standardising the footer put the brand statement on all 8 pages, and on the homepage it landed ~96px under the designed 48px closing moment — the same sentence twice in one scroll. And the feature-registry row I wrote documenting the new chrome was stale within the hour, describing a `width` prop and a footer line that no longer existed. The exact rot this review was convened to find, in a doc I wrote during the review.

**Hook material:** Changed twelve files, verified locally, shipped, told the founder it was fixed. It changed nothing in production. An environment variable set 141 days earlier beat every one of them, and my test passed because the variable does not exist on my machine.

**Postable?:** yes — "my verification passed because it checked the wrong environment" is the strongest post of the day.


## 2026-09-10 — GTM-SITE-01 · The logo changed size as you walked around the site
**Shipped:** One `SiteHeader` and one `SiteFooter` across all 8 marketing pages, `/compare` renamed to `/comparisons` with a 308, and two stale homepage claims corrected.

**Dev learning:** Five hand-written headers and four hand-written footers, and they disagreed on nearly everything: the wordmark rendered at 20px on the homepage, 32px on `/plans` and every article, and 20px again on the legal pages. Nobody wrote that; it accreted, one page at a time, each copied from whichever page was nearest. The tell is that **three pages had no header or footer at all** — land on `/privacy` from Google and there was no route back into the site. Copy-paste chrome does not drift slowly, it drifts immediately and then nobody looks again.

**Product/creator learning:** The homepage said "Your plan starts from four answers." The wizard asks about fifteen. That line was true once and was never revisited through five separate wizard changes. Worse, it was **underselling the thing we had just spent weeks making better** — the SLT ruled months ago that the personalisation is real but invisible, and here we were advertising it as shallower than it is. Marketing copy is a claim about the product, and claims rot exactly like code does, except nothing fails when they do.

**AI-building learning:** The founder asked for the header to "pop a bit more" and said "I don't know what that means, but you know what I mean." That is the most useful kind of brief, and the wrong instinct is to reach for a shadow or an animation. Running it through the design skill and the SLT produced a constraint instead: presence, not decoration. Sticky so it never leaves, one point of colour, and it tells you where you are. **No motion, no shadow, no client JS.** Wood's line was the one that decided it: a sticky header is structural, an animated one is decorative.

**The honest bit:** We also found the trial line said "or you walk", which contradicts our own monetisation doc — day 14 is a graceful downgrade where you keep the plan you built. We were advertising a worse deal than we actually offer, on the page where it costs most. That has been live since the marketing page shipped.

**Hook material:** The wordmark was 20px, then 32px, then 20px again depending on which page you were on. Not a decision anyone made. Nobody had walked the site end to end since it was built.

**Postable?:** yes — "your marketing copy rots like code, except nothing fails when it does" is the post.


## 2026-09-10 — GTM-SEO-COMPARE-01 · The metadata you write is not the metadata that ships
**Shipped:** `/runna-alternatives`, the first of eight competitor-comparison pages, built as a shared template so the next seven are a catalogue entry plus a four-line route file.

**Dev learning:** Next.js App Router merges metadata **shallowly**. Define `openGraph` on a page and it does not merge into the root layout's object, it *replaces* it. Two consequences I only found by grepping the prerendered HTML in `.next/server/app/`: the site-wide `og:image` silently vanished, and `twitter:*` did the opposite, inheriting the root layout's generic card so the page advertised itself on social as "Zonna, Plans to stop you overtraining" with the site tagline as its description. `/plans` has had no `og:image` for the same reason since it shipped. The lesson is narrow and reusable: **read the built HTML, not the metadata object you wrote.** They are not the same artifact.

**Product/creator learning:** The sitemap looked dynamic and wasn't, in the way that matters. `app/sitemap.ts` uses the Next Metadata API, so "is the sitemap generated dynamically?" reads as yes, but it is a hand-maintained array, not a walk of the route tree. A new page under `app/` would never have appeared in it. Wiring it to the article catalogue instead of adding one literal means the next seven pages list themselves.

**AI-building learning:** The brief said "check first, do nothing if it already works" for three items. That instruction is worth more than it looks, because the default failure mode here is confidently adding a canonical tag that already existed and reporting it as done. Checking produced a genuinely mixed answer: canonical already correct (added nothing), OG partly correct but silently missing its image, Twitter not derived at all. **One of three needed no work, and I would not have known which without looking at the output.**

**The honest bit:** I built and shipped the page before anyone asked how a user reaches it. It has zero inbound internal links. That is defensible for a search landing page, whose traffic model is Google to page to App Store, but it was not a decision I made, it was one I noticed afterwards when asked a direct question. Eight orphan pages is a different proposition to one.

**Hook material:** Three SEO items to check. One was already done, one was half-broken in a way no build warning mentions, one was missing entirely. The half-broken one had been quietly shipping the wrong social card on `/plans` for weeks.

**Postable?:** yes, the shallow-merge gotcha is a concrete, checkable thing most Next.js developers have shipped without noticing.


## 2026-09-10 — INTENSITY-FOUNDATION-BLIND-02 + CB-FOUNDATION-DENOM-01 · Two fixes patched a symptom before anyone asked whether the rule was right
**Shipped:** §1's intensity-distribution ceiling now counts main-plan weeks only (§57 foundation weeks excluded), which deleted the deferral machinery two prior fixes had built; and `today` became an injectable input to plan generation instead of an ambient `new Date()`.

**Dev learning:** The property sweep pinned `PLAN_START = '2026-04-27'` and `gapDays` clamps negatives to zero — so once that date passed, generation saw a gap of **0 for every one of 16,038 plans**, planned zero foundation weeks, and then the sweep composed real 3-week blocks onto them using its own synthetic `today`. Generation and composition were reasoning about different calendars. Two consequences, both invisible: §91's on-ramp credit had literally zero coverage across the whole sweep, and the results drifted with the wall-clock date despite a pinned seed — so "no NEW violations vs baseline" was a comparison against a moving object. The general lesson: **if a test harness pins one date and lets another float, it isn't deterministic, it's just slow-moving.** Injecting `today` fixed both and immediately surfaced a real production breach.

**Product/creator learning:** The best finding wasn't the bug, it was the *rule*. §1 capped quality as a share of the whole plan including the pre-plan foundation block — which meant the ceiling got **looser the earlier you generated your plan**. Two runners, identical 17-week block, identical 15 quality sessions: one compliant, one in breach, differing only by when they opened the app. Nobody decided that. It fell out of an implementation detail and sat in the constitution as if it were coaching.

**AI-building learning:** I fixed this twice before questioning it. BLIND-01 added a deferral; BLIND-02 (mine, this morning) found BLIND-01's key was false on the choice band and *widened the deferral*, adding two meta fields and a compose-time marker. Both were locally correct. Both were wrong at the level above. It took running an actual board review — forcing a conflict scan against §57 — to notice the denominator was the problem and delete all of it. **The AI is very good at making a broken rule work and will not spontaneously ask whether the rule should exist.** The structured review is what supplies that question; the model supplies fluent, well-commented compliance either way.

**The honest bit:** The commit I shipped this morning was superseded four hours later by a ruling that deleted most of it. I also nearly broke the free-tier AI intro without noticing — my first version of the compose marker spread `meta` into a new object, and the route stamps `plan_intro` on `rulePlan.meta` *after* composing, relying on it being the same object. A comment at `route.ts:150` was the only thing that said so. That would have shipped as "free users silently stop getting their one AI surface", with no error anywhere. And §91 had shipped three days earlier with the sentence "Does not loosen §1" — a prose claim doing a mechanical check's job. It does loosen §1: 19.0% against an 18% ceiling, confirmed under production semantics.

**Hook material:** 16,038 plans in the property sweep. Foundation-block coverage in those plans: zero, for weeks — while the summary line cheerfully reported "9,905 carried a foundation block." The generator building them believed no block was coming.

**Postable?:** yes — the "I fixed it twice before asking if the rule was right" arc is the strongest AI-building post I've had. The calendar-gameable ceiling is a good second.


## 2026-09-09 — CAT-DEPTH-01 + PLAN-NOTE-SURFACE-01 + HSR-INERT-01 · the feature was already built; nobody could see it

**Shipped:** Stopped trying to make the training plan *more* personalised, and instead made the personalisation it *already does* visible to the runner — after discovering the "add more personalisation" lever had been rejected by our own coaching board three times before.

**Dev learning:** I went in to build "make threshold sessions differ by fitness level" — the paid-proposition centrepiece, the thing the founder said would stop this being "just a Garmin plan." I read the doctrine first (as I'd been burned into doing all week) and found the exact lever I was about to build had a **written-down veto attached, rejected three times prior**. My refined version was the same lever in a disguise; the board rejected it a fourth time, unanimously. The thing that was supposed to be the headline build was a wall. What the recon *also* found: the plan already makes four real fitness-based decisions (earlier hard work, higher-tier sessions, an extra hard day, unlocked session types) — and communicates **none of them**. The engine writes an honest note explaining every one, and all of those notes rendered to precisely nobody. Six of them. The fix wasn't more engine; it was 40 lines of a render path that never existed.

**Product/creator learning:** This is the most important reframe of the week. "My plan feels generic" is almost never "the plan IS generic" — it's "the plan never told me why it's mine." The differentiation was real and invisible, and invisible differentiation is worth exactly zero at the moment someone decides whether to pay. The behavioural scientist on the board (Wood) put a hard line on it: surface it *once, honestly*, never as a persistent "look how personalised we are!" banner — that's decoration, and decoration teaches the user the app is decorative. So: honest constraints first ("this is a maintenance plan because you gave us three days"), the flattering "shaped for you" line last and only if there's room.

**AI-building learning:** Two governance bodies did real work this session — the coaching board *vetoed* my build, and the product board *reframed* it — and both times I was the one about to build the wrong thing. The value wasn't the boards being clever; it was them being **institutional memory I don't have**. A veto written down three sittings ago is invisible to me unless I read it, and "read the doctrine before you write the code" went from a nice principle to the single highest-leverage habit of the week. I'd have shipped a fourth attempt at a rejected lever otherwise.

**The honest bit:** I proposed the vetoed lever to the user *twice* — once as "the backlog says implement rep_length," once refined as "discrete whole-minute variants" — before reading far enough into the doctrine to find both were the same blocked thing. And I have to be honest that the shipped surface isn't visually confirmed: it builds, the logic is unit-tested, but I didn't stand up an authenticated session with a plan carrying notes to *look* at it. Trivial render over tested logic, low risk — but "it compiles and the logic passes" is not "I saw it."

**Hook material:** Spent the session trying to make a training plan more personalised. Turned out it already made four personalised decisions per plan and showed the runner none of them — the "make it personal" feature was 40 lines of rendering a note the engine had been writing, and silently discarding, for months.

**Postable?:** yes — "your product's best feature might already be built and invisible" is a strong, honest founder post, and it pairs with the week's running theme (the app is about trusting what's written down; so is building it).

---

## 2026-09-09 — DOC-CLAIM-01 · the test that failed against its own documentation

**Shipped:** A build check that catches when our coaching docs quote a line the app "says to the runner" that the app no longer actually says. Because that already happened — a doc described a coaching cue that had quietly drifted from the shipped wording, and reading the doc made us think a feature was missing when it had shipped months earlier.

**Dev learning:** The backlog estimated this at "~30 lines: scan every quoted string in the doc, check it's in the code." I measured first and the estimate was wrong by category, not degree. The doc has 56 quotes, and they're an indistinguishable mix: real cues the app emits, hypothetical runner speech ("I can't run 45 minutes on a weekday"), paraphrases ("a weather forecast, not a target"), and — the killer — *historical* quotes, where a "Corrected" note quotes the OLD wrong text on purpose to document the fix. A scanner that flags "this quote isn't in the code" flags all three of the last kinds. 34 false positives. No heuristic separates them, because there's no structural signal — a human knows from context, a regex never will. So the check had to become opt-in: only strings explicitly marked `**Engine copy:**` get verified. Zero false positives, coverage grows as people mark claims. Worse on paper (it doesn't check everything), correct in practice (a checker with 34 false positives gets deleted within a week).

**Product/creator learning:** Nothing runner-facing — this is internal doc-integrity tooling. But it completes a set: we now have four checks that each prove one arrow between the docs and the engine (a config value has a principle; a principle has code that reads it; every wizard input changes the plan; and now, a doc quote matches what the app emits). The through-line of this whole week has been the same anxiety the product itself is about — trusting a number/word because it's written down, when nothing checked it was still true.

**AI-building learning:** The sharpest one. My first two versions of the checker *matched their own documentation* — I wrote "**Engine copy:** `exact string the engine emits`" in the doc as the format example, and the parser dutifully tried to verify the placeholder text "exact string the engine emits" against the code and failed. Then it matched a prose sentence that mentioned the marker. Twice, the tool I built to check the doc was fooled by the doc describing the tool. Fixed by requiring the bold `**...**` form (real markers are bold; prose references use backticks) and single-line matching. The lesson: a checker that reads prose has to be robust to prose *about the checker* — the self-referential case is not an edge case, it's the first thing you write.

**The honest bit:** I proposed building this three times before actually measuring the corpus, and each proposed design (scan backticks; scan italics; scan assertion-phrases) would have shipped noise. The measurement — 56 quotes, 34 false positives, the real cue not even in backticks — is what forced the opt-in design. If I'd trusted the backlog's "~30 lines, scan everything," I'd have shipped a check that cried wolf and got switched off, which is this repo's single most-repeated failure and the exact thing the check is supposed to prevent.

**Hook material:** Built a test to check the docs match the code. It failed — against its own documentation. The example in the doc explaining the convention was being checked as if it were a real claim. Twice.

**Postable?:** maybe — "the test that failed against its own documentation" is a good dev-humour hook, but it's inside-baseball; pairs better as a footnote to the week's bigger stories than standalone.

---

## 2026-09-09 — NOISE-GATE-01 + INERT-INPUTS-01 + CB-TERRAIN-01 · a paid step that lied, and the board that wouldn't let me fix it the easy way

**Shipped:** A test that catches "safety checks" firing so often they're noise; deleted one dead input; and a paid wizard step ("Where do you run — road or trail?") that promised to affect your pace targets and did absolutely nothing — now wired to real coaching, with the board vetoing the obvious version.

**Dev learning:** Two mechanical lessons. (1) The plan sweep only ever counted `error`-severity violations — `warn`s were tallied by nothing, so a warn firing on half the plans was invisible. Added a firing-rate gate; it immediately surfaced two warns at ~23% I didn't know were that high. Caught my own bug building it: I first counted violation *instances* ÷ plans and got 36.5%, which is meaningless — a plan with five bad weeks isn't "500% bad." The real metric is *plans-firing* ÷ plans. (2) Deleting the dead input taught me the input/output trap: `zone2_ceiling` existed as both a *GeneratorInput* field nobody sent AND a computed *meta output* everything reads. Delete the wrong one and you break Strava HR fallback across the app. tsc stayed green because they're distinct declarations — only careful reading told them apart.

**Product/creator learning:** The terrain step is the sharpest thing I've found in this codebase. A PAID wizard question — "road, trail, or mixed?" — subtitled "Affects pace targets," and the engine read the answer for *nothing*. You were charging people for a question whose answer you threw away, while telling them it mattered. The fix wasn't what I expected: I went in to add a trail pace adjustment (trail is slower, obviously), and the coaching board *vetoed* it — there's an existing principle (§40b) that says you never invent a pace number the runner can't act on, and trail pace swings 20%+ with the footing. The right answer was a coaching *note* ("off-road, run by effort, pace is a road reference"), not a number. The question I almost got wrong: "make the input do something" is not the same as "make the input do the thing the UI promised."

**AI-building learning:** I proposed the fix ("add a days-based threshold," "add a trail pace multiplier") *before* checking doctrine, twice, and doctrine reversed me *both* times. The pattern is now unmistakable across this whole session: my first instinct is a plausible mechanical change, and the existing written principles encode a subtler correct answer that a plausible change would violate. Reading `CoachingPrinciples.md` before writing code isn't process overhead — it's the difference between shipping the fix and shipping a new bug that contradicts a ruling from three weeks ago.

**The honest bit:** I built the terrain note, ran the tests, and INPUT-EFFECT-01 *still* said terrain changed nothing — because the test only compares a whitelist of "decision" meta fields and my new note wasn't on it. For a minute I thought the wiring hadn't worked. It had; the test just couldn't see it. Adding one field name to a list fixed it, but "the test that proves your fix worked can't see your fix" is a special kind of five-minute panic.

**Hook material:** A running app had a paid onboarding question — "where do you run?" — that affected nothing, while its own subtitle claimed it "affects pace targets." Charging for a question, throwing away the answer, and telling you it mattered. The fix took a coaching-board veto to get right.

**Postable?:** yes — the terrain story is the strongest of the three; "we charged for a question and ignored the answer" is a real founder-honesty post.

---

## 2026-09-09 — INTENSITY-FOUNDATION-BLIND-01 + CB-INTENSITY-50K-01 · chasing two console warnings I was told to ignore

**Shipped:** Fixed a safety check that was lying to us in two opposite directions — it flagged plans that were actually fine, and by doing so it hid a plan that was actually broken. Then a coaching board raised the 50K quality ceiling to close the real one.

**Dev learning:** The whole thing started from two "baselined, ignore them" warnings in the plan sweep. They weren't baselined — the code that was supposed to tolerate them didn't list them, so they were slipping through a different door. Root cause: our constitution-check for training intensity runs TWICE on two different versions of the same plan — once before we prepend the runner's "foundation" easy-running weeks, once after. Those easy weeks change the denominator of the ratio it checks, so the two runs disagreed. The early run screamed false alarms in production and *threw* in test mode (that's why I'd seen 5 phantom test failures earlier in the day and written them off). Fix was to make the check defer to the final version of the plan. The part I nearly shipped without checking: deferring the early check is only safe if something re-runs the check on the final plan. I'd *assumed* it did. Made myself go read the two API routes and confirm `enforceViolations` is actually called after the plan is assembled. It was — but "I assumed the enforcement existed" is exactly how you turn a false alarm into a silent hole.

**Product/creator learning:** Once the checker could see straight, it exposed a real defect: a 50-mile ultra plan was prescribing a hair too much hard running. The instinct was to cut a session. Wrong instinct. The coaching doctrine already had a precedent — at ultra distances, when the "how hard" rule collides with the "how much quality" rule, the distribution ceiling is the thing that yields, not the workout. The number was a leftover from an old way of measuring that a scientist on the board (Seiler) had formally dissented against months ago, with a note that literally said "a breach here reopens this." It breached. His dissent got vindicated. The lesson: the right fix for "the plan broke a rule" is sometimes "the rule was wrong," and the way you know is that someone smart wrote down *why* they doubted it and under what condition to revisit.

**AI-building learning:** Same lesson as yesterday, sharper. I opened this ready to write code to cut a quality session. Reading the doctrine first — specifically a 5-line precedent buried in a principle doc about a *different* distance (100K) — completely reversed the fix. If I'd trusted my first read of "the plan is over the limit, reduce it," I'd have shipped a change that contradicted an existing board ruling. The board-simulation format also earned its keep: making each expert argue in their own voice surfaced that the injury specialist and the distribution scientist would *both* independently reject "cut a session," for different reasons.

**The honest bit:** I told Russ my fix was "Option 1, minimal — a days-based threshold." Then measured it and the minimal version would have left the half-marathon broken (its tighter ceiling breaks at a different day-count). Twice in two days the "obvious minimal fix" was quietly wrong and only measurement caught it. Also: my first attempt to find the worst-case ultra plan used an impossible input (a longest run longer than the entire week's mileage), so my "worst case: 16.3%" was briefly built on a plan no real runner could enter. Re-measured with valid inputs — same number, got lucky, but it should never have been the first number I trusted.

**Hook material:** A training app had a safety check that ran twice on the same plan and disagreed with itself — one run cried wolf in production logs, and the crying-wolf is exactly what buried a real bug where an ultramarathon plan prescribed too much hard running. The "ignore these two warnings" note was wrong; the warnings were the bug.

**Postable?:** yes — pairs with yesterday's as a two-parter on "the document is not evidence about the code, until you make the code prove it."

## 2026-09-09 — INTENSITY-3DAY-01 · the backlog told me the wrong cause, and a two-line diff told me the right one

**Shipped:** A one-predicate fix so a 3-day runner who calls themselves "experienced" no longer gets a plan that's >25% hard — the exact over-training the whole product exists to prevent, shipping silently in production.

**Dev learning:** The backlog entry named §79 (the intensity-allowance rule) as the cause, with a confident mechanism paragraph. It was wrong. I nearly built the fix against it. What saved me was generating two plans — `experienced` vs `intermediate`, then `experienced` with and without the readiness gate — and diffing the per-week quality counts. The real cause was §89 early-onset shortening the all-easy base, which drops a *constant* ~9 quality sessions into the plan regardless of how many days you run; on a 3-day week the denominator collapses to ~33 and 9/33 blows the ceiling. The kicker: §97 had *already* fixed this exact tension three days earlier — but scoped its guard to race distance and never to `days_available`, because the property sweep samples every input axis independently at random and the 6-way "ready runner" gate never coincided with `days: 3` in 20,000 draws. Same class as two other bugs this month. The durable fix wasn't more random iterations — it was pinning the exact combination as a deterministic corner case.

**Product/creator learning:** This is the most on-brand bug possible. A runner self-identifies as *"I'm experienced, push me"* and the engine responds by prescribing a quarter of the plan as hard efforts — selling the anxious over-trainer the exact error the product's whole pitch ("you're trying hard, that's the problem") promises to protect them from. And it did it silently: the guardrail that's supposed to catch it only throws in dev/test; in production it logs and ships the plan anyway. The constitution had a law and no police on that street.

**AI-building learning:** The lesson that keeps repeating — a document is not evidence about code. The backlog's mechanism paragraph read as authoritative and was a static-analysis guess that three greps had "confirmed". A one-line `diff` of two generated plans was worth more than all of it. When the question is "which input changes what the runner sees", make the software show you — don't reason about it, and definitely don't trust the prose written last week.

**The honest bit:** I told the user my fix was "Option 1, minimal" before I'd measured it. Then the matrix showed the minimal version (a flat "require 4+ days" rule) would have *left the half-marathon broken* — its tighter 20% ceiling breaches at 4 days, not 3, and the 3-day HM only looks fine because it flips to a different plan profile that happens to be exempt. A day-count threshold would have shipped a second bug while closing the first. The honest fix had to be `ceiling × days ≥ 1`, which is the actual physics.

**Hook material:** Two runners, same race, same everything — one ticks "experienced", one ticks "intermediate". The first gets 9 hard sessions, the second gets 6. The app built to stop you overtraining was handing the overtrainers 50% more hard running, and the safety check that should've caught it was switched off in production by design.

**Postable?:** yes

**Shipped:** A test that varies all 31 `GeneratorInput` fields and asserts each one changes the delivered plan. 25/31 do. Two are dead. One combination generates a plan that breaks the intensity constitution.

**Dev learning:** We already had three checks over configuration and none of them asked the only question that matters. `configPrincipleSync` proves a config key has a *principle*. `configConsumer` proves it has a *consumer*. `sweepInputCoverage` proves the sweep *varies* a field. You can pass all three and still have a field that changes nothing — the sweep will happily vary `terrain` across 16,000 plans and report the same number either way. The gap between "this is referenced" and "this matters" is where two dead inputs had been sitting.

The mechanic that made it honest was refusing to count throws. `acknowledged_prep_warning` never changes a plan — it decides whether one *exists* (§44's two-step UX). My first version discarded exceptions, so it reported the field inert. Now `PrepTimeError`/`DaysAvailableError` count as outcomes and **any other throw fails the run**, which is what surfaced the §1 defect instead of letting it be silently counted as "the field did something".

**Product/creator learning:** The sharpest find is a **paid** wizard step. `GeneratePlanScreen.tsx:167` asks "Where do you run?" and subtitles it "Affects pace targets." It affects nothing — the value is echoed into meta and no code reads it. That's worse than `overdo` was, because the UI *states* the effect. We are charging for an answer we then throw away. "Do the wizard's answers mean anything?" stopped being an afternoon of manual measurement and became a number on every commit: 25/31.

**AI-building learning:** I nearly filed two false findings in one session, both the same shape — concluding from a fixture rather than from the engine. `acknowledged_prep_warning` read inert because my baseline used `goal: 'finish'`, and `inputs.ts:137` treats the warn zone as ok for finish goals, so the gate never armed. `foundation_decision` read inert because the race was 14 weeks out and the choice only exists past a 28-day gap. Both times the code looked conclusive. The fix is the same one this repo keeps re-learning: **generate two plans and diff them, don't read the code and conclude.** I put THE FIXTURE TRAP at the top of the file with all three cases in it, because the next person (or the next me) will hit it again.

The other thing worth saying: I only trusted the green because I broke it three ways first — un-registering an inert field, registering a working one, dropping a blocked value. All three went red. A test I hadn't falsified would have been worth roughly nothing here, and this repo has shipped checks that were dead on first write.

**The honest bit:** The test passed on the first proper run and I almost stopped there. It ran in 5ms and reported green, which for ~90 plan generations should have looked wrong to me immediately. It wasn't wrong — the work happens at module load — but "fast green" is exactly the shape of the vacuous checks we've shipped before. Separately, `npm run verify` then failed on three TypeScript casts that vitest transpiles straight past, so the test was green and the build was broken at the same time. And I reported a background job as passing off a notification that said "exit code 0" when the actual verify exit was 2 — the 0 was the wrapper, not the command.

**Hook material:** A test written to check whether the wizard's answers matter found, on its first run: a **paid** wizard step subtitled "Affects pace targets" that is read by zero lines of code, and a 3-day runner who calls themselves experienced being prescribed **26.8% hard work against a 25% ceiling** — in an app whose entire pitch is "you're trying hard, that's the problem." 25 of 31 inputs do something. Six don't.

**Postable?:** yes — strongest one in a while. The angle is "I built a check to see if my own product's questions mattered, and 6 of 31 didn't", and the §1 breach is the punchline because it's the exact failure the product exists to prevent.

---

## 2026-09-07 — §97 · I parked it, the founder said finish it, and the bug was four steps upstream

**Shipped:** Quality now starts in calendar week 2 for a demonstrably-ready runner. It started at week 5 this morning.

**Dev learning:** The bug that stopped me shipping this took four steps to explain and every one looked locally correct. A new rule withheld VO2max for the opening weeks. Build carries exactly one VO2max session, and its position was worked out from the rotation's modulo — so when the withholding window covered that week, the week quietly returned a threshold session and **the slot was spent**. Build ended with zero VO2max, which pushed the first one into the peak phase, past an adaptation deadline, which triggered a fallback that swaps two sessions — and that swap carries a documented defect where a session built for an early week arrives in a late week still wearing the early week's pace treatment. Two `error`-level violations, four steps from the cause. The fix was to stop *finding* the slot and start *placing* it. **A scarce resource identified by coincidence of arithmetic fails silently the moment the arithmetic and the availability disagree.**

**Product/creator learning:** The founder asked for week 1. I refused, delivered week 3, and explained why. He came back with "week 2 — maybe". Measuring what week 2 actually required changed the question completely: his base phase was already zero weeks, so the lever I'd have reached for first — shortening the on-ramp — would have done **nothing** for him. His blocker was two pre-plan "foundation" weeks. Two different runners in the same product were blocked by two entirely different rules for the same symptom. If I'd argued from the mechanism I assumed, I'd have built the wrong thing and it would have looked like it worked for somebody.

**AI-building learning:** I parked this branch once, explicitly, with a commit message listing three unresolved findings. That felt like failure at the time. It turned out to be the highest-leverage thing in the session — when I came back to it the message told me exactly where to start, and the "tension between the two halves of the ruling" I'd noted at 80% confidence turned out to be the thing that mattered. **Writing down why you stopped is worth more than pushing through**, and the cost of writing it is about four minutes.

**The honest bit:** Six separate governance checks failed on this change and every single one was correct. The config-principle sync twice, the config-consumer check (a constant I'd declared dead that morning became live by afternoon), the deload single-ownership guard, and two assertions from a principle I'd written six hours earlier that this one supersedes. That's the system working — but it's also six chances I had to ship something wrong, in one change, on one afternoon. And a ceiling I'd been enforcing all day nearly got spent by accident: my first build pushed a marathon plan to 18.4% quality against an 18% limit, which I only caught because a sweep across 16,000 plans flagged exactly one of them.

**Hook material:** A user asked for a feature. I said no and explained why. He asked for a smaller version. I measured it — and found the reason I'd given him for the "no" was wrong. Not the answer. The *reason*.

**Postable?:** yes — three strong angles. The four-step bug chain (dev). Parking work with a written reason paying off (AI-building). And the founder-asks-twice story, where the second ask exposed that my first refusal rested on the wrong mechanism.

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
