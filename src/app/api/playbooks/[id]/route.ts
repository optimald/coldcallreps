import { NextResponse } from 'next/server';
import type { UserProfile } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { canManageTeam } from '@/lib/plans';
import { canManageBrand } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { sanitizePlaybookContent } from '@/lib/trainer/playbook-context';

type ProfileAuth = Pick<UserProfile, 'id' | 'orgId' | 'plan' | 'platformRole' | 'email'>;

/** Brand practice: demo, practiceAllowed, manager, or accepted campaign SDR. */
async function canAccess(profile: ProfileAuth, playbookId: string) {
  const playbook = await prisma.playbook.findFirst({
    where: {
      id: playbookId,
      OR: [
        { userId: profile.id },
        ...(profile.orgId ? [{ orgId: profile.orgId }] : []),
        { brandId: { not: null } },
      ],
    },
    include: { brand: { select: { id: true, name: true, slug: true, ownerId: true } } },
  });
  if (!playbook) return null;
  if (!playbook.brandId || !playbook.brand) return playbook;

  if (playbook.brand.slug?.startsWith('demo-') || playbook.practiceAllowed) {
    return playbook;
  }

  const { assertTrainerBrandAccess } = await import('@/lib/trainer-brand-access');
  const access = await assertTrainerBrandAccess(profile, playbook.brandId);
  if (!access.ok) return null;
  return playbook;
}

/** Owner, org manager, or brand manager. */
async function canMutate(profile: ProfileAuth, playbookId: string) {
  const existing = await prisma.playbook.findFirst({
    where: { id: playbookId },
    include: { brand: { select: { ownerId: true } } },
  });
  if (!existing) return null;

  if (existing.brandId && existing.brand) {
    if (canManageBrand(profile, existing.brand.ownerId)) return existing;
    return null;
  }

  if (existing.userId === profile.id) return existing;

  if (
    existing.orgId &&
    profile.orgId &&
    existing.orgId === profile.orgId &&
    canManageTeam(profile)
  ) {
    return existing;
  }

  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const playbook = await canAccess(profile, id);
    if (!playbook) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ playbook });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const existing = await canMutate(profile, id);
    if (!existing) return NextResponse.json({ error: 'Not found or not allowed' }, { status: 404 });

    const body = await req.json();
    const contentJSON =
      body.content !== undefined
        ? JSON.stringify(sanitizePlaybookContent(body.content))
        : undefined;
    const practiceAllowed =
      typeof body.practiceAllowed === 'boolean' ? body.practiceAllowed : undefined;
    const playbook = await prisma.playbook.update({
      where: { id },
      data: {
        title: body.title ? String(body.title).slice(0, 160) : undefined,
        contentJSON,
        ...(practiceAllowed !== undefined ? { practiceAllowed } : {}),
      },
      include: { brand: { select: { id: true, name: true, slug: true } } },
    });
    return NextResponse.json({ playbook });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const existing = await canMutate(profile, id);
    if (!existing) {
      return NextResponse.json({ error: 'Not found or not allowed' }, { status: 404 });
    }
    await prisma.playbook.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
