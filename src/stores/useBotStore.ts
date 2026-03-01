// Bot 状态管理 - 使用 Zustand 管理全局状态
// 包含 Bot 连接管理、交易数据、利润数据等

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import FreqtradeClient, {
    type BotServer,
    type Trade,
    type Profit,
    type Balance,
    type BotState,
    type DailyProfit,
} from '../api/freqtradeClient';

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
        return `服务器 ${index + 1}`;
    }
};

// === 状态类型定义 ===

interface BotStoreState {
    // --- 连接相关 ---
    server: BotServer | null;          // 当前 Bot 服务器配置
    servers: BotServer[];              // 所有已保存服务器
    activeServerId: string | null;     // 当前激活服务器 ID
    client: FreqtradeClient | null;    // API 客户端实例
    isConnected: boolean;              // 是否已连接（已登录）
    isLoading: boolean;                // 是否正在加载数据
    error: string | null;              // 错误信息

    // --- 业务数据 ---
    botState: BotState | null;         // Bot 运行状态
    balance: Balance | null;           // 账户余额
    openTrades: Trade[];               // 活跃交易列表
    profit: Profit | null;             // 利润摘要
    dailyProfit: DailyProfit | null;   // 每日利润
    tradeHistory: Trade[];             // 历史交易

    // --- 操作方法 ---
    // 连接管理
    serverUrl: string;                 // 当前服务器地址（只读）
    setServer: (server: BotServer) => void;
    connect: (url: string, username: string, password: string) => Promise<boolean>;
    switchServer: (serverId: string) => Promise<boolean>;
    removeServer: (serverId: string) => Promise<void>;
    restoreSession: () => Promise<boolean>;
    disconnect: () => Promise<void>;

    // 数据获取
    refreshAll: () => Promise<void>;   // 刷新全部数据
    refreshTrades: () => Promise<void>; // 只刷新交易
    refreshProfit: () => Promise<void>; // 只刷新利润

    // 交易操作
    forceExit: (tradeId: number) => Promise<boolean>;
    startBot: () => Promise<boolean>;
    stopBot: () => Promise<boolean>;

    // 服务器配置持久化
    saveServer: (server: BotServer, password: string) => Promise<void>;
    loadSavedServer: () => Promise<BotServer | null>;
    loadServers: () => Promise<BotServer[]>;
}

// === 创建 Store ===

export const useBotStore = create<BotStoreState>((set, get) => ({
    // --- 初始状态 ---
    server: null,
    servers: [],
    activeServerId: null,
    client: null,
    isConnected: false,
    isLoading: false,
    error: null,
    botState: null,
    balance: null,
    openTrades: [],
    profit: null,
    dailyProfit: null,
    tradeHistory: [],
    // 服务器地址（派生属性）
    get serverUrl() {
        return get().server?.url ?? '';
    },

    // === 连接管理 ===

    /** 设置 Bot 服务器配置 */
    setServer: (server: BotServer) => {
        const client = new FreqtradeClient(server);
        set({ server, client, error: null });
    },

    /** 连接到 Bot（登录认证）- 支持直接传入 URL */
    connect: async (url: string, username: string, password: string) => {
        const { servers } = get();
        const normalizedUrl = url.trim().replace(/\/$/, '');
        const normalizedUsername = username.trim();
        const serverId = toServerId(normalizedUrl, normalizedUsername);
        const existing = servers.find((s) => s.id === serverId);
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
            if (success) {
                // 保存服务器配置用于恢复会话
                await get().saveServer(server, password);
                set({
                    server,
                    client,
                    activeServerId: server.id,
                    isConnected: true,
                    isLoading: false,
                    error: null,
                });
                // 登录成功后立即获取所有数据
                await get().refreshAll();
                return true;
            } else {
                set({ error: '用户名或密码错误', isLoading: false });
                return false;
            }
        } catch (error: any) {
            const msg = error?.response?.status === 401
                ? '用户名或密码错误'
                : error?.message?.includes('Network')
                    ? '无法连接到服务器，请检查地址和网络'
                    : `连接失败: ${error?.message || '未知错误'}`;
            set({ error: msg, isLoading: false });
            return false;
        }
    },

    /** 恢复之前的登录状态（App 启动时调用） */
    restoreSession: async () => {
        set({ isLoading: true });

        const servers = await get().loadServers();
        if (!servers.length) {
            set({ isLoading: false, isConnected: false, servers: [] });
            return false;
        }

        const persistedActiveId = await SecureStore.getItemAsync(ACTIVE_SERVER_KEY);
        const activeId = persistedActiveId ?? servers[0].id;
        const primary = servers.find((s) => s.id === activeId) ?? servers[0];
        const fallbacks = servers.filter((s) => s.id !== primary.id);

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
                // 尝试下一个配置
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

    /** 切换服务器配置 */
    switchServer: async (serverId: string) => {
        const { servers } = get();
        const target = servers.find((s) => s.id === serverId);
        if (!target) {
            set({ error: '未找到该服务器配置' });
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
                return true;
            }
        } catch {
            // 会话恢复失败，回退为未连接
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
            error: '该服务器会话已失效，请重新连接',
        });
        return false;
    },

    /** 删除服务器配置 */
    removeServer: async (serverId: string) => {
        const { servers, activeServerId, client } = get();
        const nextServers = servers.filter((s) => s.id !== serverId);

        await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(nextServers));
        await SecureStore.deleteItemAsync(`ft_pwd_${serverId}`);
        await SecureStore.deleteItemAsync(`ft_access_${serverId}`);
        await SecureStore.deleteItemAsync(`ft_refresh_${serverId}`);

        if (activeServerId === serverId && client) {
            try {
                await client.logout();
            } catch {
                // 忽略登出异常
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

    /** 断开连接（登出） */
    disconnect: async () => {
        const { client } = get();
        if (client) {
            await client.logout();
        }
        set({
            isConnected: false,
            botState: null,
            balance: null,
            openTrades: [],
            profit: null,
            dailyProfit: null,
            tradeHistory: [],
            error: null,
        });
    },

    // === 数据获取 ===

    /** 刷新所有数据 */
    refreshAll: async () => {
        const { client, isConnected } = get();
        if (!client || !isConnected) return;

        set({ isLoading: true, error: null });

        try {
            // 并行请求所有数据，提高加载速度
            const [botState, balance, openTrades, profit, dailyProfit, tradeHistoryRes] = await Promise.allSettled([
                client.getBotState(),
                client.getBalance(),
                client.getOpenTrades(),
                client.getProfit(),
                client.getDaily(7),
                client.getTradeHistory(50),
            ]);

            set({
                botState: botState.status === 'fulfilled' ? botState.value : null,
                balance: balance.status === 'fulfilled' ? balance.value : null,
                openTrades: openTrades.status === 'fulfilled' ? openTrades.value : [],
                profit: profit.status === 'fulfilled' ? profit.value : null,
                dailyProfit: dailyProfit.status === 'fulfilled' ? dailyProfit.value : null,
                tradeHistory: tradeHistoryRes.status === 'fulfilled' ? tradeHistoryRes.value.trades : [],
                isLoading: false,
            });
        } catch (error: any) {
            set({ error: `数据加载失败: ${error?.message}`, isLoading: false });
        }
    },

    /** 只刷新交易列表 */
    refreshTrades: async () => {
        const { client, isConnected } = get();
        if (!client || !isConnected) return;

        try {
            const openTrades = await client.getOpenTrades();
            set({ openTrades });
        } catch (error: any) {
            console.warn('刷新交易失败:', error?.message);
        }
    },

    /** 只刷新利润数据 */
    refreshProfit: async () => {
        const { client, isConnected } = get();
        if (!client || !isConnected) return;

        try {
            const [profit, dailyProfit] = await Promise.all([
                client.getProfit(),
                client.getDaily(7),
            ]);
            set({ profit, dailyProfit });
        } catch (error: any) {
            console.warn('刷新利润失败:', error?.message);
        }
    },

    // === 交易操作 ===

    /** 强制平仓 */
    forceExit: async (tradeId: number) => {
        const { client, isConnected } = get();
        if (!client || !isConnected) return false;

        try {
            await client.forceExit(tradeId);
            // 平仓成功后刷新交易列表和利润
            await Promise.all([
                get().refreshTrades(),
                get().refreshProfit(),
            ]);
            return true;
        } catch (error: any) {
            set({ error: `平仓失败: ${error?.message}` });
            return false;
        }
    },

    /** 启动 Bot */
    startBot: async () => {
        const { client, isConnected } = get();
        if (!client || !isConnected) return false;

        try {
            await client.startBot();
            const botState = await client.getBotState();
            set({ botState });
            return true;
        } catch (error: any) {
            set({ error: `启动失败: ${error?.message}` });
            return false;
        }
    },

    /** 停止 Bot */
    stopBot: async () => {
        const { client, isConnected } = get();
        if (!client || !isConnected) return false;

        try {
            await client.stopBot();
            const botState = await client.getBotState();
            set({ botState });
            return true;
        } catch (error: any) {
            set({ error: `停止失败: ${error?.message}` });
            return false;
        }
    },

    // === 配置持久化 ===

    /** 保存服务器配置到安全存储 */
    saveServer: async (server: BotServer, password: string) => {
        const existing = await get().loadServers();
        const nextServers = [
            server,
            ...existing.filter((s) => s.id !== server.id),
        ];
        await SecureStore.setItemAsync(SERVERS_KEY, JSON.stringify(nextServers));
        await SecureStore.setItemAsync(ACTIVE_SERVER_KEY, server.id);
        await SecureStore.setItemAsync(`ft_pwd_${server.id}`, password);
        await SecureStore.deleteItemAsync(LEGACY_SERVER_KEY);
        set({ servers: nextServers, activeServerId: server.id });
    },

    /** 加载保存的服务器配置 */
    loadSavedServer: async () => {
        const servers = await get().loadServers();
        if (!servers.length) return null;

        const activeId = await SecureStore.getItemAsync(ACTIVE_SERVER_KEY);
        return servers.find((s) => s.id === activeId) ?? servers[0];
    },

    /** 加载全部服务器配置 */
    loadServers: async () => {
        try {
            const json = await SecureStore.getItemAsync(SERVERS_KEY);
            if (json) {
                const parsed = JSON.parse(json) as BotServer[];
                if (Array.isArray(parsed)) {
                    return parsed;
                }
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
            // 解析失败，忽略
        }
        return [];
    },
}));
