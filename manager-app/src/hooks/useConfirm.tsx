import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../components/ui/Modal';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface DialogState extends ConfirmOptions {
  open: boolean;
}

const CLOSED: DialogState = { open: false, title: '', message: '' };

/**
 * App-root provider that renders a single branded confirm dialog and exposes a
 * promise-based `confirm()` to descendants. Drop-in replacement for the native,
 * PWA-broken `window.confirm()`.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState>(CLOSED);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const confirm = useCallback<ConfirmFn>((options) => {
    // If a prompt is somehow already pending, resolve it falsy before reusing.
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, ...options });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={state.open} onClose={() => settle(false)} title={state.title} maxWidth="max-w-sm">
        <p className="text-text-secondary text-sm mb-6 whitespace-pre-line">{state.message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={() => settle(false)} className="btn-secondary">
            {state.cancelLabel ?? 'Cancel'}
          </button>
          <button onClick={() => settle(true)} className={state.danger ? 'btn-danger' : 'btn-primary'}>
            {state.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/**
 * Returns a `confirm()` that resolves to `true` when the manager confirms and
 * `false` when they cancel or dismiss — use with `await`.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete?', message: '…', danger: true }))) return;
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
}
