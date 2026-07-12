/** Minimal Resend HTTP client — no SDK dependency. */

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: 'RESEND_API_KEY not configured' };
  }

  const from =
    opts.from ||
    process.env.RESEND_FROM ||
    'Cold Call Reps <reps@coldcallreps.com>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    return { ok: false as const, error: data.message || `Resend ${res.status}` };
  }
  return { ok: true as const, id: data.id };
}
