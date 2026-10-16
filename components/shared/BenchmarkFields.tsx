'use client'

import { DurationPicker } from './DurationPicker'
import { TextField } from './TextField'
import { Chip } from './Chip'
import { FieldLabel, FieldNote, FieldReadback } from './FieldText'
import { formatBenchmarkReadback, type DistanceUnits } from '@/lib/format'
import {
  BENCHMARK_DISTANCES, BENCHMARK_PROBLEM_COPY, benchmarkFromFields, benchmarkProblem,
  type BenchmarkFieldValues,
} from '@/lib/plan/benchmarkCheck'

// BENCHMARK-INPUT-01 (Design Board, 2026-10-16) — THE benchmark entry, for every screen
// that asks for one: the Generate Plan wizard and Update Paces (Me → Set benchmark).
//
// 🔴 WHY ONE COMPONENT. Both screens used the same three controls, as two copies, and
// they had drifted: a different chip label, a different time-trial instruction, a
// different label weight, no run date on Update Paces, and the wizard's TT box opened
// the NUMERIC keyboard, which on iPhone has no decimal point, so 7.1 km could not be
// typed at all.
//
// ⚖️ THE CONTROLS ARE THE DOCUMENTED ONES (ui-patterns § input table). Finish time is a
// `DurationPicker` (hrs : min : sec, FORMS-PRIM-01 / TIME-INPUT-SECONDS-01). The TT
// distance is a `TextField` with the DECIMAL keyboard: a Ruler was considered and
// declined, because it snaps to steps and the founder's own constraint is that 7.1 km is
// not 7 km.
//
// Each value is READ BACK as the decision (`5K in 25:20 · 5:04/km`). An impossible value
// replaces the readback with the refusal, in the same slot: no modal, no confirmation
// step (WIZARD-WEEKDAY-CONFIRM-01 (a) is a permanent kill). The host disables submit via
// `benchmarkProblem`, so the screen and the server refuse the same thing.

export interface BenchmarkFieldsProps {
  values: BenchmarkFieldValues
  onChange: (patch: Partial<BenchmarkFieldValues>) => void
  units?: DistanceUnits
}

export function BenchmarkFields({ values, onChange, units = 'km' }: BenchmarkFieldsProps) {
  const built = benchmarkFromFields(values)
  const problem = built ? benchmarkProblem(built) : null
  const timeOrDistanceProblem = problem === 'too_fast_race' || problem === 'too_fast_tt'

  const distanceLabel = BENCHMARK_DISTANCES.find(d => d.value === values.distKm)?.label
  const readback = values.type === 'race'
    ? (distanceLabel && values.distKm
        ? formatBenchmarkReadback({
            kind: 'race', distanceLabel, distanceKm: values.distKm,
            totalSeconds: values.hours * 3600 + values.mins * 60 + values.secs,
          }, units)
        : null)
    : values.type === 'tt_30min'
      ? formatBenchmarkReadback({ kind: 'tt', distanceKmText: values.ttDistKm }, units)
      : null

  const valueLine = timeOrDistanceProblem
    ? <FieldReadback alert>{BENCHMARK_PROBLEM_COPY[problem!]}</FieldReadback>
    : readback ? <FieldReadback>{readback}</FieldReadback> : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Chip
          label="Recent race result"
          active={values.type === 'race'}
          onClick={() => onChange({ type: values.type === 'race' ? null : 'race' })}
        />
        <Chip
          label="30-min time trial"
          active={values.type === 'tt_30min'}
          onClick={() => onChange({ type: values.type === 'tt_30min' ? null : 'tt_30min' })}
        />
      </div>

      {values.type === 'race' && (
        <>
          <div>
            <FieldLabel>Race distance</FieldLabel>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
              {BENCHMARK_DISTANCES.map(d => (
                <Chip
                  key={d.value}
                  label={d.label}
                  active={values.distKm === d.value}
                  onClick={() => onChange({ distKm: d.value })}
                />
              ))}
            </div>
          </div>
          <div>
            <FieldLabel>Finish time</FieldLabel>
            <DurationPicker
              hours={values.hours} mins={values.mins} secs={values.secs}
              onHoursChange={h => onChange({ hours: h })}
              onMinsChange={m => onChange({ mins: m })}
              onSecsChange={s => onChange({ secs: s })}
              maxHours={9}
            />
            {valueLine}
            <FieldNote>Your whole race, start to finish. Not your pace.</FieldNote>
          </div>
        </>
      )}

      {values.type === 'tt_30min' && (
        <div>
          <FieldLabel>Distance covered in 30 minutes</FieldLabel>
          <TextField
            type="number"
            inputMode="decimal"
            value={values.ttDistKm}
            onChange={v => onChange({ ttDistKm: v })}
            placeholder="e.g. 5.4"
            min={1}
            unit="km"
            ariaLabel="Distance covered in 30 minutes, in kilometres"
          />
          {valueLine}
          <FieldNote>Run flat-out for exactly 30 minutes and record the distance.</FieldNote>
        </div>
      )}

      {values.type !== null && (
        <div>
          <FieldLabel optional>When did you run this?</FieldLabel>
          <TextField type="date" value={values.date} onChange={v => onChange({ date: v })} ariaLabel="Date you ran this" />
          {problem === 'date_in_future' && <FieldReadback alert>{BENCHMARK_PROBLEM_COPY.date_in_future}</FieldReadback>}
          {/* §42: the staleness ramp starts after FOUR weeks. This line used to say
              "Older than 6 months?", which was the 6-month cliff §42 replaced and
              which was deleted from config on 2026-09-07. */}
          <FieldNote>Older than a month? We&rsquo;ll set your paces a little more conservatively.</FieldNote>
        </div>
      )}
    </div>
  )
}
