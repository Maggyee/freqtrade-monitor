import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

type NotificationSnapshot = {
  openTradeIds: number[];
  historyTradeIds: number[];
  botState: 'running' | 'stopped' | null;
};

interface NotificationStoreState {
  isReady: boolean;
  permissionGranted: boolean;
  tradeAlerts: boolean;
  priceThresholdAlerts: boolean;
  systemAlerts: boolean;
  lastSnapshot: NotificationSnapshot;
  loadSettings: () => Promise<void>;
  setPermissionGranted: (granted: boolean) => Promise<void>;
  setTradeAlerts: (enabled: boolean) => Promise<void>;
  setPriceThresholdAlerts: (enabled: boolean) => Promise<void>;
  setSystemAlerts: (enabled: boolean) => Promise<void>;
  setLastSnapshot: (snapshot: NotificationSnapshot) => void;
}

const STORE_KEYS = {
  permission: 'ft_notify_permission',
  tradeAlerts: 'ft_notify_trade_alerts',
  priceThresholdAlerts: 'ft_notify_price_threshold_alerts',
  systemAlerts: 'ft_notify_system_alerts',
} as const;

const parseBool = (value: string | null, fallback = false) => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
};

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  isReady: false,
  permissionGranted: false,
  tradeAlerts: false,
  priceThresholdAlerts: false,
  systemAlerts: false,
  lastSnapshot: {
    openTradeIds: [],
    historyTradeIds: [],
    botState: null,
  },

  loadSettings: async () => {
    const [permission, tradeAlerts, priceThresholdAlerts, systemAlerts] = await Promise.all([
      SecureStore.getItemAsync(STORE_KEYS.permission),
      SecureStore.getItemAsync(STORE_KEYS.tradeAlerts),
      SecureStore.getItemAsync(STORE_KEYS.priceThresholdAlerts),
      SecureStore.getItemAsync(STORE_KEYS.systemAlerts),
    ]);

    set({
      permissionGranted: parseBool(permission),
      tradeAlerts: parseBool(tradeAlerts),
      priceThresholdAlerts: parseBool(priceThresholdAlerts),
      systemAlerts: parseBool(systemAlerts),
      isReady: true,
    });
  },

  setPermissionGranted: async (granted) => {
    await SecureStore.setItemAsync(STORE_KEYS.permission, String(granted));
    set({ permissionGranted: granted });
  },

  setTradeAlerts: async (enabled) => {
    await SecureStore.setItemAsync(STORE_KEYS.tradeAlerts, String(enabled));
    set({ tradeAlerts: enabled });
  },

  setPriceThresholdAlerts: async (enabled) => {
    await SecureStore.setItemAsync(STORE_KEYS.priceThresholdAlerts, String(enabled));
    set({ priceThresholdAlerts: enabled });
  },

  setSystemAlerts: async (enabled) => {
    await SecureStore.setItemAsync(STORE_KEYS.systemAlerts, String(enabled));
    set({ systemAlerts: enabled });
  },

  setLastSnapshot: (lastSnapshot) => set({ lastSnapshot }),
}));
