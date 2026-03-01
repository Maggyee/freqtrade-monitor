// Freqtrade REST API 客户端
// 封装所有与 Freqtrade 后端 API 的通信
// 支持 JWT 认证、Token 自动刷新、SSH 隧道和 HTTPS 两种连接方式

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

// === 类型定义 ===

// Bot 服务器连接配置
export interface BotServer {
    id: string;              // 唯一标识
    name: string;            // 显示名称（如 "主力 Bot"）
    url: string;             // 服务器地址（如 "https://example.com" 或 "http://localhost:8080"）
    username: string;        // 登录用户名
}

// 认证响应 - 对应 api_auth.py 的 AccessAndRefreshToken
export interface AuthTokens {
    access_token: string;
    refresh_token: string;
}

// 账户余额
export interface Balance {
    currencies: Array<{
        currency: string;
        free: number;
        balance: number;
        used: number;
        est_stake: number;
        stake: string;
    }>;
    total: number;
    total_bot: number;
    symbol: string;
    value: number;
    stake: string;
    note: string;
}

// 活跃交易信息
export interface Trade {
    trade_id: number;
    pair: string;
    base_currency: string;
    quote_currency: string;
    is_open: boolean;
    is_short: boolean;
    open_date: string;
    open_rate: number;
    close_date?: string;
    close_rate?: number;
    current_rate: number;
    profit_pct: number;
    profit_abs: number;
    stake_amount: number;
    stop_loss_abs: number;
    stop_loss_pct: number;
    stoploss_current_dist: number;
    stoploss_current_dist_pct: number;
    initial_stop_loss_abs: number;
    min_rate: number;
    max_rate: number;
    open_order_id?: string;
    strategy: string;
    timeframe: string;
    exchange: string;
    leverage: number;
    enter_tag?: string;
    exit_reason?: string;
    amount: number;               // 交易数量
    trade_duration?: number;      // 持仓时长（秒）
    profit_ratio?: number;        // 利润比率（历史交易）
    sell_reason?: string;         // 旧版卖出原因
}

// 利润摘要
export interface Profit {
    profit_closed_coin: number;
    profit_closed_percent: number;
    profit_closed_fiat: number;
    profit_all_coin: number;
    profit_all_percent: number;
    profit_all_fiat: number;
    trade_count: number;
    closed_trade_count: number;
    first_trade_date: string;
    latest_trade_date: string;
    avg_duration: string;
    best_pair: string;
    best_rate: number;
    winning_trades: number;
    losing_trades: number;
    profit_factor: number;
}

// 每日利润
export interface DailyProfit {
    data: Array<{
        date: string;
        abs_profit: number;
        rel_profit: number;
        starting_balance: number;
        fiat_value: number;
        trade_count: number;
    }>;
}

// Bot 状态
export interface BotState {
    state: 'running' | 'stopped';
    strategy: string;
    timeframe: string;
    exchange: string;
    trading_mode: string;
    runmode: string;
    bot_name: string;
}

// 性能统计
export interface Performance {
    pair: string;
    profit: number;
    profit_pct: number;
    count: number;
}

// === API 客户端类 ===

class FreqtradeClient {
    private client: AxiosInstance;       // axios 实例
    private accessToken: string | null = null;   // 当前有效的 access token
    private refreshToken: string | null = null;  // 用于刷新的 refresh token
    private serverId: string;            // 对应的服务器 ID（用于安全存储的 key）

    constructor(server: BotServer) {
        this.serverId = server.id;

        // 创建 axios 实例
        this.client = axios.create({
            baseURL: server.url,
            timeout: 15000,   // 15秒超时（考虑网络延迟）
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // === 请求拦截器：自动附加 JWT Token ===
        this.client.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                if (this.accessToken && config.headers) {
                    config.headers.Authorization = `Bearer ${this.accessToken}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );

        // === 响应拦截器：处理 401 错误并自动刷新 Token ===
        this.client.interceptors.response.use(
            (response) => response,
            async (error: AxiosError) => {
                const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

                // 如果是 401（Token 过期）且不是重试请求
                if (error.response?.status === 401 && !originalRequest._retry) {
                    originalRequest._retry = true;

                    try {
                        const newToken = await this._refreshAccessToken();
                        if (newToken && originalRequest.headers) {
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            return this.client(originalRequest);
                        }
                    } catch (refreshError) {
                        // 刷新也失败 → 需要重新登录
                        this.accessToken = null;
                        this.refreshToken = null;
                        await SecureStore.deleteItemAsync(`ft_access_${this.serverId}`);
                        await SecureStore.deleteItemAsync(`ft_refresh_${this.serverId}`);
                        throw refreshError;
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    // =====================
    //     认证相关方法
    // =====================

    /**
     * 登录到 Freqtrade API
     * 对接后端 POST /api/v1/token/login （api_auth.py）
     * 使用 HTTP Basic Auth 发送用户名密码
     */
    async login(username: string, password: string): Promise<boolean> {
        try {
            const { data } = await this.client.post<AuthTokens>(
                '/api/v1/token/login',
                null,
                { auth: { username, password } }  // HTTP Basic Auth
            );

            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;

            // 使用 expo-secure-store 安全存储 Token
            // iOS 存在 Keychain，Android 存在 EncryptedSharedPreferences
            await SecureStore.setItemAsync(`ft_access_${this.serverId}`, this.accessToken);
            await SecureStore.setItemAsync(`ft_refresh_${this.serverId}`, this.refreshToken);

            return true;
        } catch (error) {
            console.error('❌ 登录失败:', error);
            return false;
        }
    }

    /**
     * 刷新 Access Token
     * 对接后端 POST /api/v1/token/refresh （api_auth.py）
     * Access Token 过期时间 15 分钟，Refresh Token 30 天
     */
    private async _refreshAccessToken(): Promise<string | null> {
        if (!this.refreshToken) return null;

        try {
            const { data } = await this.client.post<{ access_token: string }>(
                '/api/v1/token/refresh',
                null,
                { headers: { Authorization: `Bearer ${this.refreshToken}` } }
            );

            this.accessToken = data.access_token;
            await SecureStore.setItemAsync(`ft_access_${this.serverId}`, this.accessToken);
            return this.accessToken;
        } catch {
            return null;
        }
    }

    /**
     * App 启动时恢复登录状态
     * 从安全存储读取之前保存的 Token 并验证有效性
     */
    async restoreSession(): Promise<boolean> {
        try {
            const access = await SecureStore.getItemAsync(`ft_access_${this.serverId}`);
            const refresh = await SecureStore.getItemAsync(`ft_refresh_${this.serverId}`);

            if (!access || !refresh) return false;

            this.accessToken = access;
            this.refreshToken = refresh;

            // 尝试调用一个轻量 API 验证 Token 是否有效
            await this.client.get('/api/v1/version');
            return true;
        } catch {
            // Token 无效，清除存储
            this.accessToken = null;
            this.refreshToken = null;
            return false;
        }
    }

    /**
     * 登出 - 清除本地存储的 Token
     */
    async logout(): Promise<void> {
        this.accessToken = null;
        this.refreshToken = null;
        await SecureStore.deleteItemAsync(`ft_access_${this.serverId}`);
        await SecureStore.deleteItemAsync(`ft_refresh_${this.serverId}`);
    }

    /** 当前是否已登录 */
    get isLoggedIn(): boolean {
        return !!this.accessToken;
    }

    // =====================
    //     业务 API 方法
    // =====================

    /** 获取账户余额 - GET /api/v1/balance */
    async getBalance(): Promise<Balance> {
        const { data } = await this.client.get('/api/v1/balance');
        return data;
    }

    /** 获取活跃交易列表 - GET /api/v1/status */
    async getOpenTrades(): Promise<Trade[]> {
        const { data } = await this.client.get('/api/v1/status');
        return data;
    }

    /** 获取指定交易详情 - GET /api/v1/trade/{id} */
    async getTrade(tradeId: number): Promise<Trade> {
        const { data } = await this.client.get(`/api/v1/trade/${tradeId}`);
        return data;
    }

    /** 获取历史交易 - GET /api/v1/trades */
    async getTradeHistory(limit: number = 50, offset: number = 0): Promise<{ trades: Trade[]; total_trades: number }> {
        const { data } = await this.client.get('/api/v1/trades', {
            params: { limit, offset },
        });
        return data;
    }

    /** 获取利润摘要 - GET /api/v1/profit */
    async getProfit(): Promise<Profit> {
        const { data } = await this.client.get('/api/v1/profit');
        return data;
    }

    /** 获取每日利润 - GET /api/v1/daily */
    async getDaily(days: number = 7): Promise<DailyProfit> {
        const { data } = await this.client.get('/api/v1/daily', {
            params: { timescale: days },
        });
        return data;
    }

    /** 获取 Bot 状态/配置 - GET /api/v1/show_config */
    async getBotState(): Promise<BotState> {
        const { data } = await this.client.get('/api/v1/show_config');
        return data;
    }

    /** 获取性能排行 - GET /api/v1/performance */
    async getPerformance(): Promise<Performance[]> {
        const { data } = await this.client.get('/api/v1/performance');
        return data;
    }

    /** 获取开放交易数量 - GET /api/v1/count */
    async getTradeCount(): Promise<{ current: number; max: number; total_stake: number }> {
        const { data } = await this.client.get('/api/v1/count');
        return data;
    }

    // =====================
    //     交易操作方法
    // =====================

    /** 强制平仓 - POST /api/v1/forceexit */
    async forceExit(tradeId: number, orderType?: string): Promise<{ result: string }> {
        const { data } = await this.client.post('/api/v1/forceexit', {
            tradeid: String(tradeId),
            ordertype: orderType,
        });
        return data;
    }

    /** 手动开仓 - POST /api/v1/forceentry */
    async forceEntry(pair: string, side: 'long' | 'short', stakeAmount?: number): Promise<Trade> {
        const { data } = await this.client.post('/api/v1/forceentry', {
            pair,
            side,
            stakeamount: stakeAmount,
        });
        return data;
    }

    // =====================
    //     Bot 控制方法
    // =====================

    /** 启动 Bot - POST /api/v1/start */
    async startBot(): Promise<{ status: string }> {
        const { data } = await this.client.post('/api/v1/start');
        return data;
    }

    /** 停止 Bot - POST /api/v1/stop */
    async stopBot(): Promise<{ status: string }> {
        const { data } = await this.client.post('/api/v1/stop');
        return data;
    }

    /** 重载配置 - POST /api/v1/reload_config */
    async reloadConfig(): Promise<{ status: string }> {
        const { data } = await this.client.post('/api/v1/reload_config');
        return data;
    }

    /** 获取 Bot 版本 - GET /api/v1/version */
    async getVersion(): Promise<{ version: string }> {
        const { data } = await this.client.get('/api/v1/version');
        return data;
    }

    // =====================
    //     WebSocket URL
    // =====================

    /**
     * 获取 WebSocket 连接地址
     * 将 HTTPS 转为 WSS，HTTP 转为 WS
     */
    getWebSocketUrl(): string {
        const baseUrl = this.client.defaults.baseURL || '';
        const wsUrl = baseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
        return `${wsUrl}/api/v1/message/ws?token=${this.accessToken}`;
    }
}

export default FreqtradeClient;
