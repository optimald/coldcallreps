import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const profile = await requireUser();
    return NextResponse.json({
      hiringBoardOptIn: profile.hiringBoardOptIn,
      hiringHeadline: profile.hiringHeadline,
      hiringBio: profile.hiringBio,
      totalPoints: profile.totalPoints,
      badges: profile.badges,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const { optIn, headline, bio } = await req.json();
    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        hiringBoardOptIn: Boolean(optIn),
        hiringHeadline: headline ? String(headline).slice(0, 120) : null,
        hiringBio: bio ? String(bio).slice(0, 800) : null,
      },
    });
    return NextResponse.json({
      ok: true,
      hiringBoardOptIn: updated.hiringBoardOptIn,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
