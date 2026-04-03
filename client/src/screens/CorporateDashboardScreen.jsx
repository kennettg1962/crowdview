import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import api from '../api/api';

const STATUS = {
  detecting: { label: 'Detecting',  color: 'bg-green-500',  text: 'text-green-400' },
  streaming: { label: 'Streaming',  color: 'bg-red-500',    text: 'text-red-400'   },
  active:    { label: 'Active',     color: 'bg-blue-500',   text: 'text-blue-400'  },
  offline:   { label: 'Offline',    color: 'bg-gray-600',   text: 'text-gray-500'  },
};

function StatCard({ label, value, accent }) {
  return (
    <div className={`flex-1 bg-gray-800 rounded-xl px-4 py-3 flex flex-col items-center gap-1 border-t-2 ${accent}`}>
      <span className="text-2xl font-bold text-white">{value}</span>
      <span className="text-xs text-gray-400 text-center leading-tight">{label}</span>
    </div>
  );
}

export default function CorporateDashboardScreen() {
  const navigate = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/api/corporate/dashboard');
      setData(res.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 5s poll
  useEffect(() => {
    fetchDashboard();
    const id = setInterval(fetchDashboard, 5000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  const tabs = [
    { label: 'Dashboard', path: '/corporate/dashboard' },
    { label: 'Users',     path: '/corporate/users'     },
  ];

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <AppHeader
        center={<span className="font-bold text-lg">Corporate Dashboard</span>}
      />

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 bg-gray-800">
        {tabs.map(t => (
          <button
            key={t.path}
            onClick={() => navigate(t.path)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors
              ${t.path === '/corporate/dashboard'
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
        ) : !data ? (
          <p className="text-center text-gray-500 mt-12">Unable to load dashboard</p>
        ) : (
          <>
            {/* Summary counters */}
            <div className="flex gap-3">
              <StatCard label="Live"        value={data.activeDetects}  accent="border-green-500" />
              <StatCard label="Streaming"  value={data.liveStreams}     accent="border-red-500"   />
              <StatCard label="Active"     value={data.activeDevices}  accent="border-blue-500"  />
              <StatCard label="Users"      value={data.totalUsers}     accent="border-gray-600"  />
            </div>

            {/* Last refresh */}
            {lastRefresh && (
              <p className="text-right text-gray-600 text-xs">
                Updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}

            {/* Device list */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-700">
                <h2 className="text-sm font-semibold text-gray-300">Devices</h2>
              </div>
              {data.devices.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No users in organisation</p>
              ) : (
                <div className="divide-y divide-gray-700">
                  {data.devices.map(device => {
                    const s = STATUS[device.status] || STATUS.offline;
                    return (
                      <div key={device.userId} className="flex items-center px-4 py-3 gap-3">
                        {/* Status dot */}
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.color} ${device.status !== 'offline' ? 'animate-pulse' : ''}`} />

                        {/* Name + email */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{device.name || device.email}</p>
                          {device.name && (
                            <p className="text-xs text-gray-500 truncate">{device.email}</p>
                          )}
                        </div>

                        {/* Role badge */}
                        {device.role === 'Y' && (
                          <span className="text-[10px] bg-purple-800 text-purple-300 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            Admin
                          </span>
                        )}

                        {/* Status badge */}
                        <span className={`text-xs font-medium flex-shrink-0 ${s.text}`}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
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
