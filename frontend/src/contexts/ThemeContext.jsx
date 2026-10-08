/**
 * 主题上下文 - 支持亮色/暗色模式切换
 */
import { useState, useEffect } from 'react';
import { ThemeContext } from './theme';

const themes = {
  light: {
    name: 'light',
    background: '#ffffff',
    surface: '#f9fafb',
    primary: '#6366f1',
    primaryGradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    text: '#1f2937',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
  },
  dark: {
    name: 'dark',
    background: '#111827',
    surface: '#1f2937',
    primary: '#818cf8',
    primaryGradient: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 100%)',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    border: '#374151',
    success: '#34d399',
    danger: '#f87171',
    warning: '#fbbf24',
  },
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // 优先读取本地存储
    const saved = localStorage.getItem('onetake-theme');
    if (saved) return saved;
    // 跟随系统设置
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    localStorage.setItem('onetake-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('onetake-theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const value = {
    theme,
    colors: themes[theme],
    toggleTheme,
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
