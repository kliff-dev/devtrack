import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon.tsx'
import './EmptyState.css'

interface EmptyStateProps {
  icon: IconName
  title: string
  description?: ReactNode
  action?: ReactNode
  boxed?: boolean
}

export function EmptyState({ icon, title, description, action, boxed = false }: EmptyStateProps) {
  return (
    <div className={boxed ? 'empty-state empty-state--boxed' : 'empty-state'}>
      <span className="empty-state__icon">
        <Icon name={icon} size={20} />
      </span>
      <p className="empty-state__title">{title}</p>
      {description && <p className="empty-state__description">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}
