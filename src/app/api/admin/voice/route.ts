import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminVoiceOps } from '@/lib/admin-phase46-data';

export async function GET() {
  try {
    await requireOps('voice.ops');
    return NextResponse.json(await loadAdminVoiceOps());
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Voice ops required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
