import { notFound } from 'next/navigation';
import BrandSubNav from '@/components/BrandSubNav';
import { optionalUserId } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canManageBrand } from '@/lib/roles';

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
    select: { id: true, slug: true, name: true, ownerId: true },
  });
  if (!brand) notFound();

  const userId = await optionalUserId();
  let canManage = false;
  if (userId) {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { id: true, platformRole: true, email: true },
    });
    if (profile) canManage = canManageBrand(profile, brand.ownerId);
  }

  return (
    <div className="brand-scope">
      {canManage ? (
        <BrandSubNav brand={{ id: brand.id, slug: brand.slug, name: brand.name }} />
      ) : null}
      {children}
    </div>
  );
}
