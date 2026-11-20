# SLT: easy-running guides on the searches Runked owns (2026-11-20, RUNKED-GUIDES-01)

**Input:** founder, 2026-11-20: one relevant sitting per item. Item filed 2026-10-30; gate `docs/plans/COMPETITOR-RUNKED-01.md`.
**This sitting rules on build order for extending and interlinking guides.** The founder reads; every claim is the
Coaching Board's through the claims gate (re-tag, `coaching-board-open-items-2026-11-12.md`).

**One-line brief:** Runked has dozens of guides on our subject and we have one; what, if anything, do we write next?
**Tier:** FREE (marketing surface; three guide titles are a coaching surface, SLT 2026-09-21).

## Analysis, before any seat spoke

| Item says (2026-10-30) | Re-measured 2026-11-20 | How |
|---|---|---|
| Runked has 66 guides | **66 listed under Guides, 68 under `/guides/` URLs** (two sit under Comparisons) | WebFetch `runked.com/guides` |
| we have 1 guide and 7 comparison pages | **1 guide, 8 comparison pages** | `grep -c "kind: 'guide'"` / `"kind: 'comparison'"` in `lib/marketing/articles.ts` |
| their topics on our ground: zone 2, 80/20, signs of overtraining, recovery-run pace | all four still listed by Runked. **Ours: zone 2 is now covered three times** (guide 1, page 6, and page 8 `/what-is-zone-2-running`, published the day this item was filed). **80/20: 0** occurrences in the catalogue. **Recovery-run pace: 0.** **Overtraining: 0 published pages** | `grep -ci` over `articles.ts` |
| "extend and interlink" | page 6 and page 8 already link guide 1 and each other; **guide 1 links out only to `/plans`**, so it is the one unlinked node | `grep -n "href:" lib/marketing/articles.ts` |

🔴 **The live `/guides` hub already promises a guide that does not exist.** Its meta description (`GUIDE_HUB`,
`articles.ts:1236`, served at `https://www.zonna.run/guides`, 200) reads *"…how slow easy should feel, and whether you
are overtraining or just tired."* Only the first half has a page.

**Cadence, settled ground.** SLT 2026-09-21: *"write ONE guide and stop"*, and Fried: *"do not write the second until
the first has existed for a fortnight."* Guide 1 published 2026-09-21; the fortnight elapsed on 2026-10-05; **no second
guide has been written in the 46 days since.** The cadence was meant to "learn whether anyone wants these", and
⚠️ **that learning is impossible: Vercel Web Analytics is not enabled on the project** (API returns *"Web Analytics is
not enabled for this project (400)"*) and no other page analytics exist. So the fortnight produced no signal either way.

**Hutchinson's three coaching titles (2026-09-21):** *should my easy runs feel this slow* (§12, shipped as guide 1),
*am I overtraining or just tired* (§2/§3), *what pace should my long run be* (§52).

## The board

🧠 **Sutherland.** Sixty-six guides is a content farm and we will lose a volume war to anyone with a weekend. Do not
play it. The hub's own description has already made a promise, *overtraining or just tired*, and an unkept promise on a
page is worse than no page. Keep it. One guide, the one we said we would write.

📦 **Fried.** Why sixty-six? Because they have sixty-six. That was competitor-chasing on 21 September and it still is.
I said write one and wait a fortnight; we waited seven weeks and learned nothing, because nothing measures it. I am not
going to pretend the cadence produced evidence. So: one more, the one already promised, and no series. And I note,
again, that the measurement is the thing missing, not the second article.

🏃 **Hutchinson.** "Am I overtraining or just tired" is the title I flagged as a coaching surface, and it is the most
dangerous one on the list to get wrong in public: overtraining syndrome is rare, functional overreaching is common, and
"tired" is usually under-recovery. The guide says what §2/§3 already prescribe (load ramp, deloads) and nothing the
engine does not do. 80/20 is a Seiler distribution claim: if we ever write it, it states **our** §1 (`INTENSITY_DISTRIBUTION`)
and the five-zone translation (INV-COACH-004: Seiler's "Zone 2" is our grey zone), or it does not ship. Recovery-run
pace is §12 territory and guide 1 already answers it in substance; a second page would repeat page 6.

🔬 **Wood.** The overtraining guide is the only one of the four that meets a runner at a decision point: they are
tired, they are deciding whether to run. That is a context guide, not a motivation guide. A zone 2 explainer number four
changes nobody's behaviour; we already have three.

🧭 **Zhuo.** Two things here, and they should not be bundled. (1) Guide 1 links to nothing on our own ground: that is a
link, not a build, and it is what "interlink" in the item actually reduces to. (2) One new guide, title already chosen
by a previous sitting. Neither is a series. The success measure is the same honest one as the comparison page: shipped
and read by the founder, because outcome cannot be measured.

## Conflicts

- **Fried vs the item's premise.** The item frames the gap as "66 vs 1"; Fried rejects volume as the measure outright.
  The board sides with Fried: no series is authorised.
- **Hutchinson vs the item's topic list.** Two of the four topics (zone 2, recovery-run pace) are **already covered**;
  80/20 carries a zone-label trap. Only overtraining is both uncovered and already promised.

## Ruling

**BUILD DIFFERENTLY: one guide and one link fix, no series.**
1. **Interlink first (no new copy):** guide 1 gains outbound links to page 6 and page 8, which already link to it.
2. **Then ONE guide: "am I overtraining or just tired"** (§2/§3), the title Hutchinson named on 2026-09-21 and the one the
   live `/guides` meta description already promises. It goes **after** `RUNKED-COMPARE-PAGE-01` in build order.
3. **Not authorised:** a zone 2 guide (three pages cover it), a recovery-run-pace guide (guide 1 + page 6 cover it), an
   80/20 guide (deferred: the zone-label translation makes it a Coaching Board question first), and any series.

Conditions: the guide carries `principleRefs` (§2, §3 at minimum) and passes the claims gate; founder reads every word;
the note states it cannot be scored (no page analytics).

**Hand-offs:** 👤 founder (reads) → 🏃 Coaching Board (claims only, via the claims gate).

## MUST/NEVER check
No em dashes in guide copy; brand name via `BRAND.name`; no physiology claim without a principle; INV-COACH-004 applies
to any 80/20 wording.

## Risks to existing features
`GUIDES_SECTION_MATURE = 3`: a second guide leaves the hub below "mature", so the hub keeps its young-section note.
No app surface touched.

## What this does not prove
Whether any guide is read (no analytics). Search demand for any title (no SEO tool authorised). Whether Runked's guides
rank (not measured).
