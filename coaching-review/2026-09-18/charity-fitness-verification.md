# Charity cohort — fit-for-use verification, end of 2026-09-18

**The founder's standing bar: every charity runner's plan must be 100% fit for
use, first and foremost.** This file is that claim, measured, after the day's
engine changes (§113 Am.1, §28 Am.1, S106-RACE-PEAK-01). The morning's round was
run before all three and is superseded by this.

## Result: 14 of 14 personas can get a plan. 0 error violations on every one.

| persona | plan | errors | net build | peak LR | neuro | profile |
|---|---|---:|---:|---:|---|---|
| M1 first-timer, low base, long runway | 20wk | 0 | 161% | 26km | yes | maintenance |
| M2 charity, low base, COMPRESSED 12wk | 12wk | 0 | 68% | 30km | yes | maintenance |
| M3 returning + knee history | 18wk | 0 | 79% | 30km | yes | maintenance |
| **M4 sub-4:00, 3-day, 45-min cap** | **16wk** | **0** | — | — | yes | maintenance |
| M5 masters charity (58) | 20wk | 0 | 94% | 30km | yes | build |
| H1 first-timer HM, very low base | 16wk | 0 | 136% | 16km | yes | build |
| H2 charity HM + shin splints | 14wk | 0 | 46% | 15km | yes | build |
| H3 sub-2:00 HM | 13wk | 0 | 43% | 18km | yes | build |
| T1 couch-to-10K charity beginner | 10wk | 0 | 80% | 7km | yes | build |
| T2 sub-50 10K improver | 11wk | 0 | 22% | 15km | yes | build |
| T3 masters 10K + knee (55) | 12wk | 0 | 35% | 7km | yes | build |
| T1d couch-to-10K, DECLARES intermediate | 10wk | 0 | 90% | 8km | yes | build |
| H1d first-timer HM, DECLARES intermediate | 14wk | 0 | 86% | 15km | yes | build |
| M1d first-timer, DECLARES experienced | 18wk | 0 | 139% | 26km | yes | maintenance |

Every plan builds (22%–161% net), every plan carries neuromuscular stimulus
(strides / hill strides, §28 Am.1 shipped today), every plan validates clean.

## ⚠️ M4 is the one that needs stating precisely

M4 **refuses on first pass** — `DaysAvailableError`, §52: three days a week is
under the four a *time goal* needs for a marathon. **It is not a dead end and it
is not a block.** It is a warn-and-acknowledge gate, and it offers three
alternatives, all of which were followed and tested:

1. *"Increase your training days from 3 to 4 per week."*
2. *"Race the half marathon at this event instead."*
3. *"Switch goal to finish"* → **verified: generates a 16-week plan.**

And the acknowledgement path itself: with `acknowledged_days_warning` the same
runner gets a **16-week plan, 0 error violations**, carrying the honest note
*"3 days a week is under the 4 days a time goal needs for a marathon. The plan
will build at maintenance volume, so expect to finish rather than hit the time."*

**So M4 is fit for use.** The runner is told the truth about a sub-4:00 target on
three days a week and gets a plan either way. Refusing to promise a time we
cannot deliver is the product working, not failing.

## What this does NOT prove

- **None of it has run on a device.** Every figure here is from the engine.
  `DEVICE-VERIFY-01` remains the open gap and only the founder can close it.
- It covers the **14 defined personas**, not every runner who will hold a code.
  The measured door for a beginner marathon is **12 km/week** (was 16 this
  morning). A genuine 5–10 km/week first-timer is still refused by §111, and
  that is `S111-SUBFLOOR-VOLUME-01`, still open.
- `volume_profile: maintenance` on four marathon personas is correct and drives
  real safety behaviour, but whether a first-timer should ever see language
  derived from that label is `BRAND-MAINT-LABEL-01` (SLT, open).
