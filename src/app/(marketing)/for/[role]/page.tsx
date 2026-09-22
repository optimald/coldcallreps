import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import RoleLandingPage from '@/components/RoleLandingPage';
import { ROLE_LANDINGS } from '@/lib/role-landings';
import { SITE_ORIGIN } from '@/lib/site';

export function generateStaticParams() {
  return [{ role: 'reps' }, { role: 'teams' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>;
}): Promise<Metadata> {
  const { role: raw } = await params;
  if (raw !== 'reps' && raw !== 'teams') {
    return { title: 'For SDRs' };
  }
  const role = ROLE_LANDINGS.reps;
  const url = `${SITE_ORIGIN}${role.path}`;
  return {
    title: {
      absolute:
        'For SDRs — Get Hired as a Cold Caller | Cold Call Reps',
    },
    description:
      'Cold Call Reps for SDRs: train with AI, clear the quality gate, find cold calling gigs, and get hired by brands who hire cold callers — get paid per meeting.',
    keywords: [
      'hire cold callers',
      'cold calling gigs',
      'SDR jobs',
      'appointment setter gigs',
      'Cold Call Reps',
    ],
    alternates: { canonical: url },
    openGraph: {
      title: 'For SDRs — Get Hired as a Cold Caller | Cold Call Reps',
      description: role.headline,
      url,
      images: [{ url: '/og.svg', width: 1200, height: 630 }],
    },
  };
}

export default async function ForRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role: raw } = await params;
  // Brand-facing /for/* paths 301 to MarketPounce via next.config.
  // Keep teams on CCR as an alias of the SDR recruiting path.
  if (raw === 'teams') {
    redirect('/for/reps');
  }
  if (raw !== 'reps') notFound();
  return <RoleLandingPage role={ROLE_LANDINGS.reps} />;
}
