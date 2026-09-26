'use client'

/**
 * TextArea — the multi-line field. `TextField`'s missing half.
 *
 * 🔴 WHY IT DID NOT EXIST AND WHAT THAT COST. `TextField` has owned the
 * single-line field since FORMS-PRIM-01; the multi-line one was hand-rolled
 * **four times across three files** and the four disagreed on **9 of 13 styled
 * properties** — two grounds, three radii, four paddings, two border weights,
 * two `resize` values, and `--text-primary` on half of them.
 *
 * 🔴 ONE OF THOSE DISAGREEMENTS WAS A LIVE iOS DEFECT, and our own code had
 * already written it down. `TextField.tsx` opens with: *"fontSize is locked at
 * 16px — iOS zooms any focused input below 16px and the `maximum-scale=1`
 * viewport then traps the user zoomed in."* **The manual run log's Notes field
 * was 13px**, so tapping it zoomed the page and stranded the runner — on the one
 * screen that is the entire logging path for someone without Strava.
 *
 * ⚠️ AND IT SURVIVED A RULING AIMED AT IT. `STEPPER-CONTROL-01 (c)` moved the
 * Average HR field in that same modal onto `TextField` **precisely because a
 * hand-rolled input was wrong**, and the textarea **eleven lines below it** was
 * not touched. Sixth "the remedy was applied to one twin" in this repo's record.
 *
 * 🎪 Collins, at the sitting that produced this: *"Fifth time — `.cta-pill`,
 * `--accent`, `BackButton`, `TextField`, now this. I said the pattern file is
 * good and not being read. It is worse than that: **the file does not have the
 * part we keep needing.** A form system with a single-line field and no
 * multi-line field is not a system."*
 *
 * The contract deliberately mirrors `TextField`: same 16px lock, same tokens,
 * same required accessible name. Divergence between the two would be the defect
 * this file exists to end.
 */
// ⚠️ A NAMED export, because `TextField` is one. Two export styles for two
// halves of the same primitive is the kind of small inconsistency that makes a
// system feel unfindable — which is the complaint that produced this file.
export function TextArea({
  value,
  onChange,
  ariaLabel,
  placeholder,
  rows = 3,
  maxLength,
  id,
}: {
  value: string
  onChange: (v: string) => void
  /** REQUIRED, as on every other input primitive. A field nobody can name is a
   *  field a screen-reader user meets as "edit text, blank". */
  ariaLabel: string
  placeholder?: string
  rows?: number
  maxLength?: number
  id?: string
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      aria-label={ariaLabel}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'var(--bg-soft)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-md)',
        padding: '13px 14px',
        // 🔴 16px is non-negotiable and is the reason this file exists.
        fontFamily: 'var(--font-ui)', fontSize: '16px',
        lineHeight: 1.5,
        color: 'var(--ink)',
        outline: 'none',
        // ⚠️ `vertical`, matching three of the four call sites. The fourth
        // (Notes) was `none`, which is the only one where the runner might
        // genuinely write several sentences.
        resize: 'vertical',
      }}
    />
  )
}
