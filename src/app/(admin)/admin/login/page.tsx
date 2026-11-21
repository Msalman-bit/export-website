import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import { PasskeySignIn, StaffLoginForm } from '../forms';

export default async function AdminLogin() {
  const u = await readSession('staff');
  if (u?.session.mfaVerified) redirect('/admin');
  return (
    <div className="auth">
      <header className="page-head"><h1>Staff sign-in</h1><p>Monolith Sports administration. Two-factor sign-in is required.</p></header>
      <StaffLoginForm />
      {/* a passkey is both factors at once (Your account > Passkeys); the password and code above stay the fallback */}
      <div className="auth-or" role="separator"><span>or</span></div>
      <PasskeySignIn />
    </div>
  );
}
