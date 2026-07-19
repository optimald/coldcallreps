'use client';

import { useEffect } from 'react';
import { CALL_DISPOSITIONS, type CallDisposition } from '@/components/FloatingCallWidget';
import BookingAttributionEmbed from '@/components/BookingAttributionEmbed';
import { formatDuration } from '@/lib/trainer/session-utils';

/** Post-call wrap-up: disposition + notes. Appointment Set embeds brand calendar. */
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
  meetingBooking,
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
  /** When set, Appointment Set requires a successful booking attribution. */
  meetingBooking?: {
    enabled: boolean;
    token: string | null;
    embedUrl: string | null;
    provider?: string;
    meetingDurationMinutes?: number | null;
    starting?: boolean;
    booked?: boolean;
    onStart: () => void;
    onBooked: (info: { meetingAt: string; claimId: string }) => void;
    error?: string | null;
  } | null;
}) {
  const needsBooking =
    mode === 'outbound' &&
    disposition === 'appointment_set' &&
    meetingBooking?.enabled;

  const canSave =
    Boolean(disposition) &&
    (!needsBooking || Boolean(meetingBooking?.booked));

  useEffect(() => {
    if (needsBooking && !meetingBooking?.token && !meetingBooking?.starting) {
      meetingBooking?.onStart();
    }
  }, [needsBooking, meetingBooking]);

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
              <span aria-hidden className="cc-wrap-up__code">{d.code}</span> {d.label}
            </button>
          ))}
        </div>
      </div>

      {needsBooking ? (
        <div className="cc-wrap-up__section">
          {meetingBooking.starting || !meetingBooking.token || !meetingBooking.embedUrl ? (
            <p className="muted" style={{ margin: 0 }}>
              {meetingBooking.error || 'Preparing booking link…'}
            </p>
          ) : (
            <BookingAttributionEmbed
              token={meetingBooking.token}
              embedUrl={meetingBooking.embedUrl}
              provider={meetingBooking.provider}
              meetingDurationMinutes={meetingBooking.meetingDurationMinutes}
              onBooked={meetingBooking.onBooked}
              onError={(m) => {
                /* surfaced via parent error if needed */
                console.warn('[booking]', m);
              }}
            />
          )}
          {meetingBooking.error ? (
            <p className="msg-err" style={{ marginTop: '0.5rem' }}>
              {meetingBooking.error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="cc-wrap-up__section">
        <span className="cc-wrap-up__label">Call notes</span>
        <textarea
          className="field"
          rows={3}
          placeholder="What happened? Next step?"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          autoFocus={!needsBooking}
        />
      </div>

      {onEditLead ? (
        <button type="button" className="btn-ghost cc-wrap-up__edit-lead" onClick={onEditLead}>
          Lead details →
        </button>
      ) : null}

      <div className="cc-wrap-up__actions">
        <button type="button" className="btn" onClick={onSave} disabled={saving || !canSave}>
          {saving
            ? 'Saving…'
            : needsBooking && !meetingBooking?.booked
              ? 'Book meeting to continue'
              : 'Save & close'}
        </button>
        <button type="button" className="btn-ghost" onClick={onSkip} disabled={saving}>
          Skip wrap-up
        </button>
      </div>
    </div>
  );
}
