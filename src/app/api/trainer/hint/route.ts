import { NextResponse } from 'next/server';
import { generateLiveCoachHint } from '@/lib/trainer/live-coach';
import { getTrainerHint } from '@/lib/trainer/gatekeeper-hints';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      transcript = [],
      phase = 'gatekeeper',
      gatekeeperName = 'Sarah',
      decisionMakerName = 'Mike',
      companyName = 'the business',
      difficulty = 'medium',
      priorSuggestions = [],
    } = body;

    if (!Array.isArray(transcript)) {
      return NextResponse.json({ error: 'transcript must be an array' }, { status: 400 });
    }

    try {
      const hint = await generateLiveCoachHint({
        transcript,
        phase,
        gatekeeperName,
        decisionMakerName,
        companyName,
        difficulty,
        priorSuggestions,
      });
      return NextResponse.json({ hint, source: 'llm' });
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
