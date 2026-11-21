'use client';
import { useActionState, useEffect, useRef, useState } from 'react';
import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { staffLogin, mfaConfirm } from './actions';
import { passkeyAddFinish, passkeyAddStart, passkeySignInFinish, passkeySignInStart, passkeyStepUpStart } from './passkey-actions';

/** The staff sign-in: email and password (then the authenticator code), or a passkey. "Sign in with a passkey" is the
    second button of Continue's row: beside it on a computer, a text link under it on a phone (the kit's button pair). */
export function StaffLoginForm() {
  const [state, action, pending] = useActionState(staffLogin, {});
  const passkey = usePasskeySignIn();
  return (
    <form action={action} className="block" noValidate>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="username" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <div className="btn-row">
        <button className="btn btn--primary" type="submit" disabled={pending}>Continue</button>
        {passkey.supported !== false ? (
          <button className="btn btn--secondary" type="button" onClick={passkey.signIn} disabled={passkey.busy || passkey.supported === null}>Sign in with a passkey</button>
        ) : null}
      </div>
      <p className={state.message ? 'err' : 'status-line'} role="status">{state.message ?? ''}</p>
      {passkey.supported === false ? (
        <p className="t-small muted">This browser or address cannot use passkeys: sign in with your password and code.</p>
      ) : (
        <p className={passkey.message ? 'err' : 'status-line'} role="status">{passkey.busy && !passkey.message ? 'Waiting for your passkey…' : passkey.message}</p>
      )}
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

// ------------------------------------------------------------------ passkeys (server side: ./passkey-actions)
/** Whether this browser, on this address, can use passkeys at all: null until known (after hydration). Plain http on
    a network address (a phone opening http://192.168.x.x:3000) cannot. */
function usePasskeySupport(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => setOk(browserSupportsWebAuthn()), []);
  return ok;
}

/** The browser's own refusals, in words. */
function passkeyProblem(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || name === 'InvalidStateError') return 'This device already holds a passkey for your account on this site. Nothing was added.';
  if (name === 'NotAllowedError' || name === 'AbortError') return 'The passkey window was closed or timed out, so nothing happened. Try again when you are ready.';
  if (name === 'SecurityError') return 'This address cannot use passkeys. Open the admin at the site’s https address (or localhost on this computer).';
  return 'The passkey did not work on this device. Try again, or use your password and authenticator code.';
}

/** "Sign in with a passkey" (in StaffLoginForm). The browser offers the passkeys it holds for this site, or a QR code
    to use a phone; Face ID, a fingerprint or the device PIN unlocks it, and that is the whole sign-in. */
function usePasskeySignIn() {
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function signIn() {
    setBusy(true); setMessage('');
    let leaving = false;
    try {
      const start = await passkeySignInStart();
      if (!start.options) { setMessage(start.message ?? 'Passkey sign-in is not available here.'); return; }
      const answer = await startAuthentication({ optionsJSON: start.options });
      const done = await passkeySignInFinish(answer);
      if (done.ok) { leaving = true; window.location.assign('/admin'); return; }
      setMessage(done.message ?? 'The passkey could not be confirmed.');
    } catch (err) {
      setMessage(passkeyProblem(err));
    } finally {
      if (!leaving) setBusy(false);
    }
  }
  return { supported, busy, message, signIn };
}

/** "Add a passkey" (Your account): a name, a fresh authenticator code, then the device makes the passkey. */
export function AddPasskeyForm() {
  const supported = usePasskeySupport();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (supported === false) {
    return <p className="t-small">This browser cannot make passkeys on this address. Open the admin at the site’s https address, or at localhost on this computer.</p>;
  }
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get('name') ?? '').trim();
    setBusy(true); setMessage('');
    let leaving = false;
    try {
      const start = await passkeyAddStart({ name, code: String(fd.get('code') ?? '') });
      if (!start.options) { setMessage(start.message ?? 'A passkey cannot be added here.'); return; }
      const answer = await startRegistration({ optionsJSON: start.options });
      const done = await passkeyAddFinish(answer);
      if (done.ok) {
        leaving = true;
        window.location.assign(`/admin/account?ok=${encodeURIComponent(`Passkey “${name}” added. Next time, choose “Sign in with a passkey” on the sign-in page.`)}`);
        return;
      }
      setMessage(done.message ?? 'Nothing was added.');
    } catch (err) {
      setMessage(passkeyProblem(err));
    } finally {
      if (!leaving) { setBusy(false); const code = form.elements.namedItem('code'); if (code instanceof HTMLInputElement) code.value = ''; }
    }
  }
  return (
    <form className="block" onSubmit={add}>
      <div className="field"><label htmlFor="pk-name">Name it, so you know which device it is</label>
        <input id="pk-name" name="name" type="text" maxLength={60} placeholder="For example: Salman’s iPhone" autoComplete="off" required /></div>
      <div className="field"><label htmlFor="pk-code">Code from your authenticator app</label>
        <input id="pk-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required /></div>
      <div className="btn-row"><button className="btn btn--primary" type="submit" disabled={busy || supported === null}>Add a passkey</button></div>
      <p className={message ? 'err' : 'status-line'} role="status">{busy && !message ? 'Follow the steps your browser shows…' : message}</p>
    </form>
  );
}

/** Inside a deletion's form: confirms with one of your passkeys instead of the authenticator code. The device's answer
    goes into the form's hidden "passkey" field and the form is sent as usual; the server checks it (requireStepUp). */
export function PasskeyConfirm({ label }: { label: string }) {
  const supported = usePasskeySupport();
  const box = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!supported) return null;
  async function confirm() {
    const form = box.current?.closest('form');
    if (!form) return;
    // the form's other checks (the typed SKU, say) still apply; only the code may stay empty
    const code = form.querySelector<HTMLInputElement>('input[name="code"]');
    if (code) code.required = false;
    if (!form.reportValidity()) { if (code) code.required = true; return; }
    setBusy(true); setMessage('');
    let sent = false;
    try {
      const start = await passkeyStepUpStart();
      if (!start.options) { setMessage(start.message ?? 'Use the code from your authenticator app.'); return; }
      const answer = await startAuthentication({ optionsJSON: start.options });
      const field = form.querySelector<HTMLInputElement>('input[name="passkey"]');
      if (!field) return;
      field.value = JSON.stringify(answer);
      sent = true;
      form.requestSubmit();
    } catch (err) {
      setMessage(passkeyProblem(err));
    } finally {
      if (!sent) { setBusy(false); if (code) code.required = true; }
    }
  }
  return (
    <div className="passkey-confirm" ref={box}>
      <input type="hidden" name="passkey" defaultValue="" />
      <p className="t-small">Or, instead of the code, confirm with your passkey (Face ID, fingerprint or device PIN):</p>
      <div className="btn-row"><button className="btn btn--quiet-danger" type="button" onClick={confirm} disabled={busy}>{label}</button></div>
      {message ? <p className="err" role="status">{message}</p> : null}
    </div>
  );
}
