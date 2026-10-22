import React, { useEffect, useState } from 'react';

/** Loader delay: work that finishes inside it never flashes a loader. */
const LOADER_DELAY_MS = 100;

/** `active`, but only once it has stayed true for LOADER_DELAY_MS. */
export function useDelayedFlag(active: boolean, delay = LOADER_DELAY_MS): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [active, delay]);
  return active && shown;
}

interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

/** Zero state: what belongs here, why it is worth having, and the next step. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-description">{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

/** Card-shaped placeholders while the first page of a feed loads. */
export function FeedSkeleton({ count = 3, variant = 'card' }: { count?: number; variant?: 'card' | 'row' }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading memories">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skeleton-${variant}`}>
          <span className="skeleton-line skeleton-line--meta" />
          <span className="skeleton-line skeleton-line--title" />
          {variant === 'card' && <span className="skeleton-line skeleton-line--body" />}
        </div>
      ))}
    </div>
  );
}
