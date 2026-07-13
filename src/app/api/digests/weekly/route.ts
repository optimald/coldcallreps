import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const profile = await requireUser();
    const sub = await prisma.digestSubscription.findUnique({ where: { userId: profile.id } });
    return NextResponse.json({
      subscription: sub || { enabled: false, email: profile.email },
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
    const { enabled, email } = await req.json();
    const sub = await prisma.digestSubscription.upsert({
      where: { userId: profile.id },
      create: {
        userId: profile.id,
        enabled: Boolean(enabled),
        email: email ? String(email) : profile.email,
      },
      update: {
        enabled: Boolean(enabled),
        email: email ? String(email) : undefined,
      },
    });
    return NextResponse.json({ subscription: sub });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
