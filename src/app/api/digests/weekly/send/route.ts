import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';

async function runWeeklyDigest() {
  const subs = await prisma.digestSubscription.findMany({
    where: { enabled: true },
    include: { user: { select: { displayName: true, email: true } } },
  });

  const leaders = await prisma.userProfile.findMany({
    orderBy: { totalPoints: 'desc' },
    take: 10,
    select: {
      displayName: true,
      totalPoints: true,
      currentStreak: true,
      repProfile: { select: { slug: true } },
    },
  });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://coldcallreps.com').replace(/\/$/, '');
  const rows = leaders
    .map(
      (p, i) =>
        `<tr><td>${i + 1}</td><td>${p.displayName || 'Rep'}</td><td>${p.totalPoints}</td><td>${p.currentStreak}</td></tr>`
    )
    .join('');

  const html = `
    <h1>Weekly Top Reps</h1>
    <p>Here's who's grinding on Cold Call Reps this week.</p>
    <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse">
      <thead><tr><th>#</th><th>Rep</th><th>Points</th><th>Streak</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">No sessions yet</td></tr>'}</tbody>
    </table>
    <p><a href="${appUrl}/leaderboard">View full leaderboard</a> · <a href="${appUrl}/trainer">Practice now</a></p>
  `;

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    const to = sub.email || sub.user.email;
    if (!to) {
      failed += 1;
      continue;
    }
    const result = await sendEmail({
      to,
      subject: 'Weekly Top Reps — Cold Call Reps',
      html,
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return { subscribers: subs.length, sent, failed, leaders: leaders.length };
}

/** Cron / manual: send Weekly Top Reps to enabled digest subscribers. */
export async function GET(req: Request) {
  try {
    const auth = req.headers.get('authorization') || '';
    const cronSecret = process.env.CRON_SECRET;
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    const ok =
      (cronSecret && (auth === `Bearer ${cronSecret}` || key === cronSecret)) ||
      (!cronSecret && process.env.NODE_ENV !== 'production');

    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runWeeklyDigest();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
