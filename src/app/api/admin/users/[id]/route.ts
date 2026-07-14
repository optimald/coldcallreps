import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminUserDetail } from '@/lib/admin-ops-data';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireOps('users.read');
    const { id } = await ctx.params;
    const detail = await loadAdminUserDetail(id);
    if (!detail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
