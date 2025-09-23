// app/(tabs)/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark';
  const headerBg = isDark ? '#000' : '#fff';
  const tint = isDark ? '#fff' : '#111';
  const tabBg = isDark ? '#000' : '#fff';

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: headerBg },
        headerTitleStyle: { color: tint },
        headerTintColor: tint,
        tabBarActiveTintColor: tint,
        tabBarInactiveTintColor: isDark ? '#aaa' : '#888',
        tabBarStyle: { backgroundColor: tabBg },
      }}
    >
      <Tabs.Screen
        name="每日練習"
        options={{
          title: '每日練習',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      {/* 你本身已有的頁面，按需要保持（例如 practice / mistakes / settings） */}
      <Tabs.Screen
        name="practice"
        options={{
          title: '練習',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mistakes"
        options={{
          title: '錯題',
          tabBarIcon: ({ color, size }) => <Ionicons name="bug-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
