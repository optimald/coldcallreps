/**
 * Trigger.dev task for daily base-pay runs.
 * Prefer HTTP cron POST /api/cron/base-pay when TRIGGER is unavailable.
 */
import { logger, task } from '@trigger.dev/sdk';
import { payBaseForAllOpenCampaigns } from '@/lib/base-payout';

export const BASE_PAY_TASK_ID = 'base-pay-daily';

export const basePayDailyTask = task({
  id: BASE_PAY_TASK_ID,
  retry: { maxAttempts: 2 },
  run: async () => {
    logger.info('Running base pay for open campaigns');
    const result = await payBaseForAllOpenCampaigns();
    logger.info('Base pay complete', {
      campaigns: result.campaigns,
      paid: result.paid,
      pending: result.pending,
      failed: result.failed,
    });
    return result;
  },
});
