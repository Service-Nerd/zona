'use client'
// STRENGTH-ENGINE-01 Phase 2 — the Me → Strength door body (Design Board STRENGTH-APP-01 F).
//
// A Me sub-page, not a wizard: six questions in weight order, the last two
// defaulted. PINNED-DAYS-01 (both boards, 2026-10-18): the runner picks the days
// they can lift (1–MAX_CHOSEN_DAYS) and the sessions stay on them; the picks ARE
// the count, so "How many a week?" and "Days you can't" are gone. The ScreenHeader is MeScreen's (a door body
// never repeats its title). Injuries are READ-ONLY here: the run plan owns injury
// input, and asking twice is two owners of one answer. Honest notes are said once,
// here, as field notes, and never on Today. One CTA, at the end (7a).

import { useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import { Chip } from '@/components/shared/Chip'
import { CardSelect } from '@/components/shared/CardSelect'
import { SegmentedControl } from '@/components/shared/SegmentedControl'
import { DayGridSelector, type DayKey } from '@/components/shared/DayGridSelector'
import { FieldLabel, FieldNote } from '@/components/shared/FieldText'
import { InlineError } from '@/components/shared/InlineError'
import { EQUIPMENT_TAGS, STRENGTH_CONFIG, withChosenDays, type StrengthPlan, type Day, type EquipmentTag, type Experience, type Focus, type SessionMinutes, type StrengthNote, type StrengthProfile } from '@/packages/strength'
import { EQUIPMENT_LABEL, STRENGTH_SETUP as T } from '@/lib/strength-bridge/display'
import { formatDuration } from '@/lib/format'

const LOAD: EquipmentTag[] = ['dumbbells', 'kettlebell', 'barbell', 'machines', 'cable']

export const STRENGTH_PROFILE_DEFAULT: StrengthProfile = {
  focus: 'running', sessions_per_week: 2, session_minutes: 45, equipment: ['bodyweight'], experience: 'some',
  unavailable_days: [], bone_health_flag: false,
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-5)' }}>
      <FieldLabel optional={optional}>{label}</FieldLabel>
      <div style={{ marginTop: 'var(--space-2)' }}>{children}</div>
    </div>
  )
}

export interface StrengthSetupScreenProps {
  profile: StrengthProfile | null
  /** From the run plan, already whitelisted; shown, never edited here. */
  planInjuries: string[]
  /** The current plan's notes, so the honest ones can be said once. */
  planNotes: StrengthNote[]
  /** The days shown as chosen on open (`prefillChosenDays`). Empty: the runner picks. */
  initialDays?: Day[]
  /** SAVE-PATTERN-01 — back from the consent screen, the answers the runner had (edits intact). */
  draft?: StrengthProfile | null
  /** STRENGTH-LEGS-DAY-01 — the stored plan's suggested legs day, said beneath the days while they are unchanged. */
  legsDay?: StrengthPlan['legs_day_suggestion'] | null
  onSave: (profile: StrengthProfile) => Promise<string | null>
}

export default function StrengthSetupScreen({ profile, planInjuries, planNotes, initialDays = [], draft = null, legsDay = null, onSave }: StrengthSetupScreenProps) {
  const [p, setP] = useState<StrengthProfile>(() => draft ?? withChosenDays(profile ?? STRENGTH_PROFILE_DEFAULT, initialDays))
  const chosen = (p.available_days ?? []) as DayKey[]
  const setDays = (v: DayKey[]) => {
    if (v.length > STRENGTH_CONFIG.MAX_CHOSEN_DAYS) return
    setP(x => (v.length ? withChosenDays(x, v as Day[]) : { ...x, available_days: [] }))
    setResult(null)
  }
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'saved' | 'failed' | null>(null)
  const dirty = useMemo(() => JSON.stringify(p) !== JSON.stringify(profile), [p, profile])
  const set = <K extends keyof StrengthProfile>(k: K, v: StrengthProfile[K]) => { setP(x => ({ ...x, [k]: v })); setResult(null) }
  const toggleKit = (t: EquipmentTag) => {
    const has = p.equipment.includes(t)
    const next = has ? p.equipment.filter(x => x !== t) : [...p.equipment.filter(x => x !== 'bodyweight' || t === 'bodyweight'), t]
    set('equipment', next.length ? next : ['bodyweight'])
  }

  async function save() {
    setBusy(true)
    const err = await onSave(p)
    setBusy(false)
    setResult(err ? 'failed' : 'saved')
  }

  return (
    <div style={{ padding: '0 16px var(--space-7)' }}>
      <Field label={T.focusLabel}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {(['running', 'general'] as Focus[]).map(f => (
            <CardSelect key={f} label={T.focus[f].label} sub={T.focus[f].sub} active={p.focus === f} onClick={() => set('focus', f)} />
          ))}
        </div>
      </Field>

      <Field label={T.daysLabel}>
        <DayGridSelector ariaLabel={T.daysLabel} value={chosen} onChange={setDays} />
        <FieldNote>{
          chosen.length >= STRENGTH_CONFIG.MAX_CHOSEN_DAYS ? T.daysMaxNote
            : planNotes.includes('legs_limited_by_run_week') && !dirty
              ? `${T.legsLimitedNote(p.focus)}${legsDay ? ` ${T.legsDayLine(legsDay)}` : ''}`
            : T.daysNote
        }</FieldNote>
      </Field>

      <Field label={T.minutesLabel}>
        <SegmentedControl<string>
          ariaLabel={T.minutesLabel}
          options={[30, 45, 60].map(m => ({ value: String(m), label: formatDuration(m) ?? String(m) }))}
          value={String(p.session_minutes)}
          onChange={v => set('session_minutes', Number(v) as SessionMinutes)}
        />
      </Field>

      <Field label={T.equipmentLabel}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {EQUIPMENT_TAGS.map(t => (
            <Chip key={t} label={EQUIPMENT_LABEL[t] ?? t} active={p.equipment.includes(t)} onClick={() => toggleKit(t)} />
          ))}
        </div>
        {!p.equipment.some(t => LOAD.includes(t)) && <FieldNote>{T.bodyweightNote}</FieldNote>}
      </Field>

      <Field label={T.experienceLabel}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
          {(['new', 'some', 'regular'] as Experience[]).map(e => (
            <Chip key={e} label={T.experience[e]} active={p.experience === e} onClick={() => set('experience', e)} />
          ))}
        </div>
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.5 }}>{T.boneLabel}</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', marginTop: '1px' }}>{T.boneSub}</div>
        </div>
        <Switch checked={p.bone_health_flag === true} onChange={() => set('bone_health_flag', !p.bone_health_flag)} ariaLabel={T.boneLabel} />
      </div>

      {planInjuries.length > 0 && <FieldNote>{T.injuriesNote(planInjuries)}</FieldNote>}

      <div style={{ marginTop: 'var(--space-5)' }}>
        <Button variant="primary" fullWidth busy={busy} disabled={busy || chosen.length === 0 || (!!profile && !dirty)} onClick={() => void save()}>
          {profile ? T.ctaUpdate : T.cta}
        </Button>
        {result === 'failed' && <InlineError style={{ marginTop: 'var(--space-2)' }}>{T.saveFailed}</InlineError>}
      </div>
    </div>
  )
}
