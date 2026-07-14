'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { PageHeader, Panel, SoftLink } from '@/components/ui/PagePrimitives';

export default function RestrictedClient({
  status,
  statusReason,
  userId,
}: {
  status: string;
  statusReason: string | null;
  userId: string | null;
}) {
  const { user } = useUser();
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitAppeal() {
    if (!userId) return;
    setBusy(true);
    setMsg('');
    // Support/ops staff create appeals; restricted users hit a public-ish path via signed-in session.
    // Use admin appeals POST which requires users.read — fallback: store via a dedicated open route.
    const res = await fetch('/api/account/appeal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? 'Appeal submitted. Trust & Safety will review it.' : d.error || 'Failed');
  }

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Account"
        title={status === 'BANNED' ? 'Account banned' : 'Account suspended'}
        description="Access to dialing, campaigns, and payouts is paused."
      />
      <Panel>
        <p style={{ marginTop: 0 }}>
          Signed in as {user?.primaryEmailAddress?.emailAddress || 'your account'}.
        </p>
        {statusReason ? (
          <p>
            <strong>Reason:</strong> {statusReason}
          </p>
        ) : null}

        <div style={{ marginTop: '1rem' }}>
          <label className="muted" htmlFor="appeal-reason">
            Submit an appeal
          </label>
          <textarea
            id="appeal-reason"
            className="field"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this should be reconsidered (min 5 characters)"
          />
          <button
            type="button"
            className="btn"
            disabled={busy || reason.trim().length < 5}
            onClick={submitAppeal}
            style={{ marginTop: '0.5rem' }}
          >
            Submit appeal
          </button>
        </div>

        {msg ? (
          <p className={msg.includes('submitted') ? 'msg-ok' : 'msg-err'}>{msg}</p>
        ) : null}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
          <SoftLink href="/settings">Settings</SoftLink>
          <Link href="/sign-in" className="btn-ghost">
            Switch account
          </Link>
        </div>
      </Panel>
    </main>
  );
}
