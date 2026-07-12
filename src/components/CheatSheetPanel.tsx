'use client';

import { useEffect } from 'react';

export type CheatSheetSection = {
  title: string;
  points: string[];
};

/** Shared playbook cheat overlay — same UI on Trainer and Cold Call. */
export default function CheatSheetPanel({
  open,
  onClose,
  sections,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  sections: CheatSheetSection[];
  loading?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cc-cheat-overlay" role="presentation" onClick={onClose}>
      <aside
        className="cc-cheat-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-cheat-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cc-cheat-panel__head">
          <h2 id="cc-cheat-title">Cheat sheet</h2>
          <button
            type="button"
            className="cc-cheat-panel__close"
            onClick={onClose}
            aria-label="Close cheat sheet"
          >
            ×
          </button>
        </div>
        <div className="cc-cheat-panel__body">
          {loading && sections.length === 0 ? (
            <p className="muted">Loading playbook cues…</p>
          ) : sections.length === 0 ? (
            <p className="muted">No playbook cues yet. Pick a playbook or lead and try again.</p>
          ) : (
            sections.map((sec) => (
              <div key={sec.title} className="cc-cheat-section">
                <h3>{sec.title}</h3>
                <ul>
                  {sec.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
