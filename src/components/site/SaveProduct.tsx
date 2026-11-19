'use client';
import { useState } from 'react';

export function SaveProduct({ productId, label }: { productId: string; label: string }) {
  const [state, setState] = useState<'idle' | 'saved' | 'error'>('idle');
  const save = async () => {
    const res = await fetch('/api/saved', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) });
    setState(res.ok ? 'saved' : 'error');
  };
  return (
    <>
      <button type="button" className="btn-text" onClick={save} disabled={state === 'saved'}>{state === 'saved' ? 'Saved to your account' : label}</button>
      {state === 'error' ? <span className="err" role="status">Not saved. Sign in again and retry.</span> : null}
    </>
  );
}
