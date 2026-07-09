import type { Env } from './env';
export { TrainerSession } from './trainer-session';

/**
 * Routes browser WebSocket upgrades to a fresh Durable Object per call.
 * Path: /api/trainer/realtime
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ ok: true, service: 'coldcallreps-trainer-realtime' });
    }

    if (
      url.pathname === '/api/trainer/realtime' ||
      url.pathname === '/api/trainer/realtime/'
    ) {
      const upgrade = request.headers.get('Upgrade');
      if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      // One DO per training session (unique id)
      const id = env.TRAINER_SESSION.newUniqueId();
      const stub = env.TRAINER_SESSION.get(id);
      return stub.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
