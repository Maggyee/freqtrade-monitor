import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
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
import { toDisplayProfitPercent } from '../../src/utils/profit';

export default function DashboardScreen() {
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const colors = getThemeColors(themeMode);
  const fs = (size: keyof typeof FontSize | number) => getScaledFontSize(size, fontScale);
  const t = (zh: string, en: string) => (language === 'en' ? en : zh);
  const {
    isConnected,
    isLoading,
    server,
    servers,
    botState,
    balance,
    openTrades,
    profit,
    dailyProfit,
    refreshAll,
    startBot,
    stopBot,
    error,
  } = useBotStore();
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [isStoppingBot, setIsStoppingBot] = useState(false);
  const hasSavedConnection = !!server || servers.length > 0;

  const onRefresh = useCallback(async () => {
    await refreshAll();
  }, [refreshAll]);

  const handleStartBot = useCallback(async () => {
    if (isStartingBot || isStoppingBot || botState?.state === 'running') return;
    setIsStartingBot(true);
    try {
      await startBot();
    } finally {
      setIsStartingBot(false);
    }
  }, [botState?.state, isStartingBot, isStoppingBot, startBot]);

  const handleStopBot = useCallback(async () => {
    if (isStartingBot || isStoppingBot || botState?.state !== 'running') return;
    setIsStoppingBot(true);
    try {
      await stopBot();
    } finally {
      setIsStoppingBot(false);
    }
  }, [botState?.state, isStartingBot, isStoppingBot, stopBot]);

  if (!isConnected) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: colors.primaryBg }]}>
          <Ionicons name="analytics" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text, fontSize: fs('xxl') }]}>
          {hasSavedConnection ? t('正在恢复连接', 'Restoring connection') : t('欢迎使用 Freqtrade', 'Welcome to Freqtrade')}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary, fontSize: fs('md') }]}>
          {hasSavedConnection
            ? t('检测到已保存的连接，正在自动重连。', 'A saved bot was found and is reconnecting automatically.')
            : t('先连接你的机器人，再查看资产和交易状态。', 'Connect your bot to see balances and trades.')}
        </Text>
        {hasSavedConnection ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <TouchableOpacity
            style={[styles.connectButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Ionicons name="link" size={18} color="#FFF" />
            <Text style={[styles.connectButtonText, { fontSize: fs('lg') }]}>{t('连接机器人', 'Connect Bot')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const todayProfit = dailyProfit?.data?.[0];
  const totalBalance = balance?.total ?? 0;
  const stakeCurrency = balance?.stake ?? 'USDT';
  const totalProfitPct = profit?.profit_all_percent ?? 0;
  const totalProfitAbs = profit?.profit_all_coin ?? 0;
  const todayPnlAbs = todayProfit?.abs_profit ?? 0;
  const todayPnlPct = (todayProfit?.rel_profit ?? 0) * 100;
  const isProfitable = totalProfitAbs >= 0;
  const isTodayProfit = todayPnlAbs >= 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {error ? (
        <View style={[styles.errorBanner, { borderColor: `${colors.warning}33`, backgroundColor: `${colors.warning}12` }]}>
          <Ionicons name="alert-circle" size={16} color={colors.warning} />
          <Text style={[styles.errorText, { color: colors.warning, fontSize: fs('sm') }]}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.heroSection}>
        <Text style={[styles.heroLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
          {t('总资产估值', 'TOTAL PORTFOLIO VALUE')}
        </Text>
        <Text style={[styles.heroValue, { color: colors.text, fontSize: fs('hero') }]}>
          {totalBalance.toFixed(2)}
          <Text style={[styles.heroCurrency, { color: colors.textSecondary, fontSize: fs('lg') }]}> {stakeCurrency}</Text>
        </Text>
        <View style={styles.pnlRow}>
          <Ionicons
            name={isTodayProfit ? 'trending-up' : 'trending-down'}
            size={14}
            color={isTodayProfit ? colors.profit : colors.loss}
          />
          <Text style={[styles.pnlText, { color: isTodayProfit ? colors.profit : colors.loss, fontSize: fs('sm') }]}>
            {isTodayProfit ? '+' : ''}
            {todayPnlAbs.toFixed(2)} ({isTodayProfit ? '+' : ''}
            {todayPnlPct.toFixed(1)}%)
          </Text>
          <Text style={[styles.pnlLabel, { color: colors.textMuted, fontSize: fs('sm') }]}>
            {t('24 小时盈亏', '24h P&L')}
          </Text>
        </View>
      </View>

      <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.statusHeader}>
          <View>
            <Text style={[styles.cardLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
              {t('机器人状态', 'Bot Status')}
            </Text>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: botState?.state === 'running' ? colors.profit : colors.loss },
                ]}
              />
              <Text style={[styles.statusText, { color: colors.text, fontSize: fs('md') }]}>
                {botState?.state === 'running' ? t('运行中', 'Running') : t('已停止', 'Stopped')}
              </Text>
            </View>
          </View>
          <View style={styles.statusProfitBox}>
            <Text style={[styles.cardLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
              {t('累计收益', 'Total P&L')}
            </Text>
            <Text
              style={[
                styles.statusProfit,
                { color: isProfitable ? colors.profit : colors.loss, fontSize: fs('xl') },
              ]}
            >
              {isProfitable ? '+' : ''}
              {totalProfitPct.toFixed(1)}%
            </Text>
          </View>
        </View>

        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder },
              botState?.state === 'running' && { borderColor: colors.primary, backgroundColor: colors.primaryBg },
            ]}
            onPress={handleStartBot}
            disabled={isStartingBot || isStoppingBot || botState?.state === 'running'}
          >
            {isStartingBot ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons
                name="play"
                size={18}
                color={botState?.state === 'running' ? colors.primary : colors.textSecondary}
              />
            )}
            <Text
              style={[
                styles.controlButtonText,
                {
                  color: botState?.state === 'running' ? colors.primary : colors.textSecondary,
                  fontSize: fs('xs'),
                },
              ]}
            >
              {isStartingBot ? t('启动中...', 'Starting...') : t('启动', 'Start')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder },
              botState?.state !== 'running' && { opacity: 0.6 },
            ]}
            onPress={handleStopBot}
            disabled={isStartingBot || isStoppingBot || botState?.state !== 'running'}
          >
            {isStoppingBot ? (
              <ActivityIndicator color={colors.loss} size="small" />
            ) : (
              <Ionicons name="stop" size={18} color={colors.loss} />
            )}
            <Text style={[styles.controlButtonText, { color: colors.loss, fontSize: fs('xs') }]}>
              {isStoppingBot ? t('停止中...', 'Stopping...') : t('停止', 'Stop')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder }]}
            onPress={() => refreshAll()}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Ionicons name="refresh" size={18} color={colors.textSecondary} />
            )}
            <Text style={[styles.controlButtonText, { color: colors.textSecondary, fontSize: fs('xs') }]}>
              {isLoading ? t('刷新中...', 'Refreshing...') : t('刷新', 'Refresh')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fs('xl') }]}>{profit?.trade_count ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('总交易', 'Trades')}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.surfaceBorder }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.profit, fontSize: fs('xl') }]}>{profit?.winning_trades ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('盈利', 'Wins')}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.surfaceBorder }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.loss, fontSize: fs('xl') }]}>{profit?.losing_trades ?? 0}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('亏损', 'Losses')}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.surfaceBorder }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.text, fontSize: fs('xl') }]}>
            {profit?.profit_factor?.toFixed(2) ?? '-'}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
            {t('盈亏比', 'Profit Factor')}
          </Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.text, fontSize: fs('lg') }]}>
          {t('活跃交易对', 'Active Pairs')}
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/trades')} style={({ pressed }) => pressed && { opacity: 0.7 }}>
          <Text style={[styles.sectionLink, { color: colors.primary, fontSize: fs('sm') }]}>
            {t('查看全部', 'View All')}
          </Text>
        </Pressable>
      </View>

      {openTrades.length === 0 ? (
        <View style={[styles.emptyTrades, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <Ionicons name="analytics-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyTradesText, { color: colors.textMuted, fontSize: fs('md') }]}>
            {t('暂无活跃交易', 'No open trades')}
          </Text>
        </View>
      ) : (
        openTrades.slice(0, 5).map((trade) => {
          const isProfit = trade.profit_pct >= 0;
          const profitColor = isProfit ? colors.profit : colors.loss;
          const profitPct = toDisplayProfitPercent(trade.profit_pct, trade.profit_ratio);
          const pairName = trade.pair.replace(':', '/').replace('/USDT', '');
          const initial = pairName.charAt(0).toUpperCase();

          return (
            <Pressable
              key={trade.trade_id}
              style={({ pressed }) => [
                styles.pairCard,
                {
                  backgroundColor: pressed ? colors.surfaceLight : colors.surface,
                  borderColor: pressed ? colors.primary : colors.surfaceBorder,
                },
              ]}
              onPress={() => router.push(`/trade/${trade.trade_id}` as any)}
            >
              <View style={[styles.pairIcon, { borderColor: profitColor, backgroundColor: colors.surfaceLight }]}>
                <Text style={[styles.pairIconText, { color: profitColor, fontSize: fs('md') }]}>{initial}</Text>
              </View>

              <View style={styles.pairInfo}>
                <Text style={[styles.pairName, { color: colors.text, fontSize: fs('md') }]}>
                  {trade.pair.replace(':', ' / ')}
                </Text>
                <Text style={[styles.pairMeta, { color: colors.textMuted, fontSize: fs('xs') }]}>
                  {trade.is_short ? t('做空', 'Short') : t('做多', 'Long')} · {trade.leverage}x{' '}
                  {t('杠杆', 'Leverage')}
                </Text>
              </View>

              <View style={styles.pairProfit}>
                <Text style={[styles.pairProfitPct, { color: profitColor, fontSize: fs('md') }]}>
                  {isProfit ? '+' : ''}
                  {profitPct.toFixed(2)}%
                </Text>
                <Text style={[styles.pairProfitAbs, { color: profitColor, fontSize: fs('xs') }]}>
                  {isProfit ? '+' : ''}
                  {trade.profit_abs.toFixed(2)}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
  },
  heroSection: {
    marginBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  heroLabel: {
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  heroValue: {
    fontWeight: '700',
    fontFamily: 'SpaceMono',
    letterSpacing: -0.5,
  },
  heroCurrency: {
    fontWeight: '400',
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  pnlText: {
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  pnlLabel: {
    marginLeft: Spacing.xs,
  },
  statusCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  cardLabel: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontWeight: '700',
  },
  statusProfitBox: {
    alignItems: 'flex-end',
  },
  statusProfit: {
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  controlRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  controlButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  controlButtonText: {
    fontWeight: '600',
  },
  statsCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  statLabel: {
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    height: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionLink: {
    fontWeight: '500',
  },
  emptyTrades: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    gap: Spacing.sm,
  },
  emptyTradesText: {},
  pairCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    gap: Spacing.md,
  },
  pairIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairIconText: {
    fontWeight: '700',
  },
  pairInfo: {
    flex: 1,
  },
  pairName: {
    fontWeight: '600',
    marginBottom: 2,
  },
  pairMeta: {},
  pairProfit: {
    alignItems: 'flex-end',
  },
  pairProfitPct: {
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  pairProfitAbs: {
    fontFamily: 'SpaceMono',
    marginTop: 2,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontWeight: '700',
  },
  emptySubtitle: {
    textAlign: 'center',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  connectButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});
