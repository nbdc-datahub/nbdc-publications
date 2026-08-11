'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} theme` : 'Toggle theme'}
      className="focus-ring rounded-md border border-border px-2 py-1 text-sm hover:bg-card"
    >
      {/* A stable glyph until mounted, so the server and client markup agree. */}
      <span aria-hidden>{mounted ? (isDark ? '☀' : '☾') : '◐'}</span>
    </button>
  );
}
