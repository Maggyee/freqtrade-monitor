// Tab 导航布局 - 底部导航栏配置
// 基于 Stitch 设计：Dashboard / Trades / Bots / History / Settings

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Animated, Pressable } from 'react-native';
import { useRef } from 'react';
import { Colors } from '@/constants/Colors';
import { useI18nStore } from '@/src/stores/useI18nStore';

// 自定义动画的底部 Tab 按钮
const AnimatedTabBarButton = (props: any) => {
  const { children, onPress, accessibilityState } = props;
  const isSelected = accessibilityState?.selected;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.92,
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

  return (
    <Tabs
      screenOptions={{
        sceneStyle: {
          backgroundColor: Colors.dark.background,
        },
        // Tab 栏样式 - 优化高度与质感
        tabBarStyle: {
          backgroundColor: Colors.dark.tabBar,
          borderTopColor: Colors.dark.surfaceBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 30 : 12,
          paddingTop: 8,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
        },
        // 选中/未选中颜色 - 蓝色强调
        tabBarActiveTintColor: Colors.dark.primary,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        // 标签文字样式
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        },
        // 头部样式 - 无阴影 + 深色背景
        headerStyle: {
          backgroundColor: Colors.dark.background,
          elevation: 0,         // Android 去阴影
          shadowOpacity: 0,     // iOS 去阴影
          borderBottomWidth: 0, // 去掉底部边框
        },
        headerTintColor: Colors.dark.text,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
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
