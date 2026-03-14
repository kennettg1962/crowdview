// Platform detection utilities
// navigator.userAgent is used here for broad compatibility.
// isMac is true for macOS desktop only — iOS devices are excluded.
export const isMac = /Mac/.test(navigator.userAgent) && !/iPhone|iPad/.test(navigator.userAgent);
export const isWindows = /Win/.test(navigator.userAgent);
