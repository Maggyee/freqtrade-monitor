import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, Spacing, getScaledFontSize, getThemeColors } from '@/constants/Colors';
import { getNotificationPermission, requestNotificationPermission } from '@/src/services/notifications';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';
import { useNotificationStore } from '@/src/stores/useNotificationStore';
import { haptics } from '@/src/utils/haptics';

function ToggleSwitch({
  value,
  onToggle,
  disabled = false,
  activeColor,
  inactiveColor,
  thumbColor,
  disabledThumbColor,
}: {
  value: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
  activeColor: string;
  inactiveColor: string;
  thumbColor: string;
  disabledThumbColor: string;
}) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, value]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 17],
  });

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveColor, activeColor],
  });

  return (
    <Pressable
      onPress={() => !disabled && onToggle(!value)}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.togglePressable,
        disabled && styles.toggleDisabled,
        pressed && !disabled && styles.togglePressed,
      ]}
    >
      <Animated.View style={[styles.toggleTrack, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[
            styles.toggleThumb,
            {
              backgroundColor: disabled ? disabledThumbColor : thumbColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const colors = getThemeColors(themeMode);
  const fs = (size: keyof typeof FontSize | number) => getScaledFontSize(size, fontScale);
  const t = (zh: string, en: string) => (language === 'en' ? en : zh);

  const bot = useBotStore();
  const notifications = useNotificationStore();
  const activeServer = useMemo(
    () => (bot.activeServerId ? bot.servers.find((item) => item.id === bot.activeServerId) ?? null : null),
    [bot.activeServerId, bot.servers],
  );

  const [showConnect, setShowConnect] = useState(false);
  const [showServers, setShowServers] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [switchingServer, setSwitchingServer] = useState<string | null>(null);
  const [deletingServer, setDeletingServer] = useState<string | null>(null);
  const [isTogglingDryRun, setIsTogglingDryRun] = useState(false);

  const profileUrl = bot.server?.url || activeServer?.url || '';
  const dryRunMode = !!bot.botState?.dry_run;
  const liveReady = bot.adminConfig?.live_ready ?? false;
  const liveBlockers = bot.adminConfig?.live_blockers ?? [];
  const switchThumbColor = themeMode === 'light' ? '#FFFFFF' : '#F8FAFC';
  const switchDisabledThumbColor = themeMode === 'light' ? '#E2E8F0' : '#64748B';

  const ensurePermission = async () => {
    const granted = (await getNotificationPermission()) || (await requestNotificationPermission());
    await notifications.setPermissionGranted(granted);
    return granted;
  };

  const handleNotification = async (value: boolean, setter: (enabled: boolean) => Promise<void>, label: string) => {
    await haptics.light();
    if (!value) {
      await setter(false);
      return;
    }
    const granted = await ensurePermission();
    if (!granted) {
      await haptics.error();
      Alert.alert(t('通知权限被拒绝', 'Notification Permission Needed'), language === 'en' ? `Allow notifications to enable ${label}.` : `请先允许系统通知，才能开启${label}。`);
      return;
    }
    await setter(true);
    await haptics.success();
  };

  const handleConnect = async () => {
    if (!formUrl.trim() || !formUser.trim() || !formPass.trim() || isConnecting) return;
    await haptics.medium();
    setIsConnecting(true);
    try {
      const success = await bot.connect(formUrl.trim(), formUser.trim(), formPass);
      await (success ? haptics.success() : haptics.error());
      if (success) {
        setFormUrl('');
        setFormUser('');
        setFormPass('');
        setShowConnect(false);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDryRunToggle = async (nextValue: boolean) => {
    if (!bot.isConnected || isTogglingDryRun) return;
    if (!nextValue && !liveReady) {
      await haptics.error();
      Alert.alert(
        t('无法切换到实盘', 'Live Mode Blocked'),
        liveBlockers.length > 0
          ? liveBlockers.join('\n')
          : t('当前服务器缺少实盘配置。', 'The current server is missing live-trading credentials.'),
      );
      return;
    }
    await haptics.medium();
    setIsTogglingDryRun(true);
    try {
      const result = await bot.toggleDryRun(nextValue);
      if (!result.success) {
        await haptics.error();
        Alert.alert(t('切换失败', 'Update Failed'), result.message ?? t('无法更新模式。', 'Unable to update mode.'));
        return;
      }
      await haptics.success();
      Alert.alert(nextValue ? t('已切换到模拟盘', 'Dry-run Enabled') : t('已切换到实盘', 'Live Mode Enabled'), result.message ?? '');
    } finally {
      setIsTogglingDryRun(false);
    }
  };

  const section = (title: string, children: React.ReactNode) => (
    <View style={styles.sectionWrap}>
      <Text style={[styles.sectionLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>{children}</View>
    </View>
  );

  const row = (icon: keyof typeof Ionicons.glyphMap, title: string, subtitle: string | null, action: React.ReactNode, onPress?: () => void) => {
    const content = (
      <View style={[styles.row, onPress && { paddingVertical: Spacing.md }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text, fontSize: fs('md') }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fs('xs') }]}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
    );
    if (!onPress) return content;
    return <Pressable onPress={onPress}>{content}</Pressable>;
  };

  const renderSwitch = (value: boolean, onValueChange: (next: boolean) => void, disabled = false) => (
    <ToggleSwitch
      value={value}
      onToggle={onValueChange}
      disabled={disabled}
      activeColor={colors.primary}
      inactiveColor={colors.surfaceLight}
      thumbColor={switchThumbColor}
      disabledThumbColor={switchDisabledThumbColor}
    />
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={bot.isLoading} onRefresh={bot.refreshAll} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <View style={styles.profileTopRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]}>
            <Ionicons name="person" size={26} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text, fontSize: fs('xl') }]}>
              {t('Freqtrade 用户', 'Freqtrade User')}
            </Text>
            <Text style={[styles.profileSubtitle, { color: colors.textSecondary, fontSize: fs('sm') }]}>
              {profileUrl || t('尚未连接服务器', 'No server connected')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.statusBadgeText, { color: colors.primary, fontSize: fs('xs') }]}>
              {!bot.isConnected
                ? t('未连接', 'Offline')
                : bot.botState?.state === 'running'
                  ? t('运行中', 'Running')
                  : t('已停止', 'Stopped')}
            </Text>
          </View>
        </View>

        <View style={styles.profileStatsRow}>
          <View style={[styles.profileStatCard, { backgroundColor: colors.surfaceLight }]}>
            <Text style={[styles.profileStatLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
              {t('服务器', 'Servers')}
            </Text>
            <Text style={[styles.profileStatValue, { color: colors.text, fontSize: fs('sm') }]}>{bot.servers.length}</Text>
          </View>
          <View style={[styles.profileStatCard, { backgroundColor: colors.surfaceLight }]}>
            <Text style={[styles.profileStatLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
              {t('连接', 'Protocol')}
            </Text>
            <Text style={[styles.profileStatValue, { color: colors.text, fontSize: fs('sm') }]}>
              {bot.isConnected ? 'HTTPS' : '-'}
            </Text>
          </View>
          <View style={[styles.profileStatCard, { backgroundColor: colors.surfaceLight }]}>
            <Text style={[styles.profileStatLabel, { color: colors.textMuted, fontSize: fs('xs') }]}>
              {t('模式', 'Mode')}
            </Text>
            <Text style={[styles.profileStatValue, { color: colors.text, fontSize: fs('sm') }]}>
              {dryRunMode ? t('模拟', 'Dry-run') : t('实盘', 'Live')}
            </Text>
          </View>
        </View>
      </View>

      {section(t('连接', 'CONNECTION'),
        <>
          {row('link-outline', t('连接 Bot', 'Connect Bot'), t('添加或更新服务器连接', 'Add or update a server connection'), <Ionicons name={showConnect ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />, async () => {
            await haptics.light();
            setShowConnect((prev) => !prev);
          })}
          {showConnect ? (
            <View style={styles.form}>
              <TextInput style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder, color: colors.text, fontSize: fs('md') }]} value={formUrl} onChangeText={setFormUrl} placeholder="https://your-domain/freqtrade" placeholderTextColor={colors.textMuted} />
              <TextInput style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder, color: colors.text, fontSize: fs('md') }]} value={formUser} onChangeText={setFormUser} placeholder={t('用户名', 'Username')} placeholderTextColor={colors.textMuted} />
              <TextInput style={[styles.input, { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder, color: colors.text, fontSize: fs('md') }]} value={formPass} onChangeText={setFormPass} placeholder={t('密码', 'Password')} placeholderTextColor={colors.textMuted} secureTextEntry />
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleConnect} disabled={isConnecting}>
                {isConnecting ? <ActivityIndicator color="#FFF" /> : null}
                <Text style={[styles.primaryText, { fontSize: fs('md') }]}>{isConnecting ? t('连接中...', 'Connecting...') : t('连接', 'Connect')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {row('server-outline', t('服务器管理', 'Server Manager'), t('查看、切换和删除已保存连接', 'View, switch, and remove saved connections'), <Ionicons name={showServers ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />, async () => {
            await haptics.light();
            setShowServers((prev) => !prev);
          })}
          {showServers ? bot.servers.map((item) => (
            <View key={item.id} style={[styles.serverItem, { borderTopColor: colors.surfaceBorder }]}>
              <Pressable onPress={async () => {
                if (switchingServer || item.id === bot.activeServerId) return;
                await haptics.light();
                setSwitchingServer(item.id);
                try {
                  const success = await bot.switchServer(item.id);
                  await (success ? haptics.success() : haptics.error());
                } finally {
                  setSwitchingServer(null);
                }
              }}>
                <View style={styles.serverLine}>
                  <Text style={[styles.title, { color: colors.text, fontSize: fs('sm') }]}>{item.name}</Text>
                  {switchingServer === item.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.subtitle, { color: item.id === bot.activeServerId ? colors.primary : colors.textMuted, fontSize: fs('xs') }]}>{item.id === bot.activeServerId ? t('当前', 'Current') : t('切换', 'Switch')}</Text>}
                </View>
                <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fs('xs') }]}>{item.url}</Text>
              </Pressable>
              <TouchableOpacity style={[styles.inlineButton, { backgroundColor: colors.lossBg }]} onPress={() => Alert.alert(t('删除服务器', 'Remove Server'), language === 'en' ? `Remove "${item.name}"?` : `确定删除 “${item.name}” 吗？`, [{ text: t('取消', 'Cancel'), style: 'cancel' }, { text: t('删除', 'Remove'), style: 'destructive', onPress: async () => { await haptics.medium(); setDeletingServer(item.id); try { await bot.removeServer(item.id); await haptics.success(); } finally { setDeletingServer(null); } } }])}>
                {deletingServer === item.id ? <ActivityIndicator size="small" color={colors.loss} /> : <Text style={[styles.inlineButtonText, { color: colors.loss, fontSize: fs('xs') }]}>{t('删除', 'Remove')}</Text>}
              </TouchableOpacity>
            </View>
          )) : null}
        </>,
      )}

      {section(t('Bot 控制', 'BOT CONTROLS'),
        <>
          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.primaryBg, borderColor: colors.primary }]} onPress={async () => { await haptics.medium(); const success = await bot.startBot(); await (success ? haptics.success() : haptics.error()); }} disabled={bot.botState?.state === 'running'}>
              <Text style={[styles.actionText, { color: colors.primary, fontSize: fs('sm') }]}>{t('启动 Bot', 'Start Bot')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, { backgroundColor: colors.lossBg, borderColor: colors.loss }]} onPress={async () => { await haptics.medium(); const success = await bot.stopBot(); await (success ? haptics.success() : haptics.error()); }} disabled={bot.botState?.state !== 'running'}>
              <Text style={[styles.actionText, { color: colors.loss, fontSize: fs('sm') }]}>{t('停止 Bot', 'Stop Bot')}</Text>
            </TouchableOpacity>
          </View>
        </>,
      )}

      {section(t('通知', 'NOTIFICATIONS'),
        <>
          {row('notifications-outline', t('交易提醒', 'Trade Alerts'), notifications.permissionGranted ? t('系统通知已授权', 'Notification permission granted') : t('系统通知尚未授权', 'Notification permission pending'), renderSwitch(notifications.tradeAlerts, (value) => handleNotification(value, notifications.setTradeAlerts, t('交易提醒', 'trade alerts'))))}
          {row('stats-chart-outline', t('价格阈值提醒', 'Price Threshold Alerts'), t('当前仅保存开关，后续支持自定义价格提醒。', 'Only the toggle is saved for now. Custom price alerts are coming next.'), renderSwitch(notifications.priceThresholdAlerts, (value) => handleNotification(value, notifications.setPriceThresholdAlerts, t('价格阈值提醒', 'price threshold alerts'))))}
          {row('radio-outline', t('系统提醒', 'System Alerts'), null, renderSwitch(notifications.systemAlerts, (value) => handleNotification(value, notifications.setSystemAlerts, t('系统提醒', 'system alerts'))))}
        </>,
      )}

      {section(t('偏好', 'PREFERENCES'),
        <>
          {row(
            'flask-outline',
            t('模拟交易模式', 'Dry Run Mode'),
            !bot.isConnected
              ? t('连接后才可切换', 'Connect before changing this mode')
              : dryRunMode
                ? liveReady
                  ? t('当前为模拟盘，可切到实盘', 'Dry-run active. Live mode is available.')
                  : `${t('当前为模拟盘，实盘不可用', 'Dry-run active. Live mode is blocked.')}${liveBlockers.length ? `: ${liveBlockers.join(', ')}` : ''}`
                : t('当前服务器真实状态：实盘', 'Current server state: live'),
            renderSwitch(
              dryRunMode,
              handleDryRunToggle,
              !bot.isConnected || isTogglingDryRun || (dryRunMode && !liveReady),
            ),
          )}
          {row('moon-outline', t('主题', 'Theme'), themeMode === 'light' ? t('当前：浅色', 'Current: Light') : t('当前：深色', 'Current: Dark'), <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />, async () => { await haptics.selection(); router.push('/theme-settings'); })}
          {row('text-outline', t('字体设置', 'Font Settings'), { small: t('当前：紧凑', 'Current: Compact'), normal: t('当前：标准', 'Current: Standard'), large: t('当前：舒适', 'Current: Comfort') }[fontScale], <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />, async () => { await haptics.selection(); router.push('/font-settings'); })}
          {row('language-outline', t('语言设置', 'Language'), language === 'en' ? 'English' : '简体中文', <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />, async () => { await haptics.selection(); router.push('/language-settings'); })}
        </>,
      )}

      {section(t('数据', 'DATA'),
        <>
          {row('trash-outline', t('清理缓存', 'Clear Cache'), t('刷新本地状态', 'Refresh local state'), isConnecting ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fs('xs') }]}>{t('就绪', 'Ready')}</Text>, async () => { await haptics.light(); await bot.refreshAll(); await haptics.success(); })}
        </>,
      )}

      {bot.isConnected ? (
        <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.lossBg, borderColor: colors.loss }]} onPress={() => Alert.alert(t('退出连接', 'Disconnect'), t('确定要断开当前 Bot 连接吗？', 'Disconnect from the current bot?'), [{ text: t('取消', 'Cancel'), style: 'cancel' }, { text: t('断开', 'Disconnect'), style: 'destructive', onPress: async () => { await haptics.medium(); await bot.disconnect(); await haptics.success(); } }])}>
          <Text style={[styles.actionText, { color: colors.loss, fontSize: fs('sm') }]}>{t('退出登录', 'Logout')}</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, paddingBottom: 120, gap: Spacing.lg },
  profileCard: { borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.lg, gap: Spacing.lg },
  profileTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  profileInfo: { flex: 1 },
  profileName: { fontWeight: '700' },
  profileSubtitle: { marginTop: 4 },
  statusBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  statusBadgeText: { fontWeight: '700' },
  profileStatsRow: { flexDirection: 'row', gap: Spacing.sm },
  profileStatCard: {
    flex: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  profileStatLabel: { textAlign: 'center', marginBottom: 4 },
  profileStatValue: { fontWeight: '700', textAlign: 'center' },
  sectionWrap: { gap: Spacing.sm },
  sectionLabel: { fontWeight: '700', letterSpacing: 1.1 },
  card: { borderWidth: 1, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  info: { flex: 1 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 2 },
  form: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
  primaryButton: { borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: Spacing.sm },
  primaryText: { color: '#FFF', fontWeight: '700' },
  serverItem: { borderTopWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
  serverLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  inlineButton: { alignSelf: 'flex-end', paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: BorderRadius.full },
  inlineButtonText: { fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.lg },
  actionButton: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontWeight: '700' },
  logoutButton: { borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  togglePressable: { paddingLeft: Spacing.sm },
  toggleTrack: {
    width: 38,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
  },
  toggleThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    top: 2,
  },
  toggleDisabled: { opacity: 0.7 },
  togglePressed: { opacity: 0.92 },
});
