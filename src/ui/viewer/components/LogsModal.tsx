import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { confirmDestructive } from './ConfirmDialog';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
type LogComponent = 'HOOK' | 'WORKER' | 'SDK' | 'PARSER' | 'DB' | 'SYSTEM' | 'HTTP' | 'SESSION' | 'CHROMA' | 'OTHER';

interface ParsedLogLine {
  raw: string;
  timestamp?: string;
  level?: LogLevel;
  component?: LogComponent;
  correlationId?: string;
  message?: string;
  isSpecial?: 'dataIn' | 'dataOut' | 'success' | 'failure' | 'timing' | 'happyPath';
}

const LOG_LEVELS: { key: LogLevel; label: string; color: string }[] = [
  { key: 'DEBUG', label: 'Debug', color: '#8b8b8b' },
  { key: 'INFO', label: 'Info', color: '#58a6ff' },
  { key: 'WARN', label: 'Warn', color: '#d29922' },
  { key: 'ERROR', label: 'Error', color: '#f85149' },
];

const LOG_COMPONENTS: { key: LogComponent; label: string; color: string }[] = [
  { key: 'HOOK', label: 'Hook', color: '#a371f7' },
  { key: 'WORKER', label: 'Worker', color: '#58a6ff' },
  { key: 'SDK', label: 'SDK', color: '#3fb950' },
  { key: 'PARSER', label: 'Parser', color: '#79c0ff' },
  { key: 'DB', label: 'DB', color: '#f0883e' },
  { key: 'SYSTEM', label: 'System', color: '#8b949e' },
  { key: 'HTTP', label: 'HTTP', color: '#39d353' },
  { key: 'SESSION', label: 'Session', color: '#db61a2' },
  { key: 'CHROMA', label: 'Chroma', color: '#a855f7' },
  { key: 'OTHER', label: 'Other', color: '#8b949e' },
];

// The logger has more components than there are chips; the rest are filtered by the Other chip.
const LISTED_COMPONENT_KEYS = new Set<string>(LOG_COMPONENTS.map(component => component.key));

function parseLogLine(line: string): ParsedLogLine {
  const pattern = /^\[([^\]]+)\]\s+\[(\w+)\s*\]\s+\[(\w+)\s*\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/;
  const match = line.match(pattern);

  if (!match) {
    return { raw: line };
  }

  const [, timestamp, level, component, correlationId, message] = match;

  let isSpecial: ParsedLogLine['isSpecial'] = undefined;
  if (message.startsWith('→')) isSpecial = 'dataIn';
  else if (message.startsWith('←')) isSpecial = 'dataOut';
  else if (message.startsWith('✓')) isSpecial = 'success';
  else if (message.startsWith('✗')) isSpecial = 'failure';
  else if (message.startsWith('⏱')) isSpecial = 'timing';
  else if (message.includes('[HAPPY-PATH]')) isSpecial = 'happyPath';

  return {
    raw: line,
    timestamp,
    level: level?.trim() as LogLevel,
    component: component?.trim() as LogComponent,
    correlationId: correlationId || undefined,
    message,
    isSpecial,
  };
}

interface LogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogsDrawer({ isOpen, onClose }: LogsDrawerProps) {
  const [logs, setLogs] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [height, setHeight] = useState(350);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  const requestSeqRef = useRef(0);
  const clearingRef = useRef(false);

  const [activeLevels, setActiveLevels] = useState<Set<LogLevel>>(
    new Set(['DEBUG', 'INFO', 'WARN', 'ERROR'])
  );
  const [activeComponents, setActiveComponents] = useState<Set<LogComponent>>(
    new Set(LOG_COMPONENTS.map(component => component.key))
  );
  const [alignmentOnly, setAlignmentOnly] = useState(false);

  const parsedLines = useMemo(() => {
    if (!logs) return [];
    let record: ParsedLogLine | undefined;
    return logs.split('\n').map(raw => {
      const line = parseLogLine(raw);
      if (line.timestamp) record = line;
      else if (record) {
        line.level = record.level;
        line.component = record.component;
      }
      return line;
    });
  }, [logs]);

  const filteredLines = useMemo(() => {
    return parsedLines.filter(line => {
      if (alignmentOnly) {
        return line.raw.includes('[ALIGNMENT]');
      }
      if (!line.level || !line.component) {
        return activeLevels.size === LOG_LEVELS.length
          && activeComponents.size === LOG_COMPONENTS.length;
      }
      const componentChipKey = LISTED_COMPONENT_KEYS.has(line.component) ? line.component : 'OTHER';
      return activeLevels.has(line.level) && activeComponents.has(componentChipKey);
    });
  }, [parsedLines, activeLevels, activeComponents, alignmentOnly]);

  const checkIfAtBottom = useCallback(() => {
    if (!contentRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    return scrollHeight - scrollTop - clientHeight < 50;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (contentRef.current && wasAtBottomRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    if (clearingRef.current) return;
    const request = ++requestSeqRef.current;
    wasAtBottomRef.current = checkIfAtBottom();

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/logs');
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.statusText}`);
      }
      const data = await response.json();
      if (request === requestSeqRef.current) setLogs(data.logs || '');
    } catch (err) {
      if (request === requestSeqRef.current) setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (request === requestSeqRef.current) setIsLoading(false);
    }
  }, [checkIfAtBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const handleClearLogs = useCallback(async () => {
    const confirmed = await confirmDestructive({
      title: 'Clear all worker logs?',
      body: 'The worker log file is emptied for every viewer. Logs written after this keep appearing here. This cannot be undone.',
      confirmLabel: 'Clear logs',
    });
    if (!confirmed) {
      return;
    }
    const request = ++requestSeqRef.current;
    clearingRef.current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/logs/clear', { method: 'POST', signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to clear logs: ${response.statusText}`);
      }
      if (request === requestSeqRef.current) setLogs('');
    } catch (err) {
      if (controller.signal.aborted) {
        // Abort only says that the acknowledgment was lost: the worker may
        // already have cleared the file. Reconcile even with auto-refresh off,
        // keeping this operation's request ownership and a bounded read.
        const reconciliation = new AbortController();
        const reconciliationTimeout = setTimeout(() => reconciliation.abort(), 5000);
        try {
          const response = await fetch('/api/logs', { signal: reconciliation.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (request === requestSeqRef.current) {
            setLogs(data.logs || '');
            setError('Clear request timed out; its outcome is unknown. Displaying current logs.');
          }
        } catch {
          if (request === requestSeqRef.current) {
            setError('Clear request timed out; its outcome is unknown and current logs could not be refreshed. Try Refresh.');
          }
        } finally {
          clearTimeout(reconciliationTimeout);
        }
      } else if (request === requestSeqRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      clearTimeout(timeout);
      clearingRef.current = false;
      if (request === requestSeqRef.current) setIsLoading(false);
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height;
  }, [height]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const newHeight = Math.min(Math.max(150, startHeightRef.current + deltaY), window.innerHeight - 100);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (isOpen) {
      wasAtBottomRef.current = true; 
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  useEffect(() => {
    if (!isOpen || !autoRefresh) {
      return;
    }

    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, fetchLogs]);

  const toggleLevel = useCallback((level: LogLevel) => {
    setActiveLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  const toggleComponent = useCallback((component: LogComponent) => {
    setActiveComponents(prev => {
      const next = new Set(prev);
      if (next.has(component)) {
        next.delete(component);
      } else {
        next.add(component);
      }
      return next;
    });
  }, []);

  const setAllLevels = useCallback((enabled: boolean) => {
    if (enabled) {
      setActiveLevels(new Set(['DEBUG', 'INFO', 'WARN', 'ERROR']));
    } else {
      setActiveLevels(new Set());
    }
  }, []);

  const setAllComponents = useCallback((enabled: boolean) => {
    if (enabled) {
      setActiveComponents(new Set(LOG_COMPONENTS.map(component => component.key)));
    } else {
      setActiveComponents(new Set());
    }
  }, []);

  if (!isOpen) {
    return null;
  }

  const getLineStyle = (line: ParsedLogLine): React.CSSProperties => {
    const levelConfig = LOG_LEVELS.find(l => l.key === line.level);
    const componentConfig = LOG_COMPONENTS.find(c => c.key === line.component);

    let color = 'var(--color-text-primary)';
    let fontWeight = 'normal';
    let backgroundColor = 'transparent';

    if (line.level === 'ERROR') {
      color = '#f85149';
      backgroundColor = 'rgba(248, 81, 73, 0.1)';
    } else if (line.level === 'WARN') {
      color = '#d29922';
      backgroundColor = 'rgba(210, 153, 34, 0.05)';
    } else if (line.isSpecial === 'success') {
      color = '#3fb950';
    } else if (line.isSpecial === 'failure') {
      color = '#f85149';
    } else if (line.isSpecial === 'happyPath') {
      color = '#d29922';
    } else if (levelConfig) {
      color = levelConfig.color;
    }

    return { color, fontWeight, backgroundColor, padding: '1px 0', borderRadius: '2px' };
  };

  const renderLogLine = (line: ParsedLogLine, index: number) => {
    if (!line.timestamp) {
      return (
        <div key={index} className="log-line log-line-raw">
          {line.raw}
        </div>
      );
    }

    const levelConfig = LOG_LEVELS.find(l => l.key === line.level);
    const componentConfig = LOG_COMPONENTS.find(c => c.key === line.component);

    return (
      <div key={index} className="log-line" style={getLineStyle(line)}>
        <span className="log-timestamp">[{line.timestamp}]</span>
        {' '}
        <span className="log-level" style={{ color: levelConfig?.color }} title={line.level}>
          [{line.level?.padEnd(5)}]
        </span>
        {' '}
        <span className="log-component" style={{ color: componentConfig?.color }} title={line.component}>
          [{line.component?.padEnd(7)}]
        </span>
        {' '}
        {line.correlationId && (
          <>
            <span className="log-correlation">[{line.correlationId}]</span>
            {' '}
          </>
        )}
        <span className="log-message">{line.message}</span>
      </div>
    );
  };

  return (
    <section
      className="console-drawer"
      style={{ height: `${height}px` }}
      aria-label="Worker console"
      onKeyDown={e => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        className="console-resize-handle"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize console"
        aria-valuenow={height}
        tabIndex={0}
        onKeyDown={e => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const step = e.key === 'ArrowUp' ? 32 : -32;
          setHeight(current => Math.min(Math.max(150, current + step), window.innerHeight - 100));
        }}
      >
        <div className="console-resize-bar" />
      </div>

      <div className="console-header">
        <h2 className="console-title">Console</h2>
        <div className="console-controls">
          <label className="console-auto-refresh">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button
            type="button"
            className="icon-btn icon-btn--small console-control-btn"
            onClick={fetchLogs}
            disabled={isLoading}
            aria-label="Refresh logs"
            data-tooltip="Refresh logs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--small console-control-btn"
            onClick={() => {
              wasAtBottomRef.current = true;
              scrollToBottom();
            }}
            aria-label="Scroll to newest log"
            data-tooltip="Scroll to newest log"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--small console-control-btn console-clear-btn"
            onClick={handleClearLogs}
            disabled={isLoading}
            aria-label="Clear logs"
            data-tooltip="Clear logs"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--small console-control-btn"
            onClick={onClose}
            aria-label="Close console"
            data-tooltip="Close console"
            data-tooltip-align="end"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="console-filters">
        <div className="console-filter-section">
          <span className="console-filter-label">Quick:</span>
          <div className="console-filter-chips">
            <button
              className={`console-filter-chip ${alignmentOnly ? 'active' : ''}`}
              onClick={() => setAlignmentOnly(!alignmentOnly)}
              style={{
                '--chip-color': '#f0883e',
              } as React.CSSProperties}
              title="Show only session alignment logs"
            >
              Alignment
            </button>
          </div>
        </div>
        <div className="console-filter-section">
          <span className="console-filter-label">Levels:</span>
          <div className="console-filter-chips">
            {LOG_LEVELS.map(level => (
              <button
                key={level.key}
                className={`console-filter-chip ${activeLevels.has(level.key) ? 'active' : ''}`}
                onClick={() => toggleLevel(level.key)}
                style={{
                  '--chip-color': level.color,
                } as React.CSSProperties}
                title={level.label}
              >
                {level.label}
              </button>
            ))}
            <button
              className="console-filter-action"
              onClick={() => setAllLevels(activeLevels.size !== LOG_LEVELS.length)}
            >
              {activeLevels.size === LOG_LEVELS.length ? 'Select none' : 'Select all'}
            </button>
          </div>
        </div>
        <div className="console-filter-section">
          <span className="console-filter-label">Components:</span>
          <div className="console-filter-chips">
            {LOG_COMPONENTS.map(comp => (
              <button
                key={comp.key}
                className={`console-filter-chip ${activeComponents.has(comp.key) ? 'active' : ''}`}
                onClick={() => toggleComponent(comp.key)}
                style={{
                  '--chip-color': comp.color,
                } as React.CSSProperties}
                title={comp.label}
              >
                {comp.label}
              </button>
            ))}
            <button
              className="console-filter-action"
              onClick={() => setAllComponents(activeComponents.size !== LOG_COMPONENTS.length)}
            >
              {activeComponents.size === LOG_COMPONENTS.length ? 'Select none' : 'Select all'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="console-error" role="alert">
          {error}
        </div>
      )}

      <div className="console-content" ref={contentRef}>
        <div className="console-logs">
          {filteredLines.length === 0 ? (
            <div className="log-line log-line-empty">No logs available</div>
          ) : (
            filteredLines.map((line, index) => renderLogLine(line, index))
          )}
        </div>
      </div>
    </section>
  );
}
