import React, { useEffect, useState } from 'react';

const ThemeToggle = () => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-2xl glass-panel hover:bg-brand-bg text-brand-text transition-all duration-300 shadow-sm hover:shadow-md hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center border border-brand-border focus:outline-none focus:ring-2 focus:ring-brand-blue/40"
      aria-label="Toggle theme"
      type="button"
    >
      {theme === 'dark' ? (
        <span className="text-xl leading-none select-none drop-shadow-sm">☀️</span>
      ) : (
        <span className="text-xl leading-none select-none drop-shadow-sm">🌙</span>
      )}
    </button>
  );
};

export default ThemeToggle;
