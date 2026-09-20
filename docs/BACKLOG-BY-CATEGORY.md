# The backlog, by category

**Regenerated 2026-09-20, after the day's nine ships.** Sources: `docs/releases/backlog.md`
**and** `docs/releases/roadmap.md`, cross-checked against `docs/canonical/feature-registry.md`.

**57 open items.**

> ⚠️ **Derivation, because the number moved and the reason matters.** The first version of this
> document said **73**, parsed from `backlog.md` alone. That was wrong in two directions.
> **`roadmap.md` is the live register for engine work** and holds items with detail that never
> reached the backlog. And **eight stale rows across both files** were marked open while a
> feature-registry row already existed — including three of today's own ships. Every ID here was
> re-checked against the registry, and **nine more were excluded as not-work** (vetoed, parked,
> superseded, or record-only). Both files have been corrected.

---

## The categories

You proposed **coaching engine · user experience · user interface**. They cover 27 of 57. Seven
more earn their place because the work, the owner and the decision-maker all differ.

| Category | Open | Why it is separate |
|---|---|---|
| 🧭 UX & flows | 15 | |
| 🏃 Coaching engine — prescription | 8 | Board owns correctness |
| 🔧 Infrastructure & ops | 7 | **Mostly founder actions on external accounts. No code at all.** |
| 💰 Commercial & monetisation | 6 | SLT-owned |
| ⚖️ Legal, privacy & data | 2 | Founder + counsel. Not ours to decide |
| 📣 GTM & charity launch | 5 | **October-dated. A deadline is a category** |
| 🔬 Engine governance & verification | 6 | Not prescription — the harness that proves it. No board |
| 🎨 UI & design system | 4 | |
| ✍️ Brand, voice & copy | 3 | **Every item needs your sign-off (§4A)** |
| 🐛 Live defects | **0** | ✅ **The one that existed shipped today** |

**UX and UI stay separate.** UX is what happens; UI is what it looks like. Different reviewers,
different failure modes.

---

## 🏃 Coaching engine — prescription · 8

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

## 🧭 UX & flows · 15

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

## 🎨 UI & design system · 4

| Item | State | Note |
|---|---|---|
| **P-13(c)** illustration style | 🔲 **your call** | SLT: commission ONE piece, after P-01. **P-01 has shipped, so this is unblocked** |
| **P-11** launch screen | 🔲 P3 | Gated on footage licensing |
| **P-04**'s render | — | Counted under UX; the data and tokens now exist |
| Verdict labels + `saved` state + disclosure line | ⚠️ **awaiting your sign-off** | Three strings shipped in voice and flagged (§4A) |

## ✍️ Brand, voice & copy · 3

| Item | State | Note |
|---|---|---|
| **The zero case** (P-04) | ⚠️ **needs your words** | *"None held the zone this week"* alone is a scold. SLT shape: **carry a cause or an action, never a bare count** |
| Three flagged strings | ⚠️ **needs sign-off** | The two verdict labels, the `saved` state, the Health-connect line |
| ~~`P-07`~~ · ~~`R19`~~ | 🔴 **closed** | SLT: don't build. **R19 stays parked — it is NOT unblocked** |

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

## ⚖️ Legal, privacy & data · 2

| Item | State | Note |
|---|---|---|
| `LEGAL-COUNSEL-01` | 🔴 **P1 FOUNDER** | Two hours before October. **The SLT stated it could not rule on this** |
| `STRAVA-APP-INACTIVE-01` | 🔲 external | Founder action at Strava |

✅ **Three of five shipped today** — `ENRICH-PII-MINIMISE-01`, `LEGAL-PRIVACY-01`,
`CONSENT-DISCLOSURE-01`, in that order because the order was load-bearing.

## 🔧 Infrastructure & ops · 7 — mostly founder actions, no code

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
