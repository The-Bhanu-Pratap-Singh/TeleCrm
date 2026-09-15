import React, { useState } from 'react';
import type { User } from '../types.ts';
import { Loader2 } from 'lucide-react';
import ThemeToggle from './ThemeToggle.tsx';

interface LoginProps {
  onLogin: (token: string, user: User) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [mode, setMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [successMsg, setSuccessMsg] = useState('');



  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setSuccessMsg('Reset token generated: ' + data.resetToken + ' (Copy this to reset password)');
      setResetToken(data.resetToken);
      setMode('reset');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, resetToken, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setSuccessMsg('Password reset successful! Please log in.');
      setMode('login');
      setPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle variant="compact" />
      </div>

      <div className="max-w-md w-full space-y-6 sm:space-y-8 bg-white dark:bg-zinc-900 p-6 sm:p-10 rounded-2xl shadow-xl border border-zinc-100 dark:border-zinc-800 transition-colors">
        <div>
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
            Hanger Hub
          </h2>
          <p className="mt-1.5 sm:mt-2 text-center text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            Sign in to access your dashboard
          </p>
        </div>
        
        {mode === 'login' && (
        <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
              {successMsg}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username</label>
              <input
                name="username"
                type="text"
                required
                className="appearance-none block w-full px-3.5 sm:px-4 py-2.5 sm:py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-2xs placeholder-zinc-400 dark:placeholder-zinc-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                 <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
                 <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccessMsg(''); }} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Forgot password?</button>
              </div>
              <input
                name="password"
                type="password"
                required
                className="appearance-none block w-full px-3.5 sm:px-4 py-2.5 sm:py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-2xs placeholder-zinc-400 dark:placeholder-zinc-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
          </button>
        </form>
        )}

        {mode === 'forgot' && (
          <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6" onSubmit={handleForgot}>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username</label>
                <input
                  name="username"
                  type="text"
                  required
                  className="appearance-none block w-full px-3.5 sm:px-4 py-2.5 sm:py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-2xs placeholder-zinc-400 dark:placeholder-zinc-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request Reset Token'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Back to Login</button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form className="mt-6 sm:mt-8 space-y-5 sm:space-y-6" onSubmit={handleReset}>
            {error && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm break-words whitespace-pre-wrap">
                {successMsg}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username</label>
                <input
                  name="username"
                  type="text"
                  required
                  className="appearance-none block w-full px-3.5 sm:px-4 py-2.5 sm:py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-2xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed text-sm"
                  value={username}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Reset Token</label>
                <input
                  name="resetToken"
                  type="text"
                  required
                  className="appearance-none block w-full px-3.5 sm:px-4 py-2.5 sm:py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-2xs placeholder-zinc-400 dark:placeholder-zinc-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
                  placeholder="Paste token here"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">New Password</label>
                <input
                  name="newPassword"
                  type="password"
                  required
                  className="appearance-none block w-full px-3.5 sm:px-4 py-2.5 sm:py-3 border border-zinc-300 dark:border-zinc-700 rounded-lg shadow-2xs placeholder-zinc-400 dark:placeholder-zinc-500 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 sm:py-3 px-4 border border-transparent rounded-lg shadow-xs text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Reset Password'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }} className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Back to Login</button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
