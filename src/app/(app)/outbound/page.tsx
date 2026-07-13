import { redirect } from 'next/navigation';

/** Legacy slug — Cold Call lives at /cold_calls. */
export default async function OutboundRedirect({
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
  redirect(suffix ? `/cold_calls?${suffix}` : '/cold_calls');
}
