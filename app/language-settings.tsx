import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { BorderRadius, FontSize, Spacing, getScaledFontSize, getThemeColors } from '@/constants/Colors';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';
import { useI18nStore, type AppLanguage } from '@/src/stores/useI18nStore';
import { haptics } from '@/src/utils/haptics';

const languageItems: Array<{ key: AppLanguage; zh: string; en: string; descZh: string; descEn: string }> = [
  { key: 'zh', zh: '简体中文', en: 'Simplified Chinese', descZh: '界面使用中文显示', descEn: 'Use Chinese across the app' },
  { key: 'en', zh: '英文', en: 'English', descZh: '界面使用英文显示', descEn: 'Use English across the app' },
];

export default function LanguageSettingsScreen() {
  const { language, isReady, setLanguage } = useI18nStore();
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const colors = getThemeColors(themeMode);
  const fs = (size: keyof typeof FontSize | number) => getScaledFontSize(size, fontScale);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleChangeLanguage = async (nextLanguage: AppLanguage) => {
    if (isSaving || nextLanguage === language) return;
    await haptics.selection();
    setIsSaving(true);
    try {
      await setLanguage(nextLanguage);
      await haptics.success();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={{ color: colors.textSecondary, fontSize: fs('sm') }}>
          {language === 'en' ? 'Loading language settings...' : '正在读取语言设置...'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        {languageItems.map((item, index) => {
          const selected = language === item.key;
          return (
            <React.Fragment key={item.key}>
              <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={() => handleChangeLanguage(item.key)} disabled={isSaving}>
                <Ionicons name="language-outline" size={18} color={colors.primary} />
                <View style={styles.info}>
                  <Text style={{ color: colors.text, fontSize: fs('md'), fontWeight: '700' }}>{language === 'en' ? item.en : item.zh}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: fs('xs'), marginTop: 2 }}>{language === 'en' ? item.descEn : item.descZh}</Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
              {index < languageItems.length - 1 ? <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} /> : null}
            </React.Fragment>
          );
        })}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: fs('sm'), marginTop: Spacing.md }}>
        {language === 'en' ? 'Language setting is saved automatically.' : '语言设置会自动保存。'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  group: { borderRadius: BorderRadius.xl, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
  info: { flex: 1 },
  divider: { height: 1, marginLeft: 52 },
});
