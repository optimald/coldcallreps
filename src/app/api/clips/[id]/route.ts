import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Publish a clip as ready — shareable scored-session highlight URL. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    const { id } = await params;
    const clip = await prisma.clip.findFirst({
      where: { id, userId: profile.id },
      include: { session: true },
    });
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(
      /\/$/,
      ''
    );
    const status = body.status === 'draft' ? 'draft' : 'ready';
    const mediaUrl = status === 'ready' ? `${appUrl}/h/${clip.id}` : null;

    const updated = await prisma.clip.update({
      where: { id: clip.id },
      data: {
        status,
        mediaUrl,
        title:
          body.title ||
          clip.title ||
          (clip.session
            ? `Rep ${clip.session.overallScore} — ${clip.session.focusArea}`
            : clip.title),
      },
    });

    // Auto-attach to public profile clipUrls when publishing
    if (updated.status === 'ready' && mediaUrl) {
      const rep = await prisma.repProfile.findUnique({ where: { userId: profile.id } });
      if (rep) {
        let urls: string[] = [];
        try {
          urls = JSON.parse(rep.clipUrlsJSON || '[]');
        } catch {
          urls = [];
        }
        if (!urls.includes(mediaUrl)) {
          urls = [mediaUrl, ...urls].slice(0, 10);
          await prisma.repProfile.update({
            where: { id: rep.id },
            data: { clipUrlsJSON: JSON.stringify(urls) },
          });
        }
      }
    }

    return NextResponse.json({ clip: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
