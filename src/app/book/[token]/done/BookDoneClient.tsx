'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

/** Calendly/Cal.com success redirect — attributes meeting via opaque token. */
export default function BookDoneClient() {
  const params = useParams<{ token: string }>();
  const search = useSearchParams();
  const token = params.token;
  const [msg, setMsg] = useState('Confirming your meeting…');

  useEffect(() => {
    if (!token) return;
    const entries: Record<string, string> = {};
    search.forEach((v, k) => {
      entries[k] = v;
    });

    void fetch(`/api/bookings/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookedVia: 'redirect',
        params: entries,
        meetingAt: entries.event_start_time || entries.start_time || entries.startTime || undefined,
      }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.ok || data.meetingAt) {
          setMsg('Meeting confirmed. You can close this tab.');
          try {
            window.opener?.postMessage(
              {
                type: 'ccr-booking-complete',
                token,
                meetingAt: data.meetingAt,
                claimId: data.claim?.id,
              },
              window.location.origin
            );
          } catch {
            /* ignore */
          }
          window.setTimeout(() => {
            try {
              window.close();
            } catch {
              /* ignore */
            }
          }, 1200);
        } else {
          setMsg(
            data.error ||
              'Could not confirm booking. Close this tab and retry from the dialer.'
          );
        }
      })
      .catch(() => setMsg('Network error confirming booking.'));
  }, [token, search]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        background: '#0b0f14',
        color: '#e8eef5',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <h1 style={{ fontSize: '1.35rem', marginBottom: '0.5rem' }}>ColdCallReps</h1>
        <p style={{ opacity: 0.85 }}>{msg}</p>
      </div>
    </main>
  );
}
