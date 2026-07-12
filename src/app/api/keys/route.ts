import { createHash, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canUseApiKeys } from '@/lib/plans';

function hashKey(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}

export async function GET() {
  try {
    const profile = await requireUser();
    const keys = await prisma.apiKey.findMany({
      where: { userId: profile.id, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ keys, canCreate: canUseApiKeys(profile) });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    if (!canUseApiKeys(profile)) {
      return NextResponse.json(
        {
          error: 'API keys require Recruiter role, Org plan, or Superadmin.',
          code: 'PLAN_REQUIRED',
        },
        { status: 402 }
      );
    }
    const { name } = await req.json();
    const raw = `ccr_${randomBytes(24).toString('hex')}`;
    const key = await prisma.apiKey.create({
      data: {
        userId: profile.id,
        name: String(name || 'Default').slice(0, 80),
        keyHash: hashKey(raw),
        keyPrefix: raw.slice(0, 12),
      },
    });
    return NextResponse.json({
      key: { id: key.id, name: key.name, keyPrefix: key.keyPrefix, createdAt: key.createdAt },
      secret: raw,
      notice: 'Copy the secret now — it will not be shown again.',
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const key = await prisma.apiKey.findFirst({
      where: { id, userId: profile.id, revokedAt: null },
    });
    if (!key) return NextResponse.json({ error: 'Key not found' }, { status: 404 });

    await prisma.apiKey.update({
      where: { id: key.id },
      data: { revokedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
