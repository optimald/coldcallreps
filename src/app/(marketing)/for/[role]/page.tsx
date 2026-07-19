import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import RoleLandingPage from '@/components/RoleLandingPage';
import { ROLE_LANDINGS } from '@/lib/role-landings';

export function generateStaticParams() {
  return [{ role: 'reps' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>;
}): Promise<Metadata> {
  const { role: raw } = await params;
  if (raw !== 'reps') {
    return { title: 'For SDRs' };
  }
  const role = ROLE_LANDINGS.reps;
  return {
    title: role.title,
    description: role.sub,
    openGraph: {
      title: `${role.title} — ColdCallReps`,
      description: role.headline,
      url: `https://coldcallreps.com${role.path}`,
      images: [{ url: '/og.svg', width: 1200, height: 630 }],
    },
  };
}

export default async function ForRolePage({ params }: { params: Promise<{ role: string }> }) {
  const { role: raw } = await params;
  if (raw === 'brands' || raw === 'teams') {
    redirect('/for/reps');
  }
  if (raw !== 'reps') notFound();
  return <RoleLandingPage role={ROLE_LANDINGS.reps} />;
}
