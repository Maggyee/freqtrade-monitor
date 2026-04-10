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

import { BorderRadius, Colors, FontSize, Spacing } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';
import { toDisplayProfitPercent } from '../../src/utils/profit';

type TabType = 'open' | 'history';
type EntrySide = 'long' | 'short';

const fallbackPairs = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'SOL/USDT:USDT'];

export default function TradesScreen() {
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
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
  const hasSavedConnection = !!server || servers.length > 0;

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
    setEntryPair(selectablePairs.find((pair) => !blockedPairs.has(pair)) ?? selectablePairs[0] ?? '');
    setEntryStakeAmount('');
    setEntrySide('long');
    setEntryModalVisible(true);
  };

  const closeEntryModal = () => {
    if (isSubmittingEntry) return;
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
      const success = await forceEntry(normalizedPair, entrySide, stakeAmount);
      if (!success) {
        const latestError = useBotStore.getState().error;
        Alert.alert(
          t('开仓失败', 'Entry failed'),
          latestError || t('请检查该币对是否已有持仓，或查看后端返回原因。', 'Check whether this pair already has an open position, or review the backend error.'),
        );
        return;
      }

      setEntryModalVisible(false);
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
            setClosingTradeId(tradeId);
            try {
              const success = await forceExit(tradeId);
              if (success) {
                Alert.alert(t('平仓成功', 'Closed'));
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
      <View style={styles.container}>
        <View style={styles.emptyCenter}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="swap-horizontal" size={36} color={Colors.dark.primary} />
          </View>
          <Text style={styles.emptyText}>
            {hasSavedConnection ? t('正在恢复连接', 'Restoring connection') : t('请先连接 Bot', 'Connect bot first')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <>
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
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'open' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('open')}
          >
            <Text style={[styles.segmentText, activeTab === 'open' && styles.segmentTextActive]}>
              {t('当前持仓', 'Open Positions')}
            </Text>
            <Text style={[styles.segmentCount, activeTab === 'open' && styles.segmentCountActive]}>
              {openTrades.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, activeTab === 'history' && styles.segmentBtnActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.segmentText, activeTab === 'history' && styles.segmentTextActive]}>
              {t('订单历史', 'Order History')}
            </Text>
            <Text style={[styles.segmentCount, activeTab === 'history' && styles.segmentCountActive]}>
              {tradeHistory.length}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'open' && (
          <>
            <View style={styles.entryCard}>
              <Text style={styles.entryEyebrow}>
                {botState?.dry_run ? t('当前为模拟盘', 'Dry-run mode active') : t('当前为实盘', 'Live mode active')}
              </Text>
              <Text style={styles.entryTitle}>{t('手动下单', 'Manual Entry')}</Text>
              <Text style={styles.entrySubtitle}>
                {t(
                  '币对会直接读取当前白名单。点击后选择方向和金额即可提交模拟单。',
                  'Pairs are loaded from the current whitelist. Choose a side and amount, then submit a simulated order.',
                )}
              </Text>
              <TouchableOpacity style={styles.entryButton} onPress={openEntryModal}>
                <Text style={styles.entryButtonText}>{t('选择币对下单', 'Choose Pair')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statsCard}>
                <Text style={styles.statsLabel}>{t('总敞口', 'Exposure')}</Text>
                <Text style={styles.statsValue}>{totalExposure.toFixed(2)}</Text>
              </View>
              <View style={styles.statsCard}>
                <Text style={styles.statsLabel}>{t('未实现盈亏', 'Unrealized P&L')}</Text>
                <Text
                  style={[
                    styles.statsValue,
                    { color: unrealizedPnl >= 0 ? Colors.dark.profit : Colors.dark.loss },
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
            <View style={styles.emptyCard}>
              <Ionicons name="analytics-outline" size={44} color={Colors.dark.textMuted} />
              <Text style={styles.emptyCardTitle}>{t('暂无活动交易', 'No open trades')}</Text>
              <Text style={styles.emptyCardSubtitle}>
                {t('机器人正在等待下一次入场信号。', 'The bot is waiting for the next entry signal.')}
              </Text>
            </View>
          ) : (
            openTrades.map((trade) => {
              const isProfit = trade.profit_pct >= 0;
              const profitPct = toDisplayProfitPercent(trade.profit_pct, trade.profit_ratio);
              const profitColor = isProfit ? Colors.dark.profit : Colors.dark.loss;
              const isClosing = closingTradeId === trade.trade_id;

              return (
                <View key={trade.trade_id} style={styles.tradeCard}>
                  <View style={styles.tradeTop}>
                    <View>
                      <Text style={styles.tradePair}>{trade.pair.replace(':', '/')}</Text>
                      <View style={styles.tradeBadgeRow}>
                        <View
                          style={[
                            styles.badge,
                            {
                              backgroundColor: trade.is_short
                                ? Colors.dark.lossBg
                                : Colors.dark.profitBg,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.badgeText,
                              { color: trade.is_short ? Colors.dark.loss : Colors.dark.profit },
                            ]}
                          >
                            {trade.is_short ? t('做空', 'Short') : t('做多', 'Long')}
                          </Text>
                        </View>
                        <Text style={styles.leverageText}>{trade.leverage}x</Text>
                      </View>
                    </View>
                    <View style={styles.tradeProfitWrap}>
                      <Text style={[styles.tradeProfitValue, { color: profitColor }]}>
                        {isProfit ? '+' : ''}
                        {trade.profit_abs.toFixed(2)}
                      </Text>
                      <Text style={[styles.tradeProfitPct, { color: profitColor }]}>
                        {isProfit ? '+' : ''}
                        {profitPct.toFixed(2)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <Text style={styles.metricText}>
                      {t('开仓价', 'Entry')}: {trade.open_rate.toFixed(2)}
                    </Text>
                    <Text style={styles.metricText}>
                      {t('当前价', 'Current')}: {trade.current_rate.toFixed(2)}
                    </Text>
                    <Text style={styles.metricText}>
                      {t('仓位', 'Stake')}: {trade.stake_amount.toFixed(2)}
                    </Text>
                    <Text style={styles.metricText}>
                      {t('持仓', 'Duration')}: {formatDuration(trade.trade_duration)}
                    </Text>
                  </View>

                  <View style={styles.tradeMetaRow}>
                    <Text style={styles.tradeMetaText}>{formatDate(trade.open_date)}</Text>
                    <View style={styles.tradeActions}>
                      <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={() => router.push(`/trade/${trade.trade_id}` as any)}
                      >
                        <Text style={styles.secondaryButtonText}>{t('详情', 'Details')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.primaryButton, isClosing && styles.disabledButton]}
                        onPress={() => handleForceExit(trade.trade_id, trade.pair)}
                        disabled={isClosing}
                      >
                        <Text style={styles.primaryButtonText}>
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
          <View style={styles.emptyCard}>
            <Ionicons name="time-outline" size={44} color={Colors.dark.textMuted} />
            <Text style={styles.emptyCardTitle}>{t('暂无历史记录', 'No trade history')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.historySummary}>
              <Text style={styles.historySummaryText}>
                {language === 'en' ? `${tradeHistory.length} records` : `共 ${tradeHistory.length} 条记录`}
              </Text>
            </View>
            {tradeHistory.map((trade) => {
              const isProfit = (trade.profit_abs ?? 0) >= 0;
              const profitColor = isProfit ? Colors.dark.profit : Colors.dark.loss;
              const profitPct = toDisplayProfitPercent(trade.profit_pct, trade.profit_ratio);
              return (
                <Pressable key={trade.trade_id} style={styles.historyCard}>
                  <View style={styles.historyHeader}>
                    <Text style={styles.historyPair}>{trade.pair.replace(':', '/')}</Text>
                    <View>
                      <Text style={[styles.historyProfit, { color: profitColor }]}>
                        {isProfit ? '+' : ''}
                        {(trade.profit_abs ?? 0).toFixed(2)}
                      </Text>
                      <Text style={[styles.historyProfitPct, { color: profitColor }]}>
                        {isProfit ? '+' : ''}
                        {profitPct.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.historyMetaText}>
                    {t('开仓', 'Open')}: {(trade.open_rate ?? 0).toFixed(4)}   {t('平仓', 'Close')}:{' '}
                    {(trade.close_rate ?? 0).toFixed(4)}
                  </Text>
                  <Text style={styles.historyMetaText}>
                    {formatDate(trade.close_date ?? trade.open_date)}   {trade.exit_reason ?? trade.sell_reason ?? '-'}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal animationType="slide" transparent visible={isEntryModalVisible} onRequestClose={closeEntryModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeEntryModal}>
          <Pressable style={styles.modalCard} onPress={() => null}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitle}>{t('选择币对下单', 'Choose Pair')}</Text>
                <Text style={styles.modalSubtitle}>
                  {t('候选币对来自当前机器人白名单。', 'Pairs come from the current bot whitelist.')}
                </Text>
              </View>
              <TouchableOpacity onPress={closeEntryModal} disabled={isSubmittingEntry}>
                <Ionicons name="close" size={22} color={Colors.dark.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.sideSelector}>
              <TouchableOpacity
                style={[styles.sideButton, entrySide === 'long' && styles.sideButtonLong]}
                onPress={() => setEntrySide('long')}
              >
                <Text style={styles.sideButtonText}>{t('做多', 'Long')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sideButton, entrySide === 'short' && styles.sideButtonShort]}
                onPress={() => setEntrySide('short')}
              >
                <Text style={styles.sideButtonText}>{t('做空', 'Short')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.pairChipGrid}>
              {selectablePairs.map((pair) => {
                const selected = entryPair === pair;
                const blocked = blockedPairs.has(pair);
                return (
                  <TouchableOpacity
                    key={pair}
                    style={[styles.pairChip, selected && styles.pairChipActive]}
                    onPress={() => setEntryPair(pair)}
                  >
                    <Text style={[styles.pairChipText, selected && styles.pairChipTextActive]}>
                      {pair}{blocked ? ` ${language === 'en' ? '(Open)' : '（已开仓）'}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              value={entryStakeAmount}
              onChangeText={setEntryStakeAmount}
              keyboardType="decimal-pad"
              placeholder={language === 'en' ? 'Stake amount (optional)' : '下单金额（可选）'}
              placeholderTextColor={Colors.dark.textMuted}
              style={styles.input}
            />

            <TouchableOpacity
              style={[styles.submitButton, (!entryPair || isSubmittingEntry) && styles.disabledButton]}
              onPress={handleForceEntry}
              disabled={!entryPair || isSubmittingEntry}
            >
              <Text style={styles.submitButtonText}>
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
  container: { flex: 1, backgroundColor: Colors.dark.background },
  content: { padding: Spacing.lg, paddingBottom: 120 },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: 2,
    borderRadius: BorderRadius.md,
  },
  segmentBtnActive: { backgroundColor: Colors.dark.surfaceLight },
  segmentText: { color: Colors.dark.textMuted, fontSize: FontSize.sm, fontWeight: '700' },
  segmentTextActive: { color: Colors.dark.text },
  segmentCount: { color: Colors.dark.textMuted, fontSize: FontSize.xs, fontFamily: 'SpaceMono' },
  segmentCountActive: { color: Colors.dark.primary },
  entryCard: {
    backgroundColor: '#10253A',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: '#244A69',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  entryEyebrow: { color: '#8CC7FF', fontSize: FontSize.xs, fontWeight: '700' },
  entryTitle: { color: '#F4FBFF', fontSize: FontSize.xl, fontWeight: '800' },
  entrySubtitle: { color: '#B5CADC', fontSize: FontSize.sm, lineHeight: 20 },
  entryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: '#8CC7FF',
  },
  entryButtonText: { color: '#06111A', fontSize: FontSize.sm, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statsCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  statsLabel: { color: Colors.dark.textMuted, fontSize: FontSize.xs, marginBottom: 4 },
  statsValue: { color: Colors.dark.text, fontSize: FontSize.lg, fontWeight: '700', fontFamily: 'SpaceMono' },
  tradeCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  tradeTop: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  tradePair: { color: Colors.dark.text, fontSize: FontSize.md, fontWeight: '700', marginBottom: 4 },
  tradeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.sm },
  badgeText: { fontSize: FontSize.xs, fontWeight: '700' },
  leverageText: { color: Colors.dark.textMuted, fontSize: FontSize.xs },
  tradeProfitWrap: { alignItems: 'flex-end' },
  tradeProfitValue: { fontSize: FontSize.lg, fontWeight: '700', fontFamily: 'SpaceMono' },
  tradeProfitPct: { fontSize: FontSize.xs, fontFamily: 'SpaceMono', marginTop: 2 },
  metricsRow: {
    gap: 6,
    padding: Spacing.md,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: BorderRadius.md,
  },
  metricText: { color: Colors.dark.textSecondary, fontSize: FontSize.sm },
  tradeMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  tradeMetaText: { color: Colors.dark.textMuted, fontSize: FontSize.xs },
  tradeActions: { flexDirection: 'row', gap: Spacing.sm },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
  },
  secondaryButtonText: { color: Colors.dark.textSecondary, fontSize: FontSize.sm, fontWeight: '700' },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.primary,
  },
  primaryButtonText: { color: '#FFF', fontSize: FontSize.sm, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
  historySummary: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  historySummaryText: { color: Colors.dark.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  historyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  historyHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm },
  historyPair: { color: Colors.dark.text, fontSize: FontSize.md, fontWeight: '700' },
  historyProfit: { fontSize: FontSize.md, fontWeight: '700', fontFamily: 'SpaceMono', textAlign: 'right' },
  historyProfitPct: { fontSize: FontSize.xs, fontFamily: 'SpaceMono', textAlign: 'right' },
  historyMetaText: { color: Colors.dark.textSecondary, fontSize: FontSize.sm },
  emptyCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { color: Colors.dark.textSecondary, fontSize: FontSize.lg, fontWeight: '600' },
  emptyCard: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    padding: Spacing.xxxl,
    alignItems: 'center',
  },
  emptyCardTitle: { color: Colors.dark.text, fontSize: FontSize.lg, fontWeight: '700', marginTop: Spacing.md },
  emptyCardSubtitle: { color: Colors.dark.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: Spacing.xs },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.72)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.dark.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: Spacing.md },
  modalHeaderText: { flex: 1 },
  modalTitle: { color: Colors.dark.text, fontSize: FontSize.lg, fontWeight: '800' },
  modalSubtitle: { color: Colors.dark.textMuted, fontSize: FontSize.sm, marginTop: 4, lineHeight: 20 },
  sideSelector: { flexDirection: 'row', gap: Spacing.sm },
  sideButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    backgroundColor: Colors.dark.surfaceLight,
  },
  sideButtonLong: { backgroundColor: Colors.dark.profitBg, borderColor: Colors.dark.profit },
  sideButtonShort: { backgroundColor: Colors.dark.lossBg, borderColor: Colors.dark.loss },
  sideButtonText: { color: Colors.dark.text, fontSize: FontSize.sm, fontWeight: '700' },
  pairChipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pairChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    backgroundColor: Colors.dark.surfaceLight,
  },
  pairChipActive: {
    backgroundColor: Colors.dark.primaryBg,
    borderColor: Colors.dark.primary,
  },
  pairChipText: { color: Colors.dark.textSecondary, fontSize: FontSize.sm, fontWeight: '600' },
  pairChipTextActive: { color: Colors.dark.text },
  input: {
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    color: Colors.dark.text,
    fontSize: FontSize.md,
  },
  submitButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.primary,
  },
  submitButtonText: { color: '#FFF', fontSize: FontSize.md, fontWeight: '800' },
});
