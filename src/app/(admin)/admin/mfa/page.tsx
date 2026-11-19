import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import { MfaForm } from '../forms';

export default async function Mfa() {
  const u = await readSession('staff');
  if (!u) redirect('/admin/login');
  if (!u.mfaEnabledAt) redirect('/admin/mfa/setup');
  if (u.session.mfaVerified) redirect('/admin');
  return (
    <div className="auth">
      <header className="page-head"><h1>Two-factor sign-in</h1><p>Open your authenticator app and type the current code for Monolith Sports.</p></header>
      <MfaForm label="Sign in" />
    </div>
  );
}
