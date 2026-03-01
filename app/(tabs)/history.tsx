// 交易历史页面 - 基于 Stitch 设计稿
// 展示已完成的历史交易记录，按时间倒序排列
// 每条记录包含交易对、方向、盈亏、开仓/平仓时间

import React, { useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';

export default function HistoryScreen() {
    const language = useI18nStore((s) => s.language);
    const t = (zh: string, en: string) => (language === 'en' ? en : zh);
    const {
        isConnected,
        isLoading,
        tradeHistory,
        refreshAll,
    } = useBotStore();

    // 下拉刷新
    const onRefresh = useCallback(async () => {
        await refreshAll();
    }, [refreshAll]);

    // 未连接状态
    if (!isConnected) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyCenter}>
                    <View style={styles.emptyIconWrap}>
                        <Ionicons name="time" size={36} color={Colors.dark.primary} />
                    </View>
                    <Text style={styles.emptyText}>{t('请先连接 Bot', 'Connect bot first')}</Text>
                </View>
            </View>
        );
    }

    // 格式化持仓时间
    const formatDuration = (durationMinutes: number) => {
        if (!durationMinutes) return '-';
        const totalMinutes = Math.max(0, Math.floor(durationMinutes));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return language === 'en' ? `${days}d ${hours % 24}h` : `${days}天 ${hours % 24}小时`;
        }
        return hours > 0
            ? language === 'en' ? `${hours}h ${minutes}m` : `${hours}小时 ${minutes}分钟`
            : language === 'en' ? `${minutes}m` : `${minutes}分钟`;
    };

    // 格式化日期
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hour = date.getHours().toString().padStart(2, '0');
        const min = date.getMinutes().toString().padStart(2, '0');
        return `${month}-${day} ${hour}:${min}`;
    };

    // 统计数据
    const totalTrades = tradeHistory.length;
    const winTrades = tradeHistory.filter((t: any) => (t.profit_abs ?? 0) >= 0).length;
    const loseTrades = totalTrades - winTrades;
    const winRate = totalTrades > 0 ? ((winTrades / totalTrades) * 100).toFixed(1) : '0.0';
    const totalPnl = tradeHistory.reduce((sum: number, t: any) => sum + (t.profit_abs ?? 0), 0);

    // 渲染单条历史记录
    const renderItem = ({ item }: { item: any }) => {
        const isProfit = (item.profit_abs ?? 0) >= 0;
        const profitColor = isProfit ? Colors.dark.profit : Colors.dark.loss;
        const profitPct = ((item.profit_ratio ?? item.profit_pct ?? 0) * 100).toFixed(2);

        return (
            <View style={styles.historyCard}>
                {/* 顶部：交易对 + 盈亏 */}
                <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                        <View style={[styles.resultDot, { backgroundColor: profitColor }]} />
                        <Text style={styles.cardPair}>{(item.pair ?? '').replace(':', '/')}</Text>
                        <View style={[
                            styles.directionBadge,
                            { backgroundColor: item.is_short ? Colors.dark.lossBg : Colors.dark.profitBg }
                        ]}>
                            <Text style={[
                                styles.directionText,
                                { color: item.is_short ? Colors.dark.loss : Colors.dark.profit }
                            ]}>
                                {item.is_short ? t('空', 'S') : t('多', 'L')}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.cardHeaderRight}>
                        <Text style={[styles.cardProfit, { color: profitColor }]}>
                            {isProfit ? '+' : ''}{(item.profit_abs ?? 0).toFixed(2)}
                        </Text>
                        <Text style={[styles.cardProfitPct, { color: profitColor }]}>
                            {isProfit ? '+' : ''}{profitPct}%
                        </Text>
                    </View>
                </View>

                {/* 中部：详细信息 */}
                <View style={styles.cardDetails}>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>{t('入场', 'Open')}</Text>
                        <Text style={styles.detailValue}>{(item.open_rate ?? 0).toFixed(4)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>{t('出场', 'Close')}</Text>
                        <Text style={styles.detailValue}>{(item.close_rate ?? 0).toFixed(4)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>{t('持仓', 'Duration')}</Text>
                        <Text style={styles.detailValue}>{formatDuration(item.trade_duration ?? 0)}</Text>
                    </View>
                </View>

                {/* 底部：时间信息 */}
                <View style={styles.cardFooter}>
                    <Text style={styles.footerText}>
                        {formatDate(item.close_date ?? item.open_date)}
                    </Text>
                    <Text style={styles.footerText}>
                        {item.exit_reason ?? item.sell_reason ?? '-'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* 统计概览 */}
            <View style={styles.overviewRow}>
                <View style={styles.overviewCard}>
                    <Text style={styles.overviewLabel}>{t('总交易', 'Trades')}</Text>
                    <Text style={styles.overviewValue}>{totalTrades}</Text>
                </View>
                <View style={styles.overviewCard}>
                    <Text style={styles.overviewLabel}>{t('胜率', 'Win Rate')}</Text>
                    <Text style={[styles.overviewValue, { color: Colors.dark.primary }]}>{winRate}%</Text>
                </View>
                <View style={styles.overviewCard}>
                    <Text style={styles.overviewLabel}>{t('总盈亏', 'Total P&L')}</Text>
                    <Text style={[
                        styles.overviewValue,
                        { color: totalPnl >= 0 ? Colors.dark.profit : Colors.dark.loss }
                    ]}>
                        {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                    </Text>
                </View>
            </View>

            {/* 历史列表 */}
            <FlatList
                data={tradeHistory}
                keyExtractor={(item) => String(item.trade_id)}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isLoading}
                        onRefresh={onRefresh}
                        tintColor={Colors.dark.primary}
                        colors={[Colors.dark.primary]}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyCard}>
                        <Ionicons name="time-outline" size={48} color={Colors.dark.textMuted} />
                        <Text style={styles.emptyCardText}>{t('暂无历史记录', 'No history')}</Text>
                        <Text style={styles.emptyCardSubtext}>{t('完成的交易将会在这里显示', 'Completed trades will appear here')}</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    listContent: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: 40,
    },

    // === 统计概览 ===
    overviewRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    overviewCard: {
        flex: 1,
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    overviewLabel: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
        marginBottom: Spacing.xs,
    },
    overviewValue: {
        color: Colors.dark.text,
        fontSize: FontSize.lg,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },

    // === 历史卡片 ===
    historyCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    cardHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    resultDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    cardPair: {
        color: Colors.dark.text,
        fontSize: FontSize.md,
        fontWeight: '700',
    },
    directionBadge: {
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    directionText: {
        fontSize: 9,
        fontWeight: '800',
    },
    cardHeaderRight: {
        alignItems: 'flex-end',
    },
    cardProfit: {
        fontSize: FontSize.md,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },
    cardProfitPct: {
        fontSize: FontSize.xs,
        fontFamily: 'SpaceMono',
    },

    // === 详细信息 ===
    cardDetails: {
        flexDirection: 'row',
        paddingTop: Spacing.sm,
        borderTopWidth: 0.5,
        borderTopColor: Colors.dark.surfaceBorder,
    },
    detailItem: {
        flex: 1,
    },
    detailLabel: {
        color: Colors.dark.textMuted,
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    detailValue: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
        fontFamily: 'SpaceMono',
        fontWeight: '600',
    },

    // === 底部 ===
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 0.5,
        borderTopColor: Colors.dark.surfaceBorder,
    },
    footerText: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
    },

    // === 空状态 ===
    emptyCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.md,
    },
    emptyIconWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.dark.primaryBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.lg,
        fontWeight: '600',
    },
    emptyCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.xxxl,
        alignItems: 'center',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        marginTop: Spacing.lg,
    },
    emptyCardText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.lg,
        fontWeight: '600',
        marginTop: Spacing.sm,
    },
    emptyCardSubtext: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.sm,
    },
});
