import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { effectiveRole } from '@/lib/roles';

const STATUSES = new Set(['interested', 'passed']);

/**
 * GET — brand's talent swipe list (interested / passed),
 * or SDR received shortlists when `?mine=1`.
 * POST — swipe on an SDR: { toUserId | slug, status: interested|passed, brandId? }
 */
export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const role = effectiveRole(profile);
    const { searchParams } = new URL(req.url);
    const asMine = searchParams.get('mine') === '1';

    if (asMine) {
      // SDR: brands that shortlisted me
      const rows = await prisma.talentInterest.findMany({
        where: { toUserId: profile.id, status: 'interested' },
        orderBy: { updatedAt: 'desc' },
        take: 40,
        include: {
          fromUser: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      });

      const brandIds = [
        ...new Set(rows.map((r) => r.brandId).filter(Boolean) as string[]),
      ];
      const brands =
        brandIds.length > 0
          ? await prisma.brand.findMany({
              where: { id: { in: brandIds } },
              select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true },
            })
          : [];
      const brandById = Object.fromEntries(brands.map((b) => [b.id, b]));

      const ownerIds = [
        ...new Set(
          rows.filter((r) => !r.brandId).map((r) => r.fromUserId)
        ),
      ];
      const ownedFallback =
        ownerIds.length > 0
          ? await prisma.brand.findMany({
              where: { ownerId: { in: ownerIds } },
              orderBy: { createdAt: 'desc' },
              select: { id: true, name: true, slug: true, logoUrl: true, ownerId: true },
            })
          : [];
      const brandByOwner = new Map<string, (typeof ownedFallback)[0]>();
      for (const b of ownedFallback) {
        if (b.ownerId && !brandByOwner.has(b.ownerId)) brandByOwner.set(b.ownerId, b);
      }

      return NextResponse.json({
        interests: rows.map((r) => {
          const brand =
            (r.brandId && brandById[r.brandId]) ||
            brandByOwner.get(r.fromUserId) ||
            null;
          return {
            id: r.id,
            status: r.status,
            brandId: r.brandId,
            updatedAt: r.updatedAt.toISOString(),
            brand: brand
              ? {
                  id: brand.id,
                  name: brand.name,
                  slug: brand.slug,
                  logoUrl: brand.logoUrl,
                }
              : null,
            fromName: r.fromUser.displayName,
          };
        }),
      });
    }

    if (role !== 'BRAND' && role !== 'RECRUITER' && role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Brand desk only' }, { status: 403 });
    }

    const status = searchParams.get('status') || 'interested';
    if (!STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const rows = await prisma.talentInterest.findMany({
      where: { fromUserId: profile.id, status },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        toUser: {
          select: {
            id: true,
            displayName: true,
            hiringHeadline: true,
            totalPoints: true,
            hiringBoardOptIn: true,
            repProfile: { select: { slug: true, verified: true } },
          },
        },
      },
    });

    return NextResponse.json({
      interests: rows.map((r) => ({
        id: r.id,
        status: r.status,
        brandId: r.brandId,
        updatedAt: r.updatedAt.toISOString(),
        rep: {
          id: r.toUser.id,
          displayName: r.toUser.displayName,
          headline: r.toUser.hiringHeadline,
          totalPoints: r.toUser.totalPoints,
          openToWork: r.toUser.hiringBoardOptIn,
          slug: r.toUser.repProfile?.slug || null,
          verified: Boolean(r.toUser.repProfile?.verified),
        },
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('talent interest GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const role = effectiveRole(profile);
    if (role !== 'BRAND' && role !== 'RECRUITER' && role !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Brand desk only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const status = String(body.status || '').trim();
    if (!STATUSES.has(status)) {
      return NextResponse.json(
        { error: 'status must be interested or passed' },
        { status: 400 }
      );
    }

    let toUserId = body.toUserId ? String(body.toUserId).trim() : '';
    const slug = body.slug ? String(body.slug).trim() : '';
    if (!toUserId && slug) {
      const rep = await prisma.repProfile.findUnique({
        where: { slug },
        select: { userId: true },
      });
      toUserId = rep?.userId || '';
    }
    if (!toUserId) {
      return NextResponse.json({ error: 'toUserId or slug required' }, { status: 400 });
    }
    if (toUserId === profile.id) {
      return NextResponse.json({ error: 'Cannot swipe on yourself' }, { status: 400 });
    }

    const target = await prisma.userProfile.findUnique({
      where: { id: toUserId },
      select: { id: true, displayName: true },
    });
    if (!target) {
      return NextResponse.json({ error: 'Rep not found' }, { status: 404 });
    }

    const brandId = body.brandId ? String(body.brandId).trim() : null;

    let brandMeta: { id: string; name: string; slug: string; logoUrl: string | null } | null =
      null;
    if (brandId) {
      brandMeta = await prisma.brand.findFirst({
        where: { id: brandId, ownerId: profile.id },
        select: { id: true, name: true, slug: true, logoUrl: true },
      });
    }
    if (!brandMeta) {
      brandMeta = await prisma.brand.findFirst({
        where: { ownerId: profile.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, slug: true, logoUrl: true },
      });
    }

    const row = await prisma.talentInterest.upsert({
      where: {
        fromUserId_toUserId: { fromUserId: profile.id, toUserId },
      },
      create: {
        fromUserId: profile.id,
        toUserId,
        brandId: brandMeta?.id || brandId,
        status,
      },
      update: {
        status,
        brandId: brandMeta?.id || brandId || undefined,
        updatedAt: new Date(),
      },
    });

    // Soft signal into Direct Connect inbox + email when interested
    if (status === 'interested') {
      const { notifyAsync } = await import('@/lib/notifications/dispatch');
      notifyAsync({
        event: 'talent.interested',
        recipient: { userId: toUserId, displayName: target.displayName },
        brand: brandMeta
          ? {
              id: brandMeta.id,
              name: brandMeta.name,
              slug: brandMeta.slug,
              logoUrl: brandMeta.logoUrl,
            }
          : null,
        payload: {
          ctaUrl: '/gigs',
          ctaLabel: 'View brand deals',
          forAudience: 'sdr',
        },
        fromUserId: profile.id,
        idempotencyKey: `talent.interested:${profile.id}:${toUserId}:${brandMeta?.id || 'none'}`,
      });

      const existing = await prisma.directMessage.findFirst({
        where: {
          fromUserId: profile.id,
          toUserId,
          body: { contains: 'showed interest in your resume' },
        },
        select: { id: true },
      });
      if (!existing) {
        await prisma.directMessage.create({
          data: {
            fromUserId: profile.id,
            toUserId,
            body: `${brandMeta?.name || profile.displayName || 'A brand'} showed interest in your resume on ColdCallReps. Check Brand deals to apply.`,
            status: 'sent',
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      interest: {
        id: row.id,
        status: row.status,
        toUserId: row.toUserId,
        brandId: row.brandId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('talent interest POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
