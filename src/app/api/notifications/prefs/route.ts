import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseUserPrefs, type UserNotificationPrefs } from '@/lib/notifications';

/** GET/PATCH current user email notification preferences. */
export async function GET() {
  try {
    const profile = await requireUser();
    const prefs = parseUserPrefs(profile.notificationPrefsJSON);
    return NextResponse.json({ prefs });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json().catch(() => ({}));
    const current = parseUserPrefs(profile.notificationPrefsJSON);
    const next: UserNotificationPrefs = {
      emailEnabled:
        typeof body.emailEnabled === 'boolean' ? body.emailEnabled : current.emailEnabled,
      mutedEvents: Array.isArray(body.mutedEvents)
        ? body.mutedEvents.map(String)
        : current.mutedEvents,
    };
    await prisma.userProfile.update({
      where: { id: profile.id },
      data: { notificationPrefsJSON: JSON.stringify(next) },
    });
    return NextResponse.json({ prefs: next });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
