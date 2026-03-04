import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { XIcon } from './Icons';

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
  const { slideoutOpen, setSlideoutOpen, logout } = useApp();
  const navigate = useNavigate();

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

  return (
    <>
      {/* Overlay */}
      {slideoutOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={close}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-gray-900 z-50 shadow-2xl transform transition-transform duration-300 flex flex-col ${
          slideoutOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
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
