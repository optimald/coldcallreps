import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { redirectBrandToScoped } from '@/lib/brand-redirects';
import { effectiveRole } from '@/lib/roles';
import CampaignsPageClient from '@/components/CampaignsPageClient';

/**
 * Flat /campaigns — brands redirect into brand-scoped campaigns.
 * Manager / Superadmin keep the multi-brand list UI.
 */
export default async function CampaignsPage() {
  const profile = await requireUser();
  const role = effectiveRole(profile);

  if (role === 'BRAND' || role === 'RECRUITER') {
    await redirectBrandToScoped(profile, 'campaigns');
  }

  if (role === 'REP') {
    redirect('/gigs');
  }

  return <CampaignsPageClient />;
}
