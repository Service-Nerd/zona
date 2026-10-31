# Contract — ShareControl

**Authority**: This document defines the prop interface and rendering contract for every share control in the app. Any
change to props must update this document in the same commit.

**Component:** `components/shared/ShareControl.tsx` · **Item:** `SHARE-ICON-01` (Design Board 2026-10-31, mockups approved)

---

## Prop Interface

```typescript
type ShareStatus =
  | { kind: 'fetching' } | { kind: 'sharing' } | { kind: 'downloaded' }
  | { kind: 'success' }  | { kind: 'cancelled' } | { kind: 'error'; message: string }

type ShareControlProps = {
  ariaLabel: string                                               // "Share this week" / "Share this run"
  share: (onStatus: (s: ShareStatus) => void) => Promise<void>    // runs the share, reports progress
}
```

`ShareStatus` is the union both `lib/share/*` helpers already emit, so a caller passes `onStatus` straight through.

## Rendering contract

| | |
|---|---|
| **Control** | `IconButton shape="circle"` (44px, `--bg-soft`, hairline), the iOS share glyph in the bell's 1.6 line family, no visible label |
| **Placement** | A right-aligned row; the caller puts it directly under the object it shares, outside it (SAVE-IMG-01) |
| **Busy** | The button is disabled (`aria-busy`), which `.icon-btn:disabled` dims to `--mute`. No spinner, no "Preparing…" |
| **Status** | An always-mounted `aria-live="polite"` span left of the icon, `--fs-caption`, `--mute`, cleared after `SHARE_STATUS_MS` (2200ms). `downloaded` → *Saved*; `error` → its message, else *Couldn't share. Try again.*; `cancelled` and `success` → nothing |
| **Consumers** | `SaveImageButton` (session detail, post-run, log sheet) and Coach's `ShareWeekButton`, which also records `share_week_pressed` / `share_week_result` |

**Not a consumer:** the free tier's "Share your week" row in `CoachTeaser`. It opens Upgrade and shares nothing, so it
carries no share glyph.

**Held by:** `components/shared/shareControl.markup.test.ts`.
