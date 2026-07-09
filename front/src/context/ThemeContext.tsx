import { ConfigProvider, theme as antdTheme } from 'antd';
import esES from 'antd/locale/es_ES';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const STORAGE_KEY = 'jam-theme-mode';

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getInitialMode = (): ThemeMode => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'dark' ? 'dark' : 'light';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode);
  const isDark = mode === 'dark';

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    localStorage.setItem(STORAGE_KEY, nextMode);
  };

  const toggleMode = () => setMode(isDark ? 'light' : 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.body.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const themeConfig = useMemo(
    () => ({
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: isDark ? '#38BDF8' : '#1677ff',
        colorSuccess: '#22C55E',
        colorWarning: '#F59E0B',
        colorError: '#EF4444',
        colorInfo: isDark ? '#60A5FA' : '#1677ff',
        colorBgLayout: isDark ? '#0F172A' : '#f5f7fa',
        colorBgContainer: isDark ? '#1F2937' : '#ffffff',
        colorBgElevated: isDark ? '#1F2937' : '#ffffff',
        colorBorder: isDark ? '#334155' : '#d9d9d9',
        colorText: isDark ? '#F8FAFC' : '#111827',
        colorTextSecondary: isDark ? '#CBD5E1' : '#6b7280',
        colorTextDisabled: isDark ? '#64748B' : '#9ca3af',
      },
      components: {
        Layout: {
          bodyBg: isDark ? '#0F172A' : '#f5f7fa',
          siderBg: isDark ? '#111827' : '#ffffff',
          headerBg: isDark ? '#111827' : '#ffffff',
        },
        Table: {
          headerBg: isDark ? '#111827' : '#fafafa',
          headerColor: isDark ? '#F8FAFC' : '#111827',
          rowHoverBg: isDark ? '#263244' : '#fafafa',
          borderColor: isDark ? '#334155' : '#f0f0f0',
        },
        Modal: {
          contentBg: isDark ? '#1F2937' : '#ffffff',
          headerBg: isDark ? '#1F2937' : '#ffffff',
        },
      },
    }),
    [isDark],
  );

  useEffect(() => {
    ConfigProvider.config({
      holderRender: children => (
        <ConfigProvider locale={esES} theme={themeConfig}>
          {children}
        </ConfigProvider>
      ),
    });
  }, [themeConfig]);

  const value = useMemo(
    () => ({ mode, isDark, setMode, toggleMode }),
    [mode, isDark],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider
        locale={esES}
        theme={themeConfig}
      >
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeMode debe usarse dentro de ThemeProvider');
  }
  return context;
};
