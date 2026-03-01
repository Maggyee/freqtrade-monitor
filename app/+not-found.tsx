// 404 页面 - 路由未找到时显示

import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '页面未找到' }} />
      <View style={styles.container}>
        <Text style={styles.title}>页面不存在</Text>
        <Link href="/" asChild>
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
          >
            <Text style={styles.linkText}>返回首页</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: Colors.dark.background,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  link: {
    marginTop: 15,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: Colors.dark.primaryBg,
  },
  linkPressed: {
    opacity: 0.7,
  },
  linkText: {
    fontSize: 14,
    color: Colors.dark.primary,
  },
});
