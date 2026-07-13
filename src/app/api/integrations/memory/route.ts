import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { upsertCoachMemory } from '@/lib/trainer/coach-memory';

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const key = String(body.key || '').trim();
    if (!key) return NextResponse.json({ error: 'key required' }, { status: 400 });
    const value = body.value ?? {};
    const memory = await upsertCoachMemory(profile.id, key, value);
    return NextResponse.json({ memory });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
