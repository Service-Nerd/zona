# Contract — SectionLabel

**Authority**: This document defines the prop interface and rendering contract for the
screen-level section heading. Any change to props must update this document in the same commit.

**Component:** `components/shared/SectionLabel.tsx`

---

## Prop Interface

```typescript
type Props = {
  children: ReactNode
  right?: ReactNode           // trailing value on the same line (e.g. a count)
  style?: CSSProperties       // LAYOUT ONLY — merged, never replacing the type
}
```

---

## Type

**12px / 600 / 0.1em / uppercase** — the `sectionLabel` role in `MICRO_LABELS`. One of exactly
three micro-label roles (`MICRO-LABEL-DRIFT-01`); **11px is not a level**.

⚠️ `marginTop` is `var(--space-4)`, a token. It was a hand-typed `18px` — off-scale, invisible
while the function was local, and visible the moment it was shared.

---

## 🔴 Why this is a shared component at all

It was a **local function inside `DashboardClient`** — the **fourth** recorded instance of that
trap. `PlanCalendar` needed a section heading, could not import one, and wrote its own at
11px/700/0.12em. The two never met, and the documented value matched **neither**.

**A pattern that is a local variable cannot travel.** `PlanSectionLabel` is gone; this is the
only section heading.

---

## Governance

Design Board `MICRO-LABEL-DRIFT-01` (2026-09-29). Gated by `microLabel.test.ts`, whose register
of non-conforming micro-labels can only fall.
