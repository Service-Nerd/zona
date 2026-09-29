'use client'

import HRZonesSection from '@/components/dashboard/HRZonesSection'
import Sheet from '@/components/shared/Sheet'
import { HEART_RATE_SUB, HEART_RATE_TITLE } from '@/components/shared/meDoors'

/**
 * HrCalibrationSheet — the resting/max HR form, opened from inside the zones screen
 * (ZONES-HR-SHEET-01, Design Board this sitting).
 *
 * 👤 FOUNDER: *"I don't like the heat calibration being on its own. It should be from
 * within zones as a pop up perhaps."* ("heat" is HR.) **It is a SHEET, not a popup** —
 * the app already owns the primitive and this authors no new surface.
 *
 * ⚖️ THIS REVERSES `ZONES-INPUTS-01`, WHICH THIS BOARD RULED ONE DAY EARLIER, and the
 * reversal is recorded rather than quietly made. That ruling kept the form on Me on four
 * grounds. Three did not survive the code, and the fourth argues the other way:
 *
 *   • *"Moving it would relocate taps, not reduce them"* (Wroblewski) and *"a once-ever
 *     form on a weekly-read screen: density, not disclosure"* (Silvanto) were both about
 *     putting the form ON the zones screen. A sheet is DISCLOSURE, which is the exact
 *     distinction the craft seat is built on. Yesterday's reasons were quoted at a
 *     proposal nobody had made.
 *   • *"The Apple Health prefill is a connection action that belongs where Connections
 *     lives"* is measurably false: the button reads two values into these two fields and
 *     defers connection management elsewhere BY NAME, in its own error string,
 *     *"Reconnect it under Connections."* It is an input affordance that points at the
 *     connection surface; it is not one.
 *   • *"A set-once input"* survives, and a set-once input is precisely what should NOT own
 *     a permanent door on a screen the runner reads weekly.
 *
 * 📐 MEASURED, NOT ASSERTED (375x812, computed DOM/CSS):
 *   • The form is **240px** in its longest state, **33.6%** of the 88vh ceiling. Silvanto's
 *     own binding test in `Sheet.tsx` — *"a sheet whose content cannot fit at 88vh is
 *     evidence the content belongs on a screen"* — was written to push content OUT of
 *     sheets and here argues the opposite.
 *   • Behind `--scrim` (`--ink` at 40%) the zone bpm ranges composite to **5.44:1**, which
 *     still passes AA. The numbers that change stay readable. That is what makes Sierra's
 *     argument real rather than rhetorical: *one wrong value makes the whole table wrong*,
 *     and cause and effect are finally in one field of view.
 *
 * ⚖️ R-5 BINDS AND IS WHY THERE IS NO TOP-RIGHT DISMISS: *a sheet you BROWSE takes a
 * top-right dismiss; a sheet you ACT IN keeps the bottom bar.* This one has a Save, so it
 * is a sheet you act in. The action is `HRZonesSection`'s OWN save button; inventing a
 * second Apply would be a second owner of one verb.
 *
 * ⚠️ IT CLOSES ON SAVE, AND THAT IS HOW SILVANTO'S CONDITION IS MET. He required that the
 * sheet not cover the rows it is changing. Closing hands the runner the UPDATED table with
 * nothing over it, which is strictly better than a dimmed one. **The residual, stated: you
 * do not watch it change live, you see it changed.** Nothing has run on a device, and the
 * keyboard raised by two numeric fields in a bottom-anchored panel is unmeasured
 * (Wroblewski's standing objection, unresolved rather than answered).
 */
export default function HrCalibrationSheet({
  onClose, restingHR, maxHR, maxHrSource, birthYear, onSave, hrZoneMethod, hrAssumptionNote,
}: {
  onClose: () => void
  restingHR: number | null
  maxHR: number | null
  maxHrSource?: 'observed' | 'user_confirmed' | null
  birthYear?: number | null
  onSave: (rhr: number, mhr: number) => void
  hrZoneMethod?: string | null
  hrAssumptionNote?: string | null
}) {
  return (
    <Sheet onClose={onClose} ariaLabel={HEART_RATE_TITLE}>
      {(close) => (
        <div style={{ padding: '4px 20px var(--space-5)' }}>
          {/* One title, said once. The card's own header was removed when it went behind a
              door (ME-DOORS-01) precisely so the door could title it; the sheet inherits
              that job with the same two strings, so the words a runner reads do not move. */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
              {HEART_RATE_TITLE}
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px' }}>
              {HEART_RATE_SUB}
            </div>
          </div>

          <HRZonesSection
            restingHR={restingHR}
            maxHR={maxHR}
            maxHrSource={maxHrSource}
            birthYear={birthYear}
            hrZoneMethod={hrZoneMethod}
            hrAssumptionNote={hrAssumptionNote}
            onSave={(rhr, mhr) => { onSave(rhr, mhr); close() }}
          />
        </div>
      )}
    </Sheet>
  )
}
