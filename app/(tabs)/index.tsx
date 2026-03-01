// 仪表盘首页 - 基于 Stitch 设计稿优化
// 顶部：总资产 + 24h P&L
// 中部：Bot Status 卡片 + 柱状图 + 快捷控制按钮
// 底部：Active Pairs 列表

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';
import { toDisplayProfitPercent } from '../../src/utils/profit';
import { useI18nStore } from '@/src/stores/useI18nStore';

export default function DashboardScreen() {
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
  const t = (zh: string, en: string) => (language === 'en' ? en : zh);
  const {
    isConnected,
    isLoading,
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

  // 下拉刷新
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
  }, [isStartingBot, isStoppingBot, botState?.state, startBot]);

  const handleStopBot = useCallback(async () => {
    if (isStartingBot || isStoppingBot || botState?.state !== 'running') return;
    setIsStoppingBot(true);
    try {
      await stopBot();
    } finally {
      setIsStoppingBot(false);
    }
  }, [isStartingBot, isStoppingBot, botState?.state, stopBot]);

  // === 未连接状态 - 显示登录引导 ===
  if (!isConnected) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          {/* 装饰性图标 */}
          <View style={styles.emptyIconWrap}>
            <Ionicons name="analytics" size={48} color={Colors.dark.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t('欢迎使用 Freqtrade', 'Welcome to Freqtrade')}</Text>
          <Text style={styles.emptySubtitle}>{t('连接你的机器人开始监控交易', 'Connect your bot to start monitoring')}</Text>
          <TouchableOpacity
            style={styles.connectButton}
            onPress={() => router.push('/login')}
            activeOpacity={0.8}
          >
            <Ionicons name="link" size={18} color="#FFF" />
            <Text style={styles.connectButtonText}>{t('连接机器人', 'Connect Bot')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // === 已连接 - 显示仪表盘 ===
  const todayProfit = dailyProfit?.data?.[0];
  const totalBalance = balance?.total ?? 0;
  const stakeCurrency = balance?.stake ?? 'USDT';
  const totalProfitPct = profit?.profit_all_percent ?? 0;
  const totalProfitAbs = profit?.profit_all_coin ?? 0;
  const isProfitable = totalProfitAbs >= 0;

  // 今日 P&L
  const todayPnlAbs = todayProfit?.abs_profit ?? 0;
  const todayPnlPct = (todayProfit?.rel_profit ?? 0) * 100;
  const isTodayProfit = todayPnlAbs >= 0;

  // 近 7 天日利润数据（用于柱状图）
  const last7Days = dailyProfit?.data?.slice(0, 7).reverse() ?? [];
  const maxAbsProfit = Math.max(...last7Days.map(d => Math.abs(d.abs_profit)), 1);

  const formatConfigPercent = (value?: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
    const display = Math.abs(value) <= 1 ? value * 100 : value;
    return `${display.toFixed(2)}%`;
  };

  const roiSummary = (() => {
    const roi = botState?.minimal_roi;
    if (!roi || Object.keys(roi).length === 0) return '-';
    const entries = Object.entries(roi)
      .map(([minute, rate]) => ({ minute: Number(minute), rate }))
      .filter((entry) => Number.isFinite(entry.minute))
      .sort((a, b) => a.minute - b.minute);
    if (!entries.length) return '-';
    const first = entries[0];
    const last = entries[entries.length - 1];
    return `${first.minute}m:${(first.rate * 100).toFixed(2)}% ~ ${last.minute}m:${(last.rate * 100).toFixed(2)}%`;
  })();

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
      {/* 错误提示 */}
      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color={Colors.dark.warning} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* === 总资产区域 === */}
      <View style={styles.portfolioSection}>
        <Text style={styles.portfolioLabel}>{t('总资产估值', 'TOTAL PORTFOLIO VALUE')}</Text>
        <Text style={styles.portfolioValue}>
          {totalBalance.toFixed(2)}
          <Text style={styles.portfolioCurrency}> {stakeCurrency}</Text>
        </Text>
        {/* 24h P&L 指示器 */}
        <View style={styles.pnlRow}>
          <Ionicons
            name={isTodayProfit ? 'trending-up' : 'trending-down'}
            size={14}
            color={isTodayProfit ? Colors.dark.profit : Colors.dark.loss}
          />
          <Text style={[
            styles.pnlText,
            { color: isTodayProfit ? Colors.dark.profit : Colors.dark.loss }
          ]}>
            {isTodayProfit ? '+' : ''}{todayPnlAbs.toFixed(2)} ({isTodayProfit ? '+' : ''}{todayPnlPct.toFixed(1)}%)
          </Text>
          <Text style={styles.pnlLabel}>{t('24 小时盈亏', '24h P&L')}</Text>
        </View>
      </View>

      {/* === Bot Status 卡片 + 柱状图 === */}
      <View style={styles.botStatusCard}>
        <View style={styles.botStatusHeader}>
          <View>
            <Text style={styles.botStatusLabel}>{t('机器人状态', 'Bot Status')}</Text>
            <View style={styles.botStatusRow}>
              <View style={[
                styles.statusDot,
                { backgroundColor: botState?.state === 'running' ? Colors.dark.profit : Colors.dark.loss }
              ]} />
              <Text style={[
                styles.botStatusText,
                { color: botState?.state === 'running' ? Colors.dark.text : Colors.dark.loss }
              ]}>
                {botState?.state === 'running' ? t('运行中', 'Running') : t('已停止', 'Stopped')}
              </Text>
            </View>
          </View>
          <View style={styles.quickPnl}>
            <Text style={styles.quickPnlLabel}>{t('累计收益', 'Total P&L')}</Text>
            <Text style={[
              styles.quickPnlValue,
              { color: isProfitable ? Colors.dark.profit : Colors.dark.loss }
            ]}>
              {isProfitable ? '+' : ''}{totalProfitPct.toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* 迷你柱状图 - 最近 7 天日利润 */}
        <View style={styles.miniChart}>
          {last7Days.map((day, index) => {
            const isPositive = day.abs_profit >= 0;
            const barHeight = Math.max((Math.abs(day.abs_profit) / maxAbsProfit) * 60, 4);
            return (
              <View key={index} style={styles.barContainer}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: barHeight,
                      backgroundColor: isPositive
                        ? Colors.dark.primary
                        : `${Colors.dark.primary}66`,
                    },
                  ]}
                />
              </View>
            );
          })}
          {/* 如果数据不满 7 天，用占位补齐 */}
          {Array.from({ length: Math.max(0, 7 - last7Days.length) }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.barContainer}>
              <View style={[styles.bar, { height: 4, backgroundColor: Colors.dark.surfaceHighlight }]} />
            </View>
          ))}
        </View>
      </View>

      {/* === 当前策略信息 === */}
      <View style={styles.strategyCard}>
        <View style={styles.strategyHeader}>
          <Ionicons name="layers-outline" size={16} color={Colors.dark.primary} />
          <Text style={styles.strategyTitle}>{t('当前策略信息', 'Current Strategy')}</Text>
        </View>
        <View style={styles.strategyGrid}>
          <View style={styles.strategyItem}>
            <Text style={styles.strategyLabel}>{t('策略名称', 'Strategy')}</Text>
            <Text style={styles.strategyValue}>{botState?.strategy || '-'}</Text>
          </View>
          <View style={styles.strategyItem}>
            <Text style={styles.strategyLabel}>{t('交易周期', 'Timeframe')}</Text>
            <Text style={styles.strategyValue}>{botState?.timeframe || '-'}</Text>
          </View>
          <View style={styles.strategyItem}>
            <Text style={styles.strategyLabel}>{t('交易所', 'Exchange')}</Text>
            <Text style={styles.strategyValue}>{botState?.exchange || '-'}</Text>
          </View>
          <View style={styles.strategyItem}>
            <Text style={styles.strategyLabel}>{t('运行模式', 'Runmode')}</Text>
            <Text style={styles.strategyValue}>{botState?.runmode || botState?.trading_mode || '-'}</Text>
          </View>
          <View style={styles.strategyItem}>
            <Text style={styles.strategyLabel}>{t('计价币种', 'Stake Currency')}</Text>
            <Text style={styles.strategyValue}>{botState?.stake_currency || '-'}</Text>
          </View>
          <View style={styles.strategyItem}>
            <Text style={styles.strategyLabel}>{t('最大持仓', 'Max Open Trades')}</Text>
            <Text style={styles.strategyValue}>
              {typeof botState?.max_open_trades === 'number' ? String(botState.max_open_trades) : '-'}
            </Text>
          </View>
          <View style={styles.strategyItem}>
            <Text style={styles.strategyLabel}>{t('止损阈值', 'Stoploss')}</Text>
            <Text style={styles.strategyValue}>{formatConfigPercent(botState?.stoploss)}</Text>
          </View>
          <View style={styles.strategyItem}>
            <Text style={styles.strategyLabel}>{t('移动止损', 'Trailing Stop')}</Text>
            <Text style={styles.strategyValue}>
              {botState?.trailing_stop
                ? `${t('开启', 'On')} (${formatConfigPercent(botState.trailing_stop_positive)})`
                : t('关闭', 'Off')}
            </Text>
          </View>
          <View style={styles.strategyItemFull}>
            <Text style={styles.strategyLabel}>{t('ROI 目标', 'ROI Target')}</Text>
            <Text style={styles.strategyValue}>{roiSummary}</Text>
          </View>
          <View style={styles.strategyItemFull}>
            <Text style={styles.strategyLabel}>{t('实盘/模拟', 'Mode')}</Text>
            <Text style={styles.strategyValue}>
              {typeof botState?.dry_run === 'boolean' ? (botState.dry_run ? t('模拟交易', 'Dry Run') : t('实盘交易', 'Live')) : '-'}
            </Text>
          </View>
        </View>
      </View>

      {/* === 快捷控制按钮 === */}
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[
            styles.controlBtn,
            botState?.state === 'running' && styles.controlBtnActive,
            (isStartingBot || isStoppingBot || botState?.state === 'running') && styles.controlBtnDisabled,
          ]}
          onPress={handleStartBot}
          disabled={isStartingBot || isStoppingBot || botState?.state === 'running'}
          activeOpacity={0.7}
        >
          {isStartingBot ? (
            <ActivityIndicator size="small" color={Colors.dark.primary} />
          ) : (
            <Ionicons
              name="play"
              size={18}
              color={botState?.state === 'running' ? Colors.dark.primary : Colors.dark.textSecondary}
            />
          )}
          <Text style={[
            styles.controlBtnText,
            botState?.state === 'running' && styles.controlBtnTextActive,
          ]}>
            {isStartingBot ? t('启动中...', 'Starting...') : t('启动', 'Start')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlBtn,
            botState?.state === 'stopped' && styles.controlBtnDanger,
            (isStartingBot || isStoppingBot || botState?.state !== 'running') && styles.controlBtnDisabled,
          ]}
          onPress={handleStopBot}
          disabled={isStartingBot || isStoppingBot || botState?.state !== 'running'}
          activeOpacity={0.7}
        >
          {isStoppingBot ? (
            <ActivityIndicator size="small" color={Colors.dark.loss} />
          ) : (
            <Ionicons
              name="stop"
              size={18}
              color={botState?.state === 'stopped' ? Colors.dark.loss : Colors.dark.textSecondary}
            />
          )}
          <Text style={[
            styles.controlBtnText,
            botState?.state === 'stopped' && { color: Colors.dark.loss },
          ]}>
            {isStoppingBot ? t('停止中...', 'Stopping...') : t('停止', 'Stop')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isLoading && styles.controlBtnDisabled]}
          onPress={() => refreshAll()}
          disabled={isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.dark.textSecondary} />
          ) : (
            <Ionicons name="refresh" size={18} color={Colors.dark.textSecondary} />
          )}
          <Text style={styles.controlBtnText}>{isLoading ? t('刷新中...', 'Refreshing...') : t('刷新', 'Refresh')}</Text>
        </TouchableOpacity>
      </View>

      {/* === 交易统计 === */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profit?.trade_count ?? 0}</Text>
          <Text style={styles.statLabel}>{t('总交易', 'Trades')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.dark.profit }]}>
            {profit?.winning_trades ?? 0}
          </Text>
          <Text style={styles.statLabel}>{t('盈利', 'Wins')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: Colors.dark.loss }]}>
            {profit?.losing_trades ?? 0}
          </Text>
          <Text style={styles.statLabel}>{t('亏损', 'Losses')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {profit?.profit_factor?.toFixed(2) ?? '-'}
          </Text>
          <Text style={styles.statLabel}>{t('盈亏比', 'Profit Factor')}</Text>
        </View>
      </View>

      {/* === Active Pairs 列表 === */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {t('活跃交易对', 'Active Pairs')}
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/trades')}
          style={({ pressed }) => pressed && styles.sectionLinkPressed}
        >
          <Text style={styles.sectionLink}>{t('查看全部', 'View All')}</Text>
        </Pressable>
      </View>

      {openTrades.length === 0 ? (
        <View style={styles.emptyTrades}>
          <Ionicons name="analytics-outline" size={32} color={Colors.dark.textMuted} />
          <Text style={styles.emptyTradesText}>{t('暂无活跃交易', 'No open trades')}</Text>
        </View>
      ) : (
        openTrades.slice(0, 5).map((trade) => {
          const isProfit = trade.profit_pct >= 0;
          const profitColor = isProfit ? Colors.dark.profit : Colors.dark.loss;
          const profitPct = toDisplayProfitPercent(trade.profit_pct, trade.profit_ratio);
          // 取交易对首字母
          const pairName = trade.pair.replace(':', '/').replace('/USDT', '');
          const initial = pairName.charAt(0).toUpperCase();

          return (
            <Pressable
              key={trade.trade_id}
              style={({ pressed }) => [
                styles.pairCard,
                pressed && styles.pairCardPressed,
              ]}
              onPress={() => router.push(`/trade/${trade.trade_id}` as any)}
            >
              {/* 币种图标 - 使用首字母 */}
              <View style={[styles.pairIcon, { borderColor: profitColor }]}>
                <Text style={[styles.pairIconText, { color: profitColor }]}>
                  {initial}
                </Text>
              </View>

              {/* 交易对名称和方向 */}
              <View style={styles.pairInfo}>
                <Text style={styles.pairName}>
                  {trade.pair.replace(':', ' / ')}
                </Text>
                <Text style={styles.pairMeta}>
                  {trade.is_short ? t('做空', 'Short') : t('做多', 'Long')} · {trade.leverage > 1 ? `${trade.leverage}x ${t('杠杆', 'Leverage')}` : `1.0x ${t('杠杆', 'Leverage')}`}
                </Text>
              </View>

              {/* 盈亏 */}
              <View style={styles.pairProfit}>
                <Text style={[styles.pairProfitPct, { color: profitColor }]}>
                  {isProfit ? '+' : ''}{profitPct.toFixed(2)}%
                </Text>
                <Text style={[styles.pairProfitAbs, { color: profitColor }]}>
                  {isProfit ? '+' : ''}{trade.profit_abs.toFixed(2)}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}

      {/* 底部留白 */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// === 样式表 - 匹配 Stitch 设计 ===
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: Spacing.lg,
  },

  // 错误提示
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 0, 0.2)',
  },
  errorText: {
    color: Colors.dark.warning,
    fontSize: FontSize.sm,
    flex: 1,
  },

  // === 总资产区域 ===
  portfolioSection: {
    marginBottom: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  portfolioLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  portfolioValue: {
    color: Colors.dark.text,
    fontSize: FontSize.hero,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
    letterSpacing: -0.5,
  },
  portfolioCurrency: {
    fontSize: FontSize.lg,
    color: Colors.dark.textSecondary,
    fontWeight: '400',
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  pnlText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },
  pnlLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.sm,
    marginLeft: Spacing.xs,
  },

  // === Bot Status 卡片 ===
  botStatusCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  botStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  botStatusLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  botStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  botStatusText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  quickPnl: {
    alignItems: 'flex-end',
  },
  quickPnlLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  quickPnlValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },

  // === 当前策略信息 ===
  strategyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  strategyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  strategyTitle: {
    color: Colors.dark.text,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  strategyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.md,
  },
  strategyItem: {
    width: '50%',
    paddingRight: Spacing.md,
  },
  strategyItemFull: {
    width: '100%',
  },
  strategyLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    marginBottom: 2,
  },
  strategyValue: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    fontFamily: 'SpaceMono',
  },

  // === 迷你柱状图 ===
  miniChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 60,
    gap: 6,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  bar: {
    width: '80%',
    borderRadius: 3,
    minHeight: 4,
  },

  // === 快捷控制按钮 ===
  controlRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    gap: Spacing.xs,
  },
  controlBtnActive: {
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryBg,
  },
  controlBtnDanger: {
    borderColor: Colors.dark.loss,
    backgroundColor: Colors.dark.lossBg,
  },
  controlBtnDisabled: {
    opacity: 0.6,
  },
  controlBtnText: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  controlBtnTextActive: {
    color: Colors.dark.primary,
  },

  // === 统计行 ===
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: Colors.dark.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  statLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    height: 30,
    backgroundColor: Colors.dark.surfaceBorder,
  },

  // === Section Header ===
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  sectionLink: {
    color: Colors.dark.primary,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  sectionLinkPressed: {
    opacity: 0.65,
  },

  // === Active Pairs 卡片 ===
  pairCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    gap: Spacing.md,
  },
  pairCardPressed: {
    backgroundColor: Colors.dark.surfaceLight,
    borderColor: Colors.dark.primary,
  },
  pairIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pairIconText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  pairInfo: {
    flex: 1,
  },
  pairName: {
    color: Colors.dark.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: 2,
  },
  pairMeta: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
  },
  pairProfit: {
    alignItems: 'flex-end',
  },
  pairProfitPct: {
    fontSize: FontSize.md,
    fontWeight: '700',
    fontFamily: 'SpaceMono',
  },
  pairProfitAbs: {
    fontSize: FontSize.xs,
    fontFamily: 'SpaceMono',
    marginTop: 2,
  },

  // === 空状态 ===
  emptyTrades: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    gap: Spacing.sm,
  },
  emptyTradesText: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.md,
  },

  // === 未连接空状态 ===
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  connectButtonText: {
    color: '#FFF',
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
});
