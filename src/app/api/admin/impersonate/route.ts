import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { requireOps } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

const SESSION_MAX_SECONDS = 30 * 60;
const TOKEN_EXPIRES_SECONDS = 60 * 60;

function errResponse(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Impersonation not allowed' }, { status: 403 });
  }
  return NextResponse.json({ error: message || 'Internal server error' }, { status: 500 });
}

/** Start a time-limited Clerk actor-token impersonation session. */
export async function POST(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('users.impersonate');
    const body = await req.json();
    const targetUserId = String(body.userId || '');
    const reason = String(body.reason || '').trim();

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }
    if (reason.length < 5) {
      return NextResponse.json({ error: 'reason required (min 5 chars)' }, { status: 400 });
    }
    if (targetUserId === admin.id) {
      return NextResponse.json({ error: 'Cannot impersonate yourself' }, { status: 400 });
    }

    const target = await prisma.userProfile.findUnique({ where: { id: targetUserId } });
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const clerk = await clerkClient();
    const actorToken = await clerk.actorTokens.create({
      userId: targetUserId,
      expiresInSeconds: TOKEN_EXPIRES_SECONDS,
      sessionMaxDurationInSeconds: SESSION_MAX_SECONDS,
      actor: {
        sub: admin.id,
        additionalProperties: {
          email: admin.email,
          reason,
        },
      },
    });

    const expiresAt = new Date(Date.now() + SESSION_MAX_SECONDS * 1000);
    const session = await prisma.impersonationSession.create({
      data: {
        adminId: admin.id,
        targetUserId,
        reason,
        clerkActorTokenId: actorToken.id,
        expiresAt,
      },
    });

    await writeAudit({
      actorId: admin.id,
      action: 'admin.impersonation.start',
      targetType: 'UserProfile',
      targetId: targetUserId,
      meta: {
        sessionId: session.id,
        reason,
        expiresAt: expiresAt.toISOString(),
        actorTokenId: actorToken.id,
      },
    });

    const url =
      (actorToken as { url?: string }).url ||
      `${process.env.NEXT_PUBLIC_APP_URL || ''}/dashboard`;

    return NextResponse.json({
      sessionId: session.id,
      expiresAt: expiresAt.toISOString(),
      /** One-time URL / token for the actor session — open in a new tab. */
      url,
      token: (actorToken as { token?: string }).token ?? null,
      target: {
        id: target.id,
        email: target.email,
        displayName: target.displayName,
      },
    });
  } catch (error) {
    return errResponse(error);
  }
}

/** End / revoke an impersonation session. */
export async function DELETE(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('users.impersonate');
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId') || '';
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const session = await prisma.impersonationSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.adminId !== admin.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (session.clerkActorTokenId && !session.endedAt) {
      try {
        const clerk = await clerkClient();
        await clerk.actorTokens.revoke(session.clerkActorTokenId);
      } catch {
        /* token may already be consumed */
      }
    }

    await prisma.impersonationSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });

    await writeAudit({
      actorId: admin.id,
      action: 'admin.impersonation.end',
      targetType: 'UserProfile',
      targetId: session.targetUserId,
      meta: { sessionId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errResponse(error);
  }
}
