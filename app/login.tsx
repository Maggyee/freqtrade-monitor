import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
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
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';

export default function LoginScreen() {
  const router = useRouter();
  const { connect, error, loadSavedServer, server } = useBotStore();
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const colors = getThemeColors(themeMode);
  const fs = (size: keyof typeof FontSize | number) => getScaledFontSize(size, fontScale);

  const [name, setName] = useState('我的 Bot');
  const [url, setUrl] = useState('https://app.nishiki.tech/freqtrade');
  const [username, setUsername] = useState('freqtrader');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    const restoreSavedForm = async () => {
      const savedServer = server ?? (await loadSavedServer());
      if (!savedServer || !mounted) return;

      setName(savedServer.name || '我的 Bot');
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

  const handleConnect = async () => {
    if (isSubmitting) return;

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
      const cleanUrl = url.trim().replace(/\/$/, '');
      const success = await connect(cleanUrl, username.trim(), password);
      if (success) {
        router.back();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Ionicons name="link" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text, fontSize: fs('xxl') }]}>连接 Freqtrade Bot</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fs('md') }]}>
            输入你的 Bot 服务地址和认证信息
          </Text>
        </View>

        {displayError ? (
          <View style={[styles.errorBox, { backgroundColor: colors.lossBg }]}>
            <Ionicons name="alert-circle" size={16} color={colors.loss} />
            <Text style={[styles.errorText, { color: colors.loss, fontSize: fs('sm') }]}>{displayError}</Text>
          </View>
        ) : null}

        <View style={[styles.tipBox, { backgroundColor: `${colors.info}14` }]}>
          <Ionicons name="information-circle-outline" size={16} color={colors.info} />
          <Text style={[styles.tipText, { color: colors.info, fontSize: fs('sm') }]}>
            使用云端 HTTPS 时，地址填 `https://app.nishiki.tech/freqtrade`
            {'\n'}
            使用 SSH 隧道时，地址填 `http://localhost:8080`
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary, fontSize: fs('sm') }]}>Bot 名称</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder, color: colors.text, fontSize: fs('md') },
          ]}
          value={name}
          onChangeText={setName}
          placeholder="如：主力 Bot"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.label, { color: colors.textSecondary, fontSize: fs('sm') }]}>服务器地址</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder, color: colors.text, fontSize: fs('md') },
          ]}
          value={url}
          onChangeText={setUrl}
          placeholder="https://app.nishiki.tech/freqtrade"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Text style={[styles.label, { color: colors.textSecondary, fontSize: fs('sm') }]}>用户名</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder, color: colors.text, fontSize: fs('md') },
          ]}
          value={username}
          onChangeText={setUsername}
          placeholder="freqtrader"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={[styles.label, { color: colors.textSecondary, fontSize: fs('sm') }]}>密码</Text>
        <View style={[styles.passwordContainer, { backgroundColor: colors.surfaceLight, borderColor: colors.surfaceBorder }]}>
          <TextInput
            style={[styles.passwordInput, { color: colors.text, fontSize: fs('md') }]}
            value={password}
            onChangeText={setPassword}
            placeholder="输入密码"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)} activeOpacity={0.7}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.connectButton, { backgroundColor: colors.primary }, isSubmitting && styles.connectButtonDisabled]}
          onPress={handleConnect}
          disabled={isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Ionicons name="flash-outline" size={20} color="#FFF" />
          )}
          <Text style={[styles.connectButtonText, { fontSize: fs('lg') }]}>
            {isSubmitting ? '连接中...' : '连接'}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.helpText, { color: colors.textMuted, fontSize: fs('sm') }]}>
          需要在 Freqtrade 的 `config.json` 里启用 `api_server.enabled = true`
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.xl,
    paddingTop: Spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  title: {
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {},
  tipBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
  },
  label: {
    fontWeight: '600',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    padding: Spacing.lg,
  },
  eyeButton: {
    padding: Spacing.lg,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '700',
  },
  helpText: {
    textAlign: 'center',
    marginTop: Spacing.xl,
    lineHeight: 22,
  },
});
