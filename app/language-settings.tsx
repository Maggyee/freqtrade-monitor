import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '@/constants/Colors';
import { useI18nStore, type AppLanguage } from '@/src/stores/useI18nStore';

type LanguageItem = {
    key: AppLanguage;
    titleZh: string;
    titleEn: string;
    subtitleZh: string;
    subtitleEn: string;
};

const languageItems: LanguageItem[] = [
    {
        key: 'zh',
        titleZh: '简体中文',
        titleEn: 'Simplified Chinese',
        subtitleZh: '界面使用中文显示',
        subtitleEn: 'Use Chinese across the app',
    },
    {
        key: 'en',
        titleZh: '英文',
        titleEn: 'English',
        subtitleZh: '界面使用英文显示',
        subtitleEn: 'Use English across the app',
    },
];

export default function LanguageSettingsScreen() {
    const { language, isReady, setLanguage } = useI18nStore();
    const [isSaving, setIsSaving] = React.useState(false);

    const handleChangeLanguage = async (nextLanguage: AppLanguage) => {
        if (isSaving || nextLanguage === language) return;
        setIsSaving(true);
        try {
            await setLanguage(nextLanguage);
        } finally {
            setIsSaving(false);
        }
    };

    if (!isReady) {
        return (
            <View style={styles.loadingWrap}>
                <ActivityIndicator color={Colors.dark.primary} size="small" />
                <Text style={styles.loadingText}>读取语言设置中...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.group}>
                {languageItems.map((item, index) => {
                    const selected = language === item.key;
                    return (
                        <View key={item.key}>
                            <TouchableOpacity
                                style={styles.row}
                                activeOpacity={0.7}
                                onPress={() => handleChangeLanguage(item.key)}
                                disabled={isSaving}
                            >
                                <Ionicons name="language-outline" size={18} color={Colors.dark.primary} />
                                <View style={styles.info}>
                                    <Text style={styles.title}>{language === 'en' ? item.titleEn : item.titleZh}</Text>
                                    <Text style={styles.subtitle}>{language === 'en' ? item.subtitleEn : item.subtitleZh}</Text>
                                </View>
                                {selected ? <Ionicons name="checkmark-circle" size={18} color={Colors.dark.primary} /> : null}
                            </TouchableOpacity>
                            {index < languageItems.length - 1 ? <View style={styles.divider} /> : null}
                        </View>
                    );
                })}
            </View>

            <Text style={styles.note}>
                {language === 'en'
                    ? 'Language setting is saved automatically.'
                    : '语言设置会自动保存。'}
            </Text>
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
        marginTop: Spacing.md,
    },
});
