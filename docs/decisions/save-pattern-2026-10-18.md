# Design Board — one journey for changing a plan (SAVE-PATTERN-01)

**Sat:** 2026-10-18. **Founder, verbatim (screenshot of "Here is what changes" on "Saving..."):** *"I don't like the
save experience of adjusting strength or run plan. It's not clear it's doing anything. E.g on change plan save it did
this for a while. Also the experience of adjustment should be the same. I.e pop ups or full screen etc."*

**Measured from the code before the seats spoke:** the run accept makes ~14 sequential network calls from the phone
(`savePlanForUser`: sign-in, prior read, archive read, archive write, seven week-keyed updates one at a time, plan
write, notes clear, charity re-anchor), then closes to Plan with **nothing said**. Strength saves in one call and says
*"Built. It shows on Today and in your plan."* on the setup screen, away from the change. The run journey crosses three
surfaces (bottom sheet, full-screen consent, Plan); strength is one full screen with no consent step. *Keep my current
plan* is disabled while saving. **Not measured:** the real wait on a device.

**Settled ground:** P-02 and R-5 (the run edit is a sheet; browse vs act shapes), ZONES-HR-SHEET-01 (a sheet the
runner acts in is permitted), MODIFY-CONFIRM-DIFF-01 (consent screen; a progress animation DECLINED), STRENGTH-APP-01 F
(setup is a Me sub-page), FieldReadback, no auto-dismiss.

- **Zhuo (chair):** a save that ends in silence is a defect; the surface type is a decision, because changing your plan
  is one job with two grammars today.
- **Wroblewski:** the run sheet is 88vh with seven controls and a date field: a screen in all but name, without the
  top-left back arrow. Make it a screen and keep R-5's logic (the Apply bar arrives when an edit is pending).
  ZONES-HR-SHEET-01 stands for one-field input sheets. Strength gains the consent step only when an existing plan
  changes; a first build has nothing to compare.
- **Sierra:** "Saved" is the app talking about itself. The landing line names the change in the runner's terms, from
  the same owner as the diff. A failure says what was not saved, in the same place.
- **Silvanto:** we declined decorating the wait, not admitting to it. While saving, the primary button carries the state
  and nothing else moves; the cure is speed, and design must not paper over latency. The readback sits at the top of
  Plan at FieldReadback weight until the runner leaves; no toast, no icon, no auto-dismiss. No veto.
- **Collins:** a readback is the minimum; the plan should mark what moved. **Lost:** Zhuo, a second encoding of a fact
  the line already states. Recorded, not killed: it returns with a device test.
- **Disagreement:** where to land. Wroblewski, back where the edit began; **Zhuo ruled Plan**, where the change is seen.

**Ruling: SHIP WITH AMENDMENT.**
1. One journey, run or strength: full-screen edit (back arrow top-left) → *Here is what changes* (strength: only when an
   existing plan changes) → accept → land on **Plan** with one readback line naming the change.
2. The run *Adjust your plan* sheet becomes a full screen, keeping R-5's pending Apply bar. **Reverses P-02's sheet, by
   name.**
3. While saving, the primary button carries the state. A failure is an `InlineError` in place, naming what was not saved.
4. The save gets faster in the same build (parallel writes). The declined progress animation stays declined.

**Artifacts:** ui-patterns § Changing a plan, one journey · `lib/plan/planChangeReadback.ts` (owner of the line) ·
`planChangeJourney.markup.test.ts` · register row. **Not settled:** how the wait feels on a device; Collins's row
marking. **Routing:** none (the readback restates the engine's diff; no training claim).
