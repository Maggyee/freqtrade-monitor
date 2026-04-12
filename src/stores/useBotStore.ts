import * as SecureStore from 'expo-secure-store';
import axios from 'axios';
import { create } from 'zustand';

import {
  type AdminConfigStatus,
  getAdminConfigStatus,
  toggleAdminDryRun,
  type ToggleDryRunResponse,
} from '@/src/api/adminClient';
import FreqtradeClient, {
  type Balance,
  type BotServer,
  type BotState,
  type DailyProfit,
  type Profit,
  type Trade,
} from '@/src/api/freqtradeClient';
import { sendLocalNotification } from '@/src/services/notifications';
import { useNotificationStore } from '@/src/stores/useNotificationStore';

const SERVERS_KEY = 'ft_servers_configs';
const ACTIVE_SERVER_KEY = 'ft_active_server_id';
const LEGACY_SERVER_KEY = 'ft_server_config';

const toServerId = (url: string, username: string) =>
  `${url}_${username}`.replace(/[^a-zA-Z0-9]/g, '_');

const toServerName = (url: string, username: string, index: number) => {
  try {
    const host = new URL(url).hostname;
    return `${host} (${username})`;
  } catch {
    return `Server ${index + 1}`;
  }
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === 'string' && data.trim()) return data;
    if (data && typeof data === 'object') {
      if ('message' in data && data.message) return String(data.message);
      if ('error' in data && data.error) return String(data.error);
      if ('detail' in data && data.detail) return String(data.detail);
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const shouldSendNotification = (type: 'trade' | 'system') => {
  const { permissionGranted, tradeAlerts, systemAlerts } = useNotificationStore.getState();
  if (!permissionGranted) return false;
  return type === 'trade' ? tradeAlerts : systemAlerts;
};

const notifyTrade = async (title: string, body: string, data?: Record<string, string | number>) => {
  if (!shouldSendNotification('trade')) return;
  await sendLocalNotification(title, body, data);
};

const notifySystem = async (title: string, body: string, data?: Record<string, string | number>) => {
  if (!shouldSendNotification('system')) return;
  await sendLocalNotification(title, body, data);
};

const buildNotificationSnapshot = (openTrades: Trade[], tradeHistory: Trade[], botState: BotState | null) => ({
  openTradeIds: openTrades.map((trade) => trade.trade_id),
  historyTradeIds: tradeHistory.map((trade) => trade.trade_id),
  botState: botState?.state ?? null,
});

const maybeNotifyStateDiff = async (
  previous: ReturnType<typeof buildNotificationSnapshot>,
  nextOpenTrades: Trade[],
  nextHistory: Trade[],
  nextBotState: BotState | null,
) => {
  const next = buildNotificationSnapshot(nextOpenTrades, nextHistory, nextBotState);
  const notificationStore = useNotificationStore.getState();
  const isFirstSnapshot =
    previous.openTradeIds.length === 0 &&
    previous.historyTradeIds.length === 0 &&
    previous.botState == null;

  notificationStore.setLastSnapshot(next);

  if (isFirstSnapshot) return;

  const previousOpen = new Set(previous.openTradeIds);
  const previousHistory = new Set(previous.historyTradeIds);

  const newOpenTrade = nextOpenTrades.find((trade) => !previousOpen.has(trade.trade_id));
  if (newOpenTrade) {
    await notifyTrade(
      'Trade Opened',
      `${newOpenTrade.pair} ${newOpenTrade.is_short ? 'SHORT' : 'LONG'} is now active.`,
      { tradeId: newOpenTrade.trade_id, pair: newOpenTrade.pair },
    );
  }

  const newClosedTrade = nextHistory.find((trade) => !previousHistory.has(trade.trade_id));
  if (newClosedTrade) {
    const pnl = typeof newClosedTrade.profit_abs === 'number' ? newClosedTrade.profit_abs.toFixed(4) : '-';
    await notifyTrade(
      'Trade Closed',
      `${newClosedTrade.pair} finished with ${pnl}.`,
      { tradeId: newClosedTrade.trade_id, pair: newClosedTrade.pair },
    );
  }

  if (previous.botState !== next.botState && next.botState) {
    if (next.botState === 'running') {
      await notifySystem('Bot Started', 'Freqtrade bot is now running.');
    } else if (next.botState === 'stopped') {
      await notifySystem('Bot Stopped', 'Freqtrade bot is stopped.');
    }
  }
};

interface BotStoreState {
  server: BotServer | null;
  servers: BotServer[];
  activeServerId: string | null;
  client: FreqtradeClient | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  adminConfig: AdminConfigStatus | null;
  botState: BotState | null;
  balance: Balance | null;
  openTrades: Trade[];
  profit: Profit | null;
  dailyProfit: DailyProfit | null;
  tradeHistory: Trade[];
  whitelist: string[];
  serverUrl: string;
  setServer: (server: BotServer) => void;
  connect: (url: string, username: string, password: string) => Promise<boolean>;
  switchServer: (serverId: string) => Promise<boolean>;
  removeServer: (serverId: string) => Promise<void>;
  restoreSession: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshTrades: () => Promise<void>;
  refreshProfit: () => Promise<void>;
  refreshBotState: () => Promise<void>;
  forceExit: (tradeId: number) => Promise<boolean>;
  forceEntry: (pair: string, side: 'long' | 'short', stakeAmount?: number) => Promise<boolean>;
  startBot: () => Promise<boolean>;
  stopBot: () => Promise<boolean>;
  toggleDryRun: (nextValue: boolean) => Promise<{ success: boolean; message?: string }>;
  saveServer: (server: BotServer, password: string) => Promise<void>;
  loadSavedServer: () => Promise<BotServer | null>;
  loadServers: () => Promise<BotServer[]>;
}

export const useBotStore = create<BotStoreState>((set, get) => ({
  server: null,
  servers: [],
  activeServerId: null,
  client: null,
  isConnected: false,
  isLoading: false,
  error: null,
  adminConfig: null,
  botState: null,
  balance: null,
  openTrades: [],
  profit: null,
  dailyProfit: null,
  tradeHistory: [],
  whitelist: [],
  get serverUrl() {
    return get().server?.url ?? '';
  },

  setServer: (server) => {
    const client = new FreqtradeClient(server);
    set({ server, client, error: null });
  },

  connect: async (url, username, password) => {
    const { servers } = get();
    const normalizedUrl = url.trim().replace(/\/$/, '');
    const normalizedUsername = username.trim();
    const serverId = toServerId(normalizedUrl, normalizedUsername);
    const existing = servers.find((item) => item.id === serverId);
    const server: BotServer = {
      id: serverId,
      name: existing?.name ?? toServerName(normalizedUrl, normalizedUsername, servers.length),
      url: normalizedUrl,
      username: normalizedUsername,
    };

    const client = new FreqtradeClient(server);
    set({ isLoading: true, error: null });

    try {
      const success = await client.login(normalizedUsername, password);
      if (!success) {
        set({ error: 'Invalid username or password.', isLoading: false });
        return false;
      }

      await get().saveServer(server, password);
      set({
        server,
        client,
        activeServerId: server.id,
        isConnected: true,
        isLoading: false,
        error: null,
      });
      await get().refreshAll();
      await notifySystem('Bot Connected', `${server.name} is connected.`);
      return true;
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to connect to the bot.');
      set({ error: message, isLoading: false });
      await notifySystem('Connection Failed', message);
      return false;
    }
  },

  restoreSession: async () => {
    set({ isLoading: true });

    const servers = await get().loadServers();
    if (!servers.length) {
      set({ isLoading: false, isConnected: false, servers: [] });
      return false;
    }

    const persistedActiveId = await SecureStore.getItemAsync(ACTIVE_SERVER_KEY);
    const activeId = persistedActiveId ?? servers[0].id;
    const primary = servers.find((item) => item.id === activeId) ?? servers[0];
    const fallbacks = servers.filter((item) => item.id !== primary.id);

    for (const server of [primary, ...fallbacks]) {
      const client = new FreqtradeClient(server);
      try {
        let authenticated = await client.restoreSession();
        if (!authenticated) {
          const savedPassword = await SecureStore.getItemAsync(`ft_pwd_${server.id}`);
          if (savedPassword) {
            authenticated = await client.login(server.username, savedPassword);
          }
        }
        if (!authenticated) continue;

        await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, server.id);
        set({
          servers,
          activeServerId: server.id,
          server,
          client,
          isConnected: true,
          isLoading: false,
          error: null,
        });
        await get().refreshAll();
        return true;
      } catch {
        // Try next server.
      }
    }

    set({
      servers,
      activeServerId: primary.id,
      server: primary,
      client: new FreqtradeClient(primary),
      isConnected: false,
      isLoading: false,
    });
    return false;
  },

  switchServer: async (serverId) => {
    const { servers } = get();
    const target = servers.find((item) => item.id === serverId);
    if (!target) {
      set({ error: 'Server configuration not found.' });
      return false;
    }

    const client = new FreqtradeClient(target);
    set({
      activeServerId: target.id,
      server: target,
      client,
      isLoading: true,
      error: null,
    });
    await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, target.id);

    try {
      let authenticated = await client.restoreSession();
      if (!authenticated) {
        const savedPassword = await SecureStore.getItemAsync(`ft_pwd_${target.id}`);
        if (savedPassword) {
          authenticated = await client.login(target.username, savedPassword);
        }
      }

      if (authenticated) {
        set({
          isConnected: true,
          isLoading: false,
          error: null,
        });
        await get().refreshAll();
        await notifySystem('Server Switched', `${target.name} is now active.`);
        return true;
      }
    } catch {
      // Fall through to disconnected state.
    }

    set({
      isConnected: false,
      isLoading: false,
      botState: null,
      balance: null,
      openTrades: [],
      profit: null,
      dailyProfit: null,
      tradeHistory: [],
      whitelist: [],
      error: 'Session expired for this server. Please reconnect.',
    });
    return false;
  },

  removeServer: async (serverId) => {
    const { servers, activeServerId, client } = get();
    const nextServers = servers.filter((item) => item.id !== serverId);

    await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(nextServers));
    await SecureStore.deleteItemAsync(`ft_pwd_${serverId}`);
    await SecureStore.deleteItemAsync(`ft_access_${serverId}`);
    await SecureStore.deleteItemAsync(`ft_refresh_${serverId}`);

    if (activeServerId === serverId && client) {
      try {
        await client.logout();
      } catch {
        // Ignore logout errors when deleting a server.
      }
    }

    if (!nextServers.length) {
      await SecureStore.deleteItemAsync(ACTIVE_SERVER_KEY);
      await SecureStore.deleteItemAsync(LEGACY_SERVER_KEY);
      set({
        servers: [],
        activeServerId: null,
        server: null,
        client: null,
        isConnected: false,
        botState: null,
        balance: null,
        openTrades: [],
        profit: null,
        dailyProfit: null,
        tradeHistory: [],
        whitelist: [],
        error: null,
      });
      return;
    }

    const nextActiveId = activeServerId === serverId ? nextServers[0].id : activeServerId;
    set({ servers: nextServers, activeServerId: nextActiveId ?? nextServers[0].id });

    if (activeServerId === serverId) {
      await get().switchServer(nextServers[0].id);
    }
  },

  disconnect: async () => {
    const { client } = get();
    if (client) {
      try {
        await client.logout();
      } catch {
        // Ignore logout errors.
      }
    }

    set({
      isConnected: false,
      botState: null,
      balance: null,
      openTrades: [],
      profit: null,
      dailyProfit: null,
      tradeHistory: [],
      whitelist: [],
      error: null,
    });
  },

  refreshAll: async () => {
    const { client, isConnected } = get();
    if (!client || !isConnected) return;

    set({ isLoading: true, error: null });
    const previousSnapshot = useNotificationStore.getState().lastSnapshot;

    try {
      const [botState, balance, openTrades, profit, dailyProfit, tradeHistoryRes, whitelist, adminStatus] =
        await Promise.allSettled([
          client.getBotState(),
          client.getBalance(),
          client.getOpenTrades(),
          client.getProfit(),
          client.getDaily(7),
          client.getTradeHistory(50),
          client.getWhitelist(),
          get().server ? getAdminConfigStatus(get().server!.url) : Promise.resolve(null),
        ]);

      const nextAdminConfig = adminStatus.status === 'fulfilled' ? adminStatus.value : null;
      const nextBotState =
        botState.status === 'fulfilled'
          ? nextAdminConfig
            ? { ...botState.value, dry_run: nextAdminConfig.dry_run }
            : botState.value
          : null;
      const nextBalance = balance.status === 'fulfilled' ? balance.value : null;
      const nextOpenTrades = openTrades.status === 'fulfilled' ? openTrades.value : [];
      const nextProfit = profit.status === 'fulfilled' ? profit.value : null;
      const nextDailyProfit = dailyProfit.status === 'fulfilled' ? dailyProfit.value : null;
      const nextTradeHistory = tradeHistoryRes.status === 'fulfilled' ? tradeHistoryRes.value.trades : [];
      const nextWhitelist = whitelist.status === 'fulfilled' ? whitelist.value.whitelist : [];

      set({
        botState: nextBotState,
        balance: nextBalance,
        openTrades: nextOpenTrades,
        profit: nextProfit,
        dailyProfit: nextDailyProfit,
        tradeHistory: nextTradeHistory,
        whitelist: nextWhitelist,
        adminConfig: nextAdminConfig,
        isLoading: false,
      });

      await maybeNotifyStateDiff(previousSnapshot, nextOpenTrades, nextTradeHistory, nextBotState);
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to refresh bot data.');
      set({ error: message, isLoading: false });
    }
  },

  refreshTrades: async () => {
    const { client, isConnected } = get();
    if (!client || !isConnected) return;

    try {
      const [openTrades, tradeHistoryRes] = await Promise.all([
        client.getOpenTrades(),
        client.getTradeHistory(50),
      ]);
      set({
        openTrades,
        tradeHistory: tradeHistoryRes.trades,
      });
      useNotificationStore
        .getState()
        .setLastSnapshot(buildNotificationSnapshot(openTrades, tradeHistoryRes.trades, get().botState));
    } catch (error) {
      console.warn('Failed to refresh trades:', getErrorMessage(error, 'Unknown error'));
    }
  },

  refreshProfit: async () => {
    const { client, isConnected } = get();
    if (!client || !isConnected) return;

    try {
      const [profit, dailyProfit] = await Promise.all([client.getProfit(), client.getDaily(7)]);
      set({ profit, dailyProfit });
    } catch (error) {
      console.warn('Failed to refresh profit:', getErrorMessage(error, 'Unknown error'));
    }
  },

  refreshBotState: async () => {
    const { client, isConnected } = get();
    if (!client || !isConnected) return;

    try {
      const [botState, adminStatus] = await Promise.all([
        client.getBotState(),
        get().server ? getAdminConfigStatus(get().server!.url) : Promise.resolve(null),
      ]);

      set({
        botState: adminStatus ? { ...botState, dry_run: adminStatus.dry_run } : botState,
        adminConfig: adminStatus,
        error: null,
      });
    } catch (error) {
      set({ error: getErrorMessage(error, 'Failed to refresh bot state.') });
    }
  },

  forceExit: async (tradeId) => {
    const { client, isConnected } = get();
    if (!client || !isConnected) return false;

    try {
      await client.forceExit(tradeId);
      set({ error: null });
      await get().refreshAll();
      const closedTrade = get().tradeHistory.find((trade) => trade.trade_id === tradeId);
      if (closedTrade) {
        await notifyTrade('Trade Closed', `${closedTrade.pair} was closed manually.`, {
          tradeId,
          pair: closedTrade.pair,
        });
      }
      return true;
    } catch (error) {
      set({ error: `Close failed: ${getErrorMessage(error, 'Unknown error')}` });
      return false;
    }
  },

  forceEntry: async (pair, side, stakeAmount) => {
    const { client, isConnected } = get();
    if (!client || !isConnected) return false;

    try {
      await client.forceEntry(pair, side, stakeAmount);
      set({ error: null });
      await get().refreshAll();
      await notifyTrade('Trade Submitted', `${pair} ${side.toUpperCase()} order was submitted.`, {
        pair,
        side,
      });
      return true;
    } catch (error) {
      set({ error: getErrorMessage(error, 'Entry failed.') });
      return false;
    }
  },

  startBot: async () => {
    const { client, isConnected } = get();
    if (!client || !isConnected) return false;

    try {
      await client.startBot();
      await get().refreshBotState();
      await notifySystem('Bot Started', 'Freqtrade bot is now running.');
      return true;
    } catch (error) {
      set({ error: `Start failed: ${getErrorMessage(error, 'Unknown error')}` });
      return false;
    }
  },

  stopBot: async () => {
    const { client, isConnected } = get();
    if (!client || !isConnected) return false;

    try {
      await client.stopBot();
      await get().refreshBotState();
      await notifySystem('Bot Stopped', 'Freqtrade bot was stopped.');
      return true;
    } catch (error) {
      set({ error: `Stop failed: ${getErrorMessage(error, 'Unknown error')}` });
      return false;
    }
  },

  toggleDryRun: async (nextValue) => {
    const { server, isConnected, adminConfig } = get();
    if (!server || !isConnected) {
      return { success: false, message: 'Connect to the bot first.' };
    }
    if (nextValue === false && adminConfig && !adminConfig.live_ready) {
      return {
        success: false,
        message: `Live mode is blocked: ${adminConfig.live_blockers.join(', ')}`,
      };
    }

    try {
      const response: ToggleDryRunResponse = await toggleAdminDryRun(server.url, nextValue);
      await get().refreshAll();
      const currentBotState = get().botState;
      if (currentBotState) {
        set({ botState: { ...currentBotState, dry_run: response.dry_run } });
      }
      await notifySystem(
        response.dry_run ? 'Dry-run Enabled' : 'Live Mode Enabled',
        response.message,
      );
      return { success: true, message: response.message };
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to update dry-run mode.');
      set({ error: message });
      return { success: false, message };
    }
  },

  saveServer: async (server, password) => {
    const existing = await get().loadServers();
    const nextServers = [server, ...existing.filter((item) => item.id !== server.id)];
    await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(nextServers));
    await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, server.id);
    await SecureStore.setItemAsync(`ft_pwd_${server.id}`, password);
    await SecureStore.deleteItemAsync(LEGACY_SERVER_KEY);
    set({ servers: nextServers, activeServerId: server.id });
  },

  loadSavedServer: async () => {
    const servers = await get().loadServers();
    if (!servers.length) return null;
    const activeId = await SecureStore.getItemAsync(ACTIVE_SERVER_KEY);
    return servers.find((item) => item.id === activeId) ?? servers[0];
  },

  loadServers: async () => {
    try {
      const json = await SecureStore.getItemAsync(SERVERS_KEY);
      if (json) {
        const parsed = JSON.parse(json) as BotServer[];
        if (Array.isArray(parsed)) return parsed;
      }

      const legacyJson = await SecureStore.getItemAsync(LEGACY_SERVER_KEY);
      if (legacyJson) {
        const legacyServer = JSON.parse(legacyJson) as BotServer;
        const migrated = [legacyServer];
        await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(migrated));
        await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, legacyServer.id);
        await SecureStore.deleteItemAsync(LEGACY_SERVER_KEY);
        return migrated;
      }
    } catch {
      // Ignore corrupted local state.
    }
    return [];
  },
}));
