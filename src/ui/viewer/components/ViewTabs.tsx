import React from 'react';

export type ViewTab = 'timeline' | 'sessions';

interface ViewTabsProps {
  active: ViewTab;
  onSelect: (tab: ViewTab) => void;
}

const TABS: { id: ViewTab; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'sessions', label: 'Sessions' },
];

/** Switch between the chronological timeline and the per-session view. */
export function ViewTabs({ active, onSelect }: ViewTabsProps) {
  return (
    <nav className="view-tabs" aria-label="Memory views">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`view-tab${active === tab.id ? ' active' : ''}`}
          aria-current={active === tab.id ? 'page' : undefined}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

interface PageHeaderProps {
  tabs: React.ReactNode;
  description: string;
}

/** Heading, one sentence on what the view holds, then the section tabs. */
export function PageHeader({ tabs, description }: PageHeaderProps) {
  return (
    <div className="page-header">
      <h2 className="page-title">Memory universe</h2>
      <p className="page-description">{description}</p>
      {tabs}
    </div>
  );
}
