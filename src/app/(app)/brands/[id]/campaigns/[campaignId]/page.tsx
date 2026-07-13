import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { BRAND_DESK_MODE_COOKIE, type BrandDeskMode } from '@/lib/brand-context';
import { loadCampaignDetailBundle } from '@/lib/campaign-detail';
import { isDemoEntityId } from '@/lib/demo/brand-demo-data';
import BrandCampaignDetailClient from '@/components/BrandCampaignDetailClient';

export default async function BrandCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>;
}) {
  const { id: brandKey, campaignId } = await params;
  const deskCookie = (await cookies()).get(BRAND_DESK_MODE_COOKIE)?.value;
  const initialDeskMode: BrandDeskMode = deskCookie === 'demo' ? 'demo' : 'live';

  let initialBundle = null;
  if (initialDeskMode === 'live' && !isDemoEntityId(campaignId)) {
    const profile = await requireUser();
    initialBundle = await loadCampaignDetailBundle(profile, campaignId);
    if (!initialBundle) notFound();
  }

  return (
    <BrandCampaignDetailClient
      brandKey={brandKey}
      campaignId={campaignId}
      initialDeskMode={initialDeskMode}
      initialBundle={initialBundle}
    />
  );
}
