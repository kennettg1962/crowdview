import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { MovieCameraIcon, FriendsIcon } from '../components/Icons';
import { Link } from 'react-router-dom';
import api from '../api/api';

export default function ProfileScreen() {
  const navigate = useNavigate();
  const { user, setUser, isCorporate } = useApp();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [connectLastDevice, setConnectLastDevice] = useState('N');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isDirty = useRef(false);
  const pendingNav = useRef(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    try {
      const res = await api.get('/api/users/profile');
      setName(res.data.Name_Txt || '');
      setConnectLastDevice(res.data.Connect_Last_Used_Device_After_Login_Fl || 'N');
    } catch (err) {
      console.error('Failed to load profile', err);
    } finally {
      setLoading(false);
      isDirty.current = false;
    }
  }

  function markDirty() {
    isDirty.current = true;
  }

  function validate() {
    const errs = {};
    if (name.trim().length > 50) errs.name = 'Name must be 50 chars or less';
    if (password && password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (password && password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    return errs;
  }

  async function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true); setErrors({}); setSuccess('');
    try {
      const payload = { name: name.trim(), connectLastDevice };
      if (password) payload.password = password;
      await api.put('/api/users/profile', payload);
      setUser(prev => ({ ...prev, name: name.trim() }));
      setSuccess('Profile updated successfully!');
      setPassword('');
      setConfirmPassword('');
      isDirty.current = false;
    } catch (err) {
      setErrors({ general: err.response?.data?.error || 'Update failed' });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (isDirty.current) {
      setConfirmLeave(true);
      pendingNav.current = -1;
    } else {
      navigate(-1);
    }
  }

  return (
    <div className="min-h-screen bg-slate-700 flex flex-col">
      {/* Header */}
      <AppHeader
        left={
          <button onClick={() => navigate('/hub')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <MovieCameraIcon className="w-5 h-5" />
          </button>
        }
        center={<span className="text-white font-bold text-xl tracking-wide text-center leading-tight">{isCorporate ? <><div>CrowdView</div><div>Corporate</div></> : 'CrowdView'}</span>}
        right={
          <button onClick={() => navigate('/friends')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <FriendsIcon className="w-5 h-5" />
          </button>
        }
      />

      <main className="flex-1 flex justify-center p-4">
        <div className="w-full max-w-md">
          {loading ? (
            <div className="flex justify-center mt-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-6 space-y-5">
              <h2 className="text-white text-xl font-semibold">Profile Settings</h2>

              {/* Email (read-only) */}
              <div>
                <label className="text-gray-400 text-sm block mb-1">Email</label>
                <p className="text-gray-300 text-sm bg-gray-700 px-3 py-2 rounded-lg">{user?.email || '—'}</p>
              </div>

              {/* Name */}
              <div>
                <label className="text-gray-300 text-sm block mb-1">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); markDirty(); }}
                  maxLength={50}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Your display name"
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>

              {/* New Password */}
              <div>
                <label className="text-gray-300 text-sm block mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); markDirty(); }}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  placeholder="Leave blank to keep current"
                />
                {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password}</p>}
              </div>

              {/* Confirm Password */}
              {password && (
                <div>
                  <label className="text-gray-300 text-sm block mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); markDirty(); }}
                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Re-enter new password"
                  />
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword}</p>}
                </div>
              )}

              {/* Connect Last Device */}
              <div>
                <label className="text-gray-300 text-sm block mb-1">Connect Last Used Device on Login</label>
                <select
                  value={connectLastDevice}
                  onChange={e => { setConnectLastDevice(e.target.value); markDirty(); }}
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="Y">Yes</option>
                  <option value="N">No</option>
                </select>
              </div>

              {errors.general && <p className="text-red-400 text-sm">{errors.general}</p>}
              {success && <p className="text-green-400 text-sm">{success}</p>}

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancel}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Update'}
                </button>
              </div>
            </div>
          )}

          {/* Help & legal links */}
          <div className="text-center pt-2 flex items-center justify-center gap-4">
            <Link to="/quickstart" className="text-gray-500 hover:text-gray-300 text-xs underline underline-offset-2">
              Quick Start
            </Link>
            <span className="text-gray-700 text-xs">·</span>
            <Link to="/guide" className="text-gray-500 hover:text-gray-300 text-xs underline underline-offset-2">
              User Guide
            </Link>
            <span className="text-gray-700 text-xs">·</span>
            <Link to="/privacy" className="text-gray-500 hover:text-gray-300 text-xs underline underline-offset-2">
              Privacy Policy
            </Link>
          </div>
        </div>
      </main>

      <TrueFooter />
      <NavBar />

      {/* Dirty check confirm */}
      {confirmLeave && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white mb-4">You have unsaved changes. Leave anyway?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
              >
                Stay
              </button>
              <button
                onClick={() => { setConfirmLeave(false); navigate(pendingNav.current || -1); }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
