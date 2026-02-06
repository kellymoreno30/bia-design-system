/**
 * BIA Design System — Theme Toggle Utility
 * Manages light / dark mode switching via the data-theme attribute on <html>.
 */

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bia-theme';
const ATTRIBUTE = 'data-theme';

/**
 * Get the current active theme.
 */
export function getTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return (document.documentElement.getAttribute(ATTRIBUTE) as Theme) || 'light';
}

/**
 * Set the theme to 'light' or 'dark'.
 * Persists the choice in localStorage.
 */
export function setTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(ATTRIBUTE, theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage may be unavailable (SSR, privacy mode)
  }
}

/**
 * Toggle between light and dark themes.
 * Returns the newly active theme.
 */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light';
  setTheme(next);
  return next;
}

/**
 * Initialise the theme on page load.
 * Priority: localStorage → system preference → 'light'.
 * Call this once, e.g. in your root layout.
 */
export function initTheme(): Theme {
  if (typeof window === 'undefined') return 'light';

  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    // ignore
  }

  if (saved === 'light' || saved === 'dark') {
    setTheme(saved);
    return saved;
  }

  // Fall back to OS preference
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme: Theme = prefersDark ? 'dark' : 'light';
  setTheme(theme);
  return theme;
}
