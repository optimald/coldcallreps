'use client';

import Link from 'next/link';
import {
  AdminGate,
  AdminPageChrome,
  Panel,
  useAdminFetch,
} from '@/components/AdminPageKit';
import { Stat, StatGrid } from '@/components/ui/PagePrimitives';

type Data = {
  kpis: {
    sessions30: number;
    flagged30: number;
    avgScore: number | null;
    practiceMinutes30: number;
    estXaiCostLabel: string;
    minutesRemainingPool: number;
    minutesUsedPool: number;
    openHolds: number;
    assumedCostPerMinCents: number;
  };
  series: Array<{ day: string; sessions: number; minutes: number }>;
  recentSessions: Array<{
    id: string;
    overallScore: number;
    duration: number;
    focusArea: string;
    flagged: boolean;
    userName: string | null;
    userId: string;
    createdAt: string;
  }>;
  clips: Array<{
    id: string;
    title: string | null;
    status: string;
    durationSec: number | null;
    userName: string | null;
    createdAt: string;
  }>;
};

export default function AdminVoicePage() {
  const { data, forbidden, error } = useAdminFetch<Data>('/api/admin/voice');

  return (
    <AdminGate title="Voice" forbidden={forbidden}>
      <AdminPageChrome
        title="Voice practice infra"
        description="Session health, estimated xAI spend vs minutes sold, R2 clips."
      >
        {data?.kpis ? (
          <StatGrid>
            <Stat label="Sessions 30d" value={data.kpis.sessions30} tone="accent" />
            <Stat label="Flagged" value={data.kpis.flagged30} tone="warn" />
            <Stat label="Avg score" value={data.kpis.avgScore ?? '—'} />
            <Stat label="Practice min" value={data.kpis.practiceMinutes30} />
            <Stat label="Est. xAI cost" value={data.kpis.estXaiCostLabel} />
            <Stat label="Open holds" value={data.kpis.openHolds} />
          </StatGrid>
        ) : null}

        <Panel
          title="Unit economics"
          description={`Assumes $${((data?.kpis.assumedCostPerMinCents || 5) / 100).toFixed(2)}/min via XAI_VOICE_COST_CENTS_PER_MIN. Minutes remaining pool ${data?.kpis.minutesRemainingPool ?? '—'} · used ${data?.kpis.minutesUsedPool ?? '—'}.`}
        >
          <ul className="list-quiet">
            {(data?.series || []).map((s) => (
              <li key={s.day}>
                {s.day} · {s.sessions} sessions · {s.minutes} min
              </li>
            ))}
          </ul>
        </Panel>

        <div className="admin-split">
          <Panel title="Recent sessions">
            <ul className="list-quiet">
              {(data?.recentSessions || []).map((s) => (
                <li key={s.id}>
                  <Link href={`/sessions/${s.id}`}>
                    {s.focusArea} · {s.overallScore}
                  </Link>
                  {s.flagged ? ' · flagged' : ''} ·{' '}
                  <Link href={`/admin/users/${s.userId}`}>{s.userName}</Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="R2 clips">
            <ul className="list-quiet">
              {(data?.clips || []).map((c) => (
                <li key={c.id}>
                  {c.title || c.id} · {c.status} · {c.durationSec ?? '—'}s · {c.userName}
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
