export type ThemeMode = 'dark' | 'amoled';
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

const amoledPalette = {
  ...darkPalette,
  background: '#000000',
  surface: '#050505',
  surfaceLight: '#0B0B0B',
  surfaceHighlight: '#111827',
  surfaceBorder: '#141414',
  text: '#F8FAFC',
  textSecondary: '#A8B3C2',
  textMuted: '#64748B',
  tabBar: '#020202',
  overlay: 'rgba(0, 0, 0, 0.82)',
  gradientStart: 'rgba(87, 165, 255, 0.12)',
  gradientEnd: 'rgba(87, 165, 255, 0.01)',
} as const;

export const Colors = {
  dark: darkPalette,
  amoled: amoledPalette,
} as const;

export type AppColors = {
  [K in keyof typeof darkPalette]: string;
};

export const getThemeColors = (mode: ThemeMode = 'dark'): AppColors =>
  mode === 'amoled' ? Colors.amoled : Colors.dark;

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
