import { NextResponse } from 'next/server';
import { runLLM } from '@/lib/llm-client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { computeSessionPoints, badgeForSession } from '@/lib/points';
import { applyPostSessionAwards } from '@/lib/trainer/post-session';
import { computeIntegrityFlags } from '@/lib/trainer/integrity';
import {
  hasBlockingIntegrity,
  VERIFY_SCORE_THRESHOLD,
} from '@/lib/integrity-gate';
import { dispatchWebhooks } from '@/lib/webhooks';
import { rateLimit } from '@/lib/rate-limit';
import { deductMinutes, getMinuteBalance } from '@/lib/minutes';
import { captureException } from '@/lib/observability';
import { PRACTICE_GATE_SCORE, trackEvent, trackStreakMilestone } from '@/lib/posthog/analytics';

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
    const rl = rateLimit({
      key: `scorecard:${profile.id}`,
      limit: 15,
      windowMs: 60_000,
    });
    if (!rl.ok) {
      return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const {
      transcript,
      coachLog = [],
      prospectId,
      scenarioType = 'standard',
      focusArea = 'standard',
      difficulty = 'medium',
      duration = 0,
      brandId: clientBrandId,
      packId: clientPackId,
      gateHoldId,
      clientRequestId,
    } = body;

    if (!transcript) {
      return NextResponse.json({ error: 'Missing transcript' }, { status: 400 });
    }

    // Idempotency: return existing session if client retries — with fresh minutes
    if (clientRequestId) {
      const existing = await prisma.trainerSession.findFirst({
        where: { userId: profile.id, clientRequestId: String(clientRequestId).slice(0, 64) },
      });
      if (existing) {
        const fresh = await prisma.userProfile.findUnique({ where: { id: profile.id } });
        const bal = fresh ? await getMinuteBalance(fresh) : await getMinuteBalance(profile);
        return NextResponse.json({
          scorecard: JSON.parse(existing.scorecardJSON),
          sessionId: existing.id,
          pointsEarned: existing.pointsEarned,
          minutesUsed: 0,
          minutesRemaining: bal.available,
          minuteSource: bal.source,
          idempotent: true,
        });
      }
    }

    // Bind brand/pack from trusted gate hold — reject client mismatch
    let trustedBrandId: string | null = null;
    let trustedPackId: string | null = null;
    let holdId: string | null = gateHoldId ? String(gateHoldId).slice(0, 64) : null;

    if (holdId) {
      const hold = await prisma.minuteHold.findUnique({ where: { id: holdId } });
      if (!hold || hold.userId !== profile.id) {
        return NextResponse.json({ error: 'Invalid session gate' }, { status: 400 });
      }
      if (hold.consumedAt) {
        // Already scored via this hold — treat as idempotent miss unless clientRequestId matched above
        return NextResponse.json({ error: 'Session gate already used' }, { status: 409 });
      }
      trustedBrandId = hold.brandId;
      trustedPackId = hold.packId;
      if (clientBrandId && hold.brandId && String(clientBrandId) !== hold.brandId) {
        return NextResponse.json(
          { error: 'brandId does not match session gate' },
          { status: 400 }
        );
      }
      if (clientPackId && hold.packId && String(clientPackId) !== hold.packId) {
        return NextResponse.json(
          { error: 'packId does not match session gate' },
          { status: 400 }
        );
      }
    } else {
      // No hold: do not trust client brand/pack for awards
      trustedBrandId = null;
      trustedPackId = null;
    }

    const requestedMinutes = Math.max(1, Math.ceil(Number(duration || 0) / 60));
    const balance = await getMinuteBalance(profile);
    // Hold already reserved 1 min. Charge what we can so long calls still save.
    const spendable = balance.available + (holdId ? 1 : 0);
    if (spendable < 1) {
      return NextResponse.json(
        {
          error: 'Not enough practice minutes. Upgrade, buy a pack, or ask your team manager.',
          minutesRemaining: balance.available,
          source: balance.source,
        },
        { status: 402 }
      );
    }
    const minutesUsed = Math.min(requestedMinutes, spendable);
    const minutesShortfall = requestedMinutes > minutesUsed;

    function extractJsonObject(text: string): string {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
      return cleaned;
    }

    function heuristicScorecard(rawTranscript: string) {
      const lines = String(rawTranscript)
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const userTurns = lines.filter((l) => /^USER:/i.test(l)).length;
      const prospectTurns = lines.filter((l) =>
        /^(PROSPECT|GATEKEEPER|DECISION_MAKER):/i.test(l)
      ).length;
      const base = Math.min(72, 38 + userTurns * 6 + prospectTurns * 4);
      const overall = Math.max(25, Math.min(78, base));
      return {
        overallScore: overall,
        scores: {
          opening: overall - 4,
          discovery: overall - 6,
          value: overall - 2,
          objections: overall - 8,
          closing: overall - 10,
          tone: overall,
          strategy: overall - 5,
        },
        feedback: {
          strengths: ['Completed a live practice call', 'Kept the conversation moving'],
          improvements: [
            'Scorecard AI was unavailable — re-score later for full coaching detail',
            'Ask one sharper discovery question next call',
          ],
        },
        summary:
          'Heuristic score applied because the AI scorecard was unavailable. Practice still counts toward minutes and points.',
        _heuristic: true,
      };
    }

    let scorecard: any;
    let cleanJson = '';
    try {
      const evaluationText = await runLLM(
        SCORING_RUBRIC,
        `Evaluate this cold call transcript:\n\n${transcript}`,
        {
          temperature: 0.1,
          jsonMode: true,
          distinctId: profile.id,
          spanName: 'trainer_scorecard',
        }
      );
      cleanJson = extractJsonObject(evaluationText);
      scorecard = JSON.parse(cleanJson);
      if (typeof scorecard.overallScore !== 'number') {
        throw new Error('missing overallScore');
      }
    } catch (err) {
      console.error('Scorecard LLM/parse failed — using heuristic fallback', err);
      scorecard = heuristicScorecard(String(transcript));
      cleanJson = JSON.stringify(scorecard);
    }

    const overallScore = Number(scorecard.overallScore) || 0;
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

    const integrityFlags = computeIntegrityFlags({
      transcript: String(transcript),
      durationSeconds: Number(duration || 0),
      overallScore,
      coachLogCount: Array.isArray(coachLog) ? coachLog.length : 0,
    });
    const integrityJSON = integrityFlags.length ? JSON.stringify(integrityFlags) : null;
    const blocked = hasBlockingIntegrity(integrityJSON);

    const rawPoints = computeSessionPoints({
      overallScore,
      difficulty,
      durationSeconds: Number(duration || 0),
      focus: focusArea,
      streakDays: streak,
    });
    const pointsEarned = blocked ? Math.floor(rawPoints * 0.25) : rawPoints;

    const coachLogJSON =
      Array.isArray(coachLog) && coachLog.length > 0 ? JSON.stringify(coachLog) : null;

    const newBadge = blocked ? null : badgeForSession(focusArea, overallScore);
    let badges: string[] = [];
    try {
      badges = JSON.parse(profile.badges || '[]');
    } catch {
      badges = [];
    }
    if (newBadge && !badges.includes(newBadge)) badges.push(newBadge);

    const priorSessionCount = await prisma.trainerSession.count({
      where: { userId: profile.id },
    });

    // Atomic: deduct minutes THEN create session (or both in one tx)
    const txResult = await prisma.$transaction(async (tx) => {
      const deducted = await deductMinutes(profile, minutesUsed, {
        holdId,
        tx,
      });
      if (!deducted.ok) {
        return { ok: false as const, error: deducted.error };
      }

      const savedSession = await tx.trainerSession.create({
        data: {
          userId: profile.id,
          prospectId: prospectId || null,
          brandId: trustedBrandId,
          packId: trustedPackId,
          gateHoldId: holdId,
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
          integrityFlags: integrityJSON,
          clientRequestId: clientRequestId ? String(clientRequestId).slice(0, 64) : null,
        },
      });

      await tx.userProfile.update({
        where: { id: profile.id },
        data: {
          totalPoints: { increment: pointsEarned },
          currentStreak: streak,
          longestStreak: Math.max(profile.longestStreak, streak),
          lastSessionDate: today,
          badges: JSON.stringify(badges),
        },
      });

      return { ok: true as const, savedSession, deducted };
    });

    if (!txResult.ok) {
      return NextResponse.json(
        { error: txResult.error, minutesRemaining: balance.available },
        { status: 402 }
      );
    }

    const { savedSession, deducted } = txResult;

    trackStreakMilestone(profile.id, streak);

    // Auto-verify: only truly clean sessions (null or empty flags) count
    let becameVerified = false;
    if (!blocked && overallScore >= VERIFY_SCORE_THRESHOLD && !integrityFlags.length) {
      const rep = await prisma.repProfile.findUnique({ where: { userId: profile.id } });
      if (rep && !rep.verified) {
        const needed = profile.plan === 'PRO' || profile.plan === 'TEAM' ? 2 : 3;
        const cleanCount = await prisma.trainerSession.count({
          where: {
            userId: profile.id,
            overallScore: { gte: VERIFY_SCORE_THRESHOLD },
            OR: [{ integrityFlags: null }, { integrityFlags: '[]' }],
          },
        });
        if (cleanCount >= needed) {
          await prisma.repProfile.update({
            where: { id: rep.id },
            data: { verified: true },
          });
          becameVerified = true;
        }
      }
    }

    if (becameVerified) {
      trackEvent(profile.id, 'rep_verified', {
        role: 'REP',
        sessionId: savedSession.id,
        overallScore,
      });
    }

    const awards = await applyPostSessionAwards({
      userId: profile.id,
      overallScore,
      focusArea,
      pointsEarned,
      brandId: trustedBrandId,
      packId: trustedPackId,
      integrityFlagsJSON: integrityJSON,
      sessionId: savedSession.id,
    });

    void dispatchWebhooks({
      event: 'session.scored',
      userId: profile.id,
      payload: {
        sessionId: savedSession.id,
        overallScore,
        focusArea,
        pointsEarned,
        blocked,
      },
    });

    trackEvent(profile.id, 'practice_session_completed', {
      role: 'REP',
      sessionId: savedSession.id,
      overallScore,
      focusArea,
      duration: Number(duration || 0),
      isFirstSession: priorSessionCount === 0,
      blocked,
      clearedGate: !blocked && overallScore >= PRACTICE_GATE_SCORE,
      pointsEarned,
      brandId: trustedBrandId,
      packId: trustedPackId,
    });

    if (!blocked && overallScore >= PRACTICE_GATE_SCORE) {
      trackEvent(profile.id, 'practice_gate_cleared', {
        role: 'REP',
        sessionId: savedSession.id,
        overallScore,
        focusArea,
        brandId: trustedBrandId,
        packId: trustedPackId,
      });
    }

    return NextResponse.json({
      scorecard,
      sessionId: savedSession.id,
      pointsEarned,
      minutesUsed,
      minutesRequested: requestedMinutes,
      minutesShortfall,
      minutesRemaining: deducted.remaining,
      minuteSource: deducted.source,
      badge: newBadge,
      streak,
      integrityFlags,
      blocked,
      certification: awards.certification || null,
      bountiesCleared: awards.bountiesCleared,
      bountyCreditsEarned: awards.bountyCreditsEarned,
      tournamentUpdates: awards.tournamentUpdates,
      notice: minutesShortfall
        ? `Call ran longer than your remaining minutes — scored and charged ${minutesUsed} of ${requestedMinutes} min.`
        : undefined,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    console.error('Scorecard error:', error);
    captureException(error, { route: 'scorecard' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
