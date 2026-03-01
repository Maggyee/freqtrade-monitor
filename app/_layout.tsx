// 根布局文件 - 控制整个 App 的导航结构和主题
// 包含：启动时的 Session 恢复逻辑 + 暗色主题

import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/Colors';
import { useBotStore } from '@/src/stores/useBotStore';

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

  // 字体加载错误处理
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // 字体加载完成后尝试恢复登录状态
  useEffect(() => {
    if (loaded) {
      restoreSession();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    // 固定使用暗色主题（交易 App 标配）
    <ThemeProvider value={FreqtradeDarkTheme}>
      {/* 状态栏亮色文字（配合暗色背景） */}
      <StatusBar style="light" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            title: '连接机器人',
            presentation: 'modal',
            headerStyle: { backgroundColor: Colors.dark.surface },
            headerTintColor: Colors.dark.text,
          }}
        />
        <Stack.Screen
          name="trade/[id]"
          options={{
            title: '交易详情',
            headerStyle: { backgroundColor: Colors.dark.background },
            headerTintColor: Colors.dark.text,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="global-params"
          options={{
            title: '全局参数',
            presentation: 'modal',
            headerStyle: { backgroundColor: Colors.dark.surface },
            headerTintColor: Colors.dark.text,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
