import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { getThemeColors } from '@/constants/Colors';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const restoreSession = useBotStore((s) => s.restoreSession);
  const loadLanguage = useI18nStore((s) => s.loadLanguage);
  const loadAppearance = useAppearanceStore((s) => s.loadSettings);
  const appearanceReady = useAppearanceStore((s) => s.isReady);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (!fontsLoaded) return;
    loadAppearance();
    loadLanguage();
    restoreSession();
  }, [fontsLoaded, loadAppearance, loadLanguage, restoreSession]);

  if (!fontsLoaded || !appearanceReady) {
    return <View style={styles.appBackground} />;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const language = useI18nStore((s) => s.language);
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const colors = getThemeColors(themeMode);

  const appTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.surfaceBorder,
      notification: colors.warning,
    },
  };

  return (
    <View style={[styles.appBackground, { backgroundColor: colors.background }]}>
      <ThemeProvider value={appTheme}>
        <StatusBar style="light" backgroundColor={colors.background} translucent={false} />
        <Stack
          screenOptions={{
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="login"
            options={{
              title: language === 'en' ? 'Connect Bot' : '连接机器人',
              presentation: 'modal',
              animation: 'slide_from_bottom',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
            }}
          />
          <Stack.Screen
            name="trade/[id]"
            options={{
              title: language === 'en' ? 'Trade Detail' : '交易详情',
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="global-params"
            options={{
              title: language === 'en' ? 'Global Parameters' : '全局参数',
              presentation: 'card',
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="theme-settings"
            options={{
              title: language === 'en' ? 'Theme Settings' : '主题设置',
              presentation: 'card',
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="font-settings"
            options={{
              title: language === 'en' ? 'Font Settings' : '字体设置',
              presentation: 'card',
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="language-settings"
            options={{
              title: language === 'en' ? 'Language Settings' : '语言设置',
              presentation: 'card',
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.text,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </Stack>
      </ThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  appBackground: {
    flex: 1,
    backgroundColor: '#070B14',
  },
});
