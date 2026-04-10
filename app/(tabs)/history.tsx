import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  BorderRadius,
  FontSize,
  Spacing,
  getScaledFontSize,
  getThemeColors,
} from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';

export default function HistoryScreen() {
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const colors = getThemeColors(themeMode);
  const fs = (size: keyof typeof FontSize | number) => getScaledFontSize(size, fontScale);
  const t = (zh: string, en: string) => (language === 'en' ? en : zh);
  const { isConnected, isLoading, server, servers, tradeHistory, refreshAll } = useBotStore();
  const hasSavedConnection = !!server || servers.length > 0;

  const onRefresh = useCallback(async () => {
    await refreshAll();
  }, [refreshAll]);

  const sortedTradeHistory = useMemo(() => {
    const toTs = (value?: string) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return [...tradeHistory].sort((a: any, b: any) => {
      const aTs = toTs(a.close_date ?? a.open_date);
      const bTs = toTs(b.close_date ?? b.open_date);
      return bTs - aTs;
    });
  }, [tradeHistory]);

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
      ? language === 'en'
        ? `${hours}h ${minutes}m`
        : `${hours}小时 ${minutes}分钟`
      : language === 'en'
        ? `${minutes}m`
        : `${minutes}分钟`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${min}`;
  };

  const totalTrades = sortedTradeHistory.length;
  const winTrades = sortedTradeHistory.filter((item: any) => (item.profit_abs ?? 0) >= 0).length;
  const winRate = totalTrades > 0 ? ((winTrades / totalTrades) * 100).toFixed(1) : '0.0';
  const totalPnl = sortedTradeHistory.reduce((sum: number, item: any) => sum + (item.profit_abs ?? 0), 0);

  if (!isConnected) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyCenter}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="time" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fs('lg') }]}>
            {hasSavedConnection ? t('正在恢复连接', 'Restoring connection') : t('请先连接 Bot', 'Connect bot first')}
          </Text>
          {hasSavedConnection ? <ActivityIndicator color={colors.primary} size="small" /> : null}
        </View>
      </View>
    );
  }

  const renderItem = ({ item }: { item: any }) => {
    const isProfit = (item.profit_abs ?? 0) >= 0;
    const profitColor = isProfit ? colors.profit : colors.loss;
    const profitPct = ((item.profit_ratio ?? item.profit_pct ?? 0) * 100).toFixed(2);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.historyCard,
          {
            backgroundColor: pressed ? colors.surfaceLight : colors.surface,
            borderColor: colors.surfaceBorder,
          },
        ]}
        onPress={() => router.push(`/trade/${item.trade_id}` as any)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.resultDot, { backgroundColor: profitColor }]} />
            <Text style={[styles.cardPair, { color: colors.text, fontSize: fs('md') }]}>
              {(item.pair ?? '').replace(':', '/')}
            </Text>
            <View
              style={[
                styles.directionBadge,
                { backgroundColor: item.is_short ? colors.lossBg : colors.profitBg },
              ]}
            >
              <Text
                style={[
                  styles.directionText,
                  { color: item.is_short ? colors.loss : colors.profit, fontSize: fs(9) },
                ]}
              >
                {item.is_short ? t('空', 'S') : t('多', 'L')}
              </Text>
            </View>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={[styles.cardProfit, { color: profitColor, fontSize: fs('md') }]}>
              {isProfit ? '+' : ''}
              {(item.profit_abs ?? 0).toFixed(2)}
            </Text>
            <Text style={[styles.cardProfitPct, { color: profitColor, fontSize: fs('xs') }]}>
              {isProfit ? '+' : ''}
              {profitPct}%
            </Text>
          </View>
        </View>

        <View style={[styles.cardDetails, { borderTopColor: colors.surfaceBorder }]}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted, fontSize: fs(9) }]}>
              {t('开仓', 'Open')}
            </Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary, fontSize: fs('sm') }]}>
              {(item.open_rate ?? 0).toFixed(4)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted, fontSize: fs(9) }]}>
              {t('平仓', 'Close')}
            </Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary, fontSize: fs('sm') }]}>
              {(item.close_rate ?? 0).toFixed(4)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted, fontSize: fs(9) }]}>
              {t('持仓', 'Duration')}
            </Text>
            <Text style={[styles.detailValue, { color: colors.textSecondary, fontSize: fs('sm') }]}>
              {formatDuration(item.trade_duration ?? 0)}
            </Text>
          </View>
        </View>

        <View style={[styles.cardFooter, { borderTopColor: colors.surfaceBorder }]}>
          <Text style={[styles.footerText, { color: colors.textMuted, fontSize: fs('xs') }]}>
            {formatDate(item.close_date ?? item.open_date)}
          </Text>
          <Text style={[styles.footerText, { color: colors.textMuted, fontSize: fs('xs') }]}>
            {item.exit_reason ?? item.sell_reason ?? '-'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.overviewRow}>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.overviewLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
            {t('总交易', 'Trades')}
          </Text>
          <Text style={[styles.overviewValue, { color: colors.text, fontSize: fs('lg') }]}>
            {totalTrades}
          </Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.overviewLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
            {t('胜率', 'Win Rate')}
          </Text>
          <Text style={[styles.overviewValue, { color: colors.primary, fontSize: fs('lg') }]}>
            {winRate}%
          </Text>
        </View>
        <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Text style={[styles.overviewLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
            {t('总盈亏', 'Total P&L')}
          </Text>
          <Text
            style={[
              styles.overviewValue,
              { color: totalPnl >= 0 ? colors.profit : colors.loss, fontSize: fs('lg') },
            ]}
          >
            {totalPnl >= 0 ? '+' : ''}
            {totalPnl.toFixed(2)}
          </Text>
        </View>
      </View>

      <FlatList
        data={sortedTradeHistory}
        keyExtractor={(item) => String(item.trade_id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Ionicons name="time-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyCardText, { color: colors.textSecondary, fontSize: fs('lg') }]}>
              {t('暂无历史记录', 'No history')}
            </Text>
            <Text style={[styles.emptyCardSubtext, { color: colors.textMuted, fontSize: fs('sm') }]}>
              {t('完成的交易将会在这里显示', 'Completed trades will appear here')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  overviewCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  overviewLabel: {
    marginBottom: Spacing.xs,
  },
  overviewValue: {
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  historyCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
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
    fontWeight: '700',
  },
  directionBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  directionText: {
    fontWeight: '800',
  },
  cardHeaderRight: {
    alignItems: 'flex-end',
  },
  cardProfit: {
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  cardProfitPct: {
    fontFamily: 'SpaceMono',
  },
  cardDetails: {
    flexDirection: 'row',
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontFamily: 'SpaceMono',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
  },
  footerText: {},
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  emptyCardText: {
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  emptyCardSubtext: {},
});
