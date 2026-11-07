export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  id: string | null;
  delivered: boolean;
}

/**
 * Send through Resend's REST API. With no RESEND_API_KEY (local dev) the email is printed
 * to the console instead, so magic links and alerts can be tested without an account.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Sponsor Finder <onboarding@resend.dev>';

  if (!apiKey) {
    console.log(
      `\n──────── email (not sent: RESEND_API_KEY is not set) ────────\nTo: ${msg.to}\nSubject: ${msg.subject}\n\n${msg.text}\n──────────────────────────────────────────────────────────────\n`,
    );
    return { id: null, delivered: false };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, headers: msg.headers }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message ?? 'unknown error'}`);
  return { id: body.id ?? null, delivered: true };
}
