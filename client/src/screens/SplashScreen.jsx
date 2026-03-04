import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import CrowdViewLogo from '../components/CrowdViewLogo';
import api from '../api/api';

export default function SplashScreen() {
  const { login, isAuthenticated } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Already logged in → redirect
  React.useEffect(() => {
    if (isAuthenticated) navigate('/hub', { replace: true });
  }, [isAuthenticated, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/auth/login', { email, password });
      login({
        userId: res.data.userId,
        email: res.data.email,
        name: res.data.name,
        connectLastDevice: res.data.connectLastDevice,
        lastSourceDeviceId: res.data.lastSourceDeviceId
      }, res.data.token);
      navigate('/hub', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (!email || !password) { setError('Email and password required'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/auth/signup', { email, password, name });
      login({
        userId: res.data.userId,
        email: res.data.email,
        name: res.data.name
      }, res.data.token);
      navigate('/hub', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (!email) { setError('Email required'); return; }
    setLoading(true); setError(''); setSuccess('');
    try {
      await api.post('/api/auth/forgot-password', { email });
      setSuccess('If that email exists, a reset link has been sent.');
    } catch {
      setError('Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const resetForm = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      {/* Logo & Brand */}
      <div className="flex flex-col items-center mb-8 gap-3">
        <CrowdViewLogo size={100} />
        <h1 className="text-4xl font-bold text-white tracking-wide">CrowdView</h1>
        <p className="text-gray-400 text-sm">Identify friends in the crowd</p>
      </div>

      {/* Card */}
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        {/* Tabs */}
        {mode !== 'forgot' && (
          <div className="flex mb-5 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => resetForm('login')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'login' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => resetForm('signup')}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="your@email.com"
                autoFocus
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-40 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => resetForm('forgot')}
              className="w-full text-center text-gray-400 hover:text-gray-200 text-sm"
            >
              Forgot Password?
            </button>
          </form>
        )}

        {/* Sign Up Form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-gray-300 text-sm block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={100}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Your display name"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="Re-enter password"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-40 transition-colors"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <h3 className="text-white font-semibold text-center">Reset Password</h3>
            <div>
              <label className="text-gray-300 text-sm block mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                placeholder="your@email.com"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            {success && <p className="text-green-400 text-sm">{success}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium disabled:opacity-40"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button
              type="button"
              onClick={() => resetForm('login')}
              className="w-full text-center text-gray-400 hover:text-gray-200 text-sm"
            >
              ← Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
