'use client';

import Link from 'next/link';
import {
  AdminGate,
  AdminPageChrome,
  Panel,
  useAdminFetch,
} from '@/components/AdminPageKit';

type Data = {
  sdrFunnel: Array<{ step: string; count: number }>;
  brandFunnel: Array<{ step: string; count: number }>;
  topReps: Array<{
    id: string;
    displayName: string | null;
    email: string | null;
    totalPoints: number;
  }>;
  topBrands: Array<{
    id: string;
    name: string;
    campaigns: number;
    leads: number;
    creditsUsed: number;
    walletLabel: string;
  }>;
};

export default function AdminAnalyticsPage() {
  const { data, forbidden, error } = useAdminFetch<Data>('/api/admin/analytics');

  return (
    <AdminGate title="Analytics" forbidden={forbidden}>
      <AdminPageChrome
        title="Marketplace analytics"
        description="Core funnels — where liquidity leaks on both sides."
      >
        <div className="admin-split">
          <Panel title="SDR funnel">
            <ol className="list-quiet">
              {(data?.sdrFunnel || []).map((s, i) => (
                <li key={s.step}>
                  {i + 1}. {s.step}: <strong>{s.count}</strong>
                  {i > 0 && data?.sdrFunnel[i - 1]?.count
                    ? ` (${Math.round((s.count / data.sdrFunnel[i - 1].count) * 100)}%)`
                    : ''}
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Brand funnel">
            <ol className="list-quiet">
              {(data?.brandFunnel || []).map((s, i) => (
                <li key={s.step}>
                  {i + 1}. {s.step}: <strong>{s.count}</strong>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="admin-split">
          <Panel title="Top reps (points)">
            <ul className="list-quiet">
              {(data?.topReps || []).map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/users/${r.id}`}>
                    {r.displayName || r.email}
                  </Link>{' '}
                  · {r.totalPoints} pts
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Active brands">
            <ul className="list-quiet">
              {(data?.topBrands || []).map((b) => (
                <li key={b.id}>
                  {b.name} · {b.campaigns} campaigns · {b.leads} leads · {b.walletLabel} ·{' '}
                  {b.creditsUsed} credits used
                </li>
              ))}
            </ul>
          </Panel>
        </div>
        {error ? <p className="msg-err">{error}</p> : null}
      </AdminPageChrome>
    </AdminGate>
  );
}
