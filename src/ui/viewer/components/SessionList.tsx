import React, { useEffect, useRef } from 'react';
import { SessionCatalogEntry } from '../types';
import { SessionCard } from './SessionCard';
import { ErrorNotice } from './ErrorNotice';
import { EmptyState, FeedSkeleton, useDelayedFlag } from './FeedStates';
import { catalogEntryRef, sessionKey, type SessionRef } from '../utils/sessions';
import { UI } from '../constants/ui';

interface SessionListProps {
  header: React.ReactNode;
  sessions: SessionCatalogEntry[];
  isLoading: boolean;
  hasMore: boolean;
  loadError: string | null;
  onOpen: (session: SessionRef) => void;
  onDelete: (session: SessionRef) => Promise<void>;
  /** Loads the next (older) page of sessions; the list asks when its end scrolls into view. */
  onLoadMore: () => void;
  /** The header's project filter, when one narrows this list. */
  projectFilter?: string;
  onClearProjectFilter?: () => void;
}

export function SessionList({
  header, sessions, isLoading, hasMore, loadError, onOpen, onDelete, onLoadMore,
  projectFilter, onClearProjectFilter,
}: SessionListProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const showLoader = useDelayedFlag(isLoading);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && entries[0].target.isConnected && hasMore && !isLoading && !loadError) {
          onLoadMoreRef.current?.();
        }
      },
      { threshold: UI.LOAD_MORE_THRESHOLD }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, isLoading, loadError]);

  return (
    <div className="session-list">
      <div className="session-list-content">
        {header}
        {loadError && (
          <ErrorNotice
            message={sessions.length
              ? 'Older sessions could not be loaded. The ones listed are unaffected; retry to continue.'
              : 'Sessions could not be loaded from the worker. Nothing was lost; retry once the worker is running.'}
            detail={loadError}
            onRetry={isLoading ? undefined : onLoadMore}
          />
        )}
        {sessions.length > 0 && (
          <div className="session-rows">
            {sessions.map(session => {
              const ref = catalogEntryRef(session);
              return (
                <SessionCard
                  key={sessionKey(ref)}
                  session={session}
                  onOpen={() => onOpen(ref)}
                  onDelete={() => onDelete(ref)}
                />
              );
            })}
          </div>
        )}
        {sessions.length === 0 && !loadError && showLoader && <FeedSkeleton variant="row" />}
        {sessions.length === 0 && !loadError && !isLoading && (projectFilter ? (
          <EmptyState
            title={`No sessions in ${projectFilter} yet`}
            description="A session appears here once claude-mem records its first memory in this project."
            action={onClearProjectFilter && (
              <button type="button" className="btn btn-primary" onClick={onClearProjectFilter}>Show all projects</button>
            )}
          />
        ) : (
          <EmptyState
            title="No sessions yet"
            description="Each Claude Code session you run is listed here with everything claude-mem captured in it, so you can revisit or delete it."
            action={(
              <a className="btn btn-primary" href="https://docs.claude-mem.ai" target="_blank" rel="noopener noreferrer">
                Read the getting started guide
              </a>
            )}
          />
        ))}
        {showLoader && sessions.length > 0 && (
          <div className="feed-status" role="status">
            <span className="spinner" aria-hidden="true"></span>
            Loading older sessions…
          </div>
        )}
        {hasMore && !isLoading && !loadError && sessions.length > 0 && (
          <div ref={loadMoreRef} className="feed-sentinel" />
        )}
      </div>
    </div>
  );
}
