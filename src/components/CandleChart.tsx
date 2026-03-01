// K 线蜡烛图组件 - 纯 SVG 实现
// 基于 react-native-svg 绘制简化版蜡烛图
// 支持显示 OHLCV 数据、价格坐标轴、十字光标和交易入场标记

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { CandleData } from '@/src/api/freqtradeClient';

// 组件的 Props 类型定义
interface CandleChartProps {
    candles: CandleData[];         // K 线蜡烛数据数组
    height?: number;               // 图表高度（默认 200）
    openRate?: number;             // 可选：交易入场价格（显示为水平虚线）
    isLoading?: boolean;           // 是否正在加载
    errorMessage?: string;         // 错误信息
    timeframe?: string;            // 当前时间周期标签
}

// 将时间戳格式化为短时间字符串（如 "14:30" 或 "03/01"）
const formatTime = (ts: number): string => {
    const d = new Date(ts);
    // 时间戳可能是秒或毫秒
    const date = ts > 1e12 ? d : new Date(ts * 1000);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
};

// 格式化价格（根据大小自动选择小数位数）
const formatPrice = (price: number): string => {
    if (price >= 1000) return price.toFixed(0);
    if (price >= 1) return price.toFixed(2);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
};

export default function CandleChart({
    candles,
    height = 200,
    openRate,
    isLoading = false,
    errorMessage,
    timeframe,
}: CandleChartProps) {
    // 获取屏幕宽度来计算图表宽度
    const screenWidth = Dimensions.get('window').width;
    const chartWidth = screenWidth - Spacing.lg * 2;  // 减去两侧 padding

    // 图表内边距（为坐标轴标签留空间）
    const PADDING_LEFT = 55;    // 左侧给价格标签
    const PADDING_RIGHT = 8;
    const PADDING_TOP = 12;
    const PADDING_BOTTOM = 24;  // 底部给时间标签

    // 可用的绘图区域
    const drawWidth = chartWidth - PADDING_LEFT - PADDING_RIGHT;
    const drawHeight = height - PADDING_TOP - PADDING_BOTTOM;

    // 使用 useMemo 计算蜡烛图绘制数据，避免不必要的重渲染
    const chartData = useMemo(() => {
        if (!candles || candles.length === 0) return null;

        // 计算价格范围（最高价 / 最低价）
        let minPrice = Infinity;
        let maxPrice = -Infinity;
        candles.forEach(c => {
            if (c.high > maxPrice) maxPrice = c.high;
            if (c.low < minPrice) minPrice = c.low;
        });

        // 如果有入场价格，确保它也在价格范围内
        if (openRate !== undefined) {
            if (openRate > maxPrice) maxPrice = openRate;
            if (openRate < minPrice) minPrice = openRate;
        }

        // 添加一点上下 padding（5%）
        const range = maxPrice - minPrice || 1;
        minPrice -= range * 0.05;
        maxPrice += range * 0.05;
        const priceRange = maxPrice - minPrice;

        // 计算每根蜡烛的宽度和间距
        const candleCount = candles.length;
        const totalSlots = candleCount;
        const candleWidth = Math.max(2, Math.min(10, (drawWidth / totalSlots) * 0.7));
        const gap = (drawWidth - candleWidth * totalSlots) / (totalSlots - 1 || 1);

        // 价格到 Y 坐标的映射函数
        const priceToY = (price: number) => {
            return PADDING_TOP + drawHeight - ((price - minPrice) / priceRange) * drawHeight;
        };

        // 计算每根蜡烛的绘制参数
        const bars = candles.map((c, i) => {
            const x = PADDING_LEFT + i * (candleWidth + gap);
            const isGreen = c.close >= c.open;  // 收盘 >= 开盘 = 阳线
            const bodyTop = priceToY(Math.max(c.open, c.close));
            const bodyBottom = priceToY(Math.min(c.open, c.close));
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);

            return {
                x,
                wickTop: priceToY(c.high),                // 上影线顶部
                wickBottom: priceToY(c.low),               // 下影线底部
                bodyTop,                                    // 实体顶部
                bodyHeight,                                 // 实体高度
                isGreen,                                    // 是否为阳线
                candleWidth,                                // 蜡烛宽度
                timestamp: c.date,                          // 时间戳
            };
        });

        // 生成 Y 轴价格标签（4-5 个刻度）
        const priceLabels = [];
        const labelCount = 4;
        for (let i = 0; i <= labelCount; i++) {
            const price = minPrice + (priceRange * i) / labelCount;
            priceLabels.push({
                y: priceToY(price),
                label: formatPrice(price),
            });
        }

        // 生成 X 轴时间标签（最多显示 5 个）
        const timeLabels = [];
        const timeStep = Math.max(1, Math.floor(candleCount / 5));
        for (let i = 0; i < candleCount; i += timeStep) {
            const bar = bars[i];
            timeLabels.push({
                x: bar.x + candleWidth / 2,
                label: formatTime(candles[i].date),
            });
        }

        // 计算入场价格线的位置
        const openRateY = openRate !== undefined ? priceToY(openRate) : null;

        return { bars, priceLabels, timeLabels, openRateY, minPrice, maxPrice };
    }, [candles, drawWidth, drawHeight, openRate]);

    // ===== 加载状态 =====
    if (isLoading) {
        return (
            <View style={[styles.container, { height }]}>
                <ActivityIndicator size="small" color={Colors.dark.primary} />
                <Text style={styles.loadingText}>加载 K 线数据中...</Text>
            </View>
        );
    }

    // ===== 错误状态 =====
    if (errorMessage) {
        return (
            <View style={[styles.container, { height }]}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
        );
    }

    // ===== 空数据状态 =====
    if (!chartData || !candles || candles.length === 0) {
        return (
            <View style={[styles.container, { height }]}>
                <Text style={styles.emptyText}>暂无 K 线数据</Text>
                <Text style={styles.emptySubtext}>请确认 Bot 正在运行并有数据加载</Text>
            </View>
        );
    }

    const { bars, priceLabels, timeLabels, openRateY } = chartData;

    return (
        <View style={styles.wrapper}>
            {/* 顶部标题栏（时间周期 + 最新价格） */}
            <View style={styles.headerRow}>
                {timeframe && (
                    <View style={styles.timeframeBadge}>
                        <Text style={styles.timeframeText}>{timeframe}</Text>
                    </View>
                )}
                {candles.length > 0 && (
                    <Text style={[
                        styles.latestPrice,
                        {
                            color: candles[candles.length - 1].close >= candles[candles.length - 1].open
                                ? Colors.dark.profit
                                : Colors.dark.loss
                        }
                    ]}>
                        {formatPrice(candles[candles.length - 1].close)}
                    </Text>
                )}
            </View>

            {/* SVG 蜡烛图主体 */}
            <View style={[styles.chartContainer, { height }]}>
                <Svg width={chartWidth} height={height}>
                    {/* 水平网格线 + 价格标签 */}
                    {priceLabels.map((label, i) => (
                        <G key={`grid-${i}`}>
                            {/* 网格线 */}
                            <Line
                                x1={PADDING_LEFT}
                                y1={label.y}
                                x2={chartWidth - PADDING_RIGHT}
                                y2={label.y}
                                stroke={Colors.dark.surfaceBorder}
                                strokeWidth={0.5}
                                strokeDasharray="4,4"
                            />
                            {/* 价格标签文字 */}
                            <SvgText
                                x={PADDING_LEFT - 6}
                                y={label.y + 3}
                                fill={Colors.dark.textMuted}
                                fontSize={9}
                                fontFamily="SpaceMono"
                                textAnchor="end"
                            >
                                {label.label}
                            </SvgText>
                        </G>
                    ))}

                    {/* 入场价格水平线（如果提供了 openRate） */}
                    {openRateY !== null && openRate !== undefined && (
                        <G>
                            <Line
                                x1={PADDING_LEFT}
                                y1={openRateY}
                                x2={chartWidth - PADDING_RIGHT}
                                y2={openRateY}
                                stroke={Colors.dark.primary}
                                strokeWidth={1}
                                strokeDasharray="6,3"
                                opacity={0.8}
                            />
                            {/* 入场价格标签 */}
                            <Rect
                                x={PADDING_LEFT - 52}
                                y={openRateY - 8}
                                width={50}
                                height={16}
                                rx={3}
                                fill={Colors.dark.primary}
                                opacity={0.9}
                            />
                            <SvgText
                                x={PADDING_LEFT - 27}
                                y={openRateY + 3}
                                fill="#FFFFFF"
                                fontSize={8}
                                fontFamily="SpaceMono"
                                textAnchor="middle"
                            >
                                入场
                            </SvgText>
                        </G>
                    )}

                    {/* 蜡烛图主体绘制 */}
                    {bars.map((bar, i) => {
                        const color = bar.isGreen ? Colors.dark.profit : Colors.dark.loss;
                        const centerX = bar.x + bar.candleWidth / 2;
                        return (
                            <G key={`candle-${i}`}>
                                {/* 上下影线（一条细线） */}
                                <Line
                                    x1={centerX}
                                    y1={bar.wickTop}
                                    x2={centerX}
                                    y2={bar.wickBottom}
                                    stroke={color}
                                    strokeWidth={1}
                                />
                                {/* 蜡烛实体（矩形） */}
                                <Rect
                                    x={bar.x}
                                    y={bar.bodyTop}
                                    width={bar.candleWidth}
                                    height={bar.bodyHeight}
                                    fill={bar.isGreen ? color : color}
                                    stroke={color}
                                    strokeWidth={0.5}
                                    rx={1}
                                />
                            </G>
                        );
                    })}

                    {/* 底部时间标签 */}
                    {timeLabels.map((label, i) => (
                        <SvgText
                            key={`time-${i}`}
                            x={label.x}
                            y={height - 4}
                            fill={Colors.dark.textMuted}
                            fontSize={8}
                            textAnchor="middle"
                        >
                            {label.label}
                        </SvgText>
                    ))}
                </Svg>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: Spacing.lg,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    timeframeBadge: {
        backgroundColor: Colors.dark.surfaceLight,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: BorderRadius.sm,
    },
    timeframeText: {
        color: Colors.dark.primary,
        fontSize: FontSize.xs,
        fontWeight: '700',
    },
    latestPrice: {
        fontSize: FontSize.md,
        fontWeight: '700',
        fontFamily: 'SpaceMono',
    },
    chartContainer: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    container: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
    },
    loadingText: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.sm,
        marginTop: Spacing.xs,
    },
    errorText: {
        color: Colors.dark.warning,
        fontSize: FontSize.sm,
        textAlign: 'center',
        paddingHorizontal: Spacing.md,
    },
    emptyText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    emptySubtext: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
    },
});
