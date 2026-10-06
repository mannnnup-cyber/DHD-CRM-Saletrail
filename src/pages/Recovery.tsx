import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function Recovery() {
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase Auth validates recovery token from URL automatically
    // when the page loads with the recovery link; establish session.
    const supabaseClient = (supabase && typeof (supabase as any).auth?.getSession === 'function') ? (supabase as any) : null;
    if (supabaseClient) {
      supabaseClient.auth.getSession().then(({ data }: any) => {
        if (data.session && data.session.user && data.session.user.recovery_session) {
          setValid(true);
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    const supabaseClient = (supabase && typeof (supabase as any).auth?.getSession === 'function') ? (supabase as any) : null;
    if (!supabaseClient) { setError('Recovery session unavailable'); return; }
    const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (updateError) { setError(updateError.message); return; }
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
