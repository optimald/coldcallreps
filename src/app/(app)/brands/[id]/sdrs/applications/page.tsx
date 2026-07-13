import { redirect } from 'next/navigation';

/** Legacy brand-scoped applications → account Recruit. */
export default async function LegacyApplicationsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/recruit?brand=${encodeURIComponent(id)}`);
}
