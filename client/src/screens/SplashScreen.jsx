import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { FriendsIcon } from '../components/Icons';
import api from '../api/api';

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

export default function SplashScreen() {
  const { login, isAuthenticated, isOperations } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [resending, setResending] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate(isOperations ? '/operations/dashboard' : '/hub', { replace: true });
  }, [isAuthenticated, isOperations, navigate]);

  const resetForm = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setShowResend(false);
  };

  async function handleResend() {
    setResending(true);
    try {
      await api.post('/api/auth/resend-verification', { email });
      setError('');
      setShowResend(false);
      setSuccess('Verification email sent — please check your inbox.');
    } catch {
      // silent — endpoint always returns 200
    } finally {
      setResending(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, userId, email: userEmail, name: userName, lastSourceDeviceId, connectLastDevice, parentOrganizationId, corporateAdminFl, orgCountry } = res.data;
      login({ userId, email: userEmail, name: userName, lastSourceDeviceId, connectLastDevice, parentOrganizationId: parentOrganizationId || null, corporateAdminFl: corporateAdminFl || 'N', orgCountry: orgCountry || null }, token);
      navigate(corporateAdminFl === 'O' ? '/operations/dashboard' : '/hub', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please check your credentials.';
      setError(msg);
      setShowResend(err.response?.status === 403 && msg.includes('verify'));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('A valid email address is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/auth/signup', { email, password, name });
      login({ userId: res.data.userId, email: res.data.email, name: res.data.name, parentOrganizationId: null, corporateAdminFl: 'N' }, res.data.token);
      navigate('/hub', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('A valid email address is required'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccess('A password reset link has been sent to your email address. Please check your inbox.');
    } catch {
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">

        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-7">
          <FriendsIcon className="w-14 h-14 text-blue-600 mb-3" />
          <h1 className="text-2xl font-bold text-gray-900">CrowdView</h1>
          <p className="text-gray-500 text-sm mt-1">Stream, Connect, Share</p>
        </div>

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={labelClass}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                placeholder="Enter your email address"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter your password"
              />
            </div>
            <div className="flex justify-end -mt-1">
              <button
                type="button"
                onClick={() => resetForm('forgot')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Forgotten Password?
              </button>
            </div>
            {error && (
              <div>
                <p className="text-red-500 text-sm">{error}</p>
                {showResend && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="mt-1 text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                  >
                    {resending ? 'Sending…' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}
            {success && <p className="text-green-600 text-sm">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => resetForm('signup')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                New User? Create a profile here...
              </button>
            </div>
          </form>
        )}

        {/* Sign Up Form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className={labelClass}>Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                className={inputClass}
                placeholder="Enter your name"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                placeholder="Enter your email address"
              />
            </div>
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Minimum 6 characters"
              />
            </div>
            <div>
              <label className={labelClass}>Repeat Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter your password"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => resetForm('login')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
              <p className="text-gray-500 text-sm mt-1">Enter your email and we'll send you a reset link.</p>
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className={inputClass}
                placeholder="Enter your email address"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {success ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            )}
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => resetForm('login')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
