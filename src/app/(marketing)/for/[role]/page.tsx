import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RoleLandingPage from '@/components/RoleLandingPage';
import { ROLE_LANDINGS, type RoleLandingKey } from '@/lib/role-landings';

const KEYS = Object.keys(ROLE_LANDINGS) as RoleLandingKey[];

export function generateStaticParams() {
  return KEYS.map((role) => ({ role }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ role: string }>;
}): Promise<Metadata> {
  const { role: raw } = await params;
  const role = ROLE_LANDINGS[raw as RoleLandingKey];
  if (!role) return { title: 'Not found' };
  return {
    // Root layout template already appends " | ColdCallReps"; avoid doubling it.
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
  const role = ROLE_LANDINGS[raw as RoleLandingKey];
  if (!role) notFound();
  return <RoleLandingPage role={role} />;
}
