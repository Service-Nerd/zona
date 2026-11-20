# Design Board — 2026-11-20. `METRIC-TOGGLE-SCOPE-01` — is the distance/duration toggle the wrong instrument?

**Trigger:** soft, qualifying — the question is whether a runner-facing setting (Me → Display, the per-session flip,
push copy under ADR-015 INV-PREF-001) should exist. Filed 🧭 DESIGN BOARD → 💼 SLT.
**Change proposed (Collins, 2026-10-06):** *"the lead slot takes the SESSION's own unit, and the toggle governs how
distances are written (km vs mi) rather than which fact is the headline."*
**Tier:** FREE.
Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins.

The item's own instruction: *"Do not re-propose without re-measuring. E shipped after this was filed, so the 29.2% figure
is historical — take the post-E number first."* Taken below, before any seat spoke.

---

## 📐 Analysis — the post-E number, and what moved

Evidence: `scripts/board-evidence-design-sittings-2026-11-20.ts`, `NODE_ENV=production`, cohortGrid **stride 131**
(304 plans), every row `buildSessionRows` emits (the component's own producer), strides excluded, km; plus a throwaway
read-only probe of the work steps' prescribed length (deleted after use; output quoted).

| Measure | Filed / earlier | Today |
|---|---|---|
| Lead unit switched mid-block | 29.2% (dist) / 33.2% (dur), pre-E | superseded by E; residual filed as `STEP-ZONE-RANGE-01` / `STEP-UNIT-OWNER-01` |
| Rows leading in the chosen metric, **distance** setting | 83.68% (founder decision 2026-10-07, 260,047 rows, its own corpus) | **67.96%** (36,221 of 53,298) — 🔴 **different corpus**: cohortGrid is beginner-heavy and beginners are ~91% duration-anchored. Not a regression claim |
| …misses that are duration-anchored sessions | 89% | **90.2%** (15,408 of 17,077); distance-anchored bookends 1,601; distance-anchored main rows 68 |
| Rows leading in the chosen metric, **duration** setting | not stated | **100%** (51,191 of 51,191) |
| Work steps on distance-anchored v2 sessions **prescribed in time** | 87.3% of blocks | **2,800 of 3,085 (90.8%)** |

**Live (production, 56 `user_settings` rows):** `preferred_metric` **distance 55 · duration 1**. Distance is also the
code default (`DEFAULT_DISPLAY_PREFS`), so the 55 cannot be told apart from runners who never opened the setting.
Per-session overrides: **18 active, 11 runners**; **17 of 18 set the metric the session is already anchored in**
(13 distance on distance-anchored, 3 duration on duration-anchored); **1** sets duration on a distance-anchored easy run;
1 points at no session.

🔑 **What the numbers say about the proposal — it has two readings and they diverge.**
- **(i) "the session's own unit" = the session's anchor.** Then a distance-anchored session leads in distance and a
  duration-anchored one in time — **which is exactly what the distance setting renders today.** Reading (i) changes
  nothing for 55 of 56 runners; it deletes the duration setting, which is the one setting the card honours on **100%**
  of rows.
- **(ii) = each step's own prescription.** Then **2,800 of 3,085 work steps** on distance-anchored sessions lead in
  minutes under a km header — the mid-card mixing the founder complained of on 2026-10-06 and Option E removed.

**What the evidence cannot show:** whether anyone chose distance; why 11 runners flipped single sessions (looking vs
keeping). No device.

---

## 🔍 Settled-ground scan

| Row | Bearing |
|---|---|
| **`SESSION-STEP-SLOTS-01` Option E** (2026-10-06) | Founder's binding constraints: *"the runner is glancing mid-run"* and *"the chosen metric must be honoured"*. **Option A KILLED** — *"a preference the product overrides whenever it finds it inconvenient is not a preference."* Line 3 already shows **the other metric on every row** |
| **6t option B / `STEP-UNIT-OWNER-01` as filed** — killed permanent | *"silently disables the distance toggle… the runner set that toggle."* Reading (ii) is this shape at step level |
| **👤 Founder, 2026-10-07 — KEEP AS IS** | The 16% (now ~32% on this corpus) of distance-setting rows that lead in time because the session has no distance stay as they are. **Not a defect** |
| ADR-015 / INV-PREF-001 | The preference propagates to notifications; removing it is an ADR amendment |

---

## The board

**🎪 Collins.** *"My point stands in the number: the default setting is honoured on two rows in three on this corpus, and
the per-session flip is used, by eleven people, to ask for what the card already shows. That is a control people touch
to understand, not to choose. The instrument is wrong."*

**📱 Wroblewski.** *"Then read your own proposal. If it means the anchor, it is the distance setting with the duration
option deleted, and the duration option is the only setting we honour on every row. If it means the step, you put
minutes on nine reps in ten under a kilometre header — the founder's complaint, and the shape I killed in September and
again on the 6th. Neither reading fixes the third of rows you are pointing at; those are beginners' duration sessions,
and the founder kept them as they are."*

**🎓 Sierra.** *"Every row already carries both numbers — line 3. The runner is not missing a fact under any setting. What
the toggle changes is which number is big. That is a preference, and the product has decided it is the runner's."*

**✋ Silvanto.** Nothing on palette or type. *"The per-session flip is the one control that is used for its stated purpose
once. I'd not take it away to tidy a settings screen."*

**🧭 Zhuo (chair).** *"Collins has found a true thing and attached it to the wrong remedy. True: the default setting is
not honoured on a third of this corpus's rows, and most runners never chose it. But the residual is the beginner
duration-anchored case the founder ruled KEEP AS IS, and both readings of the remedy either delete the coherent setting
or restore the mixing E removed. No user problem is solved that is not already solved. What would reopen it: a measured
runner complaint about the toggle itself, or the duration-anchored share of plans changing so the default stops matching
most sessions."*

## ⚡ Recorded disagreements
- **🎪 Collins LOST, and it is recorded as a loss** (third time on this question: D on 10-06, the filing, now). His
  measurement was not disproved: the distance setting leads in its metric on 67.96% of rows on this corpus.

## ⛔ Veto check
Silvanto: none.

## ⚖️ Ruling — **DON'T SHIP (not permanent)**

The toggle stays as it is, global and per-session. Reading (ii) is additionally refused on settled ground (Option E,
6t-B). **May return only with:** a measured runner complaint traceable to the toggle, or a shift in the duration-anchored
share of plans; and the proposal must say which reading it means.

## 📦 Required artifacts
None shipped. Register row only (below). Mechanical check: none — nothing is built; the existing E arms stand.

## ↗️ Routing
💼 **SLT: no hand-off needed** — a DON'T SHIP leaves no cost or tier question. If reading (i) ever returns as
"retire the duration option to simplify 19 consumer files", that is a build-cost question and goes to the SLT then.

## ⚠️ What this ruling does not settle
- The two residuals E left (`STEP-ZONE-RANGE-01`, `STEP-UNIT-OWNER-01`) — separate items, untouched.
- Whether the 55 "distance" runners chose it. Not measurable from the column.
- The 67.96% is cohortGrid-weighted, not the live population's.
