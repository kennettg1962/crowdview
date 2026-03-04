import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { XIcon, CheckIcon } from '../components/Icons';

const OUTLETS = [
  { id: 'instagram', name: 'Instagram Live', icon: '📸', color: 'from-purple-500 to-pink-500' },
  { id: 'facebook', name: 'Facebook Live', icon: '📘', color: 'from-blue-600 to-blue-700' },
  { id: 'youtube', name: 'YouTube Live', icon: '▶️', color: 'from-red-500 to-red-700' },
];

export default function StreamToPopup({ onClose }) {
  const { currentOutlet, setCurrentOutlet } = useApp();
  const [selected, setSelected] = useState(currentOutlet?.id || OUTLETS[0].id);
  const [connecting, setConnecting] = useState(false);

  function handleSelect() {
    const outlet = OUTLETS.find(o => o.id === selected);
    if (!outlet) return;
    setConnecting(true);
    // Stub: simulate connection
    setTimeout(() => {
      setCurrentOutlet(outlet);
      setConnecting(false);
      onClose();
    }, 800);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-semibold text-lg">Stream To</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {OUTLETS.map(outlet => (
            <button
              key={outlet.id}
              onClick={() => setSelected(outlet.id)}
              onDoubleClick={handleSelect}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                selected === outlet.id
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-600 hover:border-gray-500 bg-gray-700'
              }`}
            >
              <span className="text-2xl">{outlet.icon}</span>
              <span className="text-white font-medium flex-1 text-left">{outlet.name}</span>
              {selected === outlet.id && <CheckIcon className="w-5 h-5 text-blue-400" />}
              {currentOutlet?.id === outlet.id && (
                <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">Active</span>
              )}
            </button>
          ))}
          <p className="text-gray-500 text-xs text-center">Double-click or select then click Connect</p>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={connecting}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-40"
          >
            {connecting ? 'Connecting...' : 'Select'}
          </button>
        </div>
      </div>
    </div>
  );
}
