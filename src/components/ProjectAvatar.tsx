import type { CSSProperties } from 'react'
import { projectColor } from '../lib/colors.ts'
import type { Project } from '../types.ts'
import './ProjectAvatar.css'

interface ProjectAvatarProps {
  project: Pick<Project, 'id' | 'name'>
  size?: number
}

function initials(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export function ProjectAvatar({ project, size = 36 }: ProjectAvatarProps) {
  const style = {
    '--avatar-color': projectColor(project.id),
    width: size,
    height: size,
    fontSize: Math.round(size * 0.36),
  } as CSSProperties

  return (
    <span className="project-avatar" style={style} aria-hidden="true">
      {initials(project.name) || '?'}
    </span>
  )
}
