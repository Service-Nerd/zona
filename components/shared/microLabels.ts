// MICRO-LABEL-DRIFT-01 (Design Board, 2026-09-29) — the three micro-labels, and the fact
// that there are exactly three.
//
// ── 🔴 WHAT WAS MEASURED ─────────────────────────────────────────────────────
// **171 micro-labels** (≤11px carrying letter-spacing — tracking is what makes a label a
// label rather than body text) across **37 files** in **41 distinct combinations**.
// `ui-patterns.md` documented exactly ONE.
//
// 🔴 AND THE DOC DID NOT MATCH ANY OF THE THREE THINGS IMPLEMENTING IT:
//   ui-patterns.md § type table   10px / 700 / 0.08em
//   SectionLabel (local fn)       12px / none / 0.1em
//   PlanSectionLabel (local fn)   11px / 700 / 0.12em
// The rule and the implementation had never met — the `--surface-moss-wash` trap, at the
// type layer. Precedent: "the doc/component ground mismatch is a DEFECT" (wave 1).
//
// ⚠️ SIX LABEL TEXTS RENDERED AT DIFFERENT VALUES, which is what killed every role
// defence: "After the race" at 10px AND 11px; "Hold the zone" at 10px and 11px;
// **`optional` FOUR ways.** Same word, same job, four hands.
//
// ── ⚖️ THE RULING: THREE ROLES, BECAUSE THREE JOBS WERE MEASURED ─────────────
// The board declined to collapse to one and declined to ratify 41. Collins, who leads
// taxonomy collapse and checked himself before saying it: **"Three named levels is a
// system. Forty-one is a habit."**
//
// 🔴 11px IS NOT A LEVEL. Every 11px micro-label resolves to one of the three below.
// Silvanto: it is "a difference too small to read as hierarchy and too large to be
// nothing" — the 1.02× step again.

import type { CSSProperties } from 'react'

export type MicroLabelRole = 'sectionLabel' | 'eyebrow' | 'dataLabel'

/**
 * ⚠️ EXACTLY THREE. A fourth needs the Design Board — that is in the ruling, not a
 * preference. `microLabel.test.ts` asserts the count.
 */
export const MICRO_LABELS: Record<MicroLabelRole, Required<Pick<CSSProperties,
  'fontSize' | 'fontWeight' | 'letterSpacing' | 'textTransform'>>> = {
  /** A screen-level section heading: `Your training`, `Setup`, `Careful Now`. */
  sectionLabel: { fontSize: '12px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' },
  /** A caption inside a card: `Effort (RPE)`, `Body state`, `Goal race`. */
  eyebrow:      { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' },
  /** Names a value in a metric pair: `Planned`, `Actual`, `Est. pace`. */
  dataLabel:    { fontSize: '9px',  fontWeight: 700, letterSpacing: '0.1em',  textTransform: 'uppercase' },
}

/**
 * ⚠️ `eyebrow` IS THE DOCUMENTED VALUE, UNCHANGED. The doc was **completed**, not
 * corrected: it described one level of a three-level hierarchy, so `SectionLabel`'s 12px
 * was never a regression against it — it was a level the rule had not named. That is why
 * Silvanto declined the veto, and he recorded the condition under which he would have
 * used it: **any proposal that widened the doc to accommodate the existing 41.**
 */
export const DOCUMENTED_EYEBROW = MICRO_LABELS.eyebrow
