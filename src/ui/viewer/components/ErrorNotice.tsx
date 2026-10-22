import React, { useState } from 'react';

interface ErrorNoticeProps {
  /** What happened and what it means for the user's data, in plain words. */
  message: string;
  /** Raw technical detail (HTTP status, exception text); copied, never shown. */
  detail?: string | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * Inline failure state: a plain-language message, a recovery action, and the
 * technical detail one click away for a bug report instead of in the UI.
 */
export function ErrorNotice({ message, detail, onRetry, className = '' }: ErrorNoticeProps) {
  const [copied, setCopied] = useState(false);

  const copyDetail = async () => {
    try {
      await navigator.clipboard.writeText(detail ?? message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`error-notice ${className}`.trim()} role="alert">
      <p className="error-notice-message">{message}</p>
      <div className="error-notice-actions">
        {onRetry && (
          <button type="button" className="btn btn-secondary" onClick={onRetry}>Retry</button>
        )}
        {detail && (
          <button type="button" className="btn btn-quiet" onClick={copyDetail}>
            {copied ? 'Copied error details' : 'Copy error details'}
          </button>
        )}
      </div>
    </div>
  );
}
