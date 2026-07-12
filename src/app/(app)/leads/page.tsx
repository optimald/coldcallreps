import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ownedBrandIds } from '@/lib/brand-leads';
import { listTrainingLeads } from '@/lib/training-leads';
import { effectiveRole } from '@/lib/roles';
import { EmptyState, PageHeader } from '@/components/ui/PagePrimitives';
import BrandLeadsClient from '@/components/BrandLeadsClient';
import TrainingLeadsPanel from '@/components/TrainingLeadsPanel';

/**
 * Leads — campaign contacts (brand-owned) + training leads (practice).
 * Accepted SDRs dial campaign leads from Outbound; anyone can practice on training leads.
 */
export default async function LeadsPage() {
  const profile = await requireUser();
  const role = effectiveRole(profile);
  const trainingLeads = await listTrainingLeads({
    take: 80,
    ownerUserId:
      role === 'BRAND' || role === 'RECRUITER' ? profile.id : undefined,
  });

  if (role !== 'BRAND' && role !== 'RECRUITER' && role !== 'SUPERADMIN') {
    return (
      <main className="app-page">
        <PageHeader
          eyebrow="Leads"
          title="Training leads"
          description="Practice contacts for cold-call reps. Dial from Outbound without a gig — campaign leads unlock after a brand accepts you."
          actions={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link href="/outbound" className="btn">
                Outbound
              </Link>
              <Link href="/trainer" className="btn-ghost">
                Trainer
              </Link>
            </div>
          }
        />
        <TrainingLeadsPanel leads={trainingLeads} mode="sdr" />
        <EmptyState
          title="Campaign leads live in Outbound"
          description="When a brand accepts you on a gig, their paid lead list appears in Outbound with Call."
          action={
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Link href="/gigs" className="btn-ghost">
                Browse gigs
              </Link>
            </div>
          }
        />
      </main>
    );
  }

  const brands = await ownedBrandIds(profile);
  const brandIds = brands.map((b) => b.id);
  const campaigns = brandIds.length
    ? await prisma.campaign.findMany({
        where: { brandId: { in: brandIds } },
        orderBy: { updatedAt: 'desc' },
        take: 80,
        select: { id: true, title: true, brandId: true, status: true },
      })
    : [];

  return (
    <main className="app-page">
      <PageHeader
        eyebrow="Grow"
        title="Leads"
        description="Training leads for playbook practice. Campaign leads for paid outbound — assign to a gig so accepted SDRs can dial."
        actions={
          <Link href="/campaigns" className="btn">
            Campaigns
          </Link>
        }
      />
      <BrandLeadsClient
        brands={brands}
        campaigns={campaigns}
        platformTrainingLeads={trainingLeads}
      />
    </main>
  );
}
