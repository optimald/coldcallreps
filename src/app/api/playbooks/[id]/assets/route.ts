import { NextResponse } from 'next/server';
import type { UserProfile } from '@prisma/client';
import { requireUser } from '@/lib/auth';
import { canManageTeam } from '@/lib/plans';
import { canManageBrand } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { getUploadTarget, publicUrlForKey, r2Configured } from '@/lib/r2';

type ProfileAuth = Pick<UserProfile, 'id' | 'orgId' | 'plan' | 'platformRole' | 'email'>;

/** Owner, org manager, or brand manager — same gate as playbooks/[id] mutate. */
async function canMutate(profile: ProfileAuth, playbookId: string) {
  const existing = await prisma.playbook.findFirst({
    where: { id: playbookId },
    include: { brand: { select: { ownerId: true } } },
  });
  if (!existing) return null;

  if (existing.brandId && existing.brand) {
    if (canManageBrand(profile, existing.brand.ownerId)) return existing;
    return null;
  }

  if (existing.userId === profile.id) return existing;

  if (
    existing.orgId &&
    profile.orgId &&
    existing.orgId === profile.orgId &&
    canManageTeam(profile)
  ) {
    return existing;
  }

  return null;
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

type Ctx = { params: Promise<{ id: string }> };

/** Whether R2/worker uploads are available for this playbook editor. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const existing = await canMutate(profile, id);
    if (!existing) return NextResponse.json({ error: 'Not found or not allowed' }, { status: 404 });
    return NextResponse.json({ uploadAvailable: r2Configured() });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Presign / worker upload target for playbook training media.
 * Body: `{ contentType, kind: 'image' | 'video' }`
 */
export async function POST(req: Request, ctx: Ctx) {
  try {
    const profile = await requireUser();
    const { id } = await ctx.params;
    const existing = await canMutate(profile, id);
    if (!existing) return NextResponse.json({ error: 'Not found or not allowed' }, { status: 404 });

    if (!r2Configured()) {
      return NextResponse.json(
        {
          error: 'Media storage not configured. Paste public image or video URLs instead.',
          code: 'STORAGE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const kind = body.kind === 'video' ? 'video' : 'image';
    const contentType = String(body.contentType || (kind === 'video' ? 'video/mp4' : 'image/jpeg')).slice(
      0,
      80
    );

    if (kind === 'image' && !IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Use JPEG, PNG, WebP, or GIF.' }, { status: 400 });
    }
    if (kind === 'video' && !VIDEO_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Use MP4, WebM, or QuickTime video.' }, { status: 400 });
    }

    const ext =
      contentType === 'image/png'
        ? 'png'
        : contentType === 'image/webp'
          ? 'webp'
          : contentType === 'image/gif'
            ? 'gif'
            : contentType === 'video/webm'
              ? 'webm'
              : contentType === 'video/quicktime'
                ? 'mov'
                : kind === 'video'
                  ? 'mp4'
                  : 'jpg';

    const key = `playbooks/${id}/${kind}-${Date.now()}.${ext}`;
    const target = await getUploadTarget({ key, contentType });

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
