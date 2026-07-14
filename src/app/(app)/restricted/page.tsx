import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import RestrictedClient from './RestrictedClient';

/** Landing for suspended/banned accounts. */
export default async function RestrictedPage() {
  const { userId } = await auth();
  const profile = userId
    ? await prisma.userProfile.findUnique({
        where: { id: userId },
        select: {
          id: true,
          accountStatus: true,
          statusReason: true,
        },
      })
    : null;

  return (
    <RestrictedClient
      status={profile?.accountStatus || 'RESTRICTED'}
      statusReason={profile?.statusReason || null}
      userId={profile?.id || null}
    />
  );
}
