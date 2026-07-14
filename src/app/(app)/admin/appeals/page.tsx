'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  EmptyState,
  PageHeader,
  Panel,
  SoftLink,
} from '@/components/ui/PagePrimitives';
import { adminGetJson, ADMIN_DEMO_MSG } from '@/components/AdminPageKit';
import { useAdminDeskMode } from '@/hooks/useAdminDeskMode';

type Appeal = {
  id: string;
  reason: string;
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    accountStatus: string;
    statusReason: string | null;
    platformRole: string;
  };
};

export default function AdminAppealsPage() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [response, setResponse] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const { isDemo, hydrated } = useAdminDeskMode();

  async function load() {
    const res = await adminGetJson<{ appeals: Appeal[] }>('/api/admin/appeals', isDemo);
    if (res.status === 401 || res.status === 403 || res.error === 'forbidden') {
      setForbidden(true);
      return;
    }
    if (!res.ok) return;
    setAppeals(res.data?.appeals || []);
  }

  useEffect(() => {
    if (!hydrated) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo, hydrated]);

  async function decide(decision: 'APPROVED' | 'DENIED') {
    if (!selected) return;
    if (isDemo) {
      setMsg(ADMIN_DEMO_MSG);
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/appeals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appealId: selected, decision, response }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? 'Decision recorded.' : d.error || 'Failed');
    if (res.ok) {
      setSelected(null);
      setResponse('');
      load();
    }
  }

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title="Appeals" description="Trust & Safety access required." />
        <SoftLink href="/admin">← Command</SoftLink>
      </main>
    );
  }

  const active = appeals.find((a) => a.id === selected);

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Trust"
        title="Ban / suspension appeals"
        description="Review restricted accounts that requested reinstatement."
      />
      <div className="admin-split">
        <Panel title="Queue" description={`${appeals.length} pending`}>
          {appeals.length === 0 ? (
            <EmptyState title="Queue clear" description="No pending appeals." />
          ) : (
            <div className="admin-review__list">
              {appeals.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={`admin-review__item admin-review__item--stack${
                    selected === a.id ? ' is-active' : ''
                  }`}
                  onClick={() => setSelected(a.id)}
                >
                  <strong>
                    {a.user.displayName || a.user.email} · {a.user.accountStatus}
                  </strong>
                  <span className="muted">{a.reason.slice(0, 120)}</span>
                  <span className="muted admin-review__meta">
                    {new Date(a.createdAt).toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Decision" description="Approve reinstates the account to ACTIVE.">
          {active ? (
            <div className="stack admin-appeals__decision">
              <p>
                <Link href={`/admin/users/${active.user.id}`}>
                  {active.user.displayName || active.user.email}
                </Link>
                {' · '}
                {active.user.platformRole}
                {' · '}
                {active.user.accountStatus}
              </p>
              {active.user.statusReason ? (
                <p className="muted">Ban reason: {active.user.statusReason}</p>
              ) : null}
              <p>
                <strong>Appeal:</strong> {active.reason}
              </p>
              <textarea
                className="field"
                rows={3}
                value={response}
                onChange={(e) => setResponse(e.target.value)}
                placeholder="Decision response (required)"
              />
              <div className="admin-review__actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => decide('APPROVED')}
                >
                  Approve & reinstate
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => decide('DENIED')}
                >
                  Deny
                </button>
              </div>
            </div>
          ) : (
            <p className="muted">Select an appeal.</p>
          )}
        </Panel>
      </div>

      {msg ? (
        <p className={msg.includes('recorded') ? 'msg-ok' : 'msg-err'}>{msg}</p>
      ) : null}
    </main>
  );
}
