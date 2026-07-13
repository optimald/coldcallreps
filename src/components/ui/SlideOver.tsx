'use client';

import { useEffect, type ReactNode } from 'react';

/** Right-side slide-over panel for dense detail views. */
export default function SlideOver({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cc-drawer-overlay" role="presentation" onClick={onClose}>
      <aside
        className={`cc-drawer${wide ? ' cc-drawer--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cc-drawer__head">
          <div className="cc-drawer__head-text">
            <h2 id="cc-drawer-title" className="cc-drawer__title">
              {title}
            </h2>
            {description ? <p className="cc-drawer__desc">{description}</p> : null}
          </div>
          <button
            type="button"
            className="cc-drawer__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="cc-drawer__body">{children}</div>
      </aside>
    </div>
  );
}
