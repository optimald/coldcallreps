import { NextResponse } from 'next/server';
import { runLLM } from '@/lib/llm-client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { computeSessionPoints, badgeForSession } from '@/lib/points';

const SCORING_RUBRIC = `
You are an expert sales coach evaluating a cold call transcript.
Analyze the transcript and provide a structured JSON evaluation based on this rubric:
- Opening & Hook (15%): Personalized opener, relevance, clear intro.
- Discovery & Listening (20%): Quality of questions, referencing what prospect said, uncovering pain.
- Value & Pricing (20%): Framing ROI, handling price objections, confidence.
- Objection Handling (20%): Speed & effectiveness, turning rejections into opportunities.
- Closing & Next Steps (10%): Clear ask, handling stalls.
- Tone & Delivery (10%): Professionalism, adaptability.
- Overall Strategy (5%): Logical progression.

You must return ONLY a JSON object (no markdown formatting, no backticks) with the following structure:
{
  "overallScore": number (0-100),
  "scores": {
    "opening": number,
    "discovery": number,
    "value": number,
    "objections": number,
    "closing": number,
    "tone": number,
    "strategy": number
  },
  "feedback": {
    "strengths": ["...", "..."],
    "improvements": ["...", "..."]
  },
  "summary": "A brief 2-sentence summary of the call performance."
}
`;

export async function POST(req: Request) {
  try {
    const profile = await requireUser();
    const body = await req.json();
    const {
      transcript,
      coachLog = [],
      prospectId,
      scenarioType = 'standard',
      focusArea = 'standard',
      difficulty = 'medium',
      duration = 0,
    } = body;

    if (!transcript) {
      return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
    }

    const minutesUsed = Math.max(1, Math.ceil(Number(duration || 0) / 60));
    if (profile.minutesRemaining < minutesUsed) {
      return NextResponse.json(
        { error: 'Not enough practice minutes. Upgrade or refer friends for more.' },
        { status: 402 }
      );
    }

    const evaluationText = await runLLM(SCORING_RUBRIC, `Evaluate this cold call transcript:\n\n${transcript}`, {
      temperature: 0.1,
    });

    const cleanJson = evaluationText.replace(/```json/g, '').replace(/```/g, '').trim();
    let scorecard;
    try {
      scorecard = JSON.parse(cleanJson);
    } catch {
      console.error('Failed to parse scorecard JSON:', cleanJson);
      return NextResponse.json({ error: 'AI returned invalid JSON format' }, { status: 500 });
    }

    const overallScore = scorecard.overallScore || 0;
    const today = new Date();
    const last = profile.lastSessionDate;
    let streak = profile.currentStreak || 0;
    if (last) {
      const diffDays = Math.floor(
        (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
          Date.UTC(last.getFullYear(), last.getMonth(), last.getDate())) /
          86400000
      );
      if (diffDays === 1) streak += 1;
      else if (diffDays > 1) streak = 1;
    } else {
      streak = 1;
    }

    const pointsEarned = computeSessionPoints({
      overallScore,
      difficulty,
      durationSeconds: Number(duration || 0),
      focus: focusArea,
      streakDays: streak,
    });

    const coachLogJSON =
      Array.isArray(coachLog) && coachLog.length > 0 ? JSON.stringify(coachLog) : null;

    const savedSession = await prisma.trainerSession.create({
      data: {
        userId: profile.id,
        prospectId: prospectId || null,
        scenarioType,
        focusArea,
        difficulty,
        transcript,
        scorecardJSON: cleanJson,
        overallScore,
        categoryScores: JSON.stringify(scorecard.scores || {}),
        duration: Number(duration || 0),
        pointsEarned,
        coachLogJSON,
      },
    });

    const newBadge = badgeForSession(focusArea, overallScore);
    let badges: string[] = [];
    try {
      badges = JSON.parse(profile.badges || '[]');
    } catch {
      badges = [];
    }
    if (newBadge && !badges.includes(newBadge)) badges.push(newBadge);

    await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        minutesRemaining: { decrement: minutesUsed },
        minutesUsed: { increment: minutesUsed },
        totalPoints: { increment: pointsEarned },
        currentStreak: streak,
        longestStreak: Math.max(profile.longestStreak, streak),
        lastSessionDate: today,
        badges: JSON.stringify(badges),
      },
    });

    return NextResponse.json({
      scorecard,
      sessionId: savedSession.id,
      pointsEarned,
      minutesUsed,
      badge: newBadge,
      streak,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Scorecard error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
