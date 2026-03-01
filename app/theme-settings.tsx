import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';

const THEME_KEY = 'ft_app_theme_preference';

type ThemeMode = 'dark' | 'amoled';

export default function ThemeSettingsScreen() {
    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const saved = await SecureStore.getItemAsync(THEME_KEY);
                if (saved === 'dark' || saved === 'amoled') {
                    setThemeMode(saved);
                }
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const applyTheme = async (mode: ThemeMode) => {
        if (isSaving || mode === themeMode) return;
        setIsSaving(true);
        try {
            await SecureStore.setItemAsync(THEME_KEY, mode);
            setThemeMode(mode);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator color={Colors.dark.primary} size="small" />
                <Text style={styles.loadingText}>读取主题设置中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.group}>
                <TouchableOpacity
                    style={styles.row}
                    onPress={() => applyTheme('dark')}
                    activeOpacity={0.7}
                    disabled={isSaving}
                >
                    <Ionicons name="moon-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.info}>
                        <Text style={styles.title}>深色主题（推荐）</Text>
                        <Text style={styles.subtitle}>当前应用默认主题</Text>
                    </View>
                    {themeMode === 'dark' ? <Ionicons name="checkmark-circle" size={18} color={Colors.dark.primary} /> : null}
                </TouchableOpacity>

                <View style={styles.divider} />

                <TouchableOpacity
                    style={styles.row}
                    onPress={() => applyTheme('amoled')}
                    activeOpacity={0.7}
                    disabled={isSaving}
                >
                    <Ionicons name="contrast-outline" size={18} color={Colors.dark.primary} />
                    <View style={styles.info}>
                        <Text style={styles.title}>纯黑主题</Text>
                        <Text style={styles.subtitle}>省电且更高对比度（将用于后续版本）</Text>
                    </View>
                    {themeMode === 'amoled' ? <Ionicons name="checkmark-circle" size={18} color={Colors.dark.primary} /> : null}
                </TouchableOpacity>
            </View>

            <Text style={styles.note}>说明：主题偏好已保存，当前版本主界面保持深色样式，后续版本会全面应用该设置。</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        padding: Spacing.lg,
    },
    loadingWrap: {
        flex: 1,
        backgroundColor: Colors.dark.background,
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    loadingText: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.sm,
    },
    group: {
        backgroundColor: Colors.dark.surface,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: Colors.dark.surfaceBorder,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        gap: Spacing.md,
    },
    info: {
        flex: 1,
    },
    title: {
        color: Colors.dark.text,
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    subtitle: {
        color: Colors.dark.textSecondary,
        fontSize: FontSize.xs,
        marginTop: 2,
    },
    divider: {
        height: 0.5,
        backgroundColor: Colors.dark.surfaceBorder,
        marginLeft: Spacing.lg + 18 + Spacing.md,
    },
    note: {
        color: Colors.dark.textMuted,
        fontSize: FontSize.sm,
        lineHeight: 20,
        marginTop: Spacing.md,
    },
});
