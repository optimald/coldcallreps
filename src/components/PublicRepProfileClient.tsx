'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PublicRepProfileClient({ slug }: { slug: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/profile/${slug}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Not found');
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <main style={{ padding: '3rem 1.5rem', maxWidth: 720, margin: '0 auto' }}>
        <p style={{ color: 'var(--muted)' }}>{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={{ padding: '3rem 1.5rem', maxWidth: 720, margin: '0 auto' }}>
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '3rem 1.5rem 5rem', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', margin: 0 }}>
          {data.displayName || 'Rep'}
        </h1>
        {data.verified && <span style={pillAccent}>Verified</span>}
        {data.openToWork && <span style={pillOpen}>Open to work</span>}
      </div>

      {data.headline && (
        <p style={{ fontWeight: 600, fontSize: '1.1rem', margin: '0.65rem 0 0.25rem' }}>
          {data.headline}
        </p>
      )}
      <p style={{ color: 'var(--muted)', margin: '0.25rem 0 1rem' }}>
        coldcallreps.com/{data.slug}
        {data.role && data.role !== 'REP' ? ` · ${data.role}` : ''}
      </p>

      {data.bio && <p style={{ lineHeight: 1.65, marginBottom: '1.25rem' }}>{data.bio}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.65rem',
          marginBottom: '1.5rem',
        }}
      >
        {[
          [data.totalPoints, 'Points'],
          [data.stats?.avgCleanScore ?? 0, 'Avg score'],
          [data.stats?.bestScore ?? 0, 'Best'],
          [data.currentStreak, 'Streak'],
          [data.stats?.cleanSessions ?? 0, 'Clean reps'],
        ].map(([v, l]) => (
          <div key={String(l)} style={statBox}>
            <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{v}</div>
            <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              {l}
            </div>
          </div>
        ))}
      </div>

      {data.skills?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={h2}>Skills</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {data.skills.map((s: string) => (
              <span key={s} style={chip}>
                {s}
              </span>
            ))}
          </div>
        </section>
      )}

      {data.stats?.topFocus?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={h2}>Scenario mastery</h2>
          <ul style={{ color: 'var(--muted)', margin: 0, paddingLeft: '1.1rem' }}>
            {data.stats.topFocus.map((f: { focus: string; count: number }) => (
              <li key={f.focus}>
                {f.focus} · {f.count} clean sessions
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.achievements?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={h2}>Achievements</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.achievements.map((a: { label: string; detail: string }) => (
              <div key={`${a.label}-${a.detail}`} style={rowCard}>
                <strong>{a.label}</strong>
                <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{a.detail}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.tournaments?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={h2}>Tournaments</h2>
          <ul style={{ color: 'var(--muted)', margin: 0, paddingLeft: '1.1rem' }}>
            {data.tournaments.map((t: any) => (
              <li key={t.name}>
                {t.name} · {t.score} pts{t.active ? '' : ' (ended)'}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.recentSessions?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={h2}>Recent practice</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.recentSessions.map((s: any) => (
              <li key={s.id} style={{ ...rowCard, marginBottom: '0.4rem' }}>
                <strong>{s.overallScore}/100</strong> · {s.focusArea} · {s.duration}s
                <div style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                  {new Date(s.createdAt).toLocaleDateString()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.featuredCalls?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={h2}>Featured calls</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.featuredCalls.map(
              (call: {
                id: string;
                title: string | null;
                href: string;
                mediaSrc: string | null;
                durationSec: number | null;
                overallScore: number | null;
                focusArea: string | null;
              }) => (
                <li key={call.id} style={{ ...rowCard, marginBottom: '0.55rem' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                    }}
                  >
                    <strong>{call.title || 'Practice call'}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      {call.overallScore != null ? `${call.overallScore}/100` : null}
                      {call.focusArea ? ` · ${call.focusArea}` : ''}
                      {call.durationSec != null ? ` · ${call.durationSec}s` : ''}
                    </span>
                  </div>
                  {call.mediaSrc ? (
                    <audio
                      controls
                      preload="metadata"
                      style={{ width: '100%', marginTop: '0.55rem' }}
                      src={call.mediaSrc}
                    >
                      Your browser does not support audio.
                    </audio>
                  ) : null}
                  <div style={{ marginTop: '0.45rem' }}>
                    <a href={call.href} style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>
                      Open highlight →
                    </a>
                  </div>
                </li>
              )
            )}
          </ul>
        </section>
      )}

      {data.clipUrls?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={h2}>Highlights</h2>
          <ul style={{ color: 'var(--muted)', paddingLeft: '1.1rem' }}>
            {data.clipUrls.map((url: string) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                  {url.replace(/^https?:\/\//, '').slice(0, 64)}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        {data.openToWork ? (
          <>
            Open to work —{' '}
            <Link href="/sign-up?role=BRAND" style={{ color: 'var(--accent)' }}>
              founders: review talent on Leads
            </Link>{' '}
            after you post a campaign.
          </>
        ) : (
          'Not currently marked open to work.'
        )}
      </p>
    </main>
  );
}

const h2: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.15rem',
  margin: '0 0 0.55rem',
};
const chip: React.CSSProperties = {
  fontSize: '0.8rem',
  padding: '0.25rem 0.55rem',
  borderRadius: 999,
  border: '1px solid var(--line)',
  color: 'var(--accent-2)',
};
const pillAccent: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '0.2rem 0.55rem',
  borderRadius: 999,
  background: 'rgba(var(--accent-2-rgb), 0.15)',
  color: 'var(--accent-2)',
  border: '1px solid rgba(var(--accent-2-rgb), 0.35)',
};
const pillOpen: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 700,
  padding: '0.2rem 0.55rem',
  borderRadius: 999,
  background: 'var(--accent-soft)',
  color: 'var(--accent)',
  border: '1px solid rgba(var(--accent-rgb), 0.4)',
};
const statBox: React.CSSProperties = {
  padding: '0.75rem',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--line)',
  borderRadius: 10,
};
const rowCard: React.CSSProperties = {
  padding: '0.7rem 0.85rem',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--line)',
  borderRadius: 10,
};
