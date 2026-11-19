import { getDb } from '../db/client';
import * as s from '../db/schema';

/* Transactional email through Resend's HTTP API (no SDK). Without RESEND_API_KEY the message is kept in
   the outbox table (Admin > Outbox) with status "logged", so every flow can be tested without sending. */

export type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string };

export async function sendEmail(mail: Mail): Promise<{ status: 'sent' | 'logged' | 'failed'; id?: string }> {
  const db = await getDb();
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || 'Monolith Sports <quotes@monolithsports.example>';
  let status: 'sent' | 'logged' | 'failed' = 'logged';
  let providerId = '', error = '';
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text, reply_to: mail.replyTo }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) { status = 'sent'; providerId = body.id ?? ''; }
      else { status = 'failed'; error = body.message ?? `HTTP ${res.status}`; }
    } catch (e) {
      status = 'failed'; error = e instanceof Error ? e.message : String(e);
    }
  }
  await db.insert(s.emailOutbox).values({ to: mail.to, subject: mail.subject, html: mail.html, text: mail.text, status, providerId, error });
  if (status === 'failed') console.error('[email] failed', mail.subject, error);
  return { status, id: providerId || undefined };
}
