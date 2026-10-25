import { useId, useState, type FormEvent } from 'react'
import { PRIORITIES, PRIORITY_LABELS } from '../constants.ts'
import { projectColor } from '../lib/colors.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import type { NextAction, Priority, Project } from '../types.ts'
import { Icon } from './Icon.tsx'
import './NextActions.css'

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

function byPriority(a: NextAction, b: NextAction) {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || b.createdAt.localeCompare(a.createdAt)
}

/** Checklist of next steps with a quick-add form. */
export function NextActions() {
  const { actions, projects, projectsById, addAction, toggleAction, deleteAction } = useDevTrack()
  const [title, setTitle] = useState('')
  const [projectId, setProjectId] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [showCompleted, setShowCompleted] = useState(false)

  const open = actions.filter((action) => !action.done).sort(byPriority)
  const completed = actions.filter((action) => action.done)
  const assignable = projects.filter((project) => project.status !== 'completed')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    addAction({ title: trimmed, projectId: projectId || undefined, priority })
    setTitle('')
  }

  const renderItem = (action: NextAction) => (
    <ActionItem
      key={action.id}
      action={action}
      project={action.projectId ? projectsById.get(action.projectId) : undefined}
      onToggle={() => toggleAction(action.id)}
      onDelete={() => deleteAction(action.id)}
    />
  )

  return (
    <div className="next-actions">
      <form className="next-actions__form" onSubmit={handleSubmit}>
        <div className="next-actions__row">
          <input
            className="input"
            value={title}
            maxLength={120}
            placeholder="Add a next action…"
            aria-label="New action"
            onChange={(event) => setTitle(event.target.value)}
          />
          <button
            type="submit"
            className="btn btn--primary btn--square"
            aria-label="Add action"
            disabled={!title.trim()}
          >
            <Icon name="plus" />
          </button>
        </div>
        {title.trim() && (
          <div className="next-actions__options">
            <select
              className="select select--sm"
              value={projectId}
              aria-label="Project"
              onChange={(event) => setProjectId(event.target.value)}
            >
              <option value="">No project</option>
              {assignable.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <select
              className="select select--sm"
              value={priority}
              aria-label="Priority"
              onChange={(event) => setPriority(event.target.value as Priority)}
            >
              {PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]} priority
                </option>
              ))}
            </select>
          </div>
        )}
      </form>

      {open.length > 0 ? (
        <ul className="action-list">{open.map(renderItem)}</ul>
      ) : (
        <p className="next-actions__empty">All caught up. Add your next step above.</p>
      )}

      {completed.length > 0 && (
        <div className="next-actions__completed">
          <button
            type="button"
            className="next-actions__toggle"
            aria-expanded={showCompleted}
            onClick={() => setShowCompleted((shown) => !shown)}
          >
            {showCompleted ? 'Hide' : 'Show'} completed ({completed.length})
          </button>
          {showCompleted && <ul className="action-list">{completed.map(renderItem)}</ul>}
        </div>
      )}
    </div>
  )
}

interface ActionItemProps {
  action: NextAction
  project?: Project
  onToggle: () => void
  onDelete: () => void
}

function ActionItem({ action, project, onToggle, onDelete }: ActionItemProps) {
  const id = useId()
  return (
    <li className="action-item" data-done={action.done || undefined}>
      <input id={id} type="checkbox" className="checkbox" checked={action.done} onChange={onToggle} />
      <div className="action-item__body">
        <label htmlFor={id} className="action-item__title">
          {action.title}
        </label>
        <div className="action-item__meta">
          <span className="priority-tag" data-priority={action.priority}>
            {PRIORITY_LABELS[action.priority]}
          </span>
          {project && (
            <span className="action-item__project">
              <span
                className="action-item__dot"
                style={{ background: projectColor(project.id) }}
              />
              {project.name}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="icon-btn icon-btn--danger action-item__delete"
        aria-label={`Delete “${action.title}”`}
        onClick={onDelete}
      >
        <Icon name="trash" size={15} />
      </button>
    </li>
  )
}
