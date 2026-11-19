import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth/session';
import { mfaSetupData } from '../../actions';
import { MfaForm } from '../../forms';

export default async function MfaSetup() {
  const u = await readSession('staff');
  if (!u) redirect('/admin/login');
  if (u.mfaEnabledAt) redirect(u.session.mfaVerified ? '/admin' : '/admin/mfa');
  const data = await mfaSetupData();
  if (!data) redirect('/admin/login');
  return (
    <div className="auth">
      <header className="page-head"><h1>Set up two-factor sign-in</h1>
        <p>Every staff account signs in with a password and a code from an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password, Authy).</p></header>
      <ol className="prose" style={{ paddingLeft: '1.2em' }}>
        <li>Scan this code with the app, or type the key below into it. In Microsoft Authenticator, add it as
          <strong> Other account (Google, Facebook, etc.)</strong>, not as a work or school account.</li>
        <li>Type the six-digit code the app shows.</li>
      </ol>
      <img className="qr" src={data.qr} alt="QR code for the authenticator app" width={240} height={240} />
      <p className="t-small muted">Or type this key into the app (spaces do not matter):</p>
      <p className="mono">{data.secret.match(/.{1,4}/g)?.join(' ')}</p>
      <MfaForm label="Turn on two-factor sign-in" />
    </div>
  );
}
