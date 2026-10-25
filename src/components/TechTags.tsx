import { techColor } from '../lib/colors.ts'
import './TechTags.css'

interface TechTagsProps {
  technologies: string[]
  /** Show at most this many, with a "+N" chip for the rest. */
  limit?: number
}

export function TechTags({ technologies, limit }: TechTagsProps) {
  const shown = limit ? technologies.slice(0, limit) : technologies
  const hidden = technologies.length - shown.length

  if (technologies.length === 0) return null

  return (
    <ul className="tech-tags" aria-label="Technologies">
      {shown.map((name) => (
        <li key={name} className="tech-tag">
          <span className="tech-tag__dot" style={{ background: techColor(name) }} />
          {name}
        </li>
      ))}
      {hidden > 0 && (
        <li className="tech-tag tech-tag--more" title={technologies.slice(shown.length).join(', ')}>
          +{hidden}
        </li>
      )}
    </ul>
  )
}
