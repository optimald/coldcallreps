import { NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { loadAdminPlatformOverview } from '@/lib/admin-platform';

export async function GET() {
  try {
    await requireSuperadmin();
    const data = await loadAdminPlatformOverview();
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Superadmin required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
