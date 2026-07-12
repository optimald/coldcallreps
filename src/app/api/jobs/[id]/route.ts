import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await prisma.jobPost.findUnique({
      where: { id },
      include: {
        poster: {
          select: {
            id: true,
            displayName: true,
            repProfile: { select: { slug: true } },
          },
        },
        _count: { select: { applications: true } },
      },
    });
    if (!job || !job.active) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let applied = false;
    const { userId } = await auth();
    if (userId) {
      const app = await prisma.jobApplication.findUnique({
        where: { jobId_userId: { jobId: job.id, userId } },
      });
      applied = Boolean(app);
    }

    return NextResponse.json({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        scenarioTags: JSON.parse(job.scenarioTags || '[]'),
        posterName: job.poster.displayName,
        posterSlug: job.poster.repProfile?.slug || null,
        posterId: job.poster.id,
        applicationCount: job._count.applications,
        createdAt: job.createdAt,
        applied,
      },
    });
  } catch (error: any) {
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
    if (job.posterId !== profile.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json();
    const updated = await prisma.jobPost.update({
      where: { id },
      data: {
        active: typeof body.active === 'boolean' ? body.active : undefined,
        title: body.title ? String(body.title).slice(0, 160) : undefined,
        description: body.description ? String(body.description).slice(0, 8000) : undefined,
      },
    });
    return NextResponse.json({ job: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
