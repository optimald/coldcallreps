import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { BRAND_DESK_MODE_COOKIE } from '@/lib/brand-context';
import { canonicalDemoBrandBySlug } from '@/lib/demo/canonical-brands';
import { prisma } from '@/lib/prisma';

export default async function BrandScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brand = await prisma.brand.findFirst({
    where: { OR: [{ id }, { slug: id }] },
    select: { id: true },
  });
  if (!brand) {
    // Demo desk can navigate to canonical demo-* brands before seed runs.
    const deskDemo =
      (await cookies()).get(BRAND_DESK_MODE_COOKIE)?.value === 'demo';
    if (!(deskDemo && canonicalDemoBrandBySlug(id))) notFound();
  }

  return <div className="brand-scope">{children}</div>;
}
