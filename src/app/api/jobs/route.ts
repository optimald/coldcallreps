import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canPostJobs } from '@/lib/roles';

export async function GET() {
  try {
    const jobs = await prisma.jobPost.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        poster: { select: { displayName: true } },
        _count: { select: { applications: true } },
      },
    });
    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company,
        description: j.description,
        scenarioTags: JSON.parse(j.scenarioTags || '[]'),
        posterName: j.poster.displayName,
        applicationCount: j._count.applications,
        createdAt: j.createdAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    if (!canPostJobs(profile)) {
      return NextResponse.json(
        {
          error: 'Only Recruiter and Brand accounts can post jobs.',
          code: 'ROLE_REQUIRED',
        },
        { status: 403 }
      );
    }
    const body = await req.json();
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    if (!title || !description) {
      return NextResponse.json({ error: 'title and description required' }, { status: 400 });
    }
    const tags = Array.isArray(body.scenarioTags)
      ? body.scenarioTags.map(String).slice(0, 10)
      : [];

    const job = await prisma.jobPost.create({
      data: {
        posterId: profile.id,
        title: title.slice(0, 160),
        company: body.company ? String(body.company).slice(0, 120) : null,
        description: description.slice(0, 8000),
        scenarioTags: JSON.stringify(tags),
        orgId: profile.orgId || null,
      },
    });
    return NextResponse.json({ job });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
