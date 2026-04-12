import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  BorderRadius,
  Colors,
  FontSize,
  Spacing,
  getScaledFontSize,
  getThemeColors,
} from '@/constants/Colors';
import {
  CandleData,
  Trade,
  fetchExchangeCandles,
  fetchExchangeCandlesWindow,
} from '@/src/api/freqtradeClient';
import CandleChart from '@/src/components/CandleChart';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';
import { haptics } from '@/src/utils/haptics';
import { toDisplayProfitPercent } from '../../src/utils/profit';

const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
const binanceProxyUrl = 'https://app.nishiki.tech/binance';

const normalizeTimeframe = (value: string | number | undefined): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 60 && value % 60 === 0) return `${value / 60}h`;
    return `${value}m`;
  }
  return typeof value === 'string' && value.length > 0 ? value : '1h';
};

const timeframeToMs = (value: string) => {
  const unit = value.slice(-1);
  const count = Number(value.slice(0, -1));
  if (!Number.isFinite(count)) return 60 * 60 * 1000;
  if (unit === 'm') return count * 60 * 1000;
  if (unit === 'h') return count * 60 * 60 * 1000;
  if (unit === 'd') return count * 24 * 60 * 60 * 1000;
  return 60 * 60 * 1000;
};

const parseApiDate = (dateStr?: string) => {
  if (!dateStr) return null;
  const isoLike = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  return new Date(`${isoLike}Z`);
};

const getEntryOrder = (trade: Trade) =>
  trade.orders?.find((item) => item.ft_order_side === (trade.is_short ? 'sell' : 'buy')) ??
  trade.orders?.find((item) => item.ft_order_side === 'buy' || item.ft_order_side === 'sell');

const getExitOrder = (trade: Trade) =>
  !trade.close_date && !trade.close_timestamp
    ? undefined
    :
  [...(trade.orders ?? [])]
    .reverse()
    .find((item) => item.ft_order_side === (trade.is_short ? 'buy' : 'sell')) ??
  [...(trade.orders ?? [])].reverse().find((item) => item.ft_order_side === 'buy' || item.ft_order_side === 'sell');

const getEntryTimestamp = (trade: Trade) =>
  trade.open_fill_timestamp ??
  getEntryOrder(trade)?.order_filled_timestamp ??
  trade.open_timestamp ??
  parseApiDate(trade.open_date)?.getTime();

const getExitTimestamp = (trade: Trade) =>
  getExitOrder(trade)?.order_filled_timestamp ??
  trade.close_timestamp ??
  parseApiDate(trade.close_date)?.getTime();

const formatFixed = (value: number | null | undefined, digits: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '-';

const formatMoney = (value: number | null | undefined, digits: number) => `$${formatFixed(value, digits)}`;

const formatTime = (timestamp?: number, dateStr?: string) => {
  const date =
    typeof timestamp === 'number' && Number.isFinite(timestamp)
      ? new Date(timestamp)
      : parseApiDate(dateStr);
  if (!date || Number.isNaN(date.getTime())) return '-';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const colors = getThemeColors(themeMode);
  const fs = (size: keyof typeof FontSize | number) => getScaledFontSize(size, fontScale);
  const t = (zh: string, en: string) => (language === 'en' ? en : zh);
  const { openTrades, tradeHistory, forceExit, botState } = useBotStore();

  const [isClosingTrade, setIsClosingTrade] = useState(false);
  const [isSharingTrade, setIsSharingTrade] = useState(false);
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [candleLoading, setCandleLoading] = useState(false);
  const [candleError, setCandleError] = useState<string | undefined>();
  const [tradeDetail, setTradeDetail] = useState<Trade | null>(null);

  const tradeId = Number(id);
  const trade =
    openTrades.find((item) => item.trade_id === tradeId) ??
    tradeHistory.find((item) => item.trade_id === tradeId);
  const shownTrade = tradeDetail ?? trade;

  const strategyTf = normalizeTimeframe(botState?.timeframe || shownTrade?.timeframe);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>(strategyTf);

  useEffect(() => {
    if (strategyTf !== selectedTimeframe) {
      setSelectedTimeframe(strategyTf);
    }
  }, [strategyTf]);

  useEffect(() => {
    const store = useBotStore.getState();
    if (!trade || !store.client) return;

    let cancelled = false;
    void (async () => {
      try {
        const detail = await store.client!.getTrade(tradeId);
        if (!cancelled) setTradeDetail(detail);
      } catch {
        if (!cancelled) setTradeDetail(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tradeId, trade?.trade_id]);

  useEffect(() => {
    if (!shownTrade) return;
    void loadCandles(selectedTimeframe);
  }, [
    selectedTimeframe,
    shownTrade?.pair,
    shownTrade?.open_fill_timestamp,
    shownTrade?.close_timestamp,
    shownTrade?.open_date,
    shownTrade?.close_date,
  ]);

  const loadCandles = async (timeframe: string) => {
    if (!shownTrade) return;

    setCandleLoading(true);
    setCandleError(undefined);

    try {
      const store = useBotStore.getState();
      if (!store.client) {
        setCandleError(t('请先连接 Bot', 'Connect bot first'));
        return;
      }

      let parsed: CandleData[];

      if (shownTrade.close_date) {
        const candleMs = timeframeToMs(timeframe);
        const openTs = getEntryTimestamp(shownTrade) ?? 0;
        const closeTs = getExitTimestamp(shownTrade) ?? openTs;
        const contextCandles =
          timeframe === '1m' ? 120 :
          timeframe === '5m' ? 96 :
          timeframe === '15m' ? 72 :
          timeframe === '1h' ? 60 :
          timeframe === '4h' ? 36 : 24;
        parsed = await fetchExchangeCandlesWindow(
          shownTrade.pair,
          timeframe,
          Math.max(0, openTs - candleMs * contextCandles),
          closeTs + candleMs * contextCandles,
          binanceProxyUrl,
        );
      } else if (timeframe === strategyTf) {
        const result = await store.client.getPairCandles(shownTrade.pair, timeframe, 300);
        if (!result.columns || result.columns.length === 0) {
          setCandleError(t('K 线数据暂不可用', 'Candles unavailable'));
          return;
        }
        parsed = store.client.parseCandleData(result);
      } else {
        parsed = await fetchExchangeCandles(shownTrade.pair, timeframe, 300, binanceProxyUrl);
      }

      setCandleData(parsed);
    } catch (error: any) {
      setCandleError(error?.message || t('K 线加载失败', 'Failed to load candles'));
    } finally {
      setCandleLoading(false);
    }
  };

  const handleForceExit = () => {
    if (!shownTrade || !shownTrade.is_open || isClosingTrade) return;

    Alert.alert(
      t('确认平仓', 'Confirm Close'),
      language === 'en' ? `Close ${shownTrade.pair}?` : `确定要平仓 ${shownTrade.pair} 吗？`,
      [
        { text: t('取消', 'Cancel'), style: 'cancel' },
        {
          text: t('确认', 'Confirm'),
          style: 'destructive',
          onPress: async () => {
            await haptics.medium();
            setIsClosingTrade(true);
            try {
              const success = await forceExit(tradeId);
              if (success) {
                await haptics.success();
                Alert.alert(t('平仓成功', 'Closed'), '', [
                  { text: t('确定', 'OK'), onPress: () => router.back() },
                ]);
              } else {
                await haptics.error();
              }
            } finally {
              setIsClosingTrade(false);
            }
          },
        },
      ],
    );
  };

  const handleShareTrade = async () => {
    if (!shownTrade || isSharingTrade) return;
    await haptics.medium();
    setIsSharingTrade(true);
    try {
      const direction = shownTrade.is_short ? t('做空', 'Short') : t('做多', 'Long');
      const displayPct = toDisplayProfitPercent(shownTrade.profit_pct, shownTrade.profit_ratio);
      const pnlSign = shownTrade.profit_pct >= 0 ? '+' : '';
      await Share.share({
        message: [
          t('Freqtrade 交易快照', 'Freqtrade Trade Snapshot'),
          shownTrade.pair.replace(':', '/'),
          `${direction} ${shownTrade.leverage}x`,
          `${t('盈亏', 'P&L')} ${pnlSign}${displayPct.toFixed(2)}%`,
          `${t('收益', 'Profit')} ${pnlSign}${formatFixed(shownTrade.profit_abs, 4)}`,
        ].join(' | '),
      });
    } finally {
      setIsSharingTrade(false);
    }
  };

  if (!shownTrade) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen
          options={{
            title: t('交易详情', 'Trade Detail'),
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
          }}
        />
        <View style={styles.emptyCenter}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fs('md') }]}>{t('交易未找到，可能已经被清理。', 'Trade not found.')}</Text>
          <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.primary }]} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={[styles.backButtonText, { fontSize: fs('md') }]}>{t('返回', 'Back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const entryTimestamp = getEntryTimestamp(shownTrade);
  const exitTimestamp = getExitTimestamp(shownTrade);
  const isProfit = shownTrade.profit_pct >= 0;
  const profitColor = isProfit ? colors.profit : colors.loss;
  const displayPct = toDisplayProfitPercent(shownTrade.profit_pct, shownTrade.profit_ratio);
  const openDate =
    typeof entryTimestamp === 'number' ? new Date(entryTimestamp) : parseApiDate(shownTrade.open_date) ?? new Date();
  const endDate =
    typeof exitTimestamp === 'number'
      ? new Date(exitTimestamp)
      : shownTrade.close_date
        ? parseApiDate(shownTrade.close_date) ?? new Date()
        : new Date();
  const durationMs = endDate.getTime() - openDate.getTime();
  const totalMinutes = Math.max(1, Math.floor(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const durationText =
    hours >= 24
      ? `${Math.floor(hours / 24)}d ${hours % 24}h`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.pairTitle, { color: colors.text, fontSize: fs('xxl') }]}>{shownTrade.pair.replace(':', '/')}</Text>
          <View
            style={[
              styles.badge,
              { backgroundColor: shownTrade.is_short ? colors.lossBg : colors.profitBg },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: shownTrade.is_short ? colors.loss : colors.profit, fontSize: fs('xs') },
              ]}
            >
              {shownTrade.is_short ? t('做空', 'Short') : t('做多', 'Long')}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.badgeText, { color: colors.primary, fontSize: fs('xs') }]}>{shownTrade.leverage}x</Text>
          </View>
          {!shownTrade.is_open ? (
            <View style={[styles.badge, { backgroundColor: colors.surfaceLight }]}>
              <Text style={[styles.badgeText, { color: colors.textSecondary, fontSize: fs('xs') }]}>
                {t('已平仓', 'Closed')}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('开仓价', 'Entry')}</Text>
            <Text style={[styles.summaryValue, { color: colors.text, fontSize: fs('sm') }]}>{formatMoney(shownTrade.open_rate, 2)}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
              {shownTrade.is_open ? t('当前价', 'Current') : t('平仓价', 'Exit')}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text, fontSize: fs('sm') }]}>
              {shownTrade.is_open
                ? formatMoney(shownTrade.current_rate, 2)
                : formatMoney(shownTrade.close_rate, 2)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.summaryLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('持仓', 'Duration')}</Text>
            <Text style={[styles.summaryValue, { color: colors.text, fontSize: fs('sm') }]}>{durationText}</Text>
          </View>
        </View>

        <View style={styles.priceSection}>
          <Text style={[styles.priceLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
            {shownTrade.is_open ? t('实时价格', 'Live Price') : t('成交结果', 'Trade Result')}
          </Text>
          <Text style={[styles.priceValue, { color: colors.text, fontSize: fs('hero') }]}>
            {shownTrade.is_open
              ? formatMoney(shownTrade.current_rate, 2)
              : formatMoney(shownTrade.close_rate, 2)}
          </Text>
          <Text style={[styles.priceDelta, { color: profitColor, fontSize: fs('md') }]}>
            {isProfit ? '+' : ''}
            {displayPct.toFixed(2)}%
          </Text>
        </View>

        <View style={styles.timeframeRow}>
          {timeframes.map((timeframe) => (
            <TouchableOpacity
              key={timeframe}
              style={[
                styles.timeframeButton,
                { backgroundColor: colors.surface, borderColor: colors.surfaceBorder },
                selectedTimeframe === timeframe && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
              ]}
              onPress={async () => {
                await haptics.selection();
                setSelectedTimeframe(timeframe);
              }}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.timeframeButtonText,
                  { color: colors.textMuted, fontSize: fs('xs') },
                  selectedTimeframe === timeframe && [styles.timeframeButtonTextActive, { color: colors.primary }],
                ]}
              >
                {timeframe}
                {timeframe === strategyTf ? ' *' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <CandleChart
          candles={candleData}
          height={220}
          openRate={typeof shownTrade.open_rate === 'number' ? shownTrade.open_rate : undefined}
          closeRate={typeof shownTrade.close_rate === 'number' ? shownTrade.close_rate : undefined}
          entryTimestamp={entryTimestamp}
          exitTimestamp={exitTimestamp}
          isLoading={candleLoading}
          errorMessage={candleError}
          timeframe={selectedTimeframe}
        />

        <View style={[styles.pnlCard, { backgroundColor: colors.surface, borderColor: profitColor }]}>
          <Text style={[styles.pnlLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('本笔盈亏', 'Trade P&L')}</Text>
          <View style={styles.pnlRow}>
            <Text style={[styles.pnlAbs, { color: profitColor, fontSize: fs('xxl') }]}>
              {isProfit ? '+' : ''}
              {formatFixed(shownTrade.profit_abs, 4)}
            </Text>
            <View style={[styles.pnlBadge, { backgroundColor: isProfit ? colors.profitBg : colors.lossBg }]}>
              <Text style={[styles.pnlBadgeText, { color: profitColor, fontSize: fs('sm') }]}>
                {isProfit ? '+' : ''}
                {displayPct.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs('lg') }]}>{t('交易指标', 'Trade Metrics')}</Text>
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('仓位', 'Stake')}</Text>
            <Text style={[styles.metricValue, { color: colors.text, fontSize: fs('sm') }]}>{formatFixed(shownTrade.stake_amount, 2)}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('止损价', 'Stoploss')}</Text>
            <Text style={[styles.metricValue, { color: colors.loss, fontSize: fs('sm') }]}>
              {formatFixed(shownTrade.stop_loss_abs, 4)}
            </Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('最高价', 'Max Rate')}</Text>
            <Text style={[styles.metricValue, { color: colors.text, fontSize: fs('sm') }]}>{formatFixed(shownTrade.max_rate, 4)}</Text>
          </View>
          <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Text style={[styles.metricLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('最低价', 'Min Rate')}</Text>
            <Text style={[styles.metricValue, { color: colors.text, fontSize: fs('sm') }]}>{formatFixed(shownTrade.min_rate, 4)}</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs('lg') }]}>{t('订单时间线', 'Timeline')}</Text>
        <View style={styles.timeline}>
          <View style={styles.timelineItem}>
            <View style={styles.timelineDotColumn}>
              <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
              <View style={[styles.timelineLine, { backgroundColor: colors.surfaceBorder }]} />
            </View>
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineTitle, { color: colors.text, fontSize: fs('md') }]}>{t('开仓', 'Entry')}</Text>
              <Text style={[styles.timelineSubtitle, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                {formatFixed(shownTrade.amount, 4)} @ {formatMoney(shownTrade.open_rate, 2)}
              </Text>
              <Text style={[styles.timelineTime, { color: colors.textMuted, fontSize: fs('xs') }]}>{formatTime(entryTimestamp, shownTrade.open_date)}</Text>
            </View>
          </View>

          {shownTrade.close_date ? (
            <View style={styles.timelineItem}>
              <View style={styles.timelineDotColumn}>
                <View style={[styles.timelineDot, { backgroundColor: colors.warning }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: colors.text, fontSize: fs('md') }]}>{t('平仓', 'Exit')}</Text>
                <Text style={[styles.timelineSubtitle, { color: colors.textSecondary, fontSize: fs('sm') }]}>{formatMoney(shownTrade.close_rate, 2)}</Text>
                <Text style={[styles.timelineTime, { color: colors.textMuted, fontSize: fs('xs') }]}>{formatTime(exitTimestamp, shownTrade.close_date)}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.timelineItem}>
              <View style={styles.timelineDotColumn}>
                <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
              </View>
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: colors.text, fontSize: fs('md') }]}>{t('持仓进行中', 'Position Active')}</Text>
                <Text style={[styles.timelineSubtitle, { color: colors.textSecondary, fontSize: fs('sm') }]}>{t('已持有', 'Open for')} {durationText}</Text>
                <Text style={[styles.timelineTime, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('现在', 'Now')}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={[styles.secondaryButton, { borderColor: colors.surfaceBorder, backgroundColor: colors.surface }, isSharingTrade && styles.disabledButton]}
            onPress={handleShareTrade}
            disabled={isSharingTrade || isClosingTrade}
            activeOpacity={0.75}
          >
            {isSharingTrade ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
            )}
            <Text style={[styles.secondaryButtonText, { color: colors.textSecondary, fontSize: fs('md') }]}>
              {isSharingTrade ? t('分享中...', 'Sharing...') : t('分享', 'Share')}
            </Text>
          </TouchableOpacity>

          {shownTrade.is_open ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.primary }, isClosingTrade && styles.disabledButton]}
              onPress={handleForceExit}
              disabled={isClosingTrade || isSharingTrade}
              activeOpacity={0.75}
            >
              {isClosingTrade ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="close-circle-outline" size={18} color="#FFF" />
              )}
              <Text style={[styles.primaryButtonText, { fontSize: fs('md') }]}>
                {isClosingTrade ? t('平仓中...', 'Closing...') : t('平仓', 'Close Trade')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={{ height: 48 }} />
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
    paddingBottom: 64,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    flexWrap: 'wrap',
  },
  pairTitle: {
    color: Colors.dark.text,
    fontSize: FontSize.xxl,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  summaryLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    marginBottom: 4,
  },
  summaryValue: {
    color: Colors.dark.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  priceSection: {
    marginBottom: Spacing.lg,
  },
  priceLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    marginBottom: 4,
  },
  priceValue: {
    color: Colors.dark.text,
    fontSize: FontSize.hero,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
  },
  priceDelta: {
    marginTop: Spacing.xs,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  timeframeRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  timeframeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    borderRadius: BorderRadius.full,
  },
  timeframeButtonActive: {
    backgroundColor: Colors.dark.primaryBg,
    borderColor: Colors.dark.primary,
  },
  timeframeButtonText: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  timeframeButtonTextActive: {
    color: Colors.dark.primary,
  },
  pnlCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  pnlLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pnlAbs: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    fontFamily: 'SpaceMono',
  },
  pnlBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  pnlBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  sectionTitle: {
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
  metricCard: {
    width: '48%',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  metricLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    marginBottom: 4,
  },
  metricValue: {
    color: Colors.dark.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  timeline: {
    marginBottom: Spacing.xl,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: Spacing.md,
    minHeight: 64,
  },
  timelineDotColumn: {
    width: 20,
    alignItems: 'center',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
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
    fontWeight: '700',
    marginBottom: 2,
  },
  timelineSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.sm,
  },
  timelineTime: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    paddingVertical: Spacing.md,
  },
  secondaryButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.primary,
    paddingVertical: Spacing.md,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.6,
  },
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
