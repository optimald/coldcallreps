import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { loadRepNavCounts } from '@/lib/nav-counts';
import { effectiveRole } from '@/lib/roles';

/** GET /api/me/nav-counts — SDR sidebar pill counters. */
export async function GET() {
  try {
    const profile = await requireUser();
    const role = effectiveRole(profile);
    if (role !== 'REP' && role !== 'MANAGER' && role !== 'SUPERADMIN') {
      return NextResponse.json({ counts: null });
    }
    const counts = await loadRepNavCounts(profile);
    return NextResponse.json(
      { counts },
      { headers: { 'Cache-Control': 'private, max-age=30' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNAUTHORIZED';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
