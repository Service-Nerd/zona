# `<EasedMark>` — contract

**Component:** `components/shared/EasedMark.tsx`

The "Eased for recovery" text mark: the record that a recovery ease changed this session. Pattern: `ui-patterns.md`
§ 10e. Ruling: `design-rulings.md` § READINESS-SURFACE-01 (2026-10-17, item 3 built the same day).

## Props

```ts
type EasedMarkProps = {
  // no props: the words are owned by EASED_FOR_RECOVERY_LABEL
}
```

None. The words come from `EASED_FOR_RECOVERY_LABEL` (`lib/ui/easedMark.ts`); a caller never passes text.

## Render

`<span data-eased="recovery">` in `12px 600 --ink-2`, the metric register beside "Done" and the AM / PM token.
Never a colour on its own, a tile, a count or an icon.

## When to render

Only when `isEasedForRecovery(session)` is true (`session.eased_for === 'recovery'`, stamped by the readiness
producer and present only after the runner confirmed). Callers: `PlanCalendar` `DayRow`, `SessionCard` (`eased`
prop), `SessionPopupInner` date row.

## Gates

`components/shared/easedMark.markup.test.ts` (each surface with an unstamped control) · `lib/ui/easedMark.test.ts`.
