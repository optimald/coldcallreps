import { runLLM } from '@/lib/llm-client';

export interface LiveCoachHint {
  sayNext: string;
}

export interface LiveCoachTranscriptLine {
  role: 'user' | 'gatekeeper' | 'decision_maker' | 'prospect';
  text: string;
}

const COACH_MODEL = process.env.XAI_COACH_MODEL || 'grok-3-mini';
const COACH_MODEL_PRIORITY =
  process.env.XAI_COACH_MODEL_PRIORITY || process.env.XAI_MODEL || 'grok-4.3';

const COACH_SYSTEM = `You whisper the trainee's next line during a live cold call practice session.
They are an outbound SDR / hustler practicing cold calls (often $500 website pitches or classic drills).

Return ONLY JSON: {"sayNext":"..."}

Rules:
- 1-3 sentences, first person, natural phone speech
- Respond directly to the last prospect line
- Gatekeeper phase: earn transfer — name, reason, polite ask. No product pitch to gatekeeper
- Boss phase: brief intro, respect time, one discovery question
- Pen drill: discovery before features
- Never mention AI or coaching
- Never repeat what the trainee just said — suggest the NEXT move
- If trainee already asked for the decision maker, pivot: callback time, direct line, or who owns vendor calls`;

function formatTranscript(
  lines: LiveCoachTranscriptLine[],
  gatekeeperName: string,
  decisionMakerName: string
): string {
  return lines
    .slice(-12)
    .map((line) => {
      const label =
        line.role === 'user'
          ? 'Trainee'
          : line.role === 'gatekeeper'
            ? gatekeeperName
            : line.role === 'decision_maker'
              ? decisionMakerName
              : 'Prospect';
      return `${label}: ${line.text}`;
    })
    .join('\n');
}

function parseCoachResponse(raw: string): LiveCoachHint {
  const clean = raw.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(clean);
  const sayNext = String(parsed.sayNext || parsed.say_next || '').trim();
  if (!sayNext) throw new Error('Missing sayNext');
  return { sayNext };
}

export async function generateLiveCoachHint(options: {
  transcript: LiveCoachTranscriptLine[];
  phase: string;
  gatekeeperName: string;
  decisionMakerName: string;
  companyName: string;
  difficulty: string;
  priorSuggestions?: string[];
  coachMemoryBlock?: string | null;
  playbookBlock?: string | null;
  /** Pro/Team get the priority coach model. */
  priority?: boolean;
}): Promise<LiveCoachHint> {
  const {
    transcript,
    phase,
    gatekeeperName,
    decisionMakerName,
    companyName,
    difficulty,
    priorSuggestions = [],
    coachMemoryBlock,
    playbookBlock,
    priority = false,
  } = options;

  if (transcript.length === 0) {
    return {
      sayNext: `Hi ${gatekeeperName}, this is [Your Name] — is ${decisionMakerName.split(' ')[0]} available?`,
    };
  }

  const formatted = formatTranscript(transcript, gatekeeperName, decisionMakerName);
  const lastProspect = [...transcript].reverse().find((e) => e.role !== 'user');
  const lastUser = [...transcript].reverse().find((e) => e.role === 'user');

  const priorBlock =
    priorSuggestions.length > 0
      ? `\nDo NOT repeat these prior coach lines:\n${priorSuggestions.map((s) => `- "${s}"`).join('\n')}\n`
      : '';

  const userBlock = lastUser
    ? `\nTrainee's last line (do NOT parrot this — suggest what to say NEXT):\n"${lastUser.text}"\n`
    : '';

  const contextBlocks = [
    coachMemoryBlock ? `\n${coachMemoryBlock}\n` : '',
    playbookBlock ? `\n${playbookBlock}\n` : '',
  ].join('');

  const userPrompt = `Company: ${companyName} | Phase: ${phase} | Difficulty: ${difficulty}
${contextBlocks}
Last thing the prospect just said (respond to THIS):
"${lastProspect?.text || ''}"
${userBlock}${priorBlock}
Recent transcript:
${formatted}

Trainee's next spoken line only — must be different from prior coach lines:`;

  const raw = await runLLM(COACH_SYSTEM, userPrompt, {
    temperature: 0.4,
    jsonMode: true,
    model: priority ? COACH_MODEL_PRIORITY : COACH_MODEL,
  });
  return parseCoachResponse(raw);
}
