import React, { useEffect, useId, useRef, useState } from 'react';
import { ThemeToggle, nextThemeLabel, themeLabel } from './ThemeToggle';
import { ThemePreference, nextThemePreference } from '../hooks/useTheme';
import { GitHubStarsButton } from './GitHubStarsButton';
import { useSpinningFavicon } from '../hooks/useSpinningFavicon';
import { PRO_TRIAL_PITCH, PRO_TRIAL_SHORT, PRO_TRIAL_URL, TEAMBRAIN_PITCH, TEAMBRAIN_START_URL } from '../constants/promo';

interface HeaderProps {
  projects: string[];
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  isProcessing: boolean;
  queueDepth: number;
  themePreference: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  /** Opens the Settings page. */
  onContextPreviewToggle: () => void;
  onShowHelp?: () => void;
  /** Show the TeamBrain link: settings have loaded and this install is in no team. */
  showTeamBrainLink?: boolean;
}

const DOCS_URL = 'https://docs.claude-mem.ai';
const X_URL = 'https://x.com/Claude_Memory';
const DISCORD_URL = 'https://discord.gg/J4wttp9vDu';

function DocsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="settings-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  );
}

function ProjectFilter({ projects, currentFilter, onFilterChange }: Pick<HeaderProps, 'projects' | 'currentFilter' | 'onFilterChange'>) {
  const id = useId();
  return (
    <div className="project-filter">
      <label htmlFor={id} className="project-filter-label">Project</label>
      <select id={id} className="project-filter-select" value={currentFilter} onChange={e => onFilterChange(e.target.value)}>
        <option value="">All projects</option>
        {projects.map(project => (
          <option key={project} value={project}>{project}</option>
        ))}
      </select>
    </div>
  );
}

/**
 * Overflow menu. On medium and wide it holds the community links; on narrow
 * it also carries every control the header bar hides (project, theme, help,
 * settings, TeamBrain), so nothing is out of reach on a phone.
 */
function HeaderMenu(props: HeaderProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const closeThen = (action?: () => void) => () => {
    setOpen(false);
    action?.();
  };

  return (
    <div className="header-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="icon-btn"
        aria-label="Open menu"
        data-tooltip="Open menu"
        data-tooltip-align="end"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(prev => !prev)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.75"></circle>
          <circle cx="12" cy="12" r="1.75"></circle>
          <circle cx="19" cy="12" r="1.75"></circle>
        </svg>
      </button>
      {open && (
        <div className="header-menu-panel" id={panelId}>
          <div className="header-menu-group only-narrow">
            <ProjectFilter projects={props.projects} currentFilter={props.currentFilter} onFilterChange={props.onFilterChange} />
            <button type="button" className="menu-item" onClick={closeThen(props.onContextPreviewToggle)}>
              <SettingsIcon /> Open settings
            </button>
            <button type="button" className="menu-item" onClick={() => props.onThemeChange(nextThemePreference(props.themePreference))}>
              <span className="menu-item-text">Switch to {nextThemeLabel(props.themePreference).toLowerCase()} theme</span>
              <span className="menu-item-meta">{themeLabel(props.themePreference)}</span>
            </button>
            <button type="button" className="menu-item" onClick={closeThen(props.onShowHelp)}>
              <HelpIcon /> Show welcome guide
            </button>
            {props.showTeamBrainLink && (
              <a className="menu-item" href={TEAMBRAIN_START_URL} target="_blank" rel="noopener noreferrer" onClick={closeThen()}>
                <span className="menu-item-text">Start a TeamBrain</span>
              </a>
            )}
          </div>
          <div className="header-menu-group">
            <a className="menu-item" href={DOCS_URL} target="_blank" rel="noopener noreferrer" onClick={closeThen()}>
              <DocsIcon /> Read the documentation
            </a>
            <GitHubStarsButton username="thedotmack" repo="claude-mem" className="menu-item" onClick={closeThen()} />
            <a className="menu-item" href={DISCORD_URL} target="_blank" rel="noopener noreferrer" onClick={closeThen()}>
              <DiscordIcon /> Join the Discord community
            </a>
            <a className="menu-item" href={X_URL} target="_blank" rel="noopener noreferrer" onClick={closeThen()}>
              <XIcon /> Follow claude-mem on X
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export function Header(props: HeaderProps) {
  const {
    projects,
    currentFilter,
    onFilterChange,
    isProcessing,
    queueDepth,
    themePreference,
    onThemeChange,
    onContextPreviewToggle,
    onShowHelp,
    showTeamBrainLink = false,
  } = props;
  useSpinningFavicon(isProcessing);

  const activity = isProcessing
    ? queueDepth > 0 ? `Processing, ${queueDepth} queued` : 'Processing'
    : queueDepth > 0 ? `${queueDepth} queued` : '';

  return (
    <header className="header">
      <div className="header-main">
        <h1 className="header-brand">
          <span className="logomark-wrap">
            <img src="claude-mem-logomark.webp" alt="" className={`logomark ${isProcessing ? 'spinning' : ''}`} />
            {queueDepth > 0 && (
              <span className="queue-bubble" aria-hidden="true">
                {queueDepth}
              </span>
            )}
          </span>
          <span className="logo-text">claude-mem</span>
        </h1>
        <span className="visually-hidden" role="status" aria-live="polite">{activity}</span>
        <a href="/" className="local-work-link" data-tooltip="Open your local work and review queue">My Work</a>
        {/* Most people running the free plugin never learn the trial exists,
            so it stays in the bar at every width; the long pitch truncates
            before the controls on the right ever have to wrap. */}
        <a
          className="pro-trial-cta"
          href={PRO_TRIAL_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={PRO_TRIAL_PITCH}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
          </svg>
          <span className="pro-trial-cta-full">{PRO_TRIAL_PITCH}</span>
          <span className="pro-trial-cta-short">{PRO_TRIAL_SHORT}</span>
        </a>
        {showTeamBrainLink && (
          <a
            className="teambrain-cta"
            href={TEAMBRAIN_START_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={TEAMBRAIN_PITCH}
            data-tooltip={TEAMBRAIN_PITCH}
          >
            TeamBrain
          </a>
        )}
      </div>
      <div className="status">
        <div className="only-medium-up status-controls">
          <ProjectFilter projects={projects} currentFilter={currentFilter} onFilterChange={onFilterChange} />
          <ThemeToggle preference={themePreference} onThemeChange={onThemeChange} />
          <button
            type="button"
            className="icon-btn"
            onClick={() => onShowHelp?.()}
            aria-label="Show welcome guide"
            data-tooltip="Show welcome guide"
          >
            <HelpIcon />
          </button>
          <button
            type="button"
            className="icon-btn settings-btn"
            onClick={onContextPreviewToggle}
            aria-label="Open settings"
            data-tooltip="Open settings"
          >
            <SettingsIcon />
          </button>
        </div>
        <HeaderMenu {...props} />
      </div>
    </header>
  );
}
