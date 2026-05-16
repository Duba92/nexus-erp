import React, { useEffect } from 'react';
import { useThemeStore } from '../store/useThemeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme, accentColor } = useThemeStore();

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    // Theme logic
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    // Accent Color logic
    // Remove old accent classes
    const classes = Array.from(root.classList);
    classes.forEach(c => {
      if (c.startsWith('theme-')) root.classList.remove(c);
    });
    root.classList.add(`theme-${accentColor}`);

    // Persist compact mode
    const isCompact = localStorage.getItem('hullee-compact-mode') === 'true';
    if (isCompact) {
      root.classList.add('compact');
    } else {
      root.classList.remove('compact');
    }
  }, [theme, accentColor]);

  // Handle system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(mediaQuery.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
};
