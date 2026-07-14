import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminAnalytics } from '@/lib/admin-phase46-data';

export async function GET() {
  try {
    await requireOps('analytics.read');
    return NextResponse.json(await loadAdminAnalytics());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Analytics access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
