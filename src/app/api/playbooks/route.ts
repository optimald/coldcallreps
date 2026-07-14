import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageTeam } from '@/lib/plans';
import { canManageBrand } from '@/lib/roles';
import {
  DEFAULT_PLAYBOOKS,
  DEFAULT_PLAYBOOK_TITLE,
  defaultPlaybookContent,
  defaultPlaybookTitle,
  getDefaultPlaybook,
} from '@/lib/playbooks/default';
import { sanitizePlaybookContent } from '@/lib/trainer/playbook-context';

/** Seed all starter playbooks when the user has none. Idempotent: skip if count > 0. */
async function ensureDefaultPlaybooks(userId: string) {
  const existing = await prisma.playbook.count({ where: { userId } });
  if (existing > 0) return null;
  await prisma.playbook.createMany({
    data: DEFAULT_PLAYBOOKS.map((pb) => ({
      userId,
      title: pb.title,
      contentJSON: JSON.stringify({ steps: pb.steps }),
    })),
  });
  return true;
}

export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    await ensureDefaultPlaybooks(profile.id);
    const url = new URL(req.url);
    const brandId = url.searchParams.get('brandId');
    const scope = url.searchParams.get('scope'); // personal | brand | all

    if (brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerId: true, slug: true },
      });
      if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const { assertTrainerBrandAccess } = await import('@/lib/trainer-brand-access');
      const access = await assertTrainerBrandAccess(profile, brandId);
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.status });
      }
      const playbooks = await prisma.playbook.findMany({
        where: { brandId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: { brand: { select: { id: true, name: true, slug: true } } },
      });
      return NextResponse.json({ playbooks });
    }

    const personalOrOrg = {
      OR: [{ userId: profile.id }, ...(profile.orgId ? [{ orgId: profile.orgId }] : [])],
    };

    if (scope === 'personal') {
      const playbooks = await prisma.playbook.findMany({
        where: personalOrOrg,
        orderBy: { updatedAt: 'desc' },
        take: 50,
      });
      return NextResponse.json({ playbooks });
    }

    if (scope === 'brand') {
      // Open practice catalog: demos + brand-opted-in playbooks
      const playbooks = await prisma.playbook.findMany({
        where: {
          OR: [
            { brand: { slug: { startsWith: 'demo-' } } },
            { practiceAllowed: true },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: { brand: { select: { id: true, name: true, slug: true } } },
      });
      return NextResponse.json({ playbooks });
    }

    // Default: personal/org + demo + brand-opted-in practice playbooks
    const playbooks = await prisma.playbook.findMany({
      where: {
        OR: [
          ...personalOrOrg.OR,
          { brand: { slug: { startsWith: 'demo-' } } },
          { practiceAllowed: true },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 80,
      include: { brand: { select: { id: true, name: true, slug: true } } },
    });
    return NextResponse.json({ playbooks });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const title = body.title ? String(body.title).trim() : '';
    const templateKey =
      typeof body.template === 'string' && body.template.trim()
        ? body.template.trim().toLowerCase()
        : null;
    const brandId = body.brandId ? String(body.brandId).slice(0, 64) : null;

    if (templateKey) {
      const template = getDefaultPlaybook(templateKey);
      if (!template) {
        return NextResponse.json(
          {
            error: `Unknown template "${templateKey}". Valid keys: ${DEFAULT_PLAYBOOKS.map((p) => p.key).join(', ')}`,
          },
          { status: 400 }
        );
      }
    }

    const useDefault = body.useDefault === true || Boolean(templateKey) || !body.content;
    const content = sanitizePlaybookContent(
      useDefault && !body.content
        ? defaultPlaybookContent(templateKey ?? 'foundation')
        : body.content || {}
    );
    const resolvedTitle =
      title ||
      (templateKey ? defaultPlaybookTitle(templateKey) : useDefault ? DEFAULT_PLAYBOOK_TITLE : '');

    if (!resolvedTitle) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    if (brandId) {
      const brand = await prisma.brand.findUnique({
        where: { id: brandId },
        select: { id: true, ownerId: true },
      });
      if (!brand) return NextResponse.json({ error: 'Brand not found' }, { status: 404 });
      if (!canManageBrand(profile, brand.ownerId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const playbook = await prisma.playbook.create({
        data: {
          userId: profile.id,
          brandId: brand.id,
          orgId: null,
          title: resolvedTitle.slice(0, 160),
          contentJSON: JSON.stringify(content),
        },
        include: { brand: { select: { id: true, name: true, slug: true } } },
      });
      return NextResponse.json({ playbook });
    }

    const wantOrg = body.orgScoped === true;
    if (wantOrg && !canManageTeam(profile)) {
      return NextResponse.json(
        {
          error: 'Org playbooks require the Team plan. Create a personal playbook, or upgrade.',
          code: 'PLAN_REQUIRED',
          requiredPlan: 'TEAM',
        },
        { status: 402 }
      );
    }

    const playbook = await prisma.playbook.create({
      data: {
        userId: profile.id,
        orgId: wantOrg && profile.orgId ? profile.orgId : null,
        title: resolvedTitle.slice(0, 160),
        contentJSON: JSON.stringify(content),
      },
    });
    return NextResponse.json({ playbook });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
