import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon.tsx'
import './Modal.css'

interface ModalProps {
  title: string
  description?: ReactNode
  size?: 'sm' | 'md'
  onClose: () => void
  children: ReactNode
}

/**
 * Native <dialog> shown as a modal while mounted, so focus trapping and the
 * Escape key come from the browser. Render it conditionally to open it.
 * An element marked `data-autofocus` receives focus on open.
 */
export function Modal({ title, description, size = 'md', onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pressStartedOnBackdrop = useRef(false)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className={`modal modal--${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // Only close when both press and release land on the backdrop, so a text
      // selection that ends outside the panel doesn't dismiss the form.
      onPointerDown={(event) => {
        pressStartedOnBackdrop.current = event.target === event.currentTarget
      }}
      onClick={(event) => {
        if (pressStartedOnBackdrop.current && event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal__panel">
        <header className="modal__header">
          <div>
            <h2 id={titleId} className="modal__title">
              {title}
            </h2>
            {description && <p className="modal__description">{description}</p>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
