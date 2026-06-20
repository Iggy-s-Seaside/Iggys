import { useEffect, useState } from 'react';
import { Modal } from './ui/Modal';

const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: '⌘K / Ctrl+K', label: 'Open the command palette — jump anywhere + quick actions' },
  { keys: '?', label: 'Show this shortcuts list' },
  { keys: 'Esc', label: 'Close any open dialog, sheet, or the palette' },
  { keys: '↑ ↓ · Enter', label: 'Move through + run a command in the palette' },
];

/** Don't hijack "?" while the user is typing into a field. */
function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return (
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA' ||
    node.tagName === 'SELECT' ||
    node.isContentEditable === true
  );
}

/**
 * A discoverable keyboard-shortcuts cheatsheet, opened by pressing "?" (the
 * convention used by GitHub/Linear/etc.) anywhere outside a text field. Reuses
 * the shared Modal so it inherits the focus trap + Escape-to-close. Mounted once
 * in DashboardLayout. Harmless on mobile (no hardware keyboard to fire it).
 */
export function ShortcutsSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Keyboard shortcuts" maxWidth="max-w-sm">
      <ul className="space-y-3">
        {SHORTCUTS.map((s) => (
          <li key={s.keys} className="flex items-center justify-between gap-4">
            <span className="text-sm text-text-secondary">{s.label}</span>
            <kbd className="shrink-0 rounded-md border border-border bg-surface-hover px-2 py-1 text-xs font-mono text-text-primary">
              {s.keys}
            </kbd>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default ShortcutsSheet;
