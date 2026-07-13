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
    });
    return NextResponse.json({ playbooks, brand });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
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

    if (templateKey && !getDefaultPlaybook(templateKey)) {
      return NextResponse.json({ error: `Unknown template "${templateKey}"` }, { status: 400 });
    }

    const content = sanitizePlaybookContent(
      body.content || defaultPlaybookContent(templateKey ?? 'foundation')
    );
    const resolvedTitle =
      title ||
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
