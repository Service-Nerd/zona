# `FieldLabel` / `FieldNote` / `FieldReadback` — contract

**Component:** `components/shared/FieldText.tsx`

The three pieces of text around a form input. Moved unchanged out of `GeneratePlanScreen` on
2026-10-16 (`BENCHMARK-INPUT-01`), when `BenchmarkFields` became their second user.

| Export | Props | |
|---|---|---|
| `FieldLabel` | `children`, `optional?` | The label above an input: 11px / 700 / uppercase / `--mute`. `optional` appends the `FIELD_HINT` word. |
| `FieldNote` | `children` | The reason line below: `FIELD_HINT` values (`--font-ui` 400 12px `--mute`). |
| `FieldReadback` | `children`, `alert?` | The value read back as a decision: 14px / 600 / `--ink`. **Not a fourth micro-label role.** `alert` renders a refusal in the same slot, `--danger`, `role="alert"`. |

**Order is part of the contract:** readback above note (Silvanto, `WIZARD-WEEKDAY-CONFIRM-01 (b)`):
hierarchy by weight and colour, never size.

**Check:** `lib/ui/raceDateReadback.test.ts` (tokens, no tracking), `components/shared/microLabel.test.ts`.
