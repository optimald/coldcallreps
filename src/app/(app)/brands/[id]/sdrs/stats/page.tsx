import { redirect } from 'next/navigation';

/** Per-brand Stats desk removed — redirect to account Team. */
export default async function BrandSdrStatsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/sdrs/team?brand=${encodeURIComponent(id)}`);
}
