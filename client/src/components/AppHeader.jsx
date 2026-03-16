import React from 'react';

export default function AppHeader({ left, center, right }) {
  return (
    <>
      {/* Fixed on mobile, normal flow on desktop */}
      <header
        className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-4 pb-2
          bg-gray-900/95
          md:relative md:top-auto md:left-auto md:right-auto md:z-auto
          md:bg-gray-900 md:border-b md:border-gray-700 md:py-2 min-h-[56px]"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}
      >
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
      {/* Spacer so content isn't hidden behind fixed header on mobile */}
      <div className="block md:hidden flex-shrink-0" style={{ height: 'calc(env(safe-area-inset-top) + 56px)' }} />
    </>
  );
}
