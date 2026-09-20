# Research — P-13(c) illustration and P-11 launch screen: do we need to buy anything?

**Date:** 2026-09-20 · **Asked by:** the founder — *"commission an illustrator for what? A picture
of what? Is there nothing we can get online for free?"*

**Answer: buy nothing. One half is code we can generate and it beats the drawing. The other half
is probably not a gap.**

---

## What P-13(c) actually asked for — two different things, bundled

The decision note asks for *"a line-art illustration style, used in at least two places so it is a
system and not a one-off: the generating ceremony (P-06) and the Coach empty states."*

Those are not the same problem and only one of them is an illustration.

---

## 1. The ceremony graphic — **we can generate it, and it is better than a drawing**

**What Miles has** (`IMG_7180`): stick figures running a rising-and-falling curve. The decision
note names the value precisely, and in doing so answers itself:

> *"The value in theirs is that the drawing **is the volume curve**; a stock pack cannot know that."*

**Neither can a commissioned one.** A drawing of *a* volume curve is a generic curve. We hold the
runner's own:

| What we have | Where |
|---|---|
| `Week.weekly_km` on every week | `types/plan.ts:316` |
| SVG polyline rendering, already shipped | `components/shared/TrendSparkline.tsx` + `lib/coaching/trendSparkline.ts` |
| Deload / race-week / phase marking | `components/shared/PlanArc.tsx` |

⚠️ **`PlanArc` is NOT this.** It draws equal-height bars showing week *status* (done / current /
deload / race). It says nothing about volume. **No volume curve exists anywhere in the product.**

**What the ceremony shows today:** three shimmer skeleton cards (`GeneratingCeremony.tsx:70`). The
note calls it *"a skeleton: functional, cold"* and that is fair.

**Recommendation.** Render the runner's own volume curve. It is **more specific than any drawing
can be**, it costs nothing, it uses machinery we already ship, and it is *information* rather than
decoration — which is the side of the line this brand is on.

⚠️ **One honest caveat: during the ceremony the plan does not exist yet.** The curve can only be
drawn from the *projected* shape, or revealed at the end as the first thing the runner sees. That
is a real sequencing constraint and it belongs with **P-06**, not here.

## 2. The Coach empty states — **free options exist, and the better question is whether we want one at all**

**Free, commercially usable, real:**

| Source | Licence | Note |
|---|---|---|
| unDraw | free, no attribution required | Recolourable to a single brand colour, which fits Warm Slate exactly |
| Open Peeps | CC0 | Hand-drawn, mix-and-match |
| Humaaans | CC BY | Attribution required |
| Storyset | free with attribution | |

**So "is there nothing free?" — yes, there is plenty, and the note's rejection of packs was a taste
objection, not a licensing one.** unDraw in particular is free and recolours to `--moss` in one
pass. The real cost is that it is the single most recognisable illustration set on the internet;
a reader who has seen three startup landing pages has seen it.

🔴 **But the question nobody asked is whether an empty state should carry a picture.** The brand
rules are *"restraint is the feature"*, *"no dashboards or noise"*, *"one job per screen"*. An
illustration in an empty state is decoration in a product whose whole argument is the absence of
decoration. **Miles having one is not evidence we need one** — they are a different brand making a
different promise.

**Recommendation: no illustration.** Not "commission later" and not "use a free pack" — the empty
states should be text, in voice, and the voice is our strongest asset.

## 3. P-11 launch screen

Same shape. Free stock video exists and is commercially usable (Pexels, Pixabay, Coverr). ⚠️ §6's
non-identifiable rule still applies to anyone in frame.

**But a launch screen with stock running footage is the single most generic thing a running app can
do**, and we do not currently have a launch screen problem — the Capacitor splash holds and hands
off to the web mount.

**Recommendation: close it.** Not blocked on budget; not worth doing.

---

## What this changes

| | Was | Now |
|---|---|---|
| P-13(c) | "commission an illustrator — founder's call, budget" | **No commission.** Volume curve → folds into **P-06**. Empty-state illustration → **recommend no** |
| P-11 | "gated on footage licensing" | **Recommend close.** Not a licence problem, not a gap |

**Nothing here needs money and nothing here needs a designer.**

## ⚠️ What this does not prove

- **Nothing has been drawn or prototyped.** The claim that a volume curve reads better than a
  skeleton is a judgement, not a test, and **nobody has seen either on a device.**
- The free-licence summary is from public terms and **is not legal advice**; if any asset ships,
  the licence gets read properly first.
- **This is a taste call made against the documented rule**, per the standing instruction that
  design verdicts are mine to make and not the founder's to give.
