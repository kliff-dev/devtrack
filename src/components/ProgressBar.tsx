import './ProgressBar.css'

interface ProgressBarProps {
  /** 0–100; values outside the range are clamped. */
  value: number
  label: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      data-complete={clamped >= 100 || undefined}
    >
      <div className="progress__fill" style={{ width: `${clamped}%` }} />
    </div>
  )
}
