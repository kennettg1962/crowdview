import React from 'react';

export default function CrowdViewLogo({ size = 80 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="CrowdView Logo"
    >
      {/* Background circle */}
      <circle cx="50" cy="50" r="48" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="2" />

      {/* Crowd silhouettes - three people */}
      {/* Left person */}
      <ellipse cx="25" cy="68" rx="10" ry="14" fill="#2563eb" opacity="0.7" />
      <circle cx="25" cy="50" r="7" fill="#2563eb" opacity="0.7" />

      {/* Center person (taller) */}
      <ellipse cx="50" cy="70" rx="12" ry="16" fill="#3b82f6" opacity="0.9" />
      <circle cx="50" cy="48" r="9" fill="#3b82f6" opacity="0.9" />

      {/* Right person */}
      <ellipse cx="75" cy="68" rx="10" ry="14" fill="#2563eb" opacity="0.7" />
      <circle cx="75" cy="50" r="7" fill="#2563eb" opacity="0.7" />

      {/* Camera/eye overlay in center */}
      <rect x="36" y="38" width="28" height="20" rx="4" fill="#0f172a" stroke="#60a5fa" strokeWidth="1.5" />
      <circle cx="50" cy="48" r="7" fill="#0f172a" stroke="#60a5fa" strokeWidth="1.5" />
      <circle cx="50" cy="48" r="4" fill="#3b82f6" />
      <circle cx="52" cy="46" r="1.2" fill="#93c5fd" />
      {/* Camera lens cap */}
      <rect x="60" y="42" width="8" height="4" rx="1" fill="#1e3a5f" stroke="#60a5fa" strokeWidth="1" />

      {/* Eye/lens highlight */}
      <circle cx="50" cy="48" r="2" fill="#dbeafe" opacity="0.6" />
    </svg>
  );
}
