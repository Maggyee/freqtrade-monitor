import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { haptics } from '@/src/utils/haptics';
import { toDisplayProfitPercent } from '../../src/utils/profit';

type TabType = 'open' | 'history';
type EntrySide = 'long' | 'short';

const fallbackPairs = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT'];
const pairStakeHints: Record<string, { min: number; note?: { zh: string; en: string } }> = {
  'BTC/USDT:USDT': {
    min: 10,
    note: {
      zh: '若该币对已有持仓，将无法重复开仓。',
      en: 'You cannot open another position if this pair is already active.',
    },
  },
  'ETH/USDT:USDT': {
    min: 26,
    note: {
      zh: 'ETH 当前建议至少 26 USDT，10 USDT 往往会失败。',
      en: 'ETH currently needs about 26+ USDT. 10 USDT often fails.',
    },
  },
  'SOL/USDT:USDT': {
    min: 10,
    note: {
      zh: 'SOL 当前用 10 USDT 通常可以下单。',
      en: 'SOL usually works with 10 USDT in the current setup.',
    },
  },
};

export default function TradesScreen() {
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
    openTrades,
    tradeHistory,
    server,
    servers,
    whitelist,
    botState,
    refreshAll,
    forceExit,
    forceEntry,
  } = useBotStore();

  const [activeTab, setActiveTab] = useState<TabType>('open');
  const [closingTradeId, setClosingTradeId] = useState<number | null>(null);
  const [isEntryModalVisible, setEntryModalVisible] = useState(false);
  const [entryPair, setEntryPair] = useState('');
  const [entryStakeAmount, setEntryStakeAmount] = useState('');
  const [entrySide, setEntrySide] = useState<EntrySide>('long');
  const [isSubmittingEntry, setSubmittingEntry] = useState(false);

  const blockedPairs = useMemo(() => new Set(openTrades.map((trade) => trade.pair)), [openTrades]);
  const selectablePairs = useMemo(() => {
    const source = whitelist.length > 0 ? whitelist : fallbackPairs;
    return [...source].sort((a, b) => Number(blockedPairs.has(a)) - Number(blockedPairs.has(b)));
  }, [blockedPairs, whitelist]);
  const sortedTradeHistory = useMemo(() => {
    const toTs = (value?: string) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return [...tradeHistory].sort((a, b) => {
      const aTs = toTs(a.close_date ?? a.open_date);
      const bTs = toTs(b.close_date ?? b.open_date);
      return bTs - aTs;
    });
  }, [tradeHistory]);
  const hasSavedConnection = !!server || servers.length > 0;
  const defaultStakeAmount = 120;
  const selectedPairHint = entryPair ? pairStakeHints[entryPair] : undefined;
  const dynamicRuleText = useMemo(() => {
    if (!entryPair) {
      return language === 'en'
        ? `Leave it empty to use the bot default stake (${defaultStakeAmount} USDT). Choose a pair to see its current amount rule.`
        : `留空会使用机器人默认下单金额（当前 ${defaultStakeAmount} USDT）。选择币对后会显示该币对的金额规则。`;
    }

    const blocked = blockedPairs.has(entryPair);
    const minText =
      typeof selectedPairHint?.min === 'number'
        ? language === 'en'
          ? `Suggested minimum: ${selectedPairHint.min} USDT.`
          : `建议最小金额：${selectedPairHint.min} USDT。`
        : language === 'en'
          ? `Leave it empty to use the default ${defaultStakeAmount} USDT stake.`
          : `留空会使用默认 ${defaultStakeAmount} USDT 下单。`;

    const blockedText = blocked
      ? language === 'en'
        ? `${entryPair} already has an open position, so entry is blocked right now.`
        : `${entryPair} 当前已有持仓，暂时不能重复开仓。`
      : language === 'en'
        ? `Leave it empty to use the bot default stake (${defaultStakeAmount} USDT).`
        : `留空会使用机器人默认下单金额（当前 ${defaultStakeAmount} USDT）。`;

    const noteText = selectedPairHint?.note
      ? language === 'en'
        ? selectedPairHint.note.en
        : selectedPairHint.note.zh
      : language === 'en'
        ? 'If the amount is too small for the exchange minimum, the order will fail.'
        : '如果金额低于交易所最小下单要求，这笔单会失败。';

    return `${blockedText} ${minText} ${noteText}`;
  }, [blockedPairs, defaultStakeAmount, entryPair, language, selectedPairHint]);

  const onRefresh = useCallback(async () => {
    await refreshAll();
  }, [refreshAll]);

  const totalExposure = useMemo(
    () => openTrades.reduce((sum, trade) => sum + trade.stake_amount, 0),
    [openTrades],
  );
  const unrealizedPnl = useMemo(
    () => openTrades.reduce((sum, trade) => sum + trade.profit_abs, 0),
    [openTrades],
  );

  const formatDuration = (durationMinutes?: number) => {
    if (!durationMinutes) return '-';
    const totalMinutes = Math.max(0, Math.floor(durationMinutes));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return language === 'en' ? `${days}d ${hours % 24}h` : `${days}天 ${hours % 24}小时`;
    }
    if (hours > 0) {
      return language === 'en' ? `${hours}h ${minutes}m` : `${hours}小时 ${minutes}分钟`;
    }
    return language === 'en' ? `${minutes}m` : `${minutes}分钟`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  };

  const openEntryModal = () => {
    void haptics.selection();
    setEntryPair(selectablePairs.find((pair) => !blockedPairs.has(pair)) ?? selectablePairs[0] ?? '');
    setEntryStakeAmount('');
    setEntrySide('long');
    setEntryModalVisible(true);
  };

  const closeEntryModal = () => {
    if (isSubmittingEntry) return;
    void haptics.light();
    setEntryModalVisible(false);
  };

  const handleForceEntry = async () => {
    const normalizedPair = entryPair.trim().toUpperCase();
    const stakeText = entryStakeAmount.trim();
    const stakeAmount = stakeText ? Number(stakeText) : undefined;

    if (!normalizedPair) {
      Alert.alert(t('请选择币对', 'Select a pair'));
      return;
    }

    if (stakeText && (!Number.isFinite(stakeAmount) || (stakeAmount ?? 0) <= 0)) {
      Alert.alert(t('请输入有效的下单金额', 'Enter a valid stake amount'));
      return;
    }

    setSubmittingEntry(true);
    try {
      await haptics.medium();
      const success = await forceEntry(normalizedPair, entrySide, stakeAmount);
      if (!success) {
        await haptics.error();
        const latestError = useBotStore.getState().error;
        Alert.alert(
          t('开仓失败', 'Entry failed'),
          latestError ||
            t(
              '请检查该币对是否已有持仓，或查看后端返回原因。',
              'Check whether this pair already has an open position, or review the backend error.',
            ),
        );
        return;
      }

      setEntryModalVisible(false);
      await haptics.success();
      Alert.alert(
        t('模拟单已提交', 'Simulated entry sent'),
        language === 'en'
          ? `${normalizedPair} ${entrySide.toUpperCase()} submitted.`
          : `${normalizedPair} ${entrySide === 'long' ? '做多' : '做空'} 模拟单已提交。`,
      );
    } finally {
      setSubmittingEntry(false);
    }
  };

  const handleForceExit = (tradeId: number, pair: string) => {
    Alert.alert(
      t('确认平仓', 'Confirm Close'),
      language === 'en' ? `Close ${pair}?` : `确定要平仓 ${pair} 吗？`,
      [
        { text: t('取消', 'Cancel'), style: 'cancel' },
        {
          text: t('确认', 'Confirm'),
          style: 'destructive',
          onPress: async () => {
            await haptics.medium();
            setClosingTradeId(tradeId);
            try {
              const success = await forceExit(tradeId);
              if (success) {
                await haptics.success();
                Alert.alert(t('平仓成功', 'Closed'));
              } else {
                await haptics.error();
              }
            } finally {
              setClosingTradeId(null);
            }
          },
        },
      ],
    );
  };

  if (!isConnected) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyCenter}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="swap-horizontal" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: fs('lg') }]}>
            {hasSavedConnection ? t('正在恢复连接', 'Restoring connection') : t('请先连接 Bot', 'Connect bot first')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
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
        <View style={[styles.segmentContainer, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'open' && { backgroundColor: colors.surfaceLight }]}
            onPress={async () => {
              await haptics.selection();
              setActiveTab('open');
            }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'open' ? colors.text : colors.textMuted, fontSize: fs('sm') },
              ]}
            >
              {t('当前持仓', 'Open Positions')}
            </Text>
            <Text
              style={[
                styles.segmentCount,
                { color: activeTab === 'open' ? colors.primary : colors.textMuted, fontSize: fs('xs') },
              ]}
            >
              {openTrades.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'history' && { backgroundColor: colors.surfaceLight }]}
            onPress={async () => {
              await haptics.selection();
              setActiveTab('history');
            }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: activeTab === 'history' ? colors.text : colors.textMuted, fontSize: fs('sm') },
              ]}
            >
              {t('订单历史', 'Order History')}
            </Text>
            <Text
              style={[
                styles.segmentCount,
                { color: activeTab === 'history' ? colors.primary : colors.textMuted, fontSize: fs('xs') },
              ]}
            >
              {tradeHistory.length}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'open' && (
          <>
            <View style={[styles.entryCard, { backgroundColor: colors.surfaceHighlight, borderColor: colors.primaryDark }]}>
              <Text style={[styles.entryEyebrow, { color: colors.primaryLight, fontSize: fs('xs') }]}>
                {botState?.dry_run ? t('当前为模拟盘', 'Dry-run mode active') : t('当前为实盘', 'Live mode active')}
              </Text>
              <Text style={[styles.entryTitle, { color: colors.text, fontSize: fs('xl') }]}>
                {t('手动下单', 'Manual Entry')}
              </Text>
              <Text style={[styles.entrySubtitle, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                {t(
                  '币对直接读取当前白名单，选择方向和金额后即可提交模拟单。',
                  'Pairs are loaded from the current whitelist. Choose a side and amount, then submit a simulated order.',
                )}
              </Text>
              <TouchableOpacity style={[styles.entryButton, { backgroundColor: colors.primary }]} onPress={openEntryModal}>
                <Text style={[styles.entryButtonText, { fontSize: fs('sm') }]}>
                  {t('选择币对下单', 'Choose Pair')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                <Text style={[styles.statsLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
                  {t('总敞口', 'Exposure')}
                </Text>
                <Text style={[styles.statsValue, { color: colors.text, fontSize: fs('lg') }]}>
                  {totalExposure.toFixed(2)}
                </Text>
              </View>
              <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
                <Text style={[styles.statsLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
                  {t('未实现盈亏', 'Unrealized P&L')}
                </Text>
                <Text
                  style={[
                    styles.statsValue,
                    { color: unrealizedPnl >= 0 ? colors.profit : colors.loss, fontSize: fs('lg') },
                  ]}
                >
                  {unrealizedPnl >= 0 ? '+' : ''}
                  {unrealizedPnl.toFixed(2)}
                </Text>
              </View>
            </View>
          </>
        )}

        {activeTab === 'open' ? (
          openTrades.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Ionicons name="analytics-outline" size={44} color={colors.textMuted} />
              <Text style={[styles.emptyCardTitle, { color: colors.text, fontSize: fs('lg') }]}>
                {t('暂无活动交易', 'No open trades')}
              </Text>
              <Text style={[styles.emptyCardSubtitle, { color: colors.textMuted, fontSize: fs('sm') }]}>
                {t('机器人正在等待下一次入场信号。', 'The bot is waiting for the next entry signal.')}
              </Text>
            </View>
          ) : (
            openTrades.map((trade) => {
              const isProfit = trade.profit_pct >= 0;
              const profitPct = toDisplayProfitPercent(trade.profit_pct, trade.profit_ratio);
              const profitColor = isProfit ? colors.profit : colors.loss;
              const isClosing = closingTradeId === trade.trade_id;

              return (
                <View
                  key={trade.trade_id}
                  style={[styles.tradeCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                >
                  <View style={styles.tradeTop}>
                    <View>
                      <Text style={[styles.tradePair, { color: colors.text, fontSize: fs('md') }]}>
                        {trade.pair.replace(':', '/')}
                      </Text>
                      <View style={styles.tradeBadgeRow}>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: trade.is_short ? colors.lossBg : colors.profitBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: trade.is_short ? colors.loss : colors.profit, fontSize: fs('xs') },
                            ]}
                          >
                            {trade.is_short ? t('做空', 'Short') : t('做多', 'Long')}
                          </Text>
                        </View>
                        <Text style={[styles.leverageText, { color: colors.textMuted, fontSize: fs('xs') }]}>
                          {trade.leverage}x
                        </Text>
                      </View>
                    </View>
                    <View style={styles.tradeProfitWrap}>
                      <Text style={[styles.tradeProfitValue, { color: profitColor, fontSize: fs('lg') }]}>
                        {isProfit ? '+' : ''}
                        {trade.profit_abs.toFixed(2)}
                      </Text>
                      <Text style={[styles.tradeProfitPct, { color: profitColor, fontSize: fs('xs') }]}>
                        {isProfit ? '+' : ''}
                        {profitPct.toFixed(2)}%
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.metricsRow, { backgroundColor: colors.surfaceLight }]}>
                    <Text style={[styles.metricText, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                      {t('开仓价', 'Entry')}: {trade.open_rate.toFixed(2)}
                    </Text>
                    <Text style={[styles.metricText, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                      {t('当前价', 'Current')}: {trade.current_rate.toFixed(2)}
                    </Text>
                    <Text style={[styles.metricText, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                      {t('仓位', 'Stake')}: {trade.stake_amount.toFixed(2)}
                    </Text>
                    <Text style={[styles.metricText, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                      {t('持仓', 'Duration')}: {formatDuration(trade.trade_duration)}
                    </Text>
                  </View>

                  <View style={styles.tradeMetaRow}>
                    <Text style={[styles.tradeMetaText, { color: colors.textMuted, fontSize: fs('xs') }]}>
                      {formatDate(trade.open_date)}
                    </Text>
                    <View style={styles.tradeActions}>
                      <TouchableOpacity
                        style={[styles.secondaryButton, { borderColor: colors.surfaceBorder }]}
                        onPress={async () => {
                          await haptics.selection();
                          router.push(`/trade/${trade.trade_id}` as any);
                        }}
                      >
                        <Text style={[styles.secondaryButtonText, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                          {t('详情', 'Details')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryButton, { backgroundColor: colors.primary }, isClosing && styles.disabledButton]}
                        onPress={() => handleForceExit(trade.trade_id, trade.pair)}
                        disabled={isClosing}
                      >
                        <Text style={[styles.primaryButtonText, { fontSize: fs('sm') }]}>
                          {isClosing ? t('平仓中...', 'Closing...') : t('平仓', 'Close')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )
        ) : tradeHistory.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
            <Ionicons name="time-outline" size={44} color={colors.textMuted} />
            <Text style={[styles.emptyCardTitle, { color: colors.text, fontSize: fs('lg') }]}>
              {t('暂无历史记录', 'No trade history')}
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.historySummary, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
              <Text style={[styles.historySummaryText, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                {language === 'en' ? `${sortedTradeHistory.length} records` : `共 ${sortedTradeHistory.length} 条记录`}
              </Text>
            </View>
            {sortedTradeHistory.map((trade) => {
              const isProfit = (trade.profit_abs ?? 0) >= 0;
              const profitColor = isProfit ? colors.profit : colors.loss;
              const profitPct = toDisplayProfitPercent(trade.profit_pct, trade.profit_ratio);
              return (
                <Pressable
                  key={trade.trade_id}
                  style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}
                  onPress={async () => {
                    await haptics.selection();
                    router.push(`/trade/${trade.trade_id}` as any);
                  }}
                >
                  <View style={styles.historyHeader}>
                    <Text style={[styles.historyPair, { color: colors.text, fontSize: fs('md') }]}>
                      {trade.pair.replace(':', '/')}
                    </Text>
                    <View>
                      <Text style={[styles.historyProfit, { color: profitColor, fontSize: fs('md') }]}>
                        {isProfit ? '+' : ''}
                        {(trade.profit_abs ?? 0).toFixed(2)}
                      </Text>
                      <Text style={[styles.historyProfitPct, { color: profitColor, fontSize: fs('xs') }]}>
                        {isProfit ? '+' : ''}
                        {profitPct.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.historyMetaText, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                    {t('开仓', 'Open')}: {(trade.open_rate ?? 0).toFixed(4)}   {t('平仓', 'Close')}:{' '}
                    {(trade.close_rate ?? 0).toFixed(4)}
                  </Text>
                  <Text style={[styles.historyMetaText, { color: colors.textSecondary, fontSize: fs('sm') }]}>
                    {formatDate(trade.close_date ?? trade.open_date)}   {trade.exit_reason ?? trade.sell_reason ?? '-'}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={isEntryModalVisible} onRequestClose={closeEntryModal}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={closeEntryModal}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]} onPress={() => null}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle, { color: colors.text, fontSize: fs('lg') }]}>
                  {t('选择币对下单', 'Choose Pair')}
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted, fontSize: fs('sm') }]}>
                  {t('候选币对来自当前机器人的白名单。', 'Pairs come from the current bot whitelist.')}
                </Text>
              </View>
              <TouchableOpacity onPress={closeEntryModal} disabled={isSubmittingEntry}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.ruleCard, { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder }]}>
              <Text style={[styles.ruleTitle, { color: colors.text, fontSize: fs('sm') }]}>
                {t('金额规则', 'Amount Rules')}
              </Text>
              <Text style={[styles.ruleText, { color: colors.textSecondary, fontSize: fs('xs') }]}>
                {dynamicRuleText}
              </Text>
            </View>

            <View style={styles.sideSelector}>
              <TouchableOpacity
                style={[
                  styles.sideButton,
                  { borderColor: colors.surfaceBorder, backgroundColor: colors.surfaceLight },
                  entrySide === 'long' && { backgroundColor: colors.profitBg, borderColor: colors.profit },
                ]}
                onPress={async () => {
                  await haptics.selection();
                  setEntrySide('long');
                }}
              >
                <Text style={[styles.sideButtonText, { color: colors.text, fontSize: fs('sm') }]}>
                  {t('做多', 'Long')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sideButton,
                  { borderColor: colors.surfaceBorder, backgroundColor: colors.surfaceLight },
                  entrySide === 'short' && { backgroundColor: colors.lossBg, borderColor: colors.loss },
                ]}
                onPress={async () => {
                  await haptics.selection();
                  setEntrySide('short');
                }}
              >
                <Text style={[styles.sideButtonText, { color: colors.text, fontSize: fs('sm') }]}>
                  {t('做空', 'Short')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pairChipGrid}>
              {selectablePairs.map((pair) => {
                const selected = entryPair === pair;
                const blocked = blockedPairs.has(pair);
                return (
                  <TouchableOpacity
                    key={pair}
                    style={[
                      styles.pairChip,
                      { borderColor: colors.surfaceBorder, backgroundColor: colors.surfaceLight },
                      selected && { backgroundColor: colors.primaryBg, borderColor: colors.primary },
                    ]}
                    onPress={async () => {
                      await haptics.selection();
                      setEntryPair(pair);
                    }}
                  >
                    <Text
                      style={[
                        styles.pairChipText,
                        { color: selected ? colors.text : colors.textSecondary, fontSize: fs('sm') },
                      ]}
                    >
                      {pair}
                      {blocked ? ` ${language === 'en' ? '(Open)' : '（已开仓）'}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={entryStakeAmount}
              onChangeText={setEntryStakeAmount}
              keyboardType="decimal-pad"
              placeholder={
                language === 'en'
                  ? typeof defaultStakeAmount === 'number'
                    ? `Stake amount (optional, default ${defaultStakeAmount})`
                    : 'Stake amount (optional)'
                  : typeof defaultStakeAmount === 'number'
                    ? `下单金额（可选，默认 ${defaultStakeAmount}）`
                    : '下单金额（可选）'
              }
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder, color: colors.text, fontSize: fs('md') },
              ]}
            />

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }, (!entryPair || isSubmittingEntry) && styles.disabledButton]}
              onPress={handleForceEntry}
              disabled={!entryPair || isSubmittingEntry}
            >
              <Text style={[styles.submitButtonText, { fontSize: fs('md') }]}>
                {isSubmittingEntry ? t('提交中...', 'Submitting...') : t('提交模拟单', 'Submit Sim Order')}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 120 },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: 2,
    borderRadius: BorderRadius.md,
  },
  segmentText: { fontWeight: '700' },
  segmentCount: { fontFamily: 'SpaceMono' },
  entryCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  entryEyebrow: { fontWeight: '700' },
  entryTitle: { fontWeight: '800' },
  entrySubtitle: { lineHeight: 20 },
  entryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  entryButtonText: { color: '#FFF', fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statsCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  statsLabel: { marginBottom: 4 },
  statsValue: { fontWeight: '700', fontFamily: 'SpaceMono' },
  tradeCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  tradeTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  tradePair: { fontWeight: '700', marginBottom: 4 },
  tradeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm },
  badgeText: { fontWeight: '700' },
  leverageText: {},
  tradeProfitWrap: { alignItems: 'flex-end' },
  tradeProfitValue: { fontWeight: '700', fontFamily: 'SpaceMono' },
  tradeProfitPct: { fontFamily: 'SpaceMono', marginTop: 2 },
  metricsRow: {
    gap: 6,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  metricText: {},
  tradeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  tradeMetaText: {},
  tradeActions: { flexDirection: 'row', gap: Spacing.sm },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  secondaryButtonText: { fontWeight: '700' },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  primaryButtonText: { color: '#FFF', fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
  historySummary: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  historySummaryText: { fontWeight: '600' },
  historyCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  historyPair: { fontWeight: '700' },
  historyProfit: { fontWeight: '700', fontFamily: 'SpaceMono', textAlign: 'right' },
  historyProfitPct: { fontFamily: 'SpaceMono', textAlign: 'right' },
  historyMetaText: {},
  emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontWeight: '600' },
  emptyCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyCardTitle: { fontWeight: '700', marginTop: Spacing.md },
  emptyCardSubtitle: { textAlign: 'center', marginTop: Spacing.xs },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  modalHeaderText: { flex: 1 },
  modalTitle: { fontWeight: '800' },
  modalSubtitle: { marginTop: 4, lineHeight: 20 },
  ruleCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: 6,
  },
  ruleTitle: { fontWeight: '700' },
  ruleText: { lineHeight: 18 },
  sideSelector: { flexDirection: 'row', gap: Spacing.sm },
  sideButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  sideButtonText: { fontWeight: '700' },
  pairChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pairChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pairChipText: { fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  submitButtonText: { color: '#FFF', fontWeight: '800' },
});
