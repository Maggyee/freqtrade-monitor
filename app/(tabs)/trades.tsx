// 交易管理页面 - 基于 Stitch 设计稿优化
// 顶部：Open Positions / Order History 分段控制器
// 中部：统计徽章（Total Exposure / Unrealized PNL）
// 底部：带进度条的交易卡片（Details + Close Trade 按钮）

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    RefreshControl,
    TouchableOpacity,
    Alert,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';

// 分段控制器选项
type TabType = 'open' | 'history';

export default function TradesScreen() {
    const router = useRouter();
    const {
        isConnected,
        isLoading,
        openTrades,
        tradeHistory,
        refreshAll,
        forceExit,
    } = useBotStore();

    // 当前选中的 Tab（活跃交易 / 历史记录）
    const [activeTab, setActiveTab] = useState<TabType>('open');
    // 标记正在平仓中的交易 ID
    const [closingTradeId, setClosingTradeId] = useState<number | null>(null);

    // 下拉刷新
    const onRefresh = useCallback(async () => {
        await refreshAll();
    }, [refreshAll]);

    // 平仓确认弹窗
    const handleForceExit = (tradeId: number, pair: string) => {
        Alert.alert(
            '确认平仓',
            `确定要平仓 ${pair} 吗？\n\n此操作将以市价立即平仓。`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '确认平仓',
                    style: 'destructive',
                    onPress: async () => {
                        setClosingTradeId(tradeId);
                        const success = await forceExit(tradeId);
                        setClosingTradeId(null);
                        if (success) {
                            Alert.alert('✅ 平仓成功', `${pair} 已成功平仓`);
                        }
                    },
                },
            ]
        );
    };

    // 未连接状态
    if (!isConnected) {
        return (
            <View style={styles.container}>
                <View style={styles.emptyCenter}>
                    <View style={styles.emptyIconWrap}>
                        <Ionicons name="swap-horizontal" size={36} color={Colors.dark.primary} />
                    </View>
                    <Text style={styles.emptyText}>请先连接 Bot</Text>
                </View>
            </View>
        );
    }

    // 计算统计数据
    const totalExposure = openTrades.reduce((sum, t) => sum + t.stake_amount, 0);
    const unrealizedPnl = openTrades.reduce((sum, t) => sum + t.profit_abs, 0);
    const isUnrealizedProfit = unrealizedPnl >= 0;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={isLoading}
                    onRefresh={onRefresh}
                    tintColor={Colors.dark.primary}
                    colors={[Colors.dark.primary]}
                />
            }
        >
            {/* === 分段控制器 === */}
            <View style={styles.segmentContainer}>
                <TouchableOpacity
                    style={[
                        styles.segmentBtn,
                        activeTab === 'open' && styles.segmentBtnActive,
                    ]}
                    onPress={() => setActiveTab('open')}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.segmentText,
                        activeTab === 'open' && styles.segmentTextActive,
                    ]}>
                        当前持仓
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.segmentBtn,
                        activeTab === 'history' && styles.segmentBtnActive,
                    ]}
                    onPress={() => setActiveTab('history')}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.segmentText,
                        activeTab === 'history' && styles.segmentTextActive,
                    ]}>
                        订单历史
                    </Text>
                </TouchableOpacity>
            </View>

            {/* === 统计徽章 === */}
            {activeTab === 'open' && (
                <View style={styles.statsChips}>
                    <View style={styles.statsChip}>
                        <Ionicons name="wallet-outline" size={12} color={Colors.dark.primary} />
                        <Text style={styles.statsChipLabel}>总敞口： </Text>
                        <Text style={styles.statsChipValue}>{totalExposure.toFixed(2)}</Text>
                    </View>
                    <View style={styles.statsChip}>
                        <Ionicons name="trending-up" size={12} color={isUnrealizedProfit ? Colors.dark.profit : Colors.dark.loss} />
                        <Text style={styles.statsChipLabel}>未实现盈亏： </Text>
                        <Text style={[
                            styles.statsChipValue,
                            { color: isUnrealizedProfit ? Colors.dark.profit : Colors.dark.loss }
                        ]}>
                            {isUnrealizedProfit ? '+' : ''}{unrealizedPnl.toFixed(2)}
                        </Text>
                    </View>
                </View>
            )}

            {/* === Open Positions Tab 内容 === */}
            {activeTab === 'open' && (
                <>
                    {openTrades.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <Ionicons name="analytics-outline" size={48} color={Colors.dark.textMuted} />
                            <Text style={styles.emptyCardText}>暂无活跃交易</Text>
                            <Text style={styles.emptyCardSubtext}>机器人正在等待入场信号...</Text>
                        </View>
                    ) : (
                        openTrades.map((trade) => {
                            const isProfit = trade.profit_pct >= 0;
                            const profitColor = isProfit ? Colors.dark.profit : Colors.dark.loss;
                            const isClosing = closingTradeId === trade.trade_id;
                            const profitPctDisplay = Math.abs(trade.profit_pct * 100);
                            // 进度条宽度 - 限制最大值为 100%
                            const progressWidth = Math.min(profitPctDisplay * 5, 100);

                            return (
                                <View key={trade.trade_id} style={styles.tradeCard}>
                                    {/* 交易头部：交易对 + 方向 + 利润 */}
                                    <View style={styles.tradeTop}>
                                        <View style={styles.tradeTopLeft}>
                                            {/* 币种图标 */}
                                            <View style={[styles.coinIcon, { borderColor: profitColor }]}>
                                                <Ionicons name="logo-bitcoin" size={16} color={Colors.dark.textSecondary} />
                                            </View>
                                            <View>
                                                <Text style={styles.tradePair}>
                                                    {trade.pair.replace(':', '/')}
                                                </Text>
                                                <View style={styles.tradeBadgeRow}>
                                                    <View style={[
                                                        styles.badge,
                                                        { backgroundColor: trade.is_short ? Colors.dark.lossBg : Colors.dark.profitBg }
                                                    ]}>
                                                        <Text style={[
                                                            styles.badgeText,
                                                            { color: trade.is_short ? Colors.dark.loss : Colors.dark.profit }
                                                        ]}>
                                                            {trade.is_short ? '做空' : '做多'}
                                                        </Text>
                                                    </View>
                                                    {trade.leverage > 1 && (
                                                        <Text style={styles.leverageText}>
                                                            {trade.leverage}x {trade.leverage <= 5 ? '全仓' : '逐仓'}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                        <View style={styles.tradeTopRight}>
                                            <Text style={styles.unrealizedLabel}>未实现盈亏</Text>
                                            <Text style={[styles.profitValue, { color: profitColor }]}>
                                                {isProfit ? '+' : ''}{trade.profit_abs.toFixed(2)} ({isProfit ? '+' : ''}{(trade.profit_pct * 100).toFixed(1)}%)
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 盈亏进度条 */}
                                    <View style={styles.progressBarBg}>
                                        <View
                                            style={[
                                                styles.progressBarFill,
                                                {
                                                    width: `${progressWidth}%`,
                                                    backgroundColor: profitColor,
                                                },
                                            ]}
                                        />
                                    </View>

                                    {/* 交易详情网格 */}
                                    <View style={styles.tradeGrid}>
                                        <View style={styles.gridItem}>
                                            <Text style={styles.gridLabel}>开仓价</Text>
                                            <Text style={styles.gridValue}>{trade.open_rate.toFixed(2)}</Text>
                                        </View>
                                        <View style={styles.gridItem}>
                                            <Text style={styles.gridLabel}>当前价</Text>
                                            <Text style={styles.gridValue}>{trade.current_rate.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.tradeGrid}>
                                        <View style={styles.gridItem}>
                                            <Text style={styles.gridLabel}>止损价</Text>
                                            <Text style={[styles.gridValue, { color: Colors.dark.loss }]}>
                                                {trade.stop_loss_abs.toFixed(2)}
                                            </Text>
                                        </View>
                                        <View style={styles.gridItem}>
                                            <Text style={styles.gridLabel}>保证金</Text>
                                            <Text style={styles.gridValue}>{trade.stake_amount.toFixed(2)}</Text>
                                        </View>
                                    </View>

                                    {/* 底部按钮行 */}
                                    <View style={styles.tradeActions}>
                                        <TouchableOpacity
                                            style={styles.detailsBtn}
                                            onPress={() => router.push(`/trade/${trade.trade_id}` as any)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.detailsBtnText}>详情</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.closeTradeBtn, isClosing && styles.closeTradeBtnDisabled]}
                                            onPress={() => handleForceExit(trade.trade_id, trade.pair)}
                                            disabled={isClosing}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.closeTradeBtnText}>
                                                {isClosing ? '平仓中...' : '平仓'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })
                    )}
                </>
            )}

            {/* === Order History Tab 内容 === */}
            {activeTab === 'history' && (
                <View style={styles.emptyCard}>
                    <Ionicons name="time-outline" size={48} color={Colors.dark.textMuted} />
                    <Text style={styles.emptyCardText}>交易历史</Text>
                    <Text style={styles.emptyCardSubtext}>
                        {tradeHistory.length > 0
                            ? `共 ${tradeHistory.length} 条历史记录`
                            : '暂无历史交易记录'}
                    </Text>
                </View>
            )}

            <View style={{ height: 40 }} />
        </ScrollView>
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

    // === 分段控制器 ===
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.md,
        padding: 3,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    segmentBtn: {
        flex: 1,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        alignItems: 'center',
    },
    segmentBtnActive: {
        backgroundColor: Colors.dark.surfaceLight,
    },
    segmentText: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: Colors.dark.text,
    },

    // === 统计徽章 ===
    statsChips: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    statsChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        gap: 4,
    },
    statsChipLabel: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
    },
    statsChipValue: {
        color: Colors.dark.primary,
        fontSize: FontSize.xs,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },

    // === 交易卡片 ===
    tradeCard: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    tradeTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    tradeTopLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    coinIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.dark.surfaceLight,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tradePair: {
        color: Colors.dark.text,
        fontSize: FontSize.md,
        fontWeight: '700',
        marginBottom: 2,
    },
    tradeBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    leverageText: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
    },
    tradeTopRight: {
        alignItems: 'flex-end',
    },
    unrealizedLabel: {
        color: Colors.dark.textMuted,
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    profitValue: {
        fontSize: FontSize.md,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },

    // === 进度条 ===
    progressBarBg: {
        height: 3,
        backgroundColor: Colors.dark.surfaceHighlight,
        borderRadius: 2,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },

    // === 交易详情网格 ===
    tradeGrid: {
        flexDirection: 'row',
        marginBottom: Spacing.sm,
    },
    gridItem: {
        flex: 1,
    },
    gridLabel: {
        color: Colors.dark.textMuted,
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    gridValue: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
        fontFamily: 'SpaceMono',
        fontWeight: '600',
    },

    // === 底部按钮行 ===
    tradeActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
        paddingTop: Spacing.md,
        borderTopWidth: 0.5,
        borderTopColor: Colors.dark.surfaceBorder,
    },
    detailsBtn: {
        flex: 1,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        alignItems: 'center',
    },
    detailsBtnText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
        fontWeight: '600',
    },
    closeTradeBtn: {
        flex: 1,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.dark.primary,
        alignItems: 'center',
    },
    closeTradeBtnDisabled: {
        opacity: 0.5,
    },
    closeTradeBtnText: {
        color: '#FFF',
        fontSize: FontSize.sm,
        fontWeight: '600',
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
