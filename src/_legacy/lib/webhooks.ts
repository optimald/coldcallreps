import { createHmac } from 'crypto';
import { prisma } from '@/lib/prisma';

export async function dispatchWebhooks(opts: {
  event: string;
  payload: Record<string, unknown>;
  userId?: string | null;
}) {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        active: true,
        ...(opts.userId ? { userId: opts.userId } : {}),
      },
      take: 50,
    });

    await Promise.all(
      endpoints.map(async (ep) => {
        let events: string[] = [];
        try {
          events = JSON.parse(ep.events || '[]');
        } catch {
          events = [];
        }
        if (events.length && !events.includes(opts.event) && !events.includes('*')) {
          return;
        }
        const body = JSON.stringify({
          event: opts.event,
          createdAt: new Date().toISOString(),
          data: opts.payload,
        });
        const sig = createHmac('sha256', ep.secret).update(body).digest('hex');
        try {
          const res = await fetch(ep.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CCR-Signature': sig,
              'X-CCR-Event': opts.event,
            },
            body,
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) {
            const text = await res.text().catch(() => '');
            await prisma.webhookEndpoint.update({
              where: { id: ep.id },
              data: {
                lastAttemptAt: new Date(),
                lastError: `HTTP ${res.status}: ${text.slice(0, 200)}`,
              },
            });
          } else {
            await prisma.webhookEndpoint.update({
              where: { id: ep.id },
              data: { lastAttemptAt: new Date(), lastError: null },
            });
          }
        } catch (e: any) {
          console.error('webhook delivery failed', ep.id, e);
          await prisma.webhookEndpoint
            .update({
              where: { id: ep.id },
              data: {
                lastAttemptAt: new Date(),
                lastError: String(e?.message || e).slice(0, 300),
              },
            })
            .catch(() => {});
        }
      })
    );
  } catch (e) {
    console.error('dispatchWebhooks', e);
  }
}
