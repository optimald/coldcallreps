import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isSuperadmin } from '@/lib/roles';

/** Poster (or superadmin) lists applications for a job. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const job = await prisma.jobPost.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (job.posterId !== profile.id && !isSuperadmin(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const applications = await prisma.jobApplication.findMany({
      where: { jobId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            displayName: true,
            totalPoints: true,
            currentStreak: true,
            badges: true,
            repProfile: { select: { slug: true, verified: true } },
          },
        },
      },
    });

    return NextResponse.json({
      applications: applications.map((a) => ({
        id: a.id,
        status: a.status,
        message: a.message,
        createdAt: a.createdAt,
        applicant: {
          displayName: a.user.displayName,
          totalPoints: a.user.totalPoints,
          streak: a.user.currentStreak,
          verified: a.user.repProfile?.verified || false,
          profileSlug: a.user.repProfile?.slug || null,
        },
      })),
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const job = await prisma.jobPost.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (job.posterId !== profile.id && !isSuperadmin(profile)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { applicationId, status } = await req.json();
    if (!applicationId || !['submitted', 'viewed', 'rejected', 'hired'].includes(status)) {
      return NextResponse.json({ error: 'applicationId and valid status required' }, { status: 400 });
    }

    const updated = await prisma.jobApplication.update({
      where: { id: String(applicationId) },
      data: { status: String(status) },
    });
    return NextResponse.json({ application: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
