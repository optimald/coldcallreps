'use client';

import { useState, type ReactNode } from 'react';
import { formatDuration } from '@/lib/trainer/session-utils';

export type CallDisposition =
  | 'interested'
  | 'callback'
  | 'not_interested'
  | 'voicemail'
  | 'no_answer';

export const CALL_DISPOSITIONS: { id: CallDisposition; label: string; short: string }[] = [
  { id: 'interested', label: 'Interested', short: '🔥' },
  { id: 'callback', label: 'Callback', short: '📅' },
  { id: 'not_interested', label: 'No', short: '🚫' },
  { id: 'voicemail', label: 'VM', short: '📱' },
  { id: 'no_answer', label: 'N/A', short: '📞' },
];

/** Bottom-right floating controls during an active practice or outbound call. */
export default function FloatingCallWidget({
  open,
  title,
  subtitle,
  statusLabel,
  durationSecs,
  onEnd,
  endLabel = 'End',
  micEnabled,
  onToggleMic,
  muted,
  onToggleMute,
  primaryAction,
  dispositions,
  onQuickDisposition,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  statusLabel: string;
  durationSecs: number;
  onEnd: () => void;
  endLabel?: string;
  micEnabled?: boolean;
  onToggleMic?: () => void;
  muted?: boolean;
  onToggleMute?: () => void;
  primaryAction?: ReactNode;
  dispositions?: boolean;
  onQuickDisposition?: (id: CallDisposition) => void;
}) {
  const [minimized, setMinimized] = useState(false);

  if (!open) return null;

  return (
    <aside
      className={`cc-float-call${minimized ? ' is-minimized' : ''}`}
      aria-label="Active call controls"
    >
      <header className="cc-float-call__head">
        <div className="cc-float-call__title-row">
          <span className="cc-float-call__dot" aria-hidden />
          <strong className="cc-float-call__title">{title}</strong>
        </div>
        <button
          type="button"
          className="cc-float-call__min"
          onClick={() => setMinimized((m) => !m)}
          aria-label={minimized ? 'Expand call widget' : 'Minimize call widget'}
        >
          {minimized ? '▴' : '▾'}
        </button>
      </header>

      {minimized ? (
        <div className="cc-float-call__mini-body">
          <span className="cc-float-call__timer">{formatDuration(durationSecs)}</span>
          <button type="button" className="cc-float-call__end" onClick={onEnd}>
            {endLabel}
          </button>
        </div>
      ) : (
        <div className="cc-float-call__body">
          <p className="cc-float-call__status">
            {statusLabel}
            <span className="cc-float-call__timer"> · {formatDuration(durationSecs)}</span>
          </p>
          {subtitle ? <p className="cc-float-call__sub muted">{subtitle}</p> : null}

          <div className="cc-float-call__controls">
            {onToggleMic ? (
              <button type="button" className="cc-float-call__ctrl" onClick={onToggleMic}>
                Mic {micEnabled ? 'On' : 'Off'}
              </button>
            ) : null}
            {onToggleMute ? (
              <button type="button" className="cc-float-call__ctrl" onClick={onToggleMute}>
                {muted ? 'Unmute' : 'Mute'}
              </button>
            ) : null}
            <button type="button" className="cc-float-call__end" onClick={onEnd}>
              {endLabel}
            </button>
          </div>

          {primaryAction}

          {dispositions && onQuickDisposition ? (
            <div className="cc-float-call__dispos">
              {CALL_DISPOSITIONS.slice(0, 3).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className="cc-float-call__dispos-btn"
                  onClick={() => onQuickDisposition(d.id)}
                >
                  {d.short} {d.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      )}
    </aside>
  );
}
