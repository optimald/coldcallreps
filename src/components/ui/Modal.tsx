'use client';

import { useEffect, type ReactNode } from 'react';

/** Simple accessible modal overlay. */
export default function Modal({
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
    <div className="cc-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className={`cc-modal${wide ? ' cc-modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cc-modal__head">
          <div>
            <h2 id="cc-modal-title" className="cc-modal__title">
              {title}
            </h2>
            {description ? <p className="cc-modal__desc">{description}</p> : null}
          </div>
          <button
            type="button"
            className="cc-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="cc-modal__body">{children}</div>
      </div>
    </div>
  );
}
