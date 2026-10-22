import React, { useRef, useEffect } from 'react';
import { FeedItem } from '../types';
import type { DeletableItemType } from '../utils/feed-deletion';
import { ObservationCard } from './ObservationCard';
import { SummaryCard } from './SummaryCard';
import { PromptCard } from './PromptCard';
import { ScrollToTop } from './ScrollToTop';
import { ErrorNotice } from './ErrorNotice';
import { EmptyState, FeedSkeleton, useDelayedFlag } from './FeedStates';
import { MemoryUniverse } from './MemoryUniverse';
import { UI } from '../constants/ui';

interface FeedProps {
  /** Newest first; build with buildFeedItems. */
  items: FeedItem[];
  /** Rendered at the top of the scrolling column (page header, session header). */
  header?: React.ReactNode;
  onLoadMore: () => void;
  onDeleted: (itemType: DeletableItemType, id: number) => void;
  isLoading: boolean;
  hasMore: boolean;
  loadError?: string | null;
  /** The header's project filter, when one narrows this feed. */
  projectFilter?: string;
  onClearProjectFilter?: () => void;
  /** Replaces the default first-use empty state (e.g. a filtered session). */
  emptyState?: React.ReactNode;
  /** Memories drawn in the universe above the cards; omit to hide it. */
  universeItems?: FeedItem[];
}

export function Feed({
  items, header, onLoadMore, onDeleted, isLoading, hasMore, loadError,
  projectFilter, onClearProjectFilter, emptyState, universeItems,
}: FeedProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
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
        const first = entries[0];
        // A notification can arrive after React removed this sentinel but before
        // this effect's cleanup ran, e.g. once the first page of an empty feed
        // started loading and failed. hasMore/isLoading/loadError are stale then,
        // so only a sentinel that is still rendered may load.
        if (first.isIntersecting && first.target.isConnected && hasMore && !isLoading && !loadError) {
          onLoadMoreRef.current?.();
        }
      },
      { threshold: UI.LOAD_MORE_THRESHOLD }
    );

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
      observer.disconnect();
    };
  }, [hasMore, isLoading, loadError]);

  const isEmpty = items.length === 0;

  return (
    <div className="feed" ref={feedRef}>
      <ScrollToTop targetRef={feedRef} />
      <div className="feed-content">
        {header}
        {universeItems && <MemoryUniverse items={universeItems} isPartial={hasMore} />}
        {items.map(item => {
          const key = `${item.itemType}-${item.id}`;
          if (item.itemType === 'observation') {
            return <ObservationCard key={key} observation={item} onDeleted={onDeleted} />;
          } else if (item.itemType === 'summary') {
            return <SummaryCard key={key} summary={item} onDeleted={onDeleted} />;
          } else {
            return <PromptCard key={key} prompt={item} />;
          }
        })}
        {isEmpty && !isLoading && !loadError && (emptyState ?? (projectFilter ? (
          <EmptyState
            title={`Nothing captured for ${projectFilter} yet`}
            description="Memories appear here once a session in this project records an observation, summary, or prompt."
            action={onClearProjectFilter && (
              <button type="button" className="btn btn-primary" onClick={onClearProjectFilter}>Show all projects</button>
            )}
          />
        ) : (
          <EmptyState
            title="No memories yet"
            description="Start a Claude Code session in any project. Observations, summaries, and prompts stream in here as Claude works, and the next session starts with them."
            action={(
              <a className="btn btn-primary" href="https://docs.claude-mem.ai" target="_blank" rel="noopener noreferrer">
                Read the getting started guide
              </a>
            )}
          />
        )))}
        {isEmpty && showLoader && <FeedSkeleton />}
        {!isEmpty && showLoader && (
          <div className="feed-status" role="status">
            <span className="spinner" aria-hidden="true"></span>
            Loading more...
          </div>
        )}
        {loadError && !isLoading && (
          <ErrorNotice
            message={isEmpty
              ? 'Memories could not be loaded from the worker. Nothing was lost; retry once the worker is running.'
              : 'Older memories could not be loaded. The ones above are unaffected; retry to continue.'}
            detail={loadError}
            onRetry={onLoadMore}
          />
        )}
        {hasMore && !isLoading && !loadError && (
          <div ref={loadMoreRef} className="feed-sentinel" />
        )}
        {!hasMore && !isEmpty && (
          <p className="feed-end">You have reached the oldest memory.</p>
        )}
      </div>
    </div>
  );
}
