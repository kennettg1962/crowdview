import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { XIcon } from './Icons';
import api from '../api/api';

function AccordionItem({ title, content }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-700">
      <button
        className="w-full text-left px-4 py-3 text-gray-200 hover:bg-gray-700 flex justify-between items-center"
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-4 py-3 text-gray-400 text-sm bg-gray-800 whitespace-pre-line">
          {content}
        </div>
      )}
    </div>
  );
}

export default function MenuSlideout() {
  const { slideoutOpen, setSlideoutOpen, logout, isCorporate } = useApp();
  const navigate = useNavigate();
  const [sub, setSub] = useState(null);

  useEffect(() => {
    if (!slideoutOpen || isCorporate) return;
    api.get('/api/subscription/status').then(r => setSub(r.data)).catch(() => {});
  }, [slideoutOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => setSlideoutOpen(false);

  const handleLogout = () => {
    logout();
    close();
    navigate('/');
  };

  const handleProfile = () => {
    close();
    navigate('/profile');
  };

  if (!slideoutOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={close}
      />

      {/* Slide-out panel — sits between fixed header and fixed nav */}
      <div
        className="fixed left-0 w-72 bg-gray-900 z-50 shadow-2xl flex flex-col"
        style={{
          top: 'calc(env(safe-area-inset-top) + 56px)',
          bottom: 'calc(env(safe-area-inset-bottom) + 56px)',
        }}
      >
        {/* Header */}
        <div className="bg-gray-800 px-4 py-4 flex items-center justify-between border-b border-gray-700">
          <span className="text-white font-semibold text-lg">Menu</span>
          <button onClick={close} className="text-gray-400 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Menu items */}
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={handleProfile}
            className="w-full text-left px-4 py-3 text-gray-200 hover:bg-gray-700 border-b border-gray-700"
          >
            Update Profile
          </button>

          {/* Subscription / live-minutes panel */}
          {isCorporate ? (
            <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Plan</p>
              <p className="text-white font-semibold text-sm">Corporate — Unlimited live</p>
            </div>
          ) : sub ? (
            <div className="px-4 py-3 border-b border-gray-700 bg-gray-800">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Subscription</p>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-300 text-sm capitalize">{sub.tier === 'trial' ? 'Free Trial' : sub.tier.charAt(0).toUpperCase() + sub.tier.slice(1)} Plan</span>
                {sub.trialDaysLeft !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sub.trialDaysLeft <= 5 ? 'bg-red-900 text-red-300' : 'bg-blue-900 text-blue-300'}`}>
                    {sub.trialDaysLeft}d left
                  </span>
                )}
              </div>
              {sub.isUnlimited ? (
                <p className="text-green-400 text-sm font-medium">Unlimited live minutes</p>
              ) : (
                <>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Live minutes this period</span>
                    <span>{sub.minutesUsed} / {sub.minutesTotal} min</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${sub.canUseLive ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ width: sub.minutesTotal > 0 ? `${Math.min(100, (sub.minutesUsed / sub.minutesTotal) * 100)}%` : '100%' }}
                    />
                  </div>
                  {!sub.canUseLive && (
                    <p className="text-red-400 text-xs mt-1">No live minutes remaining. Top-up to continue.</p>
                  )}
                </>
              )}
            </div>
          ) : null}

          <AccordionItem
            title="About"
            content="CrowdView is a real-time crowd identification and streaming platform. Identify friends in a crowd using advanced facial recognition technology."
          />

          <AccordionItem
            title="Contact Us"
            content={"support@crowdview.app\nbusiness@crowdview.app"}
          />
        </div>

        {/* Footer buttons */}
        <div className="border-t border-gray-700 p-4 flex flex-col gap-2">
          <button
            onClick={close}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            Back
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </>
  );
}
