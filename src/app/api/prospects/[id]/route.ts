import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { resolveProspectAccess } from '@/lib/prospect-access';

type Ctx = { params: Promise<{ id: string }> };

const TRACKED_FIELDS = [
  'companyName',
  'industry',
  'city',
  'state',
  'phone',
  'website',
  'ownerName',
  'ownerTitle',
  'notes',
  'status',
  'imageUrl',
  'gatekeeperName',
] as const;

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const access = await resolveProspectAccess(profile, id);
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      prospect: access.prospect,
      canEdit: access.canEdit,
      via: access.via,
      showAudit: access.via === 'brand' || access.via === 'superadmin',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const access = await resolveProspectAccess(profile, id);
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const existing = access.prospect;
    const body = await req.json().catch(() => ({}));
    const source = typeof body.source === 'string' ? body.source.slice(0, 40) : 'lead_detail';
    const wrapFollowUp =
      Boolean(body.applyQueueFollowUp) &&
      typeof body.disposition === 'string' &&
      body.disposition.length > 0;

    // SDRs on dialable campaigns: allow wrap notes + queue follow-up only.
    const sdrWrapOnly =
      !access.canEdit &&
      access.via === 'sdr' &&
      (source === 'practice_wrap' || source === 'practice_details' || wrapFollowUp);

    if (!access.canEdit && !sdrWrapOnly) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data: Record<string, unknown> = {};

    if (access.canEdit) {
      if (body.companyName != null) data.companyName = String(body.companyName).trim().slice(0, 160);
      if (body.industry !== undefined)
        data.industry = body.industry ? String(body.industry).slice(0, 80) : null;
      if (body.city !== undefined) data.city = body.city ? String(body.city).slice(0, 80) : null;
      if (body.state !== undefined) data.state = body.state ? String(body.state).slice(0, 40) : null;
      if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).slice(0, 40) : null;
      if (body.website !== undefined)
        data.website = body.website ? String(body.website).slice(0, 300) : null;
      if (body.ownerName !== undefined)
        data.ownerName = body.ownerName ? String(body.ownerName).slice(0, 80) : null;
      if (body.ownerTitle !== undefined)
        data.ownerTitle = body.ownerTitle ? String(body.ownerTitle).slice(0, 80) : null;
      if (body.gatekeeperName !== undefined)
        data.gatekeeperName = body.gatekeeperName ? String(body.gatekeeperName).slice(0, 80) : null;
      if (body.status !== undefined) data.status = String(body.status).slice(0, 32);
      if (body.imageUrl !== undefined)
        data.imageUrl = body.imageUrl ? String(body.imageUrl).slice(0, 500) : null;
    } else if (source === 'practice_details') {
      // SDR inline practice details: contact fields + notes only
      if (body.ownerName !== undefined)
        data.ownerName = body.ownerName ? String(body.ownerName).slice(0, 80) : null;
      if (body.ownerTitle !== undefined)
        data.ownerTitle = body.ownerTitle ? String(body.ownerTitle).slice(0, 80) : null;
      if (body.phone !== undefined) data.phone = body.phone ? String(body.phone).slice(0, 40) : null;
    }

    if (body.notes !== undefined) data.notes = body.notes ? String(body.notes).slice(0, 4000) : null;

    if (access.canEdit && data.companyName === '') {
      return NextResponse.json({ error: 'companyName required' }, { status: 400 });
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const key of TRACKED_FIELDS) {
      if (!(key in data)) continue;
      const from = (existing as Record<string, unknown>)[key] ?? null;
      const to = data[key] ?? null;
      if (String(from ?? '') !== String(to ?? '')) {
        changes[key] = { from, to };
      }
    }

    const prospect =
      Object.keys(data).length > 0
        ? await prisma.prospect.update({
            where: { id },
            data,
            include: {
              brand: { select: { id: true, slug: true, name: true, ownerId: true } },
              campaign: { select: { id: true, title: true } },
            },
          })
        : existing;

    if (wrapFollowUp && (access.canEdit || access.via === 'sdr')) {
      const { applyDispositionFollowUp } = await import('@/lib/lead-queue');
      await applyDispositionFollowUp({
        prospectId: id,
        userId: profile.id,
        outcome: String(body.disposition).slice(0, 40),
        campaignId: existing.campaignId,
      });
    }

    if (Object.keys(changes).length > 0) {
      await writeAudit({
        actorId: profile.id,
        action: 'prospect.update',
        targetType: 'prospect',
        targetId: id,
        meta: {
          source,
          brandId: prospect.brandId || null,
          actorName: profile.displayName || profile.email || profile.id,
          actorEmail: profile.email || null,
          changes,
        },
      });
    }

    return NextResponse.json({ prospect, changes, canEdit: access.canEdit });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const access = await resolveProspectAccess(profile, id);
    if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!access.canEdit || access.via === 'brand') {
      // Brand managers shouldn't hard-delete via this path for now; owners can.
      if (access.via !== 'owner' && access.via !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    await prisma.prospect.delete({ where: { id } });
    await writeAudit({
      actorId: profile.id,
      action: 'prospect.delete',
      targetType: 'prospect',
      targetId: id,
      meta: {
        source: 'api',
        actorName: profile.displayName || profile.email || profile.id,
        actorEmail: profile.email || null,
        brandId: access.prospect.brandId || null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
