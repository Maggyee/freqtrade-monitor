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

const FONT_SCALE_KEY = 'ft_app_font_scale';

type FontScale = 'small' | 'normal' | 'large';

const fontScaleLabel: Record<FontScale, string> = {
    small: '偏小',
    normal: '标准',
    large: '偏大',
};

export default function FontSettingsScreen() {
    const [fontScale, setFontScale] = useState<FontScale>('normal');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const saved = await SecureStore.getItemAsync(FONT_SCALE_KEY);
                if (saved === 'small' || saved === 'normal' || saved === 'large') {
                    setFontScale(saved);
                }
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const saveScale = async (next: FontScale) => {
        if (isSaving || next === fontScale) return;
        setIsSaving(true);
        try {
            await SecureStore.setItemAsync(FONT_SCALE_KEY, next);
            setFontScale(next);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator color={Colors.dark.primary} size="small" />
                <Text style={styles.loadingText}>读取字体设置中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.group}>
                {(['small', 'normal', 'large'] as FontScale[]).map((item, index) => (
                    <View key={item}>
                        <TouchableOpacity
                            style={styles.row}
                            onPress={() => saveScale(item)}
                            activeOpacity={0.7}
                            disabled={isSaving}
                        >
                            <Ionicons name="text-outline" size={18} color={Colors.dark.primary} />
                            <View style={styles.info}>
                                <Text style={styles.title}>{fontScaleLabel[item]}</Text>
                                <Text style={styles.subtitle}>预设字号档位</Text>
                            </View>
                            {fontScale === item ? <Ionicons name="checkmark-circle" size={18} color={Colors.dark.primary} /> : null}
                        </TouchableOpacity>
                        {index < 2 ? <View style={styles.divider} /> : null}
                    </View>
                ))}
            </View>

            <Text style={styles.note}>说明：字体偏好已保存，当前版本会在后续页面逐步应用该设置。</Text>
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
