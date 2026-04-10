// 登录页面 - 配置并连接到 Freqtrade Bot
// 以模态形式从设置页面或仪表盘打开
// 支持 SSH 隧道（http://localhost:8080）和 HTTPS（https://domain.com）两种方式

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';

export default function LoginScreen() {
    const router = useRouter();
    const { connect, error, loadSavedServer, server } = useBotStore();

    // 表单状态
    const [name, setName] = useState('我的 Bot');          // Bot 显示名称
    const [url, setUrl] = useState('http://localhost:8080'); // 默认 SSH 隧道地址
    const [username, setUsername] = useState('freqtrader');   // Freqtrade 默认用户名
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let mounted = true;

        const restoreSavedForm = async () => {
            const savedServer = server ?? (await loadSavedServer());
            if (!savedServer || !mounted) return;

            setName(savedServer.name || '鎴戠殑 Bot');
            setUrl(savedServer.url || '');
            setUsername(savedServer.username || 'freqtrader');

            const savedPassword = await SecureStore.getItemAsync(`ft_pwd_${savedServer.id}`);
            if (mounted && savedPassword) {
                setPassword(savedPassword);
            }
        };

        restoreSavedForm();

        return () => {
            mounted = false;
        };
    }, [loadSavedServer, server]);

    // 处理连接
    const handleConnect = async () => {
        if (isSubmitting) return;

        // 输入验证
        if (!url.trim()) {
            setLocalError('请输入服务器地址');
            return;
        }
        if (!username.trim()) {
            setLocalError('请输入用户名');
            return;
        }
        if (!password.trim()) {
            setLocalError('请输入密码');
            return;
        }

        setLocalError('');

        setIsSubmitting(true);
        try {
            // 使用新的 connect 方法（内部自动创建 server 配置和保存）
            const cleanUrl = url.trim().replace(/\/$/, '');
            const success = await connect(cleanUrl, username.trim(), password);

            if (success) {
                // 返回上一页
                router.back();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayError = localError || error;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {/* 标题图标 */}
                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="link" size={32} color={Colors.dark.primary} />
                    </View>
                    <Text style={styles.title}>连接 Freqtrade Bot</Text>
                    <Text style={styles.subtitle}>
                        输入你的 Bot 服务器信息
                    </Text>
                </View>

                {/* 错误提示 */}
                {displayError ? (
                    <View style={styles.errorBox}>
                        <Ionicons name="alert-circle" size={16} color={Colors.dark.loss} />
                        <Text style={styles.errorText}>{displayError}</Text>
                    </View>
                ) : null}

                {/* 连接提示 */}
                <View style={styles.tipBox}>
                    <Ionicons name="information-circle-outline" size={16} color={Colors.dark.info} />
                    <Text style={styles.tipText}>
                        使用 SSH 隧道时，地址填 http://localhost:8080{'\n'}
                        直连云端时，填 https://你的域名
                    </Text>
                </View>

                {/* === 表单 === */}

                {/* Bot 名称 */}
                <Text style={styles.label}>Bot 名称</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="如：主力 Bot"
                    placeholderTextColor={Colors.dark.textMuted}
                />

                {/* 服务器地址 */}
                <Text style={styles.label}>服务器地址</Text>
                <TextInput
                    style={styles.input}
                    value={url}
                    onChangeText={setUrl}
                    placeholder="http://localhost:8080"
                    placeholderTextColor={Colors.dark.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                />

                {/* 用户名 */}
                <Text style={styles.label}>用户名</Text>
                <TextInput
                    style={styles.input}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="freqtrader"
                    placeholderTextColor={Colors.dark.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                />

                {/* 密码 */}
                <Text style={styles.label}>密码</Text>
                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.passwordInput}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="输入密码"
                        placeholderTextColor={Colors.dark.textMuted}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                    />
                    <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}
                    >
                        <Ionicons
                            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                            size={20}
                            color={Colors.dark.textMuted}
                        />
                    </TouchableOpacity>
                </View>

                {/* 连接按钮 */}
                <TouchableOpacity
                    style={[styles.connectButton, isSubmitting && styles.connectButtonDisabled]}
                    onPress={handleConnect}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                        <Ionicons name="flash-outline" size={20} color="#FFF" />
                    )}
                    <Text style={styles.connectButtonText}>
                        {isSubmitting ? '连接中...' : '连接'}
                    </Text>
                </TouchableOpacity>

                {/* 帮助链接 */}
                <Text style={styles.helpText}>
                    💡 需要在 Freqtrade config.json 中设置{'\n'}
                    "api_server": {'{'} "enabled": true {'}'}
                </Text>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    content: {
        padding: Spacing.xl,
        paddingTop: Spacing.xxxl,
    },

    // 头部
    header: {
        alignItems: 'center',
        marginBottom: Spacing.xxl,
    },
    iconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: Colors.dark.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.dark.primary,
        marginBottom: Spacing.lg,
    },
    title: {
        color: Colors.dark.text,
        fontSize: FontSize.xxl,
        fontWeight: '700',
        marginBottom: Spacing.xs,
    },
    subtitle: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.md,
    },

    // 提示框
    tipBox: {
        flexDirection: 'row',
        backgroundColor: 'rgba(6, 182, 212, 0.08)',
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.xl,
        gap: Spacing.sm,
        alignItems: 'flex-start',
    },
    tipText: {
        color: Colors.dark.info,
        fontSize: FontSize.sm,
        flex: 1,
        lineHeight: 20,
    },

    // 错误框
    errorBox: {
        flexDirection: 'row',
        backgroundColor: Colors.dark.lossBg,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.lg,
        gap: Spacing.sm,
        alignItems: 'center',
    },
    errorText: {
        color: Colors.dark.loss,
        fontSize: FontSize.sm,
        flex: 1,
    },

    // 表单
    label: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
        fontWeight: '600',
        marginBottom: Spacing.sm,
        marginTop: Spacing.md,
    },
    input: {
        backgroundColor: Colors.dark.surfaceLight,
        borderRadius: BorderRadius.md,
        padding: Spacing.lg,
        color: Colors.dark.text,
        fontSize: FontSize.md,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.dark.surfaceLight,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
    },
    passwordInput: {
        flex: 1,
        padding: Spacing.lg,
        color: Colors.dark.text,
        fontSize: FontSize.md,
    },
    eyeButton: {
        padding: Spacing.lg,
    },

    // 连接按钮
    connectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.dark.primary,
        paddingVertical: Spacing.lg,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.xxl,
        gap: Spacing.sm,
    },
    connectButtonDisabled: {
        opacity: 0.6,
    },
    connectButtonText: {
        color: '#FFF',
        fontSize: FontSize.lg,
        fontWeight: '700',
    },

    // 帮助文字
    helpText: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.sm,
        textAlign: 'center',
        marginTop: Spacing.xl,
        lineHeight: 22,
    },
});
