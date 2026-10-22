import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Feed } from './Feed';
import { CategoryFilter } from './CategoryFilter';
import { EmptyState } from './FeedStates';
import { FeedItem } from '../types';
import type { DeletableItemType } from '../utils/feed-deletion';
import { categoryOf, countByCategory } from '../utils/category';
import { sessionKey, type SessionRef } from '../utils/sessions';

interface SessionDetailPageProps {
  /** View tabs, rendered at the top of the scrolling column. */
  tabs: React.ReactNode;
  session: SessionRef;
  /** The session's custom title when the catalog knows it. */
  title: string | null;
  /** This session's rows, newest first (App owns loading and deletes). */
  items: FeedItem[];
  isLoading: boolean;
  hasMore: boolean;
  loadError?: string | null;
  onLoadMore: () => void;
  onDeleted: (itemType: DeletableItemType, id: number) => void;
  onBack: () => void;
}

export function SessionDetailPage({
  tabs, session, title, items, isLoading, hasMore, loadError, onLoadMore, onDeleted, onBack,
}: SessionDetailPageProps) {
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const currentSessionKey = sessionKey(session);

  useEffect(() => {
    setActiveCategories(new Set());
  }, [currentSessionKey]);

  const categoryCounts = useMemo(() => countByCategory(items), [items]);

  const filteredItems = useMemo(() => {
    if (activeCategories.size === 0) return items;
    return items.filter(item => activeCategories.has(categoryOf(item)));
  }, [items, activeCategories]);

  const toggleCategory = useCallback((category: string) => {
    setActiveCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const clearCategories = useCallback(() => setActiveCategories(new Set()), []);
  const heading = title ?? 'Session details';

  const header = (
    <>
      {tabs}
      <div className="session-detail-header">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <a
            className="breadcrumb-link session-detail-back"
            href="#/sessions"
            onClick={e => {
              e.preventDefault();
              onBack();
            }}
          >
            Sessions
          </a>
          <span className="breadcrumb-sep" aria-hidden="true">/</span>
          <span className="breadcrumb-current" aria-current="page">{heading}</span>
        </nav>
        <div className="session-detail-title-group">
          <h2 className="session-detail-title">{heading}</h2>
          <p className="session-detail-meta">
            <span className="session-detail-platform">{session.platformSource}</span>
            <span className="session-detail-id" title={session.contentSessionId}>{session.contentSessionId}</span>
          </p>
        </div>
      </div>
      <CategoryFilter
        categoryCounts={categoryCounts}
        activeCategories={activeCategories}
        onToggle={toggleCategory}
        onClear={clearCategories}
        filteredCount={filteredItems.length}
        totalCount={items.length}
        totalIsPartial={hasMore}
      />
    </>
  );

  const emptyState = activeCategories.size > 0 && items.length > 0 ? (
    <EmptyState
      title="No memories match these filters"
      description="Loaded memories in this session belong to other categories. Clear the filters to see all of them."
      action={<button type="button" className="btn btn-primary" onClick={clearCategories}>Clear all filters</button>}
    />
  ) : (
    <EmptyState
      title="No memories in this session"
      description="Nothing from this session is stored. Memories captured while it runs appear here as they arrive."
      action={<button type="button" className="btn btn-secondary" onClick={onBack}>View all sessions</button>}
    />
  );

  return (
    <Feed
      header={header}
      items={filteredItems}
      onLoadMore={onLoadMore}
      onDeleted={onDeleted}
      isLoading={isLoading}
      hasMore={hasMore}
      loadError={loadError}
      emptyState={emptyState}
      universeItems={items}
    />
  );
}
