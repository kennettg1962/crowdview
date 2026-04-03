import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { useApp } from '../context/AppContext';
import api from '../api/api';

const EMPTY_FORM = {
  orgName: '', contactName: '', contactEmail: '', contactPhone: '',
  contactAddress: '', contactCity: '', contactState: '', contactZip: '',
  contactCountry: '', description: '',
  adminEmail: '', adminPassword: '', adminName: '',
};

export default function OperationsOrgsScreen() {
  const navigate = useNavigate();
  const { orgSpelling } = useApp();
  const Org  = orgSpelling.charAt(0).toUpperCase() + orgSpelling.slice(1);
  const Orgs = Org + 's';
  const [orgs, setOrgs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // Modal state
  const [showForm, setShowForm]     = useState(false);
  const [editOrg, setEditOrg]       = useState(null); // null = create new
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState('');
  const [saving, setSaving]         = useState(false);

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await api.get('/api/operations/orgs');
      setOrgs(res.data);
      setError(null);
    } catch (err) {
      console.error('ops orgs fetch error:', err);
      setError(`Unable to load ${orgSpelling}s`);
    } finally {
      setLoading(false);
    }
  }, [orgSpelling]);

  useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

  function openCreate() {
    setEditOrg(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(org) {
    setEditOrg(org);
    setForm({
      orgName:        org.Organization_Name_Txt    || '',
      contactName:    org.Contact_Name_Txt         || '',
      contactEmail:   org.Contact_Email_Txt        || '',
      contactPhone:   org.Contact_Phone_Txt        || '',
      contactAddress: '',
      contactCity:    org.Contact_City_Txt         || '',
      contactState:   org.Contact_State_Txt        || '',
      contactZip:     '',
      contactCountry: org.Contact_Country_Txt      || '',
      description:    org.Description_Multi_Line_Txt || '',
      adminEmail: '', adminPassword: '', adminName: '',
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditOrg(null);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editOrg) {
        await api.put(`/api/operations/orgs/${editOrg.Organization_Id}`, form);
      } else {
        await api.post('/api/operations/orgs', form);
      }
      await fetchOrgs();
      closeForm();
    } catch (err) {
      const msg = err.response?.data?.error || 'Save failed';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  const tabs = [
    { label: 'Dashboard',     path: '/operations/dashboard' },
    { label: Orgs,            path: '/operations/orgs'      },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <AppHeader
        center={<span className="font-bold text-lg">{Orgs}</span>}
      />

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {tabs.map(t => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${t.path === '/operations/orgs'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {/* Add button */}
        <div className="flex justify-end">
          <button
            onClick={openCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + Add {Org}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center mt-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : error ? (
          <p className="text-center text-gray-500 mt-12">{error}</p>
        ) : orgs.length === 0 ? (
          <p className="text-center text-gray-500 mt-12 text-sm">No {orgSpelling}s yet</p>
        ) : (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-gray-700">
              {orgs.map(org => (
                <div key={org.Organization_Id} className="flex items-center px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{org.Organization_Name_Txt}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {[org.Contact_City_Txt, org.Contact_Country_Txt].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {org.User_Count} {Number(org.User_Count) === 1 ? 'user' : 'users'}
                  </span>
                  <button
                    onClick={() => openEdit(org)}
                    className="flex-shrink-0 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <TrueFooter />
      <NavBar />

      {/* Add / Edit modal overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-gray-800 rounded-t-2xl sm:rounded-2xl overflow-y-auto max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
              <h2 className="text-base font-semibold text-white">
                {editOrg ? `Edit ${Org}` : `Add ${Org}`}
              </h2>
              <button
                onClick={closeForm}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Organization details */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">{Org} Name <span className="text-red-400">*</span></label>
                <input
                  name="orgName"
                  value={form.orgName}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Acme Corporation"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contact Name</label>
                  <input
                    name="contactName"
                    value={form.contactName}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Jane Smith"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Contact Email</label>
                  <input
                    name="contactEmail"
                    value={form.contactEmail}
                    onChange={handleChange}
                    type="email"
                    className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="jane@acme.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input
                  name="contactPhone"
                  value={form.contactPhone}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="+1 555 000 0000"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Address</label>
                <input
                  name="contactAddress"
                  value={form.contactAddress}
                  onChange={handleChange}
                  className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">City</label>
                  <input
                    name="contactCity"
                    value={form.contactCity}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="New York"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">State</label>
                  <input
                    name="contactState"
                    value={form.contactState}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="NY"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Zip / Postcode</label>
                  <input
                    name="contactZip"
                    value={form.contactZip}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10001"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Country</label>
                  <input
                    name="contactCountry"
                    value={form.contactCountry}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="USA"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder={`Brief description of the ${orgSpelling}…`}
                />
              </div>

              {/* Admin user fields — new org only */}
              {!editOrg && (
                <>
                  <div className="border-t border-gray-700 pt-4">
                    <p className="text-xs font-semibold text-gray-300 mb-3 uppercase tracking-wide">Admin Account</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Admin Name</label>
                    <input
                      name="adminName"
                      value={form.adminName}
                      onChange={handleChange}
                      className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Admin User"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Admin Email <span className="text-red-400">*</span></label>
                    <input
                      name="adminEmail"
                      value={form.adminEmail}
                      onChange={handleChange}
                      required
                      type="email"
                      className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="admin@acme.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Admin Password <span className="text-red-400">*</span></label>
                    <input
                      name="adminPassword"
                      value={form.adminPassword}
                      onChange={handleChange}
                      required
                      type="password"
                      minLength={6}
                      className="w-full bg-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Min 6 characters"
                    />
                  </div>
                </>
              )}

              {formError && (
                <p className="text-red-400 text-sm">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                >
                  {saving ? 'Saving…' : editOrg ? 'Save Changes' : `Create ${Org}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
