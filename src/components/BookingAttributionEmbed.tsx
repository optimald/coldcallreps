'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Embeds Calendly/Cal.com for meeting attribution.
 * Listens for calendly.event_scheduled and polls claim status.
 */
export default function BookingAttributionEmbed({
  token,
  embedUrl,
  provider,
  meetingDurationMinutes,
  onBooked,
  onError,
}: {
  token: string;
  embedUrl: string;
  provider?: string;
  meetingDurationMinutes?: number | null;
  onBooked: (info: { meetingAt: string; claimId: string }) => void;
  onError?: (message: string) => void;
}) {
  const [status, setStatus] = useState<'waiting' | 'completing' | 'done'>('waiting');
  const [hint, setHint] = useState<string | null>(null);

  const iframeSrc = useMemo(() => {
    // Calendly embed prefers /embed path when available
    if (provider === 'calendly' && embedUrl.includes('calendly.com') && !embedUrl.includes('/embed')) {
      try {
        const u = new URL(embedUrl);
        // Keep as-is — many Calendly URLs work in iframe; popup fallback exists
        return u.toString();
      } catch {
        return embedUrl;
      }
    }
    return embedUrl;
  }, [embedUrl, provider]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      const ev = (data as { event?: string; type?: string }).event;
      const type = (data as { type?: string }).type;
      if (ev === 'calendly.event_scheduled') {
        void complete({
          bookedVia: 'calendly',
          payload: (data as { payload?: unknown }).payload,
        });
      }
      if (type === 'ccr-booking-complete' && (data as { token?: string }).token === token) {
        setStatus('done');
        onBooked({
          meetingAt: String((data as { meetingAt?: string }).meetingAt || new Date().toISOString()),
          claimId: String((data as { claimId?: string }).claimId || ''),
        });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [token, onBooked]);

  // Poll in case redirect completed in another tab/window
  useEffect(() => {
    if (status !== 'waiting') return;
    const id = window.setInterval(() => {
      void fetch(`/api/bookings/${token}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.claim?.meetingAt && (d.claim.status === 'PASSED' || d.claim.status === 'PAID' || d.claim.status === 'FAILED')) {
            setStatus('done');
            onBooked({
              meetingAt: new Date(d.claim.meetingAt).toISOString(),
              claimId: d.claim.id,
            });
          }
        })
        .catch(() => {});
    }, 2500);
    return () => window.clearInterval(id);
  }, [token, status, onBooked]);

  async function complete(body: Record<string, unknown>) {
    if (status !== 'waiting') return;
    setStatus('completing');
    try {
      const res = await fetch(`/api/bookings/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.meetingAt) {
        onError?.(data.error || 'Could not attribute booking');
        setStatus('waiting');
        return;
      }
      setStatus('done');
      onBooked({
        meetingAt: data.meetingAt || new Date().toISOString(),
        claimId: data.claim?.id || '',
      });
    } catch (e: unknown) {
      onError?.(e instanceof Error ? e.message : 'Booking attribution failed');
      setStatus('waiting');
    }
  }

  return (
    <div className="cc-booking-embed">
      <div className="cc-booking-embed__meta">
        <strong>Book the meeting</strong>
        <span className="muted">
          {meetingDurationMinutes ? `${meetingDurationMinutes} min · ` : ''}
          Prospect books on the founder&apos;s calendar — attributed to you automatically.
        </span>
      </div>

      {status === 'done' ? (
        <p className="cc-booking-embed__ok">Meeting attributed. You can save wrap-up.</p>
      ) : (
        <>
          <iframe
            title="Book meeting"
            src={iframeSrc}
            className="cc-booking-embed__frame"
            allow="camera; microphone; fullscreen"
          />
          <div className="cc-booking-embed__fallback">
            <a href={`/book/${token}`} target="_blank" rel="noreferrer" className="btn-ghost">
              Open booking in new tab →
            </a>
            <button
              type="button"
              className="btn-ghost"
              disabled={status === 'completing'}
              onClick={() => {
                setHint('Mark only after the prospect confirmed a time on the calendar.');
                void complete({ bookedVia: provider || 'manual', meetingAt: new Date().toISOString() });
              }}
            >
              {status === 'completing' ? 'Saving…' : 'They booked — confirm'}
            </button>
          </div>
          {hint ? <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>{hint}</p> : null}
        </>
      )}
    </div>
  );
}
