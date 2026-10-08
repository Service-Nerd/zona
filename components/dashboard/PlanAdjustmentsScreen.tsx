// PlanAdjustmentsScreen — ME-ADJUSTMENTS-EXTRACT-01 (2026-10-02).
//
// The Plan adjustments door, as a component. It moved behind a door in `ME-DOORS-01` as a
// CALL SITE and stayed one, for a reason that was true then and is recorded in the item:
// *"it reads seven identifiers from `MeScreen`'s scope … threading all seven through a new
// boundary is a second change wearing the first one's clothes."*
//
// 🔴 THE ITEM'S STATED CONSEQUENCE HAD STOPPED BEING TRUE BEFORE THIS WAS BUILT.
// It read: *"`Preferences` has a markup test because it is a component under `components/`;
// this door has **none**, because vitest does not collect `app/`."* That was correct while
// `MeScreen` lived in `app/dashboard/DashboardClient.tsx` — and
// `DASHBOARD-SCREEN-EXTRACT-03` moved `MeScreen` to `components/dashboard/MeScreen.tsx`,
// which IS collected. So the door became testable in place and the item kept naming an
// impossibility. **An item is a snapshot of the code on the day it was written** (CLAUDE.md).
//
// ⚠️ EXTRACTED ANYWAY, AND THE REASON IS THE PATTERN, NOT THE TEST. Every substantial door
// off Me is a component — `PreferencesScreen`, `SupportScreen`, `FaqScreen`,
// `PlanHistoryScreen`, `DeleteAccountScreen`. This one was the single outlier at ~120 lines
// inline. Conforming to the established pattern is the argument; testability is now a
// by-product rather than the motive.
//
// ── 🔴 WHAT THE RELOCATION ASKS TURNED UP (/build § 5b) ──────────────────────
// `adjustmentsDisclosureOpen` was `MeScreen` state used ONLY inside this door, so it became
// local here — one fewer prop, and the disclosure could no longer be read or set from outside.
// 🔴 IT IS NOW GONE ENTIRELY. `RESHAPE-MOMENT-01` (Design Board, 2026-10-08) ruled the
// "What we watch for" disclosure open — density, not disclosure — so the state had no reader
// and was deleted with it. **A comment describing state that no longer exists is how a file
// starts lying about itself**, which is why this line was corrected rather than left.
//
// ⚠️ `lastCheckedLabel` IS A PROP AND MUST STAY ONE. It is derived in `MeScreen` and is also
// read by the INDEX row's subtitle (`subtitle={hasPendingAdjustment ? … : lastCheckedLabel ??
// PLAN_ADJUSTMENTS_SUB}`). Moving the derivation in here would have left the index subtitle
// reading `undefined` — a silent defect in code this change never edited, which is the exact
// class `ME-DOORS-01` shipped five of.
//
// ⚠️ NO HEADER OF ITS OWN, DELIBERATELY. `ScreenHeader` stays at the call site, as it does
// for `PreferencesScreen`. Two of `ME-DOORS-01`'s three doors said their own name TWICE
// because a card header that "parallels the row above" becomes a second title when the card
// becomes the screen. A component that cannot render a title cannot repeat one.
//
// ⚠️ THE TIER GATE MOVED UP TO THE BRANCH, which is a fix and not a side effect. The gate
// `hasPaidAccess && onDynamicAdjustmentsChange` guarded the BODY while the branch rendered
// the header unconditionally, so a free runner arriving via `openSection` would have seen a
// titled, empty screen. The index comment already states the intent — *"a free runner sees no
// door at all rather than a door onto a locked room"* — so the branch now requires the gate
// and an ungated section falls through to the index. Latent, not reachable today (reshape,
// the only deep-link source, is itself paid), and fixed rather than registered.
//
// ⚠️ THE ITEM SAID "SEVEN IDENTIFIERS". IT READS TEN VALUES AND FOUR IMPORTS, and `tsc` is
// what said so — not the item, and not me reading the block. The three it did not name are a
// self-contained mechanism: `dismissedChanges` (localStorage-backed `Set`), `dismissChange`
// and the derived `visibleChanges`, used at three places inside this door and NOWHERE else in
// `MeScreen`. They move wholesale, which is the better boundary anyway: dismissal state now
// lives with the only UI that owns it. **A dependency list written by reading is a dependency
// list that goes short** — the compiler enumerated it in one pass.
//
// 🔻 `zonna_dismissed_changes` is a localStorage key and is NOT in CLAUDE.md's canonical key
// list (which documents `zona_wizard_draft` under sessionStorage). Pre-existing, moved
// unchanged, and recorded here rather than silently carried.

import { useState } from 'react'
import { Chevron } from '@/components/shared/Chevron'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import AdjustmentDiff from '@/components/shared/AdjustmentDiff'
import { BRAND } from '@/lib/brand'
import { watchedSignals } from '@/lib/coaching/watchedSignals'

export default function PlanAdjustmentsScreen({
  dynamicAdjustmentsEnabled,
  onDynamicAdjustmentsChange,
  hasPendingAdjustment,
  onOpenReshape,
  lastCheckedLabel,
  lastAdjustmentCheckFoundChange,
  recentChanges,
  preferredUnits,
}: {
  /** ⚠️ REQUIRED (SWITCH-PRIMITIVE-01) — an `undefined` would render the row's copy as
   *  "off" against a real default of ON, and `Switch` would announce the wrong state. */
  dynamicAdjustmentsEnabled: boolean
  /** ⚠️ REQUIRED here though optional on `MeScreen`: it is half of this door's tier gate,
   *  so the branch cannot render without it. */
  onDynamicAdjustmentsChange: (enabled: boolean) => void
  /** A `plan_adjustments` row with status='pending'. Distinct from
   *  `lastAdjustmentCheckFoundChange`, which stays true after a silent auto-apply. */
  hasPendingAdjustment?: boolean
  onOpenReshape?: () => void
  /** ⚠️ DERIVED IN `MeScreen` AND PASSED, because the INDEX row's subtitle reads it too. */
  lastCheckedLabel: string | null
  lastAdjustmentCheckFoundChange?: boolean | null
  /** Recent auto_applied adjustments, last 14 days, newest first (§69). */
  recentChanges?: any[]
  preferredUnits: 'km' | 'mi'
}) {

  // RESHAPE-FIX-WAVE3-PHASE2 — per-change dismissal for the "Changed this week"
  // audit surface, persisted client-side (matches the MAINT-01 dismissable-card
  // precedent — informational card, no migration). Keyed by adjustment id.
  //
  // ⚠️ MOVED WHOLESALE FROM `MeScreen` — state, persistence and derivation together. Three
  // uses, all inside this door. Splitting them would have left the Set in one file and its
  // only reader in another, which is the duplicate-ownership shape D-08 forbids.
  const [dismissedChanges, setDismissedChanges] = useState<Set<string>>(() => {
    // ⚠️ THE SSR GUARD IS DEFENCE-IN-DEPTH, NOT LOAD-BEARING, AND I FIRST CLAIMED OTHERWISE.
    // I dropped this line on the first extraction, restored it, and wrote that it was
    // load-bearing. **Measured: it is not.** `window` IS undefined under server render and
    // reaching it DOES throw `ReferenceError` — but the `try/catch` two lines down already
    // absorbs that and returns an empty Set, so removing this line changes nothing and every
    // test still passes. What the guard buys is intent and not using an exception for control
    // flow; what actually holds server-render shut is the `try/catch`.
    //
    // 🔴 THE FALSIFICATION THAT PROVED IT: removing this line keeps 9/9 green, while moving the
    // `localStorage` read OUTSIDE the try turns 8 of 9 arms red. **I had asserted a result
    // without running it, which is the one thing the house rule on falsification exists to
    // stop.** Kept verbatim from the original because it is correct and clearer than relying on
    // a catch; recorded honestly because "load-bearing" was wrong.
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = window.localStorage.getItem('zonna_dismissed_changes')
      return new Set(raw ? (JSON.parse(raw) as string[]) : [])
    } catch { return new Set() }
  })
  const dismissChange = (id: string) => {
    setDismissedChanges(prev => {
      const next = new Set(prev)
      next.add(id)
      try { window.localStorage.setItem('zonna_dismissed_changes', JSON.stringify(Array.from(next))) } catch {}
      return next
    })
  }
  const visibleChanges = (recentChanges ?? []).filter((c: any) => !dismissedChanges.has(c.id))

  return (
    <div style={{ padding: '0 16px', paddingBottom: 'var(--space-7)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
  {/* ── Plan adjustments (paid/trial only) ───────────────────
       One engine, two controls: Auto-adjust runs it on a schedule,
       Check now runs it on demand. The "Last checked" line and the
       "What we watch for" disclosure exist to make this engine
       visible — without them users can't tell what they're paying for. */}

      <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--line)', overflow: 'hidden' }}>

        {/* Last checked status — top of the card so the engine's activity is visible at a glance.
         *  Three honest states (PROFILE-ADJ-01):
         *  - pending change waiting for user → moss accent + tappable, routes to ReshapeScreen which shows the existing row
         *  - engine ran, applied a tweak silently (auto-applied) → factual "Plan tweaked" line, not tappable
         *  - engine ran, found nothing → "No changes needed" */}
        {hasPendingAdjustment ? (
          <button
            onClick={onOpenReshape}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', borderBottom: '1px solid var(--line)',
              background: 'var(--moss-soft)', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--moss)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
                1 change pending
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.4 }}>
                Tap to review and accept.
              </div>
            </div>
            <div style={{ color: 'var(--moss)', marginLeft: 'var(--space-3)' }}><Chevron /></div>
          </button>
        ) : (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--bg-soft)' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>
              Last checked
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.4 }}>
              {lastCheckedLabel === null
                ? 'Not yet. Tap Check now to run.'
                : lastAdjustmentCheckFoundChange
                  ? `${lastCheckedLabel.charAt(0).toUpperCase() + lastCheckedLabel.slice(1)} · Plan tweaked`
                  : `${lastCheckedLabel.charAt(0).toUpperCase() + lastCheckedLabel.slice(1)} · No changes needed`}
            </div>
          </div>
        )}

        {/* RESHAPE-FIX-WAVE3-PHASE2 — "Changed this week" audit surface.
            Sub-threshold adjustments auto-apply silently (§69); this is the
            passive, honest place to see what the engine did without asking.
            Read-only + dismissable per row. AdjustmentDiff is rule-engine
            output (no AIMark); the summary is a factual record line, same
            provenance stance as the "Plan tweaked" line above. */}
        {visibleChanges.length > 0 && (
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            <div style={{ padding: '12px 16px 2px', fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Changed this week
            </div>
            {visibleChanges.map((c: any) => (
              <div key={c.id} style={{ padding: '8px 16px 14px' }}>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', lineHeight: 1.45 }}>
                  {c.summary}
                </div>
                <AdjustmentDiff sessionsBefore={c.sessions_before ?? []} sessionsAfter={c.sessions_after ?? []} units={preferredUnits} />
                <Button variant="secondary" size="compact" 
                  onClick={() => dismissChange(c.id)} style={{ marginTop: 'var(--space-3)' }}>
                  Got it
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Auto-adjust toggle. */}
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', borderBottom: '1px solid var(--line)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.4, marginBottom: '2px' }}>Auto-adjust</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
              {dynamicAdjustmentsEnabled
                ? `${BRAND.name} checks automatically and suggests changes when something looks off.`
                : `Plan stays fixed. ${BRAND.name} tracks data but won't suggest changes.`}
            </div>
          </div>
          <Switch
            checked={dynamicAdjustmentsEnabled}
            onChange={() => onDynamicAdjustmentsChange(!dynamicAdjustmentsEnabled)}
            ariaLabel="Auto-adjust my plan"
          />
        </div>

        {/* 🧭 RESHAPE-MOMENT-01 (Design Board, 2026-10-08) — WAS ONE COLLAPSED PARAGRAPH.
            Founder: the section is "very wordy" and should "sing a bit more". Measured: two
            taps to read ONE truncated 12px sentence holding eight distinct signals, so the
            runner did the sorting.
            ✋ Silvanto, twice on the record: **density, not disclosure.** The eight are now
            on the screen, structured, nearest-horizon first (readiness before efficiency
            trend) because flattening two horizons into one stack is the Coach screen's
            documented failure.
            📱 Wroblewski: this REMOVES a tap and relocates nothing.
            💼 It is NOT merchandising, and the SLT kill ("a settings screen that
            merchandises", unanimous) does not reach it: no tier language, no CTA, no feature
            list framing. This is Me doing its own job legibly.
            🔴 The copy lives in `lib/coaching/watchedSignals.ts`, keyed by the engine's own
            `DetectedTrigger`, because the old version carried a SYNC RULE enforced by a
            comment and had already drifted: it described a taxonomy of eleven when one
            member could never fire and two were runner-initiated. */}
        {/* ⚠️ ONE 13px DECLARATION FOR THE WHOLE BLOCK, on this wrapper. The heading and the
            eight labels all inherit it. My second attempt put it on the heading AND the list
            and `TYPESCALE-APP-GATE-01` still read 247 vs 246 — two declarations where the
            Button it replaced had one. The register counts USAGES, not distinct sizes. */}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px' }}>
        <div style={{ padding: '14px 16px 4px' }}>
          <div style={{ color: 'var(--ink-2)', lineHeight: 1.4 }}>
            What we watch for
          </div>
        </div>
        {/* ⚠️ THE SIZE IS SET ONCE ON THE LIST AND THE LABELS INHERIT IT, which is not a
            style preference. `TYPESCALE-APP-GATE-01` caught the first version at 247 vs a
            baseline of 246: 13px is the app's most-used size and is DELIBERATELY undeclared,
            tracked on a ratchet, and eight rows each declaring it would have grown that
            register by eight. **Raising a ratchet to go green is what
            `A RATCHET MUST NOT MOVE WITHOUT A MEASUREMENT` forbids.** The detail line
            overrides to 12px, which IS a declared size and therefore free. */}
        <ul style={{ listStyle: 'none', margin: 0, padding: '0 16px 16px' }}>
          {watchedSignals().map(sig => (
            <li key={sig.type} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ color: 'var(--ink)', lineHeight: 1.4 }}>
                {sig.label}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '2px' }}>
                {sig.detail}
              </div>
            </li>
          ))}
        </ul>
        </div>
      </div>
    </div>
  )
}
