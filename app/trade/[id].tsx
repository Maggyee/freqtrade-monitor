// 交易详情页面 - 基于 Stitch 设计稿
// 顶部：返回按钮 + 交易对名称 + LONG/SHORT 标签
// 中部：Trade PNL 卡片 + Trade Metrics 网格
// 底部：Order Timeline 时间线 + Share/History 按钮

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Share,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';
import { toDisplayProfitPercent } from '../../src/utils/profit';
import { useI18nStore } from '@/src/stores/useI18nStore';
import CandleChart from '@/src/components/CandleChart';
import { CandleData, fetchExchangeCandles } from '@/src/api/freqtradeClient';

export default function TradeDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const language = useI18nStore((s) => s.language);
    const t = (zh: string, en: string) => (language === 'en' ? en : zh);
    const { openTrades, forceExit, botState } = useBotStore();
    const [isClosingTrade, setIsClosingTrade] = useState(false);
    const [isSharingTrade, setIsSharingTrade] = useState(false);

    // 找到对应的交易（需在 useEffect 之前声明）
    const tradeId = Number(id);
    const trade = openTrades.find(t => t.trade_id === tradeId);

    // === K 线图表数据状态 ===
    const [candleData, setCandleData] = useState<CandleData[]>([]);
    const [candleLoading, setCandleLoading] = useState(false);
    const [candleError, setCandleError] = useState<string | undefined>(undefined);

    // 从 botState 获取策略的真实 timeframe
    const strategyTf = botState?.timeframe || trade?.timeframe || '1h';
    const [selectedTimeframe, setSelectedTimeframe] = useState(strategyTf);

    // 可选时间周期列表
    const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];

    // Binance API 代理地址（部署在云服务器上的 nginx 容器）
    // 注意：Freqtrade 可能通过局域网/VPN 连接，代理需要用公网 IP
    const BINANCE_PROXY_URL = 'http://35.221.168.5:8081';

    // 切换时间周期时重新加载
    useEffect(() => {
        if (!trade) return;
        loadCandles(selectedTimeframe);
    }, [trade?.pair, selectedTimeframe]);

    // 加载 K 线数据
    // 策略时间周期 → pair_candles（Bot 内存数据，快速）
    // 其他时间周期 → 通过云服务器代理获取 Binance K 线
    const loadCandles = async (tf: string) => {
        if (!trade) return;
        setCandleLoading(true);
        setCandleError(undefined);
        try {
            const store = useBotStore.getState();
            if (!store.client) {
                setCandleError(t('请先连接 Bot', 'Connect bot first'));
                return;
            }

            let parsed: CandleData[];

            if (tf === strategyTf) {
                // === 策略时间周期：从 Bot 内存获取（快速，含指标） ===
                const result = await store.client.getPairCandles(trade.pair, tf, 300);
                if (!result.columns || result.columns.length === 0) {
                    setCandleError(t('K 线数据暂不可用', 'Candles unavailable'));
                    return;
                }
                parsed = store.client.parseCandleData(result);
            } else {
                // === 其他时间周期：通过云服务器代理获取 Binance 数据 ===
                console.log(`📊 通过代理获取 ${tf} K 线: ${BINANCE_PROXY_URL}`);
                parsed = await fetchExchangeCandles(trade.pair, tf, 300, BINANCE_PROXY_URL);
            }

            if (parsed.length === 0) {
                setCandleError(t('K 线数据为空', 'No candle data'));
                return;
            }
            setCandleData(parsed.length > 300 ? parsed.slice(-300) : parsed);
        } catch (err: any) {
            console.error('❌ 获取 K 线数据失败:', err);
            setCandleError(err?.message || t('无法加载 K 线数据', 'Failed to load candles'));
        } finally {
            setCandleLoading(false);
        }
    };


    // 平仓操作
    const handleForceExit = () => {
        if (!trade) return;
        if (isClosingTrade) return;

        Alert.alert(
            t('确认平仓', 'Confirm Close'),
            language === 'en' ? `Close ${trade.pair}?` : `确定要平仓 ${trade.pair} 吗？`,
            [
                { text: t('取消', 'Cancel'), style: 'cancel' },
                {
                    text: t('确认平仓', 'Confirm'),
                    style: 'destructive',
                    onPress: async () => {
                        setIsClosingTrade(true);
                        try {
                            const success = await forceExit(tradeId);
                            if (success) {
                                Alert.alert(t('✅ 平仓成功', '✅ Closed'), '', [
                                    { text: t('确定', 'OK'), onPress: () => router.back() }
                                ]);
                            }
                        } finally {
                            setIsClosingTrade(false);
                        }
                    },
                },
            ]
        );
    };

    const handleShareTrade = async () => {
        if (!trade || isSharingTrade) return;

        setIsSharingTrade(true);
        try {
            const direction = trade.is_short ? t('做空', 'Short') : t('做多', 'Long');
            const pnlSign = trade.profit_pct >= 0 ? '+' : '';
            const displayPct = toDisplayProfitPercent(trade.profit_pct, trade.profit_ratio);
            await Share.share({
                message: [
                    t('Freqtrade 交易快照', 'Freqtrade Trade Snapshot'),
                    `${trade.pair.replace(':', '/')}`,
                    `${direction} ${trade.leverage}x`,
                    `${t('盈亏', 'P&L')} ${pnlSign}${displayPct.toFixed(2)}%`,
                    `${t('收益', 'Profit')} ${pnlSign}${trade.profit_abs.toFixed(4)}`,
                ].join(' | '),
            });
        } catch {
            Alert.alert(t('分享失败', 'Share Failed'), t('暂时无法分享这笔交易，请稍后重试。', 'Unable to share this trade now. Please try again later.'));
        } finally {
            setIsSharingTrade(false);
        }
    };

    // 交易未找到
    if (!trade) {
        return (
            <View style={styles.container}>
                <Stack.Screen options={{
                    title: t('交易详情', 'Trade Detail'),
                    headerStyle: { backgroundColor: Colors.dark.background },
                    headerTintColor: Colors.dark.text,
                }} />
                <View style={styles.emptyCenter}>
                    <Ionicons name="alert-circle-outline" size={48} color={Colors.dark.textMuted} />
                    <Text style={styles.emptyText}>{t('交易未找到（可能已平仓）', 'Trade not found (possibly closed)')}</Text>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => router.back()}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.backBtnText}>{t('返回', 'Back')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const isProfit = trade.profit_pct >= 0;
    const profitColor = isProfit ? Colors.dark.profit : Colors.dark.loss;
    const profitPct = toDisplayProfitPercent(trade.profit_pct, trade.profit_ratio).toFixed(2);

    // 计算持仓时间
    const openDate = new Date(trade.open_date);
    const now = new Date();
    const durationMs = now.getTime() - openDate.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const durationStr = hours > 24
        ? language === 'en'
            ? `${Math.floor(hours / 24)}d ${hours % 24}h`
            : `${Math.floor(hours / 24)}天 ${hours % 24}小时`
        : language === 'en'
            ? `${hours}h ${minutes}m`
            : `${hours}小时 ${minutes}分钟`;

    // 格式化时间
    const formatTime = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    return (
        <View style={styles.container}>
            {/* 自定义 Header */}
            <Stack.Screen options={{
                title: '',
                headerStyle: { backgroundColor: Colors.dark.background },
                headerTintColor: Colors.dark.text,
                headerShadowVisible: false,
            }} />

            <ScrollView contentContainerStyle={styles.content}>
                {/* === 交易对标题 === */}
                <View style={styles.titleRow}>
                    <Text style={styles.pairTitle}>{trade.pair.replace(':', '/')}</Text>
                    <View style={[
                        styles.directionBadge,
                        { backgroundColor: trade.is_short ? Colors.dark.lossBg : Colors.dark.profitBg }
                    ]}>
                        <Text style={[
                            styles.directionText,
                            { color: trade.is_short ? Colors.dark.loss : Colors.dark.profit }
                        ]}>
                            {trade.is_short ? t('做空', 'Short') : t('做多', 'Long')}
                        </Text>
                    </View>
                    {trade.leverage > 1 && (
                        <View style={[styles.directionBadge, { backgroundColor: Colors.dark.primaryBg }]}>
                            <Text style={[styles.directionText, { color: Colors.dark.primary }]}>
                                {trade.leverage}x
                            </Text>
                        </View>
                    )}
                </View>

                {/* === 当前价格 === */}
                <View style={styles.priceSection}>
                    <Text style={styles.currentPriceLabel}>{t('当前价格', 'Current Price')}</Text>
                    <Text style={styles.currentPrice}>${trade.current_rate.toFixed(2)}</Text>
                    <View style={styles.priceChange}>
                        <Ionicons
                            name={isProfit ? 'caret-up' : 'caret-down'}
                            size={12}
                            color={profitColor}
                        />
                        <Text style={[styles.priceChangeText, { color: profitColor }]}>
                            {isProfit ? '+' : ''}{profitPct}% {t('今日', 'today')}
                        </Text>
                    </View>
                </View>

                {/* === K 线蜡烛图 === */}
                {/* 时间周期选择器 */}
                <View style={styles.timeframeRow}>
                    {timeframes.map(tf => (
                        <TouchableOpacity
                            key={tf}
                            style={[
                                styles.timeframeBtn,
                                selectedTimeframe === tf && styles.timeframeBtnActive,
                            ]}
                            onPress={() => setSelectedTimeframe(tf)}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.timeframeBtnText,
                                selectedTimeframe === tf && styles.timeframeBtnTextActive,
                            ]}>
                                {tf}{tf === strategyTf ? ' ★' : ''}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* 蜡烛图组件 */}
                <CandleChart
                    candles={candleData}
                    height={220}
                    openRate={trade.open_rate}
                    isLoading={candleLoading}
                    errorMessage={candleError}
                    timeframe={selectedTimeframe}
                />

                {/* === Trade PNL 卡片 === */}
                <View style={[styles.pnlCard, { borderColor: profitColor }]}>
                    <Text style={styles.pnlLabel}>{t('本笔盈亏', 'Trade P&L')}</Text>
                    <View style={styles.pnlValues}>
                        <Text style={[styles.pnlAbs, { color: profitColor }]}>
                            {isProfit ? '+' : ''}{trade.profit_abs.toFixed(4)}
                        </Text>
                        <View style={[styles.pnlPctBadge, { backgroundColor: isProfit ? Colors.dark.profitBg : Colors.dark.lossBg }]}>
                            <Text style={[styles.pnlPctText, { color: profitColor }]}>
                                {isProfit ? '+' : ''}{profitPct}%
                            </Text>
                        </View>
                    </View>
                </View>

                {/* === Trade Metrics 网格 === */}
                <Text style={styles.metricsTitle}>{t('交易指标', 'Trade Metrics')}</Text>
                <View style={styles.metricsGrid}>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>{t('开仓价', 'Entry Price')}</Text>
                        <Text style={styles.metricValue}>${trade.open_rate.toFixed(4)}</Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>{t('当前价', 'Current Price')}</Text>
                        <Text style={styles.metricValue}>${trade.current_rate.toFixed(4)}</Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>{t('杠杆', 'Leverage')}</Text>
                        <Text style={styles.metricValue}>{trade.leverage}x</Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>{t('仓位', 'Stake')}</Text>
                        <Text style={styles.metricValue}>{trade.stake_amount.toFixed(2)}</Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>{t('止损价', 'Stoploss')}</Text>
                        <Text style={[styles.metricValue, { color: Colors.dark.loss }]}> 
                            ${trade.stop_loss_abs.toFixed(4)}
                        </Text>
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>{t('持仓时长', 'Duration')}</Text>
                        <Text style={styles.metricValue}>{durationStr}</Text>
                    </View>
                </View>

                {/* === Order Timeline === */}
                <Text style={styles.metricsTitle}>{t('订单时间线', 'Order Timeline')}</Text>
                <View style={styles.timeline}>
                    {/* 入场 */}
                    <View style={styles.timelineItem}>
                        <View style={styles.timelineDotWrap}>
                            <View style={[styles.timelineDot, { backgroundColor: Colors.dark.profit }]} />
                            <View style={styles.timelineLine} />
                        </View>
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineTitle}>{t('买入入场', 'Entry Order')}</Text>
                            <Text style={styles.timelineDesc}>
                                {trade.amount.toFixed(4)} @ ${trade.open_rate.toFixed(2)}
                            </Text>
                            <Text style={styles.timelineTime}>{formatTime(trade.open_date)}</Text>
                        </View>
                    </View>

                    {/* 止损更新 */}
                    <View style={styles.timelineItem}>
                        <View style={styles.timelineDotWrap}>
                            <View style={[styles.timelineDot, { backgroundColor: Colors.dark.warning }]} />
                            <View style={styles.timelineLine} />
                        </View>
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineTitle}>{t('止损设置', 'Stoploss Set')}</Text>
                            <Text style={styles.timelineDesc}>
                                {t('止损价', 'Stoploss')}: ${trade.stop_loss_abs.toFixed(2)}
                            </Text>
                            <Text style={styles.timelineTime}>{formatTime(trade.open_date)}</Text>
                        </View>
                    </View>

                    {/* 当前状态 */}
                    <View style={styles.timelineItem}>
                        <View style={styles.timelineDotWrap}>
                            <View style={[styles.timelineDot, { backgroundColor: Colors.dark.primary }]} />
                        </View>
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineTitle}>{t('🔵 持仓活跃', '🔵 Position Active')}</Text>
                            <Text style={styles.timelineDesc}>
                                {t('已持仓', 'Open for')} {durationStr}
                            </Text>
                            <Text style={styles.timelineTime}>{t('现在', 'Now')}</Text>
                        </View>
                    </View>
                </View>

                {/* === 底部按钮 === */}
                <View style={styles.bottomActions}>
                    <TouchableOpacity
                        style={[styles.shareBtn, isSharingTrade && styles.shareBtnDisabled]}
                        onPress={handleShareTrade}
                        disabled={isSharingTrade || isClosingTrade}
                        activeOpacity={0.7}
                    >
                        {isSharingTrade ? (
                            <ActivityIndicator size="small" color={Colors.dark.textSecondary} />
                        ) : (
                            <Ionicons name="share-outline" size={18} color={Colors.dark.textSecondary} />
                        )}
                        <Text style={styles.shareBtnText}>{isSharingTrade ? t('分享中...', 'Sharing...') : t('分享', 'Share')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.closeTrade, isClosingTrade && styles.closeTradeDisabled]}
                        onPress={handleForceExit}
                        disabled={isClosingTrade || isSharingTrade}
                        activeOpacity={0.8}
                    >
                        {isClosingTrade ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Ionicons name="close-circle-outline" size={18} color="#FFF" />
                        )}
                        <Text style={styles.closeTradeText}>{isClosingTrade ? t('平仓中...', 'Closing...') : t('平仓', 'Close Trade')}</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    content: {
        padding: Spacing.lg,
    },

    // === 标题 ===
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    pairTitle: {
        color: Colors.dark.text,
        fontSize: FontSize.xxl,
        fontWeight: '800',
    },
    directionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BorderRadius.sm,
    },
    directionText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    // === 当前价格 ===
    priceSection: {
        marginBottom: Spacing.lg,
    },
    currentPriceLabel: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: Spacing.xs,
    },
    currentPrice: {
        color: Colors.dark.text,
        fontSize: FontSize.hero,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },
    priceChange: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: Spacing.xs,
    },
    priceChangeText: {
        fontSize: FontSize.sm,
        fontWeight: '600',
    },

    // === 时间周期选择器 ===
    timeframeRow: {
        flexDirection: 'row',
        gap: Spacing.xs,
        marginBottom: Spacing.md,
    },
    timeframeBtn: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: BorderRadius.full,
        backgroundColor: Colors.dark.surface,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    timeframeBtnActive: {
        backgroundColor: Colors.dark.primaryBg,
        borderColor: Colors.dark.primary,
    },
    timeframeBtnText: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
    timeframeBtnTextActive: {
        color: Colors.dark.primary,
    },

    // === PNL 卡片 ===
    pnlCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.xl,
        borderWidth: 1,
    },
    pnlLabel: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: Spacing.sm,
    },
    pnlValues: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    pnlAbs: {
        fontSize: FontSize.xxl,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },
    pnlPctBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    pnlPctText: {
        fontSize: FontSize.sm,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },

    // === Metrics 网格 ===
    metricsTitle: {
        color: Colors.dark.text,
        fontSize: FontSize.lg,
        fontWeight: '700',
        marginBottom: Spacing.md,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    metricItem: {
        width: '48%',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    metricLabel: {
        color: Colors.dark.textMuted,
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 4,
    },
    metricValue: {
        color: Colors.dark.text,
        fontSize: FontSize.md,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },

    // === Timeline ===
    timeline: {
        marginBottom: Spacing.xxl,
    },
    timelineItem: {
        flexDirection: 'row',
        gap: Spacing.md,
        minHeight: 60,
    },
    timelineDotWrap: {
        alignItems: 'center',
        width: 20,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 2,
    },
    timelineLine: {
        width: 1,
        flex: 1,
        backgroundColor: Colors.dark.surfaceBorder,
        marginTop: 4,
    },
    timelineContent: {
        flex: 1,
        paddingBottom: Spacing.lg,
    },
    timelineTitle: {
        color: Colors.dark.text,
        fontSize: FontSize.md,
        fontWeight: '600',
        marginBottom: 2,
    },
    timelineDesc: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
    },
    timelineTime: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
        marginTop: 4,
    },

    // === 底部按钮 ===
    bottomActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    shareBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        gap: Spacing.sm,
    },
    shareBtnText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    shareBtnDisabled: {
        opacity: 0.6,
    },
    closeTrade: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.dark.primary,
        gap: Spacing.sm,
    },
    closeTradeDisabled: {
        opacity: 0.6,
    },
    closeTradeText: {
        color: '#FFF',
        fontSize: FontSize.md,
        fontWeight: '700',
    },

    // === 空状态 ===
    emptyCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.md,
    },
    emptyText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.md,
    },
    backBtn: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: Spacing.xxl,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
    },
    backBtnText: {
        color: '#FFF',
        fontSize: FontSize.md,
        fontWeight: '600',
    },
});
