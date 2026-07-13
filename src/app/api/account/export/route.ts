import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** GDPR-style data export for the signed-in user. */
export async function GET() {
  try {
    const profile = await requireUser();
    const [sessions, applications, messages, clips, certifications] = await Promise.all([
      prisma.trainerSession.findMany({
        where: { userId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          focusArea: true,
          overallScore: true,
          duration: true,
          pointsEarned: true,
          createdAt: true,
        },
      }),
      prisma.jobApplication.findMany({ where: { userId: profile.id } }),
      prisma.directMessage.findMany({
        where: { OR: [{ fromUserId: profile.id }, { toUserId: profile.id }] },
        take: 100,
      }),
      prisma.clip.findMany({ where: { userId: profile.id } }),
      prisma.certification.findMany({ where: { userId: profile.id } }),
    ]);

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      profile: {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        platformRole: profile.platformRole,
        plan: profile.plan,
        minutesRemaining: profile.minutesRemaining,
        totalPoints: profile.totalPoints,
        bountyCredits: profile.bountyCredits,
        createdAt: profile.createdAt,
      },
      sessions,
      applications,
      messages: messages.map((m) => ({
        id: m.id,
        fromUserId: m.fromUserId,
        toUserId: m.toUserId,
        status: m.status,
        createdAt: m.createdAt,
      })),
      clips,
      certifications,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
