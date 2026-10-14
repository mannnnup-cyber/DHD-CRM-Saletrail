import { useEffect, useRef, useState } from 'react';

export default function Recovery() {
  // Capture before stripping; React StrictMode may invoke the initializer twice.
  const [tokenHash, setTokenHash] = useState(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const token = params.get('token_hash');
    return params.get('type') === 'recovery' && token && token.length <= 4096 ? token : '';
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<'success' | 'partial' | 'failed' | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#/recovery`);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || !tokenHash) return;
    setError('');
    if (newPassword.length < 8 || newPassword.length > 1024) { setError('Password must be 8–1024 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    submitting.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/recovery-clear', {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenHash, newPassword }),
      });
      const result = await response.json();
      if (response.ok && result.success === true) setOutcome('success');
      else if (result.passwordUpdated === true) setOutcome('partial');
      else {
        setOutcome('failed');
        setError(response.status === 401 ? 'Invalid or expired recovery link. Request a new recovery link.' : 'Recovery could not be completed. Request a new recovery link.');
      }
    } catch {
      // The server may have updated the password before the connection failed.
      setOutcome('failed');
      setError('We could not confirm the result. Try logging in with your new password, or request a new recovery link.');
    } finally {
      setTokenHash(''); setNewPassword(''); setConfirmPassword(''); setLoading(false);
      submitting.current = false;
    }
  };

  return <main className="min-h-screen bg-gray-950 p-8 text-white">
    <div className="max-w-md mx-auto">
      {outcome === 'success' ? <p role="status" className="text-green-400">Password updated. <a href="/#/login" className="underline">Log in</a> with your new password.</p>
        : outcome === 'partial' ? <p role="alert" className="text-amber-400">Password updated, but account cleanup could not be completed. Contact an administrator if you cannot sign in. <a href="/#/login" className="underline">Log in</a>.</p>
        : outcome === 'failed' ? <p role="alert" className="text-red-400">{error} <a href="/#/login" className="underline">Log in</a>.</p>
        : !tokenHash ? <p role="alert" className="text-red-400">Invalid or missing recovery link. Ask an administrator for a new recovery link.</p>
        : <>
          <h1 className="text-2xl font-bold mb-4">Set new password</h1>
          <p className="text-gray-400 mb-4">Use at least 8 characters. Reloading this page will require reopening your recovery email.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">New password<input aria-label="New password" type="password" autoComplete="new-password" maxLength={1024} disabled={loading} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700" /></label>
            <label className="block">Confirm password<input aria-label="Confirm password" type="password" autoComplete="new-password" maxLength={1024} disabled={loading} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700" /></label>
            {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
            <button disabled={loading} type="submit" className="w-full p-3 bg-amber-500 text-black font-bold rounded-lg disabled:opacity-50">{loading ? 'Updating password...' : 'Update password'}</button>
          </form>
        </>}
    </div>
  </main>;
}
