'use client';

import { CALL_DISPOSITIONS, type CallDisposition } from '@/components/FloatingCallWidget';
import { formatDuration } from '@/lib/trainer/session-utils';

/** Post-call wrap-up: disposition + notes. Lead edits live on the lead record. */
export default function CallWrapUpPanel({
  companyName,
  durationSecs,
  scorePending,
  notes,
  onNotesChange,
  disposition,
  onDisposition,
  onSave,
  onSkip,
  onEditLead,
  saving,
  mode,
}: {
  companyName: string;
  durationSecs: number;
  scorePending?: boolean;
  notes: string;
  onNotesChange: (notes: string) => void;
  disposition: CallDisposition | null;
  onDisposition: (id: CallDisposition) => void;
  onSave: () => void;
  onSkip: () => void;
  onEditLead?: () => void;
  saving?: boolean;
  mode: 'practice' | 'outbound';
}) {
  return (
    <div className="cc-wrap-up" role="region" aria-label="Call wrap-up">
      <header className="cc-wrap-up__head">
        <div>
          <h2 className="cc-wrap-up__title">{companyName}</h2>
          <p className="cc-wrap-up__meta muted">
            Call ended · {formatDuration(durationSecs)}
            {scorePending ? ' · Scoring…' : ''}
            {mode === 'practice' ? ' · Practice' : ''}
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={onSkip} disabled={saving}>
          Skip
        </button>
      </header>

      <div className="cc-wrap-up__section">
        <span className="cc-wrap-up__label">Disposition</span>
        <div className="cc-wrap-up__dispos">
          {CALL_DISPOSITIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`cc-wrap-up__chip${disposition === d.id ? ' is-active' : ''}`}
              data-outcome={d.id}
              onClick={() => onDisposition(d.id)}
            >
              <span aria-hidden>{d.short}</span> {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cc-wrap-up__section">
        <span className="cc-wrap-up__label">Call notes</span>
        <textarea
          className="field"
          rows={3}
          placeholder="What happened? Next step?"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          autoFocus
        />
      </div>

      {onEditLead ? (
        <button type="button" className="btn-ghost cc-wrap-up__edit-lead" onClick={onEditLead}>
          Open lead record →
        </button>
      ) : null}

      <div className="cc-wrap-up__actions">
        <button type="button" className="btn" onClick={onSave} disabled={saving || !disposition}>
          {saving ? 'Saving…' : 'Save & close'}
        </button>
        <button type="button" className="btn-ghost" onClick={onSkip} disabled={saving}>
          Skip wrap-up
        </button>
      </div>
    </div>
  );
}
