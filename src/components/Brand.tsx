import { Icon } from './Icon.tsx'
import './Brand.css'

export function Brand() {
  return (
    <span className="brand">
      <span className="brand__mark">
        <Icon name="code" size={16} strokeWidth={2.4} />
      </span>
      <span className="brand__name">DevTrack</span>
    </span>
  )
}
