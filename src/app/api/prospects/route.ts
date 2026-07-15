import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  canManageBrandLeads,
  campaignLeadWhere,
  dialableBrandCampaigns,
  PROSPECT_DIAL_SELECT,
  PROSPECT_LIST_SELECT,
} from '@/lib/brand-leads';
import {
  TRAINING_SOURCE,
  ensureTrainingLeadsAvailable,
  listTrainingLeads,
} from '@/lib/training-leads';
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
    const fields = searchParams.get('fields') || 'list';
    const listOnly = fields === 'list' || fields === 'compact';
    const take = Math.min(
      parseInt(searchParams.get('limit') || (listOnly ? '50' : '100'), 10) || 50,
      200
    );
    const skip = Math.max(
      parseInt(searchParams.get('skip') || searchParams.get('offset') || '0', 10) || 0,
      0
    );
    const prospectSelect = dialable
      ? PROSPECT_DIAL_SELECT
      : listOnly
        ? PROSPECT_LIST_SELECT
        : undefined;

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

    // Practice contacts — any signed-in user (demo brands); private brand training needs manage rights
    if (training) {
      const role = effectiveRole(profile);
      if (brandId) {
        const brand = await prisma.brand.findUnique({
          where: { id: brandId },
          select: { id: true, slug: true },
        });
        if (!brand) {
          return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        const demoOk = Boolean(brand.slug?.startsWith('demo-'));
        if (!demoOk && !(await canManageBrandLeads(profile, brandId))) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      // SDRs always get a live practice queue — seed platform demos if empty.
      if (!brandId && role !== 'BRAND' && role !== 'RECRUITER') {
        try {
          await ensureTrainingLeadsAvailable();
        } catch (e) {
          console.warn('[prospects] ensureTrainingLeadsAvailable failed', e);
        }
      }
      const { prospects, hasMore, total } = await listTrainingLeads({
        brandId: brandId || undefined,
        take,
        skip,
        ownerUserId:
          role === 'BRAND' || role === 'RECRUITER' ? profile.id : undefined,
        // Shared practice queue: fixed window of 8 per SDR (no catalog paging).
        practiceQueueUserId:
          !brandId && role !== 'BRAND' && role !== 'RECRUITER'
            ? profile.id
            : undefined,
      });
      const filtered = status
        ? prospects.filter((p) => p.status === status)
        : prospects;
      return NextResponse.json({
        prospects: filtered,
        purpose: 'training',
        hasMore,
        total,
        skip,
      });
    }

    // SDR: leads for campaigns they're accepted on (excludes training)
    if (dialable) {
      const campaigns = await dialableBrandCampaigns(profile.id);
      if (campaigns.length === 0) {
        return NextResponse.json({ prospects: [], campaigns: [], hasMore: false, total: 0, skip });
      }
      // Only leads assigned to campaigns this SDR is accepted on — no brand-wide
      // unassigned pool (prevents reading another campaign's unassigned CRM).
      const campaignIds = campaigns.map((c) => c.id);
      const where = campaignLeadWhere({
        campaignId: { in: campaignIds },
        ...(status ? { status } : {}),
        ...qFilter,
      });
      const [total, prospects] = await Promise.all([
        prisma.prospect.count({ where }),
        prisma.prospect.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take,
          skip,
          select: prospectSelect,
        }),
      ]);
      const slimCampaigns = campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        brandId: c.brandId,
        brandName: c.brand?.name ?? null,
        packId: c.packId,
        playbookId: c.playbookId,
        status: c.status,
      }));
      return NextResponse.json({
        prospects,
        campaigns: slimCampaigns,
        hasMore: skip + prospects.length < total,
        total,
        skip,
      });
    }

    if (brandId) {
      if (!(await canManageBrandLeads(profile, brandId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const wantsTraining = source === TRAINING_SOURCE;
      const where = {
        brandId,
        ...(campaignId ? { campaignId } : {}),
        ...(status ? { status } : {}),
        ...(wantsTraining
          ? { source: TRAINING_SOURCE }
          : source
            ? { source }
            : { NOT: { source: TRAINING_SOURCE } }),
        ...qFilter,
      };
      const [total, prospects] = await Promise.all([
        prisma.prospect.count({ where }),
        prisma.prospect.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          take,
          skip,
          ...(prospectSelect ? { select: prospectSelect } : {}),
        }),
      ]);
      return NextResponse.json({
        prospects,
        purpose: wantsTraining ? 'training' : 'campaign',
        hasMore: skip + prospects.length < total,
        total,
        skip,
      });
    }

    // Personal CRM (reps practicing for themselves) — exclude training seeds
    const where = {
      userId: profile.id,
      brandId: null,
      NOT: { source: TRAINING_SOURCE },
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...qFilter,
    };
    const [total, prospects] = await Promise.all([
      prisma.prospect.count({ where }),
      prisma.prospect.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take,
        skip,
        ...(prospectSelect ? { select: prospectSelect } : {}),
      }),
    ]);

    return NextResponse.json({
      prospects,
      hasMore: skip + prospects.length < total,
      total,
      skip,
    });
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
      if (!isTraining && !campaignId) {
        return NextResponse.json(
          { error: 'campaignId required — enroll the lead in a campaign' },
          { status: 400 }
        );
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
        source: isTraining
          ? TRAINING_SOURCE
          : body.source === 'import'
            ? 'import'
            : body.source === 'maps'
              ? 'maps'
              : 'manual',
      },
    });

    return NextResponse.json({ prospect });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    if (
      !isTraining &&
      existing.brandId &&
      campaignId === null
    ) {
      return NextResponse.json(
        { error: 'campaignId required — brand leads must stay enrolled in a campaign' },
        { status: 400 }
      );
    }
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

    // Notify active SDRs when a lead is newly assigned to a campaign
    if (
      campaignId &&
      campaignId !== existing.campaignId &&
      existing.brandId
    ) {
      try {
        const { notifyAsync } = await import('@/lib/notifications');
        const campaign = await prisma.campaign.findUnique({
          where: { id: campaignId },
          select: {
            id: true,
            title: true,
            brand: { select: { id: true, name: true, slug: true, logoUrl: true } },
          },
        });
        if (campaign) {
          const apps = await prisma.campaignApplication.findMany({
            where: {
              campaignId,
              status: { in: ['ACTIVE', 'ACCEPTED'] },
            },
            select: {
              user: { select: { id: true, email: true, displayName: true } },
            },
            take: 50,
          });
          for (const app of apps) {
            notifyAsync({
              event: 'lead.assigned',
              recipient: {
                userId: app.user.id,
                email: app.user.email,
                displayName: app.user.displayName,
              },
              brand: campaign.brand,
              payload: {
                campaignTitle: campaign.title,
                campaignId: campaign.id,
                companyName: prospect.companyName,
                ctaUrl: '/cold_calls',
                forAudience: 'sdr',
              },
              idempotencyKey: `lead.assigned:${prospect.id}:${app.user.id}`,
            });
          }
        }
      } catch (e) {
        console.warn('[prospects] lead.assigned notify failed', e);
      }
    }

    return NextResponse.json({ prospect });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
