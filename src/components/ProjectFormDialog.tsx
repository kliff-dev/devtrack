import { useId, useMemo, useState, type FormEvent } from 'react'
import { PROJECT_STATUSES, STATUS_LABELS } from '../constants.ts'
import { isHttpUrl } from '../lib/parsers.ts'
import { useDevTrack } from '../store/DevTrackContext.ts'
import type { Project, ProjectDraft, ProjectStatus } from '../types.ts'
import { Modal } from './Modal.tsx'
import { SegmentedControl } from './SegmentedControl.tsx'
import { TagInput } from './TagInput.tsx'
import './ProjectFormDialog.css'

interface ProjectFormDialogProps {
  /** Omit to create a new project. */
  project?: Project
  onClose: () => void
}

type Errors = Partial<Record<'name' | 'repoUrl', string>>

const EMPTY_DRAFT: ProjectDraft = {
  name: '',
  description: '',
  status: 'active',
  technologies: [],
  progress: 0,
  repoUrl: '',
  localPath: '',
}

const STATUS_OPTIONS = PROJECT_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}))

export function ProjectFormDialog({ project, onClose }: ProjectFormDialogProps) {
  const { projects, saveProject } = useDevTrack()
  const [draft, setDraft] = useState<ProjectDraft>(() =>
    project
      ? {
          name: project.name,
          description: project.description,
          status: project.status,
          technologies: project.technologies,
          progress: project.progress,
          repoUrl: project.repoUrl ?? '',
          localPath: project.localPath ?? '',
        }
      : EMPTY_DRAFT,
  )
  const [errors, setErrors] = useState<Errors>({})
  const ids = useId()

  const techSuggestions = useMemo(
    () => [...new Set(projects.flatMap((item) => item.technologies))].sort(),
    [projects],
  )

  function update<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
    if (key in errors) setErrors(({ [key]: _fixed, ...rest }) => rest)
  }

  function changeStatus(status: ProjectStatus) {
    // Marking a project completed implies it's done; bump progress to match.
    setDraft((current) => ({
      ...current,
      status,
      progress: status === 'completed' ? 100 : current.progress,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = draft.name.trim()
    const repoUrl = draft.repoUrl?.trim() ?? ''
    const nextErrors: Errors = {}
    if (!name) nextErrors.name = 'Give the project a name.'
    if (repoUrl && !isHttpUrl(repoUrl)) {
      nextErrors.repoUrl = 'Use a full URL, like https://github.com/you/repo.'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return

    saveProject(
      {
        ...draft,
        name,
        description: draft.description.trim(),
        repoUrl: repoUrl || undefined,
        localPath: draft.localPath?.trim() || undefined,
      },
      project?.id,
    )
    onClose()
  }

  return (
    <Modal
      title={project ? 'Edit project' : 'New project'}
      description={
        project ? 'Update the details for this project.' : 'Add something you’re building.'
      }
      onClose={onClose}
    >
      <form className="modal__form" onSubmit={handleSubmit} noValidate>
        <div className="modal__body project-form">
          <div className="field project-form__full">
            <label className="field__label" htmlFor={`${ids}-name`}>
              Name
            </label>
            <input
              id={`${ids}-name`}
              className="input"
              value={draft.name}
              maxLength={60}
              placeholder="e.g. DevTrack"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? `${ids}-name-error` : undefined}
              onChange={(event) => update('name', event.target.value)}
              data-autofocus
            />
            {errors.name && (
              <p id={`${ids}-name-error`} className="field__error">
                {errors.name}
              </p>
            )}
          </div>

          <div className="field project-form__full">
            <label className="field__label" htmlFor={`${ids}-description`}>
              Description
            </label>
            <textarea
              id={`${ids}-description`}
              className="textarea"
              value={draft.description}
              maxLength={280}
              rows={3}
              placeholder="What is it, and why are you building it?"
              onChange={(event) => update('description', event.target.value)}
            />
          </div>

          <div className="field project-form__full">
            <span className="field__label">Status</span>
            <SegmentedControl
              label="Status"
              options={STATUS_OPTIONS}
              value={draft.status}
              onChange={changeStatus}
            />
          </div>

          <div className="field project-form__full">
            <label className="field__label" htmlFor={`${ids}-tech`}>
              Technologies
            </label>
            <TagInput
              id={`${ids}-tech`}
              value={draft.technologies}
              onChange={(technologies) => update('technologies', technologies)}
              placeholder="Type a technology and press Enter"
              suggestions={techSuggestions}
            />
          </div>

          <div className="field">
            <label className="field__label project-form__progress-label" htmlFor={`${ids}-progress`}>
              Progress
              <span>{draft.progress}%</span>
            </label>
            <input
              id={`${ids}-progress`}
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.progress}
              onChange={(event) => update('progress', Number(event.target.value))}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor={`${ids}-repo`}>
              Repository <span className="muted">(optional)</span>
            </label>
            <input
              id={`${ids}-repo`}
              className="input"
              type="url"
              inputMode="url"
              value={draft.repoUrl}
              placeholder="https://github.com/…"
              aria-invalid={Boolean(errors.repoUrl)}
              aria-describedby={errors.repoUrl ? `${ids}-repo-error` : undefined}
              onChange={(event) => update('repoUrl', event.target.value)}
            />
            {errors.repoUrl && (
              <p id={`${ids}-repo-error`} className="field__error">
                {errors.repoUrl}
              </p>
            )}
          </div>

          <div className="field project-form__full">
            <label className="field__label" htmlFor={`${ids}-folder`}>
              Local folder <span className="muted">(optional)</span>
            </label>
            <input
              id={`${ids}-folder`}
              className="input"
              value={draft.localPath}
              placeholder="C:\Users\you\Projects\app"
              spellCheck={false}
              onChange={(event) => update('localPath', event.target.value)}
            />
            <p className="field__hint">
              Synced sessions and commits from this folder are attributed to the project.
            </p>
          </div>
        </div>

        <footer className="modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary">
            {project ? 'Save changes' : 'Create project'}
          </button>
        </footer>
      </form>
    </Modal>
  )
}
