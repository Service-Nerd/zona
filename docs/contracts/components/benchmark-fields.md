# `<BenchmarkFields>` — contract

**Component:** `components/shared/BenchmarkFields.tsx`

The **only** benchmark entry: the Generate Plan wizard (`benchmark` step) and Update Paces
(`BenchmarkUpdateScreen`, Me → Set benchmark). Pattern: `ui-patterns.md` § *Benchmark entry*.
Ruling: `design-rulings.md` § BENCHMARK-INPUT-01 (2026-10-16).

## Props

```ts
interface BenchmarkFieldsProps {
  values: BenchmarkFieldValues            // lib/plan/benchmarkCheck.ts
  onChange: (patch: Partial<BenchmarkFieldValues>) => void
  units?: DistanceUnits                   // pace in the readback; default 'km'
}
```

| Prop | Required | |
|---|---|---|
| `values` | **yes** | `type`, `distKm`, `hours`/`mins`/`secs`, `ttDistKm` (the runner's **string**, so `7.1` is never rounded), `date` (ISO or `''`). Controlled: the component holds no state. |
| `onChange` | **yes** | Called with a **patch** of only the fields that changed. The wizard maps it onto its separate draft-persisted states; Update Paces merges it into one object. |
| `units` | no | Only the readback's pace follows it. The TT field is km by label. |

## What the HOST must do

- **Build the benchmark with `benchmarkFromFields(values)`**, never by hand. Null = incomplete.
- **Disable submit on `benchmarkProblem(built) !== null`.** The component shows the refusal; it
  cannot stop the host's button. The server refuses the same thing (§55 Am. 1), so a host that
  forgets gets a 422, not a wrong plan.
- On the wizard, **"Not sure, continue" takes the same gate**, because it keeps the answer.

## What it renders

Type chips · distance chips (`BENCHMARK_DISTANCES`) · `DurationPicker` or a decimal `TextField` ·
the readback (`FieldReadback`, `formatBenchmarkReadback`) **or** the refusal in the same slot
(`FieldReadback alert`, `role="alert"`) · the reason line (`FieldNote`) · the optional run date.
Empty readback renders nothing. No modal, no confirmation step.

**Check:** `lib/plan/benchmarkCheck.test.ts`.
