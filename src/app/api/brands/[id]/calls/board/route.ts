import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';

const ACTIVE_STATUSES = ['initiated', 'ringing', 'in-progress'];
const PAST_STATUSES = ['completed', 'failed', 'no_answer'];

/** GET /api/brands/[id]/calls/board — Upcoming / Active / Past for brand live desk. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const brand = await prisma.brand.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, slug: true, name: true, ownerId: true },
    });
    if (!brand) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canManageBrand(profile, brand.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [bookings, callbackLeads, activeLogs, pastLogs] = await Promise.all([
      prisma.calendarBooking.findMany({
        where: {
          brandId: brand.id,
          startsAt: { gte: now },
        },
        orderBy: { startsAt: 'asc' },
        take: 40,
      }),
      prisma.prospect.findMany({
        where: {
          brandId: brand.id,
          callbackLockedUntil: { gt: now },
          callbackLockedByUserId: { not: null },
        },
        orderBy: { callbackLockedUntil: 'asc' },
        take: 40,
        select: {
          id: true,
          companyName: true,
          ownerName: true,
          phone: true,
          campaignId: true,
          callbackLockedUntil: true,
          callbackLockedByUserId: true,
          callbackLockedBy: {
            select: { id: true, displayName: true },
          },
        },
      }),
      prisma.callLog.findMany({
        where: {
          brandId: brand.id,
          status: { in: ACTIVE_STATUSES },
        },
        orderBy: { updatedAt: 'desc' },
        take: 40,
        include: {
          user: { select: { id: true, displayName: true } },
          prospect: {
            select: { id: true, companyName: true, ownerName: true, phone: true },
          },
        },
      }),
      prisma.callLog.findMany({
        where: {
          brandId: brand.id,
          OR: [
            { status: { in: PAST_STATUSES }, createdAt: { gte: weekAgo } },
            {
              status: { in: PAST_STATUSES },
              createdAt: { gte: startOfDay },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          user: { select: { id: true, displayName: true } },
          prospect: {
            select: { id: true, companyName: true, ownerName: true, phone: true },
          },
        },
      }),
    ]);

    const campaignIds = [
      ...new Set(
        [
          ...bookings.map((b) => b.campaignId).filter(Boolean),
          ...callbackLeads.map((p) => p.campaignId).filter(Boolean),
          ...activeLogs.map((c) => c.campaignId).filter(Boolean),
          ...pastLogs.map((c) => c.campaignId).filter(Boolean),
        ] as string[]
      ),
    ];
    const campaigns =
      campaignIds.length > 0
        ? await prisma.campaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, title: true },
          })
        : [];
    const campaignTitle = Object.fromEntries(campaigns.map((c) => [c.id, c.title]));

    const creatorIds = [...new Set(bookings.map((b) => b.createdByUserId))];
    const creators =
      creatorIds.length > 0
        ? await prisma.userProfile.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, displayName: true },
          })
        : [];
    const creatorName = Object.fromEntries(creators.map((u) => [u.id, u.displayName]));

    const upcoming = [
      ...bookings.map((b) => ({
        id: `booking-${b.id}`,
        kind: 'booking' as const,
        title: b.title,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        meetLink: b.meetLink,
        htmlLink: b.htmlLink,
        campaignId: b.campaignId,
        campaignTitle: b.campaignId ? campaignTitle[b.campaignId] || null : null,
        sdrName: creatorName[b.createdByUserId] || null,
        sdrId: b.createdByUserId,
        companyName: null as string | null,
        prospectId: null as string | null,
      })),
      ...callbackLeads.map((p) => ({
        id: `callback-${p.id}`,
        kind: 'callback' as const,
        title: `Callback · ${p.companyName}`,
        startsAt: p.callbackLockedUntil!.toISOString(),
        endsAt: null as string | null,
        meetLink: null as string | null,
        htmlLink: null as string | null,
        campaignId: p.campaignId,
        campaignTitle: p.campaignId ? campaignTitle[p.campaignId] || null : null,
        sdrName: p.callbackLockedBy?.displayName || null,
        sdrId: p.callbackLockedByUserId,
        companyName: p.companyName,
        prospectId: p.id,
      })),
    ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));

    const mapCall = (c: (typeof activeLogs)[number]) => ({
      id: c.id,
      status: c.status,
      direction: c.direction,
      outcome: c.outcome,
      duration: c.duration,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      campaignId: c.campaignId,
      campaignTitle: c.campaignId ? campaignTitle[c.campaignId] || null : null,
      sdrName: c.user?.displayName || null,
      sdrId: c.userId,
      companyName: c.prospect?.companyName || null,
      contactName: c.prospect?.ownerName || null,
      prospectId: c.prospectId,
      toNumber: c.toNumber,
      fromNumber: c.fromNumber,
    });

    // Dedupe past by id (OR above may overlap)
    const pastMap = new Map(pastLogs.map((c) => [c.id, mapCall(c)]));

    return NextResponse.json({
      brand: { id: brand.id, slug: brand.slug, name: brand.name },
      upcoming,
      active: activeLogs.map(mapCall),
      past: [...pastMap.values()],
      polledAt: now.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
