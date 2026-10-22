import React, { useEffect, useRef } from 'react';

interface SessionCardMenuProps {
  onClose: () => void;
  onOpen: () => void;
  onDelete: () => void;
}

export function SessionCardMenu({ onClose, onOpen, onDelete }: SessionCardMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const moveFocus = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  return (
    <div className="session-card-menu" role="menu" ref={menuRef} onClick={e => e.stopPropagation()} onKeyDown={moveFocus}>
      <button type="button" role="menuitem" className="session-card-menu-item" onClick={() => { onClose(); onOpen(); }}>
        Open session
      </button>
      <button type="button" role="menuitem" className="session-card-menu-item session-card-menu-item--danger" onClick={() => { onClose(); onDelete(); }}>
        Delete session…
      </button>
    </div>
  );
}
