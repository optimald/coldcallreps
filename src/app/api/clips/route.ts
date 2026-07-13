import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const profile = await requireUser();
    const clips = await prisma.clip.findMany({
      where: { userId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    return NextResponse.json({ clips });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** Create a shareable session highlight clip (links to the scored session). */
export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const { sessionId, title } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const session = await prisma.trainerSession.findFirst({
      where: { id: String(sessionId), userId: profile.id },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Public share URL is set on publish (/h/{clipId}); draft has no public link yet
    const clip = await prisma.clip.create({
      data: {
        userId: profile.id,
        sessionId: session.id,
        status: 'draft',
        mediaUrl: null,
        title:
          title ||
          `Rep ${session.overallScore} — ${session.focusArea} (${new Date().toLocaleDateString()})`,
      },
    });

    return NextResponse.json({
      clip,
      message: 'Highlight saved. Publish from Settings → Public profile to share.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
