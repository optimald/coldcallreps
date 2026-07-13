import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';
import {
  DEFAULT_PLAYBOOK_TITLE,
  defaultPlaybookContent,
  getDefaultPlaybook,
} from '@/lib/playbooks/default';
import { sanitizePlaybookContent } from '@/lib/trainer/playbook-context';
import { summarizePlaybookContent } from '@/lib/playbooks/summary';

async function loadBrand(idOrSlug: string) {
  return prisma.brand.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, ownerId: true, name: true, slug: true },
  });
}

/** List brand playbooks — any signed-in user (practice content). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    const brand = await loadBrand(id);
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const playbooks = await prisma.playbook.findMany({
      where: { brandId: brand.id },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        _count: { select: { campaigns: true } },
      },
    });

    return NextResponse.json({
      playbooks: playbooks.map((p) => {
        const summary = summarizePlaybookContent(p.contentJSON);
        return {
          id: p.id,
          title: p.title,
          brandId: p.brandId,
          updatedAt: p.updatedAt.toISOString(),
          createdAt: p.createdAt.toISOString(),
          campaignCount: p._count.campaigns,
          ...summary,
        };
      }),
      brand,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Create a brand playbook — brand managers only. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await loadBrand(id);
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title ? String(body.title).trim() : '';
    const templateKey =
      typeof body.template === 'string' && body.template.trim()
        ? body.template.trim().toLowerCase()
        : null;
    const cloneFromId =
      typeof body.cloneFromId === 'string' && body.cloneFromId.trim()
        ? body.cloneFromId.trim()
        : null;

    if (templateKey && !getDefaultPlaybook(templateKey)) {
      return NextResponse.json({ error: `Unknown template "${templateKey}"` }, { status: 400 });
    }

    let contentSource: unknown = body.content;
    let cloneTitle: string | null = null;
    if (cloneFromId) {
      const source = await prisma.playbook.findFirst({
        where: {
          id: cloneFromId,
          OR: [
            { userId: profile.id },
            { brand: { ownerId: profile.id } },
            { brandId: null, userId: profile.id },
          ],
        },
        select: { title: true, contentJSON: true },
      });
      if (!source) {
        return NextResponse.json({ error: 'Source playbook not found' }, { status: 404 });
      }
      try {
        contentSource = JSON.parse(source.contentJSON || '{}');
      } catch {
        contentSource = {};
      }
      cloneTitle = source.title;
    }

    const content = sanitizePlaybookContent(
      contentSource || defaultPlaybookContent(templateKey ?? 'foundation')
    );
    const resolvedTitle =
      title ||
      (cloneTitle ? `${cloneTitle} (copy)` : null) ||
      (templateKey ? getDefaultPlaybook(templateKey)!.title : DEFAULT_PLAYBOOK_TITLE);

    if (!resolvedTitle) {
      return NextResponse.json({ error: 'title required' }, { status: 400 });
    }

    const playbook = await prisma.playbook.create({
      data: {
        brandId: brand.id,
        userId: profile.id,
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
