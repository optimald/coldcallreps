import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    if (!profile.orgId) {
      return NextResponse.json({ error: 'Organization required' }, { status: 400 });
    }

    const academy = await prisma.academy.findFirst({ where: { orgId: profile.orgId } });
    if (!academy) {
      return NextResponse.json({ error: 'Create an academy first' }, { status: 404 });
    }

    const me = await prisma.academyMember.findUnique({
      where: { academyId_userId: { academyId: academy.id, userId: profile.id } },
    });
    if (me?.role !== 'manager' && profile.platformRole !== 'SUPERADMIN') {
      return NextResponse.json({ error: 'Manager role required' }, { status: 403 });
    }

    const body = await req.json();
    let userId = '';
    if (body.email) {
      const user = await prisma.userProfile.findFirst({
        where: { email: String(body.email).toLowerCase().trim() },
      });
      if (!user) {
        return NextResponse.json(
          { error: 'No user with that email yet — they must sign up first.' },
          { status: 404 }
        );
      }
      userId = user.id;
    } else if (body.userId) {
      const user = await prisma.userProfile.findUnique({
        where: { id: String(body.userId) },
      });
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      userId = user.id;
    }
    if (!userId) {
      return NextResponse.json(
        { error: 'email required (preferred) or userId of an existing user' },
        { status: 400 }
      );
    }

    const seatCap = Number(process.env.TEAM_SEATS || 10);
    const memberCount = await prisma.academyMember.count({ where: { academyId: academy.id } });
    const already = await prisma.academyMember.findUnique({
      where: { academyId_userId: { academyId: academy.id, userId } },
    });
    if (!already && memberCount >= seatCap) {
      return NextResponse.json(
        { error: `Team seat limit reached (${seatCap}). Upgrade or remove a member.`, code: 'SEAT_LIMIT' },
        { status: 402 }
      );
    }

    const member = await prisma.academyMember.upsert({
      where: { academyId_userId: { academyId: academy.id, userId } },
      create: {
        academyId: academy.id,
        userId,
        role: body.role === 'manager' ? 'manager' : 'member',
      },
      update: {},
      include: { user: { select: { displayName: true, email: true } } },
    });

    return NextResponse.json({ member, seatsUsed: already ? memberCount : memberCount + 1, seatCap });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
