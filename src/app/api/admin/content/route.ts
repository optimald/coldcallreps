import { NextResponse } from 'next/server';
import { requireOps } from '@/lib/auth';
import { loadAdminContentOps } from '@/lib/admin-phase46-data';
import { prisma } from '@/lib/prisma';
import { writeAudit } from '@/lib/audit';
import { assertAdminLiveWrites } from '@/lib/admin-demo-guard';

function err(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  if (message === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Content ops required' }, { status: 403 });
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export async function GET() {
  try {
    await requireOps('content.ops');
    return NextResponse.json(await loadAdminContentOps());
  } catch (e) {
    return err(e);
  }
}

export async function POST(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('content.ops');
    const body = await req.json();
    const slug = String(body.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');
    const title = String(body.title || '').trim();
    const focusArea = String(body.focusArea || 'gatekeeper').trim();
    const difficultyRaw = String(body.difficulty || 'medium').trim().toLowerCase();
    const difficulty = ['easy', 'medium', 'hard'].includes(difficultyRaw)
      ? difficultyRaw
      : 'medium';
    if (!slug || !title) {
      return NextResponse.json({ error: 'slug and title required' }, { status: 400 });
    }

    let promptPayload: unknown = body.prompt;
    if (promptPayload == null || promptPayload === '') {
      const promptText = String(body.promptText || body.instructions || '').trim();
      promptPayload = promptText ? { instructions: promptText } : {};
    } else if (typeof promptPayload === 'string') {
      const trimmed = promptPayload.trim();
      if (!trimmed) {
        promptPayload = {};
      } else {
        try {
          promptPayload = JSON.parse(trimmed);
        } catch {
          promptPayload = { instructions: trimmed };
        }
      }
    }

    const scenario = await prisma.practiceScenario.create({
      data: {
        slug,
        title,
        focusArea,
        difficulty,
        description: body.description ? String(body.description).trim() : null,
        promptJSON: JSON.stringify(promptPayload ?? {}),
        active: body.active !== false,
        sortOrder: Number(body.sortOrder) || 0,
      },
    });
    await writeAudit({
      actorId: admin.id,
      action: 'admin.scenario.create',
      targetType: 'PracticeScenario',
      targetId: scenario.id,
      meta: { slug, title },
    });
    return NextResponse.json({ scenario });
  } catch (e) {
    return err(e);
  }
}

export async function PATCH(req: Request) {
  const demoBlock = await assertAdminLiveWrites();
  if (demoBlock) return demoBlock;

  try {
    const admin = await requireOps('content.ops');
    const body = await req.json();
    const id = String(body.id || '');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (body.kind === 'bounty' || body.kind === 'board' || body.kind === 'pack') {
      const active = Boolean(body.active);
      if (body.kind === 'bounty') {
        await prisma.bounty.update({ where: { id }, data: { active } });
      } else if (body.kind === 'board') {
        await prisma.sponsoredBoard.update({ where: { id }, data: { active } });
      } else {
        await prisma.productPack.update({ where: { id }, data: { active } });
      }
      await writeAudit({
        actorId: admin.id,
        action: `admin.content.${body.kind}_toggle`,
        targetType: body.kind,
        targetId: id,
        meta: { active },
      });
      return NextResponse.json({ ok: true });
    }

    const scenario = await prisma.practiceScenario.update({
      where: { id },
      data: {
        ...(typeof body.active === 'boolean' ? { active: body.active } : {}),
        ...(body.title ? { title: String(body.title) } : {}),
        ...(body.focusArea ? { focusArea: String(body.focusArea) } : {}),
        ...(body.difficulty ? { difficulty: String(body.difficulty) } : {}),
        ...(body.description !== undefined
          ? { description: body.description ? String(body.description) : null }
          : {}),
      },
    });
    await writeAudit({
      actorId: admin.id,
      action: 'admin.scenario.update',
      targetType: 'PracticeScenario',
      targetId: id,
      meta: body,
    });
    return NextResponse.json({ scenario });
  } catch (e) {
    return err(e);
  }
}
