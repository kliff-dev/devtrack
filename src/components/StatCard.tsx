import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon.tsx'
import './StatCard.css'

interface StatCardProps {
  label: string
  value: string
  icon: IconName
  meta?: ReactNode
  /** One-line detail pinned to the bottom, so footers line up across a row of cards. */
  footer?: ReactNode
}

export function StatCard({ label, value, icon, meta, footer }: StatCardProps) {
  return (
    <article className="stat-card">
      <div className="stat-card__top">
        <h3 className="stat-card__label">{label}</h3>
        <span className="stat-card__icon">
          <Icon name={icon} size={15} />
        </span>
      </div>
      <p className="stat-card__value">{value}</p>
      {meta && <p className="stat-card__meta">{meta}</p>}
      {footer && <div className="stat-card__footer">{footer}</div>}
    </article>
  )
}

/** A signed change with an arrow, so direction never relies on color alone. */
export function StatDelta({ value }: { value: number | null }) {
  if (value === null) return null
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'
  return (
    <span className="stat-delta" data-direction={direction}>
      {arrow} {Math.abs(value)}%
    </span>
  )
}
