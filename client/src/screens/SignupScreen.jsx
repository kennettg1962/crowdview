import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

const COUNTRIES = [
  'United States', 'United Kingdom', 'Canada', 'Australia', 'New Zealand',
  'Ireland', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands',
  'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria',
  'Belgium', 'Portugal', 'Poland', 'Singapore', 'Japan', 'South Korea',
  'India', 'South Africa', 'Brazil', 'Mexico', 'Other'
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV',
  'NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
  'TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

export default function SignupScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1 = org info, 2 = contact + password
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    organizationName: '',
    addressLn1: '',
    city: '',
    state: '',
    zipCd: '',
    country: 'United States',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    password: '',
    confirmPassword: '',
  });

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  function validateStep1() {
    if (!form.organizationName.trim()) return 'Organization name is required';
    if (!form.city.trim()) return 'City is required';
    if (!form.country) return 'Country is required';
    return null;
  }

  function validateStep2() {
    if (!form.contactName.trim()) return 'Contact name is required';
    if (!form.contactEmail.trim()) return 'Email address is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) return 'Enter a valid email address';
    if (!form.password) return 'Password is required';
    if (form.password.length < 6) return 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    return null;
  }

  function handleNext(e) {
    e.preventDefault();
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setStep(2);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateStep2();
    if (err) { setError(err); return; }
    setError('');
    setSubmitting(true);
    try {
      await api.post('/api/auth/register', form);
      navigate('/verify-email?pending=1');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <a href="https://crowdviewtv.com" className="text-xl font-bold text-gray-900">
          Crowd<span className="text-blue-600">View</span>
        </a>
        <span className="text-sm text-gray-500">
          Already have an account?{' '}
          <a href="/" className="text-blue-600 font-semibold hover:underline">Log in</a>
        </span>
      </header>

      {/* Form card */}
      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-lg p-8">

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map(n => (
              <React.Fragment key={n}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${step >= n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {n}
                </div>
                {n < 2 && <div className={`flex-1 h-0.5 ${step > n ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {step === 1 ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Start your free trial</h1>
              <p className="text-gray-500 text-sm mb-8">Tell us about your organization.</p>

              <form onSubmit={handleNext} className="space-y-4">
                <div>
                  <label className={labelCls}>Organization name <span className="text-red-500">*</span></label>
                  <input value={form.organizationName} onChange={set('organizationName')}
                    className={inputCls} placeholder="Acme Corp" required />
                </div>
                <div>
                  <label className={labelCls}>Address line 1</label>
                  <input value={form.addressLn1} onChange={set('addressLn1')}
                    className={inputCls} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City <span className="text-red-500">*</span></label>
                    <input value={form.city} onChange={set('city')}
                      className={inputCls} placeholder="New York" required />
                  </div>
                  <div>
                    <label className={labelCls}>State / Province</label>
                    {form.country === 'United States' ? (
                      <select value={form.state} onChange={set('state')} className={inputCls}>
                        <option value="">Select state</option>
                        {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    ) : (
                      <input value={form.state} onChange={set('state')}
                        className={inputCls} placeholder="Province" />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>ZIP / Postal code</label>
                    <input value={form.zipCd} onChange={set('zipCd')}
                      className={inputCls} placeholder="10001" />
                  </div>
                  <div>
                    <label className={labelCls}>Country <span className="text-red-500">*</span></label>
                    <select value={form.country} onChange={set('country')} className={inputCls} required>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <button type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-3 text-sm transition-colors mt-2">
                  Continue
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Your contact details</h1>
              <p className="text-gray-500 text-sm mb-8">This will be your admin login for CrowdView.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelCls}>Full name <span className="text-red-500">*</span></label>
                  <input value={form.contactName} onChange={set('contactName')}
                    className={inputCls} placeholder="Jane Smith" required />
                </div>
                <div>
                  <label className={labelCls}>Email address <span className="text-red-500">*</span></label>
                  <input value={form.contactEmail} onChange={set('contactEmail')}
                    type="email" className={inputCls} placeholder="jane@acmecorp.com" required />
                </div>
                <div>
                  <label className={labelCls}>Phone number</label>
                  <input value={form.contactPhone} onChange={set('contactPhone')}
                    type="tel" className={inputCls} placeholder="+1 555 000 0000" />
                </div>
                <div>
                  <label className={labelCls}>Password <span className="text-red-500">*</span></label>
                  <input value={form.password} onChange={set('password')}
                    type="password" className={inputCls} placeholder="Min. 6 characters" required />
                </div>
                <div>
                  <label className={labelCls}>Confirm password <span className="text-red-500">*</span></label>
                  <input value={form.confirmPassword} onChange={set('confirmPassword')}
                    type="password" className={inputCls} placeholder="Repeat password" required />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex gap-3 mt-2">
                  <button type="button" onClick={() => { setStep(1); setError(''); }}
                    className="flex-1 border border-gray-300 text-gray-700 font-semibold rounded-lg py-3 text-sm hover:bg-gray-50 transition-colors">
                    Back
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition-colors">
                    {submitting ? 'Creating account…' : 'Create account'}
                  </button>
                </div>

                <p className="text-xs text-gray-400 text-center pt-1">
                  By creating an account you agree to our{' '}
                  <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
