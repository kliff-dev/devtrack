import type { ReactNode } from 'react'
import { Modal } from './Modal.tsx'

interface ConfirmDialogProps {
  title: string
  message: ReactNode
  confirmLabel: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  tone = 'default',
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} size="sm" onClose={onClose}>
      <div className="modal__body">
        <p className="muted">{message}</p>
      </div>
      <footer className="modal__footer">
        <button type="button" className="btn btn--ghost" onClick={onClose} data-autofocus>
          Cancel
        </button>
        <button
          type="button"
          className={tone === 'danger' ? 'btn btn--danger' : 'btn btn--primary'}
          onClick={() => {
            onConfirm()
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </footer>
    </Modal>
  )
}
