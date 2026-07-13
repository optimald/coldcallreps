import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isOrgAdminForProfile } from '@/lib/plans';
import { brandHref } from '@/lib/brand-context';
import { canManageBrand, isSuperadmin } from '@/lib/roles';
import {
  extractCoachLog,
  formatDuration,
  formatSessionDate,
  scoreColor,
} from '@/lib/trainer/session-utils';
import { FOCUS_LABELS } from '@/lib/product';
import { PageHeader } from '@/components/ui/PagePrimitives';
import SessionResumePick from '@/components/SessionResumePick';
import SessionTranscript from '@/components/SessionTranscript';

export default async function SessionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; brand?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const profile = await requireUser();
  const admin = isSuperadmin(profile);
  const orgAdmin = await isOrgAdminForProfile(profile);

  const session = await prisma.trainerSession.findFirst({
    where: { id },
    include: {
      prospect: { select: { companyName: true } },
      user: { select: { displayName: true, email: true, orgId: true } },
    },
  });
  if (!session) notFound();

  const isOwner = session.userId === profile.id;
  if (!isOwner && !admin) {
    const sameOrg =
      orgAdmin && Boolean(profile.orgId) && session.user?.orgId === profile.orgId;
    let brandOk = false;
    if (session.brandId) {
      const brand = await prisma.brand.findFirst({
        where: { id: session.brandId },
        select: { ownerId: true },
      });
      brandOk = Boolean(brand && canManageBrand(profile, brand.ownerId));
    }
    if (!sameOrg && !brandOk) notFound();
  }

  const clip = await prisma.clip.findFirst({
    where: { userId: session.userId, sessionId: session.id, status: 'ready' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, r2Key: true, mediaUrl: true },
  });
  const audioSrc = clip
    ? clip.mediaUrl ||
      (clip.r2Key ? `/api/clips/media?clipId=${encodeURIComponent(clip.id)}` : null)
    : null;

  let brandMeta: { id: string; slug: string; name: string } | null = null;
  if (session.brandId) {
    brandMeta = await prisma.brand.findFirst({
      where: { id: session.brandId },
      select: { id: true, slug: true, name: true },
    });
  }

  let featuredClipIds: string[] = [];
  if (session.userId === profile.id) {
    const rep = await prisma.repProfile.findUnique({
      where: { userId: profile.id },
      select: { featuredClipIdsJSON: true },
    });
    try {
      featuredClipIds = JSON.parse(rep?.featuredClipIdsJSON || '[]');
    } catch {
      featuredClipIds = [];
    }
  }
  const initiallyFeatured = clip ? featuredClipIds.includes(clip.id) : false;

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
  const title = session.prospect?.companyName || focusLabel;

  let integrityFlags: { code: string; detail: string }[] = [];
  if (session.integrityFlags) {
    try {
      integrityFlags = JSON.parse(session.integrityFlags);
    } catch {
      integrityFlags = [];
    }
  }

  const fromBrand = sp.from === 'brand' && sp.brand;
  const listHref = fromBrand ? brandHref(sp.brand!, 'practice') : '/sessions';
  const listLabel = fromBrand ? 'Practice calls' : 'Past calls';
  const transcriptText = (session.transcript || '').trim();

  return (
    <main className="app-page">
      <PageHeader
        eyebrow={brandMeta?.name || 'Practice session'}
        title={title}
        description={`${formatSessionDate(session.createdAt.toISOString())} · ${formatDuration(session.duration)} · ${focusLabel} · ${session.difficulty}`}
        actions={
          <div className="session-detail__header-actions">
            <SessionResumePick
              clipId={clip?.id || null}
              sessionId={session.id}
              isOwner={session.userId === profile.id}
              initiallyFeatured={initiallyFeatured}
              hasRecording={Boolean(audioSrc)}
            />
            <Link href={listHref} className="btn-ghost">
              ← {listLabel}
            </Link>
          </div>
        }
      />

      {admin && session.userId !== profile.id && (
        <p className="session-detail__admin-banner">
          Superadmin review · {session.user?.displayName || 'Rep'}
          {session.user?.email ? ` · ${session.user.email}` : ''}
        </p>
      )}

      <p className="session-detail__score" style={{ color: scoreColor(session.overallScore) }}>
        {session.overallScore}/100
        <span className="session-detail__pts"> · +{session.pointsEarned} pts</span>
      </p>

      {scorecard?.summary && <p>{scorecard.summary}</p>}

      {audioSrc ? (
        <div className="session-detail__audio">
          <h3>Call recording</h3>
          <audio controls preload="metadata" src={audioSrc} style={{ width: '100%' }}>
            Your browser does not support audio playback.
          </audio>
        </div>
      ) : (
        <p className="muted session-detail__no-audio">No recording available for this session.</p>
      )}

      {integrityFlags.length > 0 && (
        <div className="session-detail__panel">
          <h3>Integrity signals</h3>
          <ul className="muted">
            {integrityFlags.map((f) => (
              <li key={f.code}>{f.detail}</li>
            ))}
          </ul>
        </div>
      )}

      {scorecard?.feedback && (
        <div className="session-detail__feedback">
          <div>
            <h3>Strengths</h3>
            <ul className="muted">
              {(scorecard.feedback.strengths || []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Improve</h3>
            <ul className="muted">
              {(scorecard.feedback.improvements || []).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <h2 className="session-detail__section-title">Transcript</h2>
      {transcriptText ? (
        <SessionTranscript transcript={transcriptText} />
      ) : (
        <p className="muted">No transcript was saved for this session.</p>
      )}

      {coachLog.length > 0 && (
        <>
          <h2 className="session-detail__section-title">Coach log</h2>
          <ul className="muted">
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
