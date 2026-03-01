import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export type AppLanguage = 'zh' | 'en';

const LANGUAGE_KEY = 'ft_app_language';

interface I18nStoreState {
    language: AppLanguage;
    isReady: boolean;
    setLanguage: (language: AppLanguage) => Promise<void>;
    loadLanguage: () => Promise<void>;
}

export const useI18nStore = create<I18nStoreState>((set) => ({
    language: 'zh',
    isReady: false,

    setLanguage: async (language) => {
        await SecureStore.setItemAsync(LANGUAGE_KEY, language);
        set({ language });
    },

    loadLanguage: async () => {
        try {
            const saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
            if (saved === 'zh' || saved === 'en') {
                set({ language: saved, isReady: true });
                return;
            }
        } catch {
            // ignore read failures
        }
        set({ isReady: true });
    },
}));
