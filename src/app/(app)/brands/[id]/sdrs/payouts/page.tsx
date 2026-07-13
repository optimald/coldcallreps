import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { requireDeskBrand } from '@/lib/desk-brand';
import { brandHref, brandPathKey } from '@/lib/brand-context';
import { getOrCreateBrandWallet } from '@/lib/escrow';
import { prisma } from '@/lib/prisma';
import { canAccessBrandDesk } from '@/lib/roles';
import { PageHeader } from '@/components/ui/PagePrimitives';
import BrandSdrPayoutsClient from '@/components/BrandSdrPayoutsClient';

export default async function BrandSdrPayoutsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const { brand, deskMode } = await requireDeskBrand(id);
  if (!canAccessBrandDesk(profile, brand, deskMode)) redirect('/dashboard');

  const [payouts, wallet] = await Promise.all([
    prisma.campaignPayout.findMany({
      where: { campaign: { brandId: brand.id } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      include: {
        campaign: { select: { id: true, title: true } },
        application: {
          include: { user: { select: { id: true, displayName: true } } },
        },
      },
    }),
    getOrCreateBrandWallet(brand.id),
  ]);

  const rows = payouts.map((p) => ({
    id: p.id,
    status: p.status,
    grossCents: p.grossCents,
    campaignId: p.campaign.id,
    campaignTitle: p.campaign.title,
    sdrName: p.application?.user?.displayName || 'Rep',
    sdrId: p.application?.user?.id || p.application?.userId || null,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <main className="app-page">
      <PageHeader
        compact
        title="Payouts"
        description="Fund escrow for verified appointments, then pay SDRs from campaign detail. Brands do not use Stripe Connect — SDRs do."
        actions={
          <Link href={brandHref(brand, 'campaigns')} className="btn-ghost">
            Campaigns →
          </Link>
        }
      />
      <Suspense fallback={<p className="muted">Loading payouts…</p>}>
        <BrandSdrPayoutsClient
          brandKey={brandPathKey(brand)}
          brandId={brand.id}
          initial={rows}
          escrowLabel={`$${(wallet.balanceCents / 100).toFixed(2)}`}
        />
      </Suspense>
    </main>
  );
}
