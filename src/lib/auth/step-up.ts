import { verifyTotp } from './totp';

/* Step-up verification for destructive staff actions (deleting an inquiry): the staff member types the code their
   authenticator app shows now, although the session already passed two-factor at sign-in, so an unattended or
   stolen session cannot delete on its own. A code that confirmed one such action is spent: it cannot confirm
   another, even inside the 90 seconds verifyTotp accepts it for. Held in memory like the rate limiter: one server
   process is exact; several instances need a shared store (docs/SECURITY.md). */

const g = globalThis as unknown as { __monolithSpentCodes?: Map<string, number> };
const spent: Map<string, number> = g.__monolithSpentCodes ?? (g.__monolithSpentCodes = new Map());

export type StepUpResult = 'ok' | 'wrong' | 'spent';

/** `secret` is the staff member's decrypted TOTP secret. */
export function checkStepUpCode(userId: string, secret: string, code: string, now = Date.now()): StepUpResult {
  for (const [k, until] of spent) if (until <= now) spent.delete(k);
  const c = code.replace(/\s/g, '');
  if (!secret || !verifyTotp(secret, c, now)) return 'wrong';
  const key = `${userId}:${c}`;
  if (spent.has(key)) return 'spent';
  spent.set(key, now + 120_000); // longer than the window the code is accepted in
  return 'ok';
}
