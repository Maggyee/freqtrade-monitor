import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { BorderRadius, Colors, FontSize, Spacing, getThemeColors } from '@/constants/Colors';
import { CandleData } from '@/src/api/freqtradeClient';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';

interface CandleChartProps {
  candles: CandleData[];
  height?: number;
  openRate?: number;
  closeRate?: number;
  entryTimestamp?: number;
  exitTimestamp?: number;
  isLoading?: boolean;
  errorMessage?: string;
  timeframe?: string;
}

const CANDLE_WIDTH = 7;
const CANDLE_GAP = 3;
const CANDLE_STEP = CANDLE_WIDTH + CANDLE_GAP;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 34;
const PRICE_AXIS_WIDTH = 55;
const MIN_LABEL_GAP = 44;

const timeframeToMs = (timeframe?: string) => {
  if (!timeframe) return 60 * 60 * 1000;
  const unit = timeframe.slice(-1);
  const count = Number(timeframe.slice(0, -1));
  if (!Number.isFinite(count)) return 60 * 60 * 1000;
  if (unit === 'm') return count * 60 * 1000;
  if (unit === 'h') return count * 60 * 60 * 1000;
  if (unit === 'd') return count * 24 * 60 * 60 * 1000;
  if (unit === 'w') return count * 7 * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
};

const formatTime = (ts: number, timeframe?: string): string => {
  const date = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  if (timeframe === '1d' || timeframe === '1w') return `${month}/${day}`;
  return `${h}:${m}`;
};

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
  closeRate,
  entryTimestamp,
  exitTimestamp,
  isLoading = false,
  errorMessage,
  timeframe,
}: CandleChartProps) {
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const screenWidth = Dimensions.get('window').width;
  const containerWidth = screenWidth - Spacing.lg * 2;
  const drawHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const totalCandleWidth = candles.length * CANDLE_STEP;
  const scrollContentWidth = Math.max(totalCandleWidth, containerWidth - PRICE_AXIS_WIDTH);

  useEffect(() => {
    setSelectedIndex(null);
    if (candles.length > 0 && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [candles]);

  const chartMeta = useMemo(() => {
    if (!candles.length) return null;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    candles.forEach((candle) => {
      minPrice = Math.min(minPrice, candle.low);
      maxPrice = Math.max(maxPrice, candle.high);
    });

    if (typeof openRate === 'number') {
      minPrice = Math.min(minPrice, openRate);
      maxPrice = Math.max(maxPrice, openRate);
    }
    if (typeof closeRate === 'number') {
      minPrice = Math.min(minPrice, closeRate);
      maxPrice = Math.max(maxPrice, closeRate);
    }

    const range = maxPrice - minPrice || 1;
    minPrice -= range * 0.05;
    maxPrice += range * 0.05;
    const paddedRange = maxPrice - minPrice;

    const priceToY = (price: number) =>
      PADDING_TOP + drawHeight - ((price - minPrice) / paddedRange) * drawHeight;

    const priceLabels = Array.from({ length: 5 }, (_, index) => {
      const price = minPrice + (paddedRange * index) / 4;
      return { y: priceToY(price), label: formatPrice(price) };
    });

    const bars = candles.map((candle, index) => {
      const x = index * CANDLE_STEP;
      const isGreen = candle.close >= candle.open;
      const bodyTop = priceToY(Math.max(candle.open, candle.close));
      const bodyBottom = priceToY(Math.min(candle.open, candle.close));
      return {
        x,
        wickTop: priceToY(candle.high),
        wickBottom: priceToY(candle.low),
        bodyTop,
        bodyHeight: Math.max(1, bodyBottom - bodyTop),
        isGreen,
      };
    });

    const labelStep = Math.max(1, Math.ceil(MIN_LABEL_GAP / CANDLE_STEP));
    const timeLabels = [];
    for (let i = 0; i < candles.length; i += labelStep) {
      const x = bars[i].x + CANDLE_WIDTH / 2;
      const prevLabel = timeLabels[timeLabels.length - 1];
      if (!prevLabel || x - prevLabel.x >= MIN_LABEL_GAP) {
        timeLabels.push({
          x,
          label: formatTime(candles[i].date, timeframe),
        });
      }
    }
    const lastIndex = candles.length - 1;
    const lastLabelX = bars[lastIndex].x + CANDLE_WIDTH / 2;
    const prevLabel = timeLabels[timeLabels.length - 1];
    if (!prevLabel || lastLabelX - prevLabel.x >= MIN_LABEL_GAP) {
      timeLabels.push({
        x: lastLabelX,
        label: formatTime(candles[lastIndex].date, timeframe),
      });
    } else {
      timeLabels[timeLabels.length - 1] = {
        x: lastLabelX,
        label: formatTime(candles[lastIndex].date, timeframe),
      };
    }

    const candleSpanFallback = timeframeToMs(timeframe);

    const findMarkerX = (timestamp?: number) => {
      if (!timestamp) return null;

      for (let i = 0; i < candles.length; i++) {
        const candleStart = candles[i].date;
        const nextCandleStart =
          i < candles.length - 1 ? candles[i + 1].date : candleStart + candleSpanFallback;
        const candleSpan = Math.max(nextCandleStart - candleStart, 1);
        const candleEnd = candleStart + candleSpan;

        if (timestamp >= candleStart && timestamp < candleEnd) {
          const progress = Math.max(0, Math.min(1, (timestamp - candleStart) / candleSpan));
          return bars[i].x + progress * CANDLE_STEP + CANDLE_WIDTH / 2;
        }
      }

      if (timestamp < candles[0].date) {
        return bars[0].x + CANDLE_WIDTH / 2;
      }

      const lastBar = bars[bars.length - 1];
      return lastBar.x + CANDLE_WIDTH / 2;
    };

    return {
      priceLabels,
      bars,
      timeLabels,
      priceToY,
      openRateY: typeof openRate === 'number' ? priceToY(openRate) : null,
      closeRateY: typeof closeRate === 'number' ? priceToY(closeRate) : null,
      entryX: findMarkerX(entryTimestamp),
      exitX: findMarkerX(exitTimestamp),
    };
  }, [candles, closeRate, drawHeight, entryTimestamp, exitTimestamp, openRate, timeframe]);

  if (isLoading) {
    return (
      <View style={[styles.stateWrap, { height, backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.stateText, { color: colors.textMuted }]}>Loading candles...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.stateWrap, { height, backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.errorText, { color: colors.warning }]}>{errorMessage}</Text>
      </View>
    );
  }

  if (!chartMeta || candles.length === 0) {
    return (
      <View style={[styles.stateWrap, { height, backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.stateText, { color: colors.textMuted }]}>No candle data</Text>
      </View>
    );
  }

  const displayCandle =
    selectedIndex !== null && selectedIndex < candles.length
      ? candles[selectedIndex]
      : candles[candles.length - 1];

  return (
    <View style={styles.wrapper}>
      <View style={[styles.chartContainer, { height, backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.ohlcOverlay}>
          <Text style={[styles.ohlcText, { color: colors.text }]}>
            <Text style={[styles.ohlcLabel, { color: colors.textMuted }]}>O </Text>{formatPrice(displayCandle.open)}
            <Text style={[styles.ohlcLabel, { color: colors.textMuted }]}> H </Text>{formatPrice(displayCandle.high)}
            <Text style={[styles.ohlcLabel, { color: colors.textMuted }]}> L </Text>{formatPrice(displayCandle.low)}
            <Text style={[styles.ohlcLabel, { color: colors.textMuted }]}> C </Text>
            <Text style={{ color: displayCandle.close >= displayCandle.open ? colors.profit : colors.loss }}>
              {formatPrice(displayCandle.close)}
            </Text>
            {selectedIndex !== null ? (
              <Text style={[styles.ohlcLabel, { color: colors.textMuted }]}> [{formatTime(displayCandle.date, timeframe)}]</Text>
            ) : null}
          </Text>
        </View>

        <View style={styles.chartRow}>
          <View style={[styles.priceAxis, { backgroundColor: colors.surface, borderRightColor: colors.surfaceBorder }]}>
            <Svg width={PRICE_AXIS_WIDTH} height={height}>
              {chartMeta.priceLabels.map((label, index) => (
                <SvgText
                  key={`price-${index}`}
                  x={PRICE_AXIS_WIDTH - 6}
                  y={label.y + 3}
                  fill={colors.textMuted}
                  fontSize={8}
                  fontFamily="SpaceMono"
                  textAnchor="end"
                >
                  {label.label}
                </SvgText>
              ))}
            </Svg>
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator
            style={{ flex: 1 }}
            contentContainerStyle={{ width: scrollContentWidth }}
          >
            <Svg width={scrollContentWidth} height={height}>
              {chartMeta.priceLabels.map((label, index) => (
                <Line
                  key={`grid-${index}`}
                  x1={0}
                  y1={label.y}
                  x2={scrollContentWidth}
                  y2={label.y}
                  stroke={colors.surfaceBorder}
                  strokeWidth={0.5}
                  strokeDasharray="4,4"
                />
              ))}

              {chartMeta.openRateY !== null ? (
                <Line
                  x1={0}
                  y1={chartMeta.openRateY}
                  x2={scrollContentWidth}
                  y2={chartMeta.openRateY}
                  stroke={colors.primary}
                  strokeWidth={1}
                  strokeDasharray="6,3"
                  opacity={0.6}
                />
              ) : null}

              {chartMeta.closeRateY !== null ? (
                <Line
                  x1={0}
                  y1={chartMeta.closeRateY}
                  x2={scrollContentWidth}
                  y2={chartMeta.closeRateY}
                  stroke={colors.warning}
                  strokeWidth={1}
                  strokeDasharray="6,3"
                  opacity={0.6}
                />
              ) : null}

              {chartMeta.entryX !== null ? (
                <G>
                  <Line
                    x1={chartMeta.entryX}
                    y1={PADDING_TOP}
                    x2={chartMeta.entryX}
                    y2={height - PADDING_BOTTOM}
                    stroke={colors.primary}
                    strokeWidth={1}
                    strokeDasharray="4,3"
                  />
                  <Rect
                    x={chartMeta.entryX - 18}
                    y={PADDING_TOP + 2}
                    width={36}
                    height={14}
                    rx={4}
                    fill={colors.primary}
                  />
                  <SvgText x={chartMeta.entryX} y={PADDING_TOP + 12} fill="#fff" fontSize={8} textAnchor="middle">
                    Entry
                  </SvgText>
                </G>
              ) : null}

              {chartMeta.exitX !== null ? (
                <G>
                  <Line
                    x1={chartMeta.exitX}
                    y1={PADDING_TOP}
                    x2={chartMeta.exitX}
                    y2={height - PADDING_BOTTOM}
                    stroke={colors.warning}
                    strokeWidth={1}
                    strokeDasharray="4,3"
                  />
                  <Rect
                    x={chartMeta.exitX - 14}
                    y={PADDING_TOP + 20}
                    width={28}
                    height={14}
                    rx={4}
                    fill={colors.warning}
                  />
                  <SvgText x={chartMeta.exitX} y={PADDING_TOP + 30} fill="#06111A" fontSize={8} textAnchor="middle">
                    Exit
                  </SvgText>
                </G>
              ) : null}

              <Rect
                x={0}
                y={0}
                width={scrollContentWidth}
                height={height}
                fill="transparent"
                onPress={() => setSelectedIndex(null)}
              />

              {chartMeta.bars.map((bar, index) => {
                    const color = bar.isGreen ? colors.profit : colors.loss;
                const centerX = bar.x + CANDLE_WIDTH / 2;
                return (
                  <G key={`candle-${index}`}>
                    {selectedIndex === index ? (
                      <Rect
                        x={bar.x - CANDLE_GAP / 2}
                        y={0}
                        width={CANDLE_STEP}
                        height={height}
                        fill={colors.surfaceLight}
                        opacity={0.6}
                      />
                    ) : null}
                    <Line x1={centerX} y1={bar.wickTop} x2={centerX} y2={bar.wickBottom} stroke={color} strokeWidth={1} />
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
                    <Rect
                      x={bar.x - CANDLE_GAP / 2}
                      y={PADDING_TOP}
                      width={CANDLE_STEP}
                      height={drawHeight}
                      fill="transparent"
                      onPressIn={() => setSelectedIndex(index)}
                    />
                  </G>
                );
              })}

              {chartMeta.timeLabels.map((label, index) => (
                <SvgText
                  key={`time-${index}`}
                  x={label.x}
                  y={height - 10}
                  fill={colors.textMuted}
                  fontSize={7}
                  textAnchor="middle"
                >
                  {label.label}
                </SvgText>
              ))}
            </Svg>
          </ScrollView>
        </View>
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>Slide left and right to inspect candles</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: Spacing.lg,
  },
  chartContainer: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    overflow: 'hidden',
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
  },
  chartRow: {
    flexDirection: 'row',
    flex: 1,
    marginTop: 4,
  },
  priceAxis: {
    width: PRICE_AXIS_WIDTH,
    backgroundColor: Colors.dark.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.dark.surfaceBorder,
    zIndex: 10,
  },
  stateWrap: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  stateText: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.sm,
  },
  errorText: {
    color: Colors.dark.warning,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  hint: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.6,
  },
});
