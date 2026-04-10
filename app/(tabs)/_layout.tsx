import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Animated, Platform, Pressable } from 'react-native';

import { getScaledFontSize, getThemeColors } from '@/constants/Colors';
import { useAppearanceStore } from '@/src/stores/useAppearanceStore';
import { useBotStore } from '@/src/stores/useBotStore';
import { useI18nStore } from '@/src/stores/useI18nStore';

const AnimatedTabBarButton = (props: any) => {
  const { children, onPress } = props;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
      speed: 80,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 80,
      bounciness: 0,
    }).start();
  };

  return (
    <Pressable
      {...props}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      style={[props.style, { flex: 1, alignItems: 'center', justifyContent: 'center' }]}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function TabLayout() {
  const language = useI18nStore((s) => s.language);
  const themeMode = useAppearanceStore((s) => s.themeMode);
  const fontScale = useAppearanceStore((s) => s.fontScale);
  const colors = getThemeColors(themeMode);
  const isConnected = useBotStore((s) => s.isConnected);
  const isLoading = useBotStore((s) => s.isLoading);
  const server = useBotStore((s) => s.server);
  const servers = useBotStore((s) => s.servers);
  const activeServerId = useBotStore((s) => s.activeServerId);
  const restoreSession = useBotStore((s) => s.restoreSession);

  useEffect(() => {
    const hasSavedConnection = !!server || !!activeServerId || servers.length > 0;
    if (!hasSavedConnection || isConnected || isLoading) return;
    restoreSession();
  }, [activeServerId, isConnected, isLoading, restoreSession, server, servers.length]);

  return (
    <Tabs
      screenOptions={{
        sceneStyle: {
          backgroundColor: colors.background,
        },
        tabBarStyle: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: Platform.OS === 'ios' ? 16 : 12,
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceBorder,
          borderTopWidth: 1,
          borderRadius: 24,
          height: Platform.OS === 'ios' ? 78 : 66,
          paddingBottom: Platform.OS === 'ios' ? 18 : 10,
          paddingTop: 8,
          paddingHorizontal: 8,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.18,
          shadowRadius: 12,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarLabelStyle: {
          fontSize: getScaledFontSize(10, fontScale),
          fontWeight: '600',
          marginTop: 2,
        },
        headerStyle: {
          backgroundColor: colors.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: getScaledFontSize(18, fontScale),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: language === 'en' ? 'Dashboard' : '仪表盘',
          headerTitle: language === 'en' ? 'Overview' : '总览',
          tabBarLabel: language === 'en' ? 'Home' : '首页',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size - 2} color={color} />
          ),
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="trades"
        options={{
          title: language === 'en' ? 'Trades' : '交易',
          headerTitle: language === 'en' ? 'Trade Manager' : '交易管理',
          tabBarLabel: language === 'en' ? 'Trades' : '交易',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" size={size - 2} color={color} />
          ),
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: language === 'en' ? 'History' : '历史',
          headerTitle: language === 'en' ? 'Trade History' : '历史记录',
          tabBarLabel: language === 'en' ? 'History' : '历史',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size - 2} color={color} />
          ),
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: language === 'en' ? 'Settings' : '设置',
          headerTitle: language === 'en' ? 'Settings Center' : '设置中心',
          tabBarLabel: language === 'en' ? 'Settings' : '设置',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size - 2} color={color} />
          ),
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      />
    </Tabs>
  );
}
