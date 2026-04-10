import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
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

export default function SettingsScreen() {
  const router = useRouter();
  const language = useI18nStore((s) => s.language);
  const t = (zh: string, en: string) => (language === 'en' ? en : zh);
  const {
    isConnected,
    isLoading,
    botState,
    server,
    servers,
    activeServerId,
    connect,
    switchServer,
    removeServer,
    disconnect,
    startBot,
    stopBot,
    refreshAll,
  } = useBotStore();

  const [tradeAlerts, setTradeAlerts] = useState(true);
  const [priceThresholds, setPriceThresholds] = useState(false);
  const [systemAlerts, setSystemAlerts] = useState(true);
  const [dryRunMode, setDryRunMode] = useState(false);

  const [showConnectForm, setShowConnectForm] = useState(false);
  const [showServerManager, setShowServerManager] = useState(false);
  const [formUrl, setFormUrl] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [isConnectingForm, setIsConnectingForm] = useState(false);
  const [isSwitchingServerId, setIsSwitchingServerId] = useState<string | null>(null);
  const [isDeletingServerId, setIsDeletingServerId] = useState<string | null>(null);
  const [isStartingBot, setIsStartingBot] = useState(false);
  const [isStoppingBot, setIsStoppingBot] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  const onRefresh = useCallback(async () => {
    await refreshAll();
  }, [refreshAll]);

  const activeServer = activeServerId ? servers.find((item) => item.id === activeServerId) ?? null : null;
  const profileServerUrl = server?.url || activeServer?.url || '';
  const canSubmitConnectForm = !!formUrl.trim() && !!formUser.trim() && !!formPass.trim();

  const handleConnect = async () => {
    if (isConnectingForm || !canSubmitConnectForm) return;
    setIsConnectingForm(true);
    try {
      const success = await connect(formUrl.trim(), formUser.trim(), formPass);
      if (success) {
        setShowConnectForm(false);
        setFormUrl('');
        setFormUser('');
        setFormPass('');
      }
    } finally {
      setIsConnectingForm(false);
    }
  };

  const handleStartBot = async () => {
    if (isStartingBot || isStoppingBot || botState?.state === 'running') return;
    setIsStartingBot(true);
    try {
      await startBot();
    } finally {
      setIsStartingBot(false);
    }
  };

  const handleStopBot = async () => {
    if (isStartingBot || isStoppingBot || botState?.state !== 'running') return;
    setIsStoppingBot(true);
    try {
      await stopBot();
    } finally {
      setIsStoppingBot(false);
    }
  };

  const handleSwitchServer = async (serverId: string) => {
    if (isSwitchingServerId || serverId === activeServerId) return;
    setIsSwitchingServerId(serverId);
    try {
      const success = await switchServer(serverId);
      if (!success) {
        Alert.alert(
          t('切换失败', 'Switch Failed'),
          t('该服务会话已失效，请重新连接。', 'Session expired for this server. Please reconnect.'),
        );
      }
    } finally {
      setIsSwitchingServerId(null);
    }
  };

  const handleDeleteServer = (serverId: string, serverName: string) => {
    Alert.alert(
      t('删除服务器', 'Remove Server'),
      language === 'en'
        ? `Remove "${serverName}"?`
        : `确定删除 “${serverName}” 吗？`,
      [
        { text: t('取消', 'Cancel'), style: 'cancel' },
        {
          text: t('删除', 'Remove'),
          style: 'destructive',
          onPress: async () => {
            setIsDeletingServerId(serverId);
            try {
              await removeServer(serverId);
            } finally {
              setIsDeletingServerId(null);
            }
          },
        },
      ],
    );
  };

  const handleDisconnect = () => {
    Alert.alert(
      t('断开连接', 'Disconnect'),
      t('确定要断开当前 Bot 连接吗？', 'Disconnect from the current bot?'),
      [
        { text: t('取消', 'Cancel'), style: 'cancel' },
        {
          text: t('断开', 'Disconnect'),
          style: 'destructive',
          onPress: () => disconnect(),
        },
      ],
    );
  };

  const handleClearCache = async () => {
    if (isClearingCache) return;
    setIsClearingCache(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      Alert.alert(
        t('缓存已刷新', 'Cache Refreshed'),
        t('本地缓存已清理，界面状态已重新同步。', 'Local cache is cleared and view state has been refreshed.'),
      );
    } finally {
      setIsClearingCache(false);
    }
  };

  const toggleConnectForm = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowConnectForm((prev) => !prev);
  };

  const toggleServerManager = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowServerManager((prev) => !prev);
  };

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
      <View style={styles.profileCard}>
        <View style={styles.profileTopRow}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={26} color={Colors.dark.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{t('Freqtrade 用户', 'Freqtrade User')}</Text>
            <Text style={styles.profileSubtitle}>
              {profileServerUrl || t('尚未连接服务器', 'No server connected')}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {!isConnected
                ? t('未连接', 'Offline')
                : botState?.state === 'running'
                  ? t('运行中', 'Running')
                  : t('已停止', 'Stopped')}
            </Text>
          </View>
        </View>

        <View style={styles.profileStatsRow}>
          <View style={styles.profileStatCard}>
            <Text style={styles.profileStatLabel}>{t('服务器', 'Servers')}</Text>
            <Text style={styles.profileStatValue}>{servers.length}</Text>
          </View>
          <View style={styles.profileStatCard}>
            <Text style={styles.profileStatLabel}>{t('连接', 'Protocol')}</Text>
            <Text style={styles.profileStatValue}>{isConnected ? 'HTTPS' : '-'}</Text>
          </View>
          <View style={styles.profileStatCard}>
            <Text style={styles.profileStatLabel}>{t('状态', 'State')}</Text>
            <Text style={styles.profileStatValue}>
              {botState?.state === 'running' ? t('运行中', 'Running') : t('停止', 'Stopped')}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>{t('连接中心', 'CONNECTION')}</Text>
      <View style={styles.settingsGroup}>
        <Pressable style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]} onPress={toggleConnectForm}>
          <Ionicons name="link-outline" size={18} color={Colors.dark.primary} />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('连接 Bot', 'Connect Bot')}</Text>
            <Text style={styles.settingSubtitle}>
              {t('添加或更新服务器连接', 'Add or update a server connection')}
            </Text>
          </View>
          <Ionicons
            name={showConnectForm ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.dark.textMuted}
          />
        </Pressable>

        <View style={styles.settingDivider} />

        <Pressable style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]} onPress={toggleServerManager}>
          <Ionicons name="server-outline" size={18} color={Colors.dark.primary} />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('多服务器切换', 'Server Manager')}</Text>
            <Text style={styles.settingSubtitle}>
              {t('查看、切换和删除已保存连接', 'View, switch, and remove saved connections')}
            </Text>
          </View>
          <Ionicons
            name={showServerManager ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.dark.textMuted}
          />
        </Pressable>
      </View>

      {showConnectForm && (
        <View style={styles.connectForm}>
          <TextInput
            style={styles.input}
            value={formUrl}
            onChangeText={setFormUrl}
            placeholder="https://your-domain/freqtrade"
            placeholderTextColor={Colors.dark.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            value={formUser}
            onChangeText={setFormUser}
            placeholder={t('用户名', 'Username')}
            placeholderTextColor={Colors.dark.textMuted}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            value={formPass}
            onChangeText={setFormPass}
            placeholder={t('密码', 'Password')}
            placeholderTextColor={Colors.dark.textMuted}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.primaryButton, (!canSubmitConnectForm || isConnectingForm) && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={!canSubmitConnectForm || isConnectingForm}
            activeOpacity={0.8}
          >
            {isConnectingForm ? <ActivityIndicator color="#FFF" size="small" /> : null}
            <Text style={styles.primaryButtonText}>
              {isConnectingForm ? t('连接中...', 'Connecting...') : t('连接', 'Connect')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showServerManager && (
        <>
          <Text style={styles.sectionLabel}>{t('服务器列表', 'SERVERS')}</Text>
          <View style={styles.settingsGroup}>
            {servers.length === 0 ? (
              <View style={styles.settingRow}>
                <Ionicons name="cloud-offline-outline" size={18} color={Colors.dark.textMuted} />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>{t('暂无服务器配置', 'No saved servers')}</Text>
                  <Text style={styles.settingSubtitle}>{t('先添加一个连接后再切换。', 'Add a connection before switching.')}</Text>
                </View>
              </View>
            ) : (
              servers.map((item, index) => {
                const isActive = item.id === activeServerId;
                const isSwitching = isSwitchingServerId === item.id;
                const isDeleting = isDeletingServerId === item.id;

                return (
                  <View key={item.id}>
                    <Pressable
                      style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
                      onPress={() => handleSwitchServer(item.id)}
                      disabled={isSwitching || isDeleting}
                    >
                      <Ionicons
                        name={isActive ? 'radio-button-on-outline' : 'radio-button-off-outline'}
                        size={18}
                        color={isActive ? Colors.dark.primary : Colors.dark.textMuted}
                      />
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{item.name}</Text>
                        <Text style={styles.settingSubtitle}>{item.url}</Text>
                      </View>
                      {isSwitching ? (
                        <ActivityIndicator size="small" color={Colors.dark.primary} />
                      ) : isActive ? (
                        <Text style={styles.serverStateText}>{t('当前', 'Current')}</Text>
                      ) : (
                        <Text style={styles.serverStateText}>{t('切换', 'Switch')}</Text>
                      )}
                    </Pressable>

                    <View style={styles.serverActionRow}>
                      <TouchableOpacity
                        style={[styles.serverActionBtn, isDeleting && styles.buttonDisabled]}
                        onPress={() => handleDeleteServer(item.id, item.name)}
                        disabled={isDeleting}
                        activeOpacity={0.75}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={Colors.dark.loss} />
                        ) : (
                          <Ionicons name="trash-outline" size={14} color={Colors.dark.loss} />
                        )}
                        <Text style={styles.serverDeleteText}>{t('删除', 'Remove')}</Text>
                      </TouchableOpacity>
                    </View>

                    {index < servers.length - 1 ? <View style={styles.settingDivider} /> : null}
                  </View>
                );
              })
            )}
          </View>
        </>
      )}

      <Text style={styles.sectionLabel}>{t('Bot 控制', 'BOT CONTROLS')}</Text>
      <View style={styles.controlRow}>
        <TouchableOpacity
          style={[
            styles.controlActionBtn,
            botState?.state === 'running' && styles.controlActionBtnActive,
            (isStartingBot || isStoppingBot || botState?.state === 'running') && styles.buttonDisabled,
          ]}
          onPress={handleStartBot}
          disabled={isStartingBot || isStoppingBot || botState?.state === 'running'}
          activeOpacity={0.75}
        >
          {isStartingBot ? (
            <ActivityIndicator size="small" color={Colors.dark.primary} />
          ) : (
            <Ionicons name="play" size={18} color={Colors.dark.primary} />
          )}
          <Text style={[styles.controlActionText, { color: Colors.dark.primary }]}>
            {isStartingBot ? t('启动中...', 'Starting...') : t('启动 Bot', 'Start Bot')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlActionBtn,
            styles.controlDangerBtn,
            (isStartingBot || isStoppingBot || botState?.state !== 'running') && styles.buttonDisabled,
          ]}
          onPress={handleStopBot}
          disabled={isStartingBot || isStoppingBot || botState?.state !== 'running'}
          activeOpacity={0.75}
        >
          {isStoppingBot ? (
            <ActivityIndicator size="small" color={Colors.dark.loss} />
          ) : (
            <Ionicons name="stop" size={18} color={Colors.dark.loss} />
          )}
          <Text style={[styles.controlActionText, { color: Colors.dark.loss }]}>
            {isStoppingBot ? t('停止中...', 'Stopping...') : t('停止 Bot', 'Stop Bot')}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionLabel}>{t('通知', 'NOTIFICATIONS')}</Text>
      <View style={styles.settingsGroup}>
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('交易提醒', 'Trade Alerts')}</Text>
          </View>
          <Switch value={tradeAlerts} onValueChange={setTradeAlerts} trackColor={{ false: Colors.dark.surfaceLight, true: Colors.dark.primary }} />
        </View>
        <View style={styles.settingDivider} />
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('价格阈值提醒', 'Price Threshold Alerts')}</Text>
          </View>
          <Switch value={priceThresholds} onValueChange={setPriceThresholds} trackColor={{ false: Colors.dark.surfaceLight, true: Colors.dark.primary }} />
        </View>
        <View style={styles.settingDivider} />
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('系统提醒', 'System Alerts')}</Text>
          </View>
          <Switch value={systemAlerts} onValueChange={setSystemAlerts} trackColor={{ false: Colors.dark.surfaceLight, true: Colors.dark.primary }} />
        </View>
      </View>

      <Text style={styles.sectionLabel}>{t('策略与外观', 'PREFERENCES')}</Text>
      <View style={styles.settingsGroup}>
        <View style={styles.settingRow}>
          <Ionicons name="flask-outline" size={18} color={Colors.dark.warning} />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('模拟交易模式', 'Dry Run Mode')}</Text>
          </View>
          <Switch value={dryRunMode} onValueChange={setDryRunMode} trackColor={{ false: Colors.dark.surfaceLight, true: Colors.dark.primary }} />
        </View>
        <View style={styles.settingDivider} />
        <Pressable style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]} onPress={() => router.push('/theme-settings')}>
          <Ionicons name="moon-outline" size={18} color={Colors.dark.primary} />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('主题', 'Theme')}</Text>
            <Text style={styles.settingSubtitle}>{t('调整视觉风格与对比度', 'Adjust app look and contrast')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
        </Pressable>
        <View style={styles.settingDivider} />
        <Pressable style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]} onPress={() => router.push('/font-settings')}>
          <Ionicons name="text-outline" size={18} color={Colors.dark.primary} />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('字体设置', 'Font Settings')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
        </Pressable>
        <View style={styles.settingDivider} />
        <Pressable style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]} onPress={() => router.push('/language-settings')}>
          <Ionicons name="language-outline" size={18} color={Colors.dark.primary} />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('语言设置', 'Language')}</Text>
            <Text style={styles.settingSubtitle}>{language === 'en' ? 'English' : '简体中文'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
        </Pressable>
      </View>

      <Text style={styles.sectionLabel}>{t('数据与存储', 'DATA')}</Text>
      <View style={styles.settingsGroup}>
        <Pressable style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]} onPress={handleClearCache} disabled={isClearingCache}>
          <Ionicons name="trash-outline" size={18} color={Colors.dark.primary} />
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>{t('清理缓存', 'Clear Cache')}</Text>
          </View>
          {isClearingCache ? (
            <ActivityIndicator size="small" color={Colors.dark.primary} />
          ) : (
            <Text style={styles.settingSubtitle}>{t('就绪', 'Ready')}</Text>
          )}
        </Pressable>
      </View>

      {isConnected && (
        <TouchableOpacity style={styles.logoutButton} onPress={handleDisconnect} activeOpacity={0.8}>
          <Text style={styles.logoutButtonText}>{t('退出登录', 'Logout')}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.versionSection}>
        <Text style={styles.versionLabel}>{t('Freqtrade 移动端', 'Freqtrade Mobile')}</Text>
        <Text style={styles.versionNumber}>v1.0.0</Text>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  profileCard: {
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xxl,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.dark.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: Colors.dark.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  profileSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: Colors.dark.primaryBg,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  statusBadgeText: {
    color: Colors.dark.primary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  profileStatCard: {
    flex: 1,
    backgroundColor: Colors.dark.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  profileStatLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginBottom: 4,
  },
  profileStatValue: {
    color: Colors.dark.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  sectionLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  settingsGroup: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  settingRowPressed: {
    backgroundColor: Colors.dark.surfaceLight,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    color: Colors.dark.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  settingSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  settingDivider: {
    height: 1,
    backgroundColor: Colors.dark.surfaceBorder,
    marginLeft: 52,
  },
  connectForm: {
    backgroundColor: Colors.dark.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Colors.dark.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.dark.surfaceBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.dark.text,
    fontSize: FontSize.md,
  },
  primaryButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  serverActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  serverActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.surfaceLight,
  },
  serverDeleteText: {
    color: Colors.dark.loss,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  serverStateText: {
    color: Colors.dark.primary,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  controlRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  controlActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.primary,
    backgroundColor: Colors.dark.primaryBg,
    paddingVertical: Spacing.md,
  },
  controlDangerBtn: {
    borderColor: Colors.dark.loss,
    backgroundColor: Colors.dark.lossBg,
  },
  controlActionBtnActive: {
    borderColor: Colors.dark.primary,
  },
  controlActionText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  logoutButton: {
    backgroundColor: Colors.dark.lossBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.dark.loss,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
  },
  logoutButtonText: {
    color: Colors.dark.loss,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  versionSection: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    gap: Spacing.xs,
  },
  versionLabel: {
    color: Colors.dark.textMuted,
    fontSize: FontSize.sm,
  },
  versionNumber: {
    color: Colors.dark.primary,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
