/* Cloudflare Turnstile, used only when both keys are set. Without them the forms rely on the honeypot,
   the minimum fill time and rate limits. */
export async function verifyTurnstile(token: string | null, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return !!data.success;
  } catch {
    return false;
  }
}

/** A filled honeypot: only a bot fills the field people never see. It gets a normal-looking answer. */
export function filledHoneypot(form: FormData): boolean {
  return !!String(form.get('company_website') ?? '').trim();
}

/** Sent less than 3 seconds after the form opened. Timed on the sender's own clock (`elapsed`, in ms), never by
    comparing their clock with the server's: a computer whose clock runs a few seconds or minutes ahead must not
    be taken for a bot. A person who trips it sees a message and sends again, so nothing is lost silently. */
export function sentTooFast(form: FormData): boolean {
  if (!form.has('elapsed')) return false;
  const elapsed = Number(form.get('elapsed'));
  return Number.isFinite(elapsed) && elapsed < 3000;
}
