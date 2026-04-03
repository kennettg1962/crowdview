import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import NavBar from '../components/NavBar';
import TrueFooter from '../components/TrueFooter';
import { BackIcon } from '../components/Icons';
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

export default function OperationsOrgDetailScreen() {
  const navigate = useNavigate();
  const { orgId } = useParams();
  const location  = useLocation();
  const { orgSpelling } = useApp();
  const Org     = orgSpelling.charAt(0).toUpperCase() + orgSpelling.slice(1);
  const orgName = location.state?.orgName || `${Org} ${orgId}`;

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get(`/api/operations/dashboard/${orgId}`);
      setData(res.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('ops org detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchDashboard();
    const id = setInterval(fetchDashboard, 5000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      <AppHeader
        left={
          <button onClick={() => navigate(-1)} className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700">
            <BackIcon className="w-[30px] h-[30px]" />
          </button>
        }
        center={<span className="font-bold text-lg truncate">{orgName}</span>}
        right={null}
      />

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
              <StatCard label="Live"       value={data.activeDetects}  accent="border-green-500" />
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
                <p className="text-center text-gray-500 py-8 text-sm">No users in {orgSpelling}</p>
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

                        {/* Right panel — fixed width so every row aligns */}
                        <div className="flex items-center gap-3 flex-shrink-0 w-72">
                          {/* Detection counts */}
                          <div className="flex flex-col items-center flex-1 gap-0.5">
                            <span className="text-[9px] text-gray-500 uppercase tracking-wide whitespace-nowrap">Face Detect Usage</span>
                            <div className="flex gap-3">
                              <div className="flex flex-col items-center w-10">
                                <span className="text-xs font-semibold text-white">{device.sessionCount.toLocaleString()}</span>
                                <span className="text-[9px] text-gray-500 uppercase tracking-wide">Session</span>
                              </div>
                              <div className="flex flex-col items-center w-10">
                                <span className="text-xs font-semibold text-white">{device.monthCount.toLocaleString()}</span>
                                <span className="text-[9px] text-gray-500 uppercase tracking-wide">Month</span>
                              </div>
                              <div className="flex flex-col items-center w-10">
                                <span className="text-xs font-semibold text-white">{device.yearCount.toLocaleString()}</span>
                                <span className="text-[9px] text-gray-500 uppercase tracking-wide">Year</span>
                              </div>
                            </div>
                          </div>

                          {/* Role badge — fixed width so status always lines up */}
                          <div className="w-12 flex justify-center">
                            {device.role === 'Y' && (
                              <span className="text-[10px] bg-purple-800 text-purple-300 px-1.5 py-0.5 rounded font-medium">
                                Admin
                              </span>
                            )}
                          </div>

                          {/* Status */}
                          <div className="w-16 text-right">
                            <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
                          </div>
                        </div>
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
