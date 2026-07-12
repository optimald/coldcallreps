import { redirect } from 'next/navigation';

/** Legacy /r/{slug} → /{slug} */
export default async function LegacyRepRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}`);
}
