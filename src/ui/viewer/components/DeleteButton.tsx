import React, { useState } from 'react';
import { deleteFeedItem, type DeletableItemType } from '../utils/feed-deletion';
import { confirmDestructive, quoteForConfirm } from './ConfirmDialog';

interface DeleteButtonProps {
  itemType: DeletableItemType;
  id: number;
  /** The record's title, named in the confirmation. */
  name?: string | null;
  onDeleted: (itemType: DeletableItemType, id: number) => void;
}

const ITEM_LABELS: Record<DeletableItemType, string> = {
  observation: 'observation',
  summary: 'session summary',
};

/**
 * Trash-icon button that deletes a feed item after a named confirmation. A
 * refused delete (synced from another device, cloud sync unavailable, worker
 * down) is shown inline next to the button instead of failing silently.
 */
export function DeleteButton({ itemType, id, name, onDeleted }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const label = ITEM_LABELS[itemType];
  const quoted = quoteForConfirm(name);

  const handleClick = async () => {
    if (isDeleting) return;
    const confirmed = await confirmDestructive({
      title: quoted ? `Delete ${label} ${quoted}?` : `Delete ${label} #${id}?`,
      body: `Future sessions will no longer recall this ${label}. This cannot be undone.`,
      confirmLabel: `Delete ${label}`,
    });
    if (!confirmed) return;
    setIsDeleting(true);
    setFailure(null);
    try {
      await deleteFeedItem(itemType, id);
      onDeleted(itemType, id);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="icon-btn icon-btn--small card-delete-btn"
        onClick={handleClick}
        aria-disabled={isDeleting}
        aria-label={`Delete ${label}`}
        data-tooltip={`Delete ${label}`}
        data-tooltip-align="end"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
      {failure && <span className="card-delete-error" role="alert">{failure}</span>}
    </>
  );
}
