import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  BorderRadius,
  FontScale,
  FontSize,
  Spacing,
  getScaledFontSize,
  getThemeColors,
} from '@/constants/Colors';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';
import { useI18nStore } from '@/src/stores/useI18nStore';
import { haptics } from '@/src/utils/haptics';

const options: FontScale[] = ['small', 'normal', 'large'];

export default function FontSettingsScreen() {
  const language = useI18nStore((s) => s.language);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const isReady = useAppearanceStore((s) => s.isReady);
  const setFontScale = useAppearanceStore((s) => s.setFontScale);
  const colors = getThemeColors(themeMode);
  const t = (zh: string, en: string) => (language === 'en' ? en : zh);

  const [isSaving, setIsSaving] = React.useState(false);

  const labels: Record<FontScale, { title: string; subtitle: string }> = {
    small: {
      title: t('紧凑', 'Compact'),
      subtitle: t('一屏显示更多信息。', 'Fits more data on screen.'),
    },
    normal: {
      title: t('标准', 'Standard'),
      subtitle: t('适合大多数使用场景。', 'Balanced for everyday use.'),
    },
    large: {
      title: t('舒适', 'Comfort'),
      subtitle: t('提升阅读性和点击舒适度。', 'Larger text for readability and taps.'),
    },
  };

  const saveScale = async (next: FontScale) => {
    if (isSaving || next === fontScale) return;
    await haptics.selection();
    setIsSaving(true);
    try {
      await setFontScale(next);
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
          {t('读取字体设置中...', 'Loading font settings...')}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        <Text style={[styles.previewLabel, { color: colors.textMuted, fontSize: getScaledFontSize('xs', fontScale) }]}>
          {t('字号预览', 'Scale Preview')}
        </Text>
        <Text style={[styles.previewHero, { color: colors.text, fontSize: getScaledFontSize('hero', fontScale) }]}>
          24.68%
        </Text>
        <Text style={[styles.previewText, { color: colors.textSecondary, fontSize: getScaledFontSize('md', fontScale) }]}>
          {t('主题、设置和部分列表会立即使用新的字号。', 'Settings, chrome, and key lists update immediately.')}
        </Text>
      </View>

      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.surfaceBorder }]}>
        {options.map((item, index) => {
          const selected = fontScale === item;
          return (
            <React.Fragment key={item}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => saveScale(item)}
                activeOpacity={0.75}
                disabled={isSaving}
              >
                <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
                  <Ionicons name="text-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.info}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: getScaledFontSize('md', item) }}>
                    {labels[item].title}
                  </Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: getScaledFontSize('xs', item) }}>
                    {labels[item].subtitle}
                  </Text>
                </View>
                {selected ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
              </TouchableOpacity>
              {index < options.length - 1 ? (
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
  previewHero: {
    fontWeight: '800',
    lineHeight: 42,
  },
  previewText: {
    lineHeight: 22,
  },
  group: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
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
  divider: {
    height: 1,
    marginLeft: 50,
  },
});
