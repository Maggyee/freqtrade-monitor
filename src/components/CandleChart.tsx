// K 线蜡烛图组件 - 支持左右滑动查看历史数据
// 基于 react-native-svg + ScrollView 实现可滚动蜡烛图
// 支持 OHLCV 数据、价格坐标轴、交易入场标记、触摸滑动

import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, ScrollView } from 'react-native';
import Svg, { Rect, Line, G, Text as SvgText } from 'react-native-svg';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { CandleData } from '@/src/api/freqtradeClient';

// 组件的 Props 类型定义
interface CandleChartProps {
    candles: CandleData[];         // K 线蜡烛数据数组
    height?: number;               // 图表高度（默认 220）
    openRate?: number;             // 可选：交易入场价格（显示为水平虚线）
    isLoading?: boolean;           // 是否正在加载
    errorMessage?: string;         // 错误信息
    timeframe?: string;            // 当前时间周期标签
}

// === 常量定义 ===
const CANDLE_WIDTH = 7;           // 每根蜡烛的宽度（像素）
const CANDLE_GAP = 3;             // 蜡烛间距（像素）
const CANDLE_STEP = CANDLE_WIDTH + CANDLE_GAP;  // 每根蜡烛占用的总宽度
const PADDING_TOP = 24;           // 图表上方给 OHLC 数据留白
const PADDING_BOTTOM = 28;       // 底部给时间标签（加高防止被部分手机遮挡）
const PRICE_AXIS_WIDTH = 55;     // 左侧价格轴宽度
const PADDING_RIGHT = 20;        // 右侧留白

// 将时间戳格式化为短时间字符串
const formatTime = (ts: number, timeframe?: string): string => {
    const date = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    // 日线及以上显示日期，其他显示时间
    if (timeframe === '1d' || timeframe === '1w') {
        return `${month}/${day}`;
    }
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
    height = 220,
    openRate,
    isLoading = false,
    errorMessage,
    timeframe,
}: CandleChartProps) {
    // === 内部状态 ===
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // 屏幕宽度
    const screenWidth = Dimensions.get('window').width;
    const containerWidth = screenWidth - Spacing.lg * 2;  // 外部容器宽度

    // ScrollView ref，用于自动滚动到最右端
    const scrollRef = useRef<ScrollView>(null);

    // 可用绘图高度
    const drawHeight = height - PADDING_TOP - PADDING_BOTTOM;

    // 计算图表总宽度（根据蜡烛数量决定）
    const totalCandleWidth = candles.length * CANDLE_STEP + PADDING_RIGHT;
    // 可滚动区域宽度（至少等于容器宽度）
    const scrollContentWidth = Math.max(totalCandleWidth, containerWidth - PRICE_AXIS_WIDTH);

    // 数据变化时自动滚动到最右端（显示最新数据），并重置选中状态
    useEffect(() => {
        setSelectedIndex(null);
        if (candles.length > 0 && scrollRef.current) {
            // 延迟一帧确保 layout 完成
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: false });
            }, 50);
        }
    }, [candles]);

    // 计算价格范围和 Y 轴数据（独立于滚动位置）
    const priceData = useMemo(() => {
        if (!candles || candles.length === 0) return null;

        let minPrice = Infinity;
        let maxPrice = -Infinity;
        candles.forEach(c => {
            if (c.high > maxPrice) maxPrice = c.high;
            if (c.low < minPrice) minPrice = c.low;
        });

        // 如果有入场价格，扩展范围
        if (openRate !== undefined) {
            if (openRate > maxPrice) maxPrice = openRate;
            if (openRate < minPrice) minPrice = openRate;
        }

        // 上下留 5% 的 padding
        const range = maxPrice - minPrice || 1;
        minPrice -= range * 0.05;
        maxPrice += range * 0.05;
        const priceRange = maxPrice - minPrice;

        // 价格到 Y 坐标的映射
        const priceToY = (price: number) => {
            return PADDING_TOP + drawHeight - ((price - minPrice) / priceRange) * drawHeight;
        };

        // Y 轴价格标签（5 个刻度）
        const priceLabels = [];
        const labelCount = 4;
        for (let i = 0; i <= labelCount; i++) {
            const price = minPrice + (priceRange * i) / labelCount;
            priceLabels.push({ y: priceToY(price), label: formatPrice(price) });
        }

        // 入场价格 Y 坐标
        const openRateY = openRate !== undefined ? priceToY(openRate) : null;

        return { minPrice, maxPrice, priceRange, priceToY, priceLabels, openRateY };
    }, [candles, drawHeight, openRate]);

    // 计算蜡烛绘图数据
    const chartData = useMemo(() => {
        if (!candles || candles.length === 0 || !priceData) return null;

        const { priceToY } = priceData;

        // 每根蜡烛的绘制参数
        const bars = candles.map((c, i) => {
            const x = i * CANDLE_STEP;
            const isGreen = c.close >= c.open;
            const bodyTop = priceToY(Math.max(c.open, c.close));
            const bodyBottom = priceToY(Math.min(c.open, c.close));
            const bodyHeight = Math.max(1, bodyBottom - bodyTop);

            return {
                x,
                wickTop: priceToY(c.high),
                wickBottom: priceToY(c.low),
                bodyTop,
                bodyHeight,
                isGreen,
                timestamp: c.date,
            };
        });

        // X 轴时间标签（固定展示间距，避免因 K 线数量变多而变稀疏）
        const timeLabels: { x: number; label: string }[] = [];
        // 间隔 7 根K线（约 70 像素宽度）展示一个时间标签，使得屏幕内能有适量的标签
        const step = 7;
        for (let i = 0; i < candles.length; i += step) {
            // 避免最后一个标签跑到最边缘被截断
            if (i > candles.length - 2) break;

            timeLabels.push({
                x: bars[i].x + CANDLE_WIDTH / 2,
                label: formatTime(candles[i].date, timeframe),
            });
        }

        // 始终补充最新的一根（最右侧）的标签
        if (candles.length > 0) {
            const lastIndex = candles.length - 1;
            timeLabels.push({
                x: bars[lastIndex].x + CANDLE_WIDTH / 2,
                label: formatTime(candles[lastIndex].date, timeframe),
            });
        }

        return { bars, timeLabels };
    }, [candles, priceData, timeframe]);

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

    // ===== 空数据 =====
    if (!chartData || !priceData || !candles || candles.length === 0) {
        return (
            <View style={[styles.container, { height }]}>
                <Text style={styles.emptyText}>暂无 K 线数据</Text>
                <Text style={styles.emptySubtext}>请确认 Bot 正在运行并有数据加载</Text>
            </View>
        );
    }

    const { bars, timeLabels } = chartData;
    const { priceLabels, openRateY } = priceData;

    // 当前应该显示哪根蜡烛的数据
    const displayCandle = selectedIndex !== null && selectedIndex < candles.length
        ? candles[selectedIndex]
        : candles[candles.length - 1];

    return (
        <View style={styles.wrapper}>
            {/* 图表主体：左侧固定价格轴 + 右侧可滚动蜡烛区域 */}
            <View style={[styles.chartContainer, { height }]}>

                {/* 顶部悬浮的 OHLC (开高低收) 数据展示 */}
                {candles.length > 0 && displayCandle && (
                    <View style={styles.ohlcOverlay}>
                        <Text style={styles.ohlcText}>
                            <Text style={styles.ohlcLabel}>O </Text>{formatPrice(displayCandle.open)}
                            <Text style={styles.ohlcLabel}>  H </Text>{formatPrice(displayCandle.high)}
                            <Text style={styles.ohlcLabel}>  L </Text>{formatPrice(displayCandle.low)}
                            <Text style={styles.ohlcLabel}>  C </Text>
                            <Text style={{
                                color: displayCandle.close >= displayCandle.open
                                    ? Colors.dark.profit : Colors.dark.loss
                            }}>
                                {formatPrice(displayCandle.close)}
                            </Text>
                            {/* 如果有选中项，显示对应的时间 */}
                            {selectedIndex !== null && (
                                <Text style={styles.ohlcLabel}>  [{formatTime(displayCandle.date, timeframe)}]</Text>
                            )}
                        </Text>
                    </View>
                )}

                <View style={{ flexDirection: 'row', flex: 1, marginTop: 4 }}>

                    {/* === 左侧固定价格 Y 轴 === */}
                    <View style={[styles.priceAxis, { width: PRICE_AXIS_WIDTH }]}>
                        <Svg width={PRICE_AXIS_WIDTH} height={height}>
                            {priceLabels.map((label, i) => (
                                <SvgText
                                    key={`price-${i}`}
                                    x={PRICE_AXIS_WIDTH - 6}
                                    y={label.y + 3}
                                    fill={Colors.dark.textMuted}
                                    fontSize={9}
                                    fontFamily="SpaceMono"
                                    textAnchor="end"
                                >
                                    {label.label}
                                </SvgText>
                            ))}

                            {/* 入场价格标签（固定在左侧） */}
                            {openRateY !== null && openRate !== undefined && (
                                <G>
                                    <Rect
                                        x={2}
                                        y={openRateY - 8}
                                        width={50}
                                        height={16}
                                        rx={3}
                                        fill={Colors.dark.primary}
                                        opacity={0.9}
                                    />
                                    <SvgText
                                        x={27}
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
                        </Svg>
                    </View>

                    {/* === 右侧可滚动蜡烛图区域 === */}
                    <ScrollView
                        ref={scrollRef}
                        horizontal={true}
                        showsHorizontalScrollIndicator={true}
                        bounces={true}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ width: scrollContentWidth }}
                    >
                        <Svg width={scrollContentWidth} height={height}>
                            {/* 水平网格线 */}
                            {priceLabels.map((label, i) => (
                                <Line
                                    key={`grid-${i}`}
                                    x1={0}
                                    y1={label.y}
                                    x2={scrollContentWidth}
                                    y2={label.y}
                                    stroke={Colors.dark.surfaceBorder}
                                    strokeWidth={0.5}
                                    strokeDasharray="4,4"
                                />
                            ))}

                            {/* 入场价格水平线 */}
                            {openRateY !== null && (
                                <Line
                                    x1={0}
                                    y1={openRateY}
                                    x2={scrollContentWidth}
                                    y2={openRateY}
                                    stroke={Colors.dark.primary}
                                    strokeWidth={1}
                                    strokeDasharray="6,3"
                                    opacity={0.6}
                                />
                            )}

                            {/* 蜡烛图绘制 */}
                            <G>
                                {/* 背景点击取消选中 */}
                                <Rect
                                    x={0}
                                    y={0}
                                    width={scrollContentWidth}
                                    height={height}
                                    fill="transparent"
                                    onPress={() => setSelectedIndex(null)}
                                />
                                {bars.map((bar, i) => {
                                    const color = bar.isGreen ? Colors.dark.profit : Colors.dark.loss;
                                    const centerX = bar.x + CANDLE_WIDTH / 2;
                                    return (
                                        <G key={`candle-${i}`}>
                                            {/* 选中高亮背景 */}
                                            {selectedIndex === i && (
                                                <Rect
                                                    x={bar.x - CANDLE_GAP / 2}
                                                    y={0}
                                                    width={CANDLE_STEP}
                                                    height={height}
                                                    fill={Colors.dark.surfaceLight}
                                                    opacity={0.6}
                                                />
                                            )}
                                            {/* 上下影线 */}
                                            <Line
                                                x1={centerX}
                                                y1={bar.wickTop}
                                                x2={centerX}
                                                y2={bar.wickBottom}
                                                stroke={color}
                                                strokeWidth={1}
                                            />
                                            {/* 蜡烛实体 */}
                                            <Rect
                                                x={bar.x}
                                                y={bar.bodyTop}
                                                width={CANDLE_WIDTH}
                                                height={bar.bodyHeight}
                                                fill={color}
                                                stroke={color}
                                                strokeWidth={0.5}
                                                rx={1}
                                            />
                                            {/* 触摸反馈层：响应手指按下以选中当前蜡烛 */}
                                            <Rect
                                                x={bar.x - CANDLE_GAP / 2}
                                                y={PADDING_TOP}
                                                width={CANDLE_STEP}
                                                height={drawHeight}
                                                fill="transparent"
                                                onPressIn={() => setSelectedIndex(i)}
                                            />
                                        </G>
                                    );
                                })}
                            </G>

                            {/* 底部时间标签 */}
                            {timeLabels.map((label, i) => (
                                <SvgText
                                    key={`time-${i}`}
                                    x={label.x}
                                    y={height - 8}
                                    fill={Colors.dark.textMuted}
                                    fontSize={8}
                                    textAnchor="middle"
                                >
                                    {label.label}
                                </SvgText>
                            ))}
                        </Svg>
                    </ScrollView>
                </View>
            </View>

            {/* 滑动提示 */}
            <Text style={styles.scrollHint}>← 左右滑动查看更多 →</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginBottom: Spacing.lg,
    },
    ohlcOverlay: {
        position: 'absolute',
        top: 6,
        left: 8,
        zIndex: 20,
    },
    ohlcText: {
        fontFamily: 'SpaceMono',
        fontSize: 10,
        color: Colors.dark.text,
    },
    ohlcLabel: {
        color: Colors.dark.textMuted,
        fontWeight: '500',
    },
    chartContainer: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        overflow: 'hidden',
    },
    priceAxis: {
        // 价格轴背景和蜡烛区域一致
        backgroundColor: Colors.dark.surface,
        borderRightWidth: 1,
        borderRightColor: Colors.dark.surfaceBorder,
        zIndex: 10,  // 确保价格轴始终在最上层
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
    scrollHint: {
        color: Colors.dark.textMuted,
        fontSize: 10,
        textAlign: 'center',
        marginTop: 4,
        opacity: 0.6,
    },
});
