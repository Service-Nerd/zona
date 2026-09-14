# Zonna build-log

Raw learning notes, one entry per ship. Newest first. Dev / product / AI-building
angle. Feeds the weekly DHTB LinkedIn build-in-public posts — keep it honest, keep
it specific, no polish. The content system adds the voice.

---

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
