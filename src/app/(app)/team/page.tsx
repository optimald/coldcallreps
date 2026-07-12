'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader, Panel, EmptyState, StatGrid, Stat } from '@/components/ui/PagePrimitives';

type RosterMember = {
  id: string;
  email: string | null;
  displayName: string;
  platformRole: string;
  plan: string;
  minutesRemaining: number;
  minutesUsed: number;
  totalPoints: number;
  currentStreak: number;
  lastSessionDate: string | null;
  profileSlug: string | null;
  verified: boolean;
  academyRole: string | null;
  academySlug: string | null;
  sessionCount: number;
  clipCount: number;
  avgScore: number | null;
  recentSessions: {
    id: string;
    overallScore: number;
    focusArea: string;
    duration: number;
    createdAt: string;
  }[];
  clips: {
    id: string;
    title: string | null;
    highlightUrl: string;
    sessionId: string | null;
    createdAt: string;
  }[];
};

type RosterData = {
  orgId: string;
  poolMinutesRemaining: number | null;
  poolMinutesUsed: number | null;
  memberCount: number;
  members: RosterMember[];
};

export default function TeamRosterPage() {
  const [data, setData] = useState<RosterData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/org/roster')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || 'Could not load roster');
        return body as RosterData;
      })
      .then(setData)
      .catch((e) => setError(e.message || 'Could not load roster'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="app-page">
        <PageHeader eyebrow="Team" title="Roster" description="Loading org members…" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Team"
          title="Roster"
          description="Org admins can review training activity across the Clerk organization."
        />
        <EmptyState
          title="Roster unavailable"
          description={error}
          action={
            <Link href="/academy" className="btn">
              Open Academy
            </Link>
          }
        />
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Team"
        title="Roster"
        description="Org admin view of members in your organization — identity, scores, recordings, and minutes."
        actions={
          <Link href="/academy" className="btn-ghost">
            Academy
          </Link>
        }
      />

      <StatGrid>
        <Stat label="Members" value={data.memberCount} />
        <Stat
          label="Pool minutes left"
          value={data.poolMinutesRemaining != null ? data.poolMinutesRemaining : '—'}
        />
        <Stat
          label="Pool minutes used"
          value={data.poolMinutesUsed != null ? data.poolMinutesUsed : '—'}
        />
      </StatGrid>

      <Panel title="Members" description="Scoped to your Clerk organization only.">
        {data.members.length === 0 ? (
          <EmptyState
            title="No members yet"
            description="Invite teammates via Clerk org membership or Academy."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.members.map((m) => {
              const open = expanded === m.id;
              return (
                <div
                  key={m.id}
                  className="panel"
                  style={{ margin: 0, padding: '1rem 1.1rem' }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.75rem 1.25rem',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>
                        {m.displayName}
                        {m.verified ? (
                          <span className="muted" style={{ marginLeft: 8, fontWeight: 500 }}>
                            verified
                          </span>
                        ) : null}
                      </p>
                      <p className="muted" style={{ margin: '0.2rem 0 0', fontSize: '0.88rem' }}>
                        {m.email || 'No email'} · {m.platformRole} · {m.plan}
                        {m.academyRole ? ` · academy ${m.academyRole}` : ''}
                      </p>
                      <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.88rem' }}>
                        {m.sessionCount} sessions · avg {m.avgScore ?? '—'} · {m.clipCount} recordings
                        · {m.minutesRemaining} min left · {m.minutesUsed} used · {m.totalPoints} pts
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {m.profileSlug ? (
                        <Link href={`/${m.profileSlug}`} className="btn-ghost">
                          Profile
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => setExpanded(open ? null : m.id)}
                      >
                        {open ? 'Hide activity' : 'View activity'}
                      </button>
                    </div>
                  </div>

                  {open && (
                    <div
                      style={{
                        marginTop: '0.9rem',
                        display: 'grid',
                        gap: '1rem',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      }}
                    >
                      <div>
                        <p className="page-eyebrow" style={{ marginBottom: '0.45rem' }}>
                          Recent sessions
                        </p>
                        {m.recentSessions.length === 0 ? (
                          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                            No sessions yet.
                          </p>
                        ) : (
                          <ul className="list-quiet" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                            {m.recentSessions.map((s) => (
                              <li key={s.id}>
                                <Link href={`/sessions/${s.id}`} className="soft-link">
                                  Score {s.overallScore} · {s.focusArea}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div>
                        <p className="page-eyebrow" style={{ marginBottom: '0.45rem' }}>
                          Recordings
                        </p>
                        {m.clips.length === 0 ? (
                          <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                            No stored recordings.
                          </p>
                        ) : (
                          <ul className="list-quiet" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                            {m.clips.map((c) => (
                              <li key={c.id}>
                                <Link href={c.highlightUrl} className="soft-link">
                                  {c.title || 'Highlight'}
                                </Link>
                                {c.sessionId ? (
                                  <>
                                    {' · '}
                                    <Link href={`/sessions/${c.sessionId}`} className="soft-link">
                                      session
                                    </Link>
                                  </>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </main>
  );
}
