import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { buildTrainerScenarioPrompt } from '@/lib/trainer/scenario-prompt';
import { prisma } from '@/lib/prisma';
import { internalSecretOk } from '@/lib/gate-token';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const internal = internalSecretOk(req.headers.get('x-trainer-internal'));
    const session = await auth();
    if (!internal && !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = rateLimit({
      key: `prompt:${session.userId || req.headers.get('cf-connecting-ip') || 'anon'}`,
      limit: 60,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const {
      prospectId,
      leadId,
      difficulty = 'medium',
      focus = 'standard',
      hintMode = false,
      prospectOverride,
      brandId,
      packId,
      playbookId,
      userId: bodyUserId,
      orgId: bodyOrgId,
    } = body;

    let userId = bodyUserId || null;
    let orgId = bodyOrgId || null;
    if (!userId && session.userId) {
      userId = session.userId;
      const profile = await prisma.userProfile.findUnique({ where: { id: session.userId } });
      orgId = profile?.orgId || null;
    }

    const result = await buildTrainerScenarioPrompt({
      prospectId: prospectId || leadId || null,
      difficulty,
      focus,
      hintMode,
      prospectOverride,
      brandId: brandId || null,
      packId: packId || null,
      playbookId: playbookId || null,
      userId,
      orgId,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Trainer prompt error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
