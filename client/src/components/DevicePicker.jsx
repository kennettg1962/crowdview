import React, { useState, useEffect, useRef } from 'react';
import { CheckIcon, ChevronDownIcon } from './Icons';

/**
 * Inline device picker dropdown — camera or microphone.
 * Shows current device name; clicking opens a list of available devices.
 * Selecting a device calls onSwitch(deviceInfo) immediately.
 */
export default function DevicePicker({ icon: Icon, kind, current, placeholder, onSwitch, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState([]);
  const containerRef = useRef(null);

  async function handleToggle() {
    if (disabled) return;
    if (!open) {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(all.filter(d => {
        if (d.kind !== kind || !d.deviceId || !d.label) return false;
        // 'default' is a virtual alias Chrome creates for the system default — the real
        // device already appears in the list under its own deviceId, so skip the alias.
        if (d.deviceId === 'default') return false;
        // Filter out known virtual/routing devices that aren't real physical inputs.
        const lowerLabel = d.label.toLowerCase();
        if (lowerLabel.includes('microsoft teams')) return false;
        return true;
      }));
    }
    setOpen(v => !v);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayLabel = current?.label
    ? current.label.replace(/\s*\(.*?\)\s*$/, '').trim() // strip "(0000:0001)" suffix
    : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border max-w-[200px] ${
          disabled
            ? 'bg-slate-700 border-slate-600 text-slate-500 cursor-not-allowed'
            : open
            ? 'bg-slate-500 border-slate-400 text-white'
            : 'bg-slate-600 hover:bg-slate-500 text-white border-slate-500'
        }`}
        title={current?.label || placeholder}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon className={`w-3 h-3 flex-shrink-0 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl z-50 min-w-[220px] max-w-xs py-1">
          {devices.length === 0 ? (
            kind === 'audioinput' ? (
              // No labeled devices = permission not yet granted this session.
              // Clicking here IS the user gesture Chrome needs.
              <button
                onClick={() => { setOpen(false); onSwitch(null); }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-blue-400 hover:bg-gray-700 text-left"
              >
                Connect microphone
              </button>
            ) : (
              <p className="px-4 py-2 text-sm text-gray-500 italic">No devices found</p>
            )
          ) : devices.map(d => {
            const isActive = current?.deviceId === d.deviceId;
            const label = d.label.replace(/\s*\(.*?\)\s*$/, '').trim();
            return (
              <button
                key={d.deviceId}
                onClick={() => { setOpen(false); onSwitch(d); }}
                className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left transition-colors ${
                  isActive ? 'text-white bg-blue-700/40' : 'text-gray-200 hover:bg-gray-700'
                }`}
              >
                <span className="truncate">{label}</span>
                {isActive && <CheckIcon className="w-4 h-4 text-green-400 flex-shrink-0 ml-3" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
