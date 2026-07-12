import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { RESERVED_HANDLES, slugify } from '@/lib/handles';
import PublicRepProfileClient from '@/components/PublicRepProfileClient';
import PublicTeamPage from '@/components/PublicTeamPage';

/** Reject file-like paths (e.g. favicon.ico) so they never hit Prisma. */
function isFileLikeSlug(raw: string): boolean {
  return /\.[a-z0-9]{1,8}$/i.test(raw);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: raw } = await params;
  if (isFileLikeSlug(raw)) return { title: 'Cold Call Reps' };
  const slug = slugify(raw);
  if (!slug || RESERVED_HANDLES.has(slug)) return { title: 'Cold Call Reps' };

  const rep = await prisma.repProfile.findUnique({
    where: { slug },
    include: {
      user: {
        select: {
          displayName: true,
          hiringHeadline: true,
          hiringBoardOptIn: true,
        },
      },
    },
  });
  if (rep) {
    const name = rep.user.displayName || slug;
    const desc =
      rep.user.hiringHeadline ||
      `${name} on Cold Call Reps${rep.user.hiringBoardOptIn ? ' · Open to work' : ''}`;
    return {
      title: `${name} — Cold Call Reps`,
      description: desc,
      openGraph: { title: `${name}${rep.verified ? ' ✓' : ''}`, description: desc, url: `/${slug}` },
    };
  }

  const team = await prisma.academy.findUnique({ where: { slug } });
  if (team) {
    return {
      title: `${team.name} — Cold Call Reps`,
      description: team.publicBio || team.description || `${team.name} team page`,
      openGraph: { title: team.name, url: `/${slug}` },
    };
  }

  return { title: 'Cold Call Reps' };
}

export default async function VanitySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  if (isFileLikeSlug(raw)) notFound();
  const slug = slugify(raw);
  if (!slug || RESERVED_HANDLES.has(slug)) notFound();

  const rep = await prisma.repProfile.findUnique({ where: { slug }, select: { slug: true } });
  if (rep) return <PublicRepProfileClient slug={rep.slug} />;

  const team = await prisma.academy.findUnique({ where: { slug }, select: { slug: true } });
  if (team?.slug) return <PublicTeamPage slug={team.slug} />;

  notFound();
}
