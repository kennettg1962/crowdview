import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { HomeIcon, UsersIcon } from '../components/Icons';
import { useApp } from '../context/AppContext';
import api from '../api/api';

const STATUS = {
  detecting: { label: 'Live',      color: 'bg-green-500', text: 'text-green-400' },
  streaming: { label: 'Streaming', color: 'bg-red-500',   text: 'text-red-400'  },
  active:    { label: 'Active',    color: 'bg-blue-500',  text: 'text-blue-400' },
  offline:   { label: 'Offline',   color: 'bg-gray-600',  text: 'text-gray-500' },
};

function StatCard({ label, value, accent }) {
  return (
    <div className={`flex-1 bg-gray-800 rounded-xl px-4 py-3 flex flex-col items-center gap-1 border-t-2 ${accent}`}>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400 text-center leading-tight">{label}</span>
    </div>
  );
}

export default function OperationsDashboardScreen() {
  const navigate = useNavigate();
  const { orgSpelling } = useApp();
  const Org  = orgSpelling.charAt(0).toUpperCase() + orgSpelling.slice(1); // "Organization" | "Organisation"
  const Orgs = Org + 's';
  const [orgs, setOrgs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/api/operations/dashboard');
      setOrgs(res.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('ops dashboard fetch error:', err);
      setError('Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const id = setInterval(fetchDashboard, 5000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  // Totals across all orgs
  const totals = orgs.reduce(
    (acc, org) => ({
      activeDetects: acc.activeDetects + org.activeDetects,
      liveStreams:   acc.liveStreams   + org.liveStreams,
      activeDevices: acc.activeDevices + org.activeDevices,
      totalUsers:    acc.totalUsers    + org.totalUsers,
    }),
    { activeDetects: 0, liveStreams: 0, activeDevices: 0, totalUsers: 0 }
  );

  const tabs = [
    { label: 'Dashboard',     path: '/operations/dashboard' },
    { label: Orgs,            path: '/operations/orgs'      },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <AppHeader
        left={
          <button onClick={() => navigate('/streams')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <HomeIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="font-bold text-lg">Operations Dashboard</span>}
        right={
          <button onClick={() => navigate('/operations/orgs')} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <UsersIcon className="w-[30px] h-[30px]" />
          </button>
        }
      />

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {tabs.map(t => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${t.path === '/operations/dashboard'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
        {loading ? (
          <div className="flex justify-center mt-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : error ? (
          <p className="text-center text-gray-500 mt-12">{error}</p>
        ) : (
          <>
            {/* Global summary counters */}
            <div className="flex gap-3">
              <StatCard label="Total Live"      value={totals.activeDetects}  accent="border-green-500" />
              <StatCard label="Total Streaming" value={totals.liveStreams}     accent="border-red-500"   />
              <StatCard label="Total Active"    value={totals.activeDevices}  accent="border-blue-500"  />
              <StatCard label="Total Users"     value={totals.totalUsers}     accent="border-gray-600"  />
            </div>

            {/* Last refresh */}
            {lastRefresh && (
              <p className="text-right text-gray-600 text-xs">
                Updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}

            {/* Org list */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-gray-300">{Orgs}</h2>
              </div>
              {orgs.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No {orgSpelling}s found</p>
              ) : (
                <div className="divide-y divide-gray-700">
                  {orgs.map(org => (
                    <button
                      key={org.orgId}
                      onClick={() => navigate(`/operations/org/${org.orgId}`, { state: { orgName: org.orgName } })}
                      className="w-full flex items-center px-4 py-3 gap-3 hover:bg-gray-700/50 transition-colors text-left"
                    >
                      {/* Org name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{org.orgName}</p>
                      </div>

                      {/* Mini stat pills */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-900/50 ${STATUS.detecting.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          {org.activeDetects}
                        </span>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-900/50 ${STATUS.streaming.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                          {org.liveStreams}
                        </span>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-900/50 ${STATUS.active.text}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                          {org.activeDevices}
                        </span>
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block" />
                          {org.totalUsers}
                        </span>
                        <svg className="w-4 h-4 text-gray-600 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <TrueFooter />
      <NavBar />
    </div>
  );
}
