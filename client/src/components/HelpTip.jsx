import React, { useState, useRef } from 'react';

export default function HelpTip({ text }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  function handleClick(e) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 6,
        left: Math.min(rect.left, window.innerWidth - 272),
      });
    }
    setOpen(o => !o);
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        aria-label="Help"
        className="w-4 h-4 rounded-full bg-gray-600 hover:bg-gray-500 text-gray-300 text-[10px] font-bold flex items-center justify-center flex-shrink-0 leading-none"
      >
        ?
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-64 bg-gray-900 border border-gray-600 rounded-lg p-3 text-gray-300 text-xs leading-relaxed shadow-xl"
            style={{ top: pos.top, left: pos.left }}
          >
            {text}
          </div>
        </>
      )}
    </>
  );
}
