# Contract — StatusBadge

**Authority**: This document defines the prop interface and rendering contract for the one
status micro-label. Any change to props must update this document in the same commit.

**Component:** `components/shared/StatusBadge.tsx`

---

## Prop Interface

```typescript
type StatusTone = 'held' | 'none'

type Props = {
  label: string
  tone?: StatusTone           // default 'none'
  style?: CSSProperties       // LAYOUT ONLY
}
```

---

## Type and tone

**10px / 700 / 0.08em / uppercase** — `MICRO_LABELS.eyebrow`, the documented eyebrow, absorbed
here rather than re-specified.

| tone | colour | means |
|---|---|---|
| `held` | `--moss` | the state is good / active |
| `none` | `--mute` | neutral, no claim |

🔴 **No fill.** A badge is **type accent, not flood** — the standing rule. A coloured background
would make it a chip, which is a different documented pattern (`ui-patterns.md` § Session Type
Chip: 10px 700, coloured bg at 15% opacity).

⚠️ **Binary by construction.** Two tones, no rank. A third would be a scale, and a scale on a
status label invites reading it as a score.

---

## 🔴 Why it exists

`TIER-BADGE-01` found **two** status-badge primitives already in the codebase, **already
diverged** — after I told the Design Board none existed. The evidence step caught the brief.
Measured at the same time: **36 distinct micro-label combinations across 171 uses** against one
documented value.

Tier words and tone are **not** this component's: `lib/tierBadge.ts` owns the mapping from
`TierReason` to `{ label, tone }`, so the five tier states cannot collapse into three strings
again.

---

## Governance

Design Board `TIER-BADGE-01` (2026-09-29). Gated by `statusBadge.markup.test.ts`.
