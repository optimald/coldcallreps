import { redirect } from 'next/navigation';

/** Legacy slug — Practice lives at /practice. */
export default async function TrainerRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v));
    else qs.set(key, value);
  }
  const suffix = qs.toString();
  redirect(suffix ? `/practice?${suffix}` : '/practice');
}
