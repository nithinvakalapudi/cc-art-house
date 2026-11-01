'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

type AdminTheme = 'light' | 'dark';
const storageKey = 'art-house-admin-theme';

export default function AdminThemeToggle() {
  const [theme, setTheme] = useState<AdminTheme>('light');

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    const next: AdminTheme = saved === 'dark' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.dataset.adminTheme = next;
  }, []);

  function toggleTheme() {
    const next: AdminTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.adminTheme = next;
    window.localStorage.setItem(storageKey, next);
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
