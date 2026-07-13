import { NextResponse } from 'next/server';
import { weekStartUTC } from '@/lib/points';
import {
  loadTrainerLeaderboard,
  type TrainerLeaderboardPeriod,
  type TrainerLeaderboardScope,
} from '@/lib/trainer-leaderboard';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const scope = (searchParams.get('scope') || 'global') as TrainerLeaderboardScope;
    const focus = searchParams.get('focus') || undefined;
    const orgId = searchParams.get('orgId') || undefined;
    const period = (searchParams.get('period') || 'week') as TrainerLeaderboardPeriod;

    const since =
      period === 'week'
        ? weekStartUTC()
        : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const { leaderboard } = await loadTrainerLeaderboard({
      limit,
      period,
      scope,
      orgId,
      focus,
    });

    return NextResponse.json({
      leaderboard,
      scope,
      focus: focus || null,
      period,
      weekStart: since.toISOString(),
    });
  } catch (error: any) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
