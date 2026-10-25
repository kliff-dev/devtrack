import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog.tsx'
import { EmptyState } from '../components/EmptyState.tsx'
import { Icon } from '../components/Icon.tsx'
import { PageHeader } from '../components/PageHeader.tsx'
import { ProjectCard } from '../components/ProjectCard.tsx'
import { ProjectFormDialog } from '../components/ProjectFormDialog.tsx'
import { SegmentedControl, type SegmentOption } from '../components/SegmentedControl.tsx'
import { PROJECT_STATUSES, STATUS_LABELS } from '../constants.ts'
import { codingMinutesByProject } from '../lib/stats.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import type { Project, ProjectStatus } from '../types.ts'
import './ProjectsView.css'

type StatusFilter = ProjectStatus | 'all'
type SortKey = 'updated' | 'name' | 'progress'

const SORTERS: Record<SortKey, (a: Project, b: Project) => number> = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  name: (a, b) => a.name.localeCompare(b.name),
  progress: (a, b) => b.progress - a.progress,
}

function matchesQuery(project: Project, query: string) {
  if (!query) return true
  return [project.name, project.description, ...project.technologies].some((text) =>
    text.toLowerCase().includes(query),
  )
}

export function ProjectsView() {
  const { projects, actions, activity, now, deleteProject } = useDevTrack()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<SortKey>('updated')
  const [editing, setEditing] = useState<Project | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  const statusOptions: SegmentOption<StatusFilter>[] = [
    { value: 'all', label: 'All', count: projects.length },
    ...PROJECT_STATUSES.map((value) => ({
      value,
      label: STATUS_LABELS[value],
      count: projects.filter((project) => project.status === value).length,
    })),
  ]

  const openActionCounts = new Map<string, number>()
  for (const action of actions) {
    if (action.done || !action.projectId) continue
    openActionCounts.set(action.projectId, (openActionCounts.get(action.projectId) ?? 0) + 1)
  }
  const minutesByProject = codingMinutesByProject(activity, new Date(0))

  const needle = query.trim().toLowerCase()
  const visible = projects
    .filter((project) => status === 'all' || project.status === status)
    .filter((project) => matchesQuery(project, needle))
    .sort(SORTERS[sort])

  const activeCount = projects.filter((project) => project.status === 'active').length
  const newProjectButton = (
    <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
      <Icon name="plus" />
      New project
    </button>
  )

  return (
    <div className="page">
      <PageHeader
        title="Projects"
        description={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'} · ${activeCount} active`}
        actions={newProjectButton}
      />

      {projects.length === 0 ? (
        <EmptyState
          boxed
          icon="folder"
          title="No projects yet"
          description="Create your first project to track its status, technologies and progress."
          action={newProjectButton}
        />
      ) : (
        <>
          <div className="projects-toolbar">
            <label className="search">
              <Icon name="search" />
              <input
                type="search"
                className="input"
                value={query}
                placeholder="Search name, description or tech"
                aria-label="Search projects"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <SegmentedControl
              label="Filter by status"
              options={statusOptions}
              value={status}
              onChange={setStatus}
            />
            <select
              className="select projects-toolbar__sort"
              value={sort}
              aria-label="Sort projects"
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
              <option value="progress">Progress</option>
            </select>
          </div>

          {visible.length > 0 ? (
            <div className="project-grid">
              {visible.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  now={now}
                  openActions={openActionCounts.get(project.id) ?? 0}
                  totalMinutes={minutesByProject.get(project.id) ?? 0}
                  onEdit={() => setEditing(project)}
                  onDelete={() => setDeleting(project)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              boxed
              icon="search"
              title="No matching projects"
              description="Try a different search term or status filter."
              action={
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setQuery('')
                    setStatus('all')
                  }}
                >
                  Clear filters
                </button>
              }
            />
          )}
        </>
      )}

      {editing && (
        <ProjectFormDialog
          project={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message={deleteMessage(
            actions.filter((action) => action.projectId === deleting.id).length,
            activity.filter((entry) => entry.projectId === deleting.id).length,
            Boolean(deleting.localPath),
          )}
          confirmLabel="Delete project"
          tone="danger"
          onConfirm={() => deleteProject(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  )
}

function deleteMessage(actionCount: number, activityCount: number, hasFolder: boolean): string {
  const parts = []
  if (actionCount) parts.push(`${actionCount} next ${actionCount === 1 ? 'action' : 'actions'}`)
  if (activityCount) {
    parts.push(`${activityCount} activity ${activityCount === 1 ? 'entry' : 'entries'}`)
  }
  const extra = parts.length ? ` along with its ${parts.join(' and ')}` : ''
  const folder = hasFolder
    ? ' Its folder is ignored by future syncs; you can undo that in Settings.'
    : ''
  return `This removes the project${extra}. It can’t be undone.${folder}`
}
