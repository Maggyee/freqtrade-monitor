// Tab 导航布局 - 底部导航栏配置
// 基于 Stitch 设计：Dashboard / Trades / Bots / History / Settings

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Animated, Pressable } from 'react-native';
import { useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/Colors';

// 自定义动画 + 震动反馈的底部 Tab 按钮
const AnimatedTabBarButton = (props: any) => {
  const { children, onPress, accessibilityState } = props;
  const isSelected = accessibilityState?.selected;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.spring(scale, {
      toValue: 0.88,
      useNativeDriver: true,
      speed: 60,
      bounciness: 5,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 5,
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
  return (
    <Tabs
      screenOptions={{
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
          title: '仪表盘',
          headerTitle: '总览',
          tabBarLabel: '首页',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid" size={size - 2} color={color} />
          ),
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="trades"
        options={{
          title: '交易',
          headerTitle: '交易管理',
          tabBarLabel: '交易',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="swap-horizontal" size={size - 2} color={color} />
          ),
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: '历史',
          headerTitle: '历史记录',
          tabBarLabel: '历史',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size - 2} color={color} />
          ),
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: '设置',
          headerTitle: '设置中心',
          tabBarLabel: '设置',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size - 2} color={color} />
          ),
          tabBarButton: (props) => <AnimatedTabBarButton {...props} />,
        }}
      />
    </Tabs>
  );
}
