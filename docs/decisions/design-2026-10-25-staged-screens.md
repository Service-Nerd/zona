# Design Board — NO-RUNNER-TURNED-AWAY-01, the staged-plan screens as rendered (2026-10-25)

**Trigger:** soft, qualifies. The screens were rendered for the first time (local harness `/staged-preview`, 375px, real
engine output, a 5 km/week marathoner 26 weeks out, the real wizard walked to its preview). Four defects.
**Tier:** every tier.

## Settled-ground scan

Design Board 2026-10-24 amendments 2 (base phase card names the checkpoint), 3 (race block outline), 9 ("Walk-run start"
first phase), 10 (one runner-facing name, **"Base building"**). `ui-patterns.md` §12: rail labels ellipsise; the
**known limit** was ruled for a **one-week phase** (line 1644), not for every phase of a staged plan.
`design-rulings.md` (PREVIEW strip removal): **two week counts for one plan on one scroll is a defect**. §37d
`PlanHeroMetrics`. Words are the founder's.

## Evidence (live DOM, 375px)

| | Measured |
|---|---|
| Rail "Walk-run start" | needs **102px**, has **93** (7 of 26 weeks) |
| Rail "Base building" | needs **87px**, has **66** (5 of 26) |
| Hero | **"12 weeks · 9km biggest week · 33km in total"** (the built weeks) above an arc reading **"Wk 1 of 26"** |
| Walk-run phase card | title and "7 weeks", **no line** |
| First-run card | **"Wednesday. 30 min. Easy."** for a walk-run session (`effortWord` maps every non-hard type to Easy) |

Not measured: a device.

## The board

**🧭 Zhuo (chair).** Four defects, one test for each: does the runner read the plan they actually have?
**✋ Silvanto.** (1) Truncating the two names amendment 10 chose is the rail failing at its one job. Wrap to two lines
before ellipsis; the type does not change. No veto. (2) Two week counts on one scroll is already ruled a defect. The
hero's horizon must match the arc's: the weeks to the race.
**🎓 Sierra.** (2) "33 km in total" on a marathon plan tells a beginner the marathon is 33 km of training. That is a
false lesson. On a staged plan the hero says what the runner is working toward now: the checkpoint.
**📱 Wroblewski.** (4) "Easy" is not wrong for effort, but it is the wrong noun: the session is named Walk-run on every
other surface. Use the session's own name. (3) An empty card body reads as a rendering failure.
**🎪 Collins.** (1) Do not shorten the names to fit; amendment 10 was mine and "Base" collides with the race plan's
base phase. Wrap.

## Ruling — SHIP WITH AMENDMENT

| # | Ruling |
|---|---|
| **S1** | Rail labels **wrap to two lines** (10px, same weight) before they ellipsise; ellipsis only for a single word that cannot fit. Every plan, not only staged ones |
| **S2** | On a staged plan, `PlanHeroMetrics` states the **weeks to the race** (the arc's denominator), the **checkpoint target**, and the **checkpoint date**. Labels are the founder's |
| **S3** | The walk-run phase card carries one line. Words are the founder's |
| **S4** | The first-run card names a walk-run session **"Walk-run"** (the session's own label), never "Easy" |

## Artifacts (at build)

1. **Pattern** — `ui-patterns.md` §12 (rail wrap), §37d (staged hero), the staged race plan section (S3, S4).
2. **Token/constant** — none new; the labels and line in `checkpointCopy.ts`.
3. **Checks** — markup arms: the rail label is not `nowrap`; the staged hero's weeks equal the arc's total; the walk-run
   card has a line; the first-run effort of a walk-run session is "Walk-run". Each falsified.
4. **Register row** — `design-rulings.md`.

## What this does not settle

The words (S2 labels, S3 line). How it feels on a device.
