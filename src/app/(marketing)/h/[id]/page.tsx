import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { FOCUS_LABELS } from '@/lib/product';
import { formatDuration, formatSessionDate, scoreColor } from '@/lib/trainer/session-utils';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';

async function loadHighlight(id: string) {
  const clip = await prisma.clip.findUnique({
    where: { id },
    include: {
      session: {
        include: {
          prospect: { select: { companyName: true } },
          user: {
            select: {
              displayName: true,
              hiringBoardOptIn: true,
              repProfile: { select: { slug: true, verified: true } },
            },
          },
        },
      },
      user: {
        select: {
          displayName: true,
          hiringBoardOptIn: true,
          repProfile: { select: { slug: true, verified: true } },
        },
      },
    },
  });
  if (!clip || clip.status !== 'ready' || !clip.session) return null;
  if (hasBlockingIntegrity(clip.session.integrityFlags)) return null;
  return clip;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const clip = await loadHighlight(id);
  if (!clip?.session) return { title: 'Highlight — Cold Call Reps' };
  const name = clip.user.displayName || 'Rep';
  const score = clip.session.overallScore;
  return {
    title: `${name} · ${score}/100 — Cold Call Reps`,
    description: clip.title || `Practice highlight scored ${score}/100`,
    openGraph: {
      title: `${name} scored ${score}/100`,
      description: clip.title || 'Cold call practice highlight',
    },
  };
}

export default async function PublicHighlightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clip = await loadHighlight(id);
  if (!clip?.session) notFound();

  const session = clip.session;
  let scorecard: {
    summary?: string;
    feedback?: { strengths?: string[]; improvements?: string[] };
    scores?: Record<string, number>;
  } | null = null;
  try {
    scorecard = JSON.parse(session.scorecardJSON);
  } catch {
    scorecard = null;
  }

  const focusLabel =
    (FOCUS_LABELS as Record<string, string>)[session.focusArea] || session.focusArea;
  const slug = clip.user.repProfile?.slug;
  const name = clip.user.displayName || 'Rep';

  // Public: show summary + strengths only — not full transcript
  const strengths = (scorecard?.feedback?.strengths || []).slice(0, 4);

  return (
    <main style={{ maxWidth: 640, margin: '2rem auto', padding: '0 1.25rem' }}>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
        <Link href="/" style={{ color: 'var(--muted)' }}>
          Cold Call Reps
        </Link>
        {' · '}
        Practice highlight
      </p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', margin: '0.5rem 0' }}>
        {clip.title || `${name} · ${focusLabel}`}
      </h1>
      <p style={{ color: 'var(--muted)' }}>
        {slug ? (
          <Link href={`/${slug}`} style={{ color: 'var(--accent)' }}>
            {name}
            {clip.user.repProfile?.verified ? ' ✓' : ''}
          </Link>
        ) : (
          name
        )}
        {' · '}
        {formatSessionDate(session.createdAt.toISOString())} · {formatDuration(session.duration)} ·{' '}
        {focusLabel}
      </p>

      <p style={{ fontSize: '2.4rem', fontWeight: 800, color: scoreColor(session.overallScore), margin: '0.5rem 0' }}>
        {session.overallScore}
        <span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 500 }}>/100</span>
      </p>

      {session.prospect?.companyName && (
        <p style={{ color: 'var(--muted)' }}>Scenario: {session.prospect.companyName}</p>
      )}

      {clip.r2Key && clip.status === 'ready' && (
        <div style={{ margin: '1rem 0' }}>
          <audio controls preload="metadata" style={{ width: '100%' }} src={`/api/clips/media?clipId=${clip.id}`}>
            Your browser does not support audio.
          </audio>
        </div>
      )}

      {scorecard?.summary && <p style={{ lineHeight: 1.55 }}>{scorecard.summary}</p>}

      {strengths.length > 0 && (
        <section style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Strengths</h2>
          <ul style={{ color: 'var(--muted)' }}>
            {strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      {scorecard?.scores && (
        <section style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem' }}>Category scores</h2>
          <ul style={{ color: 'var(--muted)', listStyle: 'none', padding: 0 }}>
            {Object.entries(scorecard.scores).map(([k, v]) => (
              <li key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                <span>{k}</span>
                <strong>{v}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p style={{ marginTop: '2rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
        {clip.user.hiringBoardOptIn ? 'Open to work · ' : ''}
        {slug ? (
          <Link href={`/${slug}`} style={{ color: 'var(--accent)' }}>
            View full profile
          </Link>
        ) : (
          <Link href="/sign-up" style={{ color: 'var(--accent)' }}>
            Practice on Cold Call Reps
          </Link>
        )}
      </p>
    </main>
  );
}
