import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Recovery() {
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [recoveryEvent, setRecoveryEvent] = useState<string | null>(null);

  useEffect(() => {
    // SDK-supported mechanism: listen for PASSWORD_RECOVERY auth-state event.
    // Ordinary signed-in session (SIGNED_IN / INITIAL_SESSION) without recovery event = reject.
    // Missing / invalid recovery state = reject.
    const subscription = supabase.auth?.onAuthStateChange?.((event: string, session: any) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryEvent('PASSWORD_RECOVERY');
        if (session?.user) setValid(true);
      }
    }).subscription;

    // Also verify current session state (if recovery already processed / redirect arrived)
    supabase.auth?.getSession?.().then(({ data }: any) => {
      if (data?.session?.user) {
        // Only accept as valid recovery if the SDK recovery mechanism has been triggered
        // (recovery_event / recovery_sent_at / or onAuthStateChange PASSWORD_RECOVERY fired).
        // Ordinary already-authenticated session without PASSWORD_RECOVERY event = NOT recovery.
      }
      setLoading(false);
    });
    return () => { subscription?.unsubscribe?.(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    // Must have established recovery session; ordinary authenticated session rejected
    if (recoveryEvent !== 'PASSWORD_RECOVERY') {
      setError('Invalid or missing recovery state'); return;
    }
    const { error: updateError } = await supabase.auth?.updateUser?.({ password: newPassword });
    if (updateError) { setError(updateError.message); return; }

    // Clear must_change_password after successful update (wired; requires server action call)
    try {
      const sessionData = await supabase.auth?.getSession?.();
      const token = sessionData?.data?.session?.access_token;
      let clearFailed = false;
      if (token) {
        const res = await fetch('/api/recovery-clear', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || !(await res.json()).success) clearFailed = true;
      }
      if (clearFailed) {
        setError('Password updated successfully, but account cleanup could not be completed; contact an administrator/support.');
        // Still show success for password; do NOT say password failed
        return;
      }
    } catch {
      setError('Password updated successfully, but account cleanup could not be completed; contact an administrator/support.');
      return;
    }
    setDone(true);
  };

  if (loading) return <div className="p-8 text-white">Verifying recovery link...</div>;
  if (!valid && !done) return <div className="p-8 text-red-400">Invalid or expired recovery link.</div>;
  if (done) return <div className="p-8 text-green-400">Password updated. <a href="/#/" className="underline">Log in</a>.</div>;

  return (
    <div className="p-8 max-w-md mx-auto text-white">
      <h1 className="text-2xl font-bold mb-4">Set new password</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="password" placeholder="New password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700" />
        <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700" />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button type="submit" className="w-full p-3 bg-amber-500 text-black font-bold rounded-lg">Update password</button>
      </form>
    </div>
  );
}
