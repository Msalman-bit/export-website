import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import { StaffLoginForm } from '../forms';

export default async function AdminLogin() {
  const u = await readSession('staff');
  if (u?.session.mfaVerified) redirect('/admin');
  return (
    <div className="auth">
      <header className="page-head"><h1>Staff sign-in</h1><p>Monolith Sports administration. Two-factor sign-in is required.</p></header>
      <StaffLoginForm />
    </div>
  );
}
