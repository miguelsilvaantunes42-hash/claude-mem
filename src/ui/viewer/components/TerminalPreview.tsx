import React, { useMemo, useRef, useLayoutEffect, useState } from 'react';
import AnsiToHtml from 'ansi-to-html';
import DOMPurify from 'dompurify';

interface TerminalPreviewProps {
  content: string;
  isLoading?: boolean;
  className?: string;
}

const ansiConverter = new AnsiToHtml({
  fg: '#dcd6cc',
  bg: '#252320',
  newline: false,
  escapeXML: true,
  stream: false
});

export function TerminalPreview({ content, isLoading = false, className = '' }: TerminalPreviewProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const scrollTopRef = useRef(0);
  const [wordWrap, setWordWrap] = useState(true);

  const html = useMemo(() => {
    if (preRef.current) {
      scrollTopRef.current = preRef.current.scrollTop;
    }
    if (!content) return '';
    const convertedHtml = ansiConverter.toHtml(content);
    return DOMPurify.sanitize(convertedHtml, {
      ALLOWED_TAGS: ['span', 'div', 'br'],
      ALLOWED_ATTR: ['style', 'class'],
      ALLOW_DATA_ATTR: false
    });
  }, [content]);

  useLayoutEffect(() => {
    if (preRef.current && scrollTopRef.current > 0) {
      preRef.current.scrollTop = scrollTopRef.current;
    }
  }, [html]);

  return (
    <div className={`terminal-preview ${className}`.trim()}>
      <div className="terminal-preview-header">
        <span className="terminal-preview-title">What the next session starts with</span>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          aria-pressed={wordWrap}
          onClick={() => setWordWrap(!wordWrap)}
        >
          Wrap lines
        </button>
      </div>

      {isLoading ? (
        <p className="terminal-preview-status" role="status">Loading preview...</p>
      ) : (
        <div className="terminal-preview-body">
          <pre
            ref={preRef}
            className={`terminal-preview-pre${wordWrap ? ' terminal-preview-pre--wrap' : ''}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      )}
    </div>
  );
}
