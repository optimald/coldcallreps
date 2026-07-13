import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { presignDownload, r2Configured, clipsWorkerConfigured } from '@/lib/r2';

/**
 * Redirect to clip audio by clipId only (ready clips).
 * Raw `key=` object paths are rejected — prevents arbitrary R2 reads.
 * Public highlight pages (/h/[id]) rely on unauthenticated clipId access.
 */
export async function GET(req: Request) {
  try {
    if (!r2Configured()) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }
    const { searchParams } = new URL(req.url);
    if (searchParams.get('key')) {
      return NextResponse.json(
        { error: 'Direct object keys are not allowed — use clipId' },
        { status: 400 }
      );
    }
    const clipId = searchParams.get('clipId') || '';
    if (!clipId) {
      return NextResponse.json({ error: 'clipId required' }, { status: 400 });
    }

    const clip = await prisma.clip.findUnique({
      where: { id: clipId },
      select: {
        r2Key: true,
        status: true,
        mediaUrl: true,
      },
    });
    if (!clip || clip.status !== 'ready' || !clip.r2Key) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (clip.mediaUrl?.startsWith('http') && clip.mediaUrl.includes('/object?key=')) {
      return NextResponse.redirect(clip.mediaUrl, 302);
    }

    const objectKey = clip.r2Key;
    if (!objectKey.startsWith('clips/')) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    const url = await presignDownload(objectKey, 3600);
    if (clipsWorkerConfigured() || url.startsWith('http')) {
      return NextResponse.redirect(url, 302);
    }
    return NextResponse.redirect(url, 302);
  } catch (error: unknown) {
    console.error('[clips/media]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
