import React, { useState, useEffect } from 'react';
import { XIcon, DeleteIcon } from './Icons';
import api from '../api/api';

/**
 * Popup form for viewing / adding / editing / deleting a corporate org user.
 * Props:
 *   user        — existing user object (null for new)
 *   onClose     — called when cancelled or saved
 *   onSave      — called after a successful save/delete
 */
export default function CorporateUserForm({ user, onClose, onSave }) {
  const isNew = !user;

  const [email, setEmail]             = useState(user?.Email ?? '');
  const [password, setPassword]       = useState('');
  const [name, setName]               = useState(user?.Name_Txt ?? '');
  const [connectLast, setConnectLast] = useState(user?.Connect_Last_Used_Device_After_Login_Fl ?? 'Y');
  const [adminFl, setAdminFl]         = useState(user?.Corporate_Admin_Fl ?? 'N');
  const [newPassword, setNewPassword] = useState('');

  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resetting, setResetting]     = useState(false);
  const [error, setError]             = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.Email ?? '');
      setName(user.Name_Txt ?? '');
      setConnectLast(user.Connect_Last_Used_Device_After_Login_Fl ?? 'Y');
      setAdminFl(user.Corporate_Admin_Fl ?? 'N');
    }
  }, [user]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (isNew) {
        await api.post('/api/corporate/users', {
          email, password, name,
          connectLastDevice: connectLast,
          corporateAdminFl: adminFl,
        });
      } else {
        await api.put(`/api/corporate/users/${user.User_Id}`, {
          name,
          connectLastDevice: connectLast,
          corporateAdminFl: adminFl,
        });
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await api.delete(`/api/corporate/users/${user.User_Id}`);
      onSave();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setError('');
    setResetting(true);
    try {
      await api.post(`/api/corporate/users/${user.User_Id}/reset-password`, { newPassword });
      setNewPassword('');
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold text-lg">
            {isNew ? 'Add User' : 'Edit User'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Main form */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1">Email *</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={!isNew}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              placeholder="user@company.com"
            />
          </div>

          {isNew && (
            <div>
              <label className="block text-gray-400 text-xs mb-1">Password *</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Min 6 characters"
              />
            </div>
          )}

          <div>
            <label className="block text-gray-400 text-xs mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Full name"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Connect last device on login</span>
            <button
              type="button"
              onClick={() => setConnectLast(v => v === 'Y' ? 'N' : 'Y')}
              className={`w-11 h-6 rounded-full transition-colors ${connectLast === 'Y' ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${connectLast === 'Y' ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Organisation admin</span>
            <button
              type="button"
              onClick={() => setAdminFl(v => v === 'Y' ? 'N' : 'Y')}
              className={`w-11 h-6 rounded-full transition-colors ${adminFl === 'Y' ? 'bg-blue-600' : 'bg-gray-600'}`}
            >
              <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${adminFl === 'Y' ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            {!isNew && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-700/40 hover:bg-red-700/60 text-red-400 rounded-lg text-sm transition-colors"
              >
                <DeleteIcon className="w-4 h-4" />
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : isNew ? 'Add User' : 'Save'}
            </button>
          </div>
        </form>

        {/* Reset password section — existing users only */}
        {!isNew && (
          <form onSubmit={handleResetPassword} className="px-5 pb-5 flex flex-col gap-3 border-t border-gray-700 pt-4">
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">Reset Password</p>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="New password (min 6 characters)"
            />
            <button
              type="submit"
              disabled={resetting || !newPassword}
              className="py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {resetting ? 'Resetting…' : 'Reset Password'}
            </button>
            {resetSuccess && <p className="text-green-400 text-sm text-center">Password reset successfully</p>}
          </form>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-60">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <p className="text-white font-medium mb-1">Delete {user?.Name_Txt || user?.Email}?</p>
            <p className="text-gray-400 text-sm mb-4">This will permanently remove the user and all their data. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm">
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
