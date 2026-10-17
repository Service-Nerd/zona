# SLT — same-day doubles, tier and order (2026-10-17) · BUILD, FREE

**Item:** `SESSION-SLOTS-01` Phases 3+4. **Brief:** a runner moves an easy run onto a day with another easy run and does
both, AM and PM (Coaching Board §126). **Evidence:** 36 plans in production, 3 runners with live moves (7 rows), 2 swaps;
no demand data for doubles.

- **Sutherland:** a double is a runner rescuing their own week; gating it charges for self-rescue. Keep the friction at
  one confirm row, and do not advertise it: an app against overtraining should not shout about cramming.
- **Fried:** not the next most valuable thing on the evidence, but asked for and largely built, so finish it SMALL: one
  choice in the existing row, a two-row day, every reader taught. No settings, no onboarding, no marketing line. FREE:
  it is moving your own run, and free users are never abandoned.
- **Hutchinson:** correctness is ruled (§126); no surface may present a double as extra training.
- **Wood:** a context change, not motivation: it keeps an easy run that would otherwise be dropped. Sneaking volume is
  closed by §126's easy-only rule.
- **Zhuo:** the day's look, the third choice and the labels are the Design Board's.

**Recorded conflict:** Fried would build something else first; outvoted on "asked for and mostly built".

**Ruling:** **BUILD, FREE.** Small scope, no promotion. Phases 3+4 ship together, live only after migration
`20261018_session_overrides_slot.sql`.

**Records fix ruled here:** moving and swapping sessions are **FREE** in the code (no tier gate in `PlanCalendar`; only
the follow-up `/api/adjust-plan` call is paid). The feature-registry row for the move-confirmation step said PAID, a
gate that never existed. Corrected to match the code.

⚠️ No commercial seat (Traynor stood down): trial-to-paid impact is unpriced, and not argued here.
