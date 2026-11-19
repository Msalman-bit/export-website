'use client';
import { useActionState } from 'react';
import { staffLogin, mfaConfirm } from './actions';

export function StaffLoginForm() {
  const [state, action, pending] = useActionState(staffLogin, {});
  return (
    <form action={action} className="block" noValidate>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <div className="btn-row"><button className="btn btn--primary" type="submit" disabled={pending}>Continue</button></div>
      <p className={state.message ? 'err' : 'status-line'} role="status">{state.message ?? ''}</p>
    </form>
  );
}

export function MfaForm({ label }: { label: string }) {
  const [state, action, pending] = useActionState(mfaConfirm, {});
  return (
    <form action={action} className="block" noValidate>
      <div className="field"><label htmlFor="code">Six-digit code from your authenticator app</label>
        <input id="code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required /></div>
      <div className="btn-row"><button className="btn btn--primary" type="submit" disabled={pending}>{label}</button></div>
      <p className={state.message ? 'err' : 'status-line'} role="status">{state.message ?? ''}</p>
    </form>
  );
}
