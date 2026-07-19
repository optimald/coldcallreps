/** Minimal Resend HTTP client — no SDK dependency. */

/**
 * Optional local/QA sink: rewrite recipients to usera+{tag}@slickrock.dev
 * when QA_EMAIL_SINK_LOCAL + QA_EMAIL_SINK_DOMAIN are set (never in production).
 */
function applyQaEmailSink(to: string): string {
  if (process.env.NODE_ENV === 'production') return to;
  const local = process.env.QA_EMAIL_SINK_LOCAL?.trim();
  const domain = process.env.QA_EMAIL_SINK_DOMAIN?.trim();
  if (!local || !domain) return to;

  const lower = to.toLowerCase();
  const sinkSuffix = `@${domain.toLowerCase()}`;
  if (lower.endsWith(sinkSuffix) && lower.includes('+')) return to;

  const rawLocal = to.split('@')[0] || 'qa';
  const tag =
    rawLocal
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'qa';
  return `${local}+${tag}@${domain}`;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  idempotencyKey?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: 'RESEND_API_KEY not configured' };
  }

  const from =
    opts.from ||
    process.env.RESEND_FROM ||
    'Cold Call Reps <reps@coldcallreps.com>';

  const to = applyQaEmailSink(opts.to);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (opts.idempotencyKey) {
    headers['Idempotency-Key'] = opts.idempotencyKey.slice(0, 256);
  }

  const body: Record<string, unknown> = {
    from,
    to: [to],
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.text) body.text = opts.text;
  if (opts.replyTo) body.reply_to = opts.replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    return { ok: false as const, error: data.message || `Resend ${res.status}` };
  }
  return { ok: true as const, id: data.id };
}
