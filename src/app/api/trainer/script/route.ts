import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildTrainingScript } from '@/lib/trainer/training-script';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const rl = rateLimit({
      key: `script:${session.userId}`,
      limit: 30,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const {
      prospectId,
      focus = 'standard',
      difficulty = 'medium',
      companyName,
      playbookId,
    } = body;

    const userId = session.userId;
    const profile = await prisma.userProfile.findUnique({ where: { id: userId } });
    const orgId = profile?.orgId || null;

    const script = await buildTrainingScript({
      prospectId,
      focus,
      difficulty,
      companyName,
      userId,
      orgId,
      playbookId: playbookId || null,
    });
    return NextResponse.json(script);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
