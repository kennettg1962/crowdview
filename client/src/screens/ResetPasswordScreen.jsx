import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FriendsIcon } from '../components/Icons';
import api from '../api/api';

const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

export default function ResetPasswordScreen() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
          <FriendsIcon className="w-14 h-14 text-blue-600 mx-auto mb-1" />
          <h1 className="text-2xl font-bold text-gray-900">CrowdView</h1>
          <p className="text-red-500 text-sm">Invalid or missing reset link. Please request a new one.</p>
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  async function handleReset(e) {
    e.preventDefault();
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true); setError('');
    try {
      await api.post('/api/auth/reset-password', { token, newPassword });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.');
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

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-700 text-sm font-medium text-center">
                Your password has been reset successfully.
              </p>
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm transition-colors"
            >
              Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-semibold text-gray-900">Set New Password</h2>
              <p className="text-gray-500 text-sm mt-1">Enter your new password below.</p>
            </div>
            <div>
              <label className={labelClass}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className={inputClass}
                placeholder="Minimum 6 characters"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={inputClass}
                placeholder="Re-enter new password"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => navigate('/')}
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
