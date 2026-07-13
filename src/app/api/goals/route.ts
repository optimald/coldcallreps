import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { loadVerifiedGoals } from '@/lib/verified-goals';

/** GET verified goals for the signed-in SDR (their payout-eligible outcomes). */
export async function GET() {
  try {
    const profile = await requireUser();
    const goals = await loadVerifiedGoals({ repUserId: profile.id, take: 100 });
    return NextResponse.json({ goals });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed';
    if (msg === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
