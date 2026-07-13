import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { effectiveRole, isSuperadmin } from '@/lib/roles';
import { hasBlockingIntegrity } from '@/lib/integrity-gate';
import { hasPaidRecruiterAccess } from '@/lib/plans';

export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const seat = await prisma.recruiterSeat.findUnique({ where: { userId: profile.id } });
    const paid = hasPaidRecruiterAccess(profile, seat);
    const { searchParams } = new URL(req.url);
    const verifiedOnly = searchParams.get('verified') === '1';
    const minScore = parseInt(searchParams.get('minScore') || '0', 10) || 0;

    if (!paid) {
      return NextResponse.json({
        seat,
        candidates: [],
        role: effectiveRole(profile),
        paidAccess: false,
        notice: 'Switch to the Recruiter role to unlock the desk (free for now).',
      });
    }

    const candidates = await prisma.userProfile.findMany({
      where: {
        hiringBoardOptIn: true,
        ...(verifiedOnly ? { repProfile: { verified: true } } : {}),
      },
      orderBy: { totalPoints: 'desc' },
      take: 60,
      select: {
        id: true,
        displayName: true,
        hiringHeadline: true,
        hiringBio: true,
        totalPoints: true,
        badges: true,
        certifications: { select: { label: true, score: true }, take: 5 },
        repProfile: { select: { slug: true, verified: true } },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 6,
          select: { overallScore: true, integrityFlags: true, focusArea: true },
        },
      },
    });

    const filtered = candidates
      .map((c) => {
        const clean = c.sessions.filter((s) => !hasBlockingIntegrity(s.integrityFlags));
        const avg = clean.length
          ? Math.round(clean.reduce((a, s) => a + s.overallScore, 0) / clean.length)
          : 0;
        return {
          id: c.id,
          displayName: c.displayName,
          hiringHeadline: c.hiringHeadline,
          hiringBio: c.hiringBio,
          totalPoints: c.totalPoints,
          badges: (() => {
            try {
              return JSON.parse(c.badges || '[]');
            } catch {
              return [];
            }
          })(),
          profileSlug: c.repProfile?.slug || null,
          verified: c.repProfile?.verified || false,
          avgCleanScore: avg,
          certifications: c.certifications,
          topFocus: clean[0]?.focusArea || null,
        };
      })
      .filter((c) => c.avgCleanScore >= minScore)
      .slice(0, 30);

    return NextResponse.json({
      seat,
      candidates: filtered,
      role: effectiveRole(profile),
      paidAccess: hasPaidRecruiterAccess(profile, seat),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Update company / activate free recruiter seat. */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const company = body.company ? String(body.company).slice(0, 120) : null;

    const role = effectiveRole(profile);
    const allowed =
      isSuperadmin(profile) ||
      role === 'RECRUITER' ||
      profile.plan === 'RECRUITER' ||
      hasPaidRecruiterAccess(profile, await prisma.recruiterSeat.findUnique({ where: { userId: profile.id } }));

    if (!allowed) {
      return NextResponse.json(
        {
          error: 'Switch to the Recruiter role in Settings to activate the desk (free for now).',
          code: 'ROLE_REQUIRED',
        },
        { status: 403 }
      );
    }

    const updated = await prisma.recruiterSeat.upsert({
      where: { userId: profile.id },
      create: {
        userId: profile.id,
        company,
        active: true,
        paid: true,
        creditsRemaining: 100,
      },
      update: {
        company: company ?? undefined,
        active: true,
        paid: true,
      },
    });

    // Ensure role is recruiter when activating from Free/Starter
    if (profile.platformRole !== 'RECRUITER' && profile.platformRole !== 'SUPERADMIN') {
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { platformRole: 'RECRUITER' },
      });
    }
    if (profile.platformRole !== 'RECRUITER' && profile.platformRole !== 'SUPERADMIN') {
      await prisma.userProfile.update({
        where: { id: profile.id },
        data: { platformRole: 'RECRUITER' },
      });
    }

    return NextResponse.json({
      seat: updated,
      notice: 'Recruiter seat updated.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
