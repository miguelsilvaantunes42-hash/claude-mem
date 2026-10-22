import React from 'react';
import { CATEGORY_ORDER, labelForCategory } from '../utils/category';

interface CategoryFilterProps {
  categoryCounts: Record<string, number>;
  activeCategories: Set<string>;
  onToggle: (category: string) => void;
  onClear: () => void;
  filteredCount: number;
  totalCount: number;
  totalIsPartial: boolean;
}

export function CategoryFilter({
  categoryCounts,
  activeCategories,
  onToggle,
  onClear,
  filteredCount,
  totalCount,
  totalIsPartial,
}: CategoryFilterProps) {
  const presentCategories = CATEGORY_ORDER.filter(category => (categoryCounts[category] ?? 0) > 0);

  if (presentCategories.length === 0) {
    return null;
  }

  return (
    <div className="category-filter-bar">
      <div className="filter-chips" role="group" aria-label="Filter by category">
        {presentCategories.map(category => (
          <button
            key={category}
            type="button"
            className={`filter-chip ${activeCategories.has(category) ? 'active' : ''}`}
            aria-pressed={activeCategories.has(category)}
            onClick={() => onToggle(category)}
          >
            {labelForCategory(category)}
            <span className="filter-chip-count">{categoryCounts[category]}</span>
          </button>
        ))}
        {activeCategories.size > 0 && (
          <button type="button" className="btn btn-quiet filter-clear" onClick={onClear}>Clear all filters</button>
        )}
      </div>
      <span className="category-filter-count">
        Showing {filteredCount} of {totalCount}{totalIsPartial ? '+' : ''}
      </span>
    </div>
  );
}
