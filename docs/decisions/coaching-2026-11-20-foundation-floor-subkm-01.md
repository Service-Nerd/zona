# Coaching Board — `FOUNDATION-FLOOR-SUBKM-01` · 2026-11-20 · ⛔ MOOT AS FILED (no change; the tripwire stays)

**Input:** founder instruction, 2026-11-20. The item: `INV-PLAN-FOUNDATION-BLOCK` fires at the very bottom of the volume
range. At `current_weekly_km: 1` a foundation week is built at **1.5 km** against §57's ceiling of **1.1 km**
(`cw × 1.10`). *"Two ratified rules that cannot both hold below ~1.4 km/week."* Its own note: **reachability
unmeasured**. The brief asks for reachability to be measured before the board sits.

**Trigger:** soft. The item asks which of two rules yields, which is a prescription question if anyone can reach it.

---

## Analysis (before any seat spoke)

All figures: `NODE_ENV=production npx tsx scripts/board-evidence-foundation-floor-subkm-01.ts` (read-only: generates
plans in memory, one SELECT on `plans`).

### 1. Where the two rules cross: measured, not "~1.4"

180-input probe per volume (5K/10K/HM/marathon × longest run 0/1/2 × runway 16/20/24/30/40 weeks × 3/4/5 days). 90
generate a race plan and 9 of those carry a foundation block:

| declared km/wk | min foundation week | §57 ceiling | volume-arm fires |
|---|---|---|---|
| 0 | 0 | 0.00 | 0 (arm skips `statedKm > 0`) |
| 0.5 · 1 · 1.2 · 1.3 | **1.5** | 0.55 · 1.10 · 1.32 · 1.43 | **27 on 9 plans, each** |
| 1.4 · 1.5 | 1.5 | 1.54 · 1.65 | 0 |
| 2 · 3 · 5 | 2 · 3 · 5 | 2.2 · 3.3 · 5.5 | 0 |

The conflict lives in **0 < cw < 1.5 / 1.10 ≈ 1.36 km/week** and nowhere else. **The item's "192 fires" was not
re-derived.** The grid that produced it is not named (it came out of the `GETRUNNING-WALKRUN-FLOOR-01` measurement). On
this probe the count is 27 per sub-crossing volume.

### 2. Can any producer send such a volume?

| producer | sub-crossing reachable? |
|---|---|
| **Wizard** (`GeneratePlanScreen`, the only UI writer of `current_weekly_km`) | **No.** The ruler is `WEEKLY_KM_MIN 0`, `WEEKLY_KM_STEP 5`: it sends 0, 5, 10… |
| **Checkpoint, pass** (`checkpointRaceInput` with OBSERVED volume) | **No.** It only builds a race plan once observed volume reaches the door, far above 1.4 |
| **Checkpoint, `run_walk` choice** (`runWalkFinishInput`) at observed 0.3–1.3 km/wk | **0 of 360 probes** yield a race input |
| **Checkpoint, `half` choice** (`halfSameDayInput`) at observed 0.3–1.3 km/wk | **0 of 90 probes** yield a race input |
| **Checkpoint, `extend`** | Builds a staged/base-build plan, whose weeks are `base_build`, not `foundation`, so outside this invariant |
| **Direct API call** | The route accepts any non-negative number (`inputs.ts`: *"zero is fine"*). The only client is our own app |

⚠️ The checkpoint is the one producer that **can** carry a non-ruler volume. `observedCheckpointKm` is a mean floored to
1 dp, so 1.0 is possible. It is the reason this was probed rather than assumed.

### 3. Production

**43 plans · 36 stamped with `generator_input` · 0 off-ruler declared volumes · 0 in (0, 1.4) · 7 carry foundation weeks ·
volume-arm fires 0.** The declared values present are 0, 5, 10, 15, 20, 25, 30, 40, 45, 60.

### 4. Settled-ground scan

- **§57** (Foundation Block): the block grows to `baseline × 1.10`; `INV-PLAN-FOUNDATION-BLOCK` volume arm at **error**.
- **`FRESH-FLOOR-01`** (2026-09-04, `foundationBlock.ts`): when the week is smaller than one session, *"hold at the floor
  and exceed the stated number slightly, rather than ship a session that looks compliant and trains nothing"*, citing
  **D-21** and the §82 weekday-cap precedent. **The producer's side of this conflict is therefore already ruled: the floor
  holds.** The 1.5 km is the runner-resolved floor (`CB-SUBFLOOR-ADMIT-01`), not the flat 4 km.
- **D-21**: a principle that cannot be satisfied is a defect in the principle. **CD-22**: binding where reachable,
  recorded where not.
- **§116 floor note / §117 Am. 7**: below §116's running floor, or with a declared longest run under 2 km, the block
  *starts* with walk-run. A runner declaring ~1 km/week is that runner.
- **The §2 / §116 Am. 2 precedent the item cites** is pinned by tests, not fixed. Same shape here.

**Conflict scan result:** no live contradiction. The two rules cross only on an input no producer sends. The producer's
choice at the crossing (floor holds) is already ruled by FRESH-FLOOR-01 under D-21. Only the checker's volume arm does not
know that ruling. That is CD-22's *recorded where not reachable*.

---

## The sitting

### 🏃 Alex Hutchinson (chair)
The item said two ratified rules cannot both hold. That is true in arithmetic and empty in practice. The wizard steps by
five. The one producer that carries an observed fraction builds nothing in that band: 0 of 450 probes. Production holds
zero such inputs. And the "conflict" is already answered on the producer's side: FRESH-FLOOR-01 decided in September that
a session too short to train anything is not shipped to satisfy a weekly number. **There is no decision left for this
board. The question is whether we touch the checker, and I say no.** An error-severity arm on a band nobody reaches is
not noise. It is a tripwire. If a future producer starts sending sub-1.4 volumes, it reddens dev and test the first time
that path is generated, which is exactly when we want to know.

### 📊 Stephen Seiler
No intensity content: every foundation session is easy. No objection.

### 🎯 Greg McMillan
Nobody who runs a kilometre a week needs a "foundation block". They need to start walking and running. Since nobody can
get here, I would not spend a principle on it.

### 🩹 Rich Willy
Agreed. One thing for the record so the next sitting does not re-litigate §57 against the floor: **if this band ever
becomes reachable, the answer is not to pick which of those two numbers yields. It is routing.** A runner below ~1.4
km/week belongs on the walk-run start, under §116's floor note and §117 Am. 7, not in a 1.5 km continuous foundation
week. The tripwire firing should send someone to the router, not to the ceiling.

### ⚕️ Stacy Sims
No objection from this seat.

### 💪 Richard Blagrove
No strength question. Silent.

---

## ⚡ Recorded disagreements
None.

## ⚖️ Ruling: ⛔ MOOT AS FILED — no change

1. **Unreachable, measured.** No producer sends 0 < `current_weekly_km` < 1.36: the wizard ruler steps by 5; the
   checkpoint's run-walk and half choices yield 0 race inputs in 450 probes at observed 0.3–1.3; the pass path needs the
   door. Production holds 0 such inputs and 0 fires.
2. **The producer's behaviour at the crossing is already ruled.** FRESH-FLOOR-01 under D-21: the floor holds and the
   stated number is exceeded slightly. This is not two ratified rules in deadlock.
3. **The error-severity volume arm is kept unchanged, as a tripwire.** Demoting it to a declared-residual `warn` would
   remove the signal that a producer has started reaching the band, on a band with no runner in it.
4. **Willy's condition, binding on any future sitting on this band:** if the tripwire fires on a reachable input, the
   remedy is **routing to the walk-run start** (§116 floor note / §117 Am. 7), not a §57-vs-floor amendment.

**The item closes.**

### 📦 Required artifacts
None. No principle, numeric or invariant changes. The tripwire is the existing `INV-PLAN-FOUNDATION-BLOCK` volume arm.
It was **shown live in this sitting**: 27 fires on 9 plans at each of cw 0.5–1.3, and 0 at cw 0 and cw ≥ 1.4.

### ↗️ SLT escalation
None.

---

## What this does not prove

- **The 192 is not reconciled.** Its source grid is unnamed. This sitting's 27-per-volume figure comes from a different,
  stated grid.
- **The probe has limits.** No injury history, no blocked days, age 38, `max_weekday_mins` 60, plan start pinned to
  2026-11-23. Foundation blocks appeared on 9 of 90 race plans per volume. A wider runway axis would build more of them
  but cannot move the crossing, which is arithmetic (1.5 / 1.10).
- **The checkpoint probe** called `runWalkFinishInput` / `halfSameDayInput` directly with a constructed original input
  (cw 5, lr 2, 3 days). It did not drive `evaluateCheckpoint` with a stored staged plan and logged loads.
- **A direct API client** could send cw 1. That is outside the product's own clients and not measured.
