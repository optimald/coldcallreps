import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateLiveCoachHint } from '@/lib/trainer/live-coach';
import { getTrainerHint } from '@/lib/trainer/gatekeeper-hints';
import { loadCoachMemoryBlock } from '@/lib/trainer/coach-memory';
import { resolvePlaybookContext } from '@/lib/trainer/playbook-context';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session.userId) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    const rl = rateLimit({
      key: `hint:${session.userId}`,
      limit: 40,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const {
      transcript = [],
      phase = 'gatekeeper',
      gatekeeperName = 'Sarah',
      decisionMakerName = 'Mike',
      companyName = 'the business',
      difficulty = 'medium',
      priorSuggestions = [],
      playbookId,
    } = body;

    if (!Array.isArray(transcript)) {
      return NextResponse.json({ error: 'transcript must be an array' }, { status: 400 });
    }

    let coachMemoryBlock: string | null = null;
    let playbookBlock: string | null = null;
    const userId = session.userId;
    const profile = await prisma.userProfile.findUnique({ where: { id: userId } });
    coachMemoryBlock = await loadCoachMemoryBlock(userId);
    if (playbookId) {
      const pb = await resolvePlaybookContext({
        userId,
        orgId: profile?.orgId,
        playbookId: String(playbookId),
      });
      playbookBlock = pb?.block || null;
    }
    const priority = profile?.plan === 'PRO' || profile?.plan === 'TEAM';

    try {
      const hint = await generateLiveCoachHint({
        transcript,
        phase,
        gatekeeperName,
        decisionMakerName,
        companyName,
        difficulty,
        priorSuggestions,
        coachMemoryBlock,
        playbookBlock,
        priority,
      });
      return NextResponse.json({ hint, source: 'llm', priority });
    } catch (llmErr) {
      console.warn('[Trainer hint] LLM failed, using fallback:', llmErr);
      const fallback = getTrainerHint({
        phase: phase as 'gatekeeper' | 'decision_maker' | 'prospect',
        transcript: transcript.map((e: { role: string; text: string }, i: number) => ({
          role: e.role as 'user' | 'prospect' | 'gatekeeper' | 'decision_maker',
          text: e.text,
          id: i + 1,
          seq: i + 1,
        })),
        gatekeeperName,
        decisionMakerName,
        companyName,
        isProspectSpeaking: false,
      });
      return NextResponse.json({
        hint: {
          sayNext: fallback.example?.replace(/^["']|["']$/g, '') || fallback.body,
        },
        source: 'fallback',
      });
    }
  } catch (error: any) {
    console.error('[Trainer hint]', error);
    return NextResponse.json({ error: error.message || 'Failed to generate hint' }, { status: 500 });
  }
}
