import React, { useState } from 'react';

export default function TrueFooter() {
  const [modal, setModal] = useState(null);

  const content = {
    about: 'CrowdView is a real-time crowd identification and streaming platform. Identify friends in a crowd using advanced facial recognition technology.',
    contact: 'Contact us at: support@crowdview.app\nFor business inquiries: business@crowdview.app',
    faq: 'Q: How does face recognition work?\nA: We use AI-powered recognition to identify known friends.\n\nQ: Is my data secure?\nA: All data is encrypted and stored securely.',
  };

  return (
    <>
      <footer className="hidden md:flex bg-gray-50 text-gray-600 text-sm py-3 px-4 justify-center gap-8 border-t border-gray-200">
        <button onClick={() => setModal('about')} className="hover:text-gray-900 hover:underline transition-colors">
          About Us
        </button>
        <button onClick={() => setModal('contact')} className="hover:text-gray-900 hover:underline transition-colors">
          Contact
        </button>
        <button onClick={() => setModal('faq')} className="hover:text-gray-900 hover:underline transition-colors">
          FAQ
        </button>
      </footer>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setModal(null)}>
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-800 mb-3 capitalize">
              {modal === 'faq' ? 'FAQ' : modal === 'about' ? 'About Us' : 'Contact Us'}
            </h2>
            <p className="text-gray-600 whitespace-pre-line text-sm">{content[modal]}</p>
            <button
              onClick={() => setModal(null)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
