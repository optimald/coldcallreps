import { redirect } from 'next/navigation';

/** Legacy /t/{slug} → /{slug} */
export default async function LegacyTeamRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}`);
}
