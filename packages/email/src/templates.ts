const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const SITE = () => process.env.SITE_NAME || 'Sponsor Finder';

function layout(title: string, body: string, footer = ''): string {
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px">
<tr><td style="padding:24px 24px 8px;font-size:15px;font-weight:600">${esc(SITE())}</td></tr>
<tr><td style="padding:8px 24px 24px;font-size:15px;line-height:1.55">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${body}
</td></tr></table>
<p style="max-width:560px;font-size:12px;color:#64748b;line-height:1.5;margin:16px auto 0">${footer}</p>
</td></tr></table></body></html>`;
}

const button = (href: string, label: string) =>
  `<p style="margin:20px 0"><a href="${esc(href)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${esc(label)}</a></p>`;

// ------------------------------------------------------------------ magic link

export function magicLinkEmail(url: string) {
  const subject = `Your ${SITE()} sign-in link`;
  return {
    subject,
    html: layout(
      'Sign in',
      `<p>Click the button below to sign in. The link expires in 15 minutes and can only be used once.</p>${button(url, 'Sign in')}<p style="font-size:13px;color:#64748b">If you didn't ask for this, you can ignore this email.</p>`,
    ),
    text: `Sign in to ${SITE()}:\n${url}\n\nThe link expires in 15 minutes and can only be used once. If you didn't ask for this, ignore this email.`,
  };
}

// ------------------------------------------------------------------ alerts

export interface AlertItem {
  name: string;
  town: string;
  url: string;
  /** e.g. "Removed from the register", "Downgraded A → B", "New sponsor" */
  change: string;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
}

export interface SavedSearchGroup {
  label: string; // e.g. "“software” in Manchester"
  items: AlertItem[];
  moreCount: number;
  moreUrl: string;
}

const toneColor = { good: '#047857', bad: '#b91c1c', warn: '#b45309', neutral: '#334155' };

function itemRows(items: AlertItem[]): string {
  return items
    .map(
      (i) => `<tr><td style="padding:10px 0;border-top:1px solid #f1f5f9">
<a href="${esc(i.url)}" style="color:#0f172a;font-weight:600;text-decoration:none">${esc(i.name)}</a>
<span style="color:#64748b"> · ${esc(i.town)}</span><br>
<span style="font-size:13px;font-weight:600;color:${toneColor[i.tone]}">${esc(i.change)}</span></td></tr>`,
    )
    .join('');
}

export function alertEmail(opts: {
  dateLabel: string;
  watched: AlertItem[];
  searches: SavedSearchGroup[];
  accountUrl: string;
  unsubscribeUrl: string;
}) {
  const searchCount = opts.searches.reduce((n, g) => n + g.items.length + g.moreCount, 0);
  const parts: string[] = [];
  if (opts.watched.length) parts.push(`${opts.watched.length} watched ${opts.watched.length === 1 ? 'company' : 'companies'} changed`);
  if (searchCount) parts.push(`${searchCount} new ${searchCount === 1 ? 'sponsor matches' : 'sponsors match'} your searches`);
  const subject = `${parts.join(', ')} (${opts.dateLabel})`;

  let html = `<p style="margin:0 0 8px;color:#475569">From the Home Office register published ${esc(opts.dateLabel)}.</p>`;
  let text = `From the Home Office register published ${opts.dateLabel}.\n`;

  if (opts.watched.length) {
    html += `<h2 style="font-size:16px;margin:20px 0 4px">Companies you watch</h2><table role="presentation" width="100%">${itemRows(opts.watched)}</table>`;
    text += `\nCOMPANIES YOU WATCH\n${opts.watched.map((i) => `- ${i.name} (${i.town}): ${i.change}\n  ${i.url}`).join('\n')}\n`;
  }
  for (const g of opts.searches) {
    html += `<h2 style="font-size:16px;margin:20px 0 4px">New sponsors: ${esc(g.label)}</h2><table role="presentation" width="100%">${itemRows(g.items)}</table>`;
    text += `\nNEW SPONSORS: ${g.label}\n${g.items.map((i) => `- ${i.name} (${i.town})\n  ${i.url}`).join('\n')}\n`;
    if (g.moreCount) {
      html += `<p style="font-size:14px"><a href="${esc(g.moreUrl)}" style="color:#4f46e5">and ${g.moreCount} more →</a></p>`;
      text += `…and ${g.moreCount} more: ${g.moreUrl}\n`;
    }
  }
  if (opts.watched.some((i) => i.change.startsWith('Removed'))) {
    const note =
      'A sponsor can leave the register because its licence was revoked, surrendered or expired, or because it was renamed. The register doesn’t say which.';
    html += `<p style="font-size:13px;color:#64748b;margin-top:16px">${esc(note)}</p>`;
    text += `\n${note}\n`;
  }
  html += button(opts.accountUrl, 'Manage your alerts');
  text += `\nManage your alerts: ${opts.accountUrl}\nUnsubscribe from all alerts: ${opts.unsubscribeUrl}\n`;

  const footer = `You're getting this because you set up alerts on ${esc(SITE())}. <a href="${esc(opts.unsubscribeUrl)}" style="color:#64748b">Unsubscribe from all alerts</a>.`;
  return { subject, html: layout('Sponsor register changes', html, footer), text };
}
