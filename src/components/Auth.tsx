// src/components/Auth.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Mail, Lock, ArrowLeft, Send, TrendingUp, Repeat, Globe } from 'lucide-react';
import { setAuth } from '../lib/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AuthProps {
  onAuthSuccess: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset';

export function Auth({ onAuthSuccess }: AuthProps) {
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  /** Raw token from email link (`?reset_token=…`); kept in memory after URL is cleaned up. */
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (mode === 'signup' && !acceptedTerms) {
      setError('Please agree to the Terms of Service to create an account.');
      return;
    }
    setLoading(true);

    try {
      if (mode === 'signup') {
        const res = await fetch(`${API_URL}/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Sign up failed');
        setMessage('Account created! Sign in below.');
        setAcceptedTerms(false);
        setMode('signin');
      } else if (mode === 'signin') {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Sign in failed');
        setAuth(data.token, data.user);
        onAuthSuccess();
      } else if (mode === 'forgot') {
        const res = await fetch(`${API_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not send reset email');
        setMessage(data.message || 'If an account exists for that email, check your inbox for a reset link.');
        setMode('signin');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!resetToken.trim()) {
      setError('Reset link is missing. Open the link from your email again, or request a new reset email.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passwords do not match. Please enter the same password twice.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update password');
      setPassword('');
      setPasswordConfirm('');
      setResetToken('');
      setMessage(data.message || 'Your password has been updated. You can sign in now.');
      setMode('signin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('reset_token');
    if (token) {
      setResetToken(token);
      setMode('reset');
      setError('');
      setMessage('');
      setPassword('');
      setPasswordConfirm('');
      params.delete('reset_token');
      const qs = params.toString();
      const clean = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
      window.history.replaceState({}, '', clean);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2 lg:gap-16 lg:py-16">
        {/* Marketing / introduction */}
        <section className="order-2 lg:order-1">
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="inline-flex items-center justify-center w-11 h-11 bg-blue-600 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">PayRisk AI</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 leading-tight">
            Get paid faster and keep customers coming back
          </h1>
          <p className="mt-4 text-lg text-gray-600 max-w-xl">
            PayRisk AI predicts payment risk, automates invoice and payment reminders by email and
            SMS, and shows you which customers are most likely to buy again — so you protect cash
            flow and unlock hidden revenue.
          </p>

          <ul className="mt-8 space-y-4 max-w-xl">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <Send className="h-5 w-5" />
              </span>
              <span className="text-gray-700">
                <strong className="font-semibold text-gray-900">Automated reminders.</strong> Send
                payment and invoice reminders by email and SMS, right on time.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <TrendingUp className="h-5 w-5" />
              </span>
              <span className="text-gray-700">
                <strong className="font-semibold text-gray-900">Payment risk scoring.</strong> See
                who is likely to pay late before it happens.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <Repeat className="h-5 w-5" />
              </span>
              <span className="text-gray-700">
                <strong className="font-semibold text-gray-900">Repurchase insights.</strong> Spot
                customers who are ready to buy from you again.
              </span>
            </li>
          </ul>

          <div className="mt-8 max-w-xl rounded-xl border border-gray-200 bg-white/70 p-4">
            <div className="flex items-start gap-3">
              <Globe className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
              <div className="text-sm text-gray-700">
                <p>
                  <strong className="font-semibold text-gray-900">Email reminders: worldwide.</strong>{' '}
                  Reach customers in any country.
                </p>
                <p className="mt-1.5">
                  <strong className="font-semibold text-gray-900">SMS reminders:</strong> available
                  now in <strong>Australia</strong> and the <strong>United States</strong>.{' '}
                  <span className="text-gray-500">
                    Canada, New Zealand and the United Kingdom coming soon.
                  </span>
                </p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-sm text-gray-500">
            Free Starter plan · No credit card required to begin.
          </p>
        </section>

        {/* Sign in / sign up */}
        <div className="order-1 w-full max-w-md mx-auto lg:order-2 lg:mx-0 lg:justify-self-end">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
          {/* 标题 */}
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {mode === 'signin' && 'Sign In'}
            {mode === 'signup' && 'Create Account'}
            {mode === 'forgot' && 'Reset Password'}
            {mode === 'reset' && 'Set New Password'}
          </h2>

          {/* 错误提示 */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* 成功消息 */}
          {message && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {message}
            </div>
          )}

          {/* 重置密码表单 */}
          {mode === 'reset' ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>

              <button
                type="button"
                onClick={() => setMode('signin')}
                className="w-full text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Sign In
              </button>
            </form>
          ) : (
            /* 登录/注册/忘记密码表单 */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 邮箱输入 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* 密码输入（登录/注册时需要） */}
              {mode !== 'forgot' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="••••••••"
                      minLength={mode === 'signup' ? 6 : undefined}
                    />
                  </div>
                </div>
              )}

              {/* 忘记密码链接 */}
              {mode === 'signin' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError('');
                      setMessage('');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {mode === 'signup' && (
                <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-3">
                  <input
                    id="auth-accept-terms"
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="auth-accept-terms" className="text-sm text-gray-700 leading-snug">
                    I agree to the{' '}
                    <Link
                      to="/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      Terms of Service
                    </Link>
                    .
                  </label>
                </div>
              )}

              {/* 提交按钮 */}
              <button
                type="submit"
                disabled={loading || (mode === 'signup' && !acceptedTerms)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {loading
                  ? 'Loading...'
                  : mode === 'signin'
                    ? 'Sign In'
                    : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Email'}
              </button>
            </form>
          )}

          {/* 切换模式链接 */}
          {mode !== 'reset' && (
            <div className="mt-6 text-center">
              {mode === 'signin' ? (
                <button
                  onClick={() => {
                    setMode('signup');
                    setError('');
                    setMessage('');
                    setAcceptedTerms(false);
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Don't have an account? Sign up
                </button>
              ) : mode === 'signup' ? (
                <button
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setMessage('');
                    setAcceptedTerms(false);
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Already have an account? Sign in
                </button>
              ) : mode === 'forgot' ? (
                <button
                  onClick={() => {
                    setMode('signin');
                    setError('');
                    setMessage('');
                  }}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Back to Sign In
                </button>
              ) : null}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          <Link to="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link to="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>
          <span className="mx-2">·</span>
          <Link to="/sms-terms" className="text-blue-600 hover:underline">
            SMS Terms
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
}
