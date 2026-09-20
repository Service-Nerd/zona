# The backlog, by category

**Regenerated 2026-09-20, end of day.** Sources: `docs/releases/backlog.md` **and**
`docs/releases/roadmap.md`, cross-checked against `docs/canonical/feature-registry.md`.

# 58 open

> ⚠️ **Two corrections to the previous version of this document, both mine.**
> **(1)** It headlined **57** while its own category table summed to **56**. Neither was right.
> **(2)** The parser's open-marker list was missing **🔵**, which silently dropped
> `GRID-EARLY-ONSET-01` and `RUBRIC-GAPS-01`. They had survived only because I added them by hand.
> **A parse is only as good as its marker list, and mine was incomplete twice in one day.**
> The count below is mechanical, the categories sum to it, and both are stated so the next
> discrepancy is visible.
>
> ✅ **Closed today:** nine ships plus `STRAVA-APP-INACTIVE-01` (founder: we are not using Strava)
> and the three flagged copy strings (SLT-ruled; two were wrong and are fixed).
> **Excluded as not-work (10):** vetoed, parked, superseded, record-only, or already shipped.

| Category | Open |
|---|---|
| 🧭 UX & flows | **22** |
| 🏃 Coaching engine — prescription | **10** |
| 🔬 Engine governance & verification | **6** |
| 💰 Commercial & monetisation | **6** |
| 🔧 Infrastructure & ops | **6** |
| 📣 GTM & charity launch | **5** |
| 🎨 UI & design system | **2** |
| ⚖️ Legal, privacy & data | **1** |
| ✍️ Brand, voice & copy | **0** ✅ |
| 🐛 Live defects | **0** ✅ |
| | **58** |

## 🏃 Coaching engine — prescription · 10

*Board owns correctness. ⚠️ Every item here is measured against the 95.9% before it ships.*

| Item | State | Note |
|---|---|---|
| **P-16** base-build on-ramp | 🟢 Board: CORRECT as a two-stage shape · **SLT: not for October** | 8 amendments. ⚠️ **Needs a date or it becomes another item §111 names and nobody builds** |
| **P-17** RED-S / energy availability | 🔴 **Safety item, not a feature** | The one third of the "Sims pattern" that is real. Data question first |
| `S111-SUBFLOOR-VOLUME-01` | 🔴 P0 | **Blocked only on the founder sending `docs/runbooks/charity-volume-question.md`.** My half is done |
| `ULTRA-LR-ADEQUACY-01` | 🟡 | Ultras have **no long-run adequacy check at all**. ⚠️ 50K/100K read 100% fit-for-purpose, which may mean the measurement cannot see it |
| `LOPSIDED-ORDER-01` | 🔴 | §52's third remedy evaluates in the wrong order. **Board confirmed exempt — a defect fix, no sitting needed** |
| `S112-HAZARD-01` | ⏸️ | Unmeasurable — §112 has never fired |
| `INPUT-SEX-01` | 🔲 founder-parked | **An honest null.** No formula we hold reads it |
| `ZONE-BAND-01` · `R27`/ENGINE-03 | ⏸️/⛔ | Blocked on data. R27 additionally on **contested science** |

🔴 **Open and unresolved:** the injury cap is functioning as an **admission mechanism** — a healthy
8 km/wk runner is refused while their knee-history twin is admitted. §111's *second* recorded
inversion, recorded in §80 Am.2, and it needs §111.
⚠️ **Ten instruments that would change prescription are on record as built, measured and rejected.
An eleventh is forbidden without adherence or injury data.**

## 🔬 Engine governance & verification · 6

| Item | State | Note |
|---|---|---|
| `SWEEP-AGE-01` | 🔴 | Sweep pins `age: 35`, so `MASTERS_AGE_THRESHOLD` (45) is never crossed |
| `SWEEP-INJURY-01` | 🔲 | `'Plantar fasciitis'` still unswept |
| `GRID-EARLY-ONSET-01` | 🔵 | ADR-021's early-onset cell — **0 of 45,776 corpus plans reach it** |
| `RUBRIC-GAPS-01` | 🔵 | Our own measurement's negative space. ⚠️ **No adherence or dropout data exists at all** |
| `RACE-KEY-TWO-OWNERS-01` | 🟡 founder decision | Two `raceDistanceKey` functions, different boundaries. Latent, not live |
| `FLEET-INVALID-DEBT-02` | 🔲 | Opt-in refresh for a real runner on an invalid plan |

## 🧭 UX & flows · 22

| Item | State | Note |
|---|---|---|
| **P-15** the refusal gains an action | 🔴 **October deliverable** | No engine change, no board. **Today we refuse and offer nothing** |
| **P-02** modify-plan sheet | 🔲 **L, biggest build** | Ships **without** the intensity row (vetoed). Supersedes `R22`, absorbs parts of `R21`/`R20` |
| **P-04** zone-compliance block | 🔲 | **Now unblocked — P-01 shipped.** ⚠️ Its PAID tier needs your confirmation |
| **P-05** onboarding (2 parts left) | 🔲 | (a) plan-length on tiles, **unblocked and XS** · (b) nameless-runner fallback · (c) cross-training **vetoed** |
| **P-06** plan reveal sequence | 🔲 | Card stack + annotations. Updates `FIRSTRUN-MOMENTS-01` |
| **P-08** code entry | 🔲 **split** | (a) placement conflicts with `GTM-CHARITY-08` — **P1, October** · (b) referral codes P3 |
| **P-10** cold-start sweep | 🔲 | Dead code + the **web-user connect gap** |
| **P-12** profile plan card | 🔲 | State what you have before what you don't |
| **P-14** review prompt | 🔲 | We have **neither** half. (a) is one row |
| `FIRSTRUN-MARATHON-01` | 🔴 | The first-time marathoner is the product |
| `PLAN-NOTE-PLACEMENT-01` | 🔲 SLT-parked | Does the rationale belong at the top of Plan? The teardown independently agreed it might not |
| `MAINT-LABEL-UTILITY-01` | 🔲 SLT-gated | 100% of time-target marathons read `maintenance`; correct, and tells the runner nothing |
| `PLAN-CONCURRENCY-01` · `POSTRUN-PLAN-FEEDBACK-01` | 🔲 parked | Founder-parked / SLT "decide, then audit" |
| `POST-RUN-03` · `POST-RUN-REFRAME-02` · `AI-DEPTH-09` | 🔲 | Gated on APNs / a voice vendor / deferred indefinitely |
| `R18` · `R21` · `R22` · `R24` · `R26` | 🔲 LATER | ⚠️ **`R21`, P-02's strength row and "Supplementary session slots" are three descriptions of ONE feature** |

## 🎨 UI & design system · 2

| Item | State | Note |
|---|---|---|
| **P-13(c)** illustration style | 🔲 **your call** | SLT: commission ONE piece, after P-01. **P-01 has shipped, so this is unblocked** |
| **P-11** launch screen | 🔲 P3 | Gated on footage licensing |

✅ **Shipped today:** `P-01` semantic pair · `P-03` pace ceiling · `P-13a/b` colour sweep + guard.
**P-04's render is counted under UX**; its data and tokens now exist.

## ✍️ Brand, voice & copy · 0 ✅ ALL RESOLVED TODAY

| Was | Outcome |
|---|---|
| The two verdict labels | ✅ **CUT** — the pill reads "Done"; the colour carries the meaning |
| The reflection saved-state | ✅ **KEPT**, one edit — *"Your note is kept. The coach didn't answer."* |
| The Health-connect line | ✅ **CUT** — only *"What we share →"* remains |
| `P-07` coach register · `R19` | 🔴 **Closed.** SLT: don't build. **R19 stays parked — it is NOT unblocked** |

⚠️ **One copy obligation survives and is counted under UX, inside P-04:** the **zero case**.
The SLT gave the shape (*point at the next easy run; no cause, no action, narrow the window*);
**the words are yours**, and two coaching questions must be answered by the board first.

## 💰 Commercial & monetisation · 6

| Item | State | Note |
|---|---|---|
| `TIER-TRIAL-CONFIDENCE-01` | 🔲 **blocking** | The 14-day trial is **not literally full access**. Blocks P-09's timeline copy |
| **P-09** paywall + exit offer | 🔲 | Our annual is **£1.15/wk against their £1.54** — cheaper already, and we don't say so |
| `GTM-FREE-HOOK-01` | 🔲 | The free tier's only AI touchpoint is unreachable by those meant to convert |
| `TT-PRICING-CLAIM-01` | 🔲 | `/pricing` sells a projection absent on **58%** of plans |
| `TT-FREE-BENCHMARK-01` | 🔲 | A free runner is prescribed a benchmark they cannot apply |
| `FIN-APPLE-COMMISSION-01` | 🔲 | Apple's cut modelled nowhere — every unit-economics number is 15% optimistic |

## 📣 GTM & charity launch · 5 — October-dated

`GTM-CHARITY-08` (mint + field-test 500 codes; **conflicts with P-08's placement**) ·
`GTM-CHARITY-05` (admin views cannot see grants — 500 comped runners read as free) ·
`GTM-CHARITY-06` (no per-partner reporting; **one** analytics event exists) ·
`GTM-CHARITY-07` (deletion returns a claimed code to the pool) · `GTM-CHARITY-09` (parked)

## ⚖️ Legal, privacy & data · 1

| Item | State | Note |
|---|---|---|
| `LEGAL-COUNSEL-01` | 🔴 **P1 FOUNDER** | Two hours before October. **The SLT stated it could not rule on this** |
| `STRAVA-APP-INACTIVE-01` | 🔲 external | Founder action at Strava |

✅ **Three of five shipped today** — `ENRICH-PII-MINIMISE-01`, `LEGAL-PRIVACY-01`,
`CONSENT-DISCLOSURE-01`, in that order because the order was load-bearing.

## 🔧 Infrastructure & ops · 6 — mostly founder actions, no code

`OPS-VERCEL-PLAN-01` 🔴 **P0 — Hobby is non-commercial and we sell a subscription** ·
`OPS-SUPABASE-PLAN-01` 🔴 **P0 — breaks at ~250–320 runners, no backups at all** ·
`OPS-ANTHROPIC-CREDIT-01` (at zero, every AI surface degrades for all 500 at once) ·
`OPS-AI-SPEND-01` · `OPS-AI-FAILURE-ALERT-01` · `DEPLOY-QUOTA-01` · `COHERENCE-SELECT-01` ⛔

## 🐛 Live defects · 0

✅ **`REFRAME-NOTE-LOSS-01` shipped today.** It was the only item where a real user lost something
they had created. **Nothing in this category is open.**

---

## What the shape says now

1. **Both P0s are infrastructure, and neither is a line of code.** Vercel and Supabase. Compliance
   and capacity failures that arrive with the cohort.
2. **17 of 57 are October-dated and founder-owned** — GTM, legal, ops. The teardown added nothing
   to the nearest deadline.
3. **The whole UI category is now either unblocked or awaiting your signature.** P-01 shipped, so
   P-04 and P-13(c) are free to move; the only thing standing between them and a build is four
   copy decisions.
4. **P-16 still has no date.** The SLT warned explicitly that without one it becomes another item
   §111 names and nobody builds.

⚠️ **What this count does not prove.** It is a marker parse plus a registry check, corrected by
hand where I recognised a cross-reference. A row marked open that never carried a status glyph
would still be missed — `R18`/`R21`/`R22`/`R24`/`R26` were found only because I knew they existed.
And **nothing here has run on a device.**
