import React from 'react';

export default function AppHeader({ left, center, right }) {
  return (
    <header className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center justify-between min-h-[56px]">
      <div className="flex items-center gap-2 min-w-[80px]">
        {left}
      </div>
      <div className="flex-1 flex items-center justify-center">
        {center}
      </div>
      <div className="flex items-center gap-2 justify-end min-w-[80px]">
        {right}
      </div>
    </header>
  );
}
