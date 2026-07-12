import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrandLeads, campaignLeadWhere, dialableBrandCampaigns } from '@/lib/brand-leads';
import { TRAINING_SOURCE, listTrainingLeads } from '@/lib/training-leads';
import { effectiveRole } from '@/lib/roles';

/** CRM list — personal, brand campaign, dialable, or training (?training=1). */
export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.trim();
    const source = searchParams.get('source');
    const brandId = searchParams.get('brandId')?.trim();
    const campaignId = searchParams.get('campaignId')?.trim();
    const dialable = searchParams.get('dialable') === '1';
    const training = searchParams.get('training') === '1' || source === TRAINING_SOURCE;
    const take = Math.min(parseInt(searchParams.get('limit') || '100', 10) || 100, 200);

    const qFilter = q
      ? {
          OR: [
            { companyName: { contains: q } },
            { city: { contains: q } },
            { industry: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : {};

    // Practice contacts — any signed-in user
    if (training) {
      const role = effectiveRole(profile);
      const prospects = await listTrainingLeads({
        brandId: brandId || undefined,
        take,
        ownerUserId:
          role === 'BRAND' || role === 'RECRUITER' ? profile.id : undefined,
      });
      const filtered = status
        ? prospects.filter((p) => p.status === status)
        : prospects;
      return NextResponse.json({ prospects: filtered, purpose: 'training' });
    }

    // SDR: leads for campaigns they're accepted on (excludes training)
    if (dialable) {
      const campaigns = await dialableBrandCampaigns(profile.id);
      if (campaigns.length === 0) {
        return NextResponse.json({ prospects: [], campaigns: [] });
      }
      const brandIds = [...new Set(campaigns.map((c) => c.brandId))];
      const campaignIds = campaigns.map((c) => c.id);
      const prospects = await prisma.prospect.findMany({
        where: campaignLeadWhere({
          OR: [
            { campaignId: { in: campaignIds } },
            { brandId: { in: brandIds }, campaignId: null },
          ],
          ...(status ? { status } : {}),
          ...qFilter,
        }),
        orderBy: { updatedAt: 'desc' },
        take,
      });
      return NextResponse.json({ prospects, campaigns });
    }

    if (brandId) {
      if (!(await canManageBrandLeads(profile, brandId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const wantsTraining = source === TRAINING_SOURCE;
      const prospects = await prisma.prospect.findMany({
        where: {
          brandId,
          ...(campaignId ? { campaignId } : {}),
          ...(status ? { status } : {}),
          ...(wantsTraining
            ? { source: TRAINING_SOURCE }
            : source
              ? { source }
              : { NOT: { source: TRAINING_SOURCE } }),
          ...qFilter,
        },
        orderBy: { updatedAt: 'desc' },
        take,
      });
      return NextResponse.json({
        prospects,
        purpose: wantsTraining ? 'training' : 'campaign',
      });
    }

    // Personal CRM (reps practicing for themselves) — exclude training seeds
    const prospects = await prisma.prospect.findMany({
      where: {
        userId: profile.id,
        brandId: null,
        NOT: { source: TRAINING_SOURCE },
        ...(status ? { status } : {}),
        ...(source ? { source } : {}),
        ...qFilter,
      },
      orderBy: { updatedAt: 'desc' },
      take,
    });

    return NextResponse.json({ prospects });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const companyName = String(body.companyName || '').trim();
    if (!companyName) {
      return NextResponse.json({ error: 'companyName required' }, { status: 400 });
    }

    const brandId = body.brandId ? String(body.brandId) : null;
    const isTraining =
      body.training === true ||
      body.purpose === 'training' ||
      String(body.source || '') === TRAINING_SOURCE;
    const campaignId = isTraining
      ? null
      : body.campaignId
        ? String(body.campaignId)
        : null;

    if (brandId) {
      if (!(await canManageBrandLeads(profile, brandId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (campaignId) {
        const campaign = await prisma.campaign.findFirst({
          where: { id: campaignId, brandId },
          select: { id: true },
        });
        if (!campaign) {
          return NextResponse.json({ error: 'Campaign not found for brand' }, { status: 400 });
        }
      }
    }

    const prospect = await prisma.prospect.create({
      data: {
        userId: profile.id,
        brandId,
        campaignId,
        companyName: companyName.slice(0, 160),
        industry: body.industry ? String(body.industry).slice(0, 80) : null,
        city: body.city ? String(body.city).slice(0, 80) : null,
        state: body.state ? String(body.state).slice(0, 40) : null,
        phone: body.phone ? String(body.phone).slice(0, 40) : null,
        website: body.website ? String(body.website).slice(0, 300) : null,
        ownerName: body.ownerName ? String(body.ownerName).slice(0, 80) : null,
        ownerTitle: body.ownerTitle ? String(body.ownerTitle).slice(0, 80) : undefined,
        notes: body.notes
          ? String(body.notes).slice(0, 4000)
          : isTraining
            ? 'Training lead — practice only, not a paid campaign dial.'
            : null,
        status: body.status ? String(body.status).slice(0, 32) : 'new',
        imageUrl: body.imageUrl ? String(body.imageUrl).slice(0, 500) : null,
        source: isTraining ? TRAINING_SOURCE : brandId ? 'import' : 'manual',
      },
    });

    return NextResponse.json({ prospect });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PATCH — assign campaign / update fields (brand manager or owner). */
export async function PATCH(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const id = String(body.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await prisma.prospect.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const isOwner = existing.userId === profile.id && !existing.brandId;
    const isBrandMgr =
      existing.brandId && (await canManageBrandLeads(profile, existing.brandId));
    if (!isOwner && !isBrandMgr) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isTraining = existing.source === TRAINING_SOURCE;
    let campaignId =
      body.campaignId === undefined
        ? undefined
        : body.campaignId
          ? String(body.campaignId)
          : null;
    // Training leads stay out of campaign assignment
    if (isTraining) campaignId = null;
    if (campaignId && existing.brandId) {
      const campaign = await prisma.campaign.findFirst({
        where: { id: campaignId, brandId: existing.brandId },
        select: { id: true },
      });
      if (!campaign) {
        return NextResponse.json({ error: 'Campaign not found for brand' }, { status: 400 });
      }
    }

    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        ...(campaignId !== undefined ? { campaignId } : {}),
        ...(body.phone !== undefined ? { phone: body.phone ? String(body.phone).slice(0, 40) : null } : {}),
        ...(body.website !== undefined
          ? { website: body.website ? String(body.website).slice(0, 300) : null }
          : {}),
        ...(body.status !== undefined ? { status: String(body.status).slice(0, 32) } : {}),
        ...(body.notes !== undefined
          ? { notes: body.notes ? String(body.notes).slice(0, 4000) : null }
          : {}),
      },
    });

    return NextResponse.json({ prospect });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
