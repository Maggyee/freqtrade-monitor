import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  BorderRadius,
  FontSize,
  Spacing,
  getScaledFontSize,
  getThemeColors,
} from '@/constants/Colors';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';
import { useI18nStore } from '@/src/stores/useI18nStore';
import { haptics } from '@/src/utils/haptics';

export default function ThemeSettingsScreen() {
  const language = useI18nStore((s) => s.language);
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const isReady = useAppearanceStore((s) => s.isReady);
  const setThemeMode = useAppearanceStore((s) => s.setThemeMode);
  const t = (zh: string, en: string) => (language === 'en' ? en : zh);
  const colors = getThemeColors(themeMode);

  const [isSaving, setIsSaving] = React.useState(false);

  const applyTheme = async (mode: 'dark' | 'light') => {
    if (isSaving || mode === themeMode) return;
    await haptics.selection();
    setIsSaving(true);
    try {
      await setThemeMode(mode);
      await haptics.success();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="small" />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {t('读取主题设置中...', 'Loading theme settings...')}
        </Text>
      </View>
    );
  }

  const previewModes: Array<{
    key: 'dark' | 'light';
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
  }> = [
    {
      key: 'dark',
      icon: 'moon-outline',
      title: t('深色主题', 'Deep Dark'),
      subtitle: t('更柔和的深色界面，适合长时间查看。', 'A softer dark palette for long sessions.'),
    },
    {
      key: 'light',
      icon: 'sunny-outline',
      title: t('浅色主题', 'Light'),
      subtitle: t('明亮的白色界面，白天查看更轻松。', 'A bright white palette that feels cleaner in daylight.'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.previewLabel, { color: colors.textMuted, fontSize: getScaledFontSize('xs', fontScale) }]}>
          {t('实时预览', 'Live Preview')}
        </Text>
        <Text style={[styles.previewTitle, { color: colors.text, fontSize: getScaledFontSize('xl', fontScale) }]}>
          {t('主题会立即应用到导航和页面', 'Theme updates apply immediately')}
        </Text>
        <View style={styles.previewMetrics}>
          <View style={[styles.metricPill, { backgroundColor: colors.primaryBg }]}>
            <Text style={[styles.metricText, { color: colors.primary, fontSize: getScaledFontSize('xs', fontScale) }]}>
              {themeMode === 'light' ? 'LIGHT' : 'DARK'}
            </Text>
          </View>
          <View style={[styles.metricPill, { backgroundColor: colors.profitBg }]}>
            <Text style={[styles.metricText, { color: colors.profit, fontSize: getScaledFontSize('xs', fontScale) }]}>
              +2.84%
            </Text>
          </View>
          <View style={[styles.metricPill, { backgroundColor: colors.lossBg }]}>
            <Text style={[styles.metricText, { color: colors.loss, fontSize: getScaledFontSize('xs', fontScale) }]}>
              -1.12%
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        {previewModes.map((item, index) => {
          const selected = themeMode === item.key;
          const previewColors = getThemeColors(item.key);
          return (
            <React.Fragment key={item.key}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => applyTheme(item.key)}
                activeOpacity={0.75}
                disabled={isSaving}
              >
                <View style={[styles.iconWrap, { backgroundColor: previewColors.primaryBg }]}>
                  <Ionicons name={item.icon} size={18} color={previewColors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={[styles.title, { color: colors.text, fontSize: getScaledFontSize('md', fontScale) }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: getScaledFontSize('xs', fontScale) }]}>
                    {item.subtitle}
                  </Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
              {index < previewModes.length - 1 ? (
                <View style={[styles.divider, { backgroundColor: colors.surfaceBorder }]} />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSize.sm,
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  previewLabel: {
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  previewTitle: {
    fontWeight: '800',
  },
  previewMetrics: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  metricPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  metricText: {
    fontWeight: '700',
  },
  group: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginLeft: 50,
  },
});
