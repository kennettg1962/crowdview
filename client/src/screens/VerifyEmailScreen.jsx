import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/api';

export default function VerifyEmailScreen() {
  const [params] = useSearchParams();
  const token   = params.get('token');
  const pending = params.get('pending');

  const [status, setStatus] = useState('idle'); // idle | verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    setStatus('verifying');
    api.get(`/api/auth/verify-email?token=${token}`)
      .then(res => { setStatus('success'); setMessage(res.data.message); })
      .catch(err => { setStatus('error'); setMessage(err.response?.data?.error || 'Verification failed.'); });
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <a href="https://crowdviewtv.com" className="text-xl font-bold text-gray-900">
          Crowd<span className="text-blue-600">View</span>
        </a>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-10 text-center">

          {/* Pending — just signed up, waiting for email click */}
          {pending && !token && (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Check your inbox</h1>
              <p className="text-gray-500 text-sm leading-relaxed">
                We've sent a verification link to your email address. Click the link to activate your account.
              </p>
              <p className="text-gray-400 text-xs mt-4">The link expires in 24 hours.</p>
            </>
          )}

          {/* Verifying token */}
          {status === 'verifying' && (
            <>
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6 animate-pulse">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying…</h1>
            </>
          )}

          {/* Success */}
          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Email verified!</h1>
              <p className="text-gray-500 text-sm mb-8">{message}</p>
              <Link to="/"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg px-8 py-3 text-sm transition-colors">
                Log in to CrowdView
              </Link>
            </>
          )}

          {/* Error */}
          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-3">Link expired</h1>
              <p className="text-gray-500 text-sm mb-8">{message}</p>
              <p className="text-gray-400 text-xs">
                Please <a href="/signup" className="text-blue-600 hover:underline">sign up again</a> or contact{' '}
                <a href="mailto:contact@crowdviewtv.com" className="text-blue-600 hover:underline">support</a>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
