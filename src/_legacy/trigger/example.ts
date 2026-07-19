import { logger, task } from '@trigger.dev/sdk';

/** Dashboard smoke-test task from Trigger.dev init. */
export const helloWorldTask = task({
  id: 'hello-world',
  retry: { maxAttempts: 1 },
  run: async (payload: { message?: string }) => {
    logger.info('Hello from ColdCallReps Trigger worker', {
      message: payload.message ?? 'hello-world',
    });
    return { ok: true as const, at: new Date().toISOString() };
  },
});
