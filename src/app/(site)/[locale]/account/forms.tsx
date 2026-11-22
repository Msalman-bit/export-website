'use client';
import { useActionState } from 'react';
import { register, login, forgot, reset, resendVerification, updateCompany, sendCustomerMessage, type FormState } from './actions';
import { COUNTRIES, countryName, isOfferedCountry } from '@/lib/inquiry/countries';

const init: FormState = {};

function Field({ id, label, type = 'text', state, auto, hint, defaultValue, required = true, ...rest }: {
  id: string; label: string; type?: string; state: FormState; auto?: string; hint?: string; defaultValue?: string; required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const err = state.errors?.[id];
  return (
    <div className="field">
      <label htmlFor={id}>{label}{hint ? <span className="hint"> ({hint})</span> : null}</label>
      <input id={id} name={id} type={type} autoComplete={auto} defaultValue={defaultValue} required={required}
        aria-invalid={err ? 'true' : undefined} aria-describedby={err ? `${id}-err` : undefined} {...rest} />
      {err ? <p className="err" id={`${id}-err`}>{err}</p> : null}
    </div>
  );
}

function Status({ state }: { state: FormState }) {
  return <p className={state.ok ? 'status-line' : state.message ? 'err' : 'status-line'} role="status">{state.message ?? ''}</p>;
}

function Submit({ label, pending }: { label: string; pending: boolean }) {
  return <div className="btn-row"><button className="btn btn--primary" type="submit" disabled={pending} aria-busy={pending || undefined}>{label}</button></div>;
}

export function RegisterForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(register, init);
  return (
    <form action={action} className="block" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Field id="company" label="Company name" state={state} auto="organization" />
      <Field id="name" label="Your name" state={state} auto="name" />
      <Field id="email" label="Business email" type="email" state={state} auto="email" inputMode="email" />
      <div className="field">
        <label htmlFor="country">Country</label>
        <select id="country" name="country" defaultValue="" required aria-invalid={state.errors?.country ? 'true' : undefined} aria-describedby={state.errors?.country ? 'country-err' : undefined}>
          <option value="" disabled>Select a country</option>
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        {state.errors?.country ? <p className="err" id="country-err">{state.errors.country}</p> : null}
      </div>
      <Field id="password" label="Password" type="password" state={state} auto="new-password" hint="at least 12 characters, including a number or symbol" />
      <label className="chk"><input type="checkbox" className="m-check" name="terms" aria-describedby={state.errors?.terms ? 'terms-err' : undefined} /> I accept the <a className="link" href={`/${locale}/terms`}>terms</a> and have read the <a className="link" href={`/${locale}/privacy`}>privacy policy</a>.</label>
      {state.errors?.terms ? <p className="err" id="terms-err">{state.errors.terms}</p> : null}
      <div className="newsletter__trap" aria-hidden="true"><label htmlFor="company_website">Website</label><input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" /></div>
      <Submit label="Create the account" pending={pending} />
      <Status state={state} />
    </form>
  );
}

export function LoginForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(login, init);
  return (
    <form action={action} className="block" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Field id="email" label="Email" type="email" state={state} auto="email" inputMode="email" />
      <Field id="password" label="Password" type="password" state={state} auto="current-password" />
      <Submit label="Sign in" pending={pending} />
      <Status state={state} />
    </form>
  );
}

export function ForgotForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(forgot, init);
  return (
    <form action={action} className="block" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Field id="email" label="Email" type="email" state={state} auto="email" inputMode="email" />
      <Submit label="Send the reset link" pending={pending} />
      <Status state={state} />
    </form>
  );
}

export function ResetForm({ locale, token }: { locale: string; token: string }) {
  const [state, action, pending] = useActionState(reset, init);
  return (
    <form action={action} className="block" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <Field id="password" label="New password" type="password" state={state} auto="new-password" hint="at least 12 characters, including a number or symbol" />
      <Field id="confirm" label="Confirm the new password" type="password" state={state} auto="new-password" />
      <Submit label="Save the new password" pending={pending} />
      <Status state={state} />
    </form>
  );
}

export function ResendForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(resendVerification, init);
  return (
    <form action={action} className="block">
      <input type="hidden" name="locale" value={locale} />
      <div className="btn-row"><button className="btn btn--secondary" type="submit" disabled={pending}>Send a new confirmation link</button></div>
      <Status state={state} />
    </form>
  );
}

export function CompanyForm({ locale, company }: { locale: string; company: { name: string; country: string; website: string; address: string; phone: string; preferredCurrency: string } }) {
  const [state, action, pending] = useActionState(updateCompany, init);
  return (
    <form action={action} className="form-grid" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <Field id="name" label="Company name" state={state} defaultValue={company.name} auto="organization" />
      <div className="field">
        <label htmlFor="country">Country</label>
        <select id="country" name="country" defaultValue={company.country}>{isOfferedCountry(company.country) ? null : <option value={company.country}>{countryName(company.country)}</option>}{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select>
      </div>
      <Field id="website" label="Website" state={state} defaultValue={company.website} required={false} auto="url" />
      <Field id="phone" label="Phone" type="tel" state={state} defaultValue={company.phone} required={false} auto="tel" />
      <div className="field field--full"><label htmlFor="address">Delivery address</label><textarea id="address" name="address" defaultValue={company.address} maxLength={500} /></div>
      <div className="field">
        <label htmlFor="preferredCurrency">Quotation currency</label>
        <select id="preferredCurrency" name="preferredCurrency" defaultValue={company.preferredCurrency}><option>EUR</option><option>GBP</option><option>USD</option></select>
      </div>
      <div className="full"><Submit label="Save company details" pending={pending} /><Status state={state} /></div>
    </form>
  );
}

export function MessageForm({ locale, inquiries }: { locale: string; inquiries: { id: string; reference: string }[] }) {
  const [state, action, pending] = useActionState(sendCustomerMessage, init);
  return (
    <form action={action} className="block" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {inquiries.length ? (
        <div className="field"><label htmlFor="inquiryId">About</label>
          <select id="inquiryId" name="inquiryId" defaultValue=""><option value="">General question</option>{inquiries.map((i) => <option key={i.id} value={i.id}>{i.reference}</option>)}</select></div>
      ) : null}
      <div className="field"><label htmlFor="body">Message</label>
        <textarea id="body" name="body" maxLength={4000} aria-invalid={state.errors?.body ? 'true' : undefined} aria-describedby={state.errors?.body ? 'body-err' : undefined} />
        {state.errors?.body ? <p className="err" id="body-err">{state.errors.body}</p> : null}</div>
      <Submit label="Send the message" pending={pending} />
      <Status state={state} />
    </form>
  );
}
