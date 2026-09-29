# Contract — PinnedBackHeader

**Component:** `components/shared/PinnedBackHeader.tsx`

**Authority**: this document defines the prop interface and rendering contract. Any change
to props updates it in the same commit. **BACK-ARROW-TITLE-COLLIDE-01** (Design Board,
2026-09-29, amendment 3). Tier: **FREE**.

The back arrow in an opaque `.pinned-chrome` band, for pushed screens that hand-roll their
own title instead of using `ScreenHeader`.

## Props

```ts
interface PinnedBackHeaderProps {
  onClick: () => void
  ariaLabel?: string
  children?: React.ReactNode
  padding?: string
  maxWidth?: number
}
```

| Prop | Required | Meaning |
|---|---|---|
| `onClick` | yes | Back. Same contract as `BackButton`'s |
| `ariaLabel` | no | Overrides the default label when "Back" is ambiguous |
| `children` | no | **A short, discrete title to pin WITH the arrow.** Omit for an essay lead or a title that sits inside a conditional |
| `padding` | no | Defaults to `16px 20px 8px`. Match the content block's horizontal padding so the band's edge lines up |
| `maxWidth` | no | Match the content block's measure, for the same reason |

## Contract

- **It is the single owner of the pinned back band.** `screenHeaderPinned.test.ts` fails if
  any screen hand-rolls `.pinned-chrome` around a back arrow instead of using this.
- **It replaces `FloatingBackButton` on these screens**, and the cost is recorded rather
  than hidden: inside a band the arrow stops being a hovering circle.
- **It is `sticky`, not `fixed`**, so it stays in flow and cannot swallow taps meant for
  content beside it.
- **It reuses `useScrolledContainer`**, which finds the scroller that actually overflows
  rather than the first one declaring `overflow-y: auto`. Four boxes in this app declare it
  and can never scroll.

## Why the band rather than a bigger disc

Measured: the floating arrow is a **44px opaque disc at x 16–60**, and a hand-rolled title
typically starts at **x 16–20**. Same column. `.pinned-chrome` is `--bg` with an edge that
appears on scroll, so content passing beneath disappears **at a line**; a disc hides it **at
a curve, mid-word**, which reads as a rendering fault rather than as chrome.

## Consumers

`UpgradeScreen` · `FounderNoteScreen` · `RedeemCodeScreen` · `BenchmarkUpdateScreen`
(with title) · `FaqScreen` (with title)

## Not verified

Not seen on a device, and **nothing measured at 320px**, where a wrapped title puts more of
itself in the arrow's path.
