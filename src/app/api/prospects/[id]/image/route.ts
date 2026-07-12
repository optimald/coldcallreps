import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUploadTarget, objectExists, publicUrlForKey, r2Configured } from '@/lib/r2';

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Presign / worker upload target for a prospect photo. */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const prospect = await prisma.prospect.findFirst({
      where: { id, userId: profile.id },
    });
    if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!r2Configured()) {
      return NextResponse.json(
        {
          error: 'Image storage not configured. Paste an image URL on the prospect instead.',
          code: 'STORAGE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const contentType = String(body.contentType || 'image/jpeg').slice(0, 80);
    if (!ALLOWED.has(contentType)) {
      return NextResponse.json(
        { error: 'Use JPEG, PNG, WebP, or GIF.' },
        { status: 400 }
      );
    }

    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/gif'
            ? 'gif'
            : 'jpg';
    const key = `prospects/${profile.id}/${id}-${Date.now()}.${ext}`;
    const target = await getUploadTarget({ key, contentType });

    await prisma.prospect.update({
      where: { id },
      data: { imageR2Key: key },
    });

    return NextResponse.json({
      uploadUrl: target.uploadUrl,
      key,
      publicUrl: publicUrlForKey(key),
      mode: target.mode,
      uploadHeaders: target.headers || { 'Content-Type': contentType },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Confirm upload finished and publish imageUrl. */
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const prospect = await prisma.prospect.findFirst({
      where: { id, userId: profile.id },
    });
    if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const key = String(body.key || prospect.imageR2Key || '');
    if (!key.startsWith(`prospects/${profile.id}/`)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
    }

    const exists = await objectExists(key);
    if (!exists) {
      return NextResponse.json(
        { error: 'Upload not found yet — wait a moment and retry.' },
        { status: 404 }
      );
    }

    const imageUrl = publicUrlForKey(key);
    const updated = await prisma.prospect.update({
      where: { id },
      data: { imageR2Key: key, imageUrl },
    });

    return NextResponse.json({ prospect: updated });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
