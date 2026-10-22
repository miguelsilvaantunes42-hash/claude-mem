import React, { useRef, useState } from 'react';
import { SessionCatalogEntry } from '../types';
import { formatDate } from '../utils/formatters';
import { SessionCardMenu } from './SessionCardMenu';
import { confirmDestructive, quoteForConfirm } from './ConfirmDialog';

interface SessionCardProps {
  session: SessionCatalogEntry;
  onOpen: () => void;
  /** Deletes the session; rejects with a user-facing reason when the worker refuses. */
  onDelete: () => Promise<void>;
}

export function SessionCard({ session, onOpen, onDelete }: SessionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const name = session.custom_title || session.project;
  const date = formatDate(session.started_at_epoch);
  const memoriesLabel = session.item_count === 1 ? '1 memory' : `${session.item_count} memories`;

  const handleDelete = async () => {
    const confirmed = await confirmDestructive({
      title: `Delete session ${quoteForConfirm(name)}?`,
      body: `This removes the session and the ${memoriesLabel} captured in it, so future sessions can no longer recall them. This cannot be undone.`,
      confirmLabel: 'Delete session',
    });
    if (!confirmed) return;
    setIsDeleting(true);
    setFailure(null);
    try {
      await onDelete();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`session-card${isDeleting ? ' session-card--deleting' : ''}`}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label={`Open session ${name}, ${memoriesLabel}`}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="session-card-header">
        <div className="session-card-title-group">
          <span className="session-card-name">{name}</span>
          <span className="session-card-count">{memoriesLabel}</span>
        </div>
        <div className="session-card-actions">
          <button
            ref={triggerRef}
            type="button"
            className="icon-btn icon-btn--small session-card-menu-trigger"
            aria-disabled={isDeleting}
            onClick={e => {
              e.stopPropagation();
              if (!isDeleting) setMenuOpen(prev => !prev);
            }}
            aria-label="Session actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-tooltip="Session actions"
            data-tooltip-align="end"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="5" r="1.5"></circle>
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="12" cy="19" r="1.5"></circle>
            </svg>
          </button>
          {menuOpen && (
            <SessionCardMenu
              onClose={() => {
                setMenuOpen(false);
                triggerRef.current?.focus();
              }}
              onOpen={onOpen}
              onDelete={handleDelete}
            />
          )}
          <svg className="session-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
      <div className="session-card-meta">
        <span className="session-card-project">{session.project}</span>
        <span className="session-card-platform">{session.platform_source}</span>
        <time className="session-card-date" dateTime={new Date(session.started_at_epoch).toISOString()}>{date}</time>
        <span className="session-card-id" title={session.content_session_id}>
          {session.content_session_id}
        </span>
      </div>
      {failure && (
        <div className="card-delete-error" role="alert" onClick={e => e.stopPropagation()}>{failure}</div>
      )}
    </div>
  );
}
