import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/Colors';
import { CandleData } from '@/src/api/freqtradeClient';

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
const PADDING_BOTTOM = 28;
const PRICE_AXIS_WIDTH = 55;
const PADDING_RIGHT = 20;

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const screenWidth = Dimensions.get('window').width;
  const containerWidth = screenWidth - Spacing.lg * 2;
  const drawHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const totalCandleWidth = candles.length * CANDLE_STEP + PADDING_RIGHT;
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

    const step = 7;
    const timeLabels = [];
    for (let i = 0; i < candles.length; i += step) {
      if (i > candles.length - 2) break;
      timeLabels.push({
        x: bars[i].x + CANDLE_WIDTH / 2,
        label: formatTime(candles[i].date, timeframe),
      });
    }
    const lastIndex = candles.length - 1;
    timeLabels.push({
      x: bars[lastIndex].x + CANDLE_WIDTH / 2,
      label: formatTime(candles[lastIndex].date, timeframe),
    });

    const findMarkerX = (timestamp?: number) => {
      if (!timestamp) return null;
      let closestIndex = 0;
      let bestDiff = Math.abs(candles[0].date - timestamp);
      for (let i = 1; i < candles.length; i++) {
        const diff = Math.abs(candles[i].date - timestamp);
        if (diff < bestDiff) {
          bestDiff = diff;
          closestIndex = i;
        }
      }
      return bars[closestIndex].x + CANDLE_WIDTH / 2;
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
      <View style={[styles.stateWrap, { height }]}>
        <ActivityIndicator size="small" color={Colors.dark.primary} />
        <Text style={styles.stateText}>Loading candles...</Text>
      </View>
    );
  }

  if (errorMessage) {
    return (
      <View style={[styles.stateWrap, { height }]}>
        <Text style={styles.errorText}>{errorMessage}</Text>
      </View>
    );
  }

  if (!chartMeta || candles.length === 0) {
    return (
      <View style={[styles.stateWrap, { height }]}>
        <Text style={styles.stateText}>No candle data</Text>
      </View>
    );
  }

  const displayCandle =
    selectedIndex !== null && selectedIndex < candles.length
      ? candles[selectedIndex]
      : candles[candles.length - 1];

  return (
    <View style={styles.wrapper}>
      <View style={[styles.chartContainer, { height }]}>
        <View style={styles.ohlcOverlay}>
          <Text style={styles.ohlcText}>
            <Text style={styles.ohlcLabel}>O </Text>{formatPrice(displayCandle.open)}
            <Text style={styles.ohlcLabel}> H </Text>{formatPrice(displayCandle.high)}
            <Text style={styles.ohlcLabel}> L </Text>{formatPrice(displayCandle.low)}
            <Text style={styles.ohlcLabel}> C </Text>
            <Text style={{ color: displayCandle.close >= displayCandle.open ? Colors.dark.profit : Colors.dark.loss }}>
              {formatPrice(displayCandle.close)}
            </Text>
            {selectedIndex !== null ? (
              <Text style={styles.ohlcLabel}> [{formatTime(displayCandle.date, timeframe)}]</Text>
            ) : null}
          </Text>
        </View>

        <View style={styles.chartRow}>
          <View style={styles.priceAxis}>
            <Svg width={PRICE_AXIS_WIDTH} height={height}>
              {chartMeta.priceLabels.map((label, index) => (
                <SvgText
                  key={`price-${index}`}
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
                  stroke={Colors.dark.surfaceBorder}
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
                  stroke={Colors.dark.primary}
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
                  stroke={Colors.dark.warning}
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
                    stroke={Colors.dark.primary}
                    strokeWidth={1}
                    strokeDasharray="4,3"
                  />
                  <Rect
                    x={chartMeta.entryX - 18}
                    y={PADDING_TOP + 2}
                    width={36}
                    height={14}
                    rx={4}
                    fill={Colors.dark.primary}
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
                    stroke={Colors.dark.warning}
                    strokeWidth={1}
                    strokeDasharray="4,3"
                  />
                  <Rect
                    x={chartMeta.exitX - 14}
                    y={PADDING_TOP + 20}
                    width={28}
                    height={14}
                    rx={4}
                    fill={Colors.dark.warning}
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
                const color = bar.isGreen ? Colors.dark.profit : Colors.dark.loss;
                const centerX = bar.x + CANDLE_WIDTH / 2;
                return (
                  <G key={`candle-${index}`}>
                    {selectedIndex === index ? (
                      <Rect
                        x={bar.x - CANDLE_GAP / 2}
                        y={0}
                        width={CANDLE_STEP}
                        height={height}
                        fill={Colors.dark.surfaceLight}
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

      <Text style={styles.hint}>Slide left and right to inspect candles</Text>
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
