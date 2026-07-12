import { runLLM } from '@/lib/llm-client';

export type AppointmentAuditResult = {
  passed: boolean;
  score: number;
  reasons: string[];
  bant: {
    budget?: boolean;
    authority?: boolean;
    need?: boolean;
    timing?: boolean;
  };
  raw?: string;
};

/**
 * AI post-call audit for claimed appointments.
 * Uses xAI when configured; falls back to heuristic rules.
 */
export async function auditAppointmentClaim(opts: {
  campaignTitle: string;
  icpText?: string | null;
  goalType: string;
  notes?: string | null;
  transcriptSnippet?: string | null;
  prospectName?: string | null;
}): Promise<AppointmentAuditResult> {
  const text = [opts.notes, opts.transcriptSnippet].filter(Boolean).join('\n\n').trim();

  if (!text || text.length < 40) {
    return {
      passed: false,
      score: 20,
      reasons: ['Insufficient call notes/transcript to verify a qualified appointment.'],
      bant: {},
    };
  }

  if (process.env.XAI_API_KEY) {
    try {
      const raw = await runLLM(
        'You audit SDR appointment-set claims for fraud and quality. Return JSON only.',
        `Campaign: ${opts.campaignTitle}
Goal: ${opts.goalType}
ICP: ${opts.icpText || 'n/a'}
Prospect: ${opts.prospectName || 'n/a'}

SDR notes / transcript:
"""
${text.slice(0, 6000)}
"""

Return JSON:
{"passed":boolean,"score":0-100,"reasons":string[],"bant":{"budget":bool,"authority":bool,"need":bool,"timing":bool}}
Rules: passed=true only if a real meeting was clearly set with a decision-maker matching ICP and basic BANT signals. Flag collusion, fake bookings, no date/time, or gatekeeper-only chats.`,
        { jsonMode: true, temperature: 0.1 }
      );
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as AppointmentAuditResult;
        return {
          passed: Boolean(parsed.passed),
          score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
          reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String).slice(0, 8) : [],
          bant: parsed.bant || {},
          raw,
        };
      }
    } catch (e) {
      console.warn('[appointment-audit] LLM failed, using heuristics', e);
    }
  }

  const lower = text.toLowerCase();
  const hasMeeting =
    /meeting|calendar|booked|scheduled|tuesday|wednesday|thursday|friday|monday|am\b|pm\b|\d{1,2}:\d{2}/.test(
      lower
    );
  const hasAuthority = /owner|founder|ceo|vp|director|head of|decision/.test(lower);
  const hasNeed = /need|pain|problem|looking|interested|challenge/.test(lower);
  const redFlags = /friend|fake|just say|pretend|my cousin/.test(lower);
  const score =
    (hasMeeting ? 40 : 0) + (hasAuthority ? 25 : 0) + (hasNeed ? 20 : 0) + (text.length > 120 ? 10 : 0);
  const passed = !redFlags && hasMeeting && score >= 65;

  return {
    passed,
    score: redFlags ? Math.min(score, 30) : score,
    reasons: [
      ...(hasMeeting ? ['Meeting language detected'] : ['No clear meeting set']),
      ...(hasAuthority ? ['Authority signals present'] : ['Weak authority signals']),
      ...(redFlags ? ['Possible collusion language'] : []),
    ],
    bant: {
      authority: hasAuthority,
      need: hasNeed,
      timing: hasMeeting,
    },
  };
}
