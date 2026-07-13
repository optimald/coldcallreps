import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function dollars(cents: number) {
  return `$${(Math.abs(cents) / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

function describeEntry(opts: {
  type: string;
  amountCents: number;
  note: string | null;
  campaignTitle: string | null;
  prospectName: string | null;
  repName: string | null;
}): string {
  const amt = dollars(opts.amountCents);
  const campaign = opts.campaignTitle || 'campaign';

  switch (opts.type) {
    case 'FUND':
      return opts.campaignTitle
        ? `Credited ${amt} on ${campaign} to fund the campaign`
        : opts.note?.includes('Stripe')
          ? `Credited ${amt} to escrow wallet`
          : opts.note || `Credited ${amt} to escrow wallet`;
    case 'ESCROW_LOCK':
      return `Debited ${amt} — locked to ${campaign}`;
    case 'ESCROW_RELEASE': {
      const lead = opts.prospectName || 'lead';
      const rep = opts.repName || 'rep';
      return `Goal met for ${lead} with ${rep} — ${amt} debit on ${campaign}`;
    }
    case 'ESCROW_REFUND':
      return `Credited ${amt} — escrow refunded from ${campaign}`;
    case 'ADJUSTMENT':
      return opts.note || `Adjustment ${amt}`;
    default:
      return opts.note || `${opts.type} ${amt}`;
  }
}

/**
 * GET /api/billing/ledger
 * Cross-brand campaign escrow ledger for the signed-in brand owner.
 * Query: ?brandId= &campaignId=
 */
export async function GET(req: NextRequest) {
  try {
    const profile = await requireUser();
    const brandFilter = String(req.nextUrl.searchParams.get('brandId') || '').trim();
    const campaignFilter = String(req.nextUrl.searchParams.get('campaignId') || '').trim();

    const allBrands = await prisma.brand.findMany({
      where:
        profile.platformRole === 'SUPERADMIN'
          ? undefined
          : { ownerId: profile.id },
      select: {
        id: true,
        slug: true,
        name: true,
        wallet: { select: { id: true, balanceCents: true } },
        campaigns: {
          select: { id: true, title: true, status: true, escrowLockedCents: true, budgetCents: true },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        },
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    // Ledger scope can narrow entries; wallet/campaign desks stay account-wide.
    const brands = brandFilter
      ? allBrands.filter((b) => b.id === brandFilter || b.slug === brandFilter)
      : allBrands;

    const walletIds = brands.map((b) => b.wallet?.id).filter(Boolean) as string[];
    const brandByWallet = new Map(
      brands.filter((b) => b.wallet).map((b) => [b.wallet!.id, b])
    );

    const ledgerWhere: {
      walletId?: { in: string[] };
      campaignId?: string;
    } = {};
    if (walletIds.length > 0) ledgerWhere.walletId = { in: walletIds };
    if (campaignFilter) ledgerWhere.campaignId = campaignFilter;

    const rawLedger =
      walletIds.length === 0
        ? []
        : await prisma.walletLedger.findMany({
            where: ledgerWhere,
            orderBy: { createdAt: 'desc' },
            take: 200,
          });

    const campaignIds = [
      ...new Set(rawLedger.map((l) => l.campaignId).filter(Boolean) as string[]),
    ];
    const claimIds = [
      ...new Set(rawLedger.map((l) => l.claimId).filter(Boolean) as string[]),
    ];

    const [campaigns, claims] = await Promise.all([
      campaignIds.length
        ? prisma.campaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, title: true, brandId: true },
          })
        : Promise.resolve([]),
      claimIds.length
        ? prisma.appointmentClaim.findMany({
            where: { id: { in: claimIds } },
            select: {
              id: true,
              prospectName: true,
              prospectId: true,
              repUserId: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const campaignById = Object.fromEntries(campaigns.map((c) => [c.id, c]));
    const claimById = Object.fromEntries(claims.map((c) => [c.id, c]));

    const repIds = [...new Set(claims.map((c) => c.repUserId).filter(Boolean))];
    const prospectIds = [
      ...new Set(claims.map((c) => c.prospectId).filter(Boolean) as string[]),
    ];

    const [reps, prospects] = await Promise.all([
      repIds.length
        ? prisma.userProfile.findMany({
            where: { id: { in: repIds } },
            select: { id: true, email: true, displayName: true },
          })
        : Promise.resolve([]),
      prospectIds.length
        ? prisma.prospect.findMany({
            where: { id: { in: prospectIds } },
            select: { id: true, companyName: true, ownerName: true },
          })
        : Promise.resolve([]),
    ]);

    const repById = Object.fromEntries(
      reps.map((r) => [r.id, r.displayName || r.email?.split('@')[0] || 'rep'])
    );
    const prospectById = Object.fromEntries(
      prospects.map((p) => [p.id, p.ownerName || p.companyName || 'lead'])
    );

    const entries = rawLedger.map((row) => {
      const brand = brandByWallet.get(row.walletId);
      const campaign = row.campaignId ? campaignById[row.campaignId] : null;
      const claim = row.claimId ? claimById[row.claimId] : null;
      const prospectName =
        claim?.prospectName ||
        (claim?.prospectId ? prospectById[claim.prospectId] : null) ||
        null;
      const repName = claim?.repUserId ? repById[claim.repUserId] || null : null;
      const campaignTitle = campaign?.title || null;
      const description = describeEntry({
        type: row.type,
        amountCents: row.amountCents,
        note: row.note,
        campaignTitle,
        prospectName,
        repName,
      });

      return {
        id: row.id,
        type: row.type,
        amountCents: row.amountCents,
        balanceAfter: row.balanceAfter,
        createdAt: row.createdAt.toISOString(),
        brandId: brand?.id || null,
        brandName: brand?.name || null,
        brandSlug: brand?.slug || null,
        campaignId: row.campaignId,
        campaignTitle,
        claimId: row.claimId,
        prospectName,
        repName,
        description,
        direction: row.amountCents < 0 ? 'debit' : row.amountCents > 0 ? 'credit' : 'neutral',
      };
    });

    const filterCampaigns = allBrands.flatMap((b) =>
      b.campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        brandId: b.id,
        brandName: b.name,
        status: c.status,
      }))
    );

    const brandDesks = allBrands.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      walletBalanceCents: b.wallet?.balanceCents ?? 0,
      walletBalanceLabel: `$${((b.wallet?.balanceCents ?? 0) / 100).toFixed(2)}`,
      campaigns: b.campaigns.map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        budgetLabel: c.budgetCents != null ? `$${(c.budgetCents / 100).toFixed(0)}` : '—',
        escrowLabel: `$${((c.escrowLockedCents || 0) / 100).toFixed(2)}`,
      })),
    }));

    const activeBrand =
      brandDesks.find((b) => b.id === brandFilter || b.slug === brandFilter) ||
      brandDesks[0] ||
      null;

    return NextResponse.json({
      brands: allBrands.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        walletBalanceCents: b.wallet?.balanceCents ?? 0,
        walletBalanceLabel: `$${((b.wallet?.balanceCents ?? 0) / 100).toFixed(2)}`,
      })),
      brandDesks,
      campaigns: filterCampaigns,
      entries,
      activeBrand,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('billing ledger', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
