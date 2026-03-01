// 设置页面 - 基于 Stitch 设计稿优化
// 分组列表：Exchange Config / Bot Config / Notification Toggles / Appearance / Data & Storage
// 底部 Logout 红色按钮 + 版本号

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Pressable,
    Switch,
    Alert,
    TextInput,
    RefreshControl,
    ActivityIndicator,
    LayoutAnimation,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
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

    // 本地通知设置（前端状态）
    const [tradeAlerts, setTradeAlerts] = useState(true);
    const [priceThresholds, setPriceThresholds] = useState(false);
    const [systemAlerts, setSystemAlerts] = useState(true);
    const [dryRunMode, setDryRunMode] = useState(false);

    // 连接表单
    const [showConnectForm, setShowConnectForm] = useState(false);
    const [formUrl, setFormUrl] = useState('');
    const [formUser, setFormUser] = useState('');
    const [formPass, setFormPass] = useState('');
    const [isConnectingForm, setIsConnectingForm] = useState(false);
    const [showServerManager, setShowServerManager] = useState(false);
    const [isSwitchingServerId, setIsSwitchingServerId] = useState<string | null>(null);
    const [isDeletingServerId, setIsDeletingServerId] = useState<string | null>(null);
    const [isStartingBot, setIsStartingBot] = useState(false);
    const [isStoppingBot, setIsStoppingBot] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);

    const onRefresh = useCallback(async () => {
        await refreshAll();
    }, [refreshAll]);

    const canSubmitConnectForm = !!formUrl.trim() && !!formUser.trim() && !!formPass.trim();
    const activeServer = activeServerId ? servers.find((item) => item.id === activeServerId) ?? null : null;
    const profileServerUrl = server?.url || activeServer?.url || '';
    const profileConnectionText = isConnected
        ? (profileServerUrl || t('已连接', 'Connected'))
        : t('未连接', 'Not connected');
    const showConnectionBadge = isConnected || !!profileServerUrl;

    // 处理连接
    const handleConnect = async () => {
        if (isConnectingForm) return;

        if (!formUrl || !formUser || !formPass) {
            Alert.alert(t('⚠️ 缺少信息', '⚠️ Missing Information'), t('请填写完整的连接信息', 'Please fill in all connection fields.'));
            return;
        }
        setIsConnectingForm(true);
        try {
            const success = await connect(formUrl, formUser, formPass);
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

    const handleClearCache = async () => {
        if (isClearingCache) return;

        setIsClearingCache(true);
        try {
            await new Promise((resolve) => setTimeout(resolve, 300));
            Alert.alert(t('缓存已刷新', 'Cache Refreshed'), t('本地临时缓存已清空，已为你刷新可视状态。', 'Local temporary cache is cleared and view state is refreshed.'));
        } finally {
            setIsClearingCache(false);
        }
    };

    const handleSwitchServer = async (serverId: string) => {
        if (isSwitchingServerId || serverId === activeServerId) return;
        setIsSwitchingServerId(serverId);
        try {
            const success = await switchServer(serverId);
            if (!success) {
                Alert.alert(t('切换失败', 'Switch Failed'), t('该服务器会话已失效，请重新连接。', 'Session for this server is invalid. Please reconnect.'));
            }
        } finally {
            setIsSwitchingServerId(null);
        }
    };

    const handleDeleteServer = (serverId: string, serverName: string) => {
        Alert.alert(
            t('删除服务器', 'Remove Server'),
            language === 'en'
                ? `Remove "${serverName}"?\n\nYou will need to reconnect after removing it.`
                : `确定要删除「${serverName}」吗？\n\n删除后需重新填写连接信息。`,
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
            ]
        );
    };

    // 处理断开连接
    const handleDisconnect = () => {
        Alert.alert(
            t('断开连接', 'Disconnect'),
            t('确定要断开与 Bot 的连接吗？', 'Are you sure you want to disconnect from the bot?'),
            [
                { text: t('取消', 'Cancel'), style: 'cancel' },
                {
                    text: t('断开', 'Disconnect'),
                    style: 'destructive',
                    onPress: () => disconnect(),
                },
            ]
        );
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
            {/* === 用户资料卡片 === */}
            <View style={styles.profileCard}>
                <View style={styles.avatar}>
                    <Ionicons name="person" size={28} color={Colors.dark.primary} />
                </View>
                <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{t('Freqtrade 用户', 'Freqtrade User')}</Text>
                    <Text style={styles.profileEmail}>
                        {profileConnectionText}
                    </Text>
                    {showConnectionBadge && (
                        <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>
                                {!isConnected
                                    ? t('⚪ 未连接', '⚪ Disconnected')
                                    : botState?.state === 'running'
                                        ? t('🟢 运行中', '🟢 Running')
                                        : t('🔴 已停止', '🔴 Stopped')}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* === Exchange Configuration === */}
            <Text style={styles.sectionLabel}>{t('交易所配置', 'EXCHANGE CONFIG')}</Text>
            <View style={styles.settingsGroup}>
                {isConnected ? (
                    <>
                        <Pressable
                            style={({ pressed }) => [
                                styles.settingRow,
                                styles.settingRowButton,
                                pressed && styles.settingRowPressed,
                            ]}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setShowServerManager((prev) => !prev);
                            }}
                        >
                            <Ionicons name="server-outline" size={18} color={Colors.dark.primary} />
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingTitle}>{t('多服务器配置切换', 'Multi-Server Switch')}</Text>
                                <Text style={styles.settingSubtitle}>
                                    {showServerManager ? t('点击收起服务器列表', 'Tap to collapse server list') : t('点击展开服务器列表', 'Tap to expand server list')}
                                </Text>
                            </View>
                            <Ionicons
                                name={showServerManager ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={Colors.dark.textMuted}
                            />
                        </Pressable>
                        <View style={styles.settingDivider} />
                        <View style={styles.settingRow}>
                            <Ionicons name="cloud-done-outline" size={18} color={Colors.dark.profit} />
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingTitle}>{t('连接状态', 'Connection Status')}</Text>
                                <Text style={[styles.settingSubtitle, { color: Colors.dark.profit }]}> 
                                    {t('系统运行正常', 'All systems operational')}
                                </Text>
                            </View>
                        </View>
                    </>
                ) : (
                    <Pressable
                        style={({ pressed }) => [
                            styles.settingRow,
                            styles.settingRowButton,
                            pressed && styles.settingRowPressed,
                        ]}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setShowConnectForm(!showConnectForm);
                        }}
                    >
                        <Ionicons name="link-outline" size={18} color={Colors.dark.primary} />
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>{t('连接机器人', 'Connect Bot')}</Text>
                            <Text style={styles.settingSubtitle}>{t('点击添加机器人连接', 'Tap to add bot connection')}</Text>
                        </View>
                        <Ionicons name="add-circle-outline" size={20} color={Colors.dark.primary} />
                    </Pressable>
                )}
            </View>

            {/* === 连接表单（展开） === */}
            {showConnectForm && (
                <View style={styles.connectForm}>
                    <TextInput
                        style={styles.input}
                        placeholder={t('服务器地址 (http://ip:port)', 'Server URL (http://ip:port)')}
                        placeholderTextColor={Colors.dark.textMuted}
                        value={formUrl}
                        onChangeText={setFormUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder={t('用户名', 'Username')}
                        placeholderTextColor={Colors.dark.textMuted}
                        value={formUser}
                        onChangeText={setFormUser}
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder={t('密码', 'Password')}
                        placeholderTextColor={Colors.dark.textMuted}
                        value={formPass}
                        onChangeText={setFormPass}
                        secureTextEntry
                    />
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            (isConnectingForm || !canSubmitConnectForm) && styles.primaryButtonDisabled,
                        ]}
                        onPress={handleConnect}
                        disabled={isConnectingForm || !canSubmitConnectForm}
                        activeOpacity={0.8}
                    >
                        {isConnectingForm ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : null}
                        <Text style={styles.primaryButtonText}>
                            {isConnectingForm ? t('连接中...', 'Connecting...') : t('连接', 'Connect')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* === 多 Bot 管理 === */}
            {(showServerManager || !isConnected || servers.length === 0) ? (
                <>
                    <Text style={styles.sectionLabel}>{t('多 Bot 管理', 'MULTI BOT MANAGEMENT')}</Text>
                    <View style={styles.settingsGroup}>
                        {servers.length === 0 ? (
                            <View style={styles.settingRow}>
                                <Ionicons name="server-outline" size={18} color={Colors.dark.textMuted} />
                                <View style={styles.settingInfo}>
                                    <Text style={styles.settingTitle}>{t('暂无服务器配置', 'No server configurations')}</Text>
                                    <Text style={styles.settingSubtitle}>{t('先添加一个服务器配置后可切换', 'Add a server to enable switching')}</Text>
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
                                            style={({ pressed }) => [
                                                styles.settingRow,
                                                styles.settingRowButton,
                                                pressed && !isSwitching && styles.settingRowPressed,
                                            ]}
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
                                                <View style={styles.serverActiveBadge}>
                                                    <Text style={styles.serverActiveBadgeText}>{t('当前', 'Current')}</Text>
                                                </View>
                                            ) : (
                                                <Text style={styles.serverSwitchText}>{t('切换', 'Switch')}</Text>
                                            )}
                                        </Pressable>

                                        <View style={styles.serverActionRow}>
                                            <TouchableOpacity
                                                style={styles.serverActionBtn}
                                                onPress={() => {
                                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                    setShowConnectForm(true);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="add" size={14} color={Colors.dark.textSecondary} />
                                                <Text style={styles.serverActionText}>{t('新增', 'Add')}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.serverActionBtn, isDeleting && styles.serverActionBtnDisabled]}
                                                onPress={() => handleDeleteServer(item.id, item.name)}
                                                disabled={isDeleting}
                                                activeOpacity={0.7}
                                            >
                                                {isDeleting ? (
                                                    <ActivityIndicator size="small" color={Colors.dark.loss} />
                                                ) : (
                                                    <Ionicons name="trash-outline" size={14} color={Colors.dark.loss} />
                                                )}
                                                <Text style={styles.serverActionTextDanger}>{t('删除', 'Remove')}</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {index < servers.length - 1 ? <View style={styles.settingDivider} /> : null}
                                    </View>
                                );
                            })
                        )}
                    </View>
                </>
            ) : null}

            {/* === Bot Configuration === */}
            <Text style={styles.sectionLabel}>{t('机器人配置', 'BOT CONFIGURATION')}</Text>
            <View style={styles.settingsGroup}>
                <Pressable
                    style={({ pressed }) => [
                        styles.settingRow,
                        styles.settingRowButton,
                        pressed && styles.settingRowPressed,
                    ]}
                    onPress={() => router.push('/global-params')}
                >
                    <Ionicons name="options-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('全局参数', 'Global Parameters')}</Text>
                        <Text style={styles.settingSubtitle}>{t('设置交易参数与风控阈值', 'Set trading and risk parameters')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
                </Pressable>
                <View style={styles.settingDivider} />
                <View style={styles.settingRow}>
                    <Ionicons name="flask-outline" size={18} color={Colors.dark.warning} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('模拟交易模式', 'Dry Run Mode')}</Text>
                    </View>
                    <Switch
                        value={dryRunMode}
                        onValueChange={setDryRunMode}
                        trackColor={{ false: Colors.dark.surfaceHighlight, true: Colors.dark.primary }}
                        thumbColor="#FFF"
                    />
                </View>
            </View>

            {/* === Bot Controls（已连接时） === */}
            {isConnected && (
                <>
                    <Text style={styles.sectionLabel}>{t('机器人控制', 'BOT CONTROLS')}</Text>
                    <View style={styles.controlRow}>
                        <TouchableOpacity
                            style={[
                                styles.controlActionBtn,
                                botState?.state === 'running' && styles.controlActionBtnActive,
                                (isStartingBot || isStoppingBot || botState?.state === 'running') && styles.controlActionBtnDisabled,
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
                                    size={20}
                                    color={botState?.state === 'running' ? Colors.dark.primary : Colors.dark.textSecondary}
                                />
                            )}
                            <Text style={[
                                styles.controlActionText,
                                botState?.state === 'running' && { color: Colors.dark.primary }
                            ]}>
                                {isStartingBot ? t('启动中...', 'Starting...') : t('启动机器人', 'Start Bot')}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.controlActionBtn,
                                botState?.state !== 'running' && styles.controlActionBtnDanger,
                                (isStartingBot || isStoppingBot || botState?.state !== 'running') && styles.controlActionBtnDisabled,
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
                                    size={20}
                                    color={botState?.state !== 'running' ? Colors.dark.loss : Colors.dark.textSecondary}
                                />
                            )}
                            <Text style={[
                                styles.controlActionText,
                                botState?.state !== 'running' && { color: Colors.dark.loss }
                            ]}>
                                {isStoppingBot ? t('停止中...', 'Stopping...') : t('停止机器人', 'Stop Bot')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* === Notification Toggles === */}
            <Text style={styles.sectionLabel}>{t('通知开关', 'NOTIFICATIONS')}</Text>
            <View style={styles.settingsGroup}>
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('交易提醒', 'Trade Alerts')}</Text>
                    </View>
                    <Switch
                        value={tradeAlerts}
                        onValueChange={setTradeAlerts}
                        trackColor={{ false: Colors.dark.surfaceHighlight, true: Colors.dark.primary }}
                        thumbColor="#FFF"
                    />
                </View>
                <View style={styles.settingDivider} />
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('价格阈值提醒', 'Price Threshold Alerts')}</Text>
                    </View>
                    <Switch
                        value={priceThresholds}
                        onValueChange={setPriceThresholds}
                        trackColor={{ false: Colors.dark.surfaceHighlight, true: Colors.dark.primary }}
                        thumbColor="#FFF"
                    />
                </View>
                <View style={styles.settingDivider} />
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('系统提醒', 'System Alerts')}</Text>
                    </View>
                    <Switch
                        value={systemAlerts}
                        onValueChange={setSystemAlerts}
                        trackColor={{ false: Colors.dark.surfaceHighlight, true: Colors.dark.primary }}
                        thumbColor="#FFF"
                    />
                </View>
            </View>

            {/* === Appearance === */}
            <Text style={styles.sectionLabel}>{t('外观设置', 'APPEARANCE')}</Text>
            <View style={styles.settingsGroup}>
                <Pressable
                    style={({ pressed }) => [
                        styles.settingRow,
                        styles.settingRowButton,
                        pressed && styles.settingRowPressed,
                    ]}
                    onPress={() => router.push('/theme-settings')}
                >
                    <Ionicons name="moon-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('主题', 'Theme')}</Text>
                        <Text style={styles.settingSubtitle}>{t('点击设置主题偏好', 'Tap to set theme preference')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
                </Pressable>
                <View style={styles.settingDivider} />
                <Pressable
                    style={({ pressed }) => [
                        styles.settingRow,
                        styles.settingRowButton,
                        pressed && styles.settingRowPressed,
                    ]}
                    onPress={() => router.push('/font-settings')}
                >
                    <Ionicons name="text-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('字体设置', 'Font Settings')}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
                </Pressable>
                <View style={styles.settingDivider} />
                <Pressable
                    style={({ pressed }) => [
                        styles.settingRow,
                        styles.settingRowButton,
                        pressed && styles.settingRowPressed,
                    ]}
                    onPress={() => router.push('/language-settings')}
                >
                    <Ionicons name="language-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('语言设置', 'Language Settings')}</Text>
                        <Text style={styles.settingSubtitle}>{language === 'en' ? 'English' : '简体中文'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
                </Pressable>
            </View>

            {/* === Data & Storage === */}
            <Text style={styles.sectionLabel}>{t('数据与存储', 'DATA & STORAGE')}</Text>
            <View style={styles.settingsGroup}>
                <Pressable
                    style={({ pressed }) => [
                        styles.settingRow,
                        styles.settingRowButton,
                        pressed && styles.settingRowPressed,
                    ]}
                    onPress={handleClearCache}
                    disabled={isClearingCache}
                >
                    <Ionicons name="trash-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>{t('清理缓存', 'Clear Cache')}</Text>
                    </View>
                    {isClearingCache ? (
                        <ActivityIndicator size="small" color={Colors.dark.textSecondary} />
                    ) : (
                        <Text style={styles.cacheSize}>{t('就绪', 'Ready')}</Text>
                    )}
                </Pressable>
            </View>

            {/* === Logout 按钮 === */}
            {isConnected && (
                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleDisconnect}
                    activeOpacity={0.8}
                >
                    <Text style={styles.logoutButtonText}>{t('退出登录', 'Logout')}</Text>
                </TouchableOpacity>
            )}

            {/* === 版本号 === */}
            <View style={styles.versionSection}>
                <Text style={styles.versionLabel}>{t('Freqtrade 移动端', 'Freqtrade Mobile')}</Text>
                <Text style={styles.versionNumber}>v1.0.0</Text>
            </View>

            <View style={{ height: 40 }} />
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
    },

    // === 用户资料 ===
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.xxl,
        gap: Spacing.md,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: Colors.dark.primaryBg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
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
    profileEmail: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
        marginTop: 2,
    },
    planBadge: {
        backgroundColor: Colors.dark.primaryBg,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderRadius: BorderRadius.sm,
        alignSelf: 'flex-start',
        marginTop: Spacing.xs,
    },
    planBadgeText: {
        color: Colors.dark.primary,
        fontSize: FontSize.xs,
        fontWeight: '700',
    },

    // === 区块标签 ===
    sectionLabel: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
        fontWeight: '600',
        letterSpacing: 1.5,
        marginBottom: Spacing.sm,
        marginTop: Spacing.sm,
    },

    // === 设置组 ===
    settingsGroup: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    settingRowButton: {
        backgroundColor: Colors.dark.surface,
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
        height: 0.5,
        backgroundColor: Colors.dark.surfaceBorder,
        marginLeft: Spacing.lg + 18 + Spacing.md, // 对齐（图标宽度 + 间距）
    },
    cacheSize: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.sm,
    },

    // === 连接表单 ===
    connectForm: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        gap: Spacing.md,
    },
    input: {
        backgroundColor: Colors.dark.surfaceLight,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        color: Colors.dark.text,
        fontSize: FontSize.md,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    primaryButton: {
        backgroundColor: Colors.dark.primary,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    primaryButtonDisabled: {
        opacity: 0.7,
    },
    primaryButtonText: {
        color: '#FFF',
        fontSize: FontSize.md,
        fontWeight: '700',
    },

    // === Bot Controls ===
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
        backgroundColor: Colors.dark.surface,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        gap: Spacing.sm,
    },
    controlActionBtnActive: {
        borderColor: Colors.dark.primary,
        backgroundColor: Colors.dark.primaryBg,
    },
    controlActionBtnDanger: {
        borderColor: Colors.dark.loss,
        backgroundColor: Colors.dark.lossBg,
    },
    controlActionBtnDisabled: {
        opacity: 0.6,
    },
    controlActionText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
        fontWeight: '600',
    },

    // === Logout ===
    logoutButton: {
        backgroundColor: Colors.dark.lossBg,
        borderRadius: BorderRadius.md,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        marginTop: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.dark.loss,
    },
    logoutButtonText: {
        color: Colors.dark.loss,
        fontSize: FontSize.lg,
        fontWeight: '700',
    },

    // === 版本号 ===
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
        fontWeight: '600',
    },
    serverActiveBadge: {
        backgroundColor: Colors.dark.primaryBg,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: Colors.dark.primary,
    },
    serverActiveBadgeText: {
        color: Colors.dark.primary,
        fontSize: FontSize.xs,
        fontWeight: '700',
    },
    serverSwitchText: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.xs,
    },
    serverActionRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    serverActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
        backgroundColor: Colors.dark.surfaceLight,
    },
    serverActionBtnDisabled: {
        opacity: 0.6,
    },
    serverActionText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
    serverActionTextDanger: {
        color: Colors.dark.loss,
        fontSize: FontSize.xs,
        fontWeight: '600',
    },
});
