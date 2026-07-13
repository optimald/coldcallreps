import { NextResponse } from 'next/server';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canStoreRecordingsForProfile } from '@/lib/plans';
import {
  clipsWorkerConfigured,
  getR2Client,
  r2Bucket,
  r2Configured,
} from '@/lib/r2';

const STORAGE_UPGRADE_MSG =
  'Call recording storage requires Pro ($29/mo) or Org. Scorecards and transcripts still work on Free and SDR.';

/** Verify object exists in R2 / clips worker before marking ready. */
async function objectExists(key: string): Promise<boolean> {
  if (clipsWorkerConfigured()) {
    const worker = process.env.CLIPS_WORKER_URL!.replace(/\/$/, '');
    const secret = process.env.CLIPS_UPLOAD_SECRET!;
    try {
      const res = await fetch(`${worker}/object?key=${encodeURIComponent(key)}`, {
        method: 'HEAD',
        headers: { 'x-clips-secret': secret },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) return true;
      // Some workers may not support HEAD — fall back to GET range
      if (res.status === 405 || res.status === 501) {
        const getRes = await fetch(`${worker}/object?key=${encodeURIComponent(key)}`, {
          method: 'GET',
          headers: { Range: 'bytes=0-0', 'x-clips-secret': secret },
          signal: AbortSignal.timeout(8000),
        });
        return getRes.ok || getRes.status === 206;
      }
      return false;
    } catch {
      return false;
    }
  }

  try {
    const client = getR2Client();
    await client.send(new HeadObjectCommand({ Bucket: r2Bucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Mark clip ready after client finishes R2 upload — only if object exists. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireUser();
    if (!(await canStoreRecordingsForProfile(profile))) {
      return NextResponse.json(
        {
          error: STORAGE_UPGRADE_MSG,
          code: 'PLAN_REQUIRED',
          requiredPlan: 'PRO',
        },
        { status: 403 }
      );
    }
    const { id } = await params;
    const clip = await prisma.clip.findFirst({
      where: { id, userId: profile.id },
      include: { session: true },
    });
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!clip.r2Key || !r2Configured()) {
      return NextResponse.json({ error: 'No audio uploaded' }, { status: 400 });
    }

    const exists = await objectExists(clip.r2Key);
    if (!exists) {
      await prisma.clip.update({
        where: { id: clip.id },
        data: { status: 'failed' },
      });
      return NextResponse.json(
        { error: 'Upload not found in storage. Re-upload the highlight.' },
        { status: 400 }
      );
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(
      /\/$/,
      ''
    );
    // Prefer app-proxied media URL (auth-friendly) over raw public worker URL
    const mediaUrl = `${appUrl}/api/clips/media?clipId=${clip.id}`;

    const updated = await prisma.clip.update({
      where: { id: clip.id },
      data: {
        status: 'ready',
        mediaUrl,
        title:
          clip.title ||
          (clip.session
            ? `Rep ${clip.session.overallScore} — ${clip.session.focusArea}`
            : 'Highlight'),
      },
    });

    const rep = await prisma.repProfile.findUnique({ where: { userId: profile.id } });
    if (rep) {
      let urls: string[] = [];
      try {
        urls = JSON.parse(rep.clipUrlsJSON || '[]');
      } catch {
        urls = [];
      }
      const pageUrl = `${appUrl}/h/${clip.id}`;
      if (!urls.includes(pageUrl)) {
        urls = [pageUrl, ...urls].slice(0, 10);
        await prisma.repProfile.update({
          where: { id: rep.id },
          data: { clipUrlsJSON: JSON.stringify(urls) },
        });
      }
    }

    return NextResponse.json({ clip: updated, highlightUrl: `/h/${clip.id}` });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
