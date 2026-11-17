'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type AdminTheme = 'light' | 'dark';
const storageKey = 'art-house-admin-theme';

const themeEvent = 'art-house-admin-theme-change';

function readTheme(): AdminTheme {
  return window.localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light';
}

function subscribeTheme(update: () => void) {
  window.addEventListener('storage', update);
  window.addEventListener(themeEvent, update);
  return () => {
    window.removeEventListener('storage', update);
    window.removeEventListener(themeEvent, update);
  };
}

export default function AdminThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, (): AdminTheme => 'light');

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
  }, [theme]);

  function toggleTheme() {
    window.localStorage.setItem(storageKey, theme === 'dark' ? 'light' : 'dark');
    window.dispatchEvent(new Event(themeEvent));
  }

  return (
    <button
      className="admin-theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} admin theme`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}
