import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';

/**
 * GET /api/brands/[id]/pipeline/jobs
 * List recent PipelineJob rows for the brand (optional ?campaignId=).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, ownerId: true },
    });
    if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId) && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const campaignId = searchParams.get('campaignId')?.trim() || null;
    const take = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 25)));

    const jobs = await prisma.pipelineJob.findMany({
      where: {
        brandId: brand.id,
        ...(campaignId ? { campaignId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        campaign: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ jobs });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('[pipeline/jobs]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to load jobs' },
      { status: 500 }
    );
  }
}
