'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { brandHref } from '@/lib/brand-context';
import { DEMO_APPLICATIONS, DEMO_MSG } from '@/lib/demo/brand-demo-data';
import { useBrandDeskMode } from '@/hooks/useBrandDeskMode';
import { EmptyState } from '@/components/ui/PagePrimitives';

export type ApplicationRow = {
  id: string;
  status: string;
  campaignId: string;
  campaignTitle: string;
  displayName: string;
  profileSlug: string | null;
  createdAt: string;
};

export default function BrandSdrApplicationsClient({
  brandKey,
  initial,
}: {
  brandKey: string;
  initial: ApplicationRow[];
}) {
  const router = useRouter();
  const { mode, hydrated } = useBrandDeskMode();
  const isDemo = hydrated && mode === 'demo';
  const [rows, setRows] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setRows(isDemo ? DEMO_APPLICATIONS : initial);
  }, [isDemo, initial]);

  async function setStatus(row: ApplicationRow, status: 'ACTIVE' | 'REJECTED' | 'WITHDRAWN') {
    if (isDemo) {
      setMsg(DEMO_MSG);
      return;
    }
    setBusyId(row.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/campaigns/${row.campaignId}/applications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: row.id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      const nextStatus = data.application?.status || status;
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r))
      );
      setMsg(data.notice || `Marked ${nextStatus}`);
      router.refresh();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  const displayRows = isDemo ? DEMO_APPLICATIONS : rows;

  if (displayRows.length === 0) {
    return (
      <EmptyState
        title="No applications yet"
        description="Post an OPEN campaign so SDRs can apply from Brand deals."
        action={
          <Link href={brandHref(brandKey, 'campaigns')} className="btn" style={{ marginTop: '1rem' }}>
            Post a campaign
          </Link>
        }
      />
    );
  }

  return (
    <div className="stack">
      {msg ? (
        <p className="muted" role="status" style={{ margin: 0 }}>
          {msg}
        </p>
      ) : null}
      {displayRows.map((a) => {
        const pending = a.status === 'APPLIED';
        const active = a.status === 'ACTIVE' || a.status === 'ACCEPTED';
        return (
          <div
            key={a.id}
            className="session-row"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <div>
              <strong>{a.displayName}</strong>
              <div className="session-row__meta">
                {a.status} · {a.campaignTitle} ·{' '}
                {new Date(a.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {pending ? (
                <>
                  <button
                    type="button"
                    className="btn"
                    disabled={busyId === a.id}
                    onClick={() => void setStatus(a, 'ACTIVE')}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busyId === a.id}
                    onClick={() => void setStatus(a, 'REJECTED')}
                  >
                    Reject
                  </button>
                </>
              ) : null}
              {active && a.status !== 'ACTIVE' ? (
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === a.id}
                  onClick={() => void setStatus(a, 'ACTIVE')}
                >
                  Activate
                </button>
              ) : null}
              {a.profileSlug ? (
                <Link href={`/r/${a.profileSlug}`} className="btn-ghost">
                  Profile
                </Link>
              ) : null}
              <Link
                href={brandHref(brandKey, 'campaigns', a.campaignId)}
                className="btn-ghost"
              >
                Campaign
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
