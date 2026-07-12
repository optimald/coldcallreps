import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { presignDownload, r2Configured, clipsWorkerConfigured } from '@/lib/r2';

/** Redirect to clip audio (worker public URL or signed S3 URL). */
export async function GET(req: Request) {
  try {
    if (!r2Configured()) {
      return NextResponse.json({ error: 'Storage not configured' }, { status: 503 });
    }
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key') || '';
    const clipId = searchParams.get('clipId') || '';

    let objectKey = key;
    if (!objectKey && clipId) {
      const clip = await prisma.clip.findUnique({
        where: { id: clipId },
        select: { r2Key: true, status: true, mediaUrl: true },
      });
      if (!clip || clip.status !== 'ready') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      if (clip.mediaUrl?.startsWith('http') && clip.mediaUrl.includes('/object?key=')) {
        return NextResponse.redirect(clip.mediaUrl, 302);
      }
      if (!clip.r2Key) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      objectKey = clip.r2Key;
    }
    if (!objectKey || !objectKey.startsWith('clips/')) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    const url = await presignDownload(objectKey, 3600);
    if (clipsWorkerConfigured() || url.startsWith('http')) {
      return NextResponse.redirect(url, 302);
    }
    return NextResponse.redirect(url, 302);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
