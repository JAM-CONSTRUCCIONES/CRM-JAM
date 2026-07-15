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
        borderRadius: 8,
        borderRadiusLG: 10,
        borderRadiusSM: 6,
        controlHeight: 36,
        controlHeightLG: 42,
        fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
        boxShadowSecondary: isDark
          ? '0 14px 36px rgba(0, 0, 0, 0.35)'
          : '0 14px 36px rgba(15, 23, 42, 0.12)',
      },
      components: {
        Button: {
          borderRadius: 8,
          controlHeight: 36,
          fontWeight: 600,
        },
        Card: {
          borderRadiusLG: 8,
          paddingLG: 18,
        },
        Drawer: {
          footerPaddingBlock: 12,
          footerPaddingInline: 20,
        },
        Form: {
          itemMarginBottom: 14,
          labelFontSize: 13,
          labelColor: isDark ? '#CBD5E1' : '#374151',
        },
        Input: {
          borderRadius: 8,
          activeShadow: isDark ? '0 0 0 3px rgba(56, 189, 248, 0.15)' : '0 0 0 3px rgba(22, 119, 255, 0.12)',
        },
        Layout: {
          bodyBg: isDark ? '#0F172A' : '#f5f7fa',
          siderBg: isDark ? '#111827' : '#ffffff',
          headerBg: isDark ? '#111827' : '#ffffff',
        },
        Select: {
          borderRadius: 8,
          optionSelectedFontWeight: 600,
        },
        Table: {
          headerBg: isDark ? '#172033' : '#f8fafc',
          headerColor: isDark ? '#F8FAFC' : '#111827',
          rowHoverBg: isDark ? '#263244' : '#f7fbff',
          borderColor: isDark ? '#334155' : '#e5eaf2',
          headerSplitColor: isDark ? '#334155' : '#dfe6f0',
          cellPaddingBlock: 10,
          cellPaddingInline: 14,
          cellFontSize: 13,
          headerBorderRadius: 8,
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
