export type ThemeMode = 'dark' | 'light';
export type FontScale = 'small' | 'normal' | 'large';

const darkPalette = {
  background: '#070B14',
  surface: '#0D1320',
  surfaceLight: '#141C2E',
  surfaceHighlight: '#1A2540',
  surfaceBorder: '#1E2A3E',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#506580',
  primary: '#57A5FF',
  primaryLight: '#7BBBFF',
  primaryDark: '#3D8CE0',
  primaryBg: 'rgba(87, 165, 255, 0.12)',
  profit: '#00D68F',
  profitLight: '#34E8A5',
  profitBg: 'rgba(0, 214, 143, 0.12)',
  loss: '#FF3D71',
  lossLight: '#FF6B8A',
  lossBg: 'rgba(255, 61, 113, 0.12)',
  riskAllow: '#00D68F',
  riskReduce: '#FFAA00',
  riskBlock: '#FF3D71',
  warning: '#FFAA00',
  info: '#00CFFD',
  success: '#00D68F',
  tabBar: '#070B14',
  tabIconDefault: '#506580',
  tabIconSelected: '#57A5FF',
  overlay: 'rgba(0, 0, 0, 0.7)',
  gradientStart: 'rgba(87, 165, 255, 0.15)',
  gradientEnd: 'rgba(87, 165, 255, 0.02)',
} as const;

const lightPalette = {
  background: '#F4F7FB',
  surface: '#FFFFFF',
  surfaceLight: '#EEF3F9',
  surfaceHighlight: '#E3ECF7',
  surfaceBorder: '#D6E0EC',
  text: '#102033',
  textSecondary: '#4B6078',
  textMuted: '#7A8EA5',
  primary: '#2D7FF9',
  primaryLight: '#5A9BFF',
  primaryDark: '#1F67CF',
  primaryBg: 'rgba(45, 127, 249, 0.12)',
  profit: '#0E9F6E',
  profitLight: '#22C58B',
  profitBg: 'rgba(14, 159, 110, 0.12)',
  loss: '#E5484D',
  lossLight: '#F26A6D',
  lossBg: 'rgba(229, 72, 77, 0.12)',
  riskAllow: '#0E9F6E',
  riskReduce: '#F59E0B',
  riskBlock: '#E5484D',
  warning: '#F59E0B',
  info: '#0EA5E9',
  success: '#0E9F6E',
  tabBar: '#FFFFFF',
  tabIconDefault: '#7A8EA5',
  tabIconSelected: '#2D7FF9',
  overlay: 'rgba(15, 23, 42, 0.32)',
  gradientStart: 'rgba(45, 127, 249, 0.14)',
  gradientEnd: 'rgba(45, 127, 249, 0.03)',
} as const;

export const Colors = {
  dark: darkPalette,
  light: lightPalette,
} as const;

export type AppColors = {
  [K in keyof typeof darkPalette]: string;
};

export const getThemeColors = (mode: ThemeMode = 'dark'): AppColors =>
  mode === 'light' ? Colors.light : Colors.dark;

const baseFontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 22,
  hero: 32,
  mega: 40,
} as const;

const fontScaleMultiplier: Record<FontScale, number> = {
  small: 0.92,
  normal: 1,
  large: 1.12,
};

export const FontSize = baseFontSize;

export const getScaledFontSize = (
  size: keyof typeof baseFontSize | number,
  scale: FontScale = 'normal',
) => {
  const raw = typeof size === 'number' ? size : baseFontSize[size];
  return Math.round(raw * fontScaleMultiplier[scale]);
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 999,
} as const;
