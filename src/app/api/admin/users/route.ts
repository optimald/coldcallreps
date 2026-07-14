import { NextResponse } from 'next/server';
import type { AccountStatus, OpsRole, PlatformRole } from '@prisma/client';
import { requireOps } from '@/lib/auth';
import { canOps } from '@/lib/admin-ops';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { realUserWhere, isSyntheticUserId } from '@/lib/training-leads';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function errResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Internal server error';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }
  if (message === 'ACCOUNT_RESTRICTED') {
    return NextResponse.json({ error: 'Account restricted' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    await requireOps('users.read');
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const status = (searchParams.get('status') || '').trim().toUpperCase();
    const role = (searchParams.get('role') || '').trim().toUpperCase();

    const filters: Record<string, unknown>[] = [realUserWhere()];
    if (q) {
      filters.push({
        OR: [
          { email: { contains: q } },
          { displayName: { contains: q } },
          { id: { contains: q } },
          { stripeConnectAccountId: { contains: q } },
          { stripeCustomerId: { contains: q } },
          { repProfile: { slug: { contains: q } } },
        ],
      });
    }
    if (status && ['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
      filters.push({ accountStatus: status });
    }
    if (role && ['REP', 'RECRUITER', 'BRAND', 'MANAGER', 'SUPERADMIN'].includes(role)) {
      filters.push({ platformRole: role });
    }

    const users = await prisma.userProfile.findMany({
      where: { AND: filters },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        email: true,
        displayName: true,
        platformRole: true,
        opsRole: true,
        accountStatus: true,
        statusReason: true,
        plan: true,
        minutesRemaining: true,
        totalPoints: true,
        bountyCredits: true,
        hiringBoardOptIn: true,
        stripeConnectAccountId: true,
        stripeConnectPayoutsEnabled: true,
        createdAt: true,
        repProfile: { select: { slug: true, verified: true } },
      },
    });
    return NextResponse.json({ users });
  } catch (error) {
    return errResponse(error);
  }
}

export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('users.write');
    const body = await req.json();
    const userId = String(body.userId || '');
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 });
    if (isSyntheticUserId(userId)) {
      return NextResponse.json({ error: 'Synthetic seed users cannot be edited' }, { status: 400 });
    }

    const existing = await prisma.userProfile.findUnique({ where: { id: userId } });
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const data: {
      platformRole?: PlatformRole;
      opsRole?: OpsRole | null;
      minutesRemaining?: number;
      hiringBoardOptIn?: boolean;
      accountStatus?: AccountStatus;
      statusReason?: string | null;
      statusChangedAt?: Date;
      statusChangedById?: string;
    } = {};

    if (body.platformRole) {
      const roles: PlatformRole[] = ['REP', 'RECRUITER', 'BRAND', 'MANAGER', 'SUPERADMIN'];
      if (!roles.includes(body.platformRole)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      data.platformRole = body.platformRole;
    }

    if (body.opsRole !== undefined) {
      if (!canOps(admin, 'users.assign_ops')) {
        return NextResponse.json({ error: 'Cannot assign ops roles' }, { status: 403 });
      }
      const ops: Array<OpsRole | null> = ['SUPER', 'FINANCE', 'TRUST', 'SUPPORT', null];
      const next = body.opsRole === '' || body.opsRole === null ? null : body.opsRole;
      if (!ops.includes(next)) {
        return NextResponse.json({ error: 'Invalid ops role' }, { status: 400 });
      }
      data.opsRole = next;
    }

    if (typeof body.minutesRemaining === 'number') {
      if (!canOps(admin, 'users.credits')) {
        return NextResponse.json({ error: 'Cannot adjust credits' }, { status: 403 });
      }
      data.minutesRemaining = Math.max(0, Math.min(10000, Math.floor(body.minutesRemaining)));
    }

    if (typeof body.hiringBoardOptIn === 'boolean') {
      data.hiringBoardOptIn = body.hiringBoardOptIn;
    }

    if (body.accountStatus) {
      if (!canOps(admin, 'users.ban')) {
        return NextResponse.json({ error: 'Cannot suspend/ban' }, { status: 403 });
      }
      const statuses: AccountStatus[] = ['ACTIVE', 'SUSPENDED', 'BANNED'];
      if (!statuses.includes(body.accountStatus)) {
        return NextResponse.json({ error: 'Invalid account status' }, { status: 400 });
      }
      const reason = String(body.statusReason || '').trim();
      if (body.accountStatus !== 'ACTIVE' && reason.length < 3) {
        return NextResponse.json(
          { error: 'statusReason required (min 3 chars) for suspend/ban' },
          { status: 400 }
        );
      }
      data.accountStatus = body.accountStatus;
      data.statusReason = body.accountStatus === 'ACTIVE' ? null : reason;
      data.statusChangedAt = new Date();
      data.statusChangedById = admin.id;
    }

    const updated = await prisma.userProfile.update({
      where: { id: userId },
      data,
    });

    if (typeof body.verified === 'boolean') {
      const rep = await prisma.repProfile.findUnique({ where: { userId } });
      if (rep) {
        await prisma.repProfile.update({
          where: { id: rep.id },
          data: { verified: body.verified },
        });
      }
    }

    // Optional minute delta with mandatory reason (credit tool)
    if (typeof body.minuteDelta === 'number' && body.minuteDelta !== 0) {
      if (!canOps(admin, 'users.credits')) {
        return NextResponse.json({ error: 'Cannot adjust credits' }, { status: 403 });
      }
      const reason = String(body.creditReason || '').trim();
      if (reason.length < 3) {
        return NextResponse.json(
          { error: 'creditReason required for minute adjustments' },
          { status: 400 }
        );
      }
      const next = Math.max(
        0,
        Math.min(10000, existing.minutesRemaining + Math.floor(body.minuteDelta))
      );
      await prisma.userProfile.update({
        where: { id: userId },
        data: { minutesRemaining: next },
      });
      await writeAudit({
        actorId: admin.id,
        action: 'admin.user.minutes_adjust',
        targetType: 'UserProfile',
        targetId: userId,
        meta: {
          before: existing.minutesRemaining,
          after: next,
          delta: body.minuteDelta,
          reason,
        },
      });
    }

    await writeAudit({
      actorId: admin.id,
      action: body.accountStatus
        ? `admin.user.${String(body.accountStatus).toLowerCase()}`
        : 'admin.user.update',
      targetType: 'UserProfile',
      targetId: userId,
      meta: { ...body, before: {
        platformRole: existing.platformRole,
        opsRole: existing.opsRole,
        accountStatus: existing.accountStatus,
        minutesRemaining: existing.minutesRemaining,
      } },
    });

    const fresh = await prisma.userProfile.findUnique({
      where: { id: userId },
      include: { repProfile: { select: { slug: true, verified: true } } },
    });

    return NextResponse.json({ user: fresh || updated });
  } catch (error) {
    return errResponse(error);
  }
}
