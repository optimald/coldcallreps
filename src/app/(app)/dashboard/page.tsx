import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { formatDuration, formatSessionDate, scoreColor } from '@/lib/trainer/session-utils';
import { FOCUS_LABELS } from '@/lib/product';

export default async function DashboardPage() {
  const profile = await requireUser();
  const sessions = await prisma.trainerSession.findMany({
    where: { userId: profile.id },
    orderBy: { createdAt: 'desc' },
    take: 12,
    include: { prospect: { select: { companyName: true } } },
  });

  let badges: string[] = [];
  try {
    badges = JSON.parse(profile.badges || '[]');
  } catch {
    badges = [];
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', margin: 0 }}>
            Hey {profile.displayName || 'Rep'}
          </h1>
          <p style={{ color: 'var(--muted)', margin: '0.35rem 0 0' }}>
            {profile.minutesRemaining} min left · {profile.totalPoints} pts · {profile.currentStreak}-day streak
          </p>
        </div>
        <Link
          href="/trainer"
          style={{
            alignSelf: 'center',
            background: 'var(--accent)',
            color: '#fff',
            padding: '0.7rem 1.1rem',
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          Start a rep
        </Link>
      </div>

      {badges.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {badges.map((b) => (
            <span
              key={b}
              style={{
                fontSize: '0.8rem',
                padding: '0.3rem 0.65rem',
                borderRadius: 999,
                border: '1px solid var(--line)',
                color: 'var(--accent-2)',
              }}
            >
              {b}
            </span>
          ))}
        </div>
      )}

      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem' }}>Recent sessions</h2>
      {sessions.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No reps yet — hit the trainer and grind.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.85rem 1rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--line)',
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {s.prospect?.companyName ||
                    (FOCUS_LABELS as Record<string, string>)[s.focusArea] ||
                    s.focusArea}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  {formatSessionDate(s.createdAt.toISOString())} · {formatDuration(s.duration)} · +
                  {s.pointsEarned} pts
                </div>
              </div>
              <span style={{ color: scoreColor(s.overallScore), fontWeight: 700 }}>{s.overallScore}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
