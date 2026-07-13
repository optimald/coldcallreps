import type { BrandNotifyContext, NotificationContextKind } from './types';

export function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function absoluteUrl(origin: string, pathOrUrl?: string | null) {
  if (!pathOrUrl) return origin;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${origin.replace(/\/$/, '')}${path}`;
}

export function emailFromLine(opts: {
  context: NotificationContextKind;
  brand?: BrandNotifyContext | null;
}) {
  const platform =
    process.env.RESEND_FROM || 'ColdCallReps <reps@coldcallreps.com>';
  if (opts.context === 'brand' && opts.brand?.name) {
    const safe = opts.brand.name.replace(/[<>]/g, '').slice(0, 64);
    const match = platform.match(/<([^>]+)>/);
    const addr = match?.[1] || 'reps@coldcallreps.com';
    return `${safe} via ColdCallReps <${addr}>`;
  }
  return platform;
}

export function renderEmailShell(opts: {
  context: NotificationContextKind;
  brand?: BrandNotifyContext | null;
  preheader?: string;
  headline: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
  appOrigin: string;
}) {
  const brandLabel = opts.brand?.name ? escapeHtml(opts.brand.name) : 'ColdCallReps';
  const contextLabel =
    opts.context === 'brand' ? brandLabel : 'ColdCallReps';
  const preheader = opts.preheader ? escapeHtml(opts.preheader) : '';
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<p style="margin:28px 0 8px">
          <a href="${escapeHtml(opts.ctaUrl)}"
             style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;font-size:15px">
            ${escapeHtml(opts.ctaLabel)}
          </a>
        </p>`
      : '';

  const footerNote =
    opts.context === 'brand'
      ? `You’re receiving this because of activity on <strong>${brandLabel}</strong> on ColdCallReps.`
      : `You’re receiving this from ColdCallReps about your account.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(opts.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#0f1115;color:#e8eaed;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f1115;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#171a21;border:1px solid #2a2f3a;border-radius:14px;overflow:hidden">
          <tr>
            <td style="padding:22px 28px 8px;border-bottom:1px solid #2a2f3a">
              <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8b93a7;font-weight:650">
                ${contextLabel}
              </div>
              <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;color:#f3f4f6;font-weight:700">
                ${escapeHtml(opts.headline)}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px 28px;font-size:15px;line-height:1.55;color:#c5cad6">
              ${opts.bodyHtml}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid #2a2f3a;font-size:12px;line-height:1.5;color:#7a8294">
              ${footerNote}
              <br />
              <a href="${escapeHtml(absoluteUrl(opts.appOrigin, '/settings'))}" style="color:#9aa3b5">Notification settings</a>
              ·
              <a href="${escapeHtml(opts.appOrigin)}" style="color:#9aa3b5">Open ColdCallReps</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function paragraph(text: string) {
  return `<p style="margin:0 0 14px">${escapeHtml(text)}</p>`;
}

export function richParagraph(htmlSafeInner: string) {
  return `<p style="margin:0 0 14px">${htmlSafeInner}</p>`;
}

export function quoteBlock(text: string) {
  return `<blockquote style="margin:0 0 16px;padding:12px 14px;border-left:3px solid #0d9488;background:#1c212b;border-radius:0 8px 8px 0;color:#d7dbe4">
    ${escapeHtml(text).replace(/\n/g, '<br/>')}
  </blockquote>`;
}

export function recommendationsHtml(
  items: { title: string; detail?: string; href?: string }[],
  appOrigin: string
) {
  if (!items.length) return '';
  const lis = items
    .map((r) => {
      const title = r.href
        ? `<a href="${escapeHtml(absoluteUrl(appOrigin, r.href))}" style="color:#5eead4;font-weight:650;text-decoration:none">${escapeHtml(r.title)}</a>`
        : `<strong style="color:#e8eaed">${escapeHtml(r.title)}</strong>`;
      const detail = r.detail
        ? `<div style="margin-top:2px;color:#9aa3b5;font-size:13px">${escapeHtml(r.detail)}</div>`
        : '';
      return `<li style="margin:0 0 10px">${title}${detail}</li>`;
    })
    .join('');
  return `<div style="margin:22px 0 0;padding:14px 16px;border-radius:10px;background:#1c212b;border:1px solid #2a2f3a">
    <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#8b93a7;font-weight:650;margin-bottom:10px">Recommended next steps</div>
    <ol style="margin:0;padding-left:18px;color:#c5cad6;font-size:14px;line-height:1.45">${lis}</ol>
  </div>`;
}

export function recommendationsText(items: { title: string; detail?: string; href?: string }[]) {
  if (!items.length) return '';
  return [
    'Recommended next steps:',
    ...items.map(
      (r, i) =>
        `${i + 1}. ${r.title}${r.detail ? ` — ${r.detail}` : ''}${r.href ? ` (${r.href})` : ''}`
    ),
  ].join('\n');
}
