import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [boards, bounties] = await Promise.all([
      prisma.sponsoredBoard.findMany({
        where: { active: true },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
              packs: { where: { active: true }, take: 1, select: { id: true, name: true } },
            },
          },
        },
        take: 30,
      }),
      prisma.bounty.findMany({
        where: { active: true },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
              packs: { where: { active: true }, take: 1, select: { id: true, name: true } },
            },
          },
        },
        take: 30,
      }),
    ]);
    return NextResponse.json({ boards, bounties });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
