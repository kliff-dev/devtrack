import { STATUS_LABELS } from '../constants.ts'
import type { ProjectStatus } from '../types.ts'
import './StatusBadge.css'

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span className="status-badge" data-status={status}>
      <span className="status-badge__dot" />
      {STATUS_LABELS[status]}
    </span>
  )
}
