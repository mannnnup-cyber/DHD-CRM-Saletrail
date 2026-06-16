import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { LogIn, ShieldCheck, Mail, Loader2, Crown } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useApp();

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // First-time setup state
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupName, setSetupName] = useState('');
  const [setupEmail, setSetupEmail] = useState('support@dirtyhanddesigns.com');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');
  const [setupDone, setSetupDone] = useState(false);

  // Check if any owner account exists
  useEffect(() => {
    fetch('/api/users?action=list')
      .then(r => r.json())
      .then(d => {
        setNeedsSetup(!d.success || (d.users || []).length === 0);
        setCheckingSetup(false);
      })
      .catch(() => setCheckingSetup(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const ok = await login(email, password);
    if (!ok) setError('Invalid email or password');
    setLoading(false);
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupPassword !== setupConfirm) { setSetupError('Passwords do not match'); return; }
    if (setupPassword.length < 8) { setSetupError('Password must be at least 8 characters'); return; }
    setSetupLoading(true);
    setSetupError('');
    try {
      const r = await fetch('/api/users?action=createOwner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: setupName, email: setupEmail, password: setupPassword })
      });
      const data = await r.json();
      if (data.success) {
        setSetupDone(true);
        setNeedsSetup(false);
        setEmail(setupEmail);
      } else {
        setSetupError(data.error || 'Setup failed');
      }
    } catch {
      setSetupError('Network error — check your connection');
    }
    setSetupLoading(false);
  };

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        <div className="p-8">

          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-10 h-10 text-black" />
            </div>
          </div>

          {/* First-time setup */}
          {needsSetup ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">Welcome to DHD SalesTrail</h1>
                <p className="text-gray-400 text-sm">Create your owner account to get started</p>
              </div>

              {setupDone ? (
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto">
                    <Crown className="w-7 h-7 text-green-400" />
                  </div>
                  <p className="text-green-400 font-medium">Owner account created!</p>
                  <p className="text-gray-400 text-sm">Your email has been pre-filled below. Enter your password to log in.</p>
                  <button onClick={() => setNeedsSetup(false)}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-xl transition-all">
                    Go to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSetup} className="space-y-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Your Name</label>
                    <input type="text" value={setupName} onChange={e => setSetupName(e.target.value)} required
                      placeholder="e.g. DHD Admin"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Owner Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input type="email" value={setupEmail} onChange={e => setSetupEmail(e.target.value)} required
                        className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Password</label>
                    <input type="password" value={setupPassword} onChange={e => setSetupPassword(e.target.value)} required
                      placeholder="Min. 8 characters"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">Confirm Password</label>
                    <input type="password" value={setupConfirm} onChange={e => setSetupConfirm(e.target.value)} required
                      placeholder="Repeat password"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50" />
                  </div>

                  {setupError && <p className="text-red-400 text-sm text-center">{setupError}</p>}

                  <button type="submit" disabled={setupLoading}
                    className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2">
                    {setupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Crown className="w-5 h-5" />}
                    {setupLoading ? 'Creating account…' : 'Create Owner Account'}
                  </button>

                  <p className="text-center text-xs text-gray-600">
                    This creates the primary admin account. Team members are invited from Settings → Team.
                  </p>
                </form>
              )}
            </>
          ) : (
            /* Normal login */
            <>
              <div className="text-center mb-10">
                <h1 className="text-2xl font-bold text-white mb-2">DHD SalesTrail</h1>
                <p className="text-gray-400">Sign in to your sales dashboard</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                      placeholder="you@example.com" autoComplete="email"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
                  <div className="relative">
                    <LogIn className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                      placeholder="••••••••" autoComplete="current-password"
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                <button type="submit" disabled={loading}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-gray-600">
                Forgot your password? Contact your administrator.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
