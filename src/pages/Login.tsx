import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { LogIn, ShieldCheck, User as UserIcon } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!login(username, password)) {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-10 h-10 text-black" />
            </div>
          </div>
          
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold text-white mb-2">DHD SalesTrail</h1>
            <p className="text-gray-400">Sign in to your sales dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Username</label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                  placeholder="Enter your username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <div className="relative">
                <LogIn className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl py-3 pl-11 pr-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-4 rounded-xl shadow-lg shadow-amber-500/20 transition-all"
            >
              Sign In
            </button>
          </form>

          <div className="mt-10 p-4 bg-amber-500/5 rounded-xl border border-amber-500/10">
            <p className="text-xs text-amber-500 font-semibold uppercase tracking-wider mb-2">Demo Credentials</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Manager: <code className="text-white">manager</code></span>
              <span className="text-gray-400">Rep: <code className="text-white">keisha</code></span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Password for all accounts: <code className="text-gray-300">manager123</code></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
