import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

export interface ConfirmOptions {
  /** Names the exact thing being destroyed, e.g. `Delete observation "Fix reclaim"?` */
  title: string;
  /** What is lost, in one sentence. */
  body?: string;
  /** Destructive verb on the confirm button, e.g. "Delete observation". */
  confirmLabel: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
  onResolve: (confirmed: boolean) => void;
}

/**
 * Named confirmation for a destructive action: Cancel holds default focus,
 * Escape and the backdrop cancel, and Tab stays inside the dialog.
 */
export function ConfirmDialog({ title, body, confirmLabel, onResolve }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onResolve(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const first = cancelRef.current;
    const last = confirmRef.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="confirm-dialog-backdrop" onMouseDown={() => onResolve(false)}>
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={body ? 'confirm-dialog-body' : undefined}
        onMouseDown={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h2>
        {body && <p id="confirm-dialog-body" className="confirm-dialog-body">{body}</p>}
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="btn btn-secondary confirm-dialog-cancel" onClick={() => onResolve(false)}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className="btn btn-danger confirm-dialog-confirm" onClick={() => onResolve(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Opens a ConfirmDialog in its own root and resolves with the choice. Focus
 * returns to whatever held it when the dialog opened.
 */
export function confirmDestructive(options: ConfirmOptions): Promise<boolean> {
  const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  return new Promise(resolve => {
    const finish = (confirmed: boolean) => {
      root.unmount();
      container.remove();
      if (trigger?.isConnected) trigger.focus();
      resolve(confirmed);
    };
    root.render(<ConfirmDialog {...options} onResolve={finish} />);
  });
}

/** Clips a record's title for a confirmation heading. */
export function quoteForConfirm(text: string | null | undefined, max = 60): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return `“${clean.length > max ? `${clean.slice(0, max - 1)}…` : clean}”`;
}
