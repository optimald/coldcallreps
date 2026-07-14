'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  PageHeader,
  Panel,
  SoftLink,
  Stat,
  StatGrid,
} from '@/components/ui/PagePrimitives';
import { adminGetJson, ADMIN_DEMO_MSG } from '@/components/AdminPageKit';
import { useAdminDeskMode } from '@/hooks/useAdminDeskMode';

type Detail = {
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    platformRole: string;
    opsRole: string | null;
    accountStatus: string;
    statusReason: string | null;
    plan: string;
    minutesRemaining: number;
    minutesUsed: number;
    totalPoints: number;
    stripeConnectAccountId: string | null;
    stripeConnectPayoutsEnabled: boolean;
    stripeCustomerId: string | null;
    orgId: string | null;
    createdAt: string;
    repProfile: { slug: string | null; verified: boolean } | null;
    brandsOwned: Array<{
      id: string;
      name: string;
      slug: string;
      creditsRemaining: number;
      walletCents: number;
    }>;
    banAppeals: Array<{
      id: string;
      status: string;
      reason: string;
      createdAt: string;
    }>;
  };
  sessions: Array<{
    id: string;
    overallScore: number;
    focusArea: string;
    duration: number;
    flagged: boolean;
    createdAt: string;
  }>;
  payoutsEarned: Array<{
    id: string;
    status: string;
    netCents: number;
    campaignTitle: string;
    holdReason: string | null;
    createdAt: string;
  }>;
  applications: Array<{
    id: string;
    status: string;
    campaignTitle: string;
    createdAt: string;
  }>;
  audits: Array<{
    id: string;
    action: string;
    createdAt: string;
    actorEmail: string;
  }>;
  earnings: { paidCount: number; paidNetLabel: string };
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const [data, setData] = useState<Detail | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [creditDelta, setCreditDelta] = useState('20');
  const [creditReason, setCreditReason] = useState('');
  const [impersonateReason, setImpersonateReason] = useState('');
  const [busy, setBusy] = useState(false);
  const { isDemo, hydrated } = useAdminDeskMode();

  async function load() {
    const res = await adminGetJson<Detail>(`/api/admin/users/${id}`, isDemo);
    if (res.status === 401 || res.status === 403 || res.error === 'forbidden') {
      setForbidden(true);
      return;
    }
    if (!res.ok || !res.data) {
      setMsg(res.error || 'Failed to load user');
      return;
    }
    setData(res.data);
  }

  useEffect(() => {
    if (!id || !hydrated) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isDemo, hydrated]);

  async function patch(body: Record<string, unknown>) {
    if (isDemo) {
      setMsg(ADMIN_DEMO_MSG);
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, ...body }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? 'Saved.' : d.error || 'Failed');
    if (res.ok) load();
  }

  async function startImpersonation() {
    if (isDemo) {
      setMsg(ADMIN_DEMO_MSG);
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: id, reason: impersonateReason }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(d.error || 'Impersonation failed');
      return;
    }
    setMsg('Impersonation token created — opening target session…');
    if (d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
  }

  if (forbidden) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Access" title="User" description="Ops access required." />
        <SoftLink href="/admin/users">← Users</SoftLink>
      </main>
    );
  }

  const u = data?.user;

  return (
    <main className="app-page admin-page">
      <PageHeader
        eyebrow="Users"
        title={u?.displayName || u?.email || 'User'}
        description={u ? `${u.email} · ${u.platformRole} · joined ${new Date(u.createdAt).toLocaleDateString()}` : 'Loading…'}
        actions={<SoftLink href="/admin/users">← Directory</SoftLink>}
      />
      {u ? (
        <>
          <StatGrid>
            <Stat label="Status" value={u.accountStatus} tone={u.accountStatus === 'ACTIVE' ? 'good' : 'warn'} />
            <Stat label="Minutes" value={u.minutesRemaining} />
            <Stat label="Points" value={u.totalPoints} />
            <Stat label="Earnings" value={data?.earnings.paidNetLabel || '$0'} />
            <Stat label="Plan" value={u.plan} />
          </StatGrid>

          <div className="admin-split">
            <Panel title="Account enforcement" description="Suspend/ban require a reason and are audit-logged.">
              {u.statusReason ? (
                <p className="muted" style={{ marginTop: 0 }}>
                  Current reason: {u.statusReason}
                </p>
              ) : null}
              <textarea
                className="field"
                rows={2}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                placeholder="Reason (required for suspend/ban)"
              />
              <div className="admin-review__actions">
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => patch({ accountStatus: 'ACTIVE', statusReason: 'reinstated' })}
                >
                  Reinstate
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    patch({ accountStatus: 'SUSPENDED', statusReason })
                  }
                >
                  Suspend
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => patch({ accountStatus: 'BANNED', statusReason })}
                >
                  Ban
                </button>
              </div>
            </Panel>

            <Panel title="Credits" description="Minute adjustments require a reason.">
              <div className="search-row">
                <input
                  className="field"
                  value={creditDelta}
                  onChange={(e) => setCreditDelta(e.target.value)}
                  placeholder="± minutes"
                  style={{ maxWidth: 120 }}
                />
                <input
                  className="field"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="Reason"
                />
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() =>
                    patch({
                      minuteDelta: Number(creditDelta) || 0,
                      creditReason,
                    })
                  }
                >
                  Apply
                </button>
              </div>
              <div className="admin-review__actions" style={{ marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() =>
                    patch({ verified: !u.repProfile?.verified })
                  }
                >
                  {u.repProfile?.verified ? 'Unverify rep' : 'Verify rep'}
                </button>
              </div>
            </Panel>
          </div>

          <Panel title="Impersonate" description="Clerk actor token · 30 min session · logged. Opens in a new tab with a visible actor session.">
            <div className="search-row">
              <input
                className="field"
                value={impersonateReason}
                onChange={(e) => setImpersonateReason(e.target.value)}
                placeholder="Support ticket / reason (min 5 chars)"
              />
              <button
                type="button"
                className="btn"
                disabled={busy || impersonateReason.trim().length < 5}
                onClick={startImpersonation}
              >
                Login as user
              </button>
            </div>
          </Panel>

          <div className="admin-split">
            <Panel title="Connect / billing">
              <ul className="list-quiet">
                <li>Customer: {u.stripeCustomerId || '—'}</li>
                <li>Connect: {u.stripeConnectAccountId || '—'}</li>
                <li>Payouts enabled: {u.stripeConnectPayoutsEnabled ? 'yes' : 'no'}</li>
                <li>Org: {u.orgId || '—'}</li>
                <li>
                  Public:{' '}
                  {u.repProfile?.slug ? (
                    <Link href={`/${u.repProfile.slug}`}>/{u.repProfile.slug}</Link>
                  ) : (
                    '—'
                  )}
                </li>
              </ul>
            </Panel>

            <Panel title="Brands owned">
              {u.brandsOwned.length === 0 ? (
                <p className="muted">None</p>
              ) : (
                <ul className="list-quiet">
                  {u.brandsOwned.map((b) => (
                    <li key={b.id}>
                      <Link href={`/brands/${b.slug || b.id}`}>{b.name}</Link>
                      {' · '}
                      {b.creditsRemaining} credits · ${(b.walletCents / 100).toFixed(0)} wallet
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Panel title="Practice sessions">
            <ul className="list-quiet">
              {(data?.sessions || []).map((s) => (
                <li key={s.id}>
                  <Link href={`/sessions/${s.id}`}>
                    {s.focusArea} · {s.overallScore}
                  </Link>
                  {s.flagged ? ' · flagged' : ''} · {new Date(s.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Payouts earned">
            <ul className="list-quiet">
              {(data?.payoutsEarned || []).map((p) => (
                <li key={p.id}>
                  {p.campaignTitle} · {p.status} · ${(p.netCents / 100).toFixed(2)}
                  {p.holdReason ? ` · hold: ${p.holdReason}` : ''}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Campaign applications">
            <ul className="list-quiet">
              {(data?.applications || []).map((a) => (
                <li key={a.id}>
                  {a.campaignTitle} · {a.status} · {new Date(a.createdAt).toLocaleDateString()}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Related audit">
            <ul className="list-quiet">
              {(data?.audits || []).slice(0, 12).map((a) => (
                <li key={a.id}>
                  <code>{a.action}</code> · {a.actorEmail} ·{' '}
                  {new Date(a.createdAt).toLocaleString()}
                </li>
              ))}
            </ul>
            <SoftLink href="/admin/audit">Full audit log →</SoftLink>
          </Panel>
        </>
      ) : (
        <Panel>
          <p className="muted">Loading dossier…</p>
        </Panel>
      )}

      {msg ? (
        <p className={msg === 'Saved.' || msg.startsWith('Impersonation') ? 'msg-ok' : 'msg-err'}>
          {msg}
        </p>
      ) : null}
    </main>
  );
}
