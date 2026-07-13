import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RESUME_RECORDING_ALLOWANCE, canStoreRecordingsForProfile } from '@/lib/plans';
import { getUploadTarget, r2Configured, publicUrlForKey } from '@/lib/r2';

const STORAGE_UPGRADE_MSG = `Call recording storage requires Pro ($29/mo) or Org after your ${RESUME_RECORDING_ALLOWANCE} resume starter recordings. Scorecards and transcripts still work on Free and SDR.`;

/** Get an upload URL for a session audio highlight (R2 worker or S3). */
export async function POST(req: Request) {
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
    if (!r2Configured()) {
      return NextResponse.json(
        { error: 'Audio storage not configured. Highlights still work as score pages.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const sessionId = body.sessionId ? String(body.sessionId) : '';
    const contentType = String(body.contentType || 'audio/webm').slice(0, 80);
    const durationSec =
      typeof body.durationSec === 'number' ? Math.max(0, Math.floor(body.durationSec)) : null;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const session = await prisma.trainerSession.findFirst({
      where: { id: sessionId, userId: profile.id },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const ext = contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'webm';
    const key = `clips/${profile.id}/${sessionId}-${Date.now()}.${ext}`;

    let clip = await prisma.clip.findFirst({
      where: { userId: profile.id, sessionId, status: { in: ['draft', 'processing'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!clip) {
      clip = await prisma.clip.create({
        data: {
          userId: profile.id,
          sessionId,
          status: 'processing',
          r2Key: key,
          durationSec,
          title: `Rep ${session.overallScore} — ${session.focusArea}`,
        },
      });
    } else {
      clip = await prisma.clip.update({
        where: { id: clip.id },
        data: { status: 'processing', r2Key: key, durationSec },
      });
    }

    const target = await getUploadTarget({ key, contentType });
    return NextResponse.json({
      clipId: clip.id,
      uploadUrl: target.uploadUrl,
      key,
      publicUrl: publicUrlForKey(key),
      contentType,
      mode: target.mode,
      // For worker mode the browser must send this header on PUT
      uploadHeaders: target.headers || { 'Content-Type': contentType },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
