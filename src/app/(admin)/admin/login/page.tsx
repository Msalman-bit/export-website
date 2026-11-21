import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import { StaffLoginForm } from '../forms';

export default async function AdminLogin() {
  const u = await readSession('staff');
  if (u?.session.mfaVerified) redirect('/admin');
  return (
    <div className="auth">
      <header className="page-head"><h1>Staff sign-in</h1><p>Monolith Sports administration. Sign in with your password and authenticator code, or with a passkey.</p></header>
      {/* with "Sign in with a passkey" beside Continue: a passkey is both factors at once (Your account > Passkeys) */}
      <StaffLoginForm />
    </div>
  );
}
