# SLT: a comparison page answering the gamified running apps (2026-11-20, RUNKED-COMPARE-PAGE-01)

**Input:** founder, 2026-11-20: run each item's one relevant sitting. Item filed 2026-10-30 from
`docs/investigations/competitor-runked-2026-10-30.md`; gate in `docs/plans/COMPETITOR-RUNKED-01.md`.
**This sitting rules on build order only.** Naming a competitor and the words are the founder's; every claim is the
Coaching Board's, through the existing claims gate (re-tag, `coaching-board-open-items-2026-11-12.md`).

**One-line brief:** should a comparison page arguing that a streak-built app cannot tell you to rest be the next piece
of marketing content, and in what form?
**Tier:** FREE (marketing surface).

## Analysis, before any seat spoke

| Item says (2026-10-30) | Re-measured 2026-11-20 | How |
|---|---|---|
| "the comparison series (7 live, page 8 pending)" | **8 live.** Page 8 `/what-is-zone-2-running` published 2026-10-30, returns 200 | `grep -n "kind: 'comparison'" lib/marketing/articles.ts` (8) · `curl -o /dev/null -w %{http_code} https://www.zonna.run/what-is-zone-2-running` |
| Runked: 11 comparison pages | **11**, and one is titled **"Gamified running apps"**, the exact subject of this item | WebFetch `runked.com/guides` |
| Runked: 3.9 stars from 7 ratings | **4.2 from 19 ratings**, v1.2.2 (22 Oct), iPhone only | WebFetch App Store listing |
| Runked: no free tier, $59.99/yr or $11.99/wk | **unchanged** (7-day trial on yearly only) | WebFetch `runked.com/pricing` |
| `COMPETITOR_FACTS` owns competitor prices | owns **4** (coopah, runna, trainasone, garminCoach); Runked is not in it | `lib/marketing/articles.ts:212` |

**Crossover found (gate step 1).** The argument is already half-published: page 1 `/runna-alternatives` is titled
*"Runna alternatives for runners who don't want streaks"* and states *"No streaks, no badges"* (`articles.ts:398–455`,
10 mentions of "streak" in the catalogue). No live page owns **"gamified"** (0 occurrences). So a page here **extends a
position we already hold**, it is not a new one.

**Traffic.** ⚠️ **Not measurable.** Vercel Web Analytics is **not enabled** on the `zona` project
(`vercel api /v1/query/web-analytics/visits/aggregate` → *"Web Analytics is not enabled for this project (400)"*), and
the repo carries no other page analytics. Nobody can say whether any of the 8 comparison pages has a reader. Traynor's
recall trigger (revenue, trial-to-paid, a funnel, installs) is not met; his standing objection, *"what is the traffic?"*,
stands unanswered.

**Settled ground.** SLT 2026-09-21 (who writes the content): Claude drafts, founder reads every word, competitor facts
from `COMPETITOR_FACTS` only, first-person content founder-only. GTM-SEO-PLANS-01 Wave 3 was **parked pending data**
on the same reasoning (do not double an unmeasured bet).

## The board

🧠 **Sutherland.** Runked has seven-and-a-bit thousand reasons to want us to name them and we have none. Nineteen
ratings: naming them gives a one-developer app oxygen it has not earned, and makes us look like we noticed. Answer the
**category**. "Gamified running apps" is a search a person types; "Runked alternatives" is not yet. And the argument is
costly signalling done properly: an app that sells streaks cannot say *rest* without contradicting its own business,
and we can. That is the line. Put it on a page about the category and let the reader find out who it describes.

📦 **Fried.** One page, one catalogue entry, one shim. The machinery exists, the facts gate exists, the claims gate
exists. My objection is not the cost, it is that we keep shipping pages into a site with **no measurement at all**.
Eight pages and nobody knows if one has been read. I will vote for this because it is cheap and it extends page 1, not
because I believe it works. It goes **after** the measurement exists, or it goes knowing it adds to a bet nobody is
scoring.

🏃 **Hutchinson.** Coaching hat, briefly: *"an app built on streaks cannot tell you to rest"* is a behavioural claim
about the product, but the moment the page says what rest **does** (adaptation, injury, §2/§3), it is a physiology
claim and it goes through the claims gate like pages 6, 7 and 8 did. No new physiology on this page that a principle
does not already carry. Runked's guide leans on Gabbett's 1.5 "danger zone"; if we answer that, we answer it with §129's
wording, which already refused the "where injuries happen" line.

🔬 **Wood.** Streaks work. That is the uncomfortable part, and the page should not pretend otherwise: they produce
automaticity, of the wrong behaviour. The honest contrast is context, not motivation: a streak makes *running today*
the default; we make *the right effort today* the default, including none. If the page says "streaks are bad", it is
wrong. If it says "streaks make every day a run day, and some days should not be", it is right.

🧭 **Zhuo.** This is one item, not a programme. It is page 9 or it is an extension of page 1, and that is the founder's
call because it is about naming. My condition: state the success measure **before** writing it, and the only honest
one available is "it ships and is read end to end by the founder". That is a delivery measure, not an outcome measure,
and we should say so in the note rather than pretend.

## Conflicts

- **Sutherland vs the item's framing:** the item says Runked's facts *"enter `COMPETITOR_FACTS`"*, which presumes the
  page names Runked. Sutherland argues for the category without the name. Unresolved here: naming is the founder's.
- **Fried vs Sutherland on timing:** Fried would rather the measurement came first; Sutherland would ship now because
  the argument is already ours. The board does not make measurement a precondition (that would be new work, and the
  founder said not to invent it); it records that this page, like the eight before it, cannot be scored.

## Ruling

**BUILD, in this form, after the founder's two calls.** One catalogue entry in `MARKETING_ARTICLES` on the existing
`ArticlePage` + shim, answering the **category** ("gamified running apps"), extending the no-streaks position of page 1
and interlinking with it. Build order: it is the **next comparison page**, ahead of any second guide
(`RUNKED-GUIDES-01`), because it is one page that extends a held position at zero engine cost.

Conditions:
1. 👤 **Founder first:** (a) name Runked or answer the category; (b) page 9 or an extension of page 1. If Runked is
   named, its price, platform and free-tier facts enter `COMPETITOR_FACTS` with a `verified` date before any copy
   reads them (re-verified today: $59.99/yr, $11.99/wk, iPhone only, no free tier).
2. 🏃 **Coaching Board, via the claims gate:** every claim about rest, adaptation or injury cites an existing principle;
   anything new goes to the board first (SLT 2026-09-21).
3. The page is added to `lib/marketing/noEmDash.test.ts`'s `SURFACES` and gets a `pageNClaims.test.ts` like pages 6–8.
4. The note states the page cannot be scored: no page analytics exist on the site.

**Hand-offs:** 👤 founder (naming, page 8/9 placement, copy) → 🏃 Coaching Board (claims only).

## MUST/NEVER check
No streak, badge or league is proposed, only argued against. Prices from `COMPETITOR_FACTS` / `BRAND.PRICING`, never
typed. No em dashes in the page copy. Brand name via `BRAND.name`.

## Risks to existing features
None to the app. Marketing: page 1's no-streaks copy and this page must not drift apart; interlink, do not restate.

## What this does not prove
That anyone reads comparison pages (not measurable: no analytics). That "gamified running apps" has search volume (not
measured; no SEO tool authorised). Runked's downloads or revenue (no public data). Nothing was seen inside Runked's app.
