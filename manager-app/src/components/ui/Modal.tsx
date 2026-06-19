import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg' }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  // Focus trap + Escape-to-close + focus restore (shared via useFocusTrap).
  useFocusTrap(open, dialogRef, { onEscape: onClose });

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative ${maxWidth} w-full bg-surface rounded-t-xl sm:rounded-xl shadow-modal border border-border max-h-[85dvh] sm:max-h-[90dvh] flex flex-col focus:outline-none`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id={titleId} className="text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-hover transition-colors text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>,
    document.body
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = true }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <p className="text-text-secondary text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button onClick={() => { onConfirm(); onClose(); }} className={danger ? 'btn-danger' : 'btn-primary'}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
