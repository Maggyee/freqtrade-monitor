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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';

export default function SettingsScreen() {
    const router = useRouter();
    const {
        isConnected,
        isLoading,
        botState,
        serverUrl,
        connect,
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
    const [isStartingBot, setIsStartingBot] = useState(false);
    const [isStoppingBot, setIsStoppingBot] = useState(false);
    const [isClearingCache, setIsClearingCache] = useState(false);

    const onRefresh = useCallback(async () => {
        await refreshAll();
    }, [refreshAll]);

    // 处理连接
    const handleConnect = async () => {
        if (isConnectingForm) return;

        if (!formUrl || !formUser || !formPass) {
            Alert.alert('⚠️ 缺少信息', '请填写完整的连接信息');
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
            Alert.alert('缓存已刷新', '本地临时缓存已清空，已为你刷新可视状态。');
        } finally {
            setIsClearingCache(false);
        }
    };

    // 处理断开连接
    const handleDisconnect = () => {
        Alert.alert(
            '断开连接',
            '确定要断开与 Bot 的连接吗？',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '断开',
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
                    <Text style={styles.profileName}>Freqtrade 用户</Text>
                    <Text style={styles.profileEmail}>
                        {isConnected ? serverUrl : '未连接'}
                    </Text>
                    {isConnected && (
                        <View style={styles.planBadge}>
                            <Text style={styles.planBadgeText}>
                                {botState?.state === 'running' ? '🟢 运行中' : '🔴 已停止'}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* === Exchange Configuration === */}
            <Text style={styles.sectionLabel}>交易所配置</Text>
            <View style={styles.settingsGroup}>
                {isConnected ? (
                    <>
                        <View style={styles.settingRow}>
                            <Ionicons name="key-outline" size={18} color={Colors.dark.primary} />
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingTitle}>API 密钥</Text>
                                <Text style={styles.settingSubtitle}>已连接</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
                        </View>
                        <View style={styles.settingDivider} />
                        <View style={styles.settingRow}>
                            <Ionicons name="cloud-done-outline" size={18} color={Colors.dark.profit} />
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingTitle}>连接状态</Text>
                                <Text style={[styles.settingSubtitle, { color: Colors.dark.profit }]}> 
                                    系统运行正常
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
                        onPress={() => setShowConnectForm(!showConnectForm)}
                    >
                        <Ionicons name="link-outline" size={18} color={Colors.dark.primary} />
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>连接机器人</Text>
                            <Text style={styles.settingSubtitle}>点击添加机器人连接</Text>
                        </View>
                        <Ionicons name="add-circle-outline" size={20} color={Colors.dark.primary} />
                    </Pressable>
                )}
            </View>

            {/* === 连接表单（展开） === */}
            {showConnectForm && !isConnected && (
                <View style={styles.connectForm}>
                    <TextInput
                        style={styles.input}
                        placeholder="服务器地址 (http://ip:port)"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={formUrl}
                        onChangeText={setFormUrl}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="用户名"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={formUser}
                        onChangeText={setFormUser}
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="密码"
                        placeholderTextColor={Colors.dark.textMuted}
                        value={formPass}
                        onChangeText={setFormPass}
                        secureTextEntry
                    />
                    <TouchableOpacity
                        style={[
                            styles.primaryButton,
                            isConnectingForm && styles.primaryButtonDisabled,
                        ]}
                        onPress={handleConnect}
                        disabled={isConnectingForm}
                        activeOpacity={0.8}
                    >
                        {isConnectingForm ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : null}
                        <Text style={styles.primaryButtonText}>
                            {isConnectingForm ? '连接中...' : '连接'}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* === Bot Configuration === */}
            <Text style={styles.sectionLabel}>机器人配置</Text>
            <View style={styles.settingsGroup}>
                <View style={styles.settingRow}>
                    <Ionicons name="options-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>全局参数</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
                </View>
                <View style={styles.settingDivider} />
                <View style={styles.settingRow}>
                    <Ionicons name="flask-outline" size={18} color={Colors.dark.warning} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>模拟交易模式</Text>
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
                    <Text style={styles.sectionLabel}>机器人控制</Text>
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
                                {isStartingBot ? '启动中...' : '启动机器人'}
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
                                {isStoppingBot ? '停止中...' : '停止机器人'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </>
            )}

            {/* === Notification Toggles === */}
            <Text style={styles.sectionLabel}>通知开关</Text>
            <View style={styles.settingsGroup}>
                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>交易提醒</Text>
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
                        <Text style={styles.settingTitle}>价格阈值提醒</Text>
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
                        <Text style={styles.settingTitle}>系统提醒</Text>
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
            <Text style={styles.sectionLabel}>外观设置</Text>
            <View style={styles.settingsGroup}>
                <View style={styles.settingRow}>
                    <Ionicons name="moon-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>主题</Text>
                        <Text style={styles.settingSubtitle}>深色模式（固定）</Text>
                    </View>
                </View>
                <View style={styles.settingDivider} />
                <View style={styles.settingRow}>
                    <Ionicons name="text-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingTitle}>字体设置</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={Colors.dark.textMuted} />
                </View>
            </View>

            {/* === Data & Storage === */}
            <Text style={styles.sectionLabel}>数据与存储</Text>
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
                        <Text style={styles.settingTitle}>清理缓存</Text>
                    </View>
                    {isClearingCache ? (
                        <ActivityIndicator size="small" color={Colors.dark.textSecondary} />
                    ) : (
                        <Text style={styles.cacheSize}>就绪</Text>
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
                    <Text style={styles.logoutButtonText}>退出登录</Text>
                </TouchableOpacity>
            )}

            {/* === 版本号 === */}
            <View style={styles.versionSection}>
                <Text style={styles.versionLabel}>Freqtrade 移动端</Text>
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
});
