import { formatRelative } from '../lib/format.ts'
import { isHttpUrl } from '../lib/parsers.ts'
import { folderName } from '../lib/paths.ts'
import type { Project } from '../types.ts'
import { Icon } from './Icon.tsx'
import { ProgressBar } from './ProgressBar.tsx'
import { ProjectAvatar } from './ProjectAvatar.tsx'
import { StatusBadge } from './StatusBadge.tsx'
import { TechTags } from './TechTags.tsx'
import './ProjectCard.css'

interface ProjectCardProps {
  project: Project
  openActions: number
  now: number
  onEdit: () => void
  onDelete: () => void
}

export function ProjectCard({ project, openActions, now, onEdit, onDelete }: ProjectCardProps) {
  // Stored data is user-editable, so only link out to real http(s) URLs.
  const repoUrl = project.repoUrl && isHttpUrl(project.repoUrl) ? project.repoUrl : undefined

  return (
    <article className="project-card">
      <header className="project-card__header">
        <ProjectAvatar project={project} size={40} />
        <div className="project-card__heading">
          <h3 className="project-card__name">{project.name}</h3>
          <StatusBadge status={project.status} />
        </div>
        <div className="project-card__tools">
          <button
            type="button"
            className="icon-btn"
            aria-label={`Edit ${project.name}`}
            title="Edit"
            onClick={onEdit}
          >
            <Icon name="edit" />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            aria-label={`Delete ${project.name}`}
            title="Delete"
            onClick={onDelete}
          >
            <Icon name="trash" />
          </button>
        </div>
      </header>

      <p className="project-card__description">
        {project.description || <span className="muted">No description yet.</span>}
      </p>

      <TechTags technologies={project.technologies} limit={4} />

      <div className="project-card__progress">
        <div className="project-card__progress-label">
          <span>Progress</span>
          <span>{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} label={`${project.name} progress`} />
      </div>

      <footer className="project-card__footer">
        <span>
          <Icon name="clock" size={13} />
          Updated {formatRelative(project.updatedAt, now)}
        </span>
        {openActions > 0 && (
          <span>
            <Icon name="listChecks" size={13} />
            {openActions} open {openActions === 1 ? 'action' : 'actions'}
          </span>
        )}
        {project.localPath && (
          <span className="project-card__folder" title={project.localPath}>
            <Icon name="folder" size={13} />
            {folderName(project.localPath)}
          </span>
        )}
        {repoUrl && (
          <a className="project-card__repo" href={repoUrl} target="_blank" rel="noreferrer">
            Repo
            <Icon name="externalLink" size={12} />
          </a>
        )}
      </footer>
    </article>
  )
}
