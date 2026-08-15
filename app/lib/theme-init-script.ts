// Prevents a flash of the wrong theme on load: resolves the visitor's stored
// choice, falling back to OS preference, before first paint. Shared verbatim
// across every root layout (auth, dashboard, ...) so `data-bs-theme` and the
// `lte-theme` localStorage key stay consistent app-wide.
export const THEME_INIT_SCRIPT = `
(() => {
  'use strict';
  const root = document.documentElement;
  const STORAGE_KEY = 'lte-theme';
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {}
  let resolved = 'light';
  if (stored === 'dark' || stored === 'light') {
    resolved = stored;
  } else if (globalThis.matchMedia('(prefers-color-scheme: dark)').matches) {
    resolved = 'dark';
  }
  root.setAttribute('data-bs-theme', resolved);
  root.style.colorScheme = resolved;
})();
`;
