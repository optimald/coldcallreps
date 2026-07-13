import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { resolveProspectAccess } from '@/lib/prospect-access';
import LeadDetailClient from '@/components/LeadDetailClient';

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; tab?: string }>;
}) {
  const profile = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const access = await resolveProspectAccess(profile, id);
  if (!access) notFound();

  const brand = access.prospect.brand;
  const showAudit = access.via === 'brand' || access.via === 'superadmin';
  const fromPractice = sp.from === 'practice' || sp.from === 'trainer';
  const fromColdCalls = sp.from === 'cold_calls' || sp.from === 'outbound';
  const backHref = fromPractice
    ? '/practice'
    : fromColdCalls
      ? '/cold_calls'
      : brand
        ? `/brands/${brand.slug || brand.id}/leads`
        : '/leads';
  const backLabel = fromPractice ? 'Practice' : fromColdCalls ? 'Cold Call' : 'Leads';

  let tab: 'identity' | 'calls' | 'audit' =
    sp.tab === 'calls' || sp.tab === 'audit' || sp.tab === 'identity' ? sp.tab : 'identity';
  if (tab === 'audit' && !showAudit) tab = 'identity';

  return (
    <LeadDetailClient
      prospectId={id}
      backHref={backHref}
      backLabel={backLabel}
      initialTab={tab}
      brandMode={Boolean(brand)}
      showAudit={showAudit}
    />
  );
}
