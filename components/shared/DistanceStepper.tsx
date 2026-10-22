'use client'
// The ratified distance input (STEPPER-CONTROL-01): whole units and one decimal, each with − / +, no keyboard. Extracted
// from `ManualRunModal` (UNMEASURED-DISTANCE-01) so the "How far did you run?" sheet uses the SAME control rather than a
// copy; the markup is unchanged.
import IconButton from '@/components/ui/IconButton'

export interface DistanceStepperProps {
  whole: number
  decimal: number
  onWhole: (n: number) => void
  onDecimal: (n: number) => void
  /** The runner's units, for the readout and the screen-reader value. */
  units: 'km' | 'mi'
}

export default function DistanceStepper({ whole, decimal, onWhole, onDecimal, units }: DistanceStepperProps) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '0.5px solid var(--line)', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', padding: '14px 8px' }}>
          {/* 🔴 THESE FOUR PASSED `border: '0.5px solid var(--line)'` INLINE, and an inline style beats a class — so
              `ICON-EDGE-01`'s `1px var(--chrome-edge)` never landed on them. Only the 18px glyph is the call site's. */}
          <IconButton onClick={() => onWhole(Math.max(0, whole - 1))} ariaLabel="Decrease whole distance" shape="square" style={{ fontSize: '18px' }} icon={<span aria-hidden>−</span>} />
          <span
            role="spinbutton"
            aria-label="Whole distance"
            aria-valuenow={whole}
            aria-valuemin={0}
            aria-valuetext={`${whole} ${units}`}
            style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--ink)', minWidth: '32px', textAlign: 'center' }}
          >{whole}</span>
          <IconButton onClick={() => onWhole(whole + 1)} ariaLabel="Increase whole distance" shape="square" style={{ fontSize: '18px' }} icon={<span aria-hidden>+</span>} />
        </div>
        <div aria-hidden style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--mute)', padding: '0 4px' }}>.</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', padding: '14px 8px' }}>
          <IconButton onClick={() => onDecimal(Math.max(0, decimal - 1))} ariaLabel="Decrease distance decimal" shape="square" style={{ fontSize: '18px' }} icon={<span aria-hidden>−</span>} />
          <span
            role="spinbutton"
            aria-label="Distance decimal"
            aria-valuenow={decimal}
            aria-valuemin={0}
            aria-valuemax={9}
            aria-valuetext={`point ${decimal}`}
            style={{ fontFamily: 'var(--font-ui)', fontSize: '28px', fontWeight: 500, color: 'var(--ink)', minWidth: '16px', textAlign: 'center' }}
          >{decimal}</span>
          <IconButton onClick={() => onDecimal(Math.min(9, decimal + 1))} ariaLabel="Increase distance decimal" shape="square" style={{ fontSize: '18px' }} icon={<span aria-hidden>+</span>} />
        </div>
      </div>
      <div aria-live="polite" style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', marginTop: '4px', textAlign: 'center' }}>{whole}.{decimal} {units}</div>
    </>
  )
}
