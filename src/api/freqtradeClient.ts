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
    timeframe: string | number;
    exchange: string;
    leverage: number;
    enter_tag?: string;
    exit_reason?: string;
    amount: number;               // 交易数量
    trade_duration?: number;      // 持仓时长（分钟）
    profit_ratio?: number;        // 利润比率（历史交易）
    sell_reason?: string;         // 旧版卖出原因
    open_timestamp?: number;
    close_timestamp?: number;
    open_fill_timestamp?: number;
    close_fill_timestamp?: number;
    orders?: Array<{
        ft_order_side?: string;
        order_timestamp?: number;
        order_filled_timestamp?: number;
        safe_price?: number;
        amount?: number;
    }>;
}

export async function fetchExchangeCandlesWindow(
    pair: string,
    timeframe: string,
    startTime: number,
    endTime: number,
    proxyBaseUrl?: string,
): Promise<CandleData[]> {
    const timeframeToMs = (value: string): number => {
        const count = Number(value.slice(0, -1));
        const unit = value.slice(-1);
        if (!Number.isFinite(count)) return 60 * 60 * 1000;
        if (unit === 'm') return count * 60 * 1000;
        if (unit === 'h') return count * 60 * 60 * 1000;
        if (unit === 'd') return count * 24 * 60 * 60 * 1000;
        if (unit === 'w') return count * 7 * 24 * 60 * 60 * 1000;
        return 60 * 60 * 1000;
    };

    const candleMs = timeframeToMs(timeframe);
    const span = Math.max(candleMs, endTime - startTime);
    const targetCount = Math.max(180, Math.ceil(span / candleMs) + 48);
    const allCandles: CandleData[] = [];
    let cursor = startTime;
    let remaining = targetCount;

    while (cursor <= endTime && remaining > 0) {
        const batchLimit = Math.min(1000, remaining);
        const batch = await fetchExchangeCandles(
            pair,
            timeframe,
            batchLimit,
            proxyBaseUrl,
            cursor,
            endTime,
        );
        if (!batch.length) break;

        allCandles.push(...batch);
        const lastOpen = batch[batch.length - 1]?.date;
        if (!lastOpen || lastOpen < cursor) break;

        cursor = lastOpen + candleMs;
        remaining -= batch.length;

        if (batch.length < batchLimit) {
            break;
        }
    }

    return Array.from(new Map(allCandles.map((item) => [item.date, item])).values())
        .sort((a, b) => a.date - b.date);
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
    stake_currency?: string;
    max_open_trades?: number;
    stoploss?: number;
    trailing_stop?: boolean;
    trailing_stop_positive?: number;
    dry_run?: boolean;
    minimal_roi?: Record<string, number>;
}

// 性能统计
export interface Performance {
    pair: string;
    profit: number;
    profit_pct: number;
    count: number;
}

export interface WhitelistResponse {
    whitelist: string[];
    length: number;
    method: string[];
}

// K 线（蜡烛图）数据 - 对应 api_schemas.py 的 PairHistory
export interface PairCandles {
    strategy: string;          // 当前策略名
    pair: string;              // 交易对
    timeframe: string;         // 时间周期（如 "5m"）
    timeframe_ms: number;      // 时间周期的毫秒数
    columns: string[];         // 列名数组（如 ["date", "open", "high", "low", "close", "volume"]）
    data: (number | string)[][]; // 二维数组，每行是一根蜡烛
    length: number;            // 数据长度
    last_analyzed: string;     // 最后分析时间
    last_analyzed_ts: number;  // 最后分析时间戳
    data_start_ts: number;     // 数据起始时间戳
    data_stop_ts: number;      // 数据结束时间戳
}

// 单根蜡烛的结构化数据（从 PairCandles.data 解析而来）
export interface CandleData {
    date: number;     // 时间戳（毫秒）
    open: number;     // 开盘价
    high: number;     // 最高价
    low: number;      // 最低价
    close: number;    // 收盘价
    volume: number;   // 成交量
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

    /** 获取当前白名单 - GET /api/v1/whitelist */
    async getWhitelist(): Promise<WhitelistResponse> {
        const { data } = await this.client.get('/api/v1/whitelist');
        return data;
    }

    /**
     * 获取 K 线（蜡烛图）数据 - GET /api/v1/pair_candles
     * 对接后端 api_trading.py 的 pair_candles 端点
     * @param pair 交易对，如 "BTC/USDT" 或 "BTC/USDT:USDT"
     * @param timeframe 时间周期，如 "5m", "15m", "1h", "4h", "1d"
     * @param limit 返回蜡烛数量限制
     */
    async getPairCandles(pair: string, timeframe: string, limit: number = 100): Promise<PairCandles> {
        const { data } = await this.client.get('/api/v1/pair_candles', {
            params: { pair, timeframe, limit },
        });
        return data;
    }

    /**
     * 获取历史 K 线数据 - GET /api/v1/pair_history
     * 通过 Freqtrade Bot 的交易所连接获取任意时间周期的数据
     * @param pair 交易对
     * @param timeframe 时间周期
     * @param strategy 策略名称
     */
    async getPairHistory(
        pair: string,
        timeframe: string,
        strategy: string,
    ): Promise<PairCandles> {
        // 计算最近 3 天的时间范围
        const now = new Date();
        const start = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const fmt = (d: Date) =>
            `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d.getDate().toString().padStart(2, '0')}`;
        const timerange = `${fmt(start)}-`;

        console.log(`📊 pair_history GET: pair=${pair}, tf=${timeframe}, strategy=${strategy}, range=${timerange}`);

        const { data } = await this.client.get('/api/v1/pair_history', {
            params: { pair, timeframe, strategy, timerange },
        });
        return data;
    }

    /**
     * 将 PairCandles 的原始 columns + data 格式解析为结构化的 CandleData 数组
     * Freqtrade API 返回的是列名数组 + 二维数据数组的格式（类似 pandas DataFrame）
     * 这个方法将其转换为每根蜡烛一个对象的格式，方便图表组件使用
     */
    parseCandleData(pairCandles: PairCandles): CandleData[] {
        const { columns, data: rawData } = pairCandles;

        // 找到每个关键列在 columns 数组中的索引
        // 注意：Freqtrade 的 _convert_dataframe_to_dict 会添加 __date_ts 列
        // __date_ts 是秒级时间戳（从 nanoseconds 转换），date 是 datetime 字符串
        const dateTsIdx = columns.indexOf('__date_ts');   // 优先使用秒级时间戳
        const dateIdx = columns.indexOf('date');           // 后备：datetime 字符串
        const openIdx = columns.indexOf('open');
        const highIdx = columns.indexOf('high');
        const lowIdx = columns.indexOf('low');
        const closeIdx = columns.indexOf('close');
        const volumeIdx = columns.indexOf('volume');

        // 如果找不到必要的列，返回空数组
        if ((dateTsIdx === -1 && dateIdx === -1) || openIdx === -1 || closeIdx === -1) {
            console.warn('⚠️ K 线数据列名缺失:', columns);
            return [];
        }

        return rawData.map(row => {
            // 解析时间戳：优先用 __date_ts（秒级），否则用 date 字符串解析
            let timestamp: number;
            if (dateTsIdx !== -1) {
                // Some backends return __date_ts in seconds, others already return milliseconds.
                const rawTimestamp = Number(row[dateTsIdx]);
                timestamp = rawTimestamp > 1e12 ? rawTimestamp : rawTimestamp * 1000;
            } else {
                // date 是 datetime 字符串，解析为毫秒时间戳
                timestamp = new Date(String(row[dateIdx])).getTime();
            }

            return {
                date: timestamp,
                open: Number(row[openIdx]),
                high: highIdx !== -1 ? Number(row[highIdx]) : Number(row[openIdx]),
                low: lowIdx !== -1 ? Number(row[lowIdx]) : Number(row[closeIdx]),
                close: Number(row[closeIdx]),
                volume: volumeIdx !== -1 ? Number(row[volumeIdx]) : 0,
            };
        });
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

    /** 手动开仓 - POST /api/v1/forceenter */
    async forceEntry(pair: string, side: 'long' | 'short', stakeAmount?: number): Promise<Trade> {
        const { data } = await this.client.post('/api/v1/forceenter', {
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

/**
 * 直接从交易所公开 API 获取 K 线数据（不需要 Freqtrade）
 * 目前支持 Binance 现货 + 合约市场
 * 
 * @param pair Freqtrade 格式的交易对，如 "SOL/USDT:USDT" 或 "BTC/USDT"
 * @param timeframe 时间周期，如 "1m", "5m", "15m", "1h", "4h", "1d"
 * @param limit 返回蜡烛数量（默认 100）
 * @returns CandleData 数组
 */
export async function fetchExchangeCandles(
    pair: string,
    timeframe: string,
    limit: number = 100,
    proxyBaseUrl?: string,
    startTime?: number,
    endTime?: number,
): Promise<CandleData[]> {
    // 解析 Freqtrade 格式的交易对
    // "SOL/USDT:USDT" → symbol="SOLUSDT", 使用合约 API
    // "BTC/USDT" → symbol="BTCUSDT", 使用现货 API
    const isFutures = pair.includes(':');
    const cleanPair = pair.split(':')[0];                    // 去掉 :USDT 部分
    const symbol = cleanPair.replace('/', '');               // "SOL/USDT" → "SOLUSDT"

    // 如果有代理地址走代理（解决国内无法直连），否则直连 Binance
    const path = isFutures ? '/fapi/v1/klines' : '/api/v3/klines';
    const base = proxyBaseUrl
        ? proxyBaseUrl.replace(/\/$/, '') + path
        : (isFutures ? 'https://fapi.binance.com' + path : 'https://api.binance.com' + path);
    const params = new URLSearchParams({
        symbol,
        interval: timeframe,
        limit: String(limit),
    });
    if (typeof startTime === 'number') {
        params.set('startTime', String(startTime));
    }
    if (typeof endTime === 'number') {
        params.set('endTime', String(endTime));
    }
    const url = `${base}?${params.toString()}`

    console.log(`📊 获取 K 线: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`交易所 API 错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Binance K 线返回格式：
    // [openTime, open, high, low, close, volume, closeTime, ...]
    // 每个元素是一个数组
    return data.map((kline: any[]) => ({
        date: Number(kline[0]),                    // 开盘时间（毫秒时间戳）
        open: parseFloat(kline[1]),                // 开盘价
        high: parseFloat(kline[2]),                // 最高价
        low: parseFloat(kline[3]),                 // 最低价
        close: parseFloat(kline[4]),               // 收盘价
        volume: parseFloat(kline[5]),              // 成交量
    }));
}
