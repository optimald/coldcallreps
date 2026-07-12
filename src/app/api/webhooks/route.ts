import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const profile = await requireUser();
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { userId: profile.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        events: true,
        active: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ endpoints });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const url = String(body.url || '').trim();
    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
      return NextResponse.json({ error: 'url must be https (or localhost)' }, { status: 400 });
    }
    const events = Array.isArray(body.events)
      ? body.events.map(String)
      : ['session.scored', 'bounty.cleared', 'application.submitted'];
    const secret = randomBytes(24).toString('hex');

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        userId: profile.id,
        url: url.slice(0, 500),
        secret,
        events: JSON.stringify(events),
        active: true,
      },
    });

    return NextResponse.json({
      endpoint: {
        id: endpoint.id,
        url: endpoint.url,
        events,
        secret,
        notice: 'Store the secret now — it is only shown once.',
      },
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const profile = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.webhookEndpoint.deleteMany({ where: { id, userId: profile.id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
