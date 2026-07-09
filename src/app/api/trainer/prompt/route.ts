import { NextResponse } from 'next/server';
import { buildTrainerScenarioPrompt } from '@/lib/trainer/scenario-prompt';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      prospectId,
      leadId,
      difficulty = 'medium',
      focus = 'standard',
      hintMode = false,
      prospectOverride,
    } = body;

    const result = await buildTrainerScenarioPrompt({
      prospectId: prospectId || leadId || null,
      difficulty,
      focus,
      hintMode,
      prospectOverride,
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Trainer prompt error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
