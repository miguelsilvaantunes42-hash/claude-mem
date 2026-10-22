import React from "react";
import { Summary } from "../types";
import { memoryAnchorId } from './MemoryUniverse';
import { formatDate } from "../utils/formatters";
import { DeleteButton } from "./DeleteButton";
import type { DeletableItemType } from "../utils/feed-deletion";

interface SummaryCardProps {
  summary: Summary;
  onDeleted: (itemType: DeletableItemType, id: number) => void;
}

export function SummaryCard({ summary, onDeleted }: SummaryCardProps) {
  const date = formatDate(summary.created_at_epoch);

  const sections = [
    { key: "investigated", label: "Investigated", content: summary.investigated, icon: "/icon-thick-investigated.svg" },
    { key: "learned", label: "Learned", content: summary.learned, icon: "/icon-thick-learned.svg" },
    { key: "completed", label: "Completed", content: summary.completed, icon: "/icon-thick-completed.svg" },
    { key: "next_steps", label: "Next steps", content: summary.next_steps, icon: "/icon-thick-next-steps.svg" },
    { key: "notes", label: "Notes", content: summary.notes, icon: "/icon-thick-notes.svg" },
  ].filter((section) => section.content);

  return (
    <article className="card summary-card" id={memoryAnchorId({ itemType: 'summary', id: summary.id })} tabIndex={-1}>
      <header className="summary-card-header">
        <div className="card-header">
          <div className="card-header-left">
            <span className="card-type summary-badge">Session summary</span>
            <span className={`card-source source-${summary.platform_source || 'claude'}`}>{summary.platform_source || 'claude'}</span>
            <span className="card-project">{summary.project}</span>
          </div>
          <div className="view-mode-toggles">
            <DeleteButton itemType="summary" id={summary.id} name={summary.request} onDeleted={onDeleted} />
          </div>
        </div>
        {summary.request && (
          <h3 className="summary-title">{summary.request}</h3>
        )}
      </header>

      <div className="summary-sections">
        {sections.map((section) => (
          <section key={section.key} className="summary-section">
            <div className="summary-section-header">
              <img
                src={section.icon}
                alt=""
                className={`summary-section-icon summary-section-icon--${section.key}`}
              />
              <h3 className="summary-section-label">{section.label}</h3>
            </div>
            <div className="summary-section-content">
              {section.content}
            </div>
          </section>
        ))}
      </div>

      <footer className="card-meta summary-card-footer">
        <span className="meta-id">Session #{summary.id}</span>
        <time className="meta-date" dateTime={new Date(summary.created_at_epoch).toISOString()}>
          {date}
        </time>
      </footer>
    </article>
  );
}
