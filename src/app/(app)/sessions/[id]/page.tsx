import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isOrgAdminForProfile } from '@/lib/plans';
import { isSuperadmin } from '@/lib/roles';
import {
  extractCoachLog,
  formatDuration,
  formatSessionDate,
  scoreColor,
} from '@/lib/trainer/session-utils';
import { FOCUS_LABELS } from '@/lib/product';

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireUser();
  const admin = isSuperadmin(profile);
  const orgAdmin = await isOrgAdminForProfile(profile);

  const session = await prisma.trainerSession.findFirst({
    where: admin
      ? { id }
      : orgAdmin && profile.orgId
        ? { id, user: { orgId: profile.orgId } }
        : { id, userId: profile.id },
    include: {
      prospect: { select: { companyName: true } },
      user: { select: { displayName: true, email: true, orgId: true } },
    },
  });
  if (!session) notFound();

  const clip = await prisma.clip.findFirst({
    where: { userId: session.userId, sessionId: session.id, status: 'ready' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, r2Key: true, mediaUrl: true },
  });
  const audioSrc = clip
    ? clip.mediaUrl ||
      (clip.r2Key ? `/api/clips/media?clipId=${encodeURIComponent(clip.id)}` : null)
    : null;

  let scorecard: {
    overallScore?: number;
    summary?: string;
    scores?: Record<string, number>;
    feedback?: { strengths?: string[]; improvements?: string[] };
  } | null = null;
  try {
    scorecard = JSON.parse(session.scorecardJSON);
  } catch {
    scorecard = null;
  }

  const coachLog = extractCoachLog(session.coachLogJSON, session.transcript);
  const focusLabel =
    (FOCUS_LABELS as Record<string, string>)[session.focusArea] || session.focusArea;

  let integrityFlags: { code: string; detail: string }[] = [];
  if (session.integrityFlags) {
    try {
      integrityFlags = JSON.parse(session.integrityFlags);
    } catch {
      integrityFlags = [];
    }
  }

  return (
    <main className="app-page">
      <p style={{ marginBottom: '0.75rem' }}>
        <Link href={admin ? '/admin' : '/dashboard'} style={{ color: 'var(--muted)' }}>
          ← {admin ? 'Admin' : 'Dashboard'}
        </Link>
      </p>
      {admin && session.userId !== profile.id && (
        <p
          style={{
            color: 'var(--accent-2)',
            fontSize: '0.85rem',
            marginBottom: '0.75rem',
            padding: '0.5rem 0.75rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line)',
            borderRadius: 8,
          }}
        >
          Superadmin review · {session.user?.displayName || 'Rep'}
          {session.user?.email ? ` · ${session.user.email}` : ''}
        </p>
      )}
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', margin: 0 }}>
        {session.prospect?.companyName || focusLabel}
      </h1>
      <p style={{ color: 'var(--muted)' }}>
        {formatSessionDate(session.createdAt.toISOString())} · {formatDuration(session.duration)} ·{' '}
        {focusLabel} · {session.difficulty}
      </p>

      <p style={{ fontSize: '2rem', fontWeight: 800, color: scoreColor(session.overallScore) }}>
        {session.overallScore}/100
        <span style={{ fontSize: '1rem', color: 'var(--muted)', fontWeight: 500 }}>
          {' '}
          · +{session.pointsEarned} pts
        </span>
      </p>

      {scorecard?.summary && <p>{scorecard.summary}</p>}

      {audioSrc && (
        <div
          style={{
            margin: '1.25rem 0',
            padding: '1rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line)',
            borderRadius: 12,
          }}
        >
          <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.55rem' }}>Call recording</h3>
          <audio controls preload="metadata" src={audioSrc} style={{ width: '100%' }}>
            Your browser does not support audio playback.
          </audio>
        </div>
      )}

      {integrityFlags.length > 0 && (
        <div
          style={{
            margin: '1rem 0',
            padding: '0.85rem 1rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--line)',
            borderRadius: 10,
          }}
        >
          <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.4rem' }}>Integrity signals</h3>
          <ul style={{ color: 'var(--muted)', margin: 0, paddingLeft: '1.1rem' }}>
            {integrityFlags.map((f) => (
              <li key={f.code}>{f.detail}</li>
            ))}
          </ul>
        </div>
      )}

      {scorecard?.feedback && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1rem',
            margin: '1.25rem 0',
          }}
        >
          <div>
            <h3 style={{ fontSize: '1rem' }}>Strengths</h3>
            <ul style={{ color: 'var(--muted)' }}>
              {(scorecard.feedback.strengths || []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem' }}>Improve</h3>
            <ul style={{ color: 'var(--muted)' }}>
              {(scorecard.feedback.improvements || []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>Transcript</h2>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--line)',
          borderRadius: 10,
          padding: '1rem',
          fontSize: '0.9rem',
          lineHeight: 1.5,
          color: 'var(--muted)',
        }}
      >
        {session.transcript}
      </pre>

      {coachLog.length > 0 && (
        <>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginTop: '1.5rem' }}>
            Coach log
          </h2>
          <ul style={{ color: 'var(--muted)' }}>
            {coachLog.map((c, i) => (
              <li key={`${c.atSeconds}-${i}`}>
                [{c.atSeconds}s] After &quot;{c.prospectText}&quot; → {c.suggestion}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
