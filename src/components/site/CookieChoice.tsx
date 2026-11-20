'use client';
import { useState } from 'react';

export function CookieChoice({ current, analyticsOn }: { current: string; analyticsOn: boolean }) {
  const [choice, setChoice] = useState(current || 'essential');
  const [saved, setSaved] = useState('');
  const [savedN, setSavedN] = useState(0); // a new key per save, so pressing the same choice again still visibly answers
  if (!analyticsOn) return <p className="notice">This site sets no analytics cookies at the moment: only the session and preference cookies above.</p>;
  const save = async (value: 'analytics' | 'essential') => {
    const res = await fetch('/api/consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ choice: value }) });
    if (res.ok) { setChoice(value); setSaved(value === 'analytics' ? 'Analytics cookies allowed.' : 'Analytics cookies off.'); setSavedN((n) => n + 1); }
  };
  return (
    <div className="form-section">
      <h2>Your cookie choice</h2>
      <p>Analytics is {choice === 'analytics' ? 'on' : 'off'}.</p>
      <div className="btn-row">
        <button className="btn btn--secondary" type="button" onClick={() => save('essential')}>Turn analytics off</button>
        <button className="btn btn--secondary" type="button" onClick={() => save('analytics')}>Allow analytics</button>
      </div>
      <p role="status" className="status-line">{saved ? <span key={savedN} className="status-line__msg">{saved}</span> : null}</p>
    </div>
  );
}
