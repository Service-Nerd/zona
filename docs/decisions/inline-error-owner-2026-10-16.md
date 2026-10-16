# INLINE-ERROR-OWNER-01 — Design Board, 2026-10-16

**Trigger:** a new shared component, found while building `PLAN-CHANGE-FAIL-VISIBLE-01`, after the founder
asked that UI work use the design standards and existing components.

**Finding:** no shared inline-error component; six hand-written copies of the same error line, split on
colour. Plain `--danger` fails AA at 14px on `--bg-soft` (4.36:1) and `--warn-bg` (4.46:1).

**Ruling: SHIP WITH AMENDMENT.** One `InlineError` (`components/shared/InlineError.tsx`), `--danger-strong`,
used by all six. `FieldReadback alert` stays distinct (value slot, weight 600) and moves to `--danger-strong`.

**Visible change:** the wizard save-bar and redeem-code errors are slightly darker red.

**Not settled:** boxed error pills; other plain-`--danger` text.
