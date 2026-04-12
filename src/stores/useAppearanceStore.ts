import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

import type { FontScale, ThemeMode } from '@/constants/Colors';

const THEME_KEY = 'ft_app_theme_preference';
const FONT_SCALE_KEY = 'ft_app_font_scale';

interface AppearanceStoreState {
  themeMode: ThemeMode;
  fontScale: FontScale;
  isReady: boolean;
  loadSettings: () => Promise<void>;
  setThemeMode: (themeMode: ThemeMode) => Promise<void>;
  setFontScale: (fontScale: FontScale) => Promise<void>;
}

export const useAppearanceStore = create<AppearanceStoreState>((set) => ({
  themeMode: 'dark',
  fontScale: 'normal',
  isReady: false,

  loadSettings: async () => {
    try {
      const [savedTheme, savedFontScale] = await Promise.all([
        SecureStore.getItemAsync(THEME_KEY),
        SecureStore.getItemAsync(FONT_SCALE_KEY),
      ]);

      set({
        themeMode: savedTheme === 'light' ? 'light' : 'dark',
        fontScale:
          savedFontScale === 'small' || savedFontScale === 'large' || savedFontScale === 'normal'
            ? savedFontScale
            : 'normal',
        isReady: true,
      });
    } catch {
      set({ isReady: true });
    }
  },

  setThemeMode: async (themeMode) => {
    await SecureStore.setItemAsync(THEME_KEY, themeMode);
    set({ themeMode });
  },

  setFontScale: async (fontScale) => {
    await SecureStore.setItemAsync(FONT_SCALE_KEY, fontScale);
    set({ fontScale });
  },
}));
