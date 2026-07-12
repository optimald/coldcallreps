import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { checkTeamHandleAvailable } from '@/lib/profile-slug';

/** Live handle availability for team /t pages. */
export async function GET(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    if (!q.trim()) {
      return NextResponse.json({ available: false, handle: null, error: 'Enter a handle.' });
    }

    const result = await checkTeamHandleAvailable(q, profile.orgId || undefined);
    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
