import { NextResponse } from 'next/server';
import { payBaseForAllOpenCampaigns } from '@/lib/base-payout';

function authorized(req: Request): boolean {
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  return (
    (Boolean(cronSecret) && (auth === `Bearer ${cronSecret}` || key === cronSecret)) ||
    (!cronSecret && process.env.NODE_ENV !== 'production')
  );
}

/** Daily cron: pay due base periods for OPEN campaigns. */
export async function GET(req: Request) {
  try {
    if (!authorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const result = await payBaseForAllOpenCampaigns();
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    console.error('[cron/base-pay]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
