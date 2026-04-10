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

import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';

export default function HistoryScreen() {
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
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

  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCenter}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="time" size={36} color={Colors.dark.primary} />
          </View>
          <Text style={styles.emptyText}>
            {hasSavedConnection ? t('正在恢复连接', 'Restoring connection') : t('请先连接 Bot', 'Connect bot first')}
          </Text>
          {hasSavedConnection ? <ActivityIndicator color={Colors.dark.primary} size="small" /> : null}
        </View>
      </View>
    );
  }

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

  const renderItem = ({ item }: { item: any }) => {
    const isProfit = (item.profit_abs ?? 0) >= 0;
    const profitColor = isProfit ? Colors.dark.profit : Colors.dark.loss;
    const profitPct = ((item.profit_ratio ?? item.profit_pct ?? 0) * 100).toFixed(2);

    return (
      <Pressable
        style={({ pressed }) => [styles.historyCard, pressed && styles.historyCardPressed]}
        onPress={() => router.push(`/trade/${item.trade_id}` as any)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.resultDot, { backgroundColor: profitColor }]} />
            <Text style={styles.cardPair}>{(item.pair ?? '').replace(':', '/')}</Text>
            <View
              style={[
                styles.directionBadge,
                { backgroundColor: item.is_short ? Colors.dark.lossBg : Colors.dark.profitBg },
              ]}
            >
              <Text
                style={[
                  styles.directionText,
                  { color: item.is_short ? Colors.dark.loss : Colors.dark.profit },
                ]}
              >
                {item.is_short ? t('空', 'S') : t('多', 'L')}
              </Text>
            </View>
          </View>
          <View style={styles.cardHeaderRight}>
            <Text style={[styles.cardProfit, { color: profitColor }]}>
              {isProfit ? '+' : ''}
              {(item.profit_abs ?? 0).toFixed(2)}
            </Text>
            <Text style={[styles.cardProfitPct, { color: profitColor }]}>
              {isProfit ? '+' : ''}
              {profitPct}%
            </Text>
          </View>
        </View>

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

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>{formatDate(item.close_date ?? item.open_date)}</Text>
          <Text style={styles.footerText}>{item.exit_reason ?? item.sell_reason ?? '-'}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
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
          <Text
            style={[
              styles.overviewValue,
              { color: totalPnl >= 0 ? Colors.dark.profit : Colors.dark.loss },
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
            tintColor={Colors.dark.primary}
            colors={[Colors.dark.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={48} color={Colors.dark.textMuted} />
            <Text style={styles.emptyCardText}>{t('暂无历史记录', 'No history')}</Text>
            <Text style={styles.emptyCardSubtext}>
              {t('完成的交易将在这里显示', 'Completed trades will appear here')}
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
    backgroundColor: Colors.dark.background,
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
  historyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  historyCardPressed: {
    backgroundColor: Colors.dark.surfaceLight,
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
