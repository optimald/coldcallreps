import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { NOTIFICATION_CATALOG } from './catalog';
import { emailFromLine } from './layout';
import { isEventMuted, parseBrandDefaults, parseUserPrefs } from './prefs';
import { renderNotificationEmail } from './templates';
import type {
  BrandNotifyContext,
  NotificationEventKey,
  NotifyPayload,
  NotifyRecipient,
} from './types';

function appOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_ORIGIN ||
    'https://coldcallreps.com'
  ).replace(/\/$/, '');
}

export type NotifyOptions = {
  event: NotificationEventKey;
  recipient: NotifyRecipient;
  brand?: BrandNotifyContext | null;
  payload?: NotifyPayload;
  /** Stable key — prevents duplicate sends on retries. */
  idempotencyKey?: string;
  /** When set with mirrorInApp catalog flag, create DirectMessage. */
  fromUserId?: string | null;
  /** Skip email (still may log / in-app). */
  skipEmail?: boolean;
};

export type NotifyResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  logId?: string;
  emailId?: string;
  inAppId?: string;
};

async function loadRecipientEmail(recipient: NotifyRecipient): Promise<{
  userId?: string;
  email?: string | null;
  displayName?: string | null;
  prefsRaw?: string | null;
}> {
  if (!recipient.userId) return recipient;
  const user = await prisma.userProfile.findUnique({
    where: { id: recipient.userId },
    select: {
      email: true,
      displayName: true,
      notificationPrefsJSON: true,
    },
  });
  if (!user) return recipient;
  return {
    userId: recipient.userId,
    email: recipient.email || user.email,
    displayName: recipient.displayName || user.displayName,
    prefsRaw: user.notificationPrefsJSON,
  };
}

/**
 * Platform notification dispatcher — email-first with optional in-app mirror.
 * Never throws to callers; logs failures on NotificationLog.
 */
export async function notify(opts: NotifyOptions): Promise<NotifyResult> {
  const catalog = NOTIFICATION_CATALOG[opts.event];
  if (!catalog) {
    return { ok: false, reason: 'unknown_event' };
  }

  const recipient = await loadRecipientEmail(opts.recipient);
  const prefs = parseUserPrefs(recipient.prefsRaw);

  if (isEventMuted(prefs, opts.event)) {
      const log = await prisma.notificationLog
        .create({
          data: {
            eventKey: opts.event,
            userId: recipient.userId || null,
            brandId: opts.brand?.id || null,
            emailTo: recipient.email || null,
            status: 'skipped',
            channel: 'email',
            idempotency: opts.idempotencyKey || null,
            error: 'muted_by_prefs',
            payloadJSON: JSON.stringify(opts.payload || {}),
          },
        })
        .catch(() => null);
      return { ok: true, skipped: true, reason: 'muted', logId: log?.id };
  }

  if (opts.idempotencyKey) {
    const existing = await prisma.notificationLog.findUnique({
      where: { idempotency: opts.idempotencyKey },
    });
    if (existing?.status === 'sent') {
      return { ok: true, skipped: true, reason: 'idempotent', logId: existing.id };
    }
  }

  let brand = opts.brand || null;
  if (brand?.id && !brand.replyToEmail) {
    const row = await prisma.brand.findUnique({
      where: { id: brand.id },
      select: {
        notificationDefaultsJSON: true,
        owner: { select: { email: true } },
      },
    });
    if (row) {
      const defaults = parseBrandDefaults(row.notificationDefaultsJSON);
      brand = {
        ...brand,
        replyToEmail: defaults.replyToEmail || row.owner?.email || null,
      };
    }
  }

  const rendered = renderNotificationEmail({
    eventKey: opts.event,
    context: catalog.context,
    recipient,
    brand,
    payload: opts.payload || {},
    appOrigin: appOrigin(),
  });

  const log = await prisma.notificationLog
    .create({
      data: {
        eventKey: opts.event,
        userId: recipient.userId || null,
        brandId: brand?.id || null,
        emailTo: recipient.email || null,
        subject: rendered.subject,
        status: 'queued',
        channel: 'email',
        idempotency: opts.idempotencyKey || null,
        payloadJSON: JSON.stringify(opts.payload || {}),
      },
    })
    .catch(async (e) => {
      // Unique idempotency race
      if (opts.idempotencyKey) {
        return prisma.notificationLog.findUnique({
          where: { idempotency: opts.idempotencyKey },
        });
      }
      console.error('[notify] log create failed', e);
      return null;
    });

  let emailId: string | undefined;
  let emailError: string | undefined;

  if (!opts.skipEmail) {
    if (!recipient.email) {
      emailError = 'no_email';
    } else {
      const from = emailFromLine({ context: catalog.context, brand });
      const result = await sendEmail({
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        from,
        replyTo: brand?.replyToEmail || undefined,
        text: rendered.text,
        idempotencyKey: opts.idempotencyKey,
      });
      if (result.ok) emailId = result.id;
      else emailError = result.error;
    }
  }

  let inAppId: string | undefined;
  if (catalog.mirrorInApp && opts.fromUserId && recipient.userId) {
    const body =
      (opts.payload?.customMessage as string | undefined)?.trim() ||
      rendered.text.slice(0, 1900);
    const dm = await prisma.directMessage
      .create({
        data: {
          fromUserId: opts.fromUserId,
          toUserId: recipient.userId,
          body,
          status: emailId ? 'sent' : emailError ? 'failed' : 'stub',
        },
      })
      .catch(() => null);
    inAppId = dm?.id;
  }

  if (log?.id) {
    await prisma.notificationLog
      .update({
        where: { id: log.id },
        data: {
          status: emailError && !opts.skipEmail ? 'failed' : emailId || opts.skipEmail ? 'sent' : 'failed',
          providerId: emailId || null,
          error: emailError || null,
        },
      })
      .catch(() => null);
  }

  if (emailError && !opts.skipEmail) {
    console.warn('[notify]', opts.event, emailError);
    return {
      ok: false,
      reason: emailError,
      logId: log?.id,
      inAppId,
    };
  }

  return {
    ok: true,
    logId: log?.id,
    emailId,
    inAppId,
    skipped: opts.skipEmail,
  };
}

/** Fire-and-forget wrapper for route handlers. */
export function notifyAsync(opts: NotifyOptions) {
  void notify(opts).catch((e) => console.error('[notifyAsync]', opts.event, e));
}
