'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function PublicTeamPage({ slug }: { slug: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/team/${slug}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Not found');
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <main style={{ padding: '3rem 1.5rem', maxWidth: 800, margin: '0 auto' }}>
        <p style={{ color: 'var(--muted)' }}>{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={{ padding: '3rem 1.5rem', maxWidth: 800, margin: '0 auto' }}>
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </main>
    );
  }

  return (
    <main style={{ padding: '3rem 1.5rem 5rem', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.1rem', margin: 0 }}>
          {data.name}
        </h1>
        {data.openToHire && (
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.2rem 0.55rem',
              borderRadius: 999,
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid rgba(var(--accent-rgb), 0.4)',
            }}
          >
            Hiring
          </span>
        )}
      </div>
      <p style={{ color: 'var(--muted)' }}>coldcallreps.com/{data.slug}</p>
      {(data.publicBio || data.description) && (
        <p style={{ lineHeight: 1.65 }}>{data.publicBio || data.description}</p>
      )}
      {data.websiteUrl && (
        <p>
          <a href={data.websiteUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            {data.websiteUrl}
          </a>
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.65rem',
          margin: '1.25rem 0',
        }}
      >
        {[
          [data.stats.members, 'Members'],
          [data.stats.teamPoints, 'Team pts'],
          [data.stats.openToWork, 'Open to work'],
          data.stats.poolMinutes != null ? [data.stats.poolMinutes, 'Pool min'] : null,
        ]
          .filter(Boolean)
          .map((row) => {
            const [v, l] = row as [number, string];
            return (
              <div
                key={String(l)}
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                }}
              >
                <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{v}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                  {l}
                </div>
              </div>
            );
          })}
      </div>

      {data.curricula?.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>Academy tracks</h2>
          <ul style={{ color: 'var(--muted)' }}>
            {data.curricula.map((c: any) => (
              <li key={c.title}>
                {c.title}
                {c.focusAreas?.length ? ` · ${c.focusAreas.join(', ')}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem' }}>Team roster</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {data.members.map((m: any, i: number) => (
            <div
              key={`${m.displayName}-${i}`}
              style={{
                padding: '0.85rem 1rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--line)',
                borderRadius: 10,
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <strong>{m.displayName || 'Rep'}</strong>
                {m.verified && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-2)' }}>Verified</span>
                )}
                {m.openToWork && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Open to work</span>
                )}
                <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{m.role}</span>
              </div>
              {m.headline && <div style={{ marginTop: '0.2rem' }}>{m.headline}</div>}
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                {m.totalPoints} pts · avg {m.avgCleanScore} · streak {m.streak}
                {m.profileSlug && (
                  <>
                    {' '}
                    ·{' '}
                    <Link href={`/${m.profileSlug}`} style={{ color: 'var(--accent)' }}>
                      profile
                    </Link>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
