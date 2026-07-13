import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand, effectiveRole } from '@/lib/roles';
import { resolveProspectAccess } from '@/lib/prospect-access';
import { brandHref } from '@/lib/brand-context';
import LeadDetailClient from '@/components/LeadDetailClient';

export default async function BrandLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; prospectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  const { id: brandKey, prospectId } = await params;
  const sp = await searchParams;

  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id: brandKey }, { slug: brandKey }] },
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!brand) notFound();

  const access = await resolveProspectAccess(profile, prospectId);
  if (!access || access.prospect.brandId !== brand.id) notFound();

  // Brand desk is for managers; everyone else uses the shared lead page.
  if (!canManageBrand(profile, brand.ownerId) && role !== 'SUPERADMIN') {
    redirect(`/leads/${prospectId}?from=practice`);
  }

  const tab =
    sp.tab === 'calls' || sp.tab === 'audit' || sp.tab === 'identity' ? sp.tab : 'identity';

  return (
    <LeadDetailClient
      prospectId={prospectId}
      backHref={brandHref(brand, 'leads')}
      backLabel="Leads"
      initialTab={tab}
      brandMode
      showAudit
    />
  );
}
