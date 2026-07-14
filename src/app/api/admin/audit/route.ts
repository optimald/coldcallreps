import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminAuditLog } from '@/lib/admin-ops-data';

export async function GET(req: Request) {
  try {
    await requireOps('audit.read');
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const action = searchParams.get('action') || '';
    const data = await loadAdminAuditLog({ q, action });
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Audit access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
