// 根布局文件 - 控制整个 App 的导航结构和主题
// 包含：启动时的 Session 恢复逻辑 + 暗色主题

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';

export {
  // 捕获 Layout 组件抛出的错误
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // 确保在页面重载时保留返回按钮
  initialRouteName: '(tabs)',
};

// 自定义暗色主题 - 使用我们的配色方案
const FreqtradeDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.surfaceBorder,
    notification: Colors.dark.warning,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const restoreSession = useBotStore((s) => s.restoreSession);
  const loadLanguage = useI18nStore((s) => s.loadLanguage);

  // 字体加载错误处理
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // 字体加载完成后尝试恢复登录状态
  useEffect(() => {
    if (loaded) {
      loadLanguage();
      restoreSession();
    }
  }, [loaded, loadLanguage, restoreSession]);

  if (!loaded) {
    return <View style={styles.appBackground} />;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const language = useI18nStore((s) => s.language);

  return (
    <View style={styles.appBackground}>
      {/* 固定使用暗色主题（交易 App 标配） */}
      <ThemeProvider value={FreqtradeDarkTheme}>
        {/* 状态栏亮色文字（配合暗色背景） */}
        <StatusBar style="light" backgroundColor={Colors.dark.background} translucent={false} />
        <Stack
          screenOptions={{
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: Colors.dark.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="login"
            options={{
              title: language === 'en' ? 'Connect Bot' : '连接机器人',
              presentation: 'modal',
              animation: 'slide_from_bottom',
              headerStyle: { backgroundColor: Colors.dark.surface },
              headerTintColor: Colors.dark.text,
            }}
          />
          <Stack.Screen
            name="trade/[id]"
            options={{
              title: language === 'en' ? 'Trade Detail' : '交易详情',
              headerStyle: { backgroundColor: Colors.dark.background },
              headerTintColor: Colors.dark.text,
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="global-params"
            options={{
              title: language === 'en' ? 'Global Parameters' : '全局参数',
              presentation: 'card',
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: Colors.dark.surface },
              headerTintColor: Colors.dark.text,
              contentStyle: { backgroundColor: Colors.dark.background },
            }}
          />
          <Stack.Screen
            name="theme-settings"
            options={{
              title: language === 'en' ? 'Theme Settings' : '主题设置',
              presentation: 'card',
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: Colors.dark.surface },
              headerTintColor: Colors.dark.text,
              contentStyle: { backgroundColor: Colors.dark.background },
            }}
          />
          <Stack.Screen
            name="font-settings"
            options={{
              title: language === 'en' ? 'Font Settings' : '字体设置',
              presentation: 'card',
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: Colors.dark.surface },
              headerTintColor: Colors.dark.text,
              contentStyle: { backgroundColor: Colors.dark.background },
            }}
          />
          <Stack.Screen
            name="language-settings"
            options={{
              title: language === 'en' ? 'Language Settings' : '语言设置',
              presentation: 'card',
              animation: 'slide_from_right',
              headerStyle: { backgroundColor: Colors.dark.surface },
              headerTintColor: Colors.dark.text,
              contentStyle: { backgroundColor: Colors.dark.background },
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
    backgroundColor: Colors.dark.background,
  },
});
