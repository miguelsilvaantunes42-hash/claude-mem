import React, { useState } from 'react';
import { Observation } from '../types';
import { memoryAnchorId } from './MemoryUniverse';
import { formatDate } from '../utils/formatters';
import { DeleteButton } from './DeleteButton';
import type { DeletableItemType } from '../utils/feed-deletion';
import { parseStoredStringList } from '../utils/stored-string-list';
import { labelForCategory } from '../utils/category';

interface ObservationCardProps {
  observation: Observation;
  onDeleted: (itemType: DeletableItemType, id: number) => void;
}

function stripProjectRoot(filePath: string): string {
  const markers = ['/Scripts/', '/src/', '/plugin/', '/docs/'];

  for (const marker of markers) {
    const index = filePath.indexOf(marker);
    if (index !== -1) {
      return filePath.substring(index + 1);
    }
  }

  const projectIndex = filePath.indexOf('claude-mem/');
  if (projectIndex !== -1) {
    return filePath.substring(projectIndex + 'claude-mem/'.length);
  }

  const parts = filePath.split('/');
  return parts.length > 3 ? parts.slice(-3).join('/') : filePath;
}

export function ObservationCard({ observation, onDeleted }: ObservationCardProps) {
  const [showFacts, setShowFacts] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const date = formatDate(observation.created_at_epoch);

  const facts = parseStoredStringList(observation.facts);
  const concepts = parseStoredStringList(observation.concepts);
  const filesRead = parseStoredStringList(observation.files_read).map(stripProjectRoot);
  const filesModified = parseStoredStringList(observation.files_modified).map(stripProjectRoot);

  const hasFactsContent = facts.length > 0 || concepts.length > 0 || filesRead.length > 0 || filesModified.length > 0;

  const source = observation.platform_source || 'claude';

  return (
    <article className="card observation-card" id={memoryAnchorId({ itemType: 'observation', id: observation.id })} tabIndex={-1}>
      <div className="card-header">
        <div className="card-header-left">
          <span className={`card-type type-${observation.type}`}>{labelForCategory(observation.type)}</span>
          <span className={`card-source source-${source}`}>{source}</span>
          <span className="card-project">{observation.project}</span>
          {observation.merged_into_project && (
            <span className="card-merged-badge">Merged into {observation.merged_into_project}</span>
          )}
        </div>
        <div className="view-mode-toggles">
          {hasFactsContent && (
            <button
              type="button"
              className={`view-mode-toggle ${showFacts ? 'active' : ''}`}
              aria-pressed={showFacts}
              onClick={() => {
                setShowFacts(!showFacts);
                if (!showFacts) setShowNarrative(false);
              }}
            >
              <span>Facts</span>
            </button>
          )}
          {observation.narrative && (
            <button
              type="button"
              className={`view-mode-toggle ${showNarrative ? 'active' : ''}`}
              aria-pressed={showNarrative}
              onClick={() => {
                setShowNarrative(!showNarrative);
                if (!showNarrative) setShowFacts(false);
              }}
            >
              <span>Narrative</span>
            </button>
          )}
          <DeleteButton itemType="observation" id={observation.id} name={observation.title} onDeleted={onDeleted} />
        </div>
      </div>

      <h3 className="card-title">{observation.title || 'Untitled observation'}</h3>

      <div className="view-mode-content">
        {!showFacts && !showNarrative && observation.subtitle && (
          <p className="card-subtitle">{observation.subtitle}</p>
        )}
        {showFacts && facts.length > 0 && (
          <ul className="facts-list">
            {facts.map((fact: string, i: number) => (
              <li key={i}>{fact}</li>
            ))}
          </ul>
        )}
        {showNarrative && observation.narrative && (
          <div className="narrative">
            {observation.narrative}
          </div>
        )}
      </div>

      <div className="card-meta">
        <span className="meta-id">#{observation.id}</span>
        <time className="meta-date" dateTime={new Date(observation.created_at_epoch).toISOString()}>{date}</time>
        {showFacts && (concepts.length > 0 || filesRead.length > 0 || filesModified.length > 0) && (
          <dl className="meta-details">
            {concepts.length > 0 && (
              <div className="meta-files">
                <dt className="file-label">Concepts</dt>
                <dd>{concepts.join(', ')}</dd>
              </div>
            )}
            {filesRead.length > 0 && (
              <div className="meta-files">
                <dt className="file-label">Read</dt>
                <dd className="meta-paths">{filesRead.join(', ')}</dd>
              </div>
            )}
            {filesModified.length > 0 && (
              <div className="meta-files">
                <dt className="file-label">Modified</dt>
                <dd className="meta-paths">{filesModified.join(', ')}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </article>
  );
}
