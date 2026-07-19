'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type Endpoint = {
  id: string;
  url: string;
  events: string;
  active: boolean;
  createdAt: string;
};

/**
 * Manage outbound webhook endpoints (API already exists at /api/webhooks).
 */
export default function WebhooksPanel() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [secretOnce, setSecretOnce] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/webhooks');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Could not load webhooks');
        return;
      }
      setEndpoints(data.endpoints || []);
      setErr('');
    } catch {
      setErr('Could not load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    setErr('');
    setSecretOnce(null);
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || 'Create failed');
        return;
      }
      setSecretOnce(data.endpoint?.secret || null);
      setMsg(data.endpoint?.notice || 'Webhook created.');
      setUrl('');
      await load();
    } catch {
      setErr('Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/webhooks?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErr(data.error || 'Delete failed');
        return;
      }
      setMsg('Webhook removed.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section style={{ marginTop: '2.5rem' }}>
      <h2 style={{ fontSize: '1.15rem' }}>Webhooks</h2>
      <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Receive <code>session.scored</code>, <code>bounty.cleared</code>, and{' '}
        <code>application.submitted</code> at your HTTPS endpoint. Signed with{' '}
        <code>X-CCR-Signature</code>.
      </p>
      {msg ? <p className="msg-ok">{msg}</p> : null}
      {err ? <p className="msg-err">{err}</p> : null}
      {secretOnce ? (
        <p className="msg-ok">
          Signing secret (copy now): <code>{secretOnce}</code>
        </p>
      ) : null}
      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
          {endpoints.length === 0 ? (
            <li className="muted">No webhooks yet.</li>
          ) : (
            endpoints.map((ep) => (
              <li
                key={ep.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  marginBottom: '0.5rem',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  <code>{ep.url}</code>
                  <span className="muted" style={{ marginLeft: 8 }}>
                    {ep.active ? 'active' : 'off'}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => void remove(ep.id)}
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <form onSubmit={create} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          type="url"
          required
          placeholder="https://example.com/hooks/ccr"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: '1 1 240px' }}
        />
        <button type="submit" className="btn" disabled={busy || !url.trim()}>
          {busy ? 'Saving…' : 'Add webhook'}
        </button>
      </form>
    </section>
  );
}
